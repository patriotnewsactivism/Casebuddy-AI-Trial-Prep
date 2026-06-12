import React, { useState, useMemo, useEffect } from 'react';
import { Clock, Plus, Trash2, AlertTriangle, CheckCircle, Calendar, Calculator, MapPin, Scale, ArrowRight } from 'lucide-react';
import AgentHeader from '../components/AgentHeader';
import ActiveCaseBar from '../components/ActiveCaseBar';
import { AGENTS } from '../agents/personas';
import { useActiveCase, addCaseDeadline, toggleCaseDeadline, removeCaseDeadline, logActivity, completeAgentTask } from '../lib/caseStore';

type Tab = 'deadlines' | 'sol';

// === Deadline Tracker types ===
interface Deadline {
  id: string; title: string; deadline_type: string; due_date: string;
  description: string; is_critical: boolean; is_completed: boolean; case_name: string;
}
const DEADLINE_TYPES = ['Filing Deadline', 'Discovery Cutoff', 'Trial Date', 'Deposition', 'Mediation', 'Hearing', 'Response Due', 'Statute of Limitations', 'Appeal Deadline', 'Other'];

// === SOL Calculator data ===
interface SolData { state: string; abbr: string; claims: { type: string; years: number; notes: string; tolling: string; }[]; }
const SOL_DB: SolData[] = [
  { state: 'Alabama', abbr: 'AL', claims: [{ type: 'Personal Injury', years: 2, notes: 'Ala. Code § 6-2-38(l)', tolling: 'Minority: tolled until age 19.' },{ type: 'Medical Malpractice', years: 2, notes: 'Ala. Code § 6-5-482. 4-year max.', tolling: 'Discovery rule: 6 months from discovery.' },{ type: 'Contract', years: 6, notes: 'Ala. Code § 6-2-34', tolling: '' }] },
  { state: 'California', abbr: 'CA', claims: [{ type: 'Personal Injury', years: 2, notes: 'CCP § 335.1', tolling: 'Minority, imprisonment, mental incapacity.' },{ type: 'Medical Malpractice', years: 1, notes: 'CCP § 340.5. 3-year max.', tolling: 'Discovery rule.' },{ type: 'Contract (Written)', years: 4, notes: 'CCP § 337', tolling: '' },{ type: 'Government Claims', years: 0.5, notes: 'Gov. Code § 911.2. 6 months!', tolling: 'No tolling for minors.' }] },
  { state: 'Florida', abbr: 'FL', claims: [{ type: 'Personal Injury', years: 2, notes: 'Fla. Stat. § 95.11(3). Changed 2023.', tolling: 'Minority, mental incapacity.' },{ type: 'Medical Malpractice', years: 2, notes: 'Fla. Stat. § 95.11(4)(b). 4-year max.', tolling: 'Discovery rule.' },{ type: 'Contract (Written)', years: 5, notes: 'Fla. Stat. § 95.11(2)(b)', tolling: '' }] },
  { state: 'Georgia', abbr: 'GA', claims: [{ type: 'Personal Injury', years: 2, notes: 'O.C.G.A. § 9-3-33', tolling: 'Minority: until 18 + 5 years.' },{ type: 'Contract (Written)', years: 6, notes: 'O.C.G.A. § 9-3-24', tolling: '' }] },
  { state: 'Mississippi', abbr: 'MS', claims: [{ type: 'Personal Injury', years: 3, notes: 'Miss. Code Ann. § 15-1-49', tolling: 'Minority: until 21. Mental disability. Absence. Imprisonment.' },{ type: 'Medical Malpractice', years: 2, notes: 'Miss. Code Ann. § 15-1-36. 7-year repose.', tolling: 'Discovery rule: 2 years from discovery.' },{ type: 'Contract (Written)', years: 6, notes: 'Miss. Code Ann. § 15-1-29', tolling: '' },{ type: 'Contract (Oral)', years: 3, notes: 'Miss. Code Ann. § 15-1-29', tolling: '' },{ type: 'Civil Rights §1983', years: 3, notes: 'Borrows state PI SOL. Owens v. Okure.', tolling: 'Equitable tolling available.' },{ type: 'Fraud', years: 3, notes: 'Miss. Code Ann. § 15-1-49. From discovery.', tolling: 'Discovery rule.' },{ type: 'Government (MTCA)', years: 1, notes: 'Miss. Code Ann. § 11-46-11. Notice required!', tolling: '90-day notice before suit.' }] },
  { state: 'New York', abbr: 'NY', claims: [{ type: 'Personal Injury', years: 3, notes: 'CPLR § 214', tolling: 'Infancy, insanity, absence.' },{ type: 'Medical Malpractice', years: 2.5, notes: 'CPLR § 214-a', tolling: 'Continuous treatment.' },{ type: 'Contract', years: 6, notes: 'CPLR § 213', tolling: '' }] },
  { state: 'Texas', abbr: 'TX', claims: [{ type: 'Personal Injury', years: 2, notes: 'Tex. Civ. Prac. & Rem. § 16.003', tolling: 'Minority, mental incapacity.' },{ type: 'Medical Malpractice', years: 2, notes: 'Tex. Civ. Prac. & Rem. § 74.251. 10-year max.', tolling: '' },{ type: 'Contract', years: 4, notes: 'Tex. Civ. Prac. & Rem. § 16.004', tolling: '' }] },
];
const ALL_SOL = SOL_DB.sort((a, b) => a.state.localeCompare(b.state));

