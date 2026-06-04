/**
 * Bulk Analysis Service — "Discovery Nuke"
 *
 * Processes large document sets and performs:
 * 1. Per-document AI summarization + extraction
 * 2. Cross-document contradiction detection
 * 3. Hidden gem identification (changed stories, timeline gaps, anomalies)
 * 4. Entity cross-reference index (who/what appears where)
 * 5. Importance heat scoring per document
 */

import { GoogleGenAI, Type } from "@google/genai";
import { processDocument, ProcessedDocument, ExtractedEntity, ExtractedDate } from './documentProcessingService';
import { extractEntities as aiExtractEntities, extractFacts } from './knowledgeService';
import { callGeminiProxy } from './apiProxy';

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

// ── Types ────────────────────────────────────────────────────────────────────

export interface BulkAnalysisResult {
  id: string;
  caseId: string;
  createdAt: string;
  documents: AnalyzedDocument[];
  crossReferences: CrossReference[];
  contradictions: Contradiction[];
  hiddenGems: HiddenGem[];
  entityIndex: EntityIndexEntry[];
  timeline: TimelineGap[];
  summary: string;
  stats: AnalysisStats;
}

export interface AnalyzedDocument {
  id: string;
  fileName: string;
  fileType: string;
  pageCount: number;
  wordCount: number;
  heatScore: number;       // 0–100 importance score
  heatReason: string;      // why it's important
  aiSummary: string;       // 2-3 paragraph AI summary
  keyFindings: string[];   // bullet-point findings
  entities: ExtractedEntity[];
  dates: ExtractedDate[];
  monetaryAmounts: string[];
  extractedText: string;
  ocrConfidence: number;
  processingTime: number;
}

export interface CrossReference {
  entityName: string;
  entityType: string;
  documents: { docId: string; fileName: string; context: string; page?: number }[];
  significance: 'low' | 'medium' | 'high' | 'critical';
  note: string;
}

export interface Contradiction {
  id: string;
  severity: 'minor' | 'major' | 'devastating';
  docA: { id: string; fileName: string; excerpt: string };
  docB: { id: string; fileName: string; excerpt: string };
  description: string;
  legalImplication: string;
  impeachmentValue: string;
}

export interface HiddenGem {
  id: string;
  type: 'changed_story' | 'timeline_gap' | 'financial_anomaly' | 'missing_witness' | 'procedural_error' | 'inconsistent_testimony' | 'undisclosed_relationship' | 'other';
  severity: 'notable' | 'significant' | 'case_breaking';
  title: string;
  description: string;
  sourceDoc: { id: string; fileName: string; excerpt: string };
  relatedDocs: { id: string; fileName: string }[];
  actionItem: string;
}

export interface EntityIndexEntry {
  entity: string;
  type: 'person' | 'organization' | 'location' | 'date' | 'amount' | 'statute' | 'case_citation';
  occurrences: { docId: string; fileName: string; count: number; contexts: string[] }[];
  totalMentions: number;
}

export interface TimelineGap {
  id: string;
  startDate: string;
  endDate: string;
  gapDays: number;
  description: string;
  significance: string;
  relatedDocs: string[];
}

export interface AnalysisStats {
  totalDocuments: number;
  totalPages: number;
  totalWords: number;
  entitiesFound: number;
  contradictionsFound: number;
  hiddenGemsFound: number;
  processingTimeMs: number;
  avgOcrConfidence: number;
}

export type ProgressCallback = (progress: number, stage: string, detail?: string) => void;

// ── Main Orchestrator ────────────────────────────────────────────────────────

