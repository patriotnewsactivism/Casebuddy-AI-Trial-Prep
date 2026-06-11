// CaseBuddy AI — Case File System
// The shared spine that connects every agent. Maya opens the case file,
// hands off briefings to each department, and every module reads & writes
// the same file so the client flows through the whole firm automatically.
// Persists to localStorage (Supabase sync can layer on top later).

import { useSyncExternalStore } from 'react';
import { AGENTS } from '../agents/personas';

export type CaseStage = 'intake' | 'investigation' | 'research' | 'discovery' | 'pretrial' | 'trial' | 'closed';

export const CASE_STAGES: { id: CaseStage; label: string }[] = [
  { id: 'intake', label: 'Intake' },
  { id: 'investigation', label: 'Investigation' },
  { id: 'research', label: 'Research' },
  { id: 'discovery', label: 'Discovery' },
  { id: 'pretrial', label: 'Pre-Trial' },
  { id: 'trial', label: 'Trial' },
  { id: 'closed', label: 'Closed' },
];

export interface CaseTask {
  id: string;
  agentId: string;          // persona id from agents/personas.ts
  title: string;
  detail: string;
  route: string;            // module where the work happens
  status: 'pending' | 'in_progress' | 'done';
  completedAt?: string;
}

export interface CaseActivity {
  id: string;
  agentId: string;
  action: string;
  detail?: string;
  at: string;
}

export interface CaseDeadline {
  id: string;
  title: string;
  deadlineType: string;
  dueDate: string;          // ISO date
  description: string;
  isCritical: boolean;
  isCompleted: boolean;
}

export interface CaseDocument {
  id: string;
  fileName: string;
  docType: string;
  summary: string;
  analyzedAt: string;
}

export interface CaseWitness {
  id: string;
  name: string;
  side: string;
  expectedTestimony: string;
  preparedAt: string;
}

export interface CaseResearchNote {
  id: string;
  question: string;
  findings: string;
  at: string;
}

export interface CaseFile {
  id: string;
  createdAt: string;
  updatedAt: string;
  clientName: string;
  caseType: string;
  jurisdiction: string;
  incidentDate: string;
  parties: string[];
  claims: string[];
  summary: string;
  viabilityScore: number | null;
  urgency: 'low' | 'medium' | 'high' | 'critical' | '';
  solConcern: string;
  nextSteps: string[];
  stage: CaseStage;
  tasks: CaseTask[];
  deadlines: CaseDeadline[];
  documents: CaseDocument[];
  witnesses: CaseWitness[];
  research: CaseResearchNote[];
  activity: CaseActivity[];
}

// ===== Storage & subscriptions =====

const CASES_KEY = 'cb_cases';
const ACTIVE_KEY = 'cb_active_case';

function load(): CaseFile[] {
  try {
    return JSON.parse(localStorage.getItem(CASES_KEY) || '[]');
  } catch {
    return [];
  }
}

let cache: CaseFile[] = load();
let version = 0;
const listeners = new Set<() => void>();

function persist() {
  localStorage.setItem(CASES_KEY, JSON.stringify(cache));
  version++;
  listeners.forEach(l => l());
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => { listeners.delete(l); };
};

function useStoreVersion() {
  return useSyncExternalStore(subscribe, () => version);
}

export function useCases(): CaseFile[] {
  useStoreVersion();
  return cache;
}

export function useActiveCase(): CaseFile | null {
  useStoreVersion();
  const id = localStorage.getItem(ACTIVE_KEY);
  return cache.find(c => c.id === id) || null;
}

export function listCases(): CaseFile[] {
  return cache;
}

export function getCase(id: string): CaseFile | null {
  return cache.find(c => c.id === id) || null;
}

export function setActiveCaseId(id: string | null) {
  if (id) localStorage.setItem(ACTIVE_KEY, id);
  else localStorage.removeItem(ACTIVE_KEY);
  version++;
  listeners.forEach(l => l());
}

export function getActiveCase(): CaseFile | null {
  const id = localStorage.getItem(ACTIVE_KEY);
  return cache.find(c => c.id === id) || null;
}

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

function mutate(id: string, fn: (c: CaseFile) => void) {
  const c = cache.find(x => x.id === id);
  if (!c) return;
  fn(c);
  c.updatedAt = new Date().toISOString();
  cache = [...cache];
  persist();
}

// ===== Case creation & department handoffs =====

