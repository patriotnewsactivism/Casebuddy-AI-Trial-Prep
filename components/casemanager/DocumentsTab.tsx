import React, { useState } from 'react';
import { Case, DocumentType } from '../../types';
import { Upload, FileText, AlertCircle } from 'lucide-react';
import { validateFile } from '../../utils/fileValidation';
import { analyzeDocument } from '../../services/geminiService';
import { performAzureOCR, loadAzureOCRConfig } from '../../services/azureOcrService';
import { handleSuccess, handleError } from '../../utils/errorHandler';

interface DocumentsTabProps {
  activeCase: Case | null;
  updateCase: (id: string, data: Partial<Case>) => Promise<void>;
}

const categoryMap: Record<string, DocumentType> = {
  pleadings: DocumentType.MOTION,
  evidence: DocumentType.EVIDENCE,
  motions: DocumentType.MOTION,
  discovery: DocumentType.EVIDENCE,
  other: DocumentType.OTHER,
};

export const DocumentsTab: React.FC<DocumentsTabProps> = ({ activeCase, updateCase }) => {
  const [category, setCategory] = useState<string>('all');
  const [useAzureOCR, setUseAzureOCR] = useState(false);
  const [uploading, setUploading] = useState(false);
  const azureConfigured = !!loadAzureOCRConfig();

  if (!activeCase) {
    return <div className="text-slate-400">Select a case to view</div>;
  }

  const filteredDocs = activeCase.evidence?.filter(doc => {
    if (category === 'all') return true;
    return doc.type === categoryMap[category];
  }) || [];

  const handleFileUpload = async (files: FileList) => {
    setUploading(true);
    try {
      for (const file of files) {
        const validation = validateFile(file);
        if (!validation.valid) {
          handleError(`${file.name}: ${validation.error}`);
          continue;
        }

        let text = '';
        if (useAzureOCR && azureConfigured) {
          const ocrResult = await performAzureOCR(file);
          if (ocrResult.error) {
            handleError(`OCR failed: ${ocrResult.error}`);
            continue;
          }
          text = ocrResult.text;
        }

        const analysis = await analyzeDocument(file, text);
        const docEntry = {
          id: crypto.randomUUID(),
          caseId: activeCase.id,
          title: file.name,
          type: DocumentType.EVIDENCE,
          source: 'file' as const,
          summary: analysis.summary || '',
          keyEntities: analysis.entities || [],
          risks: analysis.risks || [],
          addedAt: new Date().toISOString(),
          fileName: file.name,
        };

        const updated = [...(activeCase.evidence || []), docEntry];
        await updateCase(activeCase.id, { evidence: updated });
        handleSuccess(`${file.name} uploaded and analyzed`);
      }
    } catch (error) {
      handleError('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Upload Section */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
        <h3 className="font-semibold text-white mb-4">Upload Documents</h3>

        {/* Azure OCR Toggle */}
        <div className="mb-4 flex items-center gap-3">
          <input
            type="checkbox"
            id="azureOcr"
            checked={useAzureOCR}
            onChange={e => setUseAzureOCR(e.target.checked)}
            disabled={!azureConfigured}
            className="disabled:opacity-50"
          />
          <label htmlFor="azureOcr" className="text-sm text-slate-300">
            Use Azure OCR for scanned documents
          </label>
          {!azureConfigured && (
            <span className="ml-2 text-xs text-orange-400 flex items-center gap-1">
              <AlertCircle size={14} /> Not configured
            </span>
          )}
        </div>

        {/* Drag-drop zone */}
        <label className="block border-2 border-dashed border-slate-600 rounded-lg p-6 text-center cursor-pointer hover:border-gold-500 transition-colors">
          <Upload className="mx-auto mb-2 text-slate-400" />
          <p className="text-slate-300 font-semibold">Drag files here or click to upload</p>
          <p className="text-slate-500 text-sm">PDF, DOCX, PNG, JPG (up to 20MB)</p>
          <input
            type="file"
            multiple
            accept=".pdf,.docx,.doc,.png,.jpg,.jpeg"
            onChange={e => e.target.files && handleFileUpload(e.target.files)}
            disabled={uploading}
            className="hidden"
          />
        </label>
      </div>

      {/* Category Filter */}
      <div>
        <label className="text-sm text-slate-300 block mb-2">Filter by Category</label>
        <select
          value={category}
          onChange={e => setCategory(e.target.value)}
          className="bg-slate-800 border border-slate-700 text-white px-3 py-2 rounded-lg"
        >
          <option value="all">All Documents</option>
          <option value="pleadings">Pleadings</option>
          <option value="discovery">Discovery</option>
          <option value="evidence">Evidence</option>
          <option value="motions">Motions</option>
          <option value="other">Other</option>
        </select>
      </div>

      {/* Document Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {filteredDocs.map(doc => (
          <div key={doc.id} className="bg-slate-800/50 border border-slate-700 rounded-lg p-3 hover:border-gold-500/30 transition-colors">
            <FileText className="text-slate-400 mb-2" size={20} />
            <h4 className="font-semibold text-white text-sm truncate">{doc.title}</h4>
            <p className="text-slate-400 text-xs mt-1 line-clamp-2">{doc.summary}</p>
            <p className="text-slate-500 text-xs mt-2">{new Date(doc.addedAt).toLocaleDateString()}</p>
          </div>
        ))}
      </div>

      {filteredDocs.length === 0 && (
        <div className="text-center py-8 text-slate-400">
          <FileText className="mx-auto mb-2 opacity-50" />
          <p>No documents in this category</p>
        </div>
      )}
    </div>
  );
};