export default function DeadlinesAndSol() {
  const [tab, setTab] = useState<Tab>('deadlines');
  const activeCase = useActiveCase();

  // Deadline state (used only when no case file is active — case deadlines persist to the case)
  const [localDeadlines, setLocalDeadlines] = useState<Deadline[]>([
    { id: '1', title: 'Answer to Complaint', deadline_type: 'Filing Deadline', due_date: new Date(Date.now() + 3*86400000).toISOString().split('T')[0], description: 'Must file answer within 21 days', is_critical: true, is_completed: false, case_name: 'Smith v. ABC Corp' },
    { id: '2', title: 'Discovery Cutoff', deadline_type: 'Discovery Cutoff', due_date: new Date(Date.now() + 30*86400000).toISOString().split('T')[0], description: 'All discovery must be completed', is_critical: false, is_completed: false, case_name: 'Jones v. City' },
  ]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', deadline_type: 'Filing Deadline', due_date: '', description: '', is_critical: false, case_name: '' });

  const deadlines: Deadline[] = activeCase
    ? activeCase.deadlines.map(d => ({
        id: d.id, title: d.title, deadline_type: d.deadlineType, due_date: d.dueDate,
        description: d.description, is_critical: d.isCritical, is_completed: d.isCompleted,
        case_name: activeCase.clientName,
      }))
    : localDeadlines;

  const toggleDl = (id: string) => {
    if (activeCase) toggleCaseDeadline(activeCase.id, id);
    else setLocalDeadlines(ds => ds.map(x => x.id === id ? {...x, is_completed: !x.is_completed} : x));
  };
  const removeDl = (id: string) => {
    if (activeCase) removeCaseDeadline(activeCase.id, id);
    else setLocalDeadlines(ds => ds.filter(x => x.id !== id));
  };

  // SOL state
  const [selectedState, setSelectedState] = useState('Mississippi');
  const [claimType, setClaimType] = useState('Personal Injury');
  const [incidentDate, setIncidentDate] = useState('');
  const [calculated, setCalculated] = useState(false);

  // Prefill the SOL calculator from the active case file (intake handoff)
  useEffect(() => {
    if (!activeCase) return;
    const match = ALL_SOL.find(s =>
      activeCase.jurisdiction.toLowerCase().includes(s.state.toLowerCase()) ||
      activeCase.jurisdiction.toUpperCase() === s.abbr
    );
    if (match) setSelectedState(match.state);
    if (activeCase.incidentDate && /^\d{4}-\d{2}-\d{2}/.test(activeCase.incidentDate)) {
      setIncidentDate(activeCase.incidentDate.slice(0, 10));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCase?.id]);

  const stateData = useMemo(() => ALL_SOL.find(s => s.state === selectedState), [selectedState]);
  const claimData = useMemo(() => stateData?.claims.find(c => c.type === claimType), [stateData, claimType]);

  const deadline = useMemo(() => {
    if (!incidentDate || !claimData) return null;
    const d = new Date(incidentDate);
    const y = claimData.years;
    d.setFullYear(d.getFullYear() + Math.floor(y));
    d.setMonth(d.getMonth() + Math.round((y % 1) * 12));
    return d;
  }, [incidentDate, claimData]);

  const daysRemaining = useMemo(() => deadline ? Math.ceil((deadline.getTime() - Date.now()) / 86400000) : null, [deadline]);

  const addDeadline = () => {
    if (!form.title || !form.due_date) return;
    if (activeCase) {
      addCaseDeadline(activeCase.id, {
        title: form.title, deadlineType: form.deadline_type, dueDate: form.due_date,
        description: form.description, isCritical: form.is_critical, isCompleted: false,
      });
      logActivity(activeCase.id, 'sol', 'Calendared a deadline', `${form.title} — due ${form.due_date}`, 10);
    } else {
      setLocalDeadlines(d => [...d, { ...form, id: Date.now().toString(), is_completed: false }]);
    }
    setForm({ title: '', deadline_type: 'Filing Deadline', due_date: '', description: '', is_critical: false, case_name: '' });
    setShowForm(false);
  };

  const addSolToDeadlines = () => {
    if (!deadline || !claimData) return;
    const title = `SOL: ${claimType} (${selectedState})`;
    const dueDate = deadline.toISOString().split('T')[0];
    const description = `${claimData.notes}. ${claimData.tolling}`;
    if (activeCase) {
      addCaseDeadline(activeCase.id, {
        title, deadlineType: 'Statute of Limitations', dueDate,
        description, isCritical: true, isCompleted: false,
      });
      logActivity(activeCase.id, 'sol', 'Calculated statute of limitations', `${title} — expires ${dueDate}`, 30);
      completeAgentTask(activeCase.id, 'sol');
    } else {
      setLocalDeadlines(d => [...d, {
        id: Date.now().toString(), title, deadline_type: 'Statute of Limitations',
        due_date: dueDate, description, is_critical: true, is_completed: false, case_name: '',
      }]);
    }
    setTab('deadlines');
  };

  const daysUntil = (d: string) => Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
  const sortedDeadlines = [...deadlines].sort((a, b) => {
    if (a.is_completed !== b.is_completed) return a.is_completed ? 1 : -1;
    return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
  });

  const urgColor = (days: number) => days < 0 ? 'text-red-400' : days < 7 ? 'text-red-400' : days < 30 ? 'text-yellow-400' : 'text-emerald-400';
  const urgBg = (days: number) => days < 0 ? 'bg-red-500/10 border-red-500/30' : days < 7 ? 'bg-red-500/10 border-red-500/30' : days < 30 ? 'bg-yellow-500/10 border-yellow-500/30' : 'bg-slate-800 border-slate-700';

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Clock className="text-blue-400" size={28} />
        <div>
          <h1 className="text-2xl font-bold text-white">Deadlines & SOL Calculator</h1>
          <p className="text-slate-400 text-sm">Track every deadline — calculate statutes of limitations and add them in one click</p>
        </div>
      </div>

      <AgentHeader agent={AGENTS.sol} subtitle="I track every deadline, every court date, every statute of limitations. Miss nothing on my watch." />


      <ActiveCaseBar agentId="sol" />

      <div className="flex gap-1 bg-slate-800 border border-slate-700 rounded-xl p-1">
        <button onClick={() => setTab('deadlines')} className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-colors ${tab === 'deadlines' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`}>
          <Calendar size={16} /> Deadline Tracker ({deadlines.filter(d => !d.is_completed).length} active)
        </button>
        <button onClick={() => setTab('sol')} className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-colors ${tab === 'sol' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`}>
          <Calculator size={16} /> SOL Calculator
        </button>
      </div>

      {/* === DEADLINES TAB === */}
      {tab === 'deadlines' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => setShowForm(!showForm)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2">
              <Plus size={16} /> Add Deadline
            </button>
          </div>
          {showForm && (
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 space-y-3">
              <div className="grid md:grid-cols-2 gap-3">
                <input value={form.title} onChange={e => setForm(f => ({...f, title: e.target.value}))} placeholder="Deadline title" className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm" />
                <input value={form.case_name} onChange={e => setForm(f => ({...f, case_name: e.target.value}))} placeholder="Case name" className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm" />
              </div>
              <div className="grid md:grid-cols-3 gap-3">
                <select value={form.deadline_type} onChange={e => setForm(f => ({...f, deadline_type: e.target.value}))} className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm">
                  {DEADLINE_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
                <input type="date" value={form.due_date} onChange={e => setForm(f => ({...f, due_date: e.target.value}))} className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm" />
                <label className="flex items-center gap-2 text-slate-400 text-sm">
                  <input type="checkbox" checked={form.is_critical} onChange={e => setForm(f => ({...f, is_critical: e.target.checked}))} className="rounded" />
                  Critical deadline
                </label>
              </div>
              <input value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))} placeholder="Notes..." className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm" />
              <button onClick={addDeadline} disabled={!form.title || !form.due_date} className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-6 py-2 rounded-lg text-sm font-medium">Add</button>
            </div>
          )}
          <div className="space-y-2">
            {sortedDeadlines.map(d => {
              const days = daysUntil(d.due_date);
              return (
                <div key={d.id} className={`border rounded-xl p-4 flex items-center gap-4 ${d.is_completed ? 'bg-slate-800/50 border-slate-700/50 opacity-60' : urgBg(days)}`}>
                  <button onClick={() => toggleDl(d.id)}
                    className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 ${d.is_completed ? 'bg-green-600 border-green-500' : 'border-slate-500 hover:border-blue-400'}`}>
                    {d.is_completed && <CheckCircle size={14} className="text-white" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`font-medium text-sm ${d.is_completed ? 'line-through text-slate-500' : 'text-white'}`}>{d.title}</span>
                      {d.is_critical && !d.is_completed && <AlertTriangle size={14} className="text-red-400 shrink-0" />}
                    </div>
                    <div className="text-slate-500 text-xs">{d.case_name && `${d.case_name} · `}{d.deadline_type}</div>
                    {d.description && <div className="text-slate-500 text-xs mt-0.5">{d.description}</div>}
                  </div>
                  <div className="text-right shrink-0">
                    <div className={`font-bold text-sm ${d.is_completed ? 'text-slate-500' : urgColor(days)}`}>
                      {d.is_completed ? 'Done' : days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? 'TODAY' : `${days}d`}
                    </div>
                    <div className="text-slate-600 text-xs">{new Date(d.due_date).toLocaleDateString()}</div>
                  </div>
                  <button onClick={() => removeDl(d.id)} className="text-slate-600 hover:text-red-400 shrink-0"><Trash2 size={14} /></button>
                </div>
              );
            })}
            {deadlines.length === 0 && <div className="bg-slate-800 border border-slate-700 rounded-xl p-10 text-center text-slate-500">No deadlines yet. Add one above or calculate a SOL.</div>}
          </div>
        </div>
      )}

      {/* === SOL TAB === */}
      {tab === 'sol' && (
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 space-y-4">
              <div><label className="text-sm text-slate-400 block mb-1"><MapPin size={12} className="inline mr-1" />State</label><select value={selectedState} onChange={e => { setSelectedState(e.target.value); setCalculated(false); }} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm">{ALL_SOL.map(s => <option key={s.state}>{s.state}</option>)}</select></div>
              <div><label className="text-sm text-slate-400 block mb-1"><Scale size={12} className="inline mr-1" />Claim Type</label><select value={claimType} onChange={e => { setClaimType(e.target.value); setCalculated(false); }} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm">{(stateData?.claims.map(c => c.type) || []).map(t => <option key={t}>{t}</option>)}</select></div>
              <div><label className="text-sm text-slate-400 block mb-1"><Calendar size={12} className="inline mr-1" />Date of Incident</label><input type="date" value={incidentDate} onChange={e => { setIncidentDate(e.target.value); setCalculated(false); }} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm" /></div>
              <button onClick={() => setCalculated(true)} disabled={!incidentDate || !claimData} className="w-full bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white py-3 rounded-lg font-semibold flex items-center justify-center gap-2"><Calculator size={18} /> Calculate Deadline</button>
            </div>
            {stateData && (
              <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
                <h3 className="text-white font-semibold text-sm mb-3">{stateData.state} — All Periods</h3>
                {stateData.claims.map((c, i) => (
                  <div key={i} className={`flex justify-between py-1.5 border-b border-slate-700/50 last:border-0 ${c.type === claimType ? 'bg-orange-500/10 -mx-2 px-2 rounded' : ''}`}>
                    <span className="text-slate-400 text-sm">{c.type}</span>
                    <span className="text-white text-sm font-medium">{c.years < 1 ? `${Math.round(c.years * 12)}mo` : `${c.years}yr`}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="space-y-4">
            {!calculated ? (
              <div className="bg-slate-800 border border-slate-700 rounded-xl p-12 text-center"><Clock className="mx-auto text-slate-600 mb-3" size={48} /><p className="text-slate-500">Enter details and calculate</p></div>
            ) : deadline && daysRemaining !== null && (
              <>
                <div className={`rounded-2xl p-6 border-2 ${daysRemaining < 0 ? 'bg-red-500/10 border-red-500/50' : daysRemaining < 30 ? 'bg-red-500/10 border-red-500/40' : daysRemaining < 90 ? 'bg-yellow-500/10 border-yellow-500/40' : 'bg-emerald-500/10 border-emerald-500/40'}`}>
                  <div className="text-center space-y-3">
                    {daysRemaining < 0 ? (
                      <><AlertTriangle className="mx-auto text-red-400" size={40} /><div className="text-3xl font-bold text-red-400">EXPIRED</div><div className="text-red-300 text-sm">Expired {Math.abs(daysRemaining)} days ago</div></>
                    ) : (
                      <><div className={`text-5xl font-bold ${daysRemaining < 30 ? 'text-red-400' : daysRemaining < 90 ? 'text-yellow-400' : 'text-emerald-400'}`}>{daysRemaining}</div><div className="text-slate-300 text-sm">days remaining</div></>
                    )}
                  </div>
                  <div className="mt-4 pt-4 border-t border-slate-700/50 grid grid-cols-2 gap-3 text-center">
                    <div><div className="text-slate-500 text-xs">Deadline</div><div className="text-white font-bold text-sm">{deadline.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</div></div>
                    <div><div className="text-slate-500 text-xs">Period</div><div className="text-white font-bold text-sm">{claimData && (claimData.years < 1 ? `${Math.round(claimData.years * 12)} months` : `${claimData.years} years`)}</div></div>
                  </div>
                </div>
                {claimData && (
                  <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 space-y-2">
                    <div className="text-blue-400 font-semibold text-sm">📖 Legal Authority</div>
                    <div className="text-slate-300 text-sm">{claimData.notes}</div>
                    {claimData.tolling && <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3"><div className="text-yellow-400 text-xs font-semibold mb-1">⚠️ Tolling</div><div className="text-slate-300 text-xs">{claimData.tolling}</div></div>}
                  </div>
                )}
                <button onClick={addSolToDeadlines} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-semibold flex items-center justify-center gap-2">
                  <ArrowRight size={18} /> Add to My Deadlines
                </button>
                <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-3 text-slate-500 text-xs">
                  <strong>⚠️ Disclaimer:</strong> General estimates only. Consult a licensed attorney.
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

