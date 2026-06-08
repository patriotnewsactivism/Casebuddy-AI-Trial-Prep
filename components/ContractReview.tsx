import React, { useState, useRef } from 'react';
import {
  FileSearch, Upload, FileText, AlertTriangle, CheckCircle, Loader2,
  Shield, Clock, DollarSign, Scale, ChevronDown, ChevronRight,
  Eye, Download, Sparkles, XCircle, Info, BookOpen, Edit3
} from 'lucide-react';
import { toast } from 'react-toastify';
import { callGeminiProxy } from '../services/apiProxy';

interface ContractAnalysis {
  title: string;
  contractType: string;
  parties: { name: string; role: string }[];
  effectiveDate?: string;
  terminationDate?: string;
  governingLaw: string;
  overallRisk: 'low' | 'moderate' | 'high' | 'critical';
  riskScore: number;
  sections: ContractSection[];
  redFlags: RedFlag[];
  missingClauses: string[];
  keyTerms: { term: string; definition: string }[];
  financialTerms: { description: string; amount: string; frequency: string }[];
  recommendations: string[];
  executiveSummary: string;
}

interface ContractSection {
  title: string;
  sectionNumber: string;
  summary: string;
  risk: 'low' | 'moderate' | 'high';
  issues: string[];
  suggestedRevisions?: string;
}

interface RedFlag {
  severity: 'warning' | 'danger' | 'critical';
  clause: string;
  issue: string;
  recommendation: string;
  legalBasis: string;
}

