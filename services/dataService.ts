import { Case, CaseStatus, EvidenceItem, TrialSession } from '../types';
import { clearCases, loadCases, saveCases } from '../utils/storage';
import { getSupabaseClient, isSupabaseConfigured } from './supabaseClient';

// ── Status mapping between app and DB ────────────────────────
const STATUS_TO_DB: Record<string, string> = {
  'Pre-Trial': 'active',
  'Discovery': 'active',
  'Trial': 'active',
  'Appeal': 'pending',
  'Closed': 'closed',
};

const STATUS_FROM_DB: Record<string, CaseStatus> = {
  active: CaseStatus.PRE_TRIAL,
  pending: CaseStatus.APPEAL,
  settled: CaseStatus.CLOSED,
  dismissed: CaseStatus.CLOSED,
  closed: CaseStatus.CLOSED,
  archived: CaseStatus.CLOSED,
};

// ── Helpers ──────────────────────────────────────────────────

/** Get current authenticated user id, or null. Never throws. */
async function getAuthUserId(): Promise<string | null> {
  const client = getSupabaseClient();
  if (!client) return null;
  try {
    const { data: { user } } = await client.auth.getUser();
    return user?.id ?? null;
  } catch (e) {
    console.warn('[DataService] auth.getUser() failed:', e);
    return null;
  }
}

function caseToRow(c: Case, userId: string): Record<string, any> {
  return {
    id: c.id,
    user_id: userId,
    name: c.title || 'Untitled Case',
    case_number: c.docketNumber || null,
    court_name: c.courtLocation || null,
    case_type: 'other',
    status: STATUS_TO_DB[c.status] || 'active',
    description: c.summary || null,
    plaintiffs: [],
    defendants: [],
    key_dates: {},
    metadata: {
      client: c.client,
      judge: c.judge,
      opposingCounsel: c.opposingCounsel,
      winProbability: c.winProbability,
      tags: c.tags || [],
      evidence: c.evidence || [],
      tasks: c.tasks || [],
      witnesses: c.witnesses || [],
      jurisdiction: c.jurisdiction,
      clientType: c.clientType,
      opposingParty: c.opposingParty,
      legalTheory: c.legalTheory,
      keyIssues: c.keyIssues || [],
      nextCourtDate: c.nextCourtDate,
      originalStatus: c.status,
    },
  };
}

function rowToCase(row: any): Case {
  const m = row.metadata || {};
  return {
    id: row.id,
    user_id: row.user_id,
    title: row.name || 'Untitled Case',
    client: m.client || 'Unknown Client',
    status: m.originalStatus || STATUS_FROM_DB[row.status] || CaseStatus.PRE_TRIAL,
    opposingCounsel: m.opposingCounsel || '',
    judge: m.judge || '',
    nextCourtDate: m.nextCourtDate || 'TBD',
    summary: row.description || '',
    winProbability: m.winProbability ?? 50,
    docketNumber: row.case_number || '',
    courtLocation: row.court_name || '',
    jurisdiction: m.jurisdiction || '',
    clientType: m.clientType,
    opposingParty: m.opposingParty || '',
    legalTheory: m.legalTheory || '',
    keyIssues: m.keyIssues || [],
    tags: m.tags || [],
    evidence: m.evidence || [],
    tasks: m.tasks || [],
    witnesses: m.witnesses || [],
  };
}

const hydrateCase = (c: Case): Case => ({
  ...c,
  evidence: c.evidence || [],
  tasks: c.tasks || [],
  tags: c.tags || [],
});

const cacheCases = (cases: Case[]) => saveCases(cases.map(hydrateCase));

// ── CRUD ─────────────────────────────────────────────────────

export const fetchCases = async (): Promise<Case[]> => {
  const client = getSupabaseClient();
  if (!client) return loadCases().map(hydrateCase);

  const userId = await getAuthUserId();
  if (!userId) {
    console.log('[DataService] No auth user — using local storage');
    return loadCases().map(hydrateCase);
  }

  const { data, error } = await client
    .from('cases')
    .select('*')
    .eq('user_id', userId)
    .is('deleted_at', null);

  if (error) {
    console.error('[DataService] fetchCases error:', JSON.stringify(error));
    return loadCases().map(hydrateCase);
  }

  const cases = (data || []).map(rowToCase);
  cacheCases(cases);
  return cases;
};

export const upsertCase = async (caseRecord: Case): Promise<void> => {
  const client = getSupabaseClient();
  if (!client) {
    // No Supabase — save locally only
    const current = loadCases().filter(c => c.id !== caseRecord.id);
    cacheCases([...current, hydrateCase(caseRecord)]);
    return;
  }

  const userId = caseRecord.user_id || (await getAuthUserId());
  if (!userId) {
    console.warn('[DataService] upsertCase: no user_id — saving locally only');
    const current = loadCases().filter(c => c.id !== caseRecord.id);
    cacheCases([...current, hydrateCase(caseRecord)]);
    return; // Don't throw — just degrade gracefully
  }

  const row = caseToRow(caseRecord, userId);
  console.log('[DataService] upsert row keys:', Object.keys(row).join(', '));

  const { error } = await client.from('cases').upsert(row, { onConflict: 'id' });

  if (error) {
    console.error('[DataService] upsertCase FAILED:', JSON.stringify(error));
    throw error;
  }

  console.log('[DataService] upsertCase OK');
};

