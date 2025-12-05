import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CaseManager from '../components/CaseManager';
import { AppContext } from '../App';
import { Case, CaseStatus } from '../types';

vi.mock('../services/geminiService', () => ({
  analyzeDocument: vi.fn().mockResolvedValue({
    summary: 'Mock summary',
    entities: ['Entity A'],
    risks: ['Risk 1'],
  }),
  fileToGenerativePart: vi.fn(),
}));

describe('CaseManager evidence flow', () => {
  const baseCase: Case = {
    id: 'case-1',
    title: 'Test Case',
    client: 'Client A',
    status: CaseStatus.PRE_TRIAL,
    opposingCounsel: 'Opposing Counsel',
    judge: 'Judge',
    nextCourtDate: 'TBD',
    summary: 'Summary',
    winProbability: 50,
    evidence: [],
    tasks: [],
  };

  const renderWithContext = (overrides?: Partial<React.ComponentProps<typeof CaseManager>>) => {
    const addEvidence = vi.fn(async () => {});

    render(
      <AppContext.Provider
        value={{
          cases: [baseCase],
          activeCase: baseCase,
          setActiveCase: () => {},
          addCase: async () => {},
          updateCase: async () => {},
          deleteCase: async () => {},
          addEvidence,
          theme: 'dark',
          setTheme: () => {},
        }}
      >
        <CaseManager {...overrides} />
      </AppContext.Provider>
    );

    return { addEvidence };
  };

  it('analyzes text and saves evidence to the active case', async () => {
    const { addEvidence } = renderWithContext({
      initialAnalysisResult: {
        summary: 'Mock summary',
        entities: ['Entity A'],
        risks: ['Risk 1'],
      },
    });
    const user = userEvent.setup();

    const saveButton = await screen.findByRole('button', { name: /Save to case/i });
    await user.click(saveButton);

    await waitFor(() => expect(addEvidence).toHaveBeenCalledTimes(1));
    const callArgs = addEvidence.mock.calls[0];
    expect(callArgs[0]).toBe(baseCase.id);
    expect(callArgs[1].summary).toBe('Mock summary');
  });
});
