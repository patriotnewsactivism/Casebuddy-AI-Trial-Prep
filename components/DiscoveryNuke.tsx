import React, { useState, useContext, useCallback, useRef, useEffect } from 'react';
import { AppContext } from '../App';
import {
  Bomb, Upload, FileText, AlertTriangle, Gem, Users, DollarSign, Calendar,
  ChevronDown, ChevronRight, ArrowUpRight, Flame, Search, Filter, Download,
  Loader2, CheckCircle, XCircle, BarChart3, Eye, Zap, Scale, Clock,
  TrendingUp, BookOpen, Target, CircleDot, X
} from 'lucide-react';
import { toast } from 'react-toastify';
import {
  runBulkAnalysis,
  BulkAnalysisResult,
  AnalyzedDocument,
  Contradiction,
  HiddenGem,
  EntityIndexEntry,
  TimelineGap,
  loadBulkAnalysis,
  listBulkAnalyses,
} from '../services/bulkAnalysisService';

type ViewTab = 'overview' | 'documents' | 'contradictions' | 'gems' | 'entities' | 'timeline';
type SortKey = 'heat' | 'name' | 'pages' | 'words';

const SEVERITY_COLORS: Record<string, string> = {
  devastating: 'text-red-400 bg-red-500/10 border-red-500/30',
  major: 'text-orange-400 bg-orange-500/10 border-orange-500/30',
  minor: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30',
  case_breaking: 'text-red-400 bg-red-500/10 border-red-500/30',
  significant: 'text-orange-400 bg-orange-500/10 border-orange-500/30',
  notable: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
};

const GEM_TYPE_LABELS: Record<string, { label: string; icon: React.ElementType }> = {
  changed_story: { label: 'Changed Story', icon: AlertTriangle },
  timeline_gap: { label: 'Timeline Gap', icon: Clock },
  financial_anomaly: { label: 'Financial Anomaly', icon: DollarSign },
  missing_witness: { label: 'Missing Witness', icon: Users },
  procedural_error: { label: 'Procedural Error', icon: XCircle },
  inconsistent_testimony: { label: 'Inconsistent Testimony', icon: Scale },
  undisclosed_relationship: { label: 'Undisclosed Relationship', icon: Users },
  other: { label: 'Other', icon: Eye },
};