export interface IntakeSummary {
  client_name?: string;
  case_type?: string;
  incident_date?: string;
  parties?: string[];
  claims?: string[];
  case_viability_score?: number;
  urgency?: string;
  statute_of_limitations_concern?: string | null;
  next_steps?: string[];
  summary?: string;
  jurisdiction?: string;
}

function generateHandoffTasks(s: IntakeSummary): CaseTask[] {
  const claims = (s.claims || []).join(', ');
  const parties = (s.parties || []).join(', ');
  const tasks: CaseTask[] = [
    {
      id: uid(), agentId: 'maya', status: 'pending', route: '/conflict-checker',
      title: 'Run conflict of interest check',
      detail: `Cross-reference all parties against existing cases before the firm commits: ${parties || 'parties from intake'}.`,
    },
    {
      id: uid(), agentId: 'sol', status: 'pending', route: '/deadlines',
      title: 'Calculate SOL & calendar all deadlines',
      detail: s.statute_of_limitations_concern
        ? `⚠️ Maya flagged an SOL concern: ${s.statute_of_limitations_concern}. Verify the limitations period and calendar it immediately.`
        : `Verify the statute of limitations for ${s.case_type || 'this case'}${s.incident_date ? ` (incident: ${s.incident_date})` : ''} and calendar all filing deadlines.`,
    },
    {
      id: uid(), agentId: 'doc', status: 'pending', route: '/documents',
      title: 'Collect & analyze client documents',
      detail: 'Gather every document the client mentioned during intake, analyze for key facts, legal gems, and risks, and attach findings to the case file.',
    },
    {
      id: uid(), agentId: 'lex', status: 'pending', route: '/research',
      title: 'Research legal claims & strategy',
      detail: claims
        ? `Research supporting case law and assess strength of the identified claims: ${claims}.`
        : 'Identify the strongest legal theories and supporting precedent for this case.',
    },
    {
      id: uid(), agentId: 'max', status: 'pending', route: '/e-filing',
      title: 'Confirm court & filing requirements',
      detail: `Identify the proper court${s.jurisdiction ? ` in ${s.jurisdiction}` : ''}, formatting rules, filing fees, and service requirements.`,
    },
    {
      id: uid(), agentId: 'rex', status: 'pending', route: '/witnesses',
      title: 'Identify & prepare witnesses',
      detail: 'Build the witness list from intake facts and prepare examination outlines for each.',
    },
    {
      id: uid(), agentId: 'jules', status: 'pending', route: '/jury',
      title: 'Stress-test the case theory',
      detail: 'Once the theory of the case takes shape, run it past the simulated jury panel and report persuasion weaknesses.',
    },
  ];
  return tasks;
}

export function createCaseFromIntake(s: IntakeSummary): CaseFile {
  const now = new Date().toISOString();
  const c: CaseFile = {
    id: uid(),
    createdAt: now,
    updatedAt: now,
    clientName: s.client_name || 'Unnamed Client',
    caseType: s.case_type || 'General',
    jurisdiction: s.jurisdiction || '',
    incidentDate: s.incident_date || '',
    parties: s.parties || [],
    claims: s.claims || [],
    summary: s.summary || '',
    viabilityScore: s.case_viability_score ?? null,
    urgency: (s.urgency as CaseFile['urgency']) || '',
    solConcern: s.statute_of_limitations_concern || '',
    nextSteps: s.next_steps || [],
    stage: 'intake',
    tasks: generateHandoffTasks(s),
    deadlines: [],
    documents: [],
    witnesses: [],
    research: [],
    activity: [{
      id: uid(), agentId: 'maya', at: now,
      action: 'Completed intake interview & opened case file',
      detail: `Briefed ${Object.keys(AGENTS).length - 1} departments with handoff assignments.`,
    }],
  };
  cache = [c, ...cache];
  persist();
  setActiveCaseId(c.id);
  return c;
}

export function createBlankCase(clientName: string, caseType: string): CaseFile {
  return createCaseFromIntake({ client_name: clientName, case_type: caseType });
}

export function deleteCase(id: string) {
  cache = cache.filter(c => c.id !== id);
  if (localStorage.getItem(ACTIVE_KEY) === id) localStorage.removeItem(ACTIVE_KEY);
  persist();
}

export function setCaseStage(id: string, stage: CaseStage) {
  mutate(id, c => { c.stage = stage; });
}

// ===== Activity & department write-backs =====

