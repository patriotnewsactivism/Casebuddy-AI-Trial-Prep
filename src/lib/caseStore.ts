// CaseBuddy AI — Case File System
// The shared spine that connects every agent. Maya opens the case file,
// hands off briefings to each department, and every module reads & writes
// the same file so the client flows through the whole firm automatically.
// Persists to localStorage; mirrors to Supabase when configured (cloudSync).

import { useSyncExternalStore } from 'react';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { AGENTS } from '../agents/personas';

export type CaseStage = 'intake' | 'investigation' | 'research' | 'discovery' | 'pretrial' | 'trial' | 'closed';

export const CASE_STAGES: { id: CaseStage; label: string }[] = [
  { id: 'intake',        label: 'Intake' },
  { id: 'investigation', label: 'Investigation' },
  { id: 'research',      label: 'Research' },
  { id: 'discovery',     label: 'Discovery' },
  { id: 'pretrial',      label: 'Pre-Trial' },
  { id: 'trial',         label: 'Trial' },
  { id: 'closed',        label: 'Closed' },
];

export interface CaseTask {
  id: string;
  agentId: string;
  title: string;
  detail: string;
  route: string;
  status: 'pending' | 'in_progress' | 'done';
  completedAt?: string;
}

export interface CaseActivity {
  id: string;
  agentId: string;
  action: string;
  detail?: string;
  at: string;
  minutesSaved?: number;
}

export interface CaseFact {
  id: string;
  agentId: string;
  fact: string;
  at: string;
}

export interface CaseDeadline {
  id: string;
  title: string;
  deadlineType: string;
  dueDate: string;
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
  factLog: CaseFact[];
  source?: 'attorney' | 'client-link';
}

// ===== Storage & subscriptions =====

const CASES_KEY = 'cb_cases';
const ACTIVE_KEY = 'cb_active_case';

function normalize(c: any): CaseFile {
  const defaults = {
    parties: [], claims: [], nextSteps: [], tasks: [], deadlines: [],
    documents: [], witnesses: [], research: [], activity: [], factLog: [],
    jurisdiction: '', incidentDate: '', summary: '', solConcern: '',
    viabilityScore: null, urgency: '', stage: 'intake',
  };
  const merged = { ...defaults, ...c };
  merged.factLog = merged.factLog || [];
  return merged as CaseFile;
}

function load(): CaseFile[] {
  try {
    const raw = JSON.parse(localStorage.getItem(CASES_KEY) || '[]');
    return Array.isArray(raw) ? raw.map(normalize) : [];
  } catch {
    return [];
  }
}

let cache: CaseFile[] = load();
let version = 0;
const listeners = new Set<() => void>();

// ===== Cloud sync (Supabase) =====

let cloud: SupabaseClient | null = null;
try {
  const url = process.env.REACT_APP_SUPABASE_URL;
  const key = process.env.REACT_APP_SUPABASE_ANON_KEY;
  if (url && key && key !== 'your_anon_key_here') cloud = createClient(url, key);
} catch { cloud = null; }

export const cloudSyncEnabled = !!cloud;

const dirtyIds = new Set<string>();
let pushTimer: ReturnType<typeof setTimeout> | null = null;

function schedulePush() {
  if (!cloud || dirtyIds.size === 0) return;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(async () => {
    const ids = Array.from(dirtyIds);
    dirtyIds.clear();
    const rows = cache
      .filter(c => ids.includes(c.id))
      .map(c => ({ id: c.id, data: c, updated_at: c.updatedAt }));
    if (rows.length === 0) return;
    try { await cloud!.from('case_files').upsert(rows); } catch { /* offline */ }
  }, 1200);
}

export async function initCloudSync() {
  if (!cloud) return;
  try {
    const { data, error } = await cloud.from('case_files').select('id,data,updated_at');
    if (error || !data) return;
    let changed = false;
    for (const row of data) {
      const remote = normalize(row.data);
      const localIdx = cache.findIndex(c => c.id === remote.id);
      if (localIdx === -1) {
        cache = [remote, ...cache];
        changed = true;
      } else if ((remote.updatedAt || '') > (cache[localIdx].updatedAt || '')) {
        cache = cache.map(c => (c.id === remote.id ? remote : c));
        changed = true;
      }
    }
    if (changed) {
      cache = [...cache].sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
      localStorage.setItem(CASES_KEY, JSON.stringify(cache));
      version++;
      listeners.forEach(l => l());
    }
  } catch { /* stay local */ }
}