export const removeCase = async (caseId: string): Promise<void> => {
  const client = getSupabaseClient();
  if (!client) {
    cacheCases(loadCases().filter(c => c.id !== caseId));
    return;
  }

  const { error } = await client
    .from('cases')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', caseId);

  if (error) {
    console.error('[DataService] removeCase FAILED:', JSON.stringify(error));
    throw error;
  }
};

export const appendEvidence = async (caseId: string, evidence: EvidenceItem): Promise<void> => {
  const client = getSupabaseClient();
  if (!client) {
    const updated = loadCases().map(c =>
      c.id === caseId ? { ...c, evidence: [...(c.evidence || []), evidence] } : c
    );
    cacheCases(updated);
    return;
  }

  // Read current metadata
  const { data, error } = await client
    .from('cases')
    .select('metadata')
    .eq('id', caseId)
    .single();

  if (error) {
    console.error('[DataService] appendEvidence read FAILED:', JSON.stringify(error));
    throw error;
  }

  const meta = data?.metadata || {};
  const existing: EvidenceItem[] = Array.isArray(meta.evidence) ? meta.evidence : [];
  meta.evidence = [...existing, { ...evidence, lastUpdated: new Date().toISOString() }];

  const { error: updateErr } = await client
    .from('cases')
    .update({ metadata: meta })
    .eq('id', caseId);

  if (updateErr) {
    console.error('[DataService] appendEvidence update FAILED:', JSON.stringify(updateErr));
    throw updateErr;
  }
};

// ── Sessions ─────────────────────────────────────────────────

export const fetchSessions = async (caseId: string): Promise<TrialSession[]> => {
  const client = getSupabaseClient();
  const localKey = `trial_sessions_${caseId}`;
  const loadLocal = (): TrialSession[] => {
    try { return JSON.parse(localStorage.getItem(localKey) ?? '[]'); } catch { return []; }
  };

  if (!client) return loadLocal();

  const { data, error } = await client
    .from('trial_sessions')
    .select('*')
    .eq('case_id', caseId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[DataService] fetchSessions error:', JSON.stringify(error));
    return loadLocal();
  }

  return (data || []).map((row: any) => ({
    id: row.id,
    caseId: row.case_id,
    caseTitle: row.session_name || 'Untitled Session',
    phase: row.metadata?.originalPhase || row.session_type || 'other',
    mode: row.metadata?.originalMode || row.notes || 'practice',
    date: row.session_date || new Date().toISOString(),
    duration: row.metadata?.duration || 0,
    transcript: Array.isArray(row.key_events) ? row.key_events : [],
    score: row.metadata?.score || 0,
    feedback: row.outcomes || '',
    metrics: row.ai_preparation || {},
  }));
};

export const upsertSession = async (session: TrialSession): Promise<void> => {
  // Always save locally first
  const localKey = `trial_sessions_${session.caseId}`;
  try {
    const local = JSON.parse(localStorage.getItem(localKey) ?? '[]');
    const filtered = local.filter((s: any) => s.id !== session.id);
    localStorage.setItem(localKey, JSON.stringify([session, ...filtered].slice(0, 20)));
  } catch { /* ignore */ }

  const client = getSupabaseClient();
  if (!client) return;

  const userId = await getAuthUserId();
  if (!userId) return;

  const VALID_TYPES = ['hearing', 'trial', 'deposition', 'mediation', 'arbitration', 'conference', 'other'];
  const row: Record<string, any> = {
    case_id: session.caseId,
    user_id: userId,
    session_name: session.caseTitle || 'Untitled Session',
    session_date: new Date(session.date).toISOString().split('T')[0],
    session_type: VALID_TYPES.includes(session.phase) ? session.phase : 'other',
    outcomes: session.feedback || null,
    notes: session.mode || null,
    ai_preparation: session.metrics || {},
    key_events: session.transcript || [],
    metadata: {
      duration: session.duration,
      score: session.score,
      audioUrl: session.audioUrl,
      originalPhase: session.phase,
      originalMode: session.mode,
    },
  };
  if (session.id && session.id.length > 30) row.id = session.id;

  const { error } = await client.from('trial_sessions').upsert(row, { onConflict: 'id' });
  if (error) {
    console.error('[DataService] upsertSession FAILED:', JSON.stringify(error));
    throw error;
  }
};

export const removeSession = async (sessionId: string, caseId: string): Promise<void> => {
  const client = getSupabaseClient();
  if (!client) {
    try {
      const local = JSON.parse(localStorage.getItem(`trial_sessions_${caseId}`) ?? '[]');
      localStorage.setItem(`trial_sessions_${caseId}`, JSON.stringify(local.filter((s: any) => s.id !== sessionId)));
    } catch { /* ignore */ }
    return;
  }

  const { error } = await client.from('trial_sessions').delete().eq('id', sessionId);
  if (error) {
    console.error('[DataService] removeSession FAILED:', JSON.stringify(error));
    throw error;
  }
};

// ── Preferences ──────────────────────────────────────────────

export const upsertPreferences = async (prefs: Record<string, any>): Promise<void> => {
  const client = getSupabaseClient();
  if (!client) return;
  const userId = await getAuthUserId();
  if (!userId) return;
  const { error } = await client.from('profiles').update({ preferences: prefs }).eq('id', userId);
  if (error) {
    console.error('[DataService] upsertPreferences FAILED:', JSON.stringify(error));
    throw error;
  }
};

// ── Exports ──────────────────────────────────────────────────

export const resetLocalCache = () => clearCases();
export const supabaseReady = isSupabaseConfigured;
