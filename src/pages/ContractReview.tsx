import React, { useState, useRef } from 'react';
import { Loader2, FileText, AlertTriangle, CheckCircle2, Info, Upload, ChevronDown, ChevronUp } from 'lucide-react';
import AgentHeader from '../components/AgentHeader';
import ActiveCaseBar from '../components/ActiveCaseBar';
import { getAgent } from '../agents/personas';
import { analyzeDocument } from '../lib/api';
import {
  useActiveCase,
  logActivity,
  completeAgentTask,
  addCaseDocument,
  ingestAgentReply,
  buildCaseContext,
} from '../lib/caseStore';

const agent = getAgent('nova');

interface Finding {
  severity: 'critical' | 'warning' | 'info' | 'ok';
  clause: string;
  issue: string;
  suggestion: string;
}

interface ContractAnalysis {
  contract_type: string;
  party_balance: 'favorable' | 'unfavorable' | 'neutral';
  overall_risk: 'low' | 'medium' | 'high' | 'critical';
  summary: string;
  findings: Finding[];
  missing_provisions: string[];
}

const SEVERITY_META: Record<string, { label: string; color: string; bg: string }> = {
  critical: { label: 'Critical', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/30' },
  warning:  { label: 'Risk Flag', color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/30' },
  info:     { label: 'Note', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/30' },
  ok:       { label: 'Looks Good', color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/30' },
};

const RISK_COLOR: Record<string, string> = {
  low: 'text-green-400', medium: 'text-yellow-400', high: 'text-orange-400', critical: 'text-red-400',
};

const CONTRACT_TYPES = [
  '', 'NDA / Confidentiality Agreement', 'Employment Agreement', 'Lease Agreement',
  'Vendor Contract', 'Settlement Agreement', 'Partnership Agreement',
  'Service Agreement', 'Purchase Agreement', 'Retainer Agreement', 'Other',
];

function SeverityIcon({ severity, className }: { severity: string; className?: string }) {
  const cfg = SEVERITY_META[severity] || SEVERITY_META.info;
  const cls = `${cfg.color} ${className || ''}`;
  if (severity === 'ok') return <CheckCircle2 size={14} className={cls} />;
  if (severity === 'info') return <Info size={14} className={cls} />;
  return <AlertTriangle size={14} className={cls} />;
}

export default function ContractReview() {
  const activeCase = useActiveCase();
  const [contractText, setContractText] = useState('');
  const [contractType, setContractType] = useState('');
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<ContractAnalysis | null>(null);
  const [rawReply, setRawReply] = useState('');
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = ev => setContractText((ev.target?.result as string) || '');
    reader.readAsText(f);
    e.target.value = '';
  };

  const review = async () => {
    if (!contractText.trim() || loading) return;
    setLoading(true);
    setAnalysis(null);
    setRawReply('');

    const caseContext = activeCase ? `\n\n${buildCaseContext(activeCase)}` : '';
    const typeHint = contractType ? ` (contract type: ${contractType})` : '';

    const prompt = `${agent.systemPrompt}${caseContext}

Review the following contract${typeHint}. Respond with valid JSON only:
{
  "contract_type": "string",
  "party_balance": "favorable|unfavorable|neutral",
  "overall_risk": "low|medium|high|critical",
  "summary": "2-3 sentence overview of key risks and party balance",
  "findings": [
    { "severity": "critical|warning|info|ok", "clause": "clause or section name", "issue": "what is wrong or notable", "suggestion": "how to fix or improve" }
  ],
  "missing_provisions": ["list of standard protections not found in this contract"]
}

CONTRACT TEXT:
"""
${contractText.slice(0, 10000)}
"""`;

    const res = await analyzeDocument({ content: prompt, analysisType: 'contract_review' });
    const raw = res.analysis || res.reply || '';
    const clean = ingestAgentReply(activeCase?.id, 'nova', raw);
    setRawReply(clean);

    const jsonMatch = clean.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed: ContractAnalysis = JSON.parse(jsonMatch[0]);
        setAnalysis(parsed);
        if (activeCase) {
          const criticals = (parsed.findings || []).filter(f => f.severity === 'critical').length;
          logActivity(
            activeCase.id, 'nova', 'Reviewed contract for risky clauses',
            `${parsed.contract_type || contractType || 'Agreement'} — ${parsed.overall_risk} risk${
              criticals ? `, ${criticals} critical finding(s)` : ''
            }`,
            30
          );
          completeAgentTask(activeCase.id, 'nova', '/contracts');
          addCaseDocument(activeCase.id, {
            fileName: `Nova Contract Review — ${parsed.contract_type || contractType || 'Agreement'}`,
            docType: 'Contract Analysis',
            summary: parsed.summary || `${parsed.overall_risk} risk — reviewed by Nova`,
            analyzedAt: new Date().toISOString(),
          });
        }
      } catch {
        // rawReply fallback is already set
      }
    }
    setLoading(false);
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <AgentHeader
        agent={agent}
        subtitle="Paste any contract and I'll tell you exactly what's risky, what's missing, and how to push back — before you sign anything."
      />
      <ActiveCaseBar agentId="nova" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input column */}
        <div className="space-y-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 space-y-4">
            <h2 className="text-white font-semibold text-sm flex items-center gap-2">
              <FileText size={15} className="text-emerald-400" /> Contract Input
            </h2>

            <div>
              <label className="block text-slate-400 text-xs mb-1.5">Contract type</label>
              <select
                value={contractType}
                onChange={e => setContractType(e.target.value)}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:border-emerald-500 focus:outline-none"
              >
                {CONTRACT_TYPES.map(t => <option key={t} value={t}>{t || 'Auto-detect'}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-slate-400 text-xs mb-1.5">Contract text</label>
              <textarea
                value={contractText}
                onChange={e => setContractText(e.target.value)}
                placeholder="Paste the full contract text here…"
                rows={14}
                className="w-full bg-slate-900 border border-slate-600 rounded-xl p-4 text-slate-200 text-sm resize-none focus:border-emerald-500 focus:outline-none font-mono leading-relaxed"
              />
              <div className="flex items-center justify-between mt-2">
                <span className="text-slate-600 text-xs">
                  {contractText.length > 0 ? `${contractText.length.toLocaleString()} characters` : 'Paste text or upload a file'}
                </span>
                <div className="flex gap-2">
                  <input ref={fileRef} type="file" accept=".txt,.doc,.docx,.rtf" className="hidden" onChange={onFile} />
                  <button
                    onClick={() => fileRef.current?.click()}
                    className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white bg-slate-700 hover:bg-slate-600 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    <Upload size={12} /> Upload file
                  </button>
                </div>
              </div>
            </div>

            <button
              onClick={review}
              disabled={loading || !contractText.trim()}
              className={`w-full py-3 rounded-xl font-semibold text-sm transition-all ${
                loading || !contractText.trim()
                  ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-emerald-600 to-green-700 text-white hover:opacity-90 shadow-lg shadow-emerald-900/30'
              }`}
            >
              {loading
                ? <><Loader2 size={14} className="inline animate-spin mr-2" />Nova is reviewing…</>
                : 'Review This Contract →'}
            </button>
          </div>

          <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
            <h3 className="text-slate-400 font-semibold text-xs mb-3 uppercase tracking-wider">What Nova checks</h3>
            <div className="space-y-2.5">
              {[
                { s: 'critical', text: 'Critical clauses that could destroy your position' },
                { s: 'warning',  text: 'Risk flags worth negotiating before you sign' },
                { s: 'info',     text: 'Missing standard protections & industry norms' },
                { s: 'ok',       text: 'Redline suggestions with plain-English rationale' },
              ].map(({ s, text }) => (
                <div key={s} className="flex items-center gap-2.5">
                  <SeverityIcon severity={s} />
                  <span className="text-slate-400 text-xs">{text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Results column */}
        <div>
          {!analysis && !loading && !rawReply && (
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-10 text-center flex flex-col items-center justify-center min-h-[400px]">
              <div className="text-5xl mb-4">📝</div>
              <h3 className="text-white font-semibold text-sm mb-2">Ready to Review</h3>
              <p className="text-slate-500 text-xs max-w-xs">
                Paste a contract and I'll flag every risk, identify what's missing, and tell you exactly what to push back on.
              </p>
            </div>
          )}

          {loading && (
            <div className="bg-slate-800 border border-emerald-500/20 rounded-xl p-10 text-center min-h-[400px] flex flex-col items-center justify-center">
              <Loader2 size={36} className="animate-spin text-emerald-400 mb-4" />
              <p className="text-white font-medium text-sm">Nova is reviewing every clause…</p>
              <p className="text-slate-500 text-xs mt-2">Checking for risky terms, missing protections, and redline opportunities</p>
            </div>
          )}

          {analysis && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <h3 className="text-white font-bold text-base">{analysis.contract_type || contractType || 'Contract'}</h3>
                    <p className="text-slate-400 text-xs mt-0.5">
                      {analysis.party_balance === 'favorable'
                        ? '✅ Favorable to you'
                        : analysis.party_balance === 'unfavorable'
                        ? '⚠️ Unfavorable — negotiate before signing'
                        : '⚖️ Relatively balanced'}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-slate-500 text-xs">Overall Risk</p>
                    <p className={`text-xl font-black uppercase ${RISK_COLOR[analysis.overall_risk] || 'text-slate-300'}`}>
                      {analysis.overall_risk}
                    </p>
                  </div>
                </div>
                <p className="text-slate-300 text-sm leading-relaxed">{analysis.summary}</p>
                <div className="flex flex-wrap gap-2 mt-3">
                  {(['critical', 'warning', 'info'] as const).map(s => {
                    const count = (analysis.findings || []).filter(f => f.severity === s).length;
                    if (count === 0) return null;
                    const cfg = SEVERITY_META[s];
                    return (
                      <span key={s} className={`text-xs font-medium px-2 py-0.5 rounded-full border ${cfg.bg} ${cfg.color}`}>
                        {count} {cfg.label}
                      </span>
                    );
                  })}
                </div>
              </div>

              {/* Findings */}
              {(analysis.findings || []).length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-slate-400 font-semibold text-xs uppercase tracking-wider">Findings</h4>
                  {analysis.findings.map((f, i) => {
                    const cfg = SEVERITY_META[f.severity] || SEVERITY_META.info;
                    const isOpen = openIdx === i;
                    return (
                      <div key={i} className={`border rounded-xl overflow-hidden ${cfg.bg}`}>
                        <button
                          className="w-full flex items-start gap-3 p-4 text-left"
                          onClick={() => setOpenIdx(isOpen ? null : i)}
                        >
                          <SeverityIcon severity={f.severity} className="mt-0.5 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <p className={`text-xs font-bold ${cfg.color}`}>{cfg.label}</p>
                              {isOpen
                                ? <ChevronUp size={13} className="text-slate-500 flex-shrink-0" />
                                : <ChevronDown size={13} className="text-slate-500 flex-shrink-0" />}
                            </div>
                            <p className="text-white text-sm font-medium leading-snug mt-0.5">{f.clause}</p>
                            <p className="text-slate-400 text-xs mt-1 leading-relaxed">{f.issue}</p>
                          </div>
                        </button>
                        {isOpen && f.suggestion && (
                          <div className="px-4 pb-4 ml-5 border-t border-white/5 pt-3">
                            <p className="text-slate-500 text-xs font-medium mb-1">Nova's suggested redline:</p>
                            <p className="text-emerald-300 text-xs leading-relaxed">{f.suggestion}</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Missing provisions */}
              {(analysis.missing_provisions || []).length > 0 && (
                <div className="bg-slate-800 border border-yellow-500/20 rounded-xl p-4">
                  <h4 className="text-yellow-400 font-semibold text-xs uppercase tracking-wider mb-3 flex items-center gap-2">
                    <AlertTriangle size={13} /> Missing Standard Provisions
                  </h4>
                  <ul className="space-y-1.5">
                    {analysis.missing_provisions.map((p, i) => (
                      <li key={i} className="flex items-start gap-2 text-slate-300 text-xs">
                        <span className="text-yellow-500 mt-0.5 flex-shrink-0">•</span>
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <p className="text-center text-slate-600 text-xs">
                AI-generated analysis — attorney review required before acting on these findings.
              </p>
            </div>
          )}

          {!analysis && rawReply && !loading && (
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
              <h3 className="text-white font-semibold text-sm mb-3">Nova's Review</h3>
              <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">{rawReply}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
