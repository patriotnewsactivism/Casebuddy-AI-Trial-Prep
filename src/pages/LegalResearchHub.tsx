import React, { useState, useMemo, useEffect } from 'react';
import { BookOpen, Loader2, Globe, Search, ArrowLeftRight } from 'lucide-react';
import { analyzeDocument } from '../lib/api';
import AgentHeader from '../components/AgentHeader';
import ActiveCaseBar from '../components/ActiveCaseBar';
import { AGENTS } from '../agents/personas';
import { useActiveCase, buildCaseContext, addResearchNote, logActivity, completeAgentTask } from '../lib/caseStore';

type Tab = 'research' | 'jurisdiction';

// Jurisdiction data
interface JurisdictionData { state: string; abbr: string; overview: string; discovery: string; fees: string; sol: string; localRules: string; deadlines: string; }
const JURISDICTIONS: JurisdictionData[] = [
  { state: 'Mississippi', abbr: 'MS', overview: 'Mississippi Rules of Civil Procedure govern state court actions. Circuit courts have general jurisdiction. Chancery courts handle equity matters.', discovery: 'MRCP Rules 26-37. Initial disclosures required. 30 interrogatories limit. Depositions: 10 per side.', fees: 'Circuit Court filing: ~$250. Chancery: ~$200. Service: ~$75-100.', sol: 'PI: 3 years. Med Mal: 2 years (7-year repose). Contract: 3-6 years. §1983: 3 years.', localRules: 'Each circuit has local rules. Northern District follows 5th Circuit. Check individual judge\'s preferences.', deadlines: 'Answer: 30 days. Discovery: per scheduling order. Motions: 10 days before hearing.' },
  { state: 'Texas', abbr: 'TX', overview: 'Texas Rules of Civil Procedure. District courts have general jurisdiction. County courts handle smaller matters.', discovery: 'TRCP Rules 190-215. Level 1/2/3 discovery plans. 25 interrogatories. 6-hour depo limit.', fees: 'District Court: ~$300-400. County: ~$200. E-filing required statewide.', sol: 'PI: 2 years. Med Mal: 2 years (10-year repose). Contract: 4 years. Fraud: 4 years.', localRules: 'Each district has local rules. Check judge\'s standing orders.', deadlines: 'Answer: Monday after 20 days from service. Discovery: per scheduling order.' },
  { state: 'California', abbr: 'CA', overview: 'California Code of Civil Procedure. Superior Courts have general jurisdiction. Unlimited/limited civil cases.', discovery: 'CCP §2016-2036. 35 specially prepared interrogatories. Depositions: unlimited with notice.', fees: 'Unlimited civil filing: ~$435. Limited civil: ~$225. Complex: additional fees.', sol: 'PI: 2 years. Med Mal: 1 year (3-year repose). Contract written: 4 years. Oral: 2 years.', localRules: 'Each county has extensive local rules. LA County especially complex.', deadlines: 'Answer: 30 days. Demurrer: 30 days. Discovery motions: 45 days after service.' },
  { state: 'Florida', abbr: 'FL', overview: 'Florida Rules of Civil Procedure. Circuit Courts have general jurisdiction. County courts for claims under $50K.', discovery: 'Fla. R. Civ. P. 1.280-1.390. 30 interrogatories. Expert discovery required.', fees: 'Circuit filing: ~$400. County: ~$300.', sol: 'PI: 2 years (changed 2023). Med Mal: 2 years. Contract written: 5 years. Oral: 4 years.', localRules: 'Each circuit has administrative orders. Miami-Dade especially complex.', deadlines: 'Answer: 20 days. Discovery: per case management order.' },
  { state: 'New York', abbr: 'NY', overview: 'CPLR governs. Supreme Court has general jurisdiction. Civil Court for NYC claims under $25K.', discovery: 'CPLR Article 31. Unlimited interrogatories (court may limit). IMEs available.', fees: 'Supreme Court RJI: ~$210. Index number: ~$210.', sol: 'PI: 3 years. Med Mal: 2.5 years. Contract: 6 years. Fraud: 6 years or 2 from discovery.', localRules: 'Individual Part Rules vary by judge. Commercial Division has special rules.', deadlines: 'Answer: 20-30 days. Note of Issue: per scheduling order.' },
  { state: 'Georgia', abbr: 'GA', overview: 'Georgia Civil Practice Act (O.C.G.A. Title 9). Superior Courts have general jurisdiction.', discovery: 'O.C.G.A. §9-11-26 to 37. 50 interrogatories. Depositions: reasonable limits.', fees: 'Superior Court: ~$200-300. State Court: ~$200.', sol: 'PI: 2 years. Med Mal: 2 years (5-year repose). Contract written: 6 years. Oral: 4 years.', localRules: 'Uniform Superior Court Rules. Each circuit may have local amendments.', deadlines: 'Answer: 30 days. Discovery: per scheduling order.' },
  { state: 'Alabama', abbr: 'AL', overview: 'Alabama Rules of Civil Procedure. Circuit Courts have general jurisdiction. District Courts for lesser claims.', discovery: 'ARCP Rules 26-37. Similar to federal rules. 40 interrogatories without leave.', fees: 'Circuit Court: ~$300. District Court: ~$200.', sol: 'PI: 2 years. Med Mal: 2 years (4-year repose). Contract: 6 years. Property: 6 years.', localRules: 'Each circuit has local rules. Check judge preferences.', deadlines: 'Answer: 30 days from service. Motions: per court schedule.' },
  { state: 'Federal', abbr: 'US', overview: 'Federal Rules of Civil Procedure. Article III courts. Diversity jurisdiction: $75K+. Federal question jurisdiction.', discovery: 'FRCP Rules 26-37. Initial disclosures: 14 days after Rule 26(f) conference. 25 interrogatories. 10 depositions.', fees: 'Filing fee: $405. Appeal: $505. IFP available.', sol: 'Borrows state SOL for §1983. Federal claims: varies by statute.', localRules: 'Each district has local rules. Check judge\'s individual practices. CM/ECF required.', deadlines: 'Answer: 21 days (60 if waiver). Discovery: per Rule 16 scheduling order. Summary judgment: per local rule.' },
];

