/**
 * ROI / Billable Hours Tracker
 * 
 * Tracks every AI-assisted task and estimates the equivalent billable hours saved.
 * Stores entries in Supabase (via user metadata) with localStorage fallback.
 */

export interface ROIEntry {
  id: string;
  timestamp: string;
  taskType: ROITaskType;
  toolName: string;
  description: string;
  /** Estimated minutes a human would spend */
  estimatedMinutes: number;
  /** Actual seconds the AI took */
  actualSeconds: number;
  /** Hourly rate used for calculation */
  hourlyRate: number;
  /** Dollar value saved */
  dollarsSaved: number;
  /** Associated case ID if any */
  caseId?: string;
  caseName?: string;
}

export type ROITaskType =
  | 'legal_research'
  | 'document_drafting'
  | 'deposition_prep'
  | 'discovery'
  | 'settlement_analysis'
  | 'evidence_analysis'
  | 'trial_prep'
  | 'strategy'
  | 'negotiation_prep'
  | 'transcription'
  | 'case_intake'
  | 'timeline_creation'
  | 'general';

/** Estimated human time (minutes) and billing rate for each task type */
const TASK_BENCHMARKS: Record<ROITaskType, { minMinutes: number; maxMinutes: number; role: string; hourlyRate: number }> = {
  legal_research:     { minMinutes: 60,  maxMinutes: 180, role: 'Associate',  hourlyRate: 300 },
  document_drafting:  { minMinutes: 90,  maxMinutes: 240, role: 'Associate',  hourlyRate: 300 },
  deposition_prep:    { minMinutes: 120, maxMinutes: 300, role: 'Associate',  hourlyRate: 300 },
  discovery:          { minMinutes: 45,  maxMinutes: 120, role: 'Paralegal',  hourlyRate: 150 },
  settlement_analysis:{ minMinutes: 60,  maxMinutes: 180, role: 'Partner',    hourlyRate: 500 },
  evidence_analysis:  { minMinutes: 30,  maxMinutes: 90,  role: 'Associate',  hourlyRate: 300 },
  trial_prep:         { minMinutes: 120, maxMinutes: 360, role: 'Partner',    hourlyRate: 500 },
  strategy:           { minMinutes: 60,  maxMinutes: 180, role: 'Partner',    hourlyRate: 500 },
  negotiation_prep:   { minMinutes: 45,  maxMinutes: 120, role: 'Associate',  hourlyRate: 300 },
  transcription:      { minMinutes: 30,  maxMinutes: 90,  role: 'Paralegal',  hourlyRate: 150 },
  case_intake:        { minMinutes: 30,  maxMinutes: 60,  role: 'Paralegal',  hourlyRate: 150 },
  timeline_creation:  { minMinutes: 45,  maxMinutes: 120, role: 'Paralegal',  hourlyRate: 150 },
  general:            { minMinutes: 15,  maxMinutes: 45,  role: 'Associate',  hourlyRate: 300 },
};

/** Map tool/component names to task types */
const TOOL_TO_TASK: Record<string, ROITaskType> = {
  'Case Law Research': 'legal_research',
  'AI Co-Counsel': 'legal_research',
  'AI Partner': 'strategy',
  'Drafting Assistant': 'document_drafting',
  'Discovery Nuke': 'discovery',
  'Discovery Manager': 'discovery',
  'Deposition Generator': 'deposition_prep',
  'Settlement Calculator': 'settlement_analysis',
  'Evidence Admissibility': 'evidence_analysis',
  'Evidence Timeline': 'timeline_creation',
  'Trial Simulator': 'trial_prep',
  'Witness Lab': 'trial_prep',
  'Live Voice Sim': 'trial_prep',
  'Mock Jury': 'trial_prep',
  'Negotiation Sim': 'negotiation_prep',
  'Strategy Room': 'strategy',
  'Transcriber': 'transcription',
  'AI Law Firm': 'case_intake',
  'Agent Center': 'general',
  'Performance Analytics': 'general',
  'Case Pipeline': 'general',
};

const STORAGE_KEY = 'casebuddy_roi_entries';

/** Load entries from localStorage */
const loadEntries = (): ROIEntry[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

/** Save entries to localStorage */
const saveEntries = (entries: ROIEntry[]): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch (e) {
    console.error('[ROITracker] Failed to save entries:', e);
  }
};

/**
 * Log an AI task completion and calculate savings.
 * Call this after any AI-powered action completes.
 */
