import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import CaseManager from '../components/CaseManager';
import { AppContext } from '../App';
import * as geminiService from '../services/geminiService';
import { Case, CaseStatus } from '../types';

// Mock services
vi.mock('../services/geminiService', () => ({
  analyzeDocument: vi.fn(),
  analyzePDFDocument: vi.fn(),
  fileToGenerativePart: vi.fn(),
}));

describe('CaseManager OCR Flow', () => {
  const mockCase: Case = {
    id: 'case-1',
    title: 'Test Case',
    client: 'Test Client',
    status: CaseStatus.PRE_TRIAL,
    opposingCounsel: 'Opposing Counsel',
    judge: 'Judge',
    nextCourtDate: 'TBD',
    summary: 'Case Summary',
    winProbability: 50,
    evidence: [],
    tasks: [],
  };

  const mockAddEvidence = vi.fn();

  const renderWithContext = () => {
    return render(
      <AppContext.Provider
        value={{
          cases: [mockCase],
          activeCase: mockCase,
          setActiveCase: vi.fn(),
          addCase: vi.fn(),
          updateCase: vi.fn(),
          deleteCase: vi.fn(),
          addEvidence: mockAddEvidence,
          theme: 'dark',
          setTheme: vi.fn(),
        }}
      >
        <CaseManager />
      </AppContext.Provider>
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('handles file upload and triggers OCR processing', async () => {
    // Mock Gemini result
    const mockAnalysisResult = {
      summary: 'This is extracted text from an image.',
      entities: ['John Doe'],
      risks: [],
      documentType: 'Image Document',
      keyDates: [],
      monetaryAmounts: ['$100'],
      extractedText: 'This is extracted text from an image.',
      confidence: 95
    };

    (geminiService.analyzeDocument as any).mockResolvedValue(mockAnalysisResult);

    renderWithContext();

    // Find the file input
    const fileInput = screen.getByLabelText(/Upload Single/i);
    
    // Create a mock file
    const file = new File(['(binary content)'], 'test-evidence.png', { type: 'image/png' });

    // Simulate upload
    fireEvent.change(fileInput, { target: { files: [file] } });

    // Verify loading state
    expect(screen.getByText(/Processing/i)).toBeInTheDocument();

    // Verify analyzeDocument was called
    await waitFor(() => {
      expect(geminiService.analyzeDocument).toHaveBeenCalled();
    });

    // Verify results are displayed
    await waitFor(() => {
      expect(screen.getByText('This is extracted text from an image.')).toBeInTheDocument();
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    // Save to case
    const saveButton = screen.getByRole('button', { name: /Save to case/i });
    fireEvent.click(saveButton);

    // Verify addEvidence was called
    await waitFor(() => {
      expect(mockAddEvidence).toHaveBeenCalledWith(
        'case-1',
        expect.objectContaining({
          title: 'test-evidence.png',
          summary: expect.stringContaining('extracted text'),
          fileName: 'test-evidence.png'
        })
      );
    });
  });
});
