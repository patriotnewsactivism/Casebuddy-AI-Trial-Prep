import { Case, EvidenceItem } from '../types';
import { clearCases, loadCases, saveCases } from '../utils/storage';
import { getSupabaseClient, isSupabaseConfigured } from './supabaseClient';

const isNotFoundError = (error: any) => error?.code === 'PGRST116';

const hydrateCase = (c: Case): Case => ({
  ...c,
  evidence: c.evidence || [],
  tasks: c.tasks || [],
  tags: c.tags || [],
});

const cacheCases = (cases: Case[]) => {
  // Always keep a local cache for offline usage
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

  const hydrated = (data || []).map(hydrateCase);
  cacheCases(hydrated);
  return hydrated;
};

export const upsertCase = async (caseRecord: Case): Promise<void> => {
  const client = getSupabaseClient();
  if (!client) {
    const current = loadCases().filter(c => c.id !== caseRecord.id);
    cacheCases([...current, hydrateCase(caseRecord)]);
    return;
  }

  const { error } = await client.from('cases').upsert(caseRecord, { 
    onConflict: 'id' 
  });
  if (error) {
    console.error('[Supabase] upsertCase failed', error);
    throw error;
  }
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
