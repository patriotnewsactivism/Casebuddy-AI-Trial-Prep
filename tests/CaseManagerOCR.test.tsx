import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import CaseManager from '../components/CaseManager';
import { AppContext } from '../App';
import * as documentProcessingService from '../services/documentProcessingService';
import { Case, CaseStatus, EvidenceItem } from '../types';

// Mock services
vi.mock('../services/documentProcessingService', () => ({
  processDocument: vi.fn(),
  toEvidenceItem: vi.fn(),
}));

vi.mock('../services/geminiService', () => ({
  analyzeDocument: vi.fn(),
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
    // Mock OCR result
    const mockProcessedDoc = {
      id: 'doc-1',
      fileName: 'test-evidence.png',
      fileType: 'image/png',
      extractedText: 'This is extracted text from an image.',
      confidence: 95,
      wordCount: 10,
      processingTime: 100,
      dates: [],
      entities: [{ name: 'John Doe', type: 'person' }],
      monetaryAmounts: ['$100'],
      potentialEvents: [],
      ocrResult: { text: 'This is extracted text from an image.', confidence: 95 }
    };

    (documentProcessingService.processDocument as any).mockResolvedValue(mockProcessedDoc);

    renderWithContext();

    // Find the file input
    const fileInput = screen.getByLabelText(/Upload Single/i);
    
    // Create a mock file
    const file = new File(['(binary content)'], 'test-evidence.png', { type: 'image/png' });

    // Simulate upload
    fireEvent.change(fileInput, { target: { files: [file] } });

    // Verify loading state
    expect(screen.getByText(/Processing/i)).toBeInTheDocument();

    // Verify processDocument was called
    await waitFor(() => {
      expect(documentProcessingService.processDocument).toHaveBeenCalledWith(
        expect.any(File),
        expect.any(Function)
      );
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
