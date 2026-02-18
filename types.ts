
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

// ============================================
// NEW TYPES FOR ENHANCED FEATURES
// ============================================

// OCR Types
export interface OCRResult {
  text: string;
  confidence: number;
  pages?: string[];
  detectedLanguage?: string;
  wordCount: number;
  processingTime: number;
}

export interface OCRBoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  confidence: number;
}

// Whisper Transcription Types
export interface WhisperTranscriptionResult {
  text: string;
  duration: number;
  language: string;
  segments: TranscriptSegment[];
  speakers?: SpeakerSegment[];
  wordCount: number;
}

export interface TranscriptSegment {
  id: number;
  start: number;
  end: number;
  text: string;
  speaker?: string;
  confidence?: number;
}

export interface SpeakerSegment {
  speaker: string;
  segments: number[];
}

// Enhanced Transcription with more fields
export interface EnhancedTranscription extends Transcription {
  source: 'audio' | 'document' | 'video';
  confidence: number;
  segments?: TranscriptSegment[];
  processingMethod: 'whisper' | 'ocr' | 'external';
  language?: string;
  wordCount: number;
}

// Deposition Types
export interface DepositionOutline {
  id: string;
  caseId: string;
  deponentName: string;
  deponentRole: string;
  date: string;
  topics: DepositionTopic[];
  exhibitList: string[];
  anticipatedObjections: AnticipatedObjection[];
  keyDocuments: string[];
  notes: string;
}

export interface DepositionTopic {
  id: string;
  title: string;
  questions: DepositionQuestion[];
  order: number;
  notes?: string;
}

export interface DepositionQuestion {
  id: string;
  text: string;
  type: 'foundation' | 'substantive' | 'impeachment' | 'follow-up' | 'closing';
  purpose: string;
  anticipatedAnswer?: string;
  followUpQuestions?: string[];
  linkedExhibit?: string;
  anticipatedObjection?: string;
  notes?: string;
}

export interface AnticipatedObjection {
  ground: string;
  likelihood: 'high' | 'medium' | 'low';
  responseStrategy: string;
  caseLaw?: string;
}

// Settlement Types
export interface SettlementAnalysis {
  id: string;
  caseId: string;
  date: string;
  economicDamages: EconomicDamages;
  nonEconomicDamages: NonEconomicDamages;
  punitiveDamages?: PunitiveDamages;
  comparativeNegligence: number;
  settlementRange: [number, number];
  recommendedDemand: number;
  confidenceScore: number;
  factors: SettlementFactor[];
  juryVerdictResearch?: JuryVerdictData[];
  negotiationStrategy: string;
}

export interface EconomicDamages {
  medicalExpenses: number;
  medicalExpensesFuture: number;
  lostWages: number;
  lostWagesFuture: number;
  propertyDamage: number;
  otherEconomic: number;
  total: number;
}

export interface NonEconomicDamages {
  painAndSuffering: number;
  emotionalDistress: number;
  lossOfConsortium: number;
  lossOfEnjoyment: number;
  disfigurement: number;
  multiplier: number;
  total: number;
}

export interface PunitiveDamages {
  basis: string;
  multiplier: number;
  amount: number;
  likelihood: number;
}

export interface SettlementFactor {
  factor: string;
  impact: 'positive' | 'negative' | 'neutral';
  weight: number;
  description: string;
}

export interface JuryVerdictData {
  caseName: string;
  venue: string;
  date: string;
  injuries: string;
  award: number;
  notes?: string;
}

// Discovery Types
export interface DiscoveryRequest {
  id: string;
  caseId: string;
  type: 'interrogatory' | 'request-for-production' | 'request-for-admission' | 'deposition';
  number: string;
  question: string;
  response?: string;
  objections?: string[];
  servedDate?: string;
  responseDueDate?: string;
  responseDate?: string;
  status: 'pending' | 'responded' | 'objected' | 'overdue';
  privilegeLogEntry?: boolean;
  notes?: string;
}

export interface DiscoveryDeadline {
  id: string;
  caseId: string;
  requestType: string;
  requestNumber: string;
  servedDate: string;
  dueDate: string;
  daysRemaining: number;
  status: 'upcoming' | 'due-today' | 'overdue' | 'completed';
}

// Case Law Search Types
export interface CaseLawSearchResult {
  id: string;
  caseName: string;
  citation: string;
  court: string;
  date: string;
  summary: string;
  holding?: string;
  relevanceScore: number;
  url: string;
  stillGoodLaw: boolean;
  overruledDate?: string;
  distinguishingCases?: string[];
}

export interface CaseLawSearchParams {
  query: string;
  court?: string;
  jurisdiction?: string;
  dateFrom?: string;
  dateTo?: string;
  maxResults?: number;
}

// Performance Analytics Types
export interface PerformanceSession {
  id: string;
  caseId: string;
  date: string;
  phase: TrialPhase;
  mode: SimulationMode;
  duration: number;
  metrics: SessionMetrics;
  transcript: string;
  audioUrl?: string;
  videoUrl?: string;
  notes?: string;
}

export interface SessionMetrics {
  objectionsReceived: number;
  objectionsSustained: number;
  objectionsOverruled: number;
  rhetoricalScore: number;
  legalAccuracyScore: number;
  overallScore: number;
  fillerWordCount: number;
  fillerWords: string[];
  weakPhrases: string[];
  wordsPerMinute: number;
  pauseCount: number;
  averagePauseLength: number;
}

export interface PerformanceTrend {
  date: string;
  overallScore: number;
  rhetoricalScore: number;
  objectionSuccessRate: number;
  sessionCount: number;
}

export interface PerformanceSummary {
  totalSessions: number;
  totalDuration: number;
  averageScore: number;
  improvementRate: number;
  strengths: string[];
  weaknesses: string[];
  recentTrend: PerformanceTrend[];
  topFillerWords: { word: string; count: number }[];
  mostImproved: string;
  needsWork: string;
}

// Exhibit Management Types
export interface Exhibit {
  id: string;
  caseId: string;
  exhibitNumber: string;
  title: string;
  description: string;
  type: 'document' | 'photo' | 'video' | 'audio' | 'physical';
  source: string;
  dateObtained: string;
  status: EvidenceStatus;
  linkedWitnesses: string[];
  linkedEvents: string[];
  tags: string[];
  batesNumber?: string;
  privilegeStatus: 'not-privileged' | 'privileged' | 'work-product' | 'unknown';
  privilegeLogEntry?: string;
  notes?: string;
  fileUrl?: string;
  thumbnailUrl?: string;
}

// Negotiation Simulation Types
export interface NegotiationScenario {
  id: string;
  caseId: string;
  opponentType: 'insurance' | 'corporation' | 'individual' | 'government';
  opponentTactics: string[];
  settlementRange: [number, number];
  initialOffer: number;
  currentOffer: number;
  rounds: NegotiationRound[];
  status: 'active' | 'settled' | 'impasse';
  outcome?: {
    settledAmount?: number;
    reason?: string;
  };
}

export interface NegotiationRound {
  round: number;
  yourPosition: number;
  opponentPosition: number;
  yourArgument: string;
  opponentResponse: string;
  timestamp: number;
}

// Legal Research Types
export interface LegalResearchQuery {
  id: string;
  caseId: string;
  query: string;
  results: CaseLawSearchResult[];
  date: string;
  notes?: string;
}

export interface MotionDraft {
  id: string;
  caseId: string;
  type: string;
  title: string;
  content: string;
  tableOfAuthorities: string[];
  status: 'draft' | 'review' | 'final';
  createdDate: string;
  modifiedDate: string;
}
