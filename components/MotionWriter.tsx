import React, { useState, useContext, useEffect, useRef } from 'react';
import { AppContext } from '../App';
import { useKnowledge } from '../contexts/KnowledgeContext';
import {
  FileText, Sparkles, Download, Copy, Check, AlertCircle, Loader2,
  ChevronRight, Scale, FileSearch, BookOpen, Gavel, Building,
  User, Calendar, Hash, ArrowRight, RefreshCw, Printer, Eye,
} from 'lucide-react';
import { callGeminiProxy } from '../services/apiProxy';
import { toast } from 'react-toastify';
import { trackAICompletion } from '../services/roiIntegration';

/* ─── Document Types ───────────────────────────────────────── */

type CourtDocType =
  | 'motion-to-dismiss'
  | 'motion-for-summary-judgment'
  | 'motion-to-suppress'
  | 'motion-in-limine'
  | 'motion-for-tro'
  | 'motion-to-compel'
  | 'complaint-1983'
  | 'complaint-general'
  | 'answer'
  | 'memorandum-of-law'
  | 'opposition-brief'
  | 'reply-brief'
  | 'demand-letter'
  | 'appellate-brief'
  | 'habeas-petition';

interface DocTypeOption {
  id: CourtDocType;
  label: string;
  description: string;
  category: 'Motions' | 'Pleadings' | 'Briefs' | 'Pre-Litigation' | 'Appeals';
  estimatedPages: string;
  billingEquivalent: string;
}

const DOC_TYPES: DocTypeOption[] = [
  // Motions
  { id: 'motion-to-dismiss', label: 'Motion to Dismiss', description: 'Dismiss claims under FRCP 12(b)(6) for failure to state a claim', category: 'Motions', estimatedPages: '8-15', billingEquivalent: '$2,500-5,000' },
  { id: 'motion-for-summary-judgment', label: 'Motion for Summary Judgment', description: 'Dispose of case without trial under FRCP 56', category: 'Motions', estimatedPages: '15-30', billingEquivalent: '$5,000-15,000' },
  { id: 'motion-to-suppress', label: 'Motion to Suppress', description: 'Exclude illegally obtained evidence (4th Amendment)', category: 'Motions', estimatedPages: '8-12', billingEquivalent: '$2,000-4,000' },
  { id: 'motion-in-limine', label: 'Motion in Limine', description: 'Exclude prejudicial evidence before trial', category: 'Motions', estimatedPages: '5-10', billingEquivalent: '$1,500-3,000' },
  { id: 'motion-for-tro', label: 'Emergency TRO / Preliminary Injunction', description: 'Emergency restraining order under FRCP 65', category: 'Motions', estimatedPages: '10-20', billingEquivalent: '$3,000-8,000' },
  { id: 'motion-to-compel', label: 'Motion to Compel Discovery', description: 'Force opposing party to respond to discovery', category: 'Motions', estimatedPages: '5-10', billingEquivalent: '$1,500-3,000' },
  // Pleadings
  { id: 'complaint-1983', label: 'Federal Civil Rights Complaint (§1983)', description: 'Federal complaint for constitutional violations under 42 U.S.C. §1983', category: 'Pleadings', estimatedPages: '15-30', billingEquivalent: '$5,000-12,000' },
  { id: 'complaint-general', label: 'General Civil Complaint', description: 'State or federal civil complaint', category: 'Pleadings', estimatedPages: '10-20', billingEquivalent: '$3,000-8,000' },
  { id: 'answer', label: 'Answer to Complaint', description: 'Respond to complaint with admissions, denials, and affirmative defenses', category: 'Pleadings', estimatedPages: '5-12', billingEquivalent: '$2,000-4,000' },
  // Briefs
  { id: 'memorandum-of-law', label: 'Memorandum of Law', description: 'Comprehensive legal analysis supporting a motion', category: 'Briefs', estimatedPages: '10-25', billingEquivalent: '$3,000-8,000' },
  { id: 'opposition-brief', label: 'Opposition Brief', description: 'Oppose the opposing party\'s motion', category: 'Briefs', estimatedPages: '10-20', billingEquivalent: '$3,000-7,000' },
  { id: 'reply-brief', label: 'Reply Brief', description: 'Reply to opposition\'s arguments', category: 'Briefs', estimatedPages: '5-10', billingEquivalent: '$1,500-3,000' },
  // Pre-Litigation
  { id: 'demand-letter', label: 'Demand Letter', description: 'Pre-litigation demand for settlement', category: 'Pre-Litigation', estimatedPages: '3-6', billingEquivalent: '$1,000-2,500' },
  // Appeals
  { id: 'appellate-brief', label: 'Appellate Brief', description: 'Appeal to a higher court with legal arguments', category: 'Appeals', estimatedPages: '20-50', billingEquivalent: '$10,000-25,000' },
  { id: 'habeas-petition', label: 'Habeas Corpus Petition', description: 'Challenge unlawful detention (28 U.S.C. §2254/§2241)', category: 'Appeals', estimatedPages: '15-30', billingEquivalent: '$5,000-12,000' },
];