function persist(touchedIds?: string[]) {
  localStorage.setItem(CASES_KEY, JSON.stringify(cache));
  version++;
  listeners.forEach(l => l());
  (touchedIds || cache.map(c => c.id)).forEach(id => dirtyIds.add(id));
  schedulePush();
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
  persist([id]);
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
        : `Verify the statute of limitations for ${s.case_type || 'this case'}${
            s.incident_date ? ` (incident: ${s.incident_date})` : ''
          } and calendar all filing deadlines.`,
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
      id: uid(), agentId: 'nova', status: 'pending', route: '/contracts',
      title: 'Review relevant contracts & agreements',
      detail: 'Analyze any contracts, retainer agreements, or transactional documents connected to this case for risky clauses, missing protections, and redline opportunities.',
    },
    {
      id: uid(), agentId: 'max', status: 'pending', route: '/e-filing',
      title: 'Confirm court & filing requirements',
      detail: `Identify the proper court${
        s.jurisdiction ? ` in ${s.jurisdiction}` : ''
      }, formatting rules, filing fees, and service requirements.`,
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

export function createCaseFromIntake(s: IntakeSummary, source: 'attorney' | 'client-link' = 'attorney'): CaseFile {
  const now = new Date().toISOString();
  const c: CaseFile = {
    factLog: [],
    source,
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
      action: source === 'client-link'
        ? 'Took a client intake via the public link & opened case file'
        : 'Completed intake interview & opened case file',
      detail: `Briefed ${Object.keys(AGENTS).length - 1} departments with handoff assignments.`,
      minutesSaved: 45,
    }],
  };
  cache = [c, ...cache];
  persist([c.id]);
  if (source !== 'client-link') setActiveCaseId(c.id);
  return c;
}

export function createBlankCase(clientName: string, caseType: string): CaseFile {
  return createCaseFromIntake({ client_name: clientName, case_type: caseType });
}

