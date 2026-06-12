import React, { useState, useEffect, useMemo } from 'react';
import { FolderOpen, Plus, Search, Trash2, Edit3, ChevronDown, ChevronUp, Users, FileText, Clock, AlertTriangle, X, Scale, Tag, MapPin, DollarSign } from 'lucide-react';
import { Link } from 'react-router-dom';

// ─── Types ──────────────────────────────────────────────────────────
interface CaseFile {
  id: string;
  title: string;
  caseNumber: string;
  clientName: string;
  caseType: string;
  status: 'intake' | 'discovery' | 'motions' | 'trial-prep' | 'trial' | 'appeal' | 'closed' | 'won' | 'lost';
  priority: 'critical' | 'high' | 'medium' | 'low';
  jurisdiction: string;
  court: string;
  filedDate: string;
  nextDeadline: string;
  nextDeadlineLabel: string;
  opposingCounsel: string;
  description: string;
  claimAmount: string;
  tags: string[];
  witnesses: string[];
  notes: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Constants ──────────────────────────────────────────────────────
const CASE_TYPES = ['Civil Rights', 'Personal Injury', 'Criminal Defense', 'Employment', 'Family Law', 'Contract', 'Real Estate', 'Medical Malpractice', 'Intellectual Property', 'Immigration', 'Bankruptcy', 'Other'];
const STATUSES: { id: CaseFile['status']; label: string; color: string; bg: string }[] = [
  { id: 'intake', label: 'Intake', color: 'text-violet-400', bg: 'bg-violet-500/20 border-violet-500/30' },
  { id: 'discovery', label: 'Discovery', color: 'text-blue-400', bg: 'bg-blue-500/20 border-blue-500/30' },
  { id: 'motions', label: 'Motions', color: 'text-cyan-400', bg: 'bg-cyan-500/20 border-cyan-500/30' },
  { id: 'trial-prep', label: 'Trial Prep', color: 'text-orange-400', bg: 'bg-orange-500/20 border-orange-500/30' },
  { id: 'trial', label: 'Trial', color: 'text-red-400', bg: 'bg-red-500/20 border-red-500/30' },
  { id: 'appeal', label: 'Appeal', color: 'text-yellow-400', bg: 'bg-yellow-500/20 border-yellow-500/30' },
  { id: 'closed', label: 'Closed', color: 'text-slate-400', bg: 'bg-slate-500/20 border-slate-500/30' },
  { id: 'won', label: 'Won', color: 'text-green-400', bg: 'bg-green-500/20 border-green-500/30' },
  { id: 'lost', label: 'Lost', color: 'text-red-400', bg: 'bg-red-500/20 border-red-500/30' },
];
const PRIORITIES: { id: CaseFile['priority']; label: string; color: string }[] = [
  { id: 'critical', label: 'Critical', color: 'text-red-400' },
  { id: 'high', label: 'High', color: 'text-orange-400' },
  { id: 'medium', label: 'Medium', color: 'text-yellow-400' },
  { id: 'low', label: 'Low', color: 'text-slate-400' },
];

const STORAGE_KEY = 'casebuddy_cases';

const blankCase = (): Omit<CaseFile, 'id' | 'createdAt' | 'updatedAt'> => ({
  title: '', caseNumber: '', clientName: '', caseType: 'Civil Rights',
  status: 'intake', priority: 'medium', jurisdiction: 'Federal',
  court: '', filedDate: '', nextDeadline: '', nextDeadlineLabel: '',
  opposingCounsel: '', description: '', claimAmount: '', tags: [],
  witnesses: [], notes: '',
});

// Demo data
const DEMO_CASES: CaseFile[] = [
  {
    id: 'demo-1', title: 'Reardon v. Osteen et al.', caseNumber: '3:25-CV-203',
    clientName: 'Matthew Oliver Reardon', caseType: 'Civil Rights', status: 'motions',
    priority: 'critical', jurisdiction: 'Federal — S.D. Tex.', court: 'Galveston Division',
    filedDate: '2025-06-15', nextDeadline: new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0],
    nextDeadlineLabel: 'Sur-Reply Filing Deadline',
    opposingCounsel: 'Lewis Brisbois (Helfand & Giles)',
    description: '42 U.S.C. § 1983 — Unlawful arrest, malicious prosecution, Brady violation, First Amendment retaliation. Officer fabricated alcohol intoxication narrative despite zero-BAC toxicology.',
    claimAmount: '$2,500,000', tags: ['§1983', 'Brady', 'First Amendment', 'Malicious Prosecution'],
    witnesses: ['Officer William Osteen', 'Sgt. Jack Doraty', 'Plaintiff (Reardon)'],
    notes: 'Defendants\' Reply (Dkt. 79) contains ¶14 fatal admission — Osteen knew alcohol narrative was false. Sur-reply filed.',
    createdAt: '2025-06-15T10:00:00Z', updatedAt: new Date().toISOString(),
  },
];