export const runBulkAnalysis = async (
  files: File[],
  caseId: string,
  caseContext: string,
  onProgress?: ProgressCallback
): Promise<BulkAnalysisResult> => {
  const startTime = Date.now();
  const analysisId = `bulk-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  // Stage 1: OCR + Extract per document (0–40%)
  onProgress?.(0, 'Processing documents', `0 / ${files.length} complete`);
  const analyzedDocs: AnalyzedDocument[] = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    onProgress?.(
      Math.round((i / files.length) * 35),
      'Processing documents',
      `${i + 1} / ${files.length}: ${file.name}`
    );

    try {
      const processed = await processDocument(file);
      const pageCount = processed.ocrResult.pages?.length || 1;

      analyzedDocs.push({
        id: processed.id,
        fileName: processed.fileName,
        fileType: processed.fileType,
        pageCount,
        wordCount: processed.wordCount,
        heatScore: 0,
        heatReason: '',
        aiSummary: '',
        keyFindings: [],
        entities: processed.entities,
        dates: processed.dates,
        monetaryAmounts: processed.monetaryAmounts,
        extractedText: processed.extractedText,
        ocrConfidence: processed.confidence,
        processingTime: processed.processingTime,
      });
    } catch (err) {
      console.warn(`[BulkAnalysis] Failed to process ${file.name}:`, err);
      analyzedDocs.push({
        id: `doc-err-${i}`,
        fileName: file.name,
        fileType: file.type,
        pageCount: 0,
        wordCount: 0,
        heatScore: 0,
        heatReason: 'Processing failed',
        aiSummary: 'Document could not be processed. The file may be corrupted or in an unsupported format.',
        keyFindings: ['Processing error — review manually'],
        entities: [],
        dates: [],
        monetaryAmounts: [],
        extractedText: '',
        ocrConfidence: 0,
        processingTime: 0,
      });
    }
  }

  // Stage 2: AI Summarization + Heat Scoring per document (40–60%)
  onProgress?.(40, 'AI analysis', 'Summarizing documents and scoring importance...');
  await summarizeAndScoreDocs(analyzedDocs, caseContext, onProgress);

  // Stage 3: Build entity cross-reference index (60–70%)
  onProgress?.(60, 'Cross-referencing', 'Building entity index across all documents...');
  const entityIndex = buildEntityIndex(analyzedDocs);

  // Stage 4: Find contradictions (70–85%)
  onProgress?.(70, 'Finding contradictions', 'AI is comparing statements across documents...');
  const contradictions = await findContradictions(analyzedDocs, caseContext, onProgress);

  // Stage 5: Find hidden gems (85–95%)
  onProgress?.(85, 'Hidden gem detection', 'Scanning for changed stories, gaps, anomalies...');
  const hiddenGems = await findHiddenGems(analyzedDocs, caseContext, entityIndex, onProgress);

  // Stage 6: Find timeline gaps
  onProgress?.(92, 'Timeline analysis', 'Checking for suspicious gaps...');
  const timelineGaps = findTimelineGaps(analyzedDocs);

  // Stage 7: Generate overall summary (95–100%)
  onProgress?.(95, 'Finalizing', 'Generating discovery summary...');
  const summary = await generateOverallSummary(analyzedDocs, contradictions, hiddenGems, entityIndex, caseContext);

  const stats: AnalysisStats = {
    totalDocuments: analyzedDocs.length,
    totalPages: analyzedDocs.reduce((s, d) => s + d.pageCount, 0),
    totalWords: analyzedDocs.reduce((s, d) => s + d.wordCount, 0),
    entitiesFound: entityIndex.length,
    contradictionsFound: contradictions.length,
    hiddenGemsFound: hiddenGems.length,
    processingTimeMs: Date.now() - startTime,
    avgOcrConfidence: analyzedDocs.length > 0
      ? Math.round(analyzedDocs.reduce((s, d) => s + d.ocrConfidence, 0) / analyzedDocs.length)
      : 0,
  };

  onProgress?.(100, 'Complete', `Analysis complete — ${contradictions.length} contradictions, ${hiddenGems.length} hidden gems found`);

  const result: BulkAnalysisResult = {
    id: analysisId,
    caseId,
    createdAt: new Date().toISOString(),
    documents: analyzedDocs,
    crossReferences: entityIndex
      .filter(e => e.occurrences.length > 1)
      .map(e => ({
        entityName: e.entity,
        entityType: e.type,
        documents: e.occurrences.map(o => ({
          docId: o.docId,
          fileName: o.fileName,
          context: o.contexts[0] || '',
        })),
        significance: e.totalMentions > 10 ? 'critical' as const : e.totalMentions > 5 ? 'high' as const : e.totalMentions > 2 ? 'medium' as const : 'low' as const,
        note: `Appears in ${e.occurrences.length} documents (${e.totalMentions} total mentions)`,
      })),
    contradictions,
    hiddenGems,
    entityIndex,
    timeline: timelineGaps,
    summary,
    stats,
  };

  // Save to localStorage
  saveBulkAnalysis(caseId, result);

  return result;
};

// ── Stage 2: AI Summarize + Heat Score ────────────────────────────────────────

const summarizeAndScoreDocs = async (
  docs: AnalyzedDocument[],
  caseContext: string,
  onProgress?: ProgressCallback
): Promise<void> => {
  // Process in batches of 3 to avoid rate limits
  const batchSize = 3;
  for (let i = 0; i < docs.length; i += batchSize) {
    const batch = docs.slice(i, i + batchSize);
    const promises = batch.map(async (doc) => {
      if (!doc.extractedText || doc.extractedText.length < 50) {
        doc.aiSummary = 'Document too short or empty to analyze.';
        doc.keyFindings = ['No substantive content extracted'];
        doc.heatScore = 5;
        doc.heatReason = 'Minimal content';
        return;
      }

      try {
        const truncatedText = doc.extractedText.substring(0, 25000);
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: `You are a senior litigation paralegal analyzing discovery documents.

CASE CONTEXT: ${caseContext}

DOCUMENT: "${doc.fileName}"
TEXT:
${truncatedText}

Analyze this document and return JSON with:
1. "summary" — 2-3 paragraph summary of the document's content and relevance to the case
2. "keyFindings" — array of 3-8 bullet-point key findings (specific facts, admissions, dates, amounts)
3. "heatScore" — 0-100 importance score (100 = smoking gun, 0 = completely irrelevant)
4. "heatReason" — one sentence explaining the importance score`,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                summary: { type: Type.STRING },
                keyFindings: { type: Type.ARRAY, items: { type: Type.STRING } },
                heatScore: { type: Type.NUMBER },
                heatReason: { type: Type.STRING },
              },
            },
          },
        });

        const parsed = JSON.parse(response.text || '{}');
        doc.aiSummary = parsed.summary || doc.aiSummary;
        doc.keyFindings = parsed.keyFindings || doc.keyFindings;
        doc.heatScore = Math.min(100, Math.max(0, parsed.heatScore || 0));
        doc.heatReason = parsed.heatReason || '';
      } catch (err) {
        console.warn(`[BulkAnalysis] Summarization failed for ${doc.fileName}:`, err);
        doc.aiSummary = 'AI summarization failed — review manually.';
        doc.heatScore = 50;
        doc.heatReason = 'Could not auto-score — needs manual review';
      }
    });

    await Promise.all(promises);
    onProgress?.(40 + Math.round(((i + batch.length) / docs.length) * 20), 'AI analysis', `Scored ${Math.min(i + batchSize, docs.length)} / ${docs.length} documents`);
  }
};

// ── Stage 3: Entity Cross-Reference Index ─────────────────────────────────────

const buildEntityIndex = (docs: AnalyzedDocument[]): EntityIndexEntry[] => {
  const index = new Map<string, EntityIndexEntry>();

  for (const doc of docs) {
    // From regex-extracted entities
    for (const entity of doc.entities) {
      const key = entity.name.toLowerCase().trim();
      if (key.length < 2) continue;

      if (!index.has(key)) {
        index.set(key, {
          entity: entity.name,
          type: entity.type as EntityIndexEntry['type'],
          occurrences: [],
          totalMentions: 0,
        });
      }

      const entry = index.get(key)!;
      const existingOcc = entry.occurrences.find(o => o.docId === doc.id);
      if (existingOcc) {
        existingOcc.count++;
        if (existingOcc.contexts.length < 3) existingOcc.contexts.push(entity.context);
      } else {
        entry.occurrences.push({
          docId: doc.id,
          fileName: doc.fileName,
          count: 1,
          contexts: [entity.context],
        });
      }
      entry.totalMentions++;
    }

    // Count monetary amounts
    for (const amount of doc.monetaryAmounts) {
      const key = `$${amount.replace(/[^0-9.]/g, '')}`;
      if (!index.has(key)) {
        index.set(key, {
          entity: amount,
          type: 'amount',
          occurrences: [],
          totalMentions: 0,
        });
      }
      const entry = index.get(key)!;
      const existingOcc = entry.occurrences.find(o => o.docId === doc.id);
      if (existingOcc) {
        existingOcc.count++;
      } else {
        entry.occurrences.push({ docId: doc.id, fileName: doc.fileName, count: 1, contexts: [amount] });
      }
      entry.totalMentions++;
    }
  }

  return Array.from(index.values())
    .sort((a, b) => b.totalMentions - a.totalMentions);
};

// ── Stage 4: Contradiction Detection ──────────────────────────────────────────

const findContradictions = async (
  docs: AnalyzedDocument[],
  caseContext: string,
  onProgress?: ProgressCallback
): Promise<Contradiction[]> => {
  // Only send docs with actual content
  const substantiveDocs = docs.filter(d => d.extractedText.length > 100);
  if (substantiveDocs.length < 2) return [];

  // Build a condensed version of all docs for the AI
  const docSummaries = substantiveDocs.map(d => ({
    id: d.id,
    fileName: d.fileName,
    summary: d.aiSummary || d.extractedText.substring(0, 2000),
    keyFindings: d.keyFindings,
    dates: d.dates.map(dt => `${dt.date}: ${dt.context}`).slice(0, 10),
    entities: d.entities.map(e => e.name).slice(0, 20),
    amounts: d.monetaryAmounts,
    excerpts: d.extractedText.substring(0, 5000),
  }));

  // Chunk if too many docs — compare in groups
  const allContradictions: Contradiction[] = [];
  const chunkSize = 8;

  for (let i = 0; i < docSummaries.length; i += chunkSize) {
    const chunk = docSummaries.slice(i, i + chunkSize);

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `You are an elite litigation analyst specializing in finding contradictions, inconsistencies, and lies across discovery documents.

CASE CONTEXT: ${caseContext}

DOCUMENTS TO COMPARE:
${chunk.map((d, idx) => `
--- DOCUMENT ${idx + 1}: "${d.fileName}" ---
Summary: ${d.summary}
Key Findings: ${d.keyFindings.join('; ')}
Key Dates: ${d.dates.join('; ')}
Key People: ${d.entities.join(', ')}
Amounts: ${d.amounts.join(', ')}
Excerpts: ${d.excerpts}
`).join('\n')}

Find ALL contradictions, inconsistencies, and conflicting statements between these documents. Look for:
1. Direct contradictions (Document A says X happened, Document B says Y happened)
2. Timeline inconsistencies (dates don't match, impossible timelines)
3. Changed amounts or figures
4. Witnesses saying different things about the same event
5. Missing information that should be present
6. Stories that changed between documents

For each contradiction found, assess its legal impact and impeachment value.

Return a JSON array. If no contradictions found, return empty array.`,
        config: {
          thinkingConfig: { thinkingBudget: 8192 },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                severity: { type: Type.STRING, enum: ['minor', 'major', 'devastating'] },
                docAFileName: { type: Type.STRING },
                docAExcerpt: { type: Type.STRING },
                docBFileName: { type: Type.STRING },
                docBExcerpt: { type: Type.STRING },
                description: { type: Type.STRING },
                legalImplication: { type: Type.STRING },
                impeachmentValue: { type: Type.STRING },
              },
            },
          },
        },
      });

      const found = JSON.parse(response.text || '[]');
      for (const c of found) {
        const docA = substantiveDocs.find(d => d.fileName === c.docAFileName);
        const docB = substantiveDocs.find(d => d.fileName === c.docBFileName);

        allContradictions.push({
          id: `contra-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          severity: c.severity || 'minor',
          docA: {
            id: docA?.id || '',
            fileName: c.docAFileName || 'Unknown',
            excerpt: c.docAExcerpt || '',
          },
          docB: {
            id: docB?.id || '',
            fileName: c.docBFileName || 'Unknown',
            excerpt: c.docBExcerpt || '',
          },
          description: c.description || '',
          legalImplication: c.legalImplication || '',
          impeachmentValue: c.impeachmentValue || '',
        });
      }
    } catch (err) {
      console.warn('[BulkAnalysis] Contradiction detection failed for chunk:', err);
    }

    onProgress?.(70 + Math.round(((i + chunk.length) / docSummaries.length) * 15), 'Finding contradictions', `Compared ${Math.min(i + chunkSize, docSummaries.length)} / ${docSummaries.length} documents`);
  }

  return allContradictions.sort((a, b) => {
    const order = { devastating: 0, major: 1, minor: 2 };
    return (order[a.severity] || 2) - (order[b.severity] || 2);
  });
};