const ContractReview = () => {
  const [contractText, setContractText] = useState('');
  const [analysis, setAnalysis] = useState<ContractAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'summary' | 'sections' | 'redflags' | 'financial'>('summary');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type.startsWith('image/') || file.type === 'application/pdf') {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(',')[1];
        const mimeType = file.type;

        try {
          const result = await callGeminiProxy({
            prompt: 'Extract ALL text from this contract document. Preserve formatting and structure.',
            model: 'gemini-2.5-flash',
            inlineData: { mimeType, data: base64 },
            options: { temperature: 0.1, maxOutputTokens: 8192 },
          });
          setContractText(result.text);
          toast.success('Contract text extracted');
        } catch {
          toast.error('Failed to extract text');
        }
      };
      reader.readAsDataURL(file);
    } else {
      const reader = new FileReader();
      reader.onload = () => {
        setContractText(reader.result as string);
        toast.success('Contract loaded');
      };
      reader.readAsText(file);
    }
  };

  const analyzeContract = async () => {
    if (!contractText.trim()) {
      toast.error('Paste contract text or upload a file');
      return;
    }

    setIsAnalyzing(true);

    try {
      const prompt = `You are an expert contract review attorney. Analyze this contract thoroughly and return a JSON object:

{
  "title": "contract title or identifier",
  "contractType": "type (e.g., NDA, Employment Agreement, Lease, Service Agreement, etc.)",
  "parties": [{"name": "party name", "role": "their role"}],
  "effectiveDate": "date or null",
  "terminationDate": "date or null",
  "governingLaw": "jurisdiction",
  "overallRisk": "low/moderate/high/critical",
  "riskScore": 1-100,
  "sections": [
    {
      "title": "section name",
      "sectionNumber": "number",
      "summary": "what this section does",
      "risk": "low/moderate/high",
      "issues": ["problems or concerns"],
      "suggestedRevisions": "specific language changes if needed"
    }
  ],
  "redFlags": [
    {
      "severity": "warning/danger/critical",
      "clause": "the problematic clause text",
      "issue": "why this is problematic",
      "recommendation": "what to do about it",
      "legalBasis": "legal authority or common practice reference"
    }
  ],
  "missingClauses": ["important clauses that should be in this type of contract but aren't"],
  "keyTerms": [{"term": "defined term", "definition": "its definition"}],
  "financialTerms": [{"description": "what the payment is for", "amount": "amount", "frequency": "when"}],
  "recommendations": ["ordered list of recommended actions"],
  "executiveSummary": "2-3 paragraph executive summary of the contract, key risks, and overall assessment"
}

Be thorough. Identify EVERY red flag, ambiguous term, one-sided provision, and missing protection.

CONTRACT TEXT:
${contractText.substring(0, 30000)}`;

      const result = await callGeminiProxy({
        prompt,
        model: 'gemini-2.5-flash',
        options: { temperature: 0.2, maxOutputTokens: 8192, responseMimeType: 'application/json' },
      });

      setAnalysis(JSON.parse(result.text));
      toast.success('✅ Contract analysis complete');
    } catch (error) {
      console.error('Analysis error:', error);
      toast.error('Failed to analyze contract');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const riskColor = (risk: string) => {
    if (risk === 'critical') return 'text-red-500 bg-red-500/10 border-red-500/30';
    if (risk === 'high' || risk === 'danger') return 'text-red-400 bg-red-500/10 border-red-500/30';
    if (risk === 'moderate' || risk === 'warning') return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
    return 'text-green-400 bg-green-500/10 border-green-500/30';
  };

  const riskScoreColor = (score: number) => {
    if (score >= 75) return 'text-red-400';
    if (score >= 50) return 'text-amber-400';
    if (score >= 25) return 'text-yellow-400';
    return 'text-green-400';
  };

  return (
    <div className="space-y-6 animate-slideInUp">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/30">
            <FileSearch size={24} className="text-rose-400" />
          </div>
          Contract Review AI
        </h1>
        <p className="text-slate-400 mt-1">Upload any contract — AI identifies red flags, missing clauses, financial terms, and risks</p>
      </div>

      {/* Input Section */}
      {!analysis && (
        <div className="space-y-4">
          <div className="glass-card rounded-xl p-6">
            <div className="flex items-center gap-4 mb-4">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-sm font-medium flex items-center gap-2"
              >
                <Upload size={16} /> Upload Contract
              </button>
              <span className="text-sm text-slate-500">PDF, Word, text, or image file</span>
              <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg" onChange={handleFileUpload} className="hidden" />
            </div>
            <textarea
              value={contractText}
              onChange={e => setContractText(e.target.value)}
              placeholder="Or paste contract text here..."
              rows={12}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-sm text-white placeholder-slate-500 focus:border-rose-500 outline-none resize-none font-mono"
            />
            <div className="flex items-center justify-between mt-4">
              <p className="text-xs text-slate-500">{contractText.length.toLocaleString()} characters</p>
              <button
                onClick={analyzeContract}
                disabled={isAnalyzing || !contractText.trim()}
                className="px-6 py-2.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-medium text-sm disabled:opacity-50 flex items-center gap-2"
              >
                {isAnalyzing ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                {isAnalyzing ? 'Analyzing...' : 'Analyze Contract'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Analysis Results */}
      {analysis && (
        <>
          {/* Overview Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="glass-card rounded-xl p-4">
              <p className="text-xs text-slate-500 mb-1">Risk Score</p>
              <p className={`text-3xl font-bold ${riskScoreColor(analysis.riskScore)}`}>{analysis.riskScore}<span className="text-sm">/100</span></p>
            </div>
            <div className="glass-card rounded-xl p-4">
              <p className="text-xs text-slate-500 mb-1">Red Flags</p>
              <p className="text-3xl font-bold text-red-400">{analysis.redFlags.length}</p>
            </div>
            <div className="glass-card rounded-xl p-4">
              <p className="text-xs text-slate-500 mb-1">Missing Clauses</p>
              <p className="text-3xl font-bold text-amber-400">{analysis.missingClauses.length}</p>
            </div>
            <div className="glass-card rounded-xl p-4">
              <p className="text-xs text-slate-500 mb-1">Sections</p>
              <p className="text-3xl font-bold text-white">{analysis.sections.length}</p>
            </div>
          </div>

          {/* Contract Header */}
          <div className="glass-card rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white">{analysis.title}</h2>
                <div className="flex items-center gap-3 mt-1 text-sm text-slate-400">
                  <span>{analysis.contractType}</span>
                  <span>•</span>
                  <span>{analysis.governingLaw}</span>
                  {analysis.effectiveDate && <><span>•</span><span>Effective: {analysis.effectiveDate}</span></>}
                </div>
                <div className="flex gap-2 mt-2">
                  {analysis.parties.map((p, i) => (
                    <span key={i} className="px-2 py-0.5 rounded text-xs bg-slate-800 text-slate-400">
                      {p.name} ({p.role})
                    </span>
                  ))}
                </div>
              </div>
              <div className={`px-3 py-1.5 rounded-lg border ${riskColor(analysis.overallRisk)} text-sm font-semibold uppercase`}>
                {analysis.overallRisk} Risk
              </div>
            </div>
          </div>

          {/* View Tabs */}
          <div className="flex gap-1">
            {[
              { id: 'summary', label: 'Summary', icon: BookOpen },
              { id: 'sections', label: `Sections (${analysis.sections.length})`, icon: FileText },
              { id: 'redflags', label: `Red Flags (${analysis.redFlags.length})`, icon: AlertTriangle },
              { id: 'financial', label: 'Financial Terms', icon: DollarSign },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setViewMode(tab.id as any)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm ${
                  viewMode === tab.id ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30' : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <tab.icon size={14} />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="glass-card rounded-xl p-6">
            {viewMode === 'summary' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Executive Summary</h3>
                  <p className="text-sm text-slate-300 whitespace-pre-line">{analysis.executiveSummary}</p>
                </div>

                {analysis.recommendations.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-amber-400 uppercase tracking-wider mb-3">📋 Recommended Actions</h3>
                    <ol className="space-y-2">
                      {analysis.recommendations.map((r, i) => (
                        <li key={i} className="flex items-start gap-3 text-sm text-slate-300">
                          <span className="w-6 h-6 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs flex items-center justify-center shrink-0 font-bold">{i + 1}</span>
                          {r}
                        </li>
                      ))}
                    </ol>
                  </div>
                )}

                {analysis.missingClauses.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-red-400 uppercase tracking-wider mb-3">⚠️ Missing Clauses</h3>
                    <ul className="space-y-1.5">
                      {analysis.missingClauses.map((c, i) => (
                        <li key={i} className="text-sm text-red-300/80 flex items-start gap-2">
                          <XCircle size={14} className="text-red-400 mt-0.5 shrink-0" /> {c}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {analysis.keyTerms.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Key Defined Terms</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {analysis.keyTerms.map((t, i) => (
                        <div key={i} className="p-3 rounded-lg bg-slate-800/50">
                          <p className="text-xs font-semibold text-white">{t.term}</p>
                          <p className="text-xs text-slate-400 mt-1">{t.definition}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <button
                  onClick={() => { setAnalysis(null); setContractText(''); }}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm"
                >
                  ← Analyze Another Contract
                </button>
              </div>
            )}

            {viewMode === 'sections' && (
              <div className="space-y-3">
                {analysis.sections.map((section, i) => (
                  <div key={i} className="rounded-lg border border-slate-800 overflow-hidden">
                    <div
                      className="flex items-center gap-3 p-3 cursor-pointer hover:bg-slate-800/30"
                      onClick={() => setExpandedSection(expandedSection === section.sectionNumber ? null : section.sectionNumber)}
                    >
                      <span className={`w-2 h-2 rounded-full ${section.risk === 'high' ? 'bg-red-400' : section.risk === 'moderate' ? 'bg-amber-400' : 'bg-green-400'}`} />
                      <span className="text-xs text-slate-500 font-mono">{section.sectionNumber}</span>
                      <span className="text-sm font-medium text-white flex-1">{section.title}</span>
                      <span className={`px-2 py-0.5 rounded text-xs border ${riskColor(section.risk)}`}>{section.risk}</span>
                      {expandedSection === section.sectionNumber ? <ChevronDown size={14} className="text-slate-500" /> : <ChevronRight size={14} className="text-slate-500" />}
                    </div>
                    {expandedSection === section.sectionNumber && (
                      <div className="p-3 pt-0 space-y-2 border-t border-slate-800">
                        <p className="text-sm text-slate-300">{section.summary}</p>
                        {section.issues.length > 0 && (
                          <div>
                            <p className="text-xs text-amber-400 font-semibold mb-1">Issues:</p>
                            {section.issues.map((issue, j) => (
                              <p key={j} className="text-xs text-amber-300/80 flex items-start gap-1.5 ml-2">
                                <AlertTriangle size={10} className="mt-0.5 shrink-0" /> {issue}
                              </p>
                            ))}
                          </div>
                        )}
                        {section.suggestedRevisions && (
                          <div className="p-2 rounded bg-slate-800/50">
                            <p className="text-xs text-green-400 font-semibold mb-1 flex items-center gap-1"><Edit3 size={10} /> Suggested Revision:</p>
                            <p className="text-xs text-green-300/80">{section.suggestedRevisions}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {viewMode === 'redflags' && (
              <div className="space-y-3">
                {analysis.redFlags.length === 0 ? (
                  <div className="text-center py-8">
                    <CheckCircle size={48} className="mx-auto text-green-400 mb-4" />
                    <p className="text-lg font-semibold text-white">No Red Flags Found</p>
                    <p className="text-sm text-slate-400">This contract appears to be well-drafted.</p>
                  </div>
                ) : (
                  analysis.redFlags.map((flag, i) => (
                    <div key={i} className={`p-4 rounded-lg border ${riskColor(flag.severity)}`}>
                      <div className="flex items-center gap-2 mb-2">
                        {flag.severity === 'critical' ? <XCircle size={16} /> : flag.severity === 'danger' ? <AlertTriangle size={16} /> : <Info size={16} />}
                        <span className="text-sm font-semibold uppercase">{flag.severity}</span>
                      </div>
                      <div className="p-2 rounded bg-slate-900/50 mb-2">
                        <p className="text-xs font-mono text-slate-300">"{flag.clause}"</p>
                      </div>
                      <p className="text-sm text-slate-300 mb-2"><strong>Issue:</strong> {flag.issue}</p>
                      <p className="text-sm text-green-300/80 mb-1"><strong>Recommendation:</strong> {flag.recommendation}</p>
                      <p className="text-xs text-slate-500 font-mono">{flag.legalBasis}</p>
                    </div>
                  ))
                )}
              </div>
            )}

            {viewMode === 'financial' && (
              <div className="space-y-3">
                {analysis.financialTerms.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-8">No financial terms identified in this contract.</p>
                ) : (
                  analysis.financialTerms.map((term, i) => (
                    <div key={i} className="flex items-center justify-between p-4 rounded-lg bg-slate-800/50 border border-slate-700">
                      <div>
                        <p className="text-sm font-medium text-white">{term.description}</p>
                        <p className="text-xs text-slate-400">{term.frequency}</p>
                      </div>
                      <span className="text-lg font-bold text-green-400">{term.amount}</span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default ContractReview;
