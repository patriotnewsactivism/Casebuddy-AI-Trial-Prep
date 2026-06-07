import React, { useState, useEffect, useContext, useMemo, useCallback } from 'react';
import { AppContext } from '../App';
import {
  Calendar, Clock, AlertTriangle, CheckCircle, Plus, Trash2,
  Download, Bell, ChevronDown, Filter, BookOpen, ArrowRight,
  Scale, AlertCircle, X, Check,
} from 'lucide-react';
import { toast } from 'react-toastify';
import {
  CourtDeadline, DeadlineCategory,
  loadDeadlines, addDeadline, createFromTemplate,
  completeDeadline, dismissDeadline, deleteDeadline,
  refreshStatuses, exportICS, FRCP_TEMPLATES,
} from '../services/deadlineEngine';

/* ─── Helpers ─────────────────────────────────────────── */

const categoryColors: Record<DeadlineCategory, string> = {
  response: 'bg-blue-500/20 text-blue-400',
  discovery: 'bg-purple-500/20 text-purple-400',
  motion: 'bg-amber-500/20 text-amber-400',
  trial: 'bg-red-500/20 text-red-400',
  appeal: 'bg-orange-500/20 text-orange-400',
  'statute-of-limitations': 'bg-red-600/20 text-red-500',
  administrative: 'bg-slate-500/20 text-slate-400',
  custom: 'bg-emerald-500/20 text-emerald-400',
};

const priorityColors: Record<string, string> = {
  critical: 'text-red-400 border-red-500/50',
  high: 'text-amber-400 border-amber-500/50',
  medium: 'text-blue-400 border-blue-500/50',
  low: 'text-slate-400 border-slate-600',
};