const CATEGORIES = ['All', 'Motions', 'Pleadings', 'Briefs', 'Pre-Litigation', 'Appeals'];

/* ─── Court Formatting Rules ───────────────────────────────── */

interface CourtConfig {
  court: string;
  jurisdiction: string;
  division?: string;
  caseNumber?: string;
  judge?: string;
}

const COURT_FORMAT_INSTRUCTIONS = `
FORMAT REQUIREMENTS — The document must look like a real court filing:

1. CAPTION: Full court caption block with:
   - Court name (centered, caps)
   - Plaintiff(s) v. Defendant(s) 
   - Case No. (if provided)
   - Judge (if provided)
   - Document title (centered, bold, caps)

2. STRUCTURE: Follow standard legal document structure:
   - Table of Contents (for docs >10 pages)
   - Table of Authorities (for briefs/memos)
   - Introduction / Preliminary Statement
   - Statement of Facts (chronological, cite record)
   - Legal Standard / Standard of Review
   - Argument (numbered sections with headings)
   - Conclusion
   - Certificate of Service
   - Signature Block

3. CITATIONS: Use proper Bluebook citation format:
   - Cases: Party v. Party, Vol. Reporter Page (Court Year)
   - Statutes: Title U.S.C. § Section
   - Rules: Fed. R. Civ. P. Rule
   - Use "Id." for immediate repeat, "supra" for earlier cited works
   - Include pinpoint citations where possible

4. FORMATTING:
   - Number all paragraphs in factual sections
   - Use proper section headings (I, A, 1, a)
   - Bold key legal conclusions
   - Use block quotes for quotes >50 words
   - Double-space the body text (indicate with formatting)

5. LEGAL WRITING STYLE:
   - Lead with your strongest argument
   - State the rule, then apply facts to law
   - Address potential counterarguments
   - Be persuasive but maintain credibility
   - Use active voice, avoid legalese where possible
`;

/* ─── Main Component ──────────────────────────────────────── */