export function createDemoCase(): CaseFile {
  const now = new Date().toISOString();
  const d = (offsetDays: number) =>
    new Date(Date.now() + offsetDays * 86400000).toISOString().split('T')[0];

  const c: CaseFile = {
    id: uid(),
    source: 'attorney',
    createdAt: now,
    updatedAt: now,
    clientName: 'Jane Doe (Demo)',
    caseType: 'Personal Injury — Auto Accident',
    jurisdiction: 'California',
    incidentDate: d(-90),
    parties: [
      'Jane Doe (Plaintiff)',
      'Michael Johnson (Defendant)',
      'State Farm Insurance (Insurer)',
    ],
    claims: [
      'Negligence',
      'Negligence Per Se (VC §23123 — cell phone use)',
      'Property Damage',
      'Lost Wages',
      'Pain & Suffering',
    ],
    summary:
      'Client Jane Doe was rear-ended at a red light on Hwy 101 by defendant Michael Johnson ' +
      'who was texting while driving. Jane suffered whiplash (Grade II), herniated disc at L4-L5, ' +
      'and a concussion. She missed 6 weeks of work as an RN (~$8,400 lost wages). ' +
      "State Farm offered $12,000 — far below estimated damages of $120,000–$180,000.",
    viabilityScore: 88,
    urgency: 'high',
    solConcern:
      'California 2-year SOL (CCP §335.1). Incident was 90 days ago. ' +
      'Must file by ' + d(640) + '.',
    nextSteps: [
      'Obtain complete police report & CHP accident reconstruction report',
      "Subpoena Johnson's cell phone records to confirm VC §23123 violation",
      'Retain accident reconstruction expert',
      "Counter State Farm's $12,000 offer with $180,000 demand letter",
      'Schedule deposition of eyewitness Robert Chen',
    ],
    stage: 'investigation',
    tasks: [
      {
        id: uid(), agentId: 'maya', status: 'done', route: '/conflict-checker',
        title: 'Run conflict of interest check',
        detail: 'Cross-referenced Jane Doe and Michael Johnson — no conflicts found. Cleared to proceed.',
        completedAt: new Date(Date.now() - 7200000).toISOString(),
      },
      {
        id: uid(), agentId: 'sol', status: 'done', route: '/deadlines',
        title: 'Calculate SOL & calendar all deadlines',
        detail: 'California 2-year SOL confirmed (CCP §335.1). Counter-offer deadline and HIPAA renewal calendared.',
        completedAt: new Date(Date.now() - 3600000).toISOString(),
      },
      {
        id: uid(), agentId: 'doc', status: 'pending', route: '/documents',
        title: 'Collect & analyze client documents',
        detail: 'Police report and ER/MRI records uploaded. Analyze for key facts, legal gems, and risks.',
      },
      {
        id: uid(), agentId: 'lex', status: 'pending', route: '/research',
        title: 'Research legal claims & strategy',
        detail: 'Research negligence per se under VC §23123. Find comparable verdicts for rear-end/TBI cases in California.',
      },
      {
        id: uid(), agentId: 'nova', status: 'pending', route: '/contracts',
        title: 'Review relevant contracts & agreements',
        detail: 'Review retainer agreement and any insurance policy language regarding UM/UIM coverage.',
      },
      {
        id: uid(), agentId: 'max', status: 'pending', route: '/e-filing',
        title: 'Confirm court & filing requirements',
        detail: 'Identify proper California superior court, filing fees, and proof of service requirements.',
      },
      {
        id: uid(), agentId: 'rex', status: 'pending', route: '/witnesses',
        title: 'Identify & prepare witnesses',
        detail: 'Prepare Jane Doe and eyewitness Robert Chen for deposition. Build direct + cross outlines.',
      },
      {
        id: uid(), agentId: 'jules', status: 'pending', route: '/jury',
        title: 'Stress-test the case theory',
        detail: 'Run $180,000 negligence theory past simulated jury. Identify weaknesses in damages narrative.',
      },
    ],
    deadlines: [
      {
        id: uid(), title: 'Statute of Limitations', deadlineType: 'SOL',
        dueDate: d(640),
        description: 'California CCP §335.1 — 2 years from incident date.',
        isCritical: true, isCompleted: false,
      },
      {
        id: uid(), title: 'Counter State Farm Offer', deadlineType: 'Negotiation',
        dueDate: d(14),
        description: "Issue demand letter countering State Farm's $12,000 with $180,000.",
        isCritical: true, isCompleted: false,
      },
      {
        id: uid(), title: 'Medical Records Authorization Expires', deadlineType: 'Discovery',
        dueDate: d(30),
        description: "HIPAA authorization for St. Mary's Hospital expires — renew to obtain complete billing records.",
        isCritical: false, isCompleted: false,
      },
    ],
    documents: [
      {
        id: uid(), fileName: 'CHP Police Report — Case #2024-0891.pdf', docType: 'Police Report',
        summary:
          'CHP confirms Johnson cited for VC §23123 (cell phone). Eyewitness Robert Chen identified. ' +
          'Skid marks 12 ft — consistent with 40+ mph impact. No mechanical failure found on plaintiff vehicle.',
        analyzedAt: new Date(Date.now() - 1800000).toISOString(),
      },
      {
        id: uid(), fileName: "St. Mary's ER Records & MRI Report.pdf", docType: 'Medical Record',
        summary:
          'Cervical strain Grade II (whiplash), L4-L5 disc herniation on MRI (objective injury), ' +
          'mild TBI confirmed. Discharged with PT referral. Radiologist: herniation “consistent with acute traumatic injury.” ' +
          'No pre-existing conditions.',
        analyzedAt: new Date(Date.now() - 1500000).toISOString(),
      },
    ],
    witnesses: [
      {
        id: uid(), name: 'Robert Chen', side: 'Plaintiff',
        preparedAt: now,
        expectedTestimony:
          "Eyewitness directly behind Johnson's vehicle. Saw Johnson looking down at phone for 3-4 seconds " +
          'before impact. States Johnson never applied brakes. Strong lay testimony on distracted driving.',
      },
    ],
    research: [
      {
        id: uid(),
        question: 'Negligence per se — texting while driving in California',
        findings:
          'California Vehicle Code §23123 prohibits handheld cell phone use while driving. ' +
          'Under Evidence Code §669, statutory violation creates rebuttable presumption of negligence. ' +
          'See Deyo v. Kilbourne (1978) 84 Cal.App.3d 789. Strong per se basis — cell records critical.',
        at: new Date(Date.now() - 900000).toISOString(),
      },
    ],
    activity: [
      {
        id: uid(), agentId: 'lex', minutesSaved: 90,
        at: new Date(Date.now() - 900000).toISOString(),
        action: 'Researched negligence per se — California VC §23123',
        detail:
          'Evid. Code §669 creates rebuttable presumption. ' +
          'Comparable verdicts: $145K–$210K for similar rear-end/herniation cases.',
      },
      {
        id: uid(), agentId: 'sol', minutesSaved: 45,
        at: new Date(Date.now() - 3600000).toISOString(),
        action: 'Calendared SOL and all key deadlines',
        detail: '2-year SOL under CCP §335.1. Counter-offer and HIPAA renewal deadlines added.',
      },
      {
        id: uid(), agentId: 'maya', minutesSaved: 45,
        at: new Date(Date.now() - 7200000).toISOString(),
        action: 'Completed intake interview & opened case file',
        detail: 'Briefed all 9 departments with handoff assignments. Viability score: 88/100.',
      },
    ],
    factLog: [
      {
        id: uid(), agentId: 'doc', at: now,
        fact: 'Defendant cited for VC §23123 (cell phone) — creates rebuttable presumption of negligence per se',
      },
      {
        id: uid(), agentId: 'doc', at: now,
        fact: 'MRI confirms L4-L5 disc herniation — objective evidence of serious injury, no pre-existing conditions',
      },
      {
        id: uid(), agentId: 'maya', at: now,
        fact: 'State Farm offered $12,000 against estimated $120,000–$180,000 total damages — 10 cents on the dollar',
      },
      {
        id: uid(), agentId: 'maya', at: now,
        fact: 'Plaintiff missed 6 weeks of work as RN ($8,400 lost wages) — documented in employment records',
      },
      {
        id: uid(), agentId: 'doc', at: now,
        fact: 'Eyewitness Robert Chen saw defendant look at phone 3-4 seconds before impact — no braking observed',
      },
    ],
  };

  cache = [c, ...cache];
  persist([c.id]);
  setActiveCaseId(c.id);
  return c;
}

