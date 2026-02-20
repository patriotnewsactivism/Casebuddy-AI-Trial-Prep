import { Case, EvidenceItem } from '../types';
import { clearCases, loadCases, saveCases } from '../utils/storage';
import { getSupabaseClient, isSupabaseConfigured } from './supabaseClient';

const isNotFoundError = (error: any) => error?.code === 'PGRST116';
const isColumnMismatchError = (error: any) => {
  const message = `${error?.message || ''} ${error?.details || ''} ${error?.hint || ''}`.toLowerCase();
  return message.includes('column') && (message.includes('does not exist') || message.includes('could not find'));
};

type CaseColumnStyle = 'snake' | 'camel';
let detectedCaseColumnStyle: CaseColumnStyle | null = null;

const getFallbackCaseColumnStyle = (style: CaseColumnStyle): CaseColumnStyle => {
  return style === 'snake' ? 'camel' : 'snake';
};

// Map TypeScript camelCase to database columns.
// Some deployments use snake_case columns, others use camelCase.
function caseToRow(c: Case, style: CaseColumnStyle): Record<string, any> {
  const base = {
    id: c.id,
    title: c.title,
    client: c.client,
    status: c.status,
    judge: c.judge,
    summary: c.summary,
    tags: c.tags || [],
    evidence: c.evidence || [],
    tasks: c.tasks || [],
  };

  if (style === 'camel') {
    return {
      ...base,
      opposingCounsel: c.opposingCounsel,
      nextCourtDate: c.nextCourtDate,
      winProbability: c.winProbability,
    };
  }

  return {
    ...base,
    opposing_counsel: c.opposingCounsel,
    next_court_date: c.nextCourtDate,
    win_probability: c.winProbability,
  };
}

// Map database snake_case columns to TypeScript camelCase
function rowToCase(row: any): Case {
  return {
    id: row.id,
    title: row.title,
    client: row.client,
    status: row.status,
    opposingCounsel: row.opposing_counsel ?? row.opposingcounsel ?? row.opposingCounsel,
    judge: row.judge,
    nextCourtDate: row.next_court_date ?? row.nextcourtdate ?? row.nextCourtDate,
    summary: row.summary,
    winProbability: row.win_probability ?? row.winprobability ?? row.winProbability,
    tags: row.tags || [],
    evidence: row.evidence || [],
    tasks: row.tasks || [],
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
    return loadCases().map(hydrateCase);
  }

  const { data, error } = await client.from('cases').select('*');
  if (error) {
    console.error('[Supabase] fetchCases failed; falling back to local cache', error);
    return loadCases().map(hydrateCase);
  }

  const cases = (data || []).map(rowToCase);
  cacheCases(cases);
  return cases;
};

export const upsertCase = async (caseRecord: Case): Promise<void> => {
  const client = getSupabaseClient();
  if (!client) {
    const current = loadCases().filter(c => c.id !== caseRecord.id);
    cacheCases([...current, hydrateCase(caseRecord)]);
    return;
  }

  const stylesToTry: CaseColumnStyle[] = detectedCaseColumnStyle
    ? [detectedCaseColumnStyle, getFallbackCaseColumnStyle(detectedCaseColumnStyle)]
    : ['snake', 'camel'];

  let lastError: any = null;

  for (const style of stylesToTry) {
    const row = caseToRow(caseRecord, style);
    const { error } = await client.from('cases').upsert(row, { onConflict: 'id' });

    if (!error) {
      detectedCaseColumnStyle = style;
      return;
    }

    lastError = error;
    if (!isColumnMismatchError(error)) {
      break;
    }
  }

  console.error('[Supabase] upsertCase failed', lastError);
  throw lastError;
};

export const removeCase = async (caseId: string): Promise<void> => {
  const client = getSupabaseClient();
  if (!client) {
    const updated = loadCases().filter(c => c.id !== caseId);
    cacheCases(updated);
    return;
  }

  const { error } = await client.from('cases').delete().eq('id', caseId);
  if (error) {
    console.error('[Supabase] removeCase failed', error);
    throw error;
  }
};

export const appendEvidence = async (caseId: string, evidence: EvidenceItem): Promise<void> => {
  const client = getSupabaseClient();
  if (!client) {
    const updated = loadCases().map(c => c.id === caseId ? { ...c, evidence: [...(c.evidence || []), evidence] } : c);
    cacheCases(updated);
    return;
  }

  const { data, error } = await client.from('cases').select('evidence').eq('id', caseId).single();
  
  if (error) {
    if (isNotFoundError(error)) {
      const { error: insertError } = await client.from('cases').insert({
        id: caseId,
        evidence: [evidence],
      });
      if (insertError) {
        console.error('[Supabase] appendEvidence insert failed', insertError);
        throw insertError;
      }
      return;
    }
    console.error('[Supabase] fetch evidence failed', error);
    throw error;
  }

  const existingEvidence: EvidenceItem[] = Array.isArray(data?.evidence) ? data.evidence : [];
  const nextEvidence = [...existingEvidence, evidence];

  const { error: updateError } = await client.from('cases').update({ evidence: nextEvidence }).eq('id', caseId);
  if (updateError) {
    console.error('[Supabase] appendEvidence failed', updateError);
    throw updateError;
  }
};

export const resetLocalCache = () => {
  clearCases();
};

export const supabaseReady = isSupabaseConfigured;
