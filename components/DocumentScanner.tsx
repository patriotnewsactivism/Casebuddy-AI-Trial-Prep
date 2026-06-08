import React, { useState, useContext, useCallback, useRef } from 'react';
import { AppContext } from '../App';
import {
  ScanLine, Upload, FileText, Image, Loader2, CheckCircle, XCircle,
  Eye, Download, Trash2, Plus, FileSearch, Clock, AlertTriangle, Sparkles,
  X, ChevronDown, ChevronRight, File
} from 'lucide-react';
import { toast } from 'react-toastify';
import { callGeminiProxy } from '../services/apiProxy';
import { DocumentType } from '../types';

interface ScannedDocument {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  scannedAt: string;
  status: 'processing' | 'complete' | 'error';
  extractedText?: string;
  analysis?: DocumentAnalysis;
  thumbnailUrl?: string;
}

interface DocumentAnalysis {
  documentType: string;
  title: string;
  date?: string;
  parties: string[];
  keyEntities: string[];
  claims: string[];
  keyDates: { date: string; event: string }[];
  summary: string;
  risks: string[];
  relevance: 'high' | 'medium' | 'low';
  suggestedActions: string[];
}

const DocumentScanner = () => {
  const { activeCase, updateCase, addEvidence } = useContext(AppContext);
  const [documents, setDocuments] = useState<ScannedDocument[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<ScannedDocument | null>(null);
  const [expandedDoc, setExpandedDoc] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    processFiles(files);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => setIsDragging(false), []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      processFiles(Array.from(e.target.files));
    }
  };

  const readFileAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const readFileAsText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsText(file);
    });
  };

  const processFiles = async (files: File[]) => {
    const validFiles = files.filter(f => {
      const ext = f.name.toLowerCase();
      return ext.endsWith('.pdf') || ext.endsWith('.png') || ext.endsWith('.jpg') ||
             ext.endsWith('.jpeg') || ext.endsWith('.tiff') || ext.endsWith('.bmp') ||
             ext.endsWith('.docx') || ext.endsWith('.txt') || ext.endsWith('.doc');
    });

    if (validFiles.length === 0) {
      toast.error('Please upload PDF, image (PNG/JPG/TIFF), Word, or text files');
      return;
    }

    setIsProcessing(true);

    for (const file of validFiles) {
      const doc: ScannedDocument = {
        id: crypto.randomUUID(),
        fileName: file.name,
        fileType: file.type || 'application/octet-stream',
        fileSize: file.size,
        scannedAt: new Date().toISOString(),
        status: 'processing',
      };

      setDocuments(prev => [doc, ...prev]);

      try {
        let extractedText = '';
        const isImage = file.type.startsWith('image/');
        const isPDF = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

        if (isImage || isPDF) {
          const base64 = await readFileAsBase64(file);
          const mimeType = isImage ? file.type : 'application/pdf';

          const ocrResult = await callGeminiProxy({
            prompt: `Extract ALL text from this document image/PDF. Preserve the original formatting, paragraph breaks, and structure as much as possible. Include headers, footers, page numbers, handwritten text, stamps, signatures (describe them), tables, and any marginalia. Return ONLY the extracted text, nothing else.`,
            model: 'gemini-2.5-flash',
            inlineData: { mimeType, data: base64 },
            options: { temperature: 0.1, maxOutputTokens: 8192 },
          });

          extractedText = ocrResult.text || '';
        } else {
          extractedText = await readFileAsText(file);
        }

        // Now analyze the extracted text
        const analysisPrompt = `Analyze this legal document and return a JSON object with these fields:
{
  "documentType": "type of document (e.g., Court Order, Police Report, Medical Record, Contract, Motion, Complaint, Deposition Transcript, Subpoena, etc.)",
  "title": "document title or brief identifier",
  "date": "date of the document if found, or null",
  "parties": ["list of all parties/people mentioned"],
  "keyEntities": ["organizations, locations, case numbers mentioned"],
  "claims": ["legal claims, charges, or causes of action mentioned"],
  "keyDates": [{"date": "YYYY-MM-DD or description", "event": "what happened"}],
  "summary": "2-3 sentence summary of the document's contents and legal significance",
  "risks": ["potential risks or concerns this document raises for the case"],
  "relevance": "high/medium/low based on how critical this document likely is",
  "suggestedActions": ["recommended next steps based on this document"]
}

Document text:
${extractedText.substring(0, 12000)}`;

        const analysisResult = await callGeminiProxy({
          prompt: analysisPrompt,
          model: 'gemini-2.5-flash',
          options: { temperature: 0.2, maxOutputTokens: 4096, responseMimeType: 'application/json' },
        });

        let analysis: DocumentAnalysis;
        try {
          analysis = JSON.parse(analysisResult.text);
        } catch {
          analysis = {
            documentType: 'Unknown', title: file.name, parties: [], keyEntities: [],
            claims: [], keyDates: [], summary: 'Analysis could not be parsed.',
            risks: [], relevance: 'medium', suggestedActions: [], date: undefined,
          };
        }

        setDocuments(prev => prev.map(d => d.id === doc.id ? {
          ...d, status: 'complete' as const, extractedText, analysis,
        } : d));

        // Auto-add to case evidence if case is active
        if (activeCase) {
          await addEvidence(activeCase.id, {
            id: crypto.randomUUID(),
            caseId: activeCase.id,
            title: analysis.title || file.name,
            type: mapDocType(analysis.documentType),
            source: 'file',
            summary: analysis.summary,
            keyEntities: [...analysis.parties, ...analysis.keyEntities],
            risks: analysis.risks,
            addedAt: new Date().toISOString(),
            fileName: file.name,
            notes: `OCR scanned. Type: ${analysis.documentType}. Relevance: ${analysis.relevance}.`,
          });

          // Also add timeline events if any dates found
          if (analysis.keyDates.length > 0 && activeCase.timelineEvents) {
            const newEvents = analysis.keyDates.map(kd => ({
              id: crypto.randomUUID(),
              date: kd.date,
              title: kd.event,
              description: `Source: ${file.name}`,
              category: 'document' as const,
            }));
            await updateCase(activeCase.id, {
              timelineEvents: [...(activeCase.timelineEvents || []), ...newEvents],
            });
          }
        }

        toast.success(`✅ ${file.name} scanned & analyzed`);
      } catch (error) {
        console.error('OCR error:', error);
        setDocuments(prev => prev.map(d => d.id === doc.id ? { ...d, status: 'error' as const } : d));
        toast.error(`Failed to process ${file.name}`);
      }
    }

    setIsProcessing(false);
  };

  const mapDocType = (aiType: string): DocumentType => {
    const lower = aiType.toLowerCase();
    if (lower.includes('deposition') || lower.includes('transcript')) return DocumentType.DEPOSITION;
    if (lower.includes('motion') || lower.includes('brief') || lower.includes('complaint')) return DocumentType.MOTION;
    if (lower.includes('contract') || lower.includes('agreement')) return DocumentType.CONTRACT;
    if (lower.includes('evidence') || lower.includes('exhibit') || lower.includes('photo')) return DocumentType.EVIDENCE;
    return DocumentType.OTHER;
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  const relevanceColor = (r: string) => {
    if (r === 'high') return 'text-red-400 bg-red-500/10 border-red-500/30';
    if (r === 'medium') return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
    return 'text-green-400 bg-green-500/10 border-green-500/30';
  };

  const completedDocs = documents.filter(d => d.status === 'complete');
  const totalParties = new Set(completedDocs.flatMap(d => d.analysis?.parties || []));
  const totalDates = completedDocs.reduce((sum, d) => sum + (d.analysis?.keyDates?.length || 0), 0);

  return (
    <div className="space-y-6 animate-slideInUp">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <div className="p-2 rounded-xl bg-violet-500/10 border border-violet-500/30">
              <ScanLine size={24} className="text-violet-400" />
            </div>
            Document Scanner & OCR
          </h1>
          <p className="text-slate-400 mt-1">Upload documents — AI extracts text, identifies parties, dates, and auto-populates your case</p>
        </div>
        {activeCase && (
          <div className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-sm text-slate-300">
            Case: <span className="text-amber-400 font-medium">{activeCase.title}</span>
          </div>
        )}
      </div>

      {/* Stats */}
      {completedDocs.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Documents Scanned', value: completedDocs.length, icon: FileText, color: 'text-blue-400' },
            { label: 'Parties Identified', value: totalParties.size, icon: Eye, color: 'text-violet-400' },
            { label: 'Key Dates Found', value: totalDates, icon: Clock, color: 'text-amber-400' },
            { label: 'High Relevance', value: completedDocs.filter(d => d.analysis?.relevance === 'high').length, icon: AlertTriangle, color: 'text-red-400' },
          ].map((stat, i) => (
            <div key={i} className="glass-card rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <stat.icon size={14} className={stat.color} />
                <span className="text-xs text-slate-500 uppercase tracking-wider">{stat.label}</span>
              </div>
              <p className="text-2xl font-bold text-white">{stat.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Upload Zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all duration-200
          ${isDragging ? 'border-violet-500 bg-violet-500/5 scale-[1.01]' : 'border-slate-700 hover:border-violet-500/50 hover:bg-slate-800/30'}`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.png,.jpg,.jpeg,.tiff,.bmp,.docx,.doc,.txt"
          onChange={handleFileSelect}
          className="hidden"
        />
        <div className="flex flex-col items-center gap-3">
          {isProcessing ? (
            <Loader2 size={48} className="text-violet-400 animate-spin" />
          ) : (
            <div className="p-4 rounded-2xl bg-violet-500/10 border border-violet-500/20">
              <Upload size={32} className="text-violet-400" />
            </div>
          )}
          <div>
            <p className="text-lg font-semibold text-white">
              {isProcessing ? 'Processing documents...' : 'Drop files here or click to upload'}
            </p>
            <p className="text-sm text-slate-400 mt-1">
              PDF, Images (PNG/JPG/TIFF), Word docs, Text files • AI extracts text & analyzes content
            </p>
          </div>
          <div className="flex gap-2 mt-2">
            {['PDF', 'PNG/JPG', 'DOCX', 'TXT'].map(type => (
              <span key={type} className="px-2.5 py-1 rounded-full bg-slate-800 border border-slate-700 text-xs text-slate-400">{type}</span>
            ))}
          </div>
        </div>
      </div>

      {/* Document List */}
      {documents.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-white">Scanned Documents ({documents.length})</h2>
          {documents.map(doc => (
            <div key={doc.id} className="glass-card rounded-xl overflow-hidden">
              <div
                className="flex items-center gap-4 p-4 cursor-pointer hover:bg-slate-800/30 transition-colors"
                onClick={() => setExpandedDoc(expandedDoc === doc.id ? null : doc.id)}
              >
                <div className={`p-2 rounded-lg ${doc.status === 'complete' ? 'bg-green-500/10' : doc.status === 'error' ? 'bg-red-500/10' : 'bg-amber-500/10'}`}>
                  {doc.status === 'processing' ? <Loader2 size={18} className="text-amber-400 animate-spin" /> :
                   doc.status === 'error' ? <XCircle size={18} className="text-red-400" /> :
                   <CheckCircle size={18} className="text-green-400" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{doc.fileName}</p>
                  <p className="text-xs text-slate-500">{formatSize(doc.fileSize)} • {new Date(doc.scannedAt).toLocaleString()}</p>
                </div>
                {doc.analysis && (
                  <span className={`px-2 py-0.5 rounded-full text-xs border ${relevanceColor(doc.analysis.relevance)}`}>
                    {doc.analysis.relevance} relevance
                  </span>
                )}
                {doc.analysis && (
                  <span className="px-2 py-0.5 rounded-full text-xs bg-slate-800 border border-slate-700 text-slate-400">
                    {doc.analysis.documentType}
                  </span>
                )}
                {expandedDoc === doc.id ? <ChevronDown size={16} className="text-slate-500" /> : <ChevronRight size={16} className="text-slate-500" />}
              </div>

              {expandedDoc === doc.id && doc.analysis && (
                <div className="border-t border-slate-800 p-4 space-y-4 bg-slate-900/50">
                  {/* Summary */}
                  <div>
                    <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Summary</h4>
                    <p className="text-sm text-slate-300">{doc.analysis.summary}</p>
                  </div>

                  {/* Parties & Entities */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Parties</h4>
                      <div className="flex flex-wrap gap-1.5">
                        {doc.analysis.parties.map((p, i) => (
                          <span key={i} className="px-2 py-0.5 rounded-full text-xs bg-blue-500/10 border border-blue-500/30 text-blue-400">{p}</span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Key Entities</h4>
                      <div className="flex flex-wrap gap-1.5">
                        {doc.analysis.keyEntities.map((e, i) => (
                          <span key={i} className="px-2 py-0.5 rounded-full text-xs bg-violet-500/10 border border-violet-500/30 text-violet-400">{e}</span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Key Dates */}
                  {doc.analysis.keyDates.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Key Dates</h4>
                      <div className="space-y-1">
                        {doc.analysis.keyDates.map((kd, i) => (
                          <div key={i} className="flex items-center gap-2 text-sm">
                            <Clock size={12} className="text-amber-400 shrink-0" />
                            <span className="text-amber-400 font-mono text-xs">{kd.date}</span>
                            <span className="text-slate-400">—</span>
                            <span className="text-slate-300">{kd.event}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Risks & Actions */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {doc.analysis.risks.length > 0 && (
                      <div>
                        <h4 className="text-xs font-semibold text-red-400 uppercase tracking-wider mb-2">⚠️ Risks</h4>
                        <ul className="space-y-1">
                          {doc.analysis.risks.map((r, i) => (
                            <li key={i} className="text-sm text-red-300/80 flex items-start gap-1.5">
                              <AlertTriangle size={12} className="mt-0.5 shrink-0 text-red-400" />
                              {r}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {doc.analysis.suggestedActions.length > 0 && (
                      <div>
                        <h4 className="text-xs font-semibold text-green-400 uppercase tracking-wider mb-2">✅ Suggested Actions</h4>
                        <ul className="space-y-1">
                          {doc.analysis.suggestedActions.map((a, i) => (
                            <li key={i} className="text-sm text-green-300/80 flex items-start gap-1.5">
                              <Sparkles size={12} className="mt-0.5 shrink-0 text-green-400" />
                              {a}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  {/* Extracted Text Preview */}
                  {doc.extractedText && (
                    <details className="group">
                      <summary className="text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-slate-300">
                        📄 View Extracted Text ({doc.extractedText.length.toLocaleString()} chars)
                      </summary>
                      <pre className="mt-2 p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-400 max-h-64 overflow-y-auto whitespace-pre-wrap font-mono">
                        {doc.extractedText}
                      </pre>
                    </details>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {documents.length === 0 && !isProcessing && (
        <div className="glass-card rounded-xl p-8 text-center">
          <FileSearch size={48} className="mx-auto text-slate-600 mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">No Documents Scanned Yet</h3>
          <p className="text-sm text-slate-400 max-w-md mx-auto">
            Upload court orders, police reports, medical records, contracts, or any legal document.
            CaseBuddy's AI will extract text, identify parties, find key dates, and auto-populate your case.
          </p>
        </div>
      )}
    </div>
  );
};

export default DocumentScanner;