// ── Stage 5: Hidden Gem Detection ──────────────────────────────────────────────

const findHiddenGems = async (
  docs: AnalyzedDocument[],
  caseContext: string,
  entityIndex: EntityIndexEntry[],
  onProgress?: ProgressCallback
): Promise<HiddenGem[]> => {
  const substantiveDocs = docs.filter(d => d.extractedText.length > 100);
  if (substantiveDocs.length === 0) return [];

  const docOverview = substantiveDocs.map(d => ({
    id: d.id,
    fileName: d.fileName,
    summary: d.aiSummary,
    keyFindings: d.keyFindings,
    dates: d.dates.map(dt => `${dt.date} (${dt.type}): ${dt.context}`).slice(0, 10),
    amounts: d.monetaryAmounts,
    entities: d.entities.map(e => `${e.name} [${e.type}]`).slice(0, 15),
  }));

  // Top entities appearing across multiple docs
  const crossDocEntities = entityIndex
    .filter(e => e.occurrences.length > 1)
    .slice(0, 30)
    .map(e => `${e.entity} (${e.type}) — in ${e.occurrences.length} docs, ${e.totalMentions} mentions`);

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `You are a master investigator and litigation strategist. Your job is to find HIDDEN GEMS in discovery — the things that look routine but are actually devastating, the buried details that win or lose cases.

CASE CONTEXT: ${caseContext}

DOCUMENTS ANALYZED:
${docOverview.map(d => `
"${d.fileName}":
  Summary: ${d.summary}
  Key findings: ${d.keyFindings.join('; ')}
  Dates: ${d.dates.join('; ')}
  Amounts: ${d.amounts.join(', ')}
  People/Orgs: ${d.entities.join(', ')}
`).join('\n')}

ENTITIES APPEARING IN MULTIPLE DOCUMENTS:
${crossDocEntities.join('\n')}

Find HIDDEN GEMS. These are things like:
- A witness who changed their story between documents
- A suspicious gap in the timeline where something should have been documented but wasn't
- Financial transfers or amounts that don't add up
- A witness who should have been mentioned but is conspicuously absent
- Procedural errors by police/government (wrong dates, missing signatures, chain of custody issues)
- Relationships between parties that aren't disclosed but are implied
- Small details that could be used for impeachment or to establish a pattern

For each gem, explain WHY it matters and give a specific action item.

Return a JSON array. Focus on quality over quantity — only include genuine finds.`,
      config: {
        thinkingConfig: { thinkingBudget: 8192 },
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              type: { type: Type.STRING, enum: ['changed_story', 'timeline_gap', 'financial_anomaly', 'missing_witness', 'procedural_error', 'inconsistent_testimony', 'undisclosed_relationship', 'other'] },
              severity: { type: Type.STRING, enum: ['notable', 'significant', 'case_breaking'] },
              title: { type: Type.STRING },
              description: { type: Type.STRING },
              sourceFileName: { type: Type.STRING },
              sourceExcerpt: { type: Type.STRING },
              relatedFileNames: { type: Type.ARRAY, items: { type: Type.STRING } },
              actionItem: { type: Type.STRING },
            },
          },
        },
      },
    });

    const found = JSON.parse(response.text || '[]');
    return found.map((g: any) => {
      const sourceDoc = substantiveDocs.find(d => d.fileName === g.sourceFileName);
      return {
        id: `gem-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type: g.type || 'other',
        severity: g.severity || 'notable',
        title: g.title || 'Untitled finding',
        description: g.description || '',
        sourceDoc: {
          id: sourceDoc?.id || '',
          fileName: g.sourceFileName || 'Unknown',
          excerpt: g.sourceExcerpt || '',
        },
        relatedDocs: (g.relatedFileNames || []).map((fn: string) => {
          const d = substantiveDocs.find(doc => doc.fileName === fn);
          return { id: d?.id || '', fileName: fn };
        }),
        actionItem: g.actionItem || '',
      };
    });
  } catch (err) {
    console.warn('[BulkAnalysis] Hidden gem detection failed:', err);
    return [];
  }
};

// ── Stage 6: Timeline Gap Detection ──────────────────────────────────────────

const findTimelineGaps = (docs: AnalyzedDocument[]): TimelineGap[] => {
  // Collect all dates from all documents
  const allDates: { date: Date; context: string; docId: string; fileName: string }[] = [];

  for (const doc of docs) {
    for (const d of doc.dates) {
      try {
        const parsed = new Date(d.date);
        if (!isNaN(parsed.getTime()) && parsed.getFullYear() > 1990 && parsed.getFullYear() < 2030) {
          allDates.push({ date: parsed, context: d.context, docId: doc.id, fileName: doc.fileName });
        }
      } catch { /* skip unparseable dates */ }
    }
  }

  if (allDates.length < 2) return [];

  // Sort chronologically
  allDates.sort((a, b) => a.date.getTime() - b.date.getTime());

  const gaps: TimelineGap[] = [];
  for (let i = 1; i < allDates.length; i++) {
    const prev = allDates[i - 1];
    const curr = allDates[i];
    const gapDays = Math.round((curr.date.getTime() - prev.date.getTime()) / (1000 * 60 * 60 * 24));

    // Flag gaps > 30 days as potentially suspicious
    if (gapDays > 30) {
      gaps.push({
        id: `gap-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        startDate: prev.date.toISOString().split('T')[0],
        endDate: curr.date.toISOString().split('T')[0],
        gapDays,
        description: `${gapDays}-day gap between events: "${prev.context.substring(0, 60)}..." and "${curr.context.substring(0, 60)}..."`,
        significance: gapDays > 180 ? 'Major gap — 6+ months with no documented activity' : gapDays > 90 ? 'Significant gap — 3+ months of silence' : 'Notable gap — over a month with no records',
        relatedDocs: [prev.docId, curr.docId],
      });
    }
  }

  return gaps.sort((a, b) => b.gapDays - a.gapDays);
};

