import React, { useState, useRef, useContext, useCallback } from 'react';
import { AppContext } from '../App';
import {
  ScanLine, Upload, FileText, CheckCircle2, AlertCircle, Loader2,
  Clock, Users, ListTodo, Lightbulb, ChevronDown, ChevronRight,
  Trash2, X, CalendarDays, Tag, Eye, Plus
} from 'lucide-react';
import { validateFile } from '../utils/fileValidation';
import { performDocumentOCR } from '../services/ocrService';
import { extractDocumentInsights } from '../services/geminiService';
import { DocumentInsights, DocumentType, EvidenceItem, TimelineEvent, Witness, CaseTask } from '../types';
import { toast } from 'react-toastify';

type DocStage = 'queued' | 'ocr' | 'analyzing' | 'done' | 'error';

interface QueuedDoc {
  id: string;
  file: File;
  stage: DocStage;
  progress: number;
  ocrText?: string;
  insights?: DocumentInsights;
  errorMsg?: string;
}

const StageBadge = ({ stage }: { stage: DocStage }) => {
  const config = {
    queued:    { label: 'Queued',    cls: 'bg-slate-700 text-slate-400' },
    ocr:       { label: 'OCR…',     cls: 'bg-blue-500/20 text-blue-400 animate-pulse' },
    analyzing: { label: 'AI Analysis…', cls: 'bg-gold-500/20 text-gold-400 animate-pulse' },
    done:      { label: 'Complete', cls: 'bg-green-500/20 text-green-400' },
    error:     { label: 'Error',    cls: 'bg-red-500/20 text-red-400' },
  }[stage];
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${config.cls}`}>
      {config.label}
    </span>
  );
};

const ProgressBar = ({ value, stage }: { value: number; stage: DocStage }) => {
  const colorClass =
    stage === 'done'  ? 'bg-green-500' :
    stage === 'error' ? 'bg-red-500' :
    'bg-gold-500';
  return (
    <div className="h-1 bg-slate-700 rounded-full overflow-hidden mt-2">
      <div
        className={`h-full rounded-full transition-all duration-500 ${colorClass}`}
        style={{ width: `${value}%` }}
      />
    </div>
  );
};

interface DiscoveryLensProps {
  embedded?: boolean; // true when rendered inside AICoCounsel
}

const DiscoveryLens: React.FC<DiscoveryLensProps> = ({ embedded = false }) => {
  const { activeCase, updateCase } = useContext(AppContext);
  const [docs, setDocs] = useState<QueuedDoc[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showPopulatePreview, setShowPopulatePreview] = useState(false);
  const [isPopulating, setIsPopulating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Aggregate all successful insights ──────────────────────────────────────
  const allInsights = docs.filter(d => d.stage === 'done' && d.insights).map(d => d.insights!);

  const aggregated = {
    timelineEvents: allInsights.flatMap(i => i.timelineEvents),
    witnesses: allInsights.flatMap(i => i.witnesses),
    evidenceItems: allInsights.flatMap(i => i.evidenceItems),
    tasks: allInsights.flatMap(i => i.tasks),
    keyFacts: allInsights.flatMap(i => i.keyFacts),
  };

  // ── Process a single file ───────────────────────────────────────────────────
  const processFile = useCallback(async (doc: QueuedDoc) => {
    const update = (patch: Partial<QueuedDoc>) =>
      setDocs(prev => prev.map(d => d.id === doc.id ? { ...d, ...patch } : d));

    // Stage 1: OCR
    update({ stage: 'ocr', progress: 10 });
    let ocrText = '';
    try {
      const result = await performDocumentOCR(doc.file, (p) => {
        update({ progress: 10 + Math.round(p * 0.4) });
      });
      ocrText = result.text;
      update({ ocrText, progress: 50 });
    } catch (err) {
      update({ stage: 'error', errorMsg: 'OCR failed', progress: 100 });
      return;
    }

    if (!ocrText.trim()) {
      update({ stage: 'error', errorMsg: 'No text extracted from document', progress: 100 });
      return;
    }

    // Stage 2: AI Analysis
    update({ stage: 'analyzing', progress: 55 });
    try {
      const caseContext = activeCase
        ? `${activeCase.title} — ${activeCase.summary || ''}`
        : 'Legal case document';
      const insights = await extractDocumentInsights(ocrText, caseContext);
      update({ stage: 'done', insights, progress: 100 });
    } catch (err) {
      update({ stage: 'error', errorMsg: 'AI analysis failed', progress: 100 });
    }
  }, [activeCase]);

  // ── Add files ───────────────────────────────────────────────────────────────
  const addFiles = useCallback((fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    const newDocs: QueuedDoc[] = [];

    for (const file of files) {
      const validation = validateFile(file);
      if (!validation.valid) {
        toast.error(`${file.name}: ${validation.error}`);
        continue;
      }
      const doc: QueuedDoc = {
        id: crypto.randomUUID(),
        file,
        stage: 'queued',
        progress: 0,
      };
      newDocs.push(doc);
    }

    if (newDocs.length === 0) return;
    setDocs(prev => [...prev, ...newDocs]);

    // Process sequentially to avoid overwhelming OCR
    const processSequentially = async () => {
      for (const doc of newDocs) {
        await processFile(doc);
      }
    };
    processSequentially();
  }, [processFile]);

  // ── Drag & Drop ─────────────────────────────────────────────────────────────
  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) addFiles(e.dataTransfer.files);
  }, [addFiles]);

  // ── Auto-populate case ──────────────────────────────────────────────────────
  const populateCase = useCallback(async () => {
    if (!activeCase) {
      toast.error('Select a case first.');
      return;
    }
    setIsPopulating(true);
    try {
      const now = new Date().toISOString();
      const caseId = activeCase.id;

      const newTimelineEvents: TimelineEvent[] = aggregated.timelineEvents.map(e => ({
        ...e,
        id: crypto.randomUUID(),
        type: (['incident','evidence','witness','filing','hearing','other'].includes(e.type)
          ? e.type : 'other') as TimelineEvent['type'],
        importance: (['low','medium','high','critical'].includes(e.importance)
          ? e.importance : 'medium') as TimelineEvent['importance'],
      }));

      const newWitnesses: Witness[] = aggregated.witnesses.map(w => ({
        ...w,
        id: crypto.randomUUID(),
        avatarUrl: '',
        credibilityScore: typeof w.credibilityScore === 'number' ? w.credibilityScore : 70,
      }));

      const newEvidence: EvidenceItem[] = aggregated.evidenceItems.map(e => ({
        ...e,
        id: crypto.randomUUID(),
        caseId,
        type: (Object.values(DocumentType).includes(e.type as DocumentType)
          ? e.type : DocumentType.EVIDENCE) as DocumentType,
        source: 'text' as const,
        keyEntities: e.keyEntities || [],
        risks: e.risks || [],
        addedAt: e.addedAt || now,
      }));

      // Also create evidence items for each processed document
      const docEvidence: EvidenceItem[] = docs
        .filter(d => d.stage === 'done')
        .map(d => ({
          id: crypto.randomUUID(),
          caseId,
          title: d.file.name,
          type: DocumentType.EVIDENCE,
          source: 'file' as const,
          summary: d.insights?.summary || '',
          keyEntities: d.insights?.keyFacts || [],
          risks: [],
          addedAt: now,
          fileName: d.file.name,
        }));

      const newTasks: CaseTask[] = aggregated.tasks.map(t => ({
        ...t,
        id: crypto.randomUUID(),
        caseId,
        status: 'open' as const,
        priority: (['low','medium','high'].includes(t.priority) ? t.priority : 'medium') as CaseTask['priority'],
      }));

      await updateCase(caseId, {
        timelineEvents: [...(activeCase.timelineEvents || []), ...newTimelineEvents],
        witnesses: [...(activeCase.witnesses || []), ...newWitnesses],
        evidence: [...(activeCase.evidence || []), ...newEvidence, ...docEvidence],
        tasks: [...(activeCase.tasks || []), ...newTasks],
      });

      toast.success(`Case updated: ${newTimelineEvents.length} events, ${newWitnesses.length} witnesses, ${newEvidence.length + docEvidence.length} evidence items, ${newTasks.length} tasks added.`);
      setShowPopulatePreview(false);
    } catch (err) {
      toast.error('Failed to populate case.');
    } finally {
      setIsPopulating(false);
    }
  }, [activeCase, aggregated, docs, updateCase]);

  const removeDoc = (id: string) => setDocs(prev => prev.filter(d => d.id !== id));
  const doneCount = docs.filter(d => d.stage === 'done').length;
  const processingCount = docs.filter(d => d.stage === 'ocr' || d.stage === 'analyzing').length;

  const headerClass = embedded
    ? 'px-4 py-3 border-b border-slate-800'
    : 'px-6 py-5 border-b border-slate-800';

  return (
    <div className={`flex flex-col h-full ${embedded ? '' : 'max-w-5xl mx-auto'}`}>
      {/* Header */}
      {!embedded && (
        <div className={`${headerClass} bg-slate-900 sticky top-0 z-10`}>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gold-500/10 border border-gold-500/20">
              <ScanLine size={22} className="text-gold-500" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">DiscoveryLens</h1>
              <p className="text-xs text-slate-400">AI-powered document intelligence — OCR &amp; analyze, then auto-populate your case</p>
            </div>
            {processingCount > 0 && (
              <div className="ml-auto flex items-center gap-2 text-sm text-gold-400">
                <Loader2 size={14} className="animate-spin" />
                Processing {processingCount} document{processingCount > 1 ? 's' : ''}…
              </div>
            )}
          </div>
        </div>
      )}

      <div className={`flex-1 overflow-y-auto ${embedded ? 'p-3' : 'p-6'} space-y-6`}>
        {/* No active case warning */}
        {!activeCase && (
          <div className="flex items-center gap-3 p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
            <AlertCircle size={18} className="text-amber-400 shrink-0" />
            <p className="text-sm text-amber-300">Select an active case from Case Files before uploading documents. Extracted data will be added to that case.</p>
          </div>
        )}

        {/* Drop Zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`
            relative flex flex-col items-center justify-center gap-3 p-10 rounded-2xl
            border-2 border-dashed cursor-pointer transition-all duration-200
            ${isDragging
              ? 'border-gold-500 bg-gold-500/5 scale-[1.01]'
              : 'border-slate-700 bg-slate-800/30 hover:border-slate-600 hover:bg-slate-800/50'}
          `}
        >
          <div className={`p-4 rounded-2xl transition-colors ${isDragging ? 'bg-gold-500/20' : 'bg-slate-800'}`}>
            <Upload size={28} className={isDragging ? 'text-gold-400' : 'text-slate-400'} />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-white">
              {isDragging ? 'Drop documents here' : 'Drag & drop documents'}
            </p>
            <p className="text-xs text-slate-500 mt-1">PDF, images, Word docs — multiple files supported</p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.png,.jpg,.jpeg,.tiff,.tif,.webp,.doc,.docx,.txt"
            className="hidden"
            onChange={(e) => e.target.files && addFiles(e.target.files)}
          />
        </div>

        {/* Document Queue */}
        {docs.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
                Document Queue ({docs.length})
              </h2>
              {doneCount > 0 && (
                <span className="text-xs text-green-400 flex items-center gap-1">
                  <CheckCircle2 size={12} />
                  {doneCount} analyzed
                </span>
              )}
            </div>

            {docs.map(doc => (
              <div key={doc.id} className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
                {/* Doc header row */}
                <div className="flex items-center gap-3 p-3">
                  <div className="p-2 rounded-lg bg-slate-700 shrink-0">
                    {doc.stage === 'done' ? (
                      <CheckCircle2 size={16} className="text-green-400" />
                    ) : doc.stage === 'error' ? (
                      <AlertCircle size={16} className="text-red-400" />
                    ) : (
                      <FileText size={16} className="text-slate-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{doc.file.name}</p>
                    <p className="text-xs text-slate-500">{(doc.file.size / 1024).toFixed(0)} KB</p>
                    <ProgressBar value={doc.progress} stage={doc.stage} />
                  </div>
                  <StageBadge stage={doc.stage} />
                  {doc.stage === 'done' && (
                    <button
                      onClick={() => setExpandedId(expandedId === doc.id ? null : doc.id)}
                      className="p-1.5 text-slate-400 hover:text-white transition-colors rounded-lg hover:bg-slate-700"
                    >
                      {expandedId === doc.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </button>
                  )}
                  {doc.stage !== 'ocr' && doc.stage !== 'analyzing' && (
                    <button
                      onClick={() => removeDoc(doc.id)}
                      className="p-1.5 text-slate-500 hover:text-red-400 transition-colors rounded-lg hover:bg-slate-700"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                {/* Expanded insights */}
                {expandedId === doc.id && doc.insights && (
                  <div className="border-t border-slate-700 p-4 space-y-3 bg-slate-900/50">
                    <p className="text-xs text-slate-400 leading-relaxed">{doc.insights.summary}</p>
                    {doc.insights.keyFacts.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-gold-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                          <Lightbulb size={11} /> Key Facts
                        </p>
                        <ul className="space-y-1">
                          {doc.insights.keyFacts.slice(0, 5).map((f, i) => (
                            <li key={i} className="text-xs text-slate-300 flex items-start gap-2">
                              <span className="text-gold-500 shrink-0 mt-0.5">•</span>
                              {f}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2 pt-1">
                      {doc.insights.timelineEvents.length > 0 && (
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/20">
                          <CalendarDays size={10} />
                          {doc.insights.timelineEvents.length} events
                        </span>
                      )}
                      {doc.insights.witnesses.length > 0 && (
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-purple-500/15 text-purple-400 border border-purple-500/20">
                          <Users size={10} />
                          {doc.insights.witnesses.length} witnesses
                        </span>
                      )}
                      {doc.insights.tasks.length > 0 && (
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/20">
                          <ListTodo size={10} />
                          {doc.insights.tasks.length} tasks
                        </span>
                      )}
                      {doc.insights.evidenceItems.length > 0 && (
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-green-500/15 text-green-400 border border-green-500/20">
                          <Tag size={10} />
                          {doc.insights.evidenceItems.length} evidence
                        </span>
                      )}
                    </div>
                    {doc.errorMsg && (
                      <p className="text-xs text-red-400">{doc.errorMsg}</p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Auto-Populate Panel */}
        {doneCount > 0 && activeCase && (
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-gold-500/20 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  <Plus size={14} className="text-gold-500" />
                  Auto-Populate Case
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Push all extracted data into <span className="text-gold-400 font-medium">{activeCase.title}</span>
                </p>
              </div>
              <button
                onClick={() => setShowPopulatePreview(!showPopulatePreview)}
                className="text-xs text-slate-400 hover:text-white transition-colors flex items-center gap-1"
              >
                <Eye size={12} />
                {showPopulatePreview ? 'Hide' : 'Preview'}
              </button>
            </div>

            {/* Summary chips */}
            <div className="px-5 pb-3 flex flex-wrap gap-2">
              {aggregated.timelineEvents.length > 0 && (
                <span className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/20">
                  <CalendarDays size={11} />
                  {aggregated.timelineEvents.length} timeline events
                </span>
              )}
              {aggregated.witnesses.length > 0 && (
                <span className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-purple-500/15 text-purple-400 border border-purple-500/20">
                  <Users size={11} />
                  {aggregated.witnesses.length} potential witnesses
                </span>
              )}
              {aggregated.evidenceItems.length > 0 && (
                <span className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-green-500/15 text-green-400 border border-green-500/20">
                  <Tag size={11} />
                  {aggregated.evidenceItems.length} evidence items
                </span>
              )}
              {aggregated.tasks.length > 0 && (
                <span className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/20">
                  <ListTodo size={11} />
                  {aggregated.tasks.length} tasks
                </span>
              )}
            </div>

            {/* Preview list */}
            {showPopulatePreview && (
              <div className="mx-5 mb-4 bg-slate-950/60 rounded-xl p-4 space-y-3 max-h-72 overflow-y-auto">
                {aggregated.timelineEvents.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-blue-400 mb-1.5 uppercase tracking-wider">Timeline Events</p>
                    <ul className="space-y-1">
                      {aggregated.timelineEvents.slice(0, 5).map((e, i) => (
                        <li key={i} className="text-xs text-slate-300 flex items-start gap-2">
                          <CalendarDays size={10} className="text-blue-400 shrink-0 mt-0.5" />
                          <span><span className="text-slate-500">{e.date}</span> — {e.title}</span>
                        </li>
                      ))}
                      {aggregated.timelineEvents.length > 5 && (
                        <li className="text-xs text-slate-500">+{aggregated.timelineEvents.length - 5} more…</li>
                      )}
                    </ul>
                  </div>
                )}
                {aggregated.witnesses.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-purple-400 mb-1.5 uppercase tracking-wider">Potential Witnesses</p>
                    <ul className="space-y-1">
                      {aggregated.witnesses.slice(0, 5).map((w, i) => (
                        <li key={i} className="text-xs text-slate-300 flex items-start gap-2">
                          <Users size={10} className="text-purple-400 shrink-0 mt-0.5" />
                          {w.name} — <span className="text-slate-500">{w.role}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {aggregated.keyFacts.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gold-500 mb-1.5 uppercase tracking-wider">Key Facts</p>
                    <ul className="space-y-1">
                      {aggregated.keyFacts.slice(0, 5).map((f, i) => (
                        <li key={i} className="text-xs text-slate-300 flex items-start gap-2">
                          <Lightbulb size={10} className="text-gold-500 shrink-0 mt-0.5" />
                          {f}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            <div className="px-5 pb-5">
              <button
                onClick={populateCase}
                disabled={isPopulating || !activeCase}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-gold-500 hover:bg-gold-600
                           disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed
                           text-slate-900 font-bold rounded-xl transition-all duration-200 text-sm"
              >
                {isPopulating ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Adding to Case…
                  </>
                ) : (
                  <>
                    <Plus size={16} />
                    Add All to Case
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Empty state */}
        {docs.length === 0 && (
          <div className="text-center py-10 text-slate-500">
            <ScanLine size={40} className="mx-auto mb-3 opacity-20" />
            <p className="text-sm">Upload police reports, contracts, depositions, or any case documents above.</p>
            <p className="text-xs mt-1">AI will extract witnesses, timeline events, evidence, and action items automatically.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default DiscoveryLens;