export function logActivity(caseId: string, agentId: string, action: string, detail?: string) {
  mutate(caseId, c => {
    c.activity = [{ id: uid(), agentId, action, detail, at: new Date().toISOString() }, ...c.activity];
  });
}

export function completeAgentTask(caseId: string, agentId: string, route?: string) {
  mutate(caseId, c => {
    const task = c.tasks.find(t => t.agentId === agentId && t.status !== 'done' && (!route || t.route === route));
    if (task) {
      task.status = 'done';
      task.completedAt = new Date().toISOString();
    }
  });
}

export function setTaskStatus(caseId: string, taskId: string, status: CaseTask['status']) {
  mutate(caseId, c => {
    const task = c.tasks.find(t => t.id === taskId);
    if (task) {
      task.status = status;
      task.completedAt = status === 'done' ? new Date().toISOString() : undefined;
    }
  });
}

export function addCaseDeadline(caseId: string, d: Omit<CaseDeadline, 'id'>): string {
  const id = uid();
  mutate(caseId, c => { c.deadlines = [...c.deadlines, { ...d, id }]; });
  return id;
}

export function toggleCaseDeadline(caseId: string, deadlineId: string) {
  mutate(caseId, c => {
    c.deadlines = c.deadlines.map(d => d.id === deadlineId ? { ...d, isCompleted: !d.isCompleted } : d);
  });
}

export function removeCaseDeadline(caseId: string, deadlineId: string) {
  mutate(caseId, c => { c.deadlines = c.deadlines.filter(d => d.id !== deadlineId); });
}

export function addCaseDocument(caseId: string, doc: Omit<CaseDocument, 'id'>) {
  mutate(caseId, c => { c.documents = [{ ...doc, id: uid() }, ...c.documents]; });
}

export function addCaseWitness(caseId: string, w: Omit<CaseWitness, 'id'>) {
  mutate(caseId, c => { c.witnesses = [{ ...w, id: uid() }, ...c.witnesses]; });
}

export function addResearchNote(caseId: string, question: string, findings: string) {
  mutate(caseId, c => {
    c.research = [{ id: uid(), question, findings, at: new Date().toISOString() }, ...c.research];
  });
}

// ===== AI context injection =====
// Every module passes this into its AI calls so agents already know the case.

export function buildCaseContext(c: CaseFile): string {
  const lines: string[] = [
    `=== ACTIVE CASE FILE (shared by the whole firm) ===`,
    `Client: ${c.clientName}`,
    `Case type: ${c.caseType}`,
  ];
  if (c.jurisdiction) lines.push(`Jurisdiction: ${c.jurisdiction}`);
  if (c.incidentDate) lines.push(`Incident date: ${c.incidentDate}`);
  if (c.parties.length) lines.push(`Parties: ${c.parties.join('; ')}`);
  if (c.claims.length) lines.push(`Claims identified at intake: ${c.claims.join('; ')}`);
  if (c.summary) lines.push(`Intake summary: ${c.summary}`);
  if (c.solConcern) lines.push(`⚠️ SOL concern flagged by Maya: ${c.solConcern}`);
  if (c.viabilityScore != null) lines.push(`Case viability score: ${c.viabilityScore}/100`);

  const openDeadlines = c.deadlines.filter(d => !d.isCompleted).slice(0, 5);
  if (openDeadlines.length) {
    lines.push(`Upcoming deadlines: ${openDeadlines.map(d => `${d.title} (${d.dueDate})`).join('; ')}`);
  }
  if (c.documents.length) {
    lines.push(`Documents analyzed by Doc: ${c.documents.slice(0, 6).map(d => `${d.fileName} — ${d.summary}`.slice(0, 160)).join(' | ')}`);
  }
  if (c.witnesses.length) {
    lines.push(`Witnesses prepared by Rex: ${c.witnesses.map(w => `${w.name} (${w.side})`).join('; ')}`);
  }
  if (c.research.length) {
    lines.push(`Research notes from Lex: ${c.research.slice(0, 3).map(r => `${r.question} — ${r.findings}`.slice(0, 200)).join(' | ')}`);
  }
  lines.push(`=== END CASE FILE ===`);
  return lines.join('\n');
}

// Short one-line case brief used to prefill "case context" inputs.
export function caseBrief(c: CaseFile): string {
  const parts = [`${c.clientName} — ${c.caseType}`];
  if (c.jurisdiction) parts.push(c.jurisdiction);
  if (c.claims.length) parts.push(`Claims: ${c.claims.join(', ')}`);
  return parts.join('. ');
}
