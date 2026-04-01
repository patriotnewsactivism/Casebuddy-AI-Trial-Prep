import { Case, CaseStatus, EvidenceItem, TrialSession } from '../types';
import { clearCases, loadCases, saveCases } from '../utils/storage';
import { getSupabaseClient, isSupabaseConfigured } from './supabaseClient';

const isNotFoundError = (error: any) => error?.code === 'PGRST116';

// Map app CaseStatus values to DB status enum values
const STATUS_TO_DB: Record<string, string> = {
  'Pre-Trial': 'active',
  'Discovery': 'active',
  'Trial': 'active',
  'Appeal': 'pending',
  'Closed': 'closed',
};

const STATUS_FROM_DB: Record<string, CaseStatus> = {
  'active': CaseStatus.PRE_TRIAL,
  'pending': CaseStatus.APPEAL,
  'settled': CaseStatus.CLOSED,
  'dismissed': CaseStatus.CLOSED,
  'closed': CaseStatus.CLOSED,
  'archived': CaseStatus.CLOSED,
};

// Map TypeScript Case to actual Supabase `cases` table columns.
// DB schema: id, user_id, name (NOT NULL), case_number, court_name, case_type (enum),
// status (enum: active/pending/settled/dismissed/closed/archived), description,
// plaintiffs[], defendants[], key_dates (JSONB), metadata (JSONB),
// client_name, representation (enum), created_at, updated_at, deleted_at
async function caseToRow(c: Case): Promise<Record<string, any>> {
  const client = getSupabaseClient();
  let userId = c.user_id;

  if (!userId && client) {
    const { data: { user } } = await client.auth.getUser();
    userId = user?.id;
  }

  // Store all app-specific fields that don't have direct DB columns in metadata
  const metadata: Record<string, any> = {
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
  };

  // Build key_dates from nextCourtDate
  const keyDates: Record<string, any> = {};
  if (c.nextCourtDate && c.nextCourtDate !== 'TBD') {
    keyDates.nextCourtDate = c.nextCourtDate;
  }

  return {
    id: c.id,
    user_id: userId,
    name: c.title || 'Untitled Case',
    case_number: c.docketNumber || null,
    court_name: c.courtLocation || null,
    case_type: 'other',
    status: STATUS_TO_DB[c.status] || 'active',
    description: c.summary || null,
    plaintiffs: c.clientType === 'plaintiff' ? [c.client] : (c.opposingParty ? [c.opposingParty] : []),
    defendants: c.clientType === 'defendant' ? [c.client] : [],
    key_dates: keyDates,
    metadata,
  };
}

// Map actual Supabase `cases` row to TypeScript Case interface
function rowToCase(row: any): Case {
  const meta = row.metadata || {};
  const keyDates = row.key_dates || {};

  // Map DB status back to app CaseStatus, preserving original if stored in metadata
  const appStatus = meta.originalStatus || STATUS_FROM_DB[row.status] || CaseStatus.PRE_TRIAL;

  return {
    id: row.id,
    user_id: row.user_id,
    title: row.name || 'Untitled Case',
    client: meta.client || 'Unknown Client',
    status: appStatus,
    opposingCounsel: meta.opposingCounsel || '',
    judge: meta.judge || '',
    nextCourtDate: keyDates.nextCourtDate || meta.nextCourtDate || 'TBD',
    summary: row.description || '',
    winProbability: meta.winProbability ?? 50,
    docketNumber: row.case_number || '',
    courtLocation: row.court_name || '',
    jurisdiction: meta.jurisdiction || '',
    clientType: meta.clientType,
    opposingParty: meta.opposingParty || '',
    legalTheory: meta.legalTheory || '',
    keyIssues: meta.keyIssues || [],
    tags: meta.tags || [],
    evidence: meta.evidence || [],
    tasks: meta.tasks || [],
    witnesses: meta.witnesses || [],
  };
}

const hydrateCase = (c: Case): Case => ({
  ...c,
  evidence: c.evidence || [],
  tasks: c.tasks || [],
  tags: c.tags || [],
});

const cacheCases = (cases: Case[]) => {
  saveCases(cases.map(hydrateCase));
};