const statusConfig: Record<string, { color: string; bg: string; label: string }> = {
  overdue: { color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/30', label: '⚠️ Overdue' },
  'due-soon': { color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/30', label: '⏰ Due Soon' },
  upcoming: { color: 'text-blue-400', bg: 'bg-slate-800 border-slate-700', label: 'Upcoming' },
  completed: { color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30', label: '✅ Completed' },
  dismissed: { color: 'text-slate-500', bg: 'bg-slate-800/50 border-slate-700', label: 'Dismissed' },
};

const daysUntil = (dateStr: string): number => {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
};

const formatDate = (dateStr: string): string => {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
};

/* ─── Main Component ──────────────────────────────────── */

const DeadlineEngine: React.FC = () => {
  const { activeCase } = useContext(AppContext);
  const [deadlines, setDeadlines] = useState<CourtDeadline[]>([]);
  const [tab, setTab] = useState<'active' | 'completed' | 'templates'>('active');
  const [showAddForm, setShowAddForm] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [templateSearch, setTemplateSearch] = useState('');
  const [triggerDate, setTriggerDate] = useState(new Date().toISOString().slice(0, 10));

  // Custom deadline form
  const [newTitle, setNewTitle] = useState('');
  const [newDate, setNewDate] = useState('');
  const [newCategory, setNewCategory] = useState<DeadlineCategory>('custom');
  const [newPriority, setNewPriority] = useState<CourtDeadline['priority']>('medium');
  const [newNotes, setNewNotes] = useState('');
  const [newRule, setNewRule] = useState('');

  // Refresh from storage
  const reload = useCallback(() => {
    refreshStatuses();
    setDeadlines(loadDeadlines());
  }, []);

  useEffect(() => {
    reload();
    const handler = () => reload();
    window.addEventListener('deadlines-update', handler);
    // Refresh status every minute
    const interval = setInterval(reload, 60000);
    return () => {
      window.removeEventListener('deadlines-update', handler);
      clearInterval(interval);
    };
  }, [reload]);

  // Filtered & sorted
  const activeDeadlines = useMemo(() => {
    let filtered = deadlines.filter(d => d.status !== 'completed' && d.status !== 'dismissed');
    if (filterCategory !== 'all') {
      filtered = filtered.filter(d => d.category === filterCategory);
    }
    if (activeCase) {
      // Show case-specific first, then general
      filtered.sort((a, b) => {
        const aCase = a.caseId === activeCase.id ? -1 : 1;
        const bCase = b.caseId === activeCase.id ? -1 : 1;
        if (aCase !== bCase) return aCase - bCase;
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      });
    } else {
      filtered.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
    }
    return filtered;
  }, [deadlines, filterCategory, activeCase]);

  const completedDeadlines = useMemo(
    () => deadlines.filter(d => d.status === 'completed' || d.status === 'dismissed')
      .sort((a, b) => new Date(b.completedAt || b.dueDate).getTime() - new Date(a.completedAt || a.dueDate).getTime()),
    [deadlines]
  );

  const overdueCount = useMemo(() => deadlines.filter(d => d.status === 'overdue').length, [deadlines]);
  const dueSoonCount = useMemo(() => deadlines.filter(d => d.status === 'due-soon').length, [deadlines]);

  const filteredTemplates = useMemo(() => {
    if (!templateSearch.trim()) return FRCP_TEMPLATES;
    const q = templateSearch.toLowerCase();
    return FRCP_TEMPLATES.filter(
      t => t.label.toLowerCase().includes(q) || t.description.toLowerCase().includes(q) || t.ruleReference.toLowerCase().includes(q)
    );
  }, [templateSearch]);

  /* ── Handlers ── */
  const handleAddCustom = () => {
    if (!newTitle.trim() || !newDate) {
      toast.error('Title and due date are required');
      return;
    }
    addDeadline({
      title: newTitle,
      description: newNotes || newTitle,
      dueDate: newDate,
      category: newCategory,
      priority: newPriority,
      caseId: activeCase?.id,
      ruleReference: newRule || undefined,
      notes: newNotes || undefined,
      reminderDays: [14, 7, 3, 1],
    });
    setNewTitle('');
    setNewDate('');
    setNewCategory('custom');
    setNewPriority('medium');
    setNewNotes('');
    setNewRule('');
    setShowAddForm(false);
    reload();
    toast.success('Deadline added');
  };

  const handleAddTemplate = (idx: number) => {
    const dl = createFromTemplate(idx, triggerDate, activeCase?.id);
    if (dl) {
      reload();
      toast.success(`Added: ${dl.title} — due ${formatDate(dl.dueDate)}`);
    }
  };

  const handleComplete = (id: string) => {
    completeDeadline(id);
    reload();
    toast.success('Marked complete');
  };

  const handleDismiss = (id: string) => {
    dismissDeadline(id);
    reload();
  };

  const handleDelete = (id: string) => {
    deleteDeadline(id);
    reload();
    toast.success('Deleted');
  };

  const handleExportICS = () => {
    const ics = exportICS(activeDeadlines);
    const blob = new Blob([ics], { type: 'text/calendar' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'casebuddy-deadlines.ics';
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Calendar file downloaded');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white font-serif">
            Court Deadline Engine
          </h1>
          <p className="text-slate-400 mt-1 text-sm">
            Rules-based deadline tracking with statute of limitations alerts
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportICS}
            className="flex items-center gap-1 px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm text-white transition-colors"
            title="Export to calendar"
          >
            <Download size={14} />
            Export .ics
          </button>
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-1 px-3 py-2 bg-gold-500 hover:bg-gold-600 rounded-lg text-sm text-slate-900 font-semibold transition-colors"
          >
            <Plus size={14} />
            Add Deadline
          </button>
        </div>
      </div>

      {/* Alert Banner */}
      {(overdueCount > 0 || dueSoonCount > 0) && (
        <div className={`border rounded-xl p-4 flex items-center gap-3 ${
          overdueCount > 0 ? 'bg-red-500/10 border-red-500/30' : 'bg-amber-500/10 border-amber-500/30'
        }`}>
          <AlertTriangle size={20} className={overdueCount > 0 ? 'text-red-400' : 'text-amber-400'} />
          <div>
            <p className={`font-semibold ${overdueCount > 0 ? 'text-red-300' : 'text-amber-300'}`}>
              {overdueCount > 0 && `${overdueCount} OVERDUE deadline${overdueCount > 1 ? 's' : ''}`}
              {overdueCount > 0 && dueSoonCount > 0 && ' • '}
              {dueSoonCount > 0 && `${dueSoonCount} due within 7 days`}
            </p>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Active', value: activeDeadlines.length, color: 'text-white', icon: Calendar },
          { label: 'Overdue', value: overdueCount, color: 'text-red-400', icon: AlertTriangle },
          { label: 'Due Soon', value: dueSoonCount, color: 'text-amber-400', icon: Clock },
          { label: 'Completed', value: completedDeadlines.filter(d => d.status === 'completed').length, color: 'text-emerald-400', icon: CheckCircle },
        ].map(s => (
          <div key={s.label} className="bg-slate-800 border border-slate-700 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <s.icon size={14} className={s.color} />
              <span className="text-xs text-slate-500 uppercase">{s.label}</span>
            </div>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-700 pb-2">
        {([
          { id: 'active' as const, label: 'Active Deadlines' },
          { id: 'completed' as const, label: 'Completed' },
          { id: 'templates' as const, label: 'FRCP Templates' },
        ]).map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
              tab === t.id
                ? 'bg-slate-800 text-white border-b-2 border-gold-500'
                : 'text-slate-500 hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Active Deadlines Tab ── */}
      {tab === 'active' && (
        <>
          {/* Filter */}
          <div className="flex gap-2 flex-wrap">
            {['all', 'response', 'discovery', 'motion', 'trial', 'appeal', 'statute-of-limitations', 'custom'].map(cat => (
              <button
                key={cat}
                onClick={() => setFilterCategory(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  filterCategory === cat
                    ? 'bg-gold-500 text-slate-900'
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                {cat === 'all' ? 'All' : cat.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
              </button>
            ))}
          </div>

          {activeDeadlines.length === 0 ? (
            <div className="text-center py-16 text-slate-500">
              <Calendar size={40} className="mx-auto mb-3 opacity-50" />
              <p>No active deadlines.</p>
              <p className="text-sm mt-1">Add one above or use FRCP Templates to get started.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {activeDeadlines.map(dl => {
                const days = daysUntil(dl.dueDate);
                const sc = statusConfig[dl.status];
                return (
                  <div
                    key={dl.id}
                    className={`border rounded-xl p-4 transition-all ${sc.bg}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${categoryColors[dl.category]}`}>
                            {dl.category.replace(/-/g, ' ')}
                          </span>
                          <span className={`text-xs px-2 py-0.5 rounded-full border ${priorityColors[dl.priority]}`}>
                            {dl.priority}
                          </span>
                        </div>
                        <h3 className="text-white font-semibold">{dl.title}</h3>
                        <p className="text-sm text-slate-400 mt-0.5">{dl.description}</p>
                        {dl.ruleReference && (
                          <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                            <BookOpen size={11} />
                            {dl.ruleReference}
                          </p>
                        )}
                      </div>
                      <div className="text-right ml-4">
                        <p className={`text-lg font-bold ${sc.color}`}>
                          {days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? 'TODAY' : `${days}d`}
                        </p>
                        <p className="text-xs text-slate-500">{formatDate(dl.dueDate)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-3">
                      <button
                        onClick={() => handleComplete(dl.id)}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs bg-emerald-500/20 text-emerald-400 rounded-lg hover:bg-emerald-500/30 transition-colors"
                      >
                        <Check size={12} />
                        Complete
                      </button>
                      <button
                        onClick={() => handleDismiss(dl.id)}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs bg-slate-700 text-slate-400 rounded-lg hover:bg-slate-600 transition-colors"
                      >
                        <X size={12} />
                        Dismiss
                      </button>
                      <button
                        onClick={() => handleDelete(dl.id)}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs text-red-400 hover:text-red-300 transition-colors ml-auto"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ── Completed Tab ── */}
      {tab === 'completed' && (
        completedDeadlines.length === 0 ? (
          <div className="text-center py-16 text-slate-500">
            <CheckCircle size={40} className="mx-auto mb-3 opacity-50" />
            <p>No completed deadlines yet.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {completedDeadlines.map(dl => (
              <div key={dl.id} className="bg-slate-800/50 border border-slate-700 rounded-lg p-3 flex items-center justify-between opacity-75">
                <div>
                  <p className="text-sm text-slate-300 line-through">{dl.title}</p>
                  <p className="text-xs text-slate-500">{formatDate(dl.dueDate)} • {dl.status}</p>
                </div>
                <button onClick={() => handleDelete(dl.id)} className="text-slate-600 hover:text-red-400">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )
      )}

      {/* ── FRCP Templates Tab ── */}
      {tab === 'templates' && (
        <>
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 mb-4">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <label className="text-xs text-slate-500 mb-1 block">Search Templates</label>
                <input
                  type="text"
                  value={templateSearch}
                  onChange={e => setTemplateSearch(e.target.value)}
                  placeholder="Search rules, deadlines..."
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Trigger Date</label>
                <input
                  type="date"
                  value={triggerDate}
                  onChange={e => setTriggerDate(e.target.value)}
                  className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm"
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            {filteredTemplates.map((tpl, idx) => {
              const realIdx = FRCP_TEMPLATES.indexOf(tpl);
              const dueDate = new Date(triggerDate);
              dueDate.setDate(dueDate.getDate() + tpl.daysFromTrigger);
              return (
                <div key={idx} className="bg-slate-800 border border-slate-700 rounded-lg p-4 flex items-center gap-4 hover:border-slate-600 transition-colors">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${categoryColors[tpl.category]}`}>
                        {tpl.category.replace(/-/g, ' ')}
                      </span>
                      <span className="text-xs text-slate-500">{tpl.ruleReference}</span>
                    </div>
                    <h4 className="text-white font-medium text-sm">{tpl.label}</h4>
                    <p className="text-xs text-slate-400 mt-0.5">{tpl.description}</p>
                    <p className="text-xs text-slate-500 mt-1">
                      {tpl.daysFromTrigger} days from "{tpl.triggerEvent}" → Due: {formatDate(dueDate.toISOString().slice(0, 10))}
                    </p>
                  </div>
                  <button
                    onClick={() => handleAddTemplate(realIdx)}
                    className="flex items-center gap-1 px-3 py-2 bg-gold-500/20 text-gold-500 rounded-lg text-sm hover:bg-gold-500/30 transition-colors whitespace-nowrap"
                  >
                    <Plus size={14} />
                    Add
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ── Add Custom Deadline Modal ── */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 w-full max-w-lg">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white">Add Custom Deadline</h2>
              <button onClick={() => setShowAddForm(false)} className="text-slate-500 hover:text-white">
                <X size={20} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Deadline Title *</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  placeholder="e.g. File Response to Summary Judgment"
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Due Date *</label>
                  <input
                    type="date"
                    value={newDate}
                    onChange={e => setNewDate(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Priority</label>
                  <select
                    value={newPriority}
                    onChange={e => setNewPriority(e.target.value as any)}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm"
                  >
                    <option value="critical">Critical</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Category</label>
                  <select
                    value={newCategory}
                    onChange={e => setNewCategory(e.target.value as any)}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm"
                  >
                    <option value="response">Response</option>
                    <option value="discovery">Discovery</option>
                    <option value="motion">Motion</option>
                    <option value="trial">Trial</option>
                    <option value="appeal">Appeal</option>
                    <option value="statute-of-limitations">Statute of Limitations</option>
                    <option value="administrative">Administrative</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Rule Reference</label>
                  <input
                    type="text"
                    value={newRule}
                    onChange={e => setNewRule(e.target.value)}
                    placeholder="e.g. FRCP 12(a)(1)"
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Notes</label>
                <textarea
                  value={newNotes}
                  onChange={e => setNewNotes(e.target.value)}
                  placeholder="Additional notes..."
                  rows={2}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm resize-y"
                />
              </div>
              <div className="flex gap-3 mt-2">
                <button
                  onClick={handleAddCustom}
                  className="flex-1 bg-gold-500 hover:bg-gold-600 text-slate-900 font-bold py-2.5 rounded-lg transition-colors"
                >
                  Add Deadline
                </button>
                <button
                  onClick={() => setShowAddForm(false)}
                  className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DeadlineEngine;
