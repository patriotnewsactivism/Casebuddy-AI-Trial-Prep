
export enum CaseStatus {
  PRE_TRIAL = 'Pre-Trial',
  DISCOVERY = 'Discovery',
  TRIAL = 'Trial',
  APPEAL = 'Appeal',
  CLOSED = 'Closed'
}

export enum DocumentType {
  DEPOSITION = 'Deposition',
  MOTION = 'Motion',
  EVIDENCE = 'Evidence',
  CONTRACT = 'Contract',
  OTHER = 'Other'
}

export type TrialPhase = 
  | 'pre-trial-motions'
  | 'voir-dire' 
  | 'opening-statement' 
  | 'direct-examination' 
  | 'cross-examination' 
  | 'defendant-testimony'
  | 'closing-argument' 
  | 'sentencing';

export type SimulationMode = 'learn' | 'practice' | 'trial';

export type RiskLevel = 'low' | 'medium' | 'high';
export type PriorityLevel = 'low' | 'medium' | 'high';
export type TaskStatus = 'open' | 'blocked' | 'done';

export interface EvidenceItem {
  id: string;
  caseId: string;
  title: string;
  type: DocumentType;
  source: 'text' | 'file';
  summary: string;
  keyEntities: string[];
  risks: string[];
  addedAt: string;
  fileName?: string;
  notes?: string;
}

export interface CaseTask {
  id: string;
  caseId: string;
  title: string;
  status: TaskStatus;
  priority: PriorityLevel;
  dueDate?: string;
  owner?: string;
  notes?: string;
}

export interface Case {
  id: string;
  title: string;
  client: string;
  status: CaseStatus;
  opposingCounsel: string;
  judge: string;
  nextCourtDate: string;
  summary: string;
  winProbability: number;
  tags?: string[];
  evidence?: EvidenceItem[];
  tasks?: CaseTask[];
}

export interface Document {
  id: string;
  name: string;
  type: DocumentType;
  date: string;
  content: string;
  summary?: string;
  keyEntities?: string[];
}

export interface Witness {
  id: string;
  name: string;
  role: string;
  personality: string; // e.g., "Hostile", "Nervous", "Cooperative"
  credibilityScore: number; // 0-100
  avatarUrl: string;
}

export interface Message {
  id: string;
  sender: 'user' | 'witness' | 'system' | 'opponent' | 'coach';
  text: string;
  timestamp: number;
  sentiment?: string;
}

export interface StrategyInsight {
  title: string;
  description: string;
  confidence: number;
  type: 'risk' | 'opportunity' | 'prediction';
}

export interface OpposingProfile {
  name: string;
  firm: string;
  aggressiveness: number; // 0-100
  settlementTendency: number; // 0-100
  commonTactics: string[];
}

export interface CoachingAnalysis {
  critique: string;
  suggestion: string;
  sampleResponse: string;
  fallaciesIdentified: string[]; // List of logical fallacies detected
  rhetoricalEffectiveness: number; // 0-100 score
  rhetoricalFeedback: string; // Brief comment on tone/persuasion
  teleprompterScript?: string; // New field for providing text to read/reference
}

export interface Transcription {
  id: string;
  caseId: string;
  fileName: string;
  fileUrl?: string;
  text: string;
  duration?: number; // in seconds
  speakers?: string[];
  timestamp: number;
  tags?: string[];
  notes?: string;
}

export type TimelineEventType = 'incident' | 'evidence' | 'witness' | 'filing' | 'hearing' | 'other';
export type TimelineEventImportance = 'low' | 'medium' | 'high' | 'critical';

export interface TimelineEvent {
  id: string;
  title: string;
  date: string;
  time?: string;
  description: string;
  type: TimelineEventType;
  importance: TimelineEventImportance;
  tags?: string[];
  linkedEvidence?: string[];
  linkedWitnesses?: string[];
}

export type EvidenceStatus = 'pending' | 'admitted' | 'excluded' | 'challenged';