export const fetchCases = async (): Promise<Case[]> => {
  const client = getSupabaseClient();
  if (!client) {
    console.log('[DataService] Supabase not configured, using local storage');
    return loadCases().map(hydrateCase);
  }

  let user;
  try {
    const { data } = await client.auth.getUser();
    user = data?.user;
  } catch (err) {
    console.warn('[DataService] Auth check failed (Supabase may be unreachable), using local storage', err);
    return loadCases().map(hydrateCase);
  }
  if (!user) {
    console.log('[DataService] No authenticated user, using local storage');
    return loadCases().map(hydrateCase);
  }

  console.log('[DataService] Fetching cases for user:', user.id);
  const { data, error } = await client
    .from('cases')
    .select('*')
    .eq('user_id', user.id)
    .is('deleted_at', null);

  if (error) {
    console.error('[Supabase] fetchCases failed; falling back to local cache', error);
    return loadCases().map(hydrateCase);
  }

  console.log(`[DataService] Successfully fetched ${data?.length || 0} cases from Supabase`);
  const cases = (data || []).map(rowToCase);
  cacheCases(cases);
  return cases;
};

export const upsertCase = async (caseRecord: Case): Promise<void> => {
  console.log(`[DataService] Upserting case: ${caseRecord.title} (${caseRecord.id})`);
  const client = getSupabaseClient();
  if (!client) {
    const current = loadCases().filter(c => c.id !== caseRecord.id);
    cacheCases([...current, hydrateCase(caseRecord)]);
    return;
  }

  // Ensure user_id is present
  if (!caseRecord.user_id) {
    try {
      const { data: { user } } = await client.auth.getUser();
      if (user) {
          caseRecord.user_id = user.id;
      } else {
          console.warn('[DataService] No authenticated user. Falling back to local.');
          const current = loadCases().filter(c => c.id !== caseRecord.id);
          cacheCases([...current, hydrateCase(caseRecord)]);
          return;
      }
    } catch (authErr) {
      console.warn('[DataService] Auth check failed (Supabase may be unreachable). Falling back to local.', authErr);
      const current = loadCases().filter(c => c.id !== caseRecord.id);
      cacheCases([...current, hydrateCase(caseRecord)]);
      throw authErr; // Re-throw so cloudSync knows it failed
    }
  }

  const row = await caseToRow(caseRecord);
  console.log('[DataService] Attempting upsert with mapped schema');

  const { error } = await client.from('cases').upsert(row, { onConflict: 'id' });

  if (error) {
    console.error('[Supabase] upsertCase failed', error);
    throw error;
  }

  console.log('[DataService] Successfully upserted case to Supabase');
};

export const removeCase = async (caseId: string): Promise<void> => {
  const client = getSupabaseClient();
  if (!client) {
    const updated = loadCases().filter(c => c.id !== caseId);
    cacheCases(updated);
    return;
  }

  const { error } = await client.from('cases').update({ deleted_at: new Date().toISOString() }).eq('id', caseId);
  if (error) {
    console.error('[Supabase] removeCase failed', error);
    throw error;
  }
};

export const appendEvidence = async (caseId: string, evidence: EvidenceItem): Promise<void> => {
  console.log(`[DataService] Appending evidence to case ${caseId}: ${evidence.title}`);
  const client = getSupabaseClient();
  if (!client) {
    const updated = loadCases().map(c => c.id === caseId ? { ...c, evidence: [...(c.evidence || []), evidence] } : c);
    cacheCases(updated);
    return;
  }

  // Evidence is stored in the metadata JSONB column
  const { data, error } = await client.from('cases').select('metadata, user_id').eq('id', caseId).single();

  if (error) {
    console.error('[Supabase] fetch case metadata failed', error);
    throw error;
  }

  const meta = data?.metadata || {};
  const existingEvidence: EvidenceItem[] = Array.isArray(meta.evidence) ? meta.evidence : [];
  const nextEvidence = [...existingEvidence, { ...evidence, lastUpdated: new Date().toISOString() }];

  console.log(`[DataService] Updating case ${caseId} with ${nextEvidence.length} total evidence items in metadata`);
  const { error: updateError } = await client
    .from('cases')
    .update({ metadata: { ...meta, evidence: nextEvidence } })
    .eq('id', caseId);

  if (updateError) {
    console.error('[Supabase] appendEvidence failed', updateError);
    throw updateError;
  }

  console.log('[DataService] Successfully updated evidence in cases.metadata');
  
  // Also try to insert into separate evidence table for structured data
  try {
    const { error: tableError } = await client.from('evidence').insert({
        id: evidence.id,
        case_id: caseId,
        name: evidence.title,
        description: evidence.summary,
        type: evidence.type.toLowerCase() === 'evidence' ? 'document' : 'other',
        category: evidence.source,
        ai_analysis: {
            entities: evidence.keyEntities,
            risks: evidence.risks,
            summary: evidence.summary,
            notes: evidence.notes
        },
        file_path: evidence.fileName,
        created_at: evidence.addedAt
    });
    
    if (tableError) {
        console.warn('[Supabase] Failed to insert into dedicated evidence table:', tableError.message);
    } else {
        console.log('[DataService] Successfully inserted into dedicated evidence table');
    }
  } catch (e) {
    console.warn('[Supabase] Evidence table structured insert failed (might not exist)');
  }
};

