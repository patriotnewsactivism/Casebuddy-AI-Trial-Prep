import React, { useState, useContext, useCallback, useEffect } from 'react';
import { AppContext } from '../App';
import {
  Bot, Play, CheckCircle, XCircle, Clock, Send, Mail, FileText,
  AlertTriangle, ChevronDown, ChevronRight, Settings, Loader2,
  Users, Brain, Phone, Zap, Shield, Eye, Edit3, RefreshCw,
  Briefcase, Calendar, Copy, ExternalLink, RotateCcw, Trash2,
  Sparkles, Target, Scale
} from 'lucide-react';
import { toast } from 'react-toastify';
import {
  analyzeForParalegal,
  analyzeForReceptionist,
  analyzeForPartner,
  createTask,
  approveTask,
  executeTask,
  cancelTask,
  generateFollowUp,
  getAllTasks,
  getOverdueTasks,
  getPendingTasks,
  saveAgentConfig,
  loadAgentConfig,
  AgentTask,
  AgentAnalysis,
  RecommendedTask,
  AgentConfig,
  AgentRole,
  TaskStatus,
} from '../services/agentService';

type ViewMode = 'dashboard' | 'tasks' | 'settings';
type AgentFilter = 'all' | AgentRole;

const AGENT_INFO: Record<AgentRole, { label: string; icon: React.ElementType; color: string; bgColor: string; description: string }> = {
  paralegal: { label: 'AI Paralegal', icon: FileText, color: 'text-blue-400', bgColor: 'bg-blue-500/10 border-blue-500/30', description: 'FOIA requests, records requests, discovery responses, deadline tracking, follow-ups' },
  receptionist: { label: 'AI Receptionist', icon: Phone, color: 'text-green-400', bgColor: 'bg-green-500/10 border-green-500/30', description: 'Client intake, communications, appointment reminders, document collection' },
  partner: { label: 'AI Partner', icon: Brain, color: 'text-purple-400', bgColor: 'bg-purple-500/10 border-purple-500/30', description: 'Strategic review, weakness analysis, settlement assessment, devil\'s advocate' },
};

const STATUS_STYLES: Record<TaskStatus, { label: string; color: string; icon: React.ElementType }> = {
  pending: { label: 'Pending Approval', color: 'text-yellow-400 bg-yellow-500/10', icon: Clock },
  approved: { label: 'Approved', color: 'text-blue-400 bg-blue-500/10', icon: CheckCircle },
  sent: { label: 'Sent', color: 'text-green-400 bg-green-500/10', icon: Send },
  delivered: { label: 'Delivered', color: 'text-green-400 bg-green-500/10', icon: CheckCircle },
  replied: { label: 'Response Received', color: 'text-emerald-400 bg-emerald-500/10', icon: Mail },
  failed: { label: 'Failed', color: 'text-red-400 bg-red-500/10', icon: XCircle },
  cancelled: { label: 'Cancelled', color: 'text-slate-500 bg-slate-700/50', icon: XCircle },
};

const PRIORITY_STYLES: Record<string, string> = {
  urgent: 'text-red-400 bg-red-500/10 border-red-500/30',
  high: 'text-orange-400 bg-orange-500/10 border-orange-500/30',
  medium: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30',
  low: 'text-slate-400 bg-slate-700/50 border-slate-600',
};