// ─── Component ──────────────────────────────────────────────────────
export default function Cases() {
  const [cases, setCases] = useState<CaseFile[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : DEMO_CASES;
    } catch { return DEMO_CASES; }
  });
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(blankCase());
  const [tagInput, setTagInput] = useState('');
  const [witnessInput, setWitnessInput] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [expandedCase, setExpandedCase] = useState<string | null>(null);

  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(cases)); }, [cases]);

  const filtered = useMemo(() => {
    return cases.filter(c => {
      const matchSearch = !search || [c.title, c.caseNumber, c.clientName, c.description, ...c.tags]
        .some(s => s.toLowerCase().includes(search.toLowerCase()));
      const matchStatus = statusFilter === 'all' || c.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [cases, search, statusFilter]);

  const stats = useMemo(() => ({
    total: cases.length,
    active: cases.filter(c => !['closed', 'won', 'lost'].includes(c.status)).length,
    critical: cases.filter(c => c.priority === 'critical' && !['closed', 'won', 'lost'].includes(c.status)).length,
    upcoming: cases.filter(c => {
      if (!c.nextDeadline) return false;
      const days = Math.ceil((new Date(c.nextDeadline).getTime() - Date.now()) / 86400000);
      return days >= 0 && days <= 7;
    }).length,
  }), [cases]);

  const saveCase = () => {
    if (!form.title.trim()) return;
    const now = new Date().toISOString();
    if (editingId) {
      setCases(prev => prev.map(c => c.id === editingId ? { ...c, ...form, updatedAt: now } : c));
    } else {
      const newCase: CaseFile = { ...form, id: `case-${Date.now()}`, createdAt: now, updatedAt: now };
      setCases(prev => [newCase, ...prev]);
    }
    setForm(blankCase()); setShowForm(false); setEditingId(null);
  };

  const editCase = (c: CaseFile) => {
    const { id, createdAt, updatedAt, ...rest } = c;
    setForm(rest); setEditingId(id); setShowForm(true);
  };

  const deleteCase = (id: string) => { setCases(prev => prev.filter(c => c.id !== id)); };

  const addTag = () => { if (tagInput.trim() && !form.tags.includes(tagInput.trim())) { setForm(f => ({ ...f, tags: [...f.tags, tagInput.trim()] })); setTagInput(''); } };
  const removeTag = (t: string) => setForm(f => ({ ...f, tags: f.tags.filter(x => x !== t) }));
  const addWitness = () => { if (witnessInput.trim()) { setForm(f => ({ ...f, witnesses: [...f.witnesses, witnessInput.trim()] })); setWitnessInput(''); } };
  const removeWitness = (w: string) => setForm(f => ({ ...f, witnesses: f.witnesses.filter(x => x !== w) }));

  const daysUntil = (d: string) => d ? Math.ceil((new Date(d).getTime() - Date.now()) / 86400000) : null;
  const statusMeta = (s: string) => STATUSES.find(x => x.id === s) || STATUSES[0];
  const priorityMeta = (p: string) => PRIORITIES.find(x => x.id === p) || PRIORITIES[2];

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Case Manager</h1>
          <p className="text-slate-400 text-sm">Track every case from intake to verdict — all AI modules link back here</p>
        </div>
        <button onClick={() => { setForm(blankCase()); setEditingId(null); setShowForm(true); }}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors shadow-lg shadow-blue-600/20">
          <Plus size={16} /> New Case
        </button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Cases', value: stats.total, icon: FolderOpen, color: 'text-blue-400' },
          { label: 'Active', value: stats.active, icon: Scale, color: 'text-green-400' },
          { label: 'Critical', value: stats.critical, icon: AlertTriangle, color: 'text-red-400' },
          { label: 'Deadlines This Week', value: stats.upcoming, icon: Clock, color: 'text-yellow-400' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-slate-800 border border-slate-700 rounded-xl p-4">
            <Icon size={16} className={`${color} mb-1.5`} />
            <div className={`text-xl font-black ${color}`}>{value}</div>
            <div className="text-slate-500 text-xs">{label}</div>
          </div>
        ))}
      </div>

      {/* Search + Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="flex-1 min-w-[200px] relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search cases, numbers, parties..."
            className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none">
          <option value="all">All Statuses</option>
          {STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
      </div>

      {/* Case Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-slate-700">
              <h2 className="text-white font-bold text-lg">{editingId ? 'Edit Case' : 'New Case'}</h2>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-white"><X size={20} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Case Title *</label>
                  <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Smith v. City of Memphis"
                    className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm" />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Case Number</label>
                  <input value={form.caseNumber} onChange={e => setForm(f => ({ ...f, caseNumber: e.target.value }))} placeholder="e.g. 3:25-CV-203"
                    className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm" />
                </div>
              </div>
              <div className="grid md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Client Name</label>
                  <input value={form.clientName} onChange={e => setForm(f => ({ ...f, clientName: e.target.value }))} placeholder="Full name"
                    className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm" />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Case Type</label>
                  <select value={form.caseType} onChange={e => setForm(f => ({ ...f, caseType: e.target.value }))}
                    className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm">
                    {CASE_TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid md:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Status</label>
                  <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as any }))}
                    className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm">
                    {STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Priority</label>
                  <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value as any }))}
                    className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm">
                    {PRIORITIES.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Claim Amount</label>
                  <input value={form.claimAmount} onChange={e => setForm(f => ({ ...f, claimAmount: e.target.value }))} placeholder="$0"
                    className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm" />
                </div>
              </div>
              <div className="grid md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Jurisdiction</label>
                  <input value={form.jurisdiction} onChange={e => setForm(f => ({ ...f, jurisdiction: e.target.value }))} placeholder="e.g. Federal — S.D. Tex."
                    className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm" />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Court / Division</label>
                  <input value={form.court} onChange={e => setForm(f => ({ ...f, court: e.target.value }))} placeholder="e.g. Galveston Division"
                    className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm" />
                </div>
              </div>
              <div className="grid md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Filed Date</label>
                  <input type="date" value={form.filedDate} onChange={e => setForm(f => ({ ...f, filedDate: e.target.value }))}
                    className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm" />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Opposing Counsel</label>
                  <input value={form.opposingCounsel} onChange={e => setForm(f => ({ ...f, opposingCounsel: e.target.value }))} placeholder="Firm / Attorney"
                    className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm" />
                </div>
              </div>
              <div className="grid md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Next Deadline</label>
                  <input type="date" value={form.nextDeadline} onChange={e => setForm(f => ({ ...f, nextDeadline: e.target.value }))}
                    className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm" />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Deadline Label</label>
                  <input value={form.nextDeadlineLabel} onChange={e => setForm(f => ({ ...f, nextDeadlineLabel: e.target.value }))} placeholder="e.g. Response to MTD"
                    className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm" />
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Case Description</label>
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} placeholder="Brief summary of claims and facts..."
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm resize-none" />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Tags</label>
                <div className="flex gap-2 mb-2 flex-wrap">
                  {form.tags.map(t => (
                    <span key={t} className="flex items-center gap-1 bg-blue-600/20 text-blue-300 text-xs px-2 py-1 rounded-full">
                      {t} <button onClick={() => removeTag(t)}><X size={10} /></button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addTag())}
                    placeholder="Add tag..." className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-1.5 text-white text-sm" />
                  <button onClick={addTag} className="bg-slate-700 text-slate-300 px-3 py-1.5 rounded-lg text-xs hover:bg-slate-600">Add</button>
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Witnesses</label>
                <div className="flex gap-2 mb-2 flex-wrap">
                  {form.witnesses.map(w => (
                    <span key={w} className="flex items-center gap-1 bg-orange-600/20 text-orange-300 text-xs px-2 py-1 rounded-full">
                      {w} <button onClick={() => removeWitness(w)}><X size={10} /></button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input value={witnessInput} onChange={e => setWitnessInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addWitness())}
                    placeholder="Add witness..." className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-1.5 text-white text-sm" />
                  <button onClick={addWitness} className="bg-slate-700 text-slate-300 px-3 py-1.5 rounded-lg text-xs hover:bg-slate-600">Add</button>
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Notes</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} placeholder="Internal notes..."
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm resize-none" />
              </div>
            </div>
            <div className="p-5 border-t border-slate-700 flex justify-end gap-3">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-slate-400 hover:text-white text-sm">Cancel</button>
              <button onClick={saveCase} disabled={!form.title.trim()}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white px-6 py-2 rounded-xl text-sm font-semibold transition-colors">
                {editingId ? 'Save Changes' : 'Create Case'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Case Cards */}
      {filtered.length === 0 ? (
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-12 text-center">
          <FolderOpen className="text-slate-600 mx-auto mb-4" size={48} />
          <div className="text-slate-400 text-lg font-medium">{search || statusFilter !== 'all' ? 'No matching cases' : 'No cases yet'}</div>
          <div className="text-slate-500 text-sm mt-2 mb-6">Start with an AI Intake to automatically create your first case file</div>
          <Link to="/intake" className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg text-sm font-medium transition-colors inline-block">
            Start AI Intake
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(c => {
            const sm = statusMeta(c.status);
            const pm = priorityMeta(c.priority);
            const days = daysUntil(c.nextDeadline);
            const isExpanded = expandedCase === c.id;

            return (
              <div key={c.id} className={`bg-slate-800 border rounded-xl overflow-hidden transition-all ${c.priority === 'critical' ? 'border-red-500/30' : 'border-slate-700'}`}>
                {/* Main row */}
                <div className="p-4 flex items-start gap-4 cursor-pointer" onClick={() => setExpandedCase(isExpanded ? null : c.id)}>
                  {/* Priority indicator */}
                  <div className={`w-1.5 h-12 rounded-full flex-shrink-0 mt-1 ${c.priority === 'critical' ? 'bg-red-500' : c.priority === 'high' ? 'bg-orange-500' : c.priority === 'medium' ? 'bg-yellow-500' : 'bg-slate-600'}`} />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1 flex-wrap">
                      <h3 className="text-white font-semibold text-sm">{c.title}</h3>
                      {c.caseNumber && <span className="text-slate-500 text-xs font-mono">{c.caseNumber}</span>}
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${sm.bg} ${sm.color}`}>{sm.label}</span>
                      <span className={`text-xs ${pm.color}`}>● {pm.label}</span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-slate-400">
                      {c.clientName && <span className="flex items-center gap-1"><Users size={11} /> {c.clientName}</span>}
                      <span className="flex items-center gap-1"><Tag size={11} /> {c.caseType}</span>
                      {c.jurisdiction && <span className="flex items-center gap-1"><MapPin size={11} /> {c.jurisdiction}</span>}
                      {c.claimAmount && <span className="flex items-center gap-1"><DollarSign size={11} /> {c.claimAmount}</span>}
                    </div>
                  </div>

                  {/* Deadline badge */}
                  <div className="text-right flex-shrink-0">
                    {days !== null && (
                      <div className={`text-xs font-bold ${days < 0 ? 'text-red-400' : days <= 3 ? 'text-red-400' : days <= 7 ? 'text-yellow-400' : 'text-slate-400'}`}>
                        {days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? 'TODAY' : `${days}d`}
                      </div>
                    )}
                    {c.nextDeadlineLabel && <div className="text-slate-500 text-xs mt-0.5 max-w-[140px] truncate">{c.nextDeadlineLabel}</div>}
                    <div className="mt-1.5">
                      {isExpanded ? <ChevronUp size={14} className="text-slate-500" /> : <ChevronDown size={14} className="text-slate-500" />}
                    </div>
                  </div>
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="border-t border-slate-700 p-5 space-y-4 bg-slate-850">
                    {c.description && (
                      <div>
                        <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-1">Description</p>
                        <p className="text-slate-300 text-sm leading-relaxed">{c.description}</p>
                      </div>
                    )}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {c.court && <div><p className="text-xs text-slate-500">Court</p><p className="text-white text-sm">{c.court}</p></div>}
                      {c.opposingCounsel && <div><p className="text-xs text-slate-500">Opposing Counsel</p><p className="text-white text-sm">{c.opposingCounsel}</p></div>}
                      {c.filedDate && <div><p className="text-xs text-slate-500">Filed</p><p className="text-white text-sm">{new Date(c.filedDate).toLocaleDateString()}</p></div>}
                      {c.nextDeadline && <div><p className="text-xs text-slate-500">Next Deadline</p><p className="text-white text-sm">{new Date(c.nextDeadline).toLocaleDateString()} — {c.nextDeadlineLabel}</p></div>}
                    </div>
                    {c.tags.length > 0 && (
                      <div>
                        <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-1.5">Tags</p>
                        <div className="flex gap-1.5 flex-wrap">
                          {c.tags.map(t => <span key={t} className="bg-blue-600/15 text-blue-300 text-xs px-2.5 py-1 rounded-full">{t}</span>)}
                        </div>
                      </div>
                    )}
                    {c.witnesses.length > 0 && (
                      <div>
                        <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-1.5">Witnesses</p>
                        <div className="flex gap-1.5 flex-wrap">
                          {c.witnesses.map(w => <span key={w} className="bg-orange-600/15 text-orange-300 text-xs px-2.5 py-1 rounded-full">{w}</span>)}
                        </div>
                      </div>
                    )}
                    {c.notes && (
                      <div>
                        <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-1">Notes</p>
                        <p className="text-slate-400 text-sm">{c.notes}</p>
                      </div>
                    )}

                    {/* Quick Actions */}
                    <div className="flex items-center gap-2 pt-2 border-t border-slate-700">
                      <Link to="/documents" className="flex items-center gap-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 px-3 py-1.5 rounded-lg text-xs transition-colors">
                        <FileText size={12} /> Analyze Docs
                      </Link>
                      <Link to="/witnesses" className="flex items-center gap-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 px-3 py-1.5 rounded-lg text-xs transition-colors">
                        <Users size={12} /> Prep Witnesses
                      </Link>
                      <Link to="/research" className="flex items-center gap-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 px-3 py-1.5 rounded-lg text-xs transition-colors">
                        <Scale size={12} /> Research
                      </Link>
                      <Link to="/deadlines" className="flex items-center gap-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 px-3 py-1.5 rounded-lg text-xs transition-colors">
                        <Clock size={12} /> Deadlines
                      </Link>
                      <div className="ml-auto flex gap-2">
                        <button onClick={(e) => { e.stopPropagation(); editCase(c); }} className="text-blue-400 hover:text-blue-300 p-1.5"><Edit3 size={14} /></button>
                        <button onClick={(e) => { e.stopPropagation(); deleteCase(c.id); }} className="text-red-400 hover:text-red-300 p-1.5"><Trash2 size={14} /></button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
