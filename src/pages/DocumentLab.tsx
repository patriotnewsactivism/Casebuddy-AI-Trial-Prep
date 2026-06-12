import React, { useState, useCallback, useEffect } from 'react';
import { FileSearch, Upload, Loader2, Gem, AlertTriangle, CheckCircle, ScanLine, FileCheck, Eye, X, FileText } from 'lucide-react';
import { analyzeDocument } from '../lib/api';
import ActiveCaseBar from '../components/ActiveCaseBar';
import { useActiveCase, buildCaseContext, caseBrief, addCaseDocument, logActivity, completeAgentTask } from '../lib/caseStore';

type Tab = 'analyze' | 'scan' | 'contract';

interface ScannedDoc {
  id: string; fileName: string; text: string; analysis: any; scannedAt: string;
}

const DOC_TYPES = ['Contract', 'Deposition', 'Police Report', 'Medical Record', 'Email', 'Text Messages', 'Financial Record', 'Expert Report', 'Court Filing', 'Other'];

export default function DocumentLab() {
  const [tab, setTab] = useState<Tab>('analyze');
  const activeCase = useActiveCase();

  // === ANALYZE STATE ===
  const [text, setText] = useState('');
  const [docType, setDocType] = useState('Contract');
  const [caseSummary, setCaseSummary] = useState('');
  const [fileName, setFileName] = useState('');
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<any>(null);

  // === SCAN STATE ===
  const [files, setFiles] = useState<File[]>([]);
  const [scanning, setScanning] = useState(false);
  const [scannedDocs, setScannedDocs] = useState<ScannedDoc[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<ScannedDoc | null>(null);
  const [caseContext, setCaseContext] = useState('');

  // Prefill case context from the active case file so Doc already knows the case
  useEffect(() => {
    if (activeCase) {
      setCaseSummary(prev => prev || caseBrief(activeCase));
      setCaseContext(prev => prev || caseBrief(activeCase));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCase?.id]);

  // === CONTRACT STATE ===
  const [contractText, setContractText] = useState('');
  const [contractLoading, setContractLoading] = useState(false);
  const [contractResult, setContractResult] = useState<any>(null);
  const [contractParty, setContractParty] = useState('');

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = ev => setText(ev.target?.result as string || '');
    reader.readAsText(file);
  };

  const analyze = async () => {
    if (!text.trim()) return;
    setLoading(true); setAnalysis(null);
    const res = await analyzeDocument({
      text,
      document_type: docType,
      case_summary: activeCase ? `${caseSummary}\n\n${buildCaseContext(activeCase)}` : caseSummary,
    });
    if (res.analysis) {
      setAnalysis(res.analysis);
      if (activeCase) {
        const name = fileName || `${docType} (pasted text)`;
        const summary = typeof res.analysis === 'string'
          ? res.analysis.slice(0, 300)
          : (res.analysis.summary || 'Analysis completed').slice(0, 300);
        addCaseDocument(activeCase.id, { fileName: name, docType, summary, analyzedAt: new Date().toISOString() });
        logActivity(activeCase.id, 'doc', 'Analyzed a document', `${name} — ${summary.slice(0, 120)}`, 60);
        completeAgentTask(activeCase.id, 'doc');
      }
    }
    setLoading(false);
  };

  // Scan handlers
  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const dropped = Array.from(e.dataTransfer.files);
    setFiles(prev => [...prev, ...dropped]);
  }, []);

  const scanAll = async () => {
    if (files.length === 0) return;
    setScanning(true);
    for (const file of files) {
      const reader = new FileReader();
      const fileText = await new Promise<string>(resolve => {
        reader.onload = e => resolve(e.target?.result as string || '');
        reader.readAsText(file);
      });
      const res = await analyzeDocument({
        text: fileText,
        document_type: 'Other',
        case_summary: activeCase ? `${caseContext}\n\n${buildCaseContext(activeCase)}` : caseContext,
      });
      setScannedDocs(prev => [...prev, {
        id: Date.now().toString() + Math.random(),
        fileName: file.name, text: fileText,
        analysis: res.analysis || { summary: 'Analysis completed' },
        scannedAt: new Date().toLocaleString(),
      }]);
      if (activeCase) {
        const summary = (res.analysis?.summary || 'Scanned & analyzed').slice(0, 300);
        addCaseDocument(activeCase.id, { fileName: file.name, docType: 'Scanned', summary, analyzedAt: new Date().toISOString() });
        logActivity(activeCase.id, 'doc', 'Scanned & analyzed a document', file.name, 45);
      }
    }
    if (activeCase && files.length > 0) completeAgentTask(activeCase.id, 'doc');
    setFiles([]); setScanning(false);
  };

  // Contract handlers
  const handleContractFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setContractText(ev.target?.result as string || '');
    reader.readAsText(file);
  };

  const reviewContract = async () => {
    if (!contractText.trim()) return;
    setContractLoading(true); setContractResult(null);
    const prompt = `You are a senior contract attorney reviewing this contract. Analyze every clause.
CONTRACT TEXT:
${contractText.substring(0, 8000)}
${contractParty ? `\nREVIEWING FOR: ${contractParty}` : ''}

Respond in JSON:
{
  "overall_risk": "LOW|MEDIUM|HIGH|CRITICAL",
  "risk_score": 0-100,
  "summary": "executive summary",
  "clauses": [{"clause":"name","risk":"LOW|MEDIUM|HIGH","issue":"description","recommendation":"fix"}],
  "missing_clauses": ["clause that should be included"],
  "favorable_terms": ["terms that benefit our client"],
  "negotiation_points": ["what to push back on"]
}`;
    const res = await analyzeDocument({ text: prompt, document_type: 'Contract', case_summary: contractParty });
    if (res.analysis) {
      try {
        const match = typeof res.analysis === 'string' ? res.analysis.match(/\{[\s\S]*\}/) : null;
        setContractResult(match ? JSON.parse(match[0]) : res.analysis);
      } catch { setContractResult(res.analysis); }
    }
    setContractLoading(false);
  };

  const TABS: { id: Tab; label: string; icon: any }[] = [
    { id: 'analyze', label: 'Analyze & Upload', icon: FileSearch },
    { id: 'scan', label: 'Batch Scanner', icon: ScanLine },
    { id: 'contract', label: 'Contract Review', icon: FileCheck },
  ];

  const riskColor = (r: string) => r === 'HIGH' || r === 'CRITICAL' ? 'text-red-400 bg-red-500/10' : r === 'MEDIUM' ? 'text-yellow-400 bg-yellow-500/10' : 'text-green-400 bg-green-500/10';

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <FileSearch className="text-blue-400" size={28} />
        <div>
          <h1 className="text-2xl font-bold text-white">Document Lab</h1>
          <p className="text-slate-400 text-sm">Analyze, scan, and review documents — all in one place</p>
        </div>
      </div>

      <ActiveCaseBar agentId="doc" />

      {/* Tab Bar */}
      <div className="flex gap-1 bg-slate-800 border border-slate-700 rounded-xl p-1">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              tab === t.id ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-700'
            }`}>
            <t.icon size={16} /> {t.label}
          </button>
        ))}
      </div>

      {/* ===== ANALYZE TAB ===== */}
      {tab === 'analyze' && (
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 space-y-4">
            <div>
              <label className="text-sm text-slate-400 block mb-2">Document Type</label>
              <select value={docType} onChange={e => setDocType(e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500">
                {DOC_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm text-slate-400 block mb-2">Case Context (optional)</label>
              <input value={caseSummary} onChange={e => setCaseSummary(e.target.value)}
                placeholder="Brief case summary to improve analysis..."
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="text-sm text-slate-400 block mb-2">Upload File</label>
              <label className="flex items-center gap-2 border-2 border-dashed border-slate-600 rounded-lg p-4 cursor-pointer hover:border-blue-500 transition-colors">
                <Upload className="text-slate-400" size={20} />
                <span className="text-slate-400 text-sm">Click to upload text file</span>
                <input type="file" accept=".txt,.md,.csv,.pdf" className="hidden" onChange={handleFile} />
              </label>
            </div>
            <div>
              <label className="text-sm text-slate-400 block mb-2">Or paste document text</label>
              <textarea value={text} onChange={e => setText(e.target.value)} rows={8} placeholder="Paste document text here..."
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 resize-none" />
            </div>
            <button onClick={analyze} disabled={loading || !text.trim()}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-3 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2">
              {loading ? <><Loader2 className="animate-spin" size={18} /> Analyzing...</> : <><FileSearch size={18} /> Analyze Document</>}
            </button>
          </div>
          <div className="space-y-4">
            {!analysis && !loading && <div className="bg-slate-800 border border-slate-700 rounded-xl p-8 text-center text-slate-500">Analysis results will appear here</div>}
            {analysis && (
              <>
                {analysis.summary && <div className="bg-slate-800 border border-blue-500/30 rounded-xl p-4"><div className="text-blue-400 font-semibold text-sm mb-2">Summary</div><div className="text-slate-300 text-sm">{analysis.summary}</div></div>}
                {analysis.gems?.length > 0 && <div className="bg-slate-800 border border-yellow-500/30 rounded-xl p-4"><div className="flex items-center gap-2 text-yellow-400 font-semibold text-sm mb-2"><Gem size={16} /> Hidden Gems</div>{analysis.gems.map((g: string, i: number) => <div key={i} className="text-slate-300 text-sm">• {g}</div>)}</div>}
                {analysis.risks?.length > 0 && <div className="bg-slate-800 border border-red-500/30 rounded-xl p-4"><div className="flex items-center gap-2 text-red-400 font-semibold text-sm mb-2"><AlertTriangle size={16} /> Risks</div>{analysis.risks.map((r: string, i: number) => <div key={i} className="text-slate-300 text-sm">• {r}</div>)}</div>}
                {analysis.key_facts?.length > 0 && <div className="bg-slate-800 border border-slate-700 rounded-xl p-4"><div className="flex items-center gap-2 text-green-400 font-semibold text-sm mb-2"><CheckCircle size={16} /> Key Facts</div>{analysis.key_facts.map((f: string, i: number) => <div key={i} className="text-slate-300 text-sm">• {f}</div>)}</div>}
                {analysis.admissibility && <div className="bg-slate-800 border border-slate-700 rounded-xl p-4"><div className="text-purple-400 font-semibold text-sm mb-2">Admissibility</div><div className="text-slate-300 text-sm">{analysis.admissibility}</div></div>}
                {analysis.motions_suggested?.length > 0 && <div className="bg-slate-800 border border-slate-700 rounded-xl p-4"><div className="text-orange-400 font-semibold text-sm mb-2">Suggested Motions</div>{analysis.motions_suggested.map((m: string, i: number) => <div key={i} className="text-slate-300 text-sm">• {m}</div>)}</div>}
              </>
            )}
          </div>
        </div>
      )}

      {/* ===== SCAN TAB ===== */}
      {tab === 'scan' && (
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 space-y-4">
              <div>
                <label className="text-sm text-slate-400 block mb-1">Case Context (helps AI focus)</label>
                <input value={caseContext} onChange={e => setCaseContext(e.target.value)} placeholder="e.g. Police misconduct case, Lafayette County..."
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500" />
              </div>
              <div onDrop={onDrop} onDragOver={e => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)}
                className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${
                  dragOver ? 'border-blue-500 bg-blue-500/5' : 'border-slate-600 hover:border-slate-500'
                }`}>
                <ScanLine className="mx-auto text-slate-500 mb-2" size={36} />
                <div className="text-slate-400 text-sm font-medium">Drop files here or click to browse</div>
                <div className="text-slate-600 text-xs mt-1">Supports multiple files — txt, md, csv, pdf</div>
                <input type="file" multiple className="hidden" id="scan-upload" onChange={e => setFiles(prev => [...prev, ...Array.from(e.target.files || [])])} />
                <label htmlFor="scan-upload" className="inline-block mt-3 bg-slate-700 text-slate-300 px-4 py-2 rounded-lg text-sm cursor-pointer hover:bg-slate-600">Browse Files</label>
              </div>
              {files.length > 0 && (
                <div className="space-y-1">
                  {files.map((f, i) => (
                    <div key={i} className="flex items-center justify-between bg-slate-700/50 rounded-lg px-3 py-2">
                      <span className="text-slate-300 text-sm truncate">{f.name}</span>
                      <button onClick={() => setFiles(prev => prev.filter((_, j) => j !== i))} className="text-slate-500 hover:text-red-400"><X size={14} /></button>
                    </div>
                  ))}
                  <button onClick={scanAll} disabled={scanning}
                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-3 rounded-lg font-semibold flex items-center justify-center gap-2 mt-2">
                    {scanning ? <><Loader2 className="animate-spin" size={18} /> Scanning...</> : <><ScanLine size={18} /> Scan {files.length} File{files.length > 1 ? 's' : ''}</>}
                  </button>
                </div>
              )}
            </div>
          </div>
          <div className="space-y-3">
            {scannedDocs.length === 0 && <div className="bg-slate-800 border border-slate-700 rounded-xl p-10 text-center text-slate-500"><ScanLine className="mx-auto mb-2 opacity-30" size={40} /><div>Scanned documents will appear here</div></div>}
            {scannedDocs.map(doc => (
              <div key={doc.id} className="bg-slate-800 border border-slate-700 rounded-xl p-4 cursor-pointer hover:border-blue-500/50 transition-colors" onClick={() => setSelectedDoc(doc)}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2"><FileText size={16} className="text-blue-400" /><span className="text-white text-sm font-medium">{doc.fileName}</span></div>
                  <Eye size={14} className="text-slate-500" />
                </div>
                <div className="text-slate-500 text-xs mt-1">{doc.scannedAt}</div>
                {doc.analysis?.summary && <div className="text-slate-400 text-sm mt-2 line-clamp-2">{doc.analysis.summary}</div>}
              </div>
            ))}
          </div>
          {/* Detail Modal */}
          {selectedDoc && (
            <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setSelectedDoc(null)}>
              <div className="bg-slate-800 border border-slate-700 rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-white font-bold">{selectedDoc.fileName}</h3>
                  <button onClick={() => setSelectedDoc(null)} className="text-slate-400 hover:text-white"><X size={20} /></button>
                </div>
                {selectedDoc.analysis?.summary && <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 mb-3"><div className="text-blue-400 font-semibold text-sm mb-1">Summary</div><div className="text-slate-300 text-sm">{selectedDoc.analysis.summary}</div></div>}
                {selectedDoc.analysis?.gems?.map((g: string, i: number) => <div key={i} className="text-yellow-300 text-sm">💎 {g}</div>)}
                {selectedDoc.analysis?.risks?.map((r: string, i: number) => <div key={i} className="text-red-300 text-sm">⚠️ {r}</div>)}
                {selectedDoc.analysis?.key_facts?.map((f: string, i: number) => <div key={i} className="text-green-300 text-sm">✓ {f}</div>)}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===== CONTRACT TAB ===== */}
      {tab === 'contract' && (
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 space-y-4">
            <div>
              <label className="text-sm text-slate-400 block mb-2">Your Party Name (optional)</label>
              <input value={contractParty} onChange={e => setContractParty(e.target.value)} placeholder="Who are you representing?"
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="text-sm text-slate-400 block mb-2">Upload Contract</label>
              <label className="flex items-center gap-2 border-2 border-dashed border-slate-600 rounded-lg p-4 cursor-pointer hover:border-blue-500 transition-colors">
                <Upload className="text-slate-400" size={20} />
                <span className="text-slate-400 text-sm">Upload contract file</span>
                <input type="file" accept=".txt,.md,.pdf,.doc" className="hidden" onChange={handleContractFile} />
              </label>
            </div>
            <div>
              <label className="text-sm text-slate-400 block mb-2">Or paste contract text</label>
              <textarea value={contractText} onChange={e => setContractText(e.target.value)} rows={10} placeholder="Paste full contract text..."
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 resize-none" />
            </div>
            <button onClick={reviewContract} disabled={contractLoading || !contractText.trim()}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-3 rounded-lg font-semibold flex items-center justify-center gap-2">
              {contractLoading ? <><Loader2 className="animate-spin" size={18} /> Reviewing...</> : <><FileCheck size={18} /> Review Contract</>}
            </button>
          </div>
          <div className="space-y-4">
            {!contractResult && !contractLoading && <div className="bg-slate-800 border border-slate-700 rounded-xl p-8 text-center text-slate-500">Contract analysis will appear here</div>}
            {contractResult && (
              <>
                {contractResult.overall_risk && (
                  <div className={`rounded-xl p-4 border ${contractResult.overall_risk === 'HIGH' || contractResult.overall_risk === 'CRITICAL' ? 'bg-red-500/10 border-red-500/30' : contractResult.overall_risk === 'MEDIUM' ? 'bg-yellow-500/10 border-yellow-500/30' : 'bg-green-500/10 border-green-500/30'}`}>
                    <div className="text-center">
                      <div className={`text-2xl font-bold ${contractResult.overall_risk === 'HIGH' || contractResult.overall_risk === 'CRITICAL' ? 'text-red-400' : contractResult.overall_risk === 'MEDIUM' ? 'text-yellow-400' : 'text-green-400'}`}>{contractResult.overall_risk} RISK</div>
                      {contractResult.risk_score !== undefined && <div className="text-slate-400 text-sm mt-1">Score: {contractResult.risk_score}/100</div>}
                    </div>
                  </div>
                )}
                {contractResult.summary && <div className="bg-slate-800 border border-blue-500/30 rounded-xl p-4"><div className="text-blue-400 font-semibold text-sm mb-2">Summary</div><div className="text-slate-300 text-sm">{contractResult.summary}</div></div>}
                {contractResult.clauses?.length > 0 && (
                  <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 space-y-3">
                    <div className="text-white font-semibold text-sm">Clause Analysis</div>
                    {contractResult.clauses.map((c: any, i: number) => (
                      <div key={i} className="border-b border-slate-700/50 pb-2 last:border-0 last:pb-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-2 py-0.5 rounded font-medium ${riskColor(c.risk)}`}>{c.risk}</span>
                          <span className="text-white text-sm font-medium">{c.clause}</span>
                        </div>
                        <div className="text-slate-400 text-xs mt-1">{c.issue}</div>
                        {c.recommendation && <div className="text-blue-400 text-xs mt-1">→ {c.recommendation}</div>}
                      </div>
                    ))}
                  </div>
                )}
                {contractResult.negotiation_points?.length > 0 && (
                  <div className="bg-slate-800 border border-orange-500/30 rounded-xl p-4">
                    <div className="text-orange-400 font-semibold text-sm mb-2">Negotiation Points</div>
                    {contractResult.negotiation_points.map((p: string, i: number) => <div key={i} className="text-slate-300 text-sm">• {p}</div>)}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