const MotionWriter: React.FC = () => {
  const { activeCase, cases } = useContext(AppContext);
  const { getKnowledgeContext, ingestDocument } = useKnowledge();

  // Step management
  const [step, setStep] = useState<'select' | 'configure' | 'generating' | 'review'>('select');
  const [selectedDoc, setSelectedDoc] = useState<CourtDocType | null>(null);
  const [selectedCategory, setSelectedCategory] = useState('All');

  // Configuration
  const [courtConfig, setCourtConfig] = useState<CourtConfig>({
    court: '',
    jurisdiction: '',
    division: '',
    caseNumber: '',
    judge: activeCase?.judge || '',
  });
  const [additionalFacts, setAdditionalFacts] = useState('');
  const [legalTheories, setLegalTheories] = useState('');
  const [opposingArgs, setOpposingArgs] = useState('');
  const [tone, setTone] = useState<'aggressive' | 'measured' | 'scholarly'>('measured');

  // Generation
  const [generatedDoc, setGeneratedDoc] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const startTimeRef = useRef(0);

  // Auto-fill court info from active case
  useEffect(() => {
    if (activeCase) {
      setCourtConfig(prev => ({
        ...prev,
        judge: activeCase.judge || prev.judge,
      }));
    }
  }, [activeCase]);

  const selectedDocType = DOC_TYPES.find(d => d.id === selectedDoc);
  const filteredDocs = selectedCategory === 'All'
    ? DOC_TYPES
    : DOC_TYPES.filter(d => d.category === selectedCategory);

  /* ── Generate Document ── */
  const handleGenerate = async () => {
    if (!selectedDoc || !selectedDocType) return;

    setStep('generating');
    setIsGenerating(true);
    setError('');
    setProgress(0);
    startTimeRef.current = Date.now();

    // Simulate progress steps
    const progressSteps = [
      { pct: 10, label: 'Analyzing case facts...' },
      { pct: 25, label: 'Researching applicable law...' },
      { pct: 40, label: 'Identifying controlling precedent...' },
      { pct: 55, label: 'Drafting legal arguments...' },
      { pct: 70, label: 'Formatting court document...' },
      { pct: 85, label: 'Adding citations & authorities...' },
      { pct: 95, label: 'Final review & polish...' },
    ];

    let stepIdx = 0;
    const progressInterval = setInterval(() => {
      if (stepIdx < progressSteps.length) {
        setProgress(progressSteps[stepIdx].pct);
        setProgressLabel(progressSteps[stepIdx].label);
        stepIdx++;
      }
    }, 3000);

    try {
      const knowledgeContext = activeCase?.id ? getKnowledgeContext(activeCase.id) : '';

      const caseContext = activeCase
        ? `CASE INFORMATION:
- Case Title: ${activeCase.title}
- Client: ${activeCase.client}
- Case Type: ${activeCase.caseType || 'Civil'}
- Summary: ${activeCase.summary}
- Opposing Counsel: ${activeCase.opposingCounsel || 'Unknown'}
- Judge: ${courtConfig.judge || activeCase.judge || 'TBD'}
- Key Facts: ${activeCase.keyFacts?.join('; ') || 'See summary'}
- Evidence: ${activeCase.evidence?.map((e: any) => e.description || e.title).join('; ') || 'See case file'}`
        : 'No active case — generate with placeholder facts.';

      const courtSection = courtConfig.court
        ? `COURT: ${courtConfig.court}
JURISDICTION: ${courtConfig.jurisdiction}
${courtConfig.division ? `DIVISION: ${courtConfig.division}` : ''}
${courtConfig.caseNumber ? `CASE NO.: ${courtConfig.caseNumber}` : ''}
${courtConfig.judge ? `JUDGE: ${courtConfig.judge}` : ''}`
        : '';

      const prompt = `You are a senior litigation attorney with 20+ years of federal court experience. Generate a COMPLETE, COURT-READY ${selectedDocType.label.toUpperCase()} that is ready to file.

${caseContext}

${courtSection}

${additionalFacts ? `ADDITIONAL FACTS:\n${additionalFacts}` : ''}
${legalTheories ? `LEGAL THEORIES TO DEVELOP:\n${legalTheories}` : ''}
${opposingArgs ? `ANTICIPATED OPPOSING ARGUMENTS TO ADDRESS:\n${opposingArgs}` : ''}

TONE: ${tone === 'aggressive' ? 'Aggressive and forceful — challenge every point' : tone === 'scholarly' ? 'Scholarly and academic — heavy on analysis and precedent' : 'Measured and professional — persuasive but restrained'}

${COURT_FORMAT_INSTRUCTIONS}

${knowledgeContext ? `CASE KNOWLEDGE BASE:\n${knowledgeContext}\n` : ''}

CRITICAL: Generate the COMPLETE document from start to finish. Do NOT abbreviate, summarize, or use "[continue here]" placeholders. Every section must be fully written with substantive legal analysis. This should be ${selectedDocType.estimatedPages} pages when properly formatted. Include REAL, applicable case law citations from federal and state courts. The attorney should be able to review this, make minor edits, and file it.`;

      const response = await callGeminiProxy({
        prompt,
        model: 'gemini-2.5-flash',
        options: {
          temperature: tone === 'aggressive' ? 0.8 : tone === 'scholarly' ? 0.5 : 0.65,
          maxOutputTokens: 16384,
        },
      });

      clearInterval(progressInterval);

      if (!response.success) throw new Error(response.error?.message || 'Generation failed');

      const text = response.text || '';
      if (text.length < 500) throw new Error('Generated document is too short. Please try again.');

      setGeneratedDoc(text);
      setProgress(100);
      setProgressLabel('Complete!');
      setStep('review');

      const elapsed = Math.round((Date.now() - startTimeRef.current) / 1000);
      trackAICompletion('Motion Writer', `Generated ${selectedDocType.label}`, {
        caseId: activeCase?.id,
        caseName: activeCase?.title,
        taskType: 'document_drafting',
        startTime: startTimeRef.current,
      });

      toast.success(`${selectedDocType.label} generated in ${elapsed}s!`);

      // Ingest into knowledge base
      if (activeCase?.id && text) {
        try {
          await ingestDocument(activeCase.id, {
            text,
            fileName: `${selectedDocType.label} (Generated)`,
            analysis: { summary: text.substring(0, 500) + '...' },
          });
        } catch (e) {
          console.warn('[MotionWriter] Ingest failed:', e);
        }
      }
    } catch (err: any) {
      clearInterval(progressInterval);
      setError(err.message || 'Generation failed');
      setStep('configure');
      toast.error('Document generation failed. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  /* ── Export ── */
  const handleCopy = () => {
    navigator.clipboard.writeText(generatedDoc);
    setCopied(true);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadTxt = () => {
    const blob = new Blob([generatedDoc], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedDocType?.label || 'document'}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head>
          <title>${selectedDocType?.label || 'Legal Document'}</title>
          <style>
            body { font-family: 'Times New Roman', serif; font-size: 14px; line-height: 2; margin: 1in; color: #000; }
            h1, h2, h3 { font-family: 'Times New Roman', serif; }
            pre { white-space: pre-wrap; font-family: 'Times New Roman', serif; font-size: 14px; line-height: 2; }
          </style>
        </head>
        <body><pre>${generatedDoc}</pre></body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  /* ── Render ── */
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-white font-serif">
          Motion &amp; Brief Writer
        </h1>
        <p className="text-slate-400 mt-1 text-sm">
          Generate complete, court-ready legal documents with proper formatting and citations
        </p>
      </div>

      {/* Breadcrumb Steps */}
      <div className="flex items-center gap-2 text-sm">
        {['Select Document', 'Configure', 'Generate', 'Review & Export'].map((label, i) => {
          const stepIdx = ['select', 'configure', 'generating', 'review'].indexOf(step);
          const isActive = i === stepIdx;
          const isDone = i < stepIdx;
          return (
            <React.Fragment key={label}>
              {i > 0 && <ChevronRight size={14} className="text-slate-600" />}
              <span
                className={`px-3 py-1 rounded-full ${
                  isActive
                    ? 'bg-gold-500 text-slate-900 font-semibold'
                    : isDone
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : 'bg-slate-800 text-slate-500'
                }`}
              >
                {label}
              </span>
            </React.Fragment>
          );
        })}
      </div>

      {/* ── STEP 1: Select Document Type ── */}
      {step === 'select' && (
        <>
          {/* Category Filter */}
          <div className="flex gap-2 flex-wrap">
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  selectedCategory === cat
                    ? 'bg-gold-500 text-slate-900'
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Document Type Cards */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredDocs.map(doc => (
              <button
                key={doc.id}
                onClick={() => {
                  setSelectedDoc(doc.id);
                  setStep('configure');
                }}
                className="bg-slate-800 border border-slate-700 rounded-xl p-4 text-left hover:border-gold-500/50 hover:bg-slate-750 transition-all group"
              >
                <div className="flex items-start justify-between mb-2">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-slate-700 text-slate-400">
                    {doc.category}
                  </span>
                  <ArrowRight size={16} className="text-slate-600 group-hover:text-gold-500 transition-colors" />
                </div>
                <h3 className="text-white font-semibold mt-2">{doc.label}</h3>
                <p className="text-slate-400 text-sm mt-1">{doc.description}</p>
                <div className="flex items-center gap-4 mt-3 text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                    <FileText size={12} />
                    {doc.estimatedPages} pages
                  </span>
                  <span className="flex items-center gap-1 text-emerald-500">
                    💰 {doc.billingEquivalent}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      {/* ── STEP 2: Configure ── */}
      {step === 'configure' && selectedDocType && (
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main Config */}
          <div className="lg:col-span-2 space-y-6">
            {/* Document Info */}
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-bold text-white">{selectedDocType.label}</h2>
                  <p className="text-sm text-slate-400">{selectedDocType.description}</p>
                </div>
                <button
                  onClick={() => { setStep('select'); setSelectedDoc(null); }}
                  className="text-xs text-slate-500 hover:text-white"
                >
                  Change
                </button>
              </div>

              {/* Case Selection */}
              {activeCase ? (
                <div className="bg-slate-900 rounded-lg p-3 flex items-center gap-3">
                  <Gavel size={18} className="text-gold-500" />
                  <div>
                    <p className="text-sm text-white font-medium">{activeCase.title}</p>
                    <p className="text-xs text-slate-500">Client: {activeCase.client}</p>
                  </div>
                </div>
              ) : (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 flex items-center gap-2">
                  <AlertCircle size={16} className="text-amber-400" />
                  <p className="text-sm text-amber-300">
                    No case selected — document will use placeholder facts.
                  </p>
                </div>
              )}
            </div>

            {/* Court Information */}
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
              <h3 className="text-sm font-bold text-slate-400 uppercase mb-4 flex items-center gap-2">
                <Building size={16} />
                Court Information
              </h3>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Court Name</label>
                  <input
                    type="text"
                    value={courtConfig.court}
                    onChange={e => setCourtConfig(p => ({ ...p, court: e.target.value }))}
                    placeholder="e.g. U.S. District Court, Northern District of Mississippi"
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Jurisdiction</label>
                  <input
                    type="text"
                    value={courtConfig.jurisdiction}
                    onChange={e => setCourtConfig(p => ({ ...p, jurisdiction: e.target.value }))}
                    placeholder="e.g. Federal / Mississippi State"
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Case Number</label>
                  <input
                    type="text"
                    value={courtConfig.caseNumber}
                    onChange={e => setCourtConfig(p => ({ ...p, caseNumber: e.target.value }))}
                    placeholder="e.g. 3:26-cv-00123"
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Assigned Judge</label>
                  <input
                    type="text"
                    value={courtConfig.judge}
                    onChange={e => setCourtConfig(p => ({ ...p, judge: e.target.value }))}
                    placeholder="e.g. Hon. Michael P. Mills"
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Legal Arguments */}
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
              <h3 className="text-sm font-bold text-slate-400 uppercase mb-4 flex items-center gap-2">
                <Scale size={16} />
                Legal Arguments &amp; Facts
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">
                    Additional Facts / Evidence to Include
                  </label>
                  <textarea
                    value={additionalFacts}
                    onChange={e => setAdditionalFacts(e.target.value)}
                    placeholder="Describe key facts, evidence, dates, witness statements to incorporate..."
                    rows={4}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm resize-y"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">
                    Legal Theories / Arguments to Develop
                  </label>
                  <textarea
                    value={legalTheories}
                    onChange={e => setLegalTheories(e.target.value)}
                    placeholder="e.g. First Amendment retaliation, qualified immunity doesn't apply, deliberate indifference..."
                    rows={3}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm resize-y"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">
                    Anticipated Opposing Arguments
                  </label>
                  <textarea
                    value={opposingArgs}
                    onChange={e => setOpposingArgs(e.target.value)}
                    placeholder="What will the other side argue? The AI will preemptively address these."
                    rows={3}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm resize-y"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Tone Selection */}
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
              <h3 className="text-sm font-bold text-slate-400 uppercase mb-3">Writing Tone</h3>
              {([
                { value: 'aggressive' as const, label: 'Aggressive', desc: 'Forceful, challenge every point' },
                { value: 'measured' as const, label: 'Measured', desc: 'Professional, persuasive, restrained' },
                { value: 'scholarly' as const, label: 'Scholarly', desc: 'Heavy on precedent & analysis' },
              ]).map(t => (
                <button
                  key={t.value}
                  onClick={() => setTone(t.value)}
                  className={`w-full text-left p-3 rounded-lg mb-2 transition-colors ${
                    tone === t.value
                      ? 'bg-gold-500/20 border border-gold-500/50 text-white'
                      : 'bg-slate-900 border border-slate-700 text-slate-400 hover:text-white'
                  }`}
                >
                  <p className="text-sm font-medium">{t.label}</p>
                  <p className="text-xs text-slate-500">{t.desc}</p>
                </button>
              ))}
            </div>

            {/* Value Card */}
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-5">
              <h3 className="text-sm font-bold text-emerald-400 mb-2">💰 Value Generated</h3>
              <p className="text-2xl font-bold text-white">{selectedDocType.billingEquivalent}</p>
              <p className="text-xs text-slate-400 mt-1">
                What a firm would bill for this document
              </p>
              <p className="text-xs text-emerald-400 mt-2">
                CaseBuddy generates it in ~30 seconds
              </p>
            </div>

            {/* Generate Button */}
            <button
              onClick={handleGenerate}
              className="w-full bg-gold-500 hover:bg-gold-600 text-slate-900 font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-colors"
            >
              <Sparkles size={18} />
              Generate {selectedDocType.label}
            </button>

            <button
              onClick={() => { setStep('select'); setSelectedDoc(null); }}
              className="w-full text-slate-500 hover:text-white text-sm py-2 transition-colors"
            >
              ← Back to document selection
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 3: Generating ── */}
      {step === 'generating' && (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-full max-w-md">
            <div className="flex items-center gap-3 mb-6">
              <Loader2 className="animate-spin text-gold-500" size={24} />
              <div>
                <p className="text-white font-semibold">
                  Generating {selectedDocType?.label}...
                </p>
                <p className="text-sm text-slate-400">{progressLabel}</p>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="h-3 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-gold-500 to-amber-400 rounded-full transition-all duration-1000"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs text-slate-500 mt-2 text-center">{progress}%</p>

            <div className="mt-8 grid grid-cols-3 gap-4">
              {[
                { icon: FileSearch, label: 'Researching Law' },
                { icon: BookOpen, label: 'Citing Precedent' },
                { icon: Scale, label: 'Building Arguments' },
              ].map(({ icon: Icon, label }, i) => (
                <div
                  key={label}
                  className={`bg-slate-800 rounded-lg p-3 text-center transition-opacity ${
                    progress > (i + 1) * 25 ? 'opacity-100' : 'opacity-30'
                  }`}
                >
                  <Icon size={20} className="mx-auto mb-1 text-gold-500" />
                  <p className="text-xs text-slate-400">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── STEP 4: Review & Export ── */}
      {step === 'review' && (
        <div className="grid lg:grid-cols-4 gap-6">
          {/* Document View */}
          <div className="lg:col-span-3">
            <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
              {/* Toolbar */}
              <div className="flex items-center justify-between p-3 border-b border-slate-700 bg-slate-900">
                <div className="flex items-center gap-2">
                  <FileText size={16} className="text-gold-500" />
                  <span className="text-sm font-semibold text-white">
                    {selectedDocType?.label}
                  </span>
                  <span className="text-xs text-slate-500">
                    ({Math.round(generatedDoc.length / 3000)} est. pages)
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-300 transition-colors"
                  >
                    {copied ? <Check size={13} /> : <Copy size={13} />}
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                  <button
                    onClick={handleDownloadTxt}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-300 transition-colors"
                  >
                    <Download size={13} />
                    Download
                  </button>
                  <button
                    onClick={handlePrint}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-300 transition-colors"
                  >
                    <Printer size={13} />
                    Print
                  </button>
                </div>
              </div>

              {/* Document Content */}
              <div className="p-6 max-h-[70vh] overflow-y-auto">
                <div className="prose prose-invert max-w-none">
                  <pre className="whitespace-pre-wrap font-serif text-sm text-slate-200 leading-relaxed">
                    {generatedDoc}
                  </pre>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar Actions */}
          <div className="space-y-4">
            {/* Stats */}
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
              <h3 className="text-sm font-bold text-slate-400 uppercase mb-3">Document Stats</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">Words</span>
                  <span className="text-white font-medium">
                    {generatedDoc.split(/\s+/).length.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Characters</span>
                  <span className="text-white font-medium">
                    {generatedDoc.length.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Est. Pages</span>
                  <span className="text-white font-medium">
                    {Math.round(generatedDoc.length / 3000)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Generated in</span>
                  <span className="text-white font-medium">
                    {Math.round((Date.now() - startTimeRef.current) / 1000)}s
                  </span>
                </div>
              </div>
            </div>

            {/* Value */}
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4">
              <p className="text-xs text-slate-400">Equivalent billing value</p>
              <p className="text-xl font-bold text-emerald-400">
                {selectedDocType?.billingEquivalent}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Generated by AI in seconds
              </p>
            </div>

            {/* Actions */}
            <button
              onClick={() => {
                setGeneratedDoc('');
                handleGenerate();
              }}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm text-white transition-colors"
            >
              <RefreshCw size={14} />
              Regenerate
            </button>

            <button
              onClick={() => {
                setStep('select');
                setSelectedDoc(null);
                setGeneratedDoc('');
                setAdditionalFacts('');
                setLegalTheories('');
                setOpposingArgs('');
              }}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gold-500 hover:bg-gold-600 rounded-lg text-sm text-slate-900 font-semibold transition-colors"
            >
              <FileText size={14} />
              New Document
            </button>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-center gap-3">
          <AlertCircle className="text-red-400" size={20} />
          <p className="text-sm text-red-300">{error}</p>
        </div>
      )}
    </div>
  );
};

export default MotionWriter;