export const trackROI = (params: {
  toolName: string;
  description: string;
  actualSeconds?: number;
  caseId?: string;
  caseName?: string;
  taskType?: ROITaskType;
}): ROIEntry => {
  const taskType = params.taskType || TOOL_TO_TASK[params.toolName] || 'general';
  const benchmark = TASK_BENCHMARKS[taskType];
  
  // Use midpoint of estimate range
  const estimatedMinutes = Math.round((benchmark.minMinutes + benchmark.maxMinutes) / 2);
  const actualSeconds = params.actualSeconds || 5;
  const dollarsSaved = (estimatedMinutes / 60) * benchmark.hourlyRate;

  const entry: ROIEntry = {
    id: `roi_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    taskType,
    toolName: params.toolName,
    description: params.description,
    estimatedMinutes,
    actualSeconds,
    hourlyRate: benchmark.hourlyRate,
    dollarsSaved,
    caseId: params.caseId,
    caseName: params.caseName,
  };

  const entries = loadEntries();
  entries.unshift(entry); // newest first
  
  // Keep last 1000 entries
  if (entries.length > 1000) entries.length = 1000;
  
  saveEntries(entries);
  
  // Dispatch event so dashboard updates in real time
  window.dispatchEvent(new CustomEvent('roi-update', { detail: entry }));
  
  console.log(`[ROITracker] ${params.toolName}: saved ~$${dollarsSaved.toFixed(0)} (${estimatedMinutes}min → ${actualSeconds}s)`);
  
  return entry;
};

/** Get all tracked entries */
export const getROIEntries = (): ROIEntry[] => loadEntries();

/** Get summary statistics */
export const getROISummary = (entries?: ROIEntry[]) => {
  const all = entries || loadEntries();
  
  const totalSaved = all.reduce((sum, e) => sum + e.dollarsSaved, 0);
  const totalMinutesSaved = all.reduce((sum, e) => sum + e.estimatedMinutes, 0);
  const totalAISeconds = all.reduce((sum, e) => sum + e.actualSeconds, 0);
  
  // Group by task type
  const byTaskType: Record<string, { count: number; dollarsSaved: number; minutesSaved: number }> = {};
  for (const e of all) {
    if (!byTaskType[e.taskType]) {
      byTaskType[e.taskType] = { count: 0, dollarsSaved: 0, minutesSaved: 0 };
    }
    byTaskType[e.taskType].count++;
    byTaskType[e.taskType].dollarsSaved += e.dollarsSaved;
    byTaskType[e.taskType].minutesSaved += e.estimatedMinutes;
  }

  // Group by tool
  const byTool: Record<string, { count: number; dollarsSaved: number; minutesSaved: number }> = {};
  for (const e of all) {
    if (!byTool[e.toolName]) {
      byTool[e.toolName] = { count: 0, dollarsSaved: 0, minutesSaved: 0 };
    }
    byTool[e.toolName].count++;
    byTool[e.toolName].dollarsSaved += e.dollarsSaved;
    byTool[e.toolName].minutesSaved += e.estimatedMinutes;
  }

  // Group by day (last 30 days)
  const byDay: Record<string, number> = {};
  for (const e of all) {
    const day = e.timestamp.slice(0, 10);
    byDay[day] = (byDay[day] || 0) + e.dollarsSaved;
  }

  // Monthly projection
  const daysTracked = Object.keys(byDay).length || 1;
  const avgPerDay = totalSaved / daysTracked;
  const monthlyProjection = avgPerDay * 30;
  const annualProjection = avgPerDay * 365;

  return {
    totalEntries: all.length,
    totalDollarsSaved: totalSaved,
    totalMinutesSaved,
    totalHoursSaved: totalMinutesSaved / 60,
    totalAISeconds,
    efficiencyMultiplier: totalAISeconds > 0 ? (totalMinutesSaved * 60) / totalAISeconds : 0,
    monthlyProjection,
    annualProjection,
    byTaskType,
    byTool,
    byDay,
    daysTracked,
  };
};

/** Clear all entries */
export const clearROIEntries = (): void => {
  localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new CustomEvent('roi-update'));
};

/** Get the task benchmarks for display */
export const getTaskBenchmarks = () => TASK_BENCHMARKS;

/** Get human-readable task type label */
export const getTaskLabel = (taskType: ROITaskType): string => {
  const labels: Record<ROITaskType, string> = {
    legal_research: 'Legal Research',
    document_drafting: 'Document Drafting',
    deposition_prep: 'Deposition Prep',
    discovery: 'Discovery',
    settlement_analysis: 'Settlement Analysis',
    evidence_analysis: 'Evidence Analysis',
    trial_prep: 'Trial Preparation',
    strategy: 'Case Strategy',
    negotiation_prep: 'Negotiation Prep',
    transcription: 'Transcription',
    case_intake: 'Case Intake',
    timeline_creation: 'Timeline Creation',
    general: 'General',
  };
  return labels[taskType] || taskType;
};