export interface Evidence {
  id: string;
  name: string;
  type: DocumentType;
  description: string;
  dateObtained: string;
  exhibitNumber?: string;
  source?: string;
  status: EvidenceStatus;
  tags?: string[];
  notes?: string;
}

export interface Juror {
  id: string;
  name: string;
  age: number;
  occupation: string;
  education: string;
  background: string;
  biases: string[];
  leaningScore: number;
  avatar: string;
}

export interface JuryDeliberation {
  jurorId: string;
  statement: string;
  timestamp: number;
}

export interface JuryVerdict {
  verdict: 'guilty' | 'not guilty' | 'hung';
  confidence: number;
  voteTally: {
    guilty: number;
    notGuilty: number;
  };
  reasoning: string;
  weaknesses: string[];
  strengths: string[];
}

export interface TrialSessionMetrics {
  objectionsReceived: number;
  fallaciesCommitted: number;
  avgRhetoricalScore: number;
  wordCount: number;
  fillerWordsCount: number;
}

export interface TrialSessionTranscriptEntry {
  id: string;
  sender: Message['sender'];
  text: string;
  timestamp: number;
}

export interface TrialSession {
  id: string;
  caseId: string;
  caseTitle: string;
  phase: TrialPhase | string;
  mode: SimulationMode | string;
  date: string;
  duration: number;
  transcript: TrialSessionTranscriptEntry[];
  audioUrl?: string;
  score?: number;
  feedback?: string;
  metrics?: Partial<TrialSessionMetrics>;
}

export type Jurisdiction = 'federal' | 'texas' | 'louisiana' | 'mississippi';

export interface ObjectionEvent {
  id: string;
  timestamp: number;
  ground: string;
  ruling: 'sustained' | 'overruled' | 'pending';
  explanation?: string;
  wasCured: boolean;
}

export interface JurorDemographics {
  age: number;
  gender: 'male' | 'female' | 'non-binary';
  race: string;
  education: string;
  occupation: string;
  income: string;
  maritalStatus: string;
  hasChildren: boolean;
  religion?: string;
  politicalLean: string;
  urbanRural: 'urban' | 'suburban' | 'rural';
  priorJuryService: boolean;
  crimeVictim: boolean;
  lawEnforcementFamily: boolean;
}

export interface PsychographicProfile {
  authorityRespect: number;
  justiceOrientation: 'retributive' | 'restorative' | 'mixed';
  skepticismLevel: number;
  empathyLevel: number;
  cognitiveStyle: 'analytical' | 'intuitive' | 'balanced';
  decisionSpeed: 'quick' | 'deliberate' | 'thorough';
  opennessToExperience: number;
  conscientiousness: number;
  extraversion: number;
  agreeableness: number;
  neuroticism: number;
}

export interface EnhancedJuror extends Juror {
  demographics: JurorDemographics;
  psychographics: PsychographicProfile;
  initialLeaning: number;
  currentLeaning: number;
  reasoningNotes: string[];
}

export interface CaseLawCitation {
  caseName: string;
  citation: string;
  court: string;
  date: string;
  summary: string;
  holding: string;
  favorableTo: 'plaintiff' | 'defendant' | 'neutral';
  stillGoodLaw: boolean;
  url: string;
}

export interface PerformanceMetrics {
  objectionsReceived: number;
  objectionsSustained: number;
  objectionsOverruled: number;
  successfulCures: number;
  rhetoricalScore: number;
  legalAccuracyScore: number;
  overallScore: number;
}

export interface AdmissibilityIssue {
  type: string;
  severity: 'fatal' | 'serious' | 'minor';
  rule: string;
  explanation: string;
  potentialCure: string;
}

export interface AdmissibilityAnalysis {
  overallAdmissibility: 'admissible' | 'conditionally_admissible' | 'inadmissible';
  confidenceScore: number;
  issues: AdmissibilityIssue[];
  suggestedFoundations: string[];
  caseLawSupport: CaseLawCitation[];
}