const DiscoveryNuke = () => {
  const { activeCase } = useContext(AppContext);

  // Upload state
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Analysis state
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressStage, setProgressStage] = useState('');
  const [progressDetail, setProgressDetail] = useState('');
  const [result, setResult] = useState<BulkAnalysisResult | null>(null);

  // UI state
  const [activeTab, setActiveTab] = useState<ViewTab>('overview');
  const [docSort, setDocSort] = useState<SortKey>('heat');
  const [expandedDoc, setExpandedDoc] = useState<string | null>(null);
  const [expandedContradiction, setExpandedContradiction] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDoc, setSelectedDoc] = useState<AnalyzedDocument | null>(null);

  // Past analyses
  const [pastAnalyses, setPastAnalyses] = useState<{ id: string; createdAt: string; docCount: number }[]>([]);

  // Load past analyses
  useEffect(() => {
    if (activeCase) {
      setPastAnalyses(listBulkAnalyses(activeCase.id));
    }
  }, [activeCase?.id]);

  // ── File Handling ──────────────────────────────────────────────────────────

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = Array.from(e.dataTransfer.files).filter(f =>
      f.type === 'application/pdf' ||
      f.type.startsWith('image/') ||
      f.name.match(/\.(pdf|png|jpg|jpeg|tiff|txt|docx?)$/i)
    );
    if (dropped.length === 0) {
      toast.error('No supported files detected. Upload PDFs, images, or text files.');
      return;
    }
    setFiles(prev => [...prev, ...dropped]);
    toast.success(`Added ${dropped.length} file${dropped.length > 1 ? 's' : ''}`);
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selected = Array.from(e.target.files);
      setFiles(prev => [...prev, ...selected]);
      toast.success(`Added ${selected.length} file${selected.length > 1 ? 's' : ''}`);
    }
  }, []);

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  // ── Run Analysis ───────────────────────────────────────────────────────────

  const handleAnalyze = async () => {
    if (files.length === 0) { toast.error('Add some files first'); return; }
    if (!activeCase) { toast.error('Select a case first'); return; }

    setIsAnalyzing(true);
    setProgress(0);
    setProgressStage('Initializing...');
    setProgressDetail('');
    setActiveTab('overview');

    try {
      const analysisResult = await runBulkAnalysis(
        files,
        activeCase.id,
        `Case: ${activeCase.title}. Client: ${activeCase.client}. Summary: ${activeCase.summary || 'No summary'}. Status: ${activeCase.status}. Key Issues: ${activeCase.keyIssues?.join(', ') || 'None listed'}`,
        (pct, stage, detail) => {
          setProgress(pct);
          setProgressStage(stage);
          setProgressDetail(detail || '');
        }
      );

      setResult(analysisResult);
      setFiles([]);
      setPastAnalyses(listBulkAnalyses(activeCase.id));
      toast.success(`Analysis complete! ${analysisResult.stats.contradictionsFound} contradictions, ${analysisResult.stats.hiddenGemsFound} hidden gems found.`);
    } catch (err) {
      console.error('Bulk analysis failed:', err);
      toast.error('Analysis failed. Check the console for details.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const loadPastAnalysis = (analysisId: string) => {
    if (!activeCase) return;
    const loaded = loadBulkAnalysis(activeCase.id, analysisId);
    if (loaded) {
      setResult(loaded);
      toast.success('Loaded past analysis');
    } else {
      toast.error('Could not load analysis');
    }
  };

  // ── Heat Color ─────────────────────────────────────────────────────────────

  const heatColor = (score: number): string => {
    if (score >= 80) return 'text-red-400 bg-red-500/20';
    if (score >= 60) return 'text-orange-400 bg-orange-500/20';
    if (score >= 40) return 'text-yellow-400 bg-yellow-500/20';
    if (score >= 20) return 'text-blue-400 bg-blue-500/20';
    return 'text-slate-400 bg-slate-700/50';
  };

  const heatEmoji = (score: number): string => {
    if (score >= 80) return '🔴';
    if (score >= 60) return '🟠';
    if (score >= 40) return '🟡';
    if (score >= 20) return '🔵';
    return '⚪';
  };

  // ── Sorted / Filtered Docs ────────────────────────────────────────────────

  const sortedDocs = result?.documents
    ? [...result.documents].sort((a, b) => {
        if (docSort === 'heat') return b.heatScore - a.heatScore;
        if (docSort === 'name') return a.fileName.localeCompare(b.fileName);
        if (docSort === 'pages') return b.pageCount - a.pageCount;
        if (docSort === 'words') return b.wordCount - a.wordCount;
        return 0;
      })
    : [];

  const filteredEntities = result?.entityIndex?.filter(e =>
    !searchQuery || e.entity.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  // ── No Case Selected ──────────────────────────────────────────────────────

  if (!activeCase) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center">
          <Bomb size={48} className="mx-auto text-slate-600 mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Discovery Nuke</h2>
          <p className="text-slate-400">Select a case first to analyze discovery documents.</p>
        </div>
      </div>
    );
  }

  // ── Upload View (no result yet) ───────────────────────────────────────────

  if (!result && !isAnalyzing) {
    return (
      <div className="flex-1 flex flex-col p-6 overflow-y-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30">
            <Bomb size={24} className="text-red-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Discovery Nuke</h1>
            <p className="text-sm text-slate-400">
              Drop hundreds of pages — AI finds contradictions, hidden gems, and the evidence that wins your case
            </p>
          </div>
          <div className="ml-auto text-right">
            <p className="text-xs text-slate-500">Active Case</p>
            <p className="text-sm text-white font-medium">{activeCase.title}</p>
          </div>
        </div>

        {/* Drop Zone */}
        <div
          onDrop={handleDrop}
          onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all ${
            isDragging
              ? 'border-red-500 bg-red-500/5 scale-[1.01]'
              : 'border-slate-700 hover:border-slate-500 bg-slate-900/50'
          }`}
        >
          <Upload size={40} className={`mx-auto mb-4 ${isDragging ? 'text-red-400' : 'text-slate-500'}`} />
          <p className="text-white font-semibold text-lg mb-1">
            {isDragging ? 'Drop files here' : 'Drag & drop discovery documents'}
          </p>
          <p className="text-slate-400 text-sm">
            PDFs, images, text files — drop everything. AI handles the rest.
          </p>
          <p className="text-slate-500 text-xs mt-2">
            Supports: PDF, PNG, JPG, TIFF, TXT, DOC
          </p>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.png,.jpg,.jpeg,.tiff,.txt,.doc,.docx"
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>

        {/* File List */}
        {files.length > 0 && (
          <div className="mt-6">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-slate-400">{files.length} file{files.length !== 1 ? 's' : ''} ready ({(files.reduce((s, f) => s + f.size, 0) / 1024 / 1024).toFixed(1)} MB)</p>
              <button
                onClick={() => setFiles([])}
                className="text-xs text-slate-500 hover:text-red-400 transition-colors"
              >
                Clear all
              </button>
            </div>
            <div className="grid gap-2 max-h-60 overflow-y-auto">
              {files.map((f, i) => (
                <div key={i} className="flex items-center gap-3 bg-slate-800/60 border border-slate-700/50 rounded-lg px-4 py-2.5">
                  <FileText size={16} className="text-slate-400 flex-shrink-0" />
                  <span className="text-sm text-white truncate flex-1">{f.name}</span>
                  <span className="text-xs text-slate-500">{(f.size / 1024).toFixed(0)} KB</span>
                  <button onClick={() => removeFile(i)} className="text-slate-600 hover:text-red-400 transition-colors">
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>

            <button
              onClick={handleAnalyze}
              className="mt-4 w-full py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-red-500/20"
            >
              <Bomb size={18} />
              Nuke Discovery — Analyze {files.length} Document{files.length !== 1 ? 's' : ''}
            </button>
          </div>
        )}

        {/* Past Analyses */}
        {pastAnalyses.length > 0 && (
          <div className="mt-8">
            <p className="text-sm text-slate-400 mb-3 font-medium">Past Analyses</p>
            <div className="grid gap-2">
              {pastAnalyses.map(a => (
                <button
                  key={a.id}
                  onClick={() => loadPastAnalysis(a.id)}
                  className="flex items-center gap-3 bg-slate-800/40 border border-slate-700/50 rounded-lg px-4 py-3 hover:bg-slate-800 transition-colors text-left"
                >
                  <BarChart3 size={16} className="text-slate-400" />
                  <div className="flex-1">
                    <p className="text-sm text-white">{a.docCount} documents analyzed</p>
                    <p className="text-xs text-slate-500">{new Date(a.createdAt).toLocaleString()}</p>
                  </div>
                  <ChevronRight size={14} className="text-slate-600" />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Processing View ────────────────────────────────────────────────────────

  if (isAnalyzing) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md text-center">
          <div className="relative mb-6">
            <Bomb size={48} className="mx-auto text-red-400 animate-pulse" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Analyzing Discovery</h2>
          <p className="text-sm text-slate-400 mb-1">{progressStage}</p>
          <p className="text-xs text-slate-500 mb-4">{progressDetail}</p>

          {/* Progress bar */}
          <div className="w-full bg-slate-800 rounded-full h-3 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-red-600 to-orange-500 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-slate-500 mt-2">{progress}% complete</p>
        </div>
      </div>
    );
  }

  // ── Results View ───────────────────────────────────────────────────────────

  if (!result) return null;

  const tabs: { id: ViewTab; label: string; icon: React.ElementType; count?: number; color?: string }[] = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'documents', label: 'Documents', icon: FileText, count: result.documents.length },
    { id: 'contradictions', label: 'Contradictions', icon: AlertTriangle, count: result.contradictions.length, color: result.contradictions.length > 0 ? 'text-red-400' : undefined },
    { id: 'gems', label: 'Hidden Gems', icon: Gem, count: result.hiddenGems.length, color: result.hiddenGems.length > 0 ? 'text-amber-400' : undefined },
    { id: 'entities', label: 'Entity Index', icon: Users, count: result.entityIndex.length },
    { id: 'timeline', label: 'Timeline', icon: Calendar, count: result.timeline.length },
  ];

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-800 bg-slate-950/50">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-red-500/10 border border-red-500/30">
            <Bomb size={20} className="text-red-400" />
          </div>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-white">Discovery Nuke — Results</h1>
            <p className="text-xs text-slate-500">
              {result.stats.totalDocuments} docs · {result.stats.totalPages} pages · {result.stats.totalWords.toLocaleString()} words · {(result.stats.processingTimeMs / 1000).toFixed(1)}s
            </p>
          </div>
          <button
            onClick={() => { setResult(null); setActiveTab('overview'); }}
            className="px-3 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition-colors"
          >
            New Analysis
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mt-4 overflow-x-auto pb-1">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-slate-700 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <tab.icon size={14} className={tab.color || ''} />
              {tab.label}
              {tab.count !== undefined && (
                <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] ${
                  tab.color ? tab.color + ' bg-current/10' : 'text-slate-500 bg-slate-800'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* ── Overview Tab ─────────────────────────────────────────────── */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Stat Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'Documents', value: result.stats.totalDocuments, icon: FileText, color: 'text-blue-400' },
                { label: 'Contradictions', value: result.stats.contradictionsFound, icon: AlertTriangle, color: result.stats.contradictionsFound > 0 ? 'text-red-400' : 'text-slate-400' },
                { label: 'Hidden Gems', value: result.stats.hiddenGemsFound, icon: Gem, color: result.stats.hiddenGemsFound > 0 ? 'text-amber-400' : 'text-slate-400' },
                { label: 'Entities', value: result.stats.entitiesFound, icon: Users, color: 'text-purple-400' },
              ].map(s => (
                <div key={s.label} className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <s.icon size={14} className={s.color} />
                    <span className="text-xs text-slate-500">{s.label}</span>
                  </div>
                  <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                </div>
              ))}
            </div>

            {/* Executive Summary */}
            <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-5">
              <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                <BookOpen size={14} className="text-slate-400" />
                Executive Summary
              </h3>
              <div className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
                {result.summary}
              </div>
            </div>

            {/* Heat Map — Top documents */}
            <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-5">
              <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                <Flame size={14} className="text-orange-400" />
                Document Heat Map
              </h3>
              <div className="space-y-2">
                {[...result.documents].sort((a, b) => b.heatScore - a.heatScore).map(doc => (
                  <div key={doc.id} className="flex items-center gap-3">
                    <span className="text-xs w-8 text-right">{heatEmoji(doc.heatScore)}</span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm text-white truncate max-w-[200px]">{doc.fileName}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded ${heatColor(doc.heatScore)}`}>
                          {doc.heatScore}
                        </span>
                      </div>
                      <div className="w-full bg-slate-700 rounded-full h-1.5">
                        <div
                          className={`h-full rounded-full transition-all ${
                            doc.heatScore >= 80 ? 'bg-red-500' :
                            doc.heatScore >= 60 ? 'bg-orange-500' :
                            doc.heatScore >= 40 ? 'bg-yellow-500' :
                            doc.heatScore >= 20 ? 'bg-blue-500' :
                            'bg-slate-600'
                          }`}
                          style={{ width: `${doc.heatScore}%` }}
                        />
                      </div>
                    </div>
                    <p className="text-xs text-slate-500 max-w-[200px] truncate">{doc.heatReason}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Action Buttons */}
            {(result.contradictions.length > 0 || result.hiddenGems.length > 0) && (
              <div className="flex gap-3 flex-wrap">
                {result.contradictions.filter(c => c.severity === 'devastating').length > 0 && (
                  <button
                    onClick={() => setActiveTab('contradictions')}
                    className="px-4 py-2 bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg text-sm font-medium hover:bg-red-500/20 transition-colors flex items-center gap-2"
                  >
                    <AlertTriangle size={14} />
                    {result.contradictions.filter(c => c.severity === 'devastating').length} Devastating Contradiction{result.contradictions.filter(c => c.severity === 'devastating').length !== 1 ? 's' : ''}
                  </button>
                )}
                {result.hiddenGems.filter(g => g.severity === 'case_breaking').length > 0 && (
                  <button
                    onClick={() => setActiveTab('gems')}
                    className="px-4 py-2 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-lg text-sm font-medium hover:bg-amber-500/20 transition-colors flex items-center gap-2"
                  >
                    <Gem size={14} />
                    {result.hiddenGems.filter(g => g.severity === 'case_breaking').length} Case-Breaking Gem{result.hiddenGems.filter(g => g.severity === 'case_breaking').length !== 1 ? 's' : ''}
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Documents Tab ────────────────────────────────────────────── */}
        {activeTab === 'documents' && (
          <div className="space-y-3">
            {/* Sort Controls */}
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xs text-slate-500">Sort by:</span>
              {([['heat', 'Heat Score'], ['name', 'Name'], ['pages', 'Pages'], ['words', 'Words']] as const).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setDocSort(key)}
                  className={`px-2.5 py-1 text-xs rounded-lg transition-colors ${
                    docSort === key ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-white'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {sortedDocs.map(doc => (
              <div
                key={doc.id}
                className="bg-slate-800/40 border border-slate-700/50 rounded-xl overflow-hidden"
              >
                <button
                  onClick={() => setExpandedDoc(expandedDoc === doc.id ? null : doc.id)}
                  className="w-full px-5 py-4 flex items-center gap-3 hover:bg-slate-800/60 transition-colors"
                >
                  <span className="text-lg">{heatEmoji(doc.heatScore)}</span>
                  <div className="flex-1 text-left">
                    <p className="text-sm font-medium text-white">{doc.fileName}</p>
                    <p className="text-xs text-slate-500">
                      {doc.pageCount} pg · {doc.wordCount.toLocaleString()} words · {doc.entities.length} entities · {doc.dates.length} dates
                    </p>
                  </div>
                  <span className={`text-xs font-bold px-2 py-1 rounded ${heatColor(doc.heatScore)}`}>
                    {doc.heatScore}
                  </span>
                  {expandedDoc === doc.id ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
                </button>

                {expandedDoc === doc.id && (
                  <div className="px-5 pb-5 border-t border-slate-700/50 space-y-4">
                    {/* Heat Reason */}
                    <div className="pt-3">
                      <p className="text-xs text-slate-500 mb-1">Importance</p>
                      <p className="text-sm text-slate-300">{doc.heatReason}</p>
                    </div>

                    {/* AI Summary */}
                    <div>
                      <p className="text-xs text-slate-500 mb-1">AI Summary</p>
                      <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{doc.aiSummary}</p>
                    </div>

                    {/* Key Findings */}
                    {doc.keyFindings.length > 0 && (
                      <div>
                        <p className="text-xs text-slate-500 mb-2">Key Findings</p>
                        <ul className="space-y-1">
                          {doc.keyFindings.map((f, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                              <CircleDot size={10} className="text-slate-500 mt-1.5 flex-shrink-0" />
                              {f}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Entities, Dates, Money */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {doc.entities.length > 0 && (
                        <div className="bg-slate-900/50 rounded-lg p-3">
                          <p className="text-xs text-slate-500 mb-1.5 flex items-center gap-1"><Users size={10} /> People & Orgs</p>
                          <div className="flex flex-wrap gap-1">
                            {doc.entities.map((e, i) => (
                              <span key={i} className="text-xs px-2 py-0.5 bg-slate-800 text-slate-300 rounded">{e.name}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      {doc.dates.length > 0 && (
                        <div className="bg-slate-900/50 rounded-lg p-3">
                          <p className="text-xs text-slate-500 mb-1.5 flex items-center gap-1"><Calendar size={10} /> Dates</p>
                          <div className="flex flex-wrap gap-1">
                            {doc.dates.map((d, i) => (
                              <span key={i} className="text-xs px-2 py-0.5 bg-slate-800 text-slate-300 rounded">{d.date}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      {doc.monetaryAmounts.length > 0 && (
                        <div className="bg-slate-900/50 rounded-lg p-3">
                          <p className="text-xs text-slate-500 mb-1.5 flex items-center gap-1"><DollarSign size={10} /> Amounts</p>
                          <div className="flex flex-wrap gap-1">
                            {doc.monetaryAmounts.map((a, i) => (
                              <span key={i} className="text-xs px-2 py-0.5 bg-green-500/10 text-green-400 rounded">{a}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* OCR confidence */}
                    <p className="text-xs text-slate-600">OCR Confidence: {doc.ocrConfidence}% · Processed in {(doc.processingTime / 1000).toFixed(1)}s</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ── Contradictions Tab ───────────────────────────────────────── */}
        {activeTab === 'contradictions' && (
          <div className="space-y-3">
            {result.contradictions.length === 0 ? (
              <div className="text-center py-12">
                <CheckCircle size={40} className="mx-auto text-green-500 mb-3" />
                <p className="text-white font-medium">No contradictions found</p>
                <p className="text-sm text-slate-400">Documents appear internally consistent</p>
              </div>
            ) : (
              result.contradictions.map(c => (
                <div
                  key={c.id}
                  className={`border rounded-xl overflow-hidden ${SEVERITY_COLORS[c.severity] || 'border-slate-700'}`}
                >
                  <button
                    onClick={() => setExpandedContradiction(expandedContradiction === c.id ? null : c.id)}
                    className="w-full px-5 py-4 flex items-start gap-3 hover:bg-slate-800/40 transition-colors"
                  >
                    <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
                    <div className="flex-1 text-left">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded ${SEVERITY_COLORS[c.severity]}`}>
                          {c.severity}
                        </span>
                      </div>
                      <p className="text-sm text-slate-200">{c.description}</p>
                    </div>
                    {expandedContradiction === c.id ? <ChevronDown size={14} className="text-slate-400 mt-1" /> : <ChevronRight size={14} className="text-slate-400 mt-1" />}
                  </button>

                  {expandedContradiction === c.id && (
                    <div className="px-5 pb-5 border-t border-slate-700/30 space-y-3 pt-3">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="bg-slate-900/60 rounded-lg p-3">
                          <p className="text-xs text-slate-500 mb-1">📄 {c.docA.fileName}</p>
                          <p className="text-sm text-slate-300 italic">"{c.docA.excerpt}"</p>
                        </div>
                        <div className="bg-slate-900/60 rounded-lg p-3">
                          <p className="text-xs text-slate-500 mb-1">📄 {c.docB.fileName}</p>
                          <p className="text-sm text-slate-300 italic">"{c.docB.excerpt}"</p>
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 mb-1">Legal Implication</p>
                        <p className="text-sm text-slate-300">{c.legalImplication}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 mb-1">Impeachment Value</p>
                        <p className="text-sm text-slate-300">{c.impeachmentValue}</p>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* ── Hidden Gems Tab ──────────────────────────────────────────── */}
        {activeTab === 'gems' && (
          <div className="space-y-3">
            {result.hiddenGems.length === 0 ? (
              <div className="text-center py-12">
                <Gem size={40} className="mx-auto text-slate-600 mb-3" />
                <p className="text-white font-medium">No hidden gems detected</p>
                <p className="text-sm text-slate-400">Upload more documents for deeper analysis</p>
              </div>
            ) : (
              result.hiddenGems.map(gem => {
                const typeInfo = GEM_TYPE_LABELS[gem.type] || GEM_TYPE_LABELS.other;
                const TypeIcon = typeInfo.icon;
                return (
                  <div key={gem.id} className={`bg-slate-800/40 border rounded-xl p-5 ${SEVERITY_COLORS[gem.severity]}`}>
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-slate-900/60">
                        <TypeIcon size={16} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded ${SEVERITY_COLORS[gem.severity]}`}>
                            {gem.severity.replace('_', ' ')}
                          </span>
                          <span className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded">
                            {typeInfo.label}
                          </span>
                        </div>
                        <h4 className="text-sm font-bold text-white mb-2">{gem.title}</h4>
                        <p className="text-sm text-slate-300 mb-3">{gem.description}</p>

                        {gem.sourceDoc.excerpt && (
                          <div className="bg-slate-900/60 rounded-lg p-3 mb-3">
                            <p className="text-xs text-slate-500 mb-1">📄 Source: {gem.sourceDoc.fileName}</p>
                            <p className="text-sm text-slate-400 italic">"{gem.sourceDoc.excerpt}"</p>
                          </div>
                        )}

                        {gem.relatedDocs.length > 0 && (
                          <p className="text-xs text-slate-500 mb-2">
                            Related: {gem.relatedDocs.map(d => d.fileName).join(', ')}
                          </p>
                        )}

                        <div className="flex items-start gap-2 bg-green-500/5 border border-green-500/20 rounded-lg p-3">
                          <Zap size={14} className="text-green-400 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="text-xs text-green-400 font-medium mb-0.5">Action Item</p>
                            <p className="text-sm text-slate-300">{gem.actionItem}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ── Entity Index Tab ─────────────────────────────────────────── */}
        {activeTab === 'entities' && (
          <div className="space-y-4">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="Search entities..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-600"
              />
            </div>

            <div className="space-y-2">
              {filteredEntities.slice(0, 100).map((entity, i) => (
                <div key={i} className="bg-slate-800/40 border border-slate-700/50 rounded-lg px-4 py-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-white">{entity.entity}</span>
                    <span className="text-xs px-1.5 py-0.5 bg-slate-700 text-slate-400 rounded">{entity.type}</span>
                    <span className="text-xs text-slate-500 ml-auto">{entity.totalMentions} mention{entity.totalMentions !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {entity.occurrences.map((occ, j) => (
                      <span key={j} className="text-xs px-2 py-0.5 bg-slate-900/60 text-slate-400 rounded">
                        {occ.fileName} ({occ.count})
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Timeline Tab ─────────────────────────────────────────────── */}
        {activeTab === 'timeline' && (
          <div className="space-y-3">
            {result.timeline.length === 0 ? (
              <div className="text-center py-12">
                <Calendar size={40} className="mx-auto text-slate-600 mb-3" />
                <p className="text-white font-medium">No significant timeline gaps found</p>
                <p className="text-sm text-slate-400">Documents appear to have continuous date coverage</p>
              </div>
            ) : (
              result.timeline.map(gap => (
                <div key={gap.id} className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-5">
                  <div className="flex items-center gap-3 mb-2">
                    <Clock size={16} className="text-orange-400" />
                    <span className="text-sm font-bold text-white">{gap.gapDays}-day gap</span>
                    <span className="text-xs text-slate-500">{gap.startDate} → {gap.endDate}</span>
                  </div>
                  <p className="text-sm text-slate-300 mb-1">{gap.description}</p>
                  <p className="text-xs text-slate-500">{gap.significance}</p>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default DiscoveryNuke;
