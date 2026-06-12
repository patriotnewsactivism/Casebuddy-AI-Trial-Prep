import React, { useState, useEffect } from 'react';
import { Microscope, Plus, Trash2, Loader2, Flame, Clock, GitCompare } from 'lucide-react';
import { discoveryMiner } from '../lib/api';
import AgentHeader from '../components/AgentHeader';
import ActiveCaseBar from '../components/ActiveCaseBar';
import { AGENTS } from '../agents/personas';
import { useActiveCase, buildCaseContext, caseBrief, logActivity } from '../lib/caseStore';

interface Doc { title: string; document_type: string; content_text: string; }

export default function DiscoveryMiner() {
  const activeCase = useActiveCase();
  const [docs, setDocs] = useState<Doc[]>([{ title: '', document_type: 'Contract', content_text: '' }]);
  const [caseTheory, setCaseTheory] = useState('');
  const [side, setSide] = useState('Plaintiff');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>(null);

  useEffect(() => {
    if (activeCase) setCaseTheory(prev => prev || caseBrief(activeCase));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCase?.id]);

  const addDoc = () => setDocs(d => [...d, { title: '', document_type: 'Contract', content_text: '' }]);
  const removeDoc = (i: number) => setDocs(d => d.filter((_, idx) => idx !== i));
  const updateDoc = (i: number, field: keyof Doc, val: string) =>
    setDocs(d => d.map((doc, idx) => idx === i ? { ...doc, [field]: val } : doc));

  const mine = async () => {
    const valid = docs.filter(d => d.content_text.trim() && d.title.trim());
    if (!valid.length) return;
    setLoading(true);
    setResults(null);
    const res = await discoveryMiner({
      documents: valid,
      case_theory: activeCase ? `${caseTheory}\n\n${buildCaseContext(activeCase)}` : caseTheory,
      side,
    });
    if (res.mining_results) {
      setResults(res.mining_results);
      if (activeCase) {
        logActivity(activeCase.id, 'doc', 'Mined discovery for contradictions & smoking guns', `Cross-referenced ${valid.length} document(s).`, 90);
      }
    }
    setLoading(false);
  };

  const DOC_TYPES = ['Contract', 'Deposition', 'Police Report', 'Medical Record', 'Email', 'Text Messages', 'Financial Record', 'Expert Report', 'Court Filing', 'Other'];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Microscope className="text-emerald-400" size={28} />
        <div>
          <h1 className="text-2xl font-bold text-white">Discovery Miner</h1>
          <p className="text-slate-400 text-sm">Cross-reference all documents to uncover smoking guns, contradictions & gaps</p>
        </div>
      </div>

      <AgentHeader agent={AGENTS.doc} subtitle="Feed me every document you have. I'll find the smoking guns, the contradictions, and the gaps they don't want you to see." />


      <ActiveCaseBar agentId="doc" />

      <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 space-y-4">
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-slate-400 block mb-2">Case Theory</label>
            <input value={caseTheory} onChange={e => setCaseTheory(e.target.value)}
              placeholder="e.g. Defendant breached contract by failing to deliver goods..."
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500" />
          </div>
          <div>
            <label className="text-sm text-slate-400 block mb-2">Representing</label>
            <select value={side} onChange={e => setSide(e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500">
              <option>Plaintiff</option>
              <option>Defendant</option>
              <option>Prosecution</option>
              <option>Defense</option>
            </select>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-white">Documents ({docs.length})</div>
            <button onClick={addDoc} className="flex items-center gap-1 text-blue-400 hover:text-blue-300 text-sm">
              <Plus size={16} /> Add Document
            </button>
          </div>
          {docs.map((doc, i) => (
            <div key={i} className="bg-slate-700/50 border border-slate-600 rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2">
                <input value={doc.title} onChange={e => updateDoc(i, 'title', e.target.value)}
                  placeholder="Document title"
                  className="flex-1 bg-slate-700 border border-slate-600 rounded px-3 py-1.5 text-white text-sm focus:outline-none focus:border-blue-500" />
                <select value={doc.document_type} onChange={e => updateDoc(i, 'document_type', e.target.value)}
                  className="bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-white text-sm focus:outline-none">
                  {DOC_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
                {docs.length > 1 && (
                  <button onClick={() => removeDoc(i)} className="text-red-400 hover:text-red-300">
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
              <textarea value={doc.content_text} onChange={e => updateDoc(i, 'content_text', e.target.value)}
                rows={4} placeholder="Paste document text here..."
                className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 resize-none" />
            </div>
          ))}
        </div>

        <button onClick={mine} disabled={loading}
          className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white py-3 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2">
          {loading ? <><Loader2 className="animate-spin" size={18} /> Mining...</> : <><Microscope size={18} /> Run Discovery Mining</>}
        </button>
      </div>

      {results && (
        <div className="space-y-4">
          {results.overall_assessment && (
            <div className="bg-slate-800 border border-emerald-500/30 rounded-xl p-5">
              <div className="text-emerald-400 font-semibold mb-2">Overall Assessment</div>
              <div className="text-slate-300">{results.overall_assessment}</div>
            </div>
          )}
          {results.smoking_guns?.length > 0 && (
            <div className="bg-slate-800 border border-red-500/30 rounded-xl p-5">
              <div className="flex items-center gap-2 text-red-400 font-semibold mb-3"><Flame size={18} /> Smoking Guns ({results.smoking_guns.length})</div>
              {results.smoking_guns.map((g: any, i: number) => (
                <div key={i} className="border-b border-slate-700 pb-3 mb-3 last:border-0 last:pb-0 last:mb-0">
                  <div className="text-white font-medium text-sm">{g.document}</div>
                  {g.quote && <div className="text-slate-400 text-sm italic mt-1">"{g.quote}"</div>}
                  <div className="text-red-300 text-sm mt-1">{g.significance}</div>
                  {g.action && <div className="text-blue-400 text-xs mt-1">→ {g.action}</div>}
                </div>
              ))}
            </div>
          )}
          {results.contradictions?.length > 0 && (
            <div className="bg-slate-800 border border-yellow-500/30 rounded-xl p-5">
              <div className="flex items-center gap-2 text-yellow-400 font-semibold mb-3"><GitCompare size={18} /> Contradictions ({results.contradictions.length})</div>
              {results.contradictions.map((c: any, i: number) => (
                <div key={i} className="border-b border-slate-700 pb-3 mb-3 last:border-0">
                  <div className="text-sm text-slate-300">{c.contradiction}</div>
                  <div className="text-xs text-slate-400 mt-1">{c.doc1} ↔ {c.doc2}</div>
                  {c.exploit && <div className="text-yellow-300 text-xs mt-1">→ {c.exploit}</div>}
                </div>
              ))}
            </div>
          )}
          {results.timeline?.length > 0 && (
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
              <div className="flex items-center gap-2 text-blue-400 font-semibold mb-3"><Clock size={18} /> Timeline</div>
              {results.timeline.map((t: any, i: number) => (
                <div key={i} className="flex gap-3 pb-3 mb-3 border-b border-slate-700 last:border-0">
                  <div className="text-blue-400 text-sm font-mono whitespace-nowrap">{t.date}</div>
                  <div>
                    <div className="text-white text-sm">{t.event}</div>
                    <div className="text-slate-400 text-xs">{t.document_source}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {results.missing_documents?.length > 0 && (
            <div className="bg-slate-800 border border-orange-500/30 rounded-xl p-5">
              <div className="text-orange-400 font-semibold mb-2">Missing Documents (Follow-up Needed)</div>
              {results.missing_documents.map((m: string, i: number) => <div key={i} className="text-slate-300 text-sm">• {m}</div>)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