// ── Stage 7: Overall Summary ──────────────────────────────────────────────────

const generateOverallSummary = async (
  docs: AnalyzedDocument[],
  contradictions: Contradiction[],
  gems: HiddenGem[],
  entityIndex: EntityIndexEntry[],
  caseContext: string
): Promise<string> => {
  const devastatingContradictions = contradictions.filter(c => c.severity === 'devastating');
  const caseBreakers = gems.filter(g => g.severity === 'case_breaking');
  const topEntities = entityIndex.slice(0, 15).map(e => `${e.entity} (${e.type}, ${e.totalMentions} mentions)`);

  try {
    const response = await callGeminiProxy({
      prompt: `You are a senior partner at a law firm briefing your trial team.

CASE: ${caseContext}

DISCOVERY ANALYSIS RESULTS:
- ${docs.length} documents analyzed (${docs.reduce((s, d) => s + d.wordCount, 0).toLocaleString()} total words)
- ${contradictions.length} contradictions found (${devastatingContradictions.length} devastating)
- ${gems.length} hidden gems found (${caseBreakers.length} case-breaking)
- Top entities: ${topEntities.join(', ')}

DEVASTATING CONTRADICTIONS:
${devastatingContradictions.map(c => `• ${c.description}`).join('\n') || 'None found'}

CASE-BREAKING GEMS:
${caseBreakers.map(g => `• ${g.title}: ${g.description}`).join('\n') || 'None found'}

HOTTEST DOCUMENTS (by heat score):
${docs.sort((a, b) => b.heatScore - a.heatScore).slice(0, 5).map(d => `• ${d.fileName} (score: ${d.heatScore}) — ${d.heatReason}`).join('\n')}

Write a 3-4 paragraph executive summary for the trial team. Be direct and specific. Lead with the most impactful findings. End with recommended next steps.`,
      model: 'gemini-2.5-flash',
      options: { temperature: 0.3 },
    });

    return response.text || 'Summary generation failed.';
  } catch {
    return `Discovery analysis complete. ${docs.length} documents processed. ${contradictions.length} contradictions and ${gems.length} hidden gems identified. Review the detailed findings below.`;
  }
};