const AgentCenter = () => {
  const { activeCase, updateCase } = useContext(AppContext);

  // State
  const [viewMode, setViewMode] = useState<ViewMode>('dashboard');
  const [agentFilter, setAgentFilter] = useState<AgentFilter>('all');
  const [tasks, setTasks] = useState<AgentTask[]>([]);
  const [expandedTask, setExpandedTask] = useState<string | null>(null);
  const [editingEmail, setEditingEmail] = useState<string | null>(null);
  const [editedBody, setEditedBody] = useState('');

  // Loading states
  const [analyzingAgent, setAnalyzingAgent] = useState<AgentRole | null>(null);
  const [recommendations, setRecommendations] = useState<AgentAnalysis | null>(null);
  const [executingTask, setExecutingTask] = useState<string | null>(null);

  // Config
  const [config, setConfig] = useState<AgentConfig>(loadAgentConfig());

  // Load tasks - from cloud (case metadata) with localStorage fallback
  const refreshTasks = useCallback(() => {
    if (activeCase) {
      // Prefer cloud-stored agent tasks, fall back to localStorage
      const cloudTasks = activeCase.agentTasks;
      if (cloudTasks && cloudTasks.length > 0) {
        setTasks(cloudTasks);
        // Sync to localStorage so agentService functions work
        localStorage.setItem(`agent_tasks_${activeCase.id}`, JSON.stringify(cloudTasks));
      } else {
        setTasks(getAllTasks(activeCase.id));
      }
    }
  }, [activeCase?.id, activeCase?.agentTasks]);

  useEffect(() => { refreshTasks(); }, [refreshTasks]);

  // Sync tasks to cloud after any modification
  const refreshAndSync = useCallback(() => {
    if (!activeCase) return;
    const latest = getAllTasks(activeCase.id);
    setTasks(latest);
    updateCase(activeCase.id, { agentTasks: latest });
  }, [activeCase, updateCase]);

  // ── Agent Analysis ─────────────────────────────────────────────────────────

  const runAgent = async (agent: AgentRole) => {
    if (!activeCase) { toast.error('Select a case first'); return; }

    setAnalyzingAgent(agent);
    setRecommendations(null);

    try {
      let analysis: AgentAnalysis;
      if (agent === 'paralegal') analysis = await analyzeForParalegal(activeCase);
      else if (agent === 'receptionist') analysis = await analyzeForReceptionist(activeCase);
      else analysis = await analyzeForPartner(activeCase);

      setRecommendations(analysis);

      if (analysis.recommendedTasks.length === 0) {
        toast.info(`${AGENT_INFO[agent].label} found no new actions needed right now.`);
      } else {
        toast.success(`${AGENT_INFO[agent].label} recommends ${analysis.recommendedTasks.length} action${analysis.recommendedTasks.length !== 1 ? 's' : ''}`);
      }
    } catch (err) {
      console.error(`Agent ${agent} analysis failed:`, err);
      toast.error(`${AGENT_INFO[agent].label} analysis failed`);
    } finally {
      setAnalyzingAgent(null);
    }
  };

  // ── Task Actions ───────────────────────────────────────────────────────────

  const handleCreateTask = (rec: RecommendedTask, agent: AgentRole) => {
    if (!activeCase) return;
    const task = createTask(rec, activeCase.id, agent);
    refreshAndSync();
    toast.success(`Task created: ${task.title}`);
  };

  const handleCreateAllTasks = () => {
    if (!recommendations || !activeCase) return;
    for (const rec of recommendations.recommendedTasks) {
      createTask(rec, activeCase.id, recommendations.agent);
    }
    refreshAndSync();
    toast.success(`${recommendations.recommendedTasks.length} tasks created`);
    setRecommendations(null);
  };

  const handleApprove = (taskId: string) => {
    approveTask(taskId);
    refreshAndSync();
    toast.success('Task approved');
  };

  const handleExecute = async (taskId: string) => {
    setExecutingTask(taskId);
    try {
      const result = await executeTask(taskId);
      refreshAndSync();
      if (result?.status === 'sent') {
        toast.success('Email sent successfully');
      } else if (result?.status === 'failed') {
        toast.error('Send failed — opened as mailto fallback');
      }
    } catch {
      toast.error('Execution failed');
    } finally {
      setExecutingTask(null);
    }
  };

  const handleApproveAndSend = async (taskId: string) => {
    approveTask(taskId);
    await handleExecute(taskId);
  };

  const handleCancel = (taskId: string) => {
    cancelTask(taskId);
    refreshAndSync();
    toast.info('Task cancelled');
  };

  const handleSaveEmail = (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (task?.email) {
      task.email.body = editedBody;
      // Re-save via the service
      const allTasks = getAllTasks(task.caseId);
      const idx = allTasks.findIndex(t => t.id === taskId);
      if (idx >= 0) {
        allTasks[idx] = task;
        localStorage.setItem(`agent_tasks_${task.caseId}`, JSON.stringify(allTasks));
      }
      refreshAndSync();
      setEditingEmail(null);
      toast.success('Email updated');
    }
  };

  const handleCopyEmail = (task: AgentTask) => {
    if (task.email) {
      navigator.clipboard.writeText(
        `To: ${task.email.to}\nSubject: ${task.email.subject}\n\n${task.email.body}`
      );
      toast.success('Copied to clipboard');
    }
  };

  const handleSaveConfig = () => {
    saveAgentConfig(config);
    toast.success('Agent settings saved');
  };

  // ── Derived Data ──────────────────────────────────────────────────────────

  const filteredTasks = agentFilter === 'all'
    ? tasks.filter(t => t.status !== 'cancelled')
    : tasks.filter(t => t.agent === agentFilter && t.status !== 'cancelled');

  const pendingCount = tasks.filter(t => t.status === 'pending').length;
  const sentCount = tasks.filter(t => t.status === 'sent').length;
  const overdueTasks = activeCase ? getOverdueTasks(activeCase.id) : [];

  // ── No Case ────────────────────────────────────────────────────────────────

  if (!activeCase) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center">
          <Bot size={48} className="mx-auto text-slate-600 mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Agent Command Center</h2>
          <p className="text-slate-400">Select a case to activate your AI agents.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-800 bg-slate-950/50">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-500/30">
            <Bot size={20} className="text-blue-400" />
          </div>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-white">Agent Command Center</h1>
            <p className="text-xs text-slate-500">{activeCase.title} · {pendingCount} pending · {sentCount} sent · {overdueTasks.length} need follow-up</p>
          </div>
          <button
            onClick={() => setViewMode('settings')}
            className={`p-2 rounded-lg transition-colors ${viewMode === 'settings' ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-white hover:bg-slate-800'}`}
          >
            <Settings size={16} />
          </button>
        </div>

        {/* Mode tabs */}
        <div className="flex gap-1">
          {[
            { id: 'dashboard' as ViewMode, label: 'Agents', icon: Bot },
            { id: 'tasks' as ViewMode, label: `Tasks (${filteredTasks.length})`, icon: FileText },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setViewMode(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                viewMode === tab.id ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <tab.icon size={14} />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6">

        {/* ── Settings View ──────────────────────────────────────────── */}
        {viewMode === 'settings' && (
          <div className="max-w-lg mx-auto space-y-4">
            <h3 className="text-sm font-bold text-white mb-4">Agent Configuration</h3>
            <p className="text-xs text-slate-400 mb-6">Configure how your AI agents identify themselves in emails and communications.</p>

            {[
              { key: 'firmName', label: 'Firm / Office Name', placeholder: 'Law Office of John Smith' },
              { key: 'attorneyName', label: 'Attorney Name', placeholder: 'John Smith' },
              { key: 'attorneyTitle', label: 'Title', placeholder: 'Attorney at Law' },
              { key: 'barNumber', label: 'Bar Number (optional)', placeholder: 'TX-12345' },
              { key: 'firmEmail', label: 'Firm Email (sends from this)', placeholder: 'john@smithlaw.com' },
              { key: 'firmPhone', label: 'Phone', placeholder: '(555) 123-4567' },
              { key: 'firmAddress', label: 'Address', placeholder: '123 Main St, Houston, TX 77001' },
            ].map(field => (
              <div key={field.key}>
                <label className="text-xs text-slate-400 block mb-1">{field.label}</label>
                <input
                  type="text"
                  value={(config as any)[field.key] || ''}
                  onChange={e => setConfig(prev => ({ ...prev, [field.key]: e.target.value }))}
                  placeholder={field.placeholder}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                />
              </div>
            ))}

            <div>
              <label className="text-xs text-slate-400 block mb-1">Email Signature</label>
              <textarea
                value={config.emailSignature}
                onChange={e => setConfig(prev => ({ ...prev, emailSignature: e.target.value }))}
                placeholder="Best regards,&#10;John Smith, Esq.&#10;Law Office of John Smith&#10;(555) 123-4567"
                rows={4}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500/50 resize-none"
              />
            </div>

            <div>
              <label className="text-xs text-slate-400 block mb-1">Communication Tone</label>
              <div className="flex gap-2">
                {(['formal', 'professional', 'friendly'] as const).map(tone => (
                  <button
                    key={tone}
                    onClick={() => setConfig(prev => ({ ...prev, tone }))}
                    className={`px-3 py-1.5 text-xs rounded-lg capitalize transition-colors ${
                      config.tone === tone ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'bg-slate-800 text-slate-400 border border-slate-700'
                    }`}
                  >
                    {tone}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-400 block mb-1">Follow-up Interval (days)</label>
              <input
                type="number"
                value={config.followUpDays}
                onChange={e => setConfig(prev => ({ ...prev, followUpDays: parseInt(e.target.value) || 14 }))}
                className="w-20 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500/50"
              />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.autoApprove}
                  onChange={e => setConfig(prev => ({ ...prev, autoApprove: e.target.checked }))}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-700 peer-focus:ring-1 peer-focus:ring-blue-500/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
              <div>
                <p className="text-sm text-white">Auto-approve mode</p>
                <p className="text-xs text-slate-500">Agents send emails without manual approval (use with caution)</p>
              </div>
            </div>

            <button
              onClick={handleSaveConfig}
              className="w-full mt-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-colors"
            >
              Save Settings
            </button>
          </div>
        )}

        {/* ── Dashboard View ─────────────────────────────────────────── */}
        {viewMode === 'dashboard' && (
          <div className="space-y-6">
            {/* Overdue alert */}
            {overdueTasks.length > 0 && (
              <div className="bg-red-500/5 border border-red-500/30 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle size={16} className="text-red-400" />
                  <span className="text-sm font-bold text-red-400">{overdueTasks.length} Task{overdueTasks.length !== 1 ? 's' : ''} Need Follow-Up</span>
                </div>
                <div className="space-y-1">
                  {overdueTasks.map(t => (
                    <p key={t.id} className="text-xs text-slate-400">
                      • {t.title} — sent {t.sentAt ? new Date(t.sentAt).toLocaleDateString() : 'unknown'}, no response
                    </p>
                  ))}
                </div>
              </div>
            )}

            {/* Agent Cards */}
            <div className="grid gap-4">
              {(Object.entries(AGENT_INFO) as [AgentRole, typeof AGENT_INFO[AgentRole]][]).map(([role, info]) => {
                const Icon = info.icon;
                const agentTasks = tasks.filter(t => t.agent === role && t.status !== 'cancelled');
                const agentPending = agentTasks.filter(t => t.status === 'pending').length;
                const isAnalyzing = analyzingAgent === role;

                return (
                  <div key={role} className={`border rounded-xl overflow-hidden ${info.bgColor}`}>
                    <div className="p-3 sm:p-4 md:p-5">
                      <div className="flex flex-col sm:flex-row items-start gap-3">
                        <div className={`p-2.5 rounded-xl ${info.bgColor}`}>
                          <Icon size={22} className={info.color} />
                        </div>
                        <div className="flex-1">
                          <h3 className="text-base font-bold text-white">{info.label}</h3>
                          <p className="text-xs text-slate-400 mt-0.5">{info.description}</p>

                          {agentTasks.length > 0 && (
                            <div className="flex gap-3 mt-2">
                              <span className="text-xs text-slate-500">{agentTasks.length} total tasks</span>
                              {agentPending > 0 && <span className="text-xs text-yellow-400">{agentPending} pending</span>}
                            </div>
                          )}
                        </div>

                        <button
                          onClick={() => runAgent(role)}
                          disabled={isAnalyzing}
                          className={`w-full sm:w-auto px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                            isAnalyzing
                              ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                              : `${info.bgColor} ${info.color} hover:brightness-125`
                          }`}
                        >
                          {isAnalyzing ? (
                            <><Loader2 size={14} className="animate-spin" /> Analyzing...</>
                          ) : (
                            <><Zap size={14} /> Run Agent</>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Recommendations Panel */}
            {recommendations && recommendations.recommendedTasks.length > 0 && (
              <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl">
                <div className="px-5 py-4 border-b border-slate-700/50 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles size={16} className={AGENT_INFO[recommendations.agent].color} />
                    <h3 className="text-sm font-bold text-white">
                      {AGENT_INFO[recommendations.agent].label} Recommendations
                    </h3>
                    <span className="text-xs text-slate-500">({recommendations.recommendedTasks.length} actions)</span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleCreateAllTasks}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1"
                    >
                      <CheckCircle size={12} /> Queue All
                    </button>
                    <button
                      onClick={() => setRecommendations(null)}
                      className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs rounded-lg transition-colors"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>

                <div className="divide-y divide-slate-700/30">
                  {recommendations.recommendedTasks.map((rec, i) => (
                    <div key={i} className="px-5 py-4">
                      <div className="flex items-start gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded border ${PRIORITY_STYLES[rec.priority]}`}>
                              {rec.priority}
                            </span>
                            <span className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded">
                              {rec.type.replace(/_/g, ' ')}
                            </span>
                          </div>
                          <h4 className="text-sm font-medium text-white mb-1">{rec.title}</h4>
                          <p className="text-xs text-slate-400 mb-2">{rec.description}</p>

                          <p className="text-xs text-slate-500 italic mb-2">
                            <Brain size={10} className="inline mr-1" />
                            {rec.reasoning}
                          </p>

                          {rec.emailDraft && (
                            <div className="bg-slate-900/60 rounded-lg p-3 mt-2">
                              <p className="text-xs text-slate-500 mb-1">📧 Draft Email</p>
                              <p className="text-xs text-slate-400"><strong>To:</strong> {rec.emailDraft.to}</p>
                              <p className="text-xs text-slate-400"><strong>Subject:</strong> {rec.emailDraft.subject}</p>
                              <pre className="text-xs text-slate-300 mt-2 whitespace-pre-wrap font-sans leading-relaxed max-h-40 overflow-y-auto">
                                {rec.emailDraft.body}
                              </pre>
                            </div>
                          )}
                        </div>

                        <button
                          onClick={() => handleCreateTask(rec, recommendations.agent)}
                          className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white text-xs rounded-lg transition-colors whitespace-nowrap"
                        >
                          Queue Task
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Quick Run All */}
            {!recommendations && (
              <div className="border border-dashed border-slate-700 rounded-xl p-6 text-center">
                <Bot size={32} className="mx-auto text-slate-600 mb-2" />
                <p className="text-sm text-slate-400 mb-3">
                  Select an agent above to analyze your case and recommend actions
                </p>
                <button
                  onClick={async () => {
                    await runAgent('paralegal');
                  }}
                  disabled={!!analyzingAgent}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-sm rounded-lg transition-colors"
                >
                  Start with AI Paralegal →
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Tasks View ─────────────────────────────────────────────── */}
        {viewMode === 'tasks' && (
          <div className="space-y-4">
            {/* Filter */}
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs text-slate-500">Filter:</span>
              {(['all', 'paralegal', 'receptionist', 'partner'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setAgentFilter(f)}
                  className={`px-2.5 py-1 text-xs rounded-lg transition-colors ${
                    agentFilter === f ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-white'
                  }`}
                >
                  {f === 'all' ? 'All' : AGENT_INFO[f].label}
                </button>
              ))}
            </div>

            {filteredTasks.length === 0 ? (
              <div className="text-center py-12">
                <FileText size={40} className="mx-auto text-slate-600 mb-3" />
                <p className="text-white font-medium">No tasks yet</p>
                <p className="text-sm text-slate-400">Run an agent to generate tasks</p>
              </div>
            ) : (
              filteredTasks
                .sort((a, b) => {
                  const statusOrder: Record<TaskStatus, number> = { pending: 0, approved: 1, sent: 2, delivered: 3, replied: 4, failed: 5, cancelled: 6 };
                  const priorityOrder: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
                  if (statusOrder[a.status] !== statusOrder[b.status]) return statusOrder[a.status] - statusOrder[b.status];
                  return (priorityOrder[a.priority] || 3) - (priorityOrder[b.priority] || 3);
                })
                .map(task => {
                  const statusInfo = STATUS_STYLES[task.status];
                  const StatusIcon = statusInfo.icon;
                  const agentInfo = AGENT_INFO[task.agent];
                  const AgentIcon = agentInfo.icon;
                  const isExpanded = expandedTask === task.id;
                  const isEditing = editingEmail === task.id;

                  return (
                    <div key={task.id} className="bg-slate-800/40 border border-slate-700/50 rounded-xl overflow-hidden">
                      {/* Task Header */}
                      <button
                        onClick={() => setExpandedTask(isExpanded ? null : task.id)}
                        className="w-full px-5 py-4 flex items-center gap-3 hover:bg-slate-800/60 transition-colors"
                      >
                        <div className={`p-1.5 rounded-lg ${agentInfo.bgColor}`}>
                          <AgentIcon size={14} className={agentInfo.color} />
                        </div>
                        <div className="flex-1 text-left">
                          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                            <span className={`text-xs font-bold uppercase px-1.5 py-0.5 rounded ${PRIORITY_STYLES[task.priority]}`}>
                              {task.priority}
                            </span>
                            <span className={`text-xs px-1.5 py-0.5 rounded ${statusInfo.color}`}>
                              <StatusIcon size={10} className="inline mr-0.5" />
                              {statusInfo.label}
                            </span>
                          </div>
                          <p className="text-sm font-medium text-white">{task.title}</p>
                          <p className="text-xs text-slate-500">{task.type.replace(/_/g, ' ')} · {new Date(task.createdAt).toLocaleDateString()}</p>
                        </div>

                        {/* Quick actions */}
                        {task.status === 'pending' && (
                          <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                            <button
                              onClick={() => handleApproveAndSend(task.id)}
                              disabled={executingTask === task.id}
                              className="px-2.5 py-1 bg-green-600 hover:bg-green-500 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1"
                            >
                              {executingTask === task.id ? <Loader2 size={10} className="animate-spin" /> : <Send size={10} />}
                              Send
                            </button>
                            <button
                              onClick={() => handleCancel(task.id)}
                              className="px-2 py-1 bg-slate-700 hover:bg-slate-600 text-slate-400 text-xs rounded-lg transition-colors"
                            >
                              <XCircle size={10} />
                            </button>
                          </div>
                        )}
                        {task.status === 'approved' && task.email && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleExecute(task.id); }}
                            disabled={executingTask === task.id}
                            className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg"
                          >
                            {executingTask === task.id ? <Loader2 size={10} className="animate-spin" /> : 'Execute'}
                          </button>
                        )}

                        {isExpanded ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
                      </button>

                      {/* Expanded Details */}
                      {isExpanded && (
                        <div className="px-5 pb-5 border-t border-slate-700/30 space-y-3 pt-3">
                          <p className="text-sm text-slate-300">{task.description}</p>

                          <p className="text-xs text-slate-500 italic">
                            <Brain size={10} className="inline mr-1" />
                            {task.reasoning}
                          </p>

                          {task.caseFactsBasis.length > 0 && (
                            <div>
                              <p className="text-xs text-slate-500 mb-1">Based on:</p>
                              <ul className="space-y-0.5">
                                {task.caseFactsBasis.map((fact, i) => (
                                  <li key={i} className="text-xs text-slate-400 flex items-start gap-1">
                                    <Target size={8} className="mt-1 flex-shrink-0 text-slate-600" />
                                    {fact}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* Email Preview/Edit */}
                          {task.email && (
                            <div className="bg-slate-900/60 rounded-lg p-4 mt-2">
                              <div className="flex items-center justify-between mb-2">
                                <p className="text-xs text-slate-500 font-medium">📧 Email</p>
                                <div className="flex gap-1">
                                  {!isEditing && (
                                    <>
                                      <button
                                        onClick={() => { setEditingEmail(task.id); setEditedBody(task.email!.body); }}
                                        className="text-xs text-slate-500 hover:text-white flex items-center gap-1 px-2 py-0.5 rounded hover:bg-slate-800"
                                      >
                                        <Edit3 size={10} /> Edit
                                      </button>
                                      <button
                                        onClick={() => handleCopyEmail(task)}
                                        className="text-xs text-slate-500 hover:text-white flex items-center gap-1 px-2 py-0.5 rounded hover:bg-slate-800"
                                      >
                                        <Copy size={10} /> Copy
                                      </button>
                                    </>
                                  )}
                                </div>
                              </div>

                              <p className="text-xs text-slate-400"><strong>To:</strong> {task.email.to}</p>
                              <p className="text-xs text-slate-400"><strong>From:</strong> {task.email.from || 'Not configured'}</p>
                              <p className="text-xs text-slate-400 mb-2"><strong>Subject:</strong> {task.email.subject}</p>

                              {isEditing ? (
                                <>
                                  <textarea
                                    value={editedBody}
                                    onChange={e => setEditedBody(e.target.value)}
                                    rows={12}
                                    className="w-full bg-slate-800 border border-slate-600 rounded-lg p-3 text-xs text-white font-sans leading-relaxed resize-none focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                                  />
                                  <div className="flex gap-2 mt-2">
                                    <button
                                      onClick={() => handleSaveEmail(task.id)}
                                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg"
                                    >
                                      Save
                                    </button>
                                    <button
                                      onClick={() => setEditingEmail(null)}
                                      className="px-3 py-1.5 bg-slate-700 text-slate-300 text-xs rounded-lg"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </>
                              ) : (
                                <pre className="text-xs text-slate-300 whitespace-pre-wrap font-sans leading-relaxed max-h-60 overflow-y-auto">
                                  {task.email.body}
                                </pre>
                              )}
                            </div>
                          )}

                          {/* Tracking */}
                          {task.sentAt && (
                            <div className="flex items-center gap-2 text-xs text-slate-500">
                              <Send size={10} /> Sent {new Date(task.sentAt).toLocaleString()}
                              {task.followUpDate && !task.responseReceivedAt && (
                                <span className="ml-2">· Follow-up: {task.followUpDate}</span>
                              )}
                            </div>
                          )}

                          {/* Audit Trail */}
                          {task.actions.length > 0 && (
                            <div className="border-t border-slate-700/30 pt-3 mt-3">
                              <p className="text-xs text-slate-500 mb-2">Activity Log</p>
                              <div className="space-y-1">
                                {task.actions.map((action, i) => (
                                  <div key={i} className="flex items-start gap-2 text-xs">
                                    <span className="text-slate-600 whitespace-nowrap">{new Date(action.timestamp).toLocaleString()}</span>
                                    <span className={action.automated ? 'text-slate-500' : 'text-blue-400'}>
                                      {action.automated ? '🤖' : '👤'} {action.detail}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AgentCenter;