const TABS_DATA = JURISDICTIONS.map(j => j.state);

export default function LegalResearchHub() {
  const [tab, setTab] = useState<Tab>('research');
  const activeCase = useActiveCase();

  // Research state
  const [question, setQuestion] = useState('');
  const [jurisdiction, setJurisdiction] = useState('Federal');
  const [area, setArea] = useState('Civil Rights');
  const [facts, setFacts] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  // Prefill the research request from Maya's intake handoff
  useEffect(() => {
    if (!activeCase) return;
    setFacts(prev => prev || activeCase.summary || '');
    if (activeCase.claims.length) {
      setQuestion(prev => prev || `Assess the strength of these claims and find supporting authority: ${activeCase.claims.join('; ')}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCase?.id]);

  // Jurisdiction state
  const [selectedState, setSelectedState] = useState('Mississippi');
  const [compareState, setCompareState] = useState('');
  const [activeJurTab, setActiveJurTab] = useState<'overview' | 'deadlines' | 'discovery' | 'fees' | 'sol' | 'local'>('overview');

  const jurisdictions = ['Federal', '5th Circuit', '11th Circuit', ...TABS_DATA.filter(s => s !== 'Federal')];
  const areas = ['Civil Rights', 'Police Misconduct', 'First Amendment', 'Constitutional Law', 'Tort Law', 'Contract Law', 'Criminal Law', 'Employment Law', 'Personal Injury', 'Family Law', 'Evidence', 'Procedure'];

  const research = async () => {
    if (!question.trim()) return;
    setLoading(true); setResult(null);
    const prompt = `You are a senior partner at a top law firm doing legal research.
RESEARCH QUESTION: ${question}
JURISDICTION: ${jurisdiction}
AREA OF LAW: ${area}
CASE FACTS: ${facts || 'Not provided'}
Provide comprehensive legal research in JSON:
{"research_summary":"2-3 paragraph summary","key_cases":[{"name":"case name","citation":"cite","holding":"holding","relevance":"why relevant"}],"applicable_statutes":[{"statute":"name","text":"key text","application":"how applies"}],"strength_assessment":{"plaintiff":"1-10","defense":"1-10","reasoning":"why"},"recommended_strategy":"what to do next","potential_motions":["motion to file"],"key_issues":["legal issue"]}`;
    const res = await analyzeDocument({
      text: activeCase ? `${prompt}\n\n${buildCaseContext(activeCase)}` : prompt,
      document_type: 'Legal Research',
      case_summary: facts,
    });
    if (res.analysis) {
      let parsed: any = res.analysis;
      try { const m = typeof res.analysis === 'string' ? res.analysis.match(/\{[\s\S]*\}/) : null; parsed = m ? JSON.parse(m[0]) : res.analysis; }
      catch { /* keep raw analysis */ }
      setResult(parsed);
      if (activeCase) {
        const findings = typeof parsed === 'string'
          ? parsed.slice(0, 500)
          : (parsed.research_summary || parsed.recommended_strategy || 'Research completed').slice(0, 500);
        addResearchNote(activeCase.id, question, findings);
        logActivity(activeCase.id, 'lex', 'Completed legal research', question.slice(0, 120), 120);
        completeAgentTask(activeCase.id, 'lex');
      }
    }
    setLoading(false);
  };

  const stateData = useMemo(() => JURISDICTIONS.find(j => j.state === selectedState), [selectedState]);
  const compareData = useMemo(() => compareState ? JURISDICTIONS.find(j => j.state === compareState) : null, [compareState]);

  const JUR_TABS: { id: typeof activeJurTab; label: string }[] = [
    { id: 'overview', label: 'Overview' }, { id: 'deadlines', label: 'Deadlines' },
    { id: 'discovery', label: 'Discovery' }, { id: 'fees', label: 'Fees' },
    { id: 'sol', label: 'SOL' }, { id: 'local', label: 'Local Rules' },
  ];

  const getField = (d: JurisdictionData | null | undefined, field: typeof activeJurTab): string => {
    if (!d) return '';
    const map: Record<string, string> = { overview: d.overview, deadlines: d.deadlines, discovery: d.discovery, fees: d.fees, sol: d.sol, local: d.localRules };
    return map[field] || '';
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <BookOpen className="text-emerald-400" size={28} />
        <div>
          <h1 className="text-2xl font-bold text-white">Legal Research Hub</h1>
          <p className="text-slate-400 text-sm">AI-powered research + jurisdiction rules database</p>
        </div>
      </div>

      <AgentHeader agent={AGENTS.lex} subtitle="Give me a legal question and I'll find the strongest precedents, flag the weaknesses, and tell you your odds." />


      <ActiveCaseBar agentId="lex" />

      <div className="flex gap-1 bg-slate-800 border border-slate-700 rounded-xl p-1">
        <button onClick={() => setTab('research')} className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-colors ${tab === 'research' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`}>
          <Search size={16} /> AI Research
        </button>
        <button onClick={() => setTab('jurisdiction')} className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-colors ${tab === 'jurisdiction' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`}>
          <Globe size={16} /> State Rules Database
        </button>
      </div>

      {/* === RESEARCH TAB === */}
      {tab === 'research' && (
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-sm text-slate-400 block mb-1">Jurisdiction</label><select value={jurisdiction} onChange={e => setJurisdiction(e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm">{jurisdictions.map(j => <option key={j}>{j}</option>)}</select></div>
              <div><label className="text-sm text-slate-400 block mb-1">Area of Law</label><select value={area} onChange={e => setArea(e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm">{areas.map(a => <option key={a}>{a}</option>)}</select></div>
            </div>
            <div><label className="text-sm text-slate-400 block mb-1">Legal Question</label><textarea value={question} onChange={e => setQuestion(e.target.value)} rows={4} placeholder="What legal question do you need researched?" className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm resize-none" /></div>
            <div><label className="text-sm text-slate-400 block mb-1">Case Facts (optional)</label><textarea value={facts} onChange={e => setFacts(e.target.value)} rows={3} placeholder="Relevant facts..." className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm resize-none" /></div>
            <button onClick={research} disabled={loading || !question.trim()} className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white py-3 rounded-lg font-semibold flex items-center justify-center gap-2">
              {loading ? <><Loader2 className="animate-spin" size={18} /> Researching...</> : <><BookOpen size={18} /> Research</>}
            </button>
          </div>
          <div className="space-y-4">
            {!result && !loading && <div className="bg-slate-800 border border-slate-700 rounded-xl p-8 text-center text-slate-500">Research results will appear here</div>}
            {result && typeof result === 'object' && (
              <>
                {result.research_summary && <div className="bg-slate-800 border border-emerald-500/30 rounded-xl p-4"><div className="text-emerald-400 font-semibold text-sm mb-2">Research Summary</div><div className="text-slate-300 text-sm leading-relaxed">{result.research_summary}</div></div>}
                {result.strength_assessment && (
                  <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 grid grid-cols-2 gap-4">
                    <div className="text-center"><div className="text-green-400 text-2xl font-bold">{result.strength_assessment.plaintiff}/10</div><div className="text-slate-500 text-xs">Plaintiff Strength</div></div>
                    <div className="text-center"><div className="text-red-400 text-2xl font-bold">{result.strength_assessment.defense}/10</div><div className="text-slate-500 text-xs">Defense Strength</div></div>
                  </div>
                )}
                {result.key_cases?.length > 0 && (
                  <div className="bg-slate-800 border border-slate-700 rounded-xl p-4"><div className="text-blue-400 font-semibold text-sm mb-3">Key Cases</div>
                    {result.key_cases.map((c: any, i: number) => <div key={i} className="mb-3 last:mb-0 border-b border-slate-700/50 pb-2 last:border-0"><div className="text-white text-sm font-medium">{c.name}</div><div className="text-slate-500 text-xs">{c.citation}</div><div className="text-slate-400 text-sm mt-1">{c.holding}</div></div>)}
                  </div>
                )}
                {result.recommended_strategy && <div className="bg-slate-800 border border-yellow-500/30 rounded-xl p-4"><div className="text-yellow-400 font-semibold text-sm mb-2">Recommended Strategy</div><div className="text-slate-300 text-sm">{result.recommended_strategy}</div></div>}
              </>
            )}
            {result && typeof result === 'string' && <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 text-slate-300 text-sm whitespace-pre-wrap">{result}</div>}
          </div>
        </div>
      )}

      {/* === JURISDICTION TAB === */}
      {tab === 'jurisdiction' && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3 items-center">
            <select value={selectedState} onChange={e => setSelectedState(e.target.value)} className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm">
              {JURISDICTIONS.map(j => <option key={j.state}>{j.state}</option>)}
            </select>
            <button onClick={() => setCompareState(compareState ? '' : JURISDICTIONS.find(j => j.state !== selectedState)?.state || '')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${compareState ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-700 border-slate-600 text-slate-400 hover:text-white'}`}>
              <ArrowLeftRight size={14} /> {compareState ? 'Comparing' : 'Compare'}
            </button>
            {compareState && (
              <select value={compareState} onChange={e => setCompareState(e.target.value)} className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm">
                {JURISDICTIONS.filter(j => j.state !== selectedState).map(j => <option key={j.state}>{j.state}</option>)}
              </select>
            )}
          </div>
          <div className="flex gap-1 bg-slate-800/50 rounded-lg p-1">
            {JUR_TABS.map(t => (
              <button key={t.id} onClick={() => setActiveJurTab(t.id)}
                className={`flex-1 py-2 rounded-md text-xs font-medium transition-colors ${activeJurTab === t.id ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}>
                {t.label}
              </button>
            ))}
          </div>
          <div className={`grid ${compareState ? 'md:grid-cols-2' : ''} gap-4`}>
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
              <div className="text-emerald-400 font-semibold text-sm mb-3">{selectedState}</div>
              <div className="text-slate-300 text-sm leading-relaxed whitespace-pre-line">{getField(stateData, activeJurTab)}</div>
            </div>
            {compareState && compareData && (
              <div className="bg-slate-800 border border-blue-500/30 rounded-xl p-5">
                <div className="text-blue-400 font-semibold text-sm mb-3">{compareState}</div>
                <div className="text-slate-300 text-sm leading-relaxed whitespace-pre-line">{getField(compareData, activeJurTab)}</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