export function deleteCase(id: string) {
  cache = cache.filter(c => c.id !== id);
  if (localStorage.getItem(ACTIVE_KEY) === id) localStorage.removeItem(ACTIVE_KEY);
  persist([]);
  if (cloud) cloud.from('case_files').delete().eq('id', id).then(() => {}, () => {});
}

export function setCaseStage(id: string, stage: CaseStage) {
  mutate(id, c => { c.stage = stage; });
}

// ===== Activity & department write-backs =====

export function logActivity(caseId: string, agentId: string, action: string, detail?: string, minutesSaved?: number) {
  mutate(caseId, c => {
    c.activity = [{ id: uid(), agentId, action, detail, at: new Date().toISOString(), minutesSaved }, ...c.activity];
  });
}

// ===== Billable time saved =====

export function caseMinutesSaved(c: CaseFile): number {
  return c.activity.reduce((sum, a) => sum + (a.minutesSaved || 0), 0);
}

export function firmMinutesSaved(cases: CaseFile[]): number {
  return cases.reduce((sum, c) => sum + caseMinutesSaved(c), 0);
}

export function formatHoursSaved(minutes: number): string {
  return (minutes / 60).toFixed(1);
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

// ===== Continuous case growth (the case brain) =====

export interface CaseUpdate {
  new_facts?: string[];
  new_parties?: string[];
  new_claims?: string[];
  new_deadlines?: { title: string; due_date: string; critical?: boolean; description?: string }[];
  urgency?: string;
  summary_update?: string;
  jurisdiction?: string;
  incident_date?: string;
}

export const CASE_UPDATE_DIRECTIVE = `
IMPORTANT — LIVING CASE FILE PROTOCOL:
Whenever this conversation reveals NEW information about the case (new facts, parties, claims, dates, deadlines, jurisdiction, or a material change to the situation), append a machine-readable block at the very END of your reply, after your normal response:
<CASE_UPDATE>{"new_facts":["..."],"new_parties":["..."],"new_claims":["..."],"new_deadlines":[{"title":"...","due_date":"YYYY-MM-DD","critical":true}],"urgency":"low|medium|high|critical","summary_update":"...","jurisdiction":"...","incident_date":"YYYY-MM-DD"}</CASE_UPDATE>
Include ONLY keys with genuinely new information. Omit the block entirely if nothing new was learned. Never mention this block to the user.`;

export function extractCaseUpdate(reply: string): CaseUpdate | null {
  const match = reply.match(/<CASE_UPDATE>([\s\S]*?)<\/CASE_UPDATE>/);
  if (!match) return null;
  try {
    return JSON.parse(match[1].replace(/```json|```/g, '').trim());
  } catch {
    return null;
  }
}

export function stripCaseUpdate(reply: string): string {
  return reply.replace(/<CASE_UPDATE>[\s\S]*?<\/CASE_UPDATE>/g, '').trim();
}

const URGENCY_RANK: Record<string, number> = { low: 1, medium: 2, high: 3, critical: 4 };

export function applyCaseUpdate(caseId: string, agentId: string, u: CaseUpdate): boolean {
  let applied = false;
  const now = new Date().toISOString();
  mutate(caseId, c => {
    const has = (list: string[], v: string) => list.some(x => x.trim().toLowerCase() === v.trim().toLowerCase());
    for (const f of u.new_facts || []) {
      if (f && !c.factLog.some(x => x.fact.toLowerCase() === f.toLowerCase())) {
        c.factLog = [{ id: uid(), agentId, fact: f, at: now }, ...c.factLog];
        applied = true;
      }
    }
    for (const p of u.new_parties || []) {
      if (p && !has(c.parties, p)) { c.parties = [...c.parties, p]; applied = true; }
    }
    for (const cl of u.new_claims || []) {
      if (cl && !has(c.claims, cl)) { c.claims = [...c.claims, cl]; applied = true; }
    }
    for (const dl of u.new_deadlines || []) {
      if (dl.title && dl.due_date && !c.deadlines.some(x => x.title.toLowerCase() === dl.title.toLowerCase())) {
        c.deadlines = [...c.deadlines, {
          id: uid(), title: dl.title, deadlineType: 'Other', dueDate: dl.due_date,
          description: dl.description || `Surfaced by ${AGENTS[agentId]?.name || 'the team'} mid-conversation`,
          isCritical: !!dl.critical, isCompleted: false,
        }];
        applied = true;
      }
    }
    if (u.urgency && URGENCY_RANK[u.urgency] && URGENCY_RANK[u.urgency] > (URGENCY_RANK[c.urgency] || 0)) {
      c.urgency = u.urgency as CaseFile['urgency'];
      applied = true;
    }
    if (u.jurisdiction && !c.jurisdiction) { c.jurisdiction = u.jurisdiction; applied = true; }
    if (u.incident_date && !c.incidentDate) { c.incidentDate = u.incident_date; applied = true; }
    if (u.summary_update) {
      c.summary = c.summary
        ? `${c.summary}\n\nUpdate (${new Date().toLocaleDateString()}): ${u.summary_update}`
        : u.summary_update;
      applied = true;
    }
    if (applied) {
      const count = (u.new_facts?.length || 0) + (u.new_parties?.length || 0)
        + (u.new_claims?.length || 0) + (u.new_deadlines?.length || 0);
      c.activity = [{
        id: uid(), agentId, at: now,
        action: 'Updated the case file with new information',
        detail: [
          u.new_facts?.length    ? `${u.new_facts.length} new fact(s)` : '',
          u.new_parties?.length  ? `${u.new_parties.length} new part(ies)` : '',
          u.new_claims?.length   ? `${u.new_claims.length} new claim(s)` : '',
          u.new_deadlines?.length ? `${u.new_deadlines.length} new deadline(s)` : '',
          u.summary_update       ? 'summary updated' : '',
        ].filter(Boolean).join(', ') || 'case details refined',
        minutesSaved: Math.min(30, 5 * Math.max(1, count)),
      }, ...c.activity];
    }
  });
  return applied;
}

export function ingestAgentReply(caseId: string | undefined, agentId: string, reply: string): string {
  if (caseId) {
    const update = extractCaseUpdate(reply);
    if (update) applyCaseUpdate(caseId, agentId, update);
  }
  return stripCaseUpdate(reply);
}

// ===== AI context injection =====

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
  if (c.factLog.length) {
    lines.push(`Latest learned facts (newest first): ${c.factLog.slice(0, 10).map(f => f.fact).join(' | ')}`);
  }
  lines.push(`=== END CASE FILE ===`);
  return lines.join('\n');
}

export function caseBrief(c: CaseFile): string {
  const parts = [`${c.clientName} — ${c.caseType}`];
  if (c.jurisdiction) parts.push(c.jurisdiction);
  if (c.claims.length) parts.push(`Claims: ${c.claims.join(', ')}`);
  return parts.join('. ');
}