export const fetchSessions = async (caseId: string): Promise<TrialSession[]> => {
  const client = getSupabaseClient();
  if (!client) {
    try {
      return JSON.parse(localStorage.getItem(`trial_sessions_${caseId}`) ?? '[]');
    } catch {
      return [];
    }
  }

  const { data, error } = await client
    .from('trial_sessions')
    .select('*')
    .eq('case_id', caseId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[Supabase] fetchSessions failed', error);
    try {
      return JSON.parse(localStorage.getItem(`trial_sessions_${caseId}`) ?? '[]');
    } catch {
      return [];
    }
  }

  // Map database row to TrialSession interface
  const mapped: TrialSession[] = (data || []).map(row => ({
    id: row.id,
    caseId: row.case_id,
    caseTitle: row.session_name, 
    phase: row.session_type || 'other',
    mode: row.notes || 'practice', 
    date: row.session_date || new Date().toISOString(),
    duration: row.metadata?.duration || 0,
    transcript: Array.isArray(row.key_events) ? row.key_events : [],
    score: row.metadata?.score || 0,
    feedback: row.outcomes || '',
    metrics: row.ai_preparation || {},
  }));

  return mapped;
};

export const upsertSession = async (session: TrialSession): Promise<void> => {
  console.log(`[DataService] Upserting session: ${session.id} for case ${session.caseId}`);
  const client = getSupabaseClient();
  
  // Always update local cache first
  const localSessions = JSON.parse(localStorage.getItem(`trial_sessions_${session.caseId}`) ?? '[]');
  const filtered = localSessions.filter((s: any) => s.id !== session.id);
  localStorage.setItem(`trial_sessions_${session.caseId}`, JSON.stringify([session, ...filtered].slice(0, 20)));

  if (!client) return;

  const row = {
    id: session.id.length > 30 ? session.id : undefined, // Only use if it looks like a UUID
    case_id: session.caseId,
    session_name: session.caseTitle,
    session_date: new Date(session.date).toISOString().split('T')[0],
    session_type: session.phase,
    outcomes: session.feedback,
    notes: session.mode,
    ai_preparation: session.metrics,
    key_events: session.transcript,
    metadata: {
      duration: session.duration,
      score: session.score,
      audioUrl: session.audioUrl
    }
  };

  const { error } = await client.from('trial_sessions').upsert(row, { onConflict: 'id' });
  if (error) {
    console.error('[Supabase] upsertSession failed', error);
    throw error;
  }
  console.log('[DataService] Successfully upserted session to Supabase');
};

export const removeSession = async (sessionId: string, caseId: string): Promise<void> => {
  const client = getSupabaseClient();
  if (!client) {
    const localSessions = JSON.parse(localStorage.getItem(`trial_sessions_${caseId}`) ?? '[]');
    const updated = localSessions.filter((s: any) => s.id !== sessionId);
    localStorage.setItem(`trial_sessions_${caseId}`, JSON.stringify(updated));
    return;
  }

  const { error } = await client.from('trial_sessions').delete().eq('id', sessionId);
  if (error) {
    console.error('[Supabase] removeSession failed', error);
    throw error;
  }
};

export const upsertPreferences = async (prefs: Record<string, any>): Promise<void> => {
  const client = getSupabaseClient();
  if (!client) return;
  const { data: { user } } = await client.auth.getUser();
  if (!user) return;
  const { error } = await client.from('profiles').update({ preferences: prefs }).eq('id', user.id);
  if (error) {
    console.error('[Supabase] upsertPreferences failed', error);
    throw error;
  }
  console.log('[DataService] Successfully synced preferences to cloud');
};

export const resetLocalCache = () => {
  clearCases();
};

export const supabaseReady = isSupabaseConfigured;
