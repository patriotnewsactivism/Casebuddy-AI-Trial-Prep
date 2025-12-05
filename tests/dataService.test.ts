import { describe, expect, it, vi } from 'vitest';
import { fetchCases } from '../services/dataService';
import { CaseStatus } from '../types';

const mocks = vi.hoisted(() => ({
  loadCasesMock: vi.fn(),
}));

vi.mock('../services/supabaseClient', () => ({
  getSupabaseClient: () => null,
  isSupabaseConfigured: () => false,
}));

vi.mock('../utils/storage', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('../utils/storage');
  return {
    ...actual,
    loadCases: mocks.loadCasesMock,
    saveCases: vi.fn(),
    clearCases: vi.fn(),
  };
});

describe('dataService', () => {
  it('falls back to local cache when Supabase is not configured', async () => {
    mocks.loadCasesMock.mockReturnValueOnce([
      {
        id: 'local-1',
        title: 'Local Case',
        client: 'Client',
        status: CaseStatus.PRE_TRIAL,
        opposingCounsel: 'Opposing',
        judge: 'Judge',
        nextCourtDate: 'TBD',
        summary: 'Summary',
        winProbability: 50,
      },
    ]);

    const cases = await fetchCases();
    expect(mocks.loadCasesMock).toHaveBeenCalledTimes(1);
    expect(cases).toHaveLength(1);
    expect(cases[0].id).toBe('local-1');
    expect(cases[0].evidence).toEqual([]);
    expect(cases[0].tasks).toEqual([]);
  });
});