// ── Storage ──────────────────────────────────────────────────────────────────

export const saveBulkAnalysis = (caseId: string, result: BulkAnalysisResult): void => {
  try {
    // Save without full extractedText to avoid localStorage limits
    const toSave = {
      ...result,
      documents: result.documents.map(d => ({
        ...d,
        extractedText: d.extractedText.substring(0, 500) + (d.extractedText.length > 500 ? '...' : ''),
      })),
    };
    localStorage.setItem(`bulk_analysis_${caseId}_${result.id}`, JSON.stringify(toSave));

    // Save index of all analyses for this case
    const indexKey = `bulk_analysis_index_${caseId}`;
    const existing = JSON.parse(localStorage.getItem(indexKey) || '[]');
    existing.unshift({ id: result.id, createdAt: result.createdAt, docCount: result.stats.totalDocuments });
    localStorage.setItem(indexKey, JSON.stringify(existing.slice(0, 20))); // Keep last 20
  } catch (err) {
    console.warn('[BulkAnalysis] Failed to save to localStorage:', err);
  }
};

export const loadBulkAnalysis = (caseId: string, analysisId: string): BulkAnalysisResult | null => {
  try {
    const data = localStorage.getItem(`bulk_analysis_${caseId}_${analysisId}`);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
};

export const listBulkAnalyses = (caseId: string): { id: string; createdAt: string; docCount: number }[] => {
  try {
    return JSON.parse(localStorage.getItem(`bulk_analysis_index_${caseId}`) || '[]');
  } catch {
    return [];
  }
};

export default {
  runBulkAnalysis,
  saveBulkAnalysis,
  loadBulkAnalysis,
  listBulkAnalyses,
};
