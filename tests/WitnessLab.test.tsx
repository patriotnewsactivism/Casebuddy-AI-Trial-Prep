import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import WitnessLab from '../components/WitnessLab';
import { AppContext } from '../App';
import * as transcriptionService from '../services/transcriptionService';
import * as geminiService from '../services/geminiService';
import * as elevenLabsService from '../services/elevenLabsService';
import { TranscriptionProvider, TranscriptionResultData } from '../types';

// Mock services
vi.mock('../services/transcriptionService', () => ({
  transcribeAudio: vi.fn(),
}));

vi.mock('../services/geminiService', () => ({
  generateWitnessResponse: vi.fn(),
  clearChatSession: vi.fn(),
}));

vi.mock('../services/elevenLabsService', () => ({
  synthesizeSpeech: vi.fn(),
  playAudioBuffer: vi.fn(),
  getTrialVoicePreset: vi.fn(() => ({ voiceId: 'mock-voice-id' })),
}));

// Mock URL.createObjectURL
global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');

// Mock MediaRecorder
const mockMediaRecorder = {
  start: vi.fn(),
  stop: vi.fn(),
  ondataavailable: vi.fn(),
  onstop: vi.fn(),
};

global.MediaRecorder = vi.fn(() => mockMediaRecorder) as any;

// Mock getUserMedia
Object.defineProperty(global.navigator, 'mediaDevices', {
  value: {
    getUserMedia: vi.fn().mockResolvedValue({
      getTracks: () => [{ stop: vi.fn() }],
    }),
  },
});

// Mock scrollIntoView
window.HTMLElement.prototype.scrollIntoView = vi.fn();

describe('WitnessLab Voice Workflow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockContext = {
    cases: [],
    activeCase: { id: 'case-1', title: 'Test Case', summary: 'A test case.' } as any,
    setActiveCase: vi.fn(),
    addCase: vi.fn(),
    updateCase: vi.fn(),
    deleteCase: vi.fn(),
    addEvidence: vi.fn(),
    theme: 'dark' as const,
    setTheme: vi.fn(),
  };

  it('handles voice recording and transcription correctly', async () => {
    // Mock successful transcription
    (transcriptionService.transcribeAudio as any).mockResolvedValue({
      text: 'Hello, witness.',
      providerUsed: TranscriptionProvider.GEMINI,
    } as TranscriptionResultData);

    // Mock witness response
    (geminiService.generateWitnessResponse as any).mockResolvedValue('Hello, attorney.');

    // Mock TTS success
    (elevenLabsService.synthesizeSpeech as any).mockResolvedValue(new ArrayBuffer(10));

    render(
      <AppContext.Provider value={mockContext}>
        <WitnessLab />
      </AppContext.Provider>
    );

    const micButton = screen.getByTitle('Hold to speak');

    // Start recording
    fireEvent.mouseDown(micButton);
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalled();
    await waitFor(() => expect(mockMediaRecorder.start).toHaveBeenCalled());

    // Stop recording
    fireEvent.mouseUp(micButton);
    expect(mockMediaRecorder.stop).toHaveBeenCalled();

    // Simulate MediaRecorder data available and stop event
    const audioBlob = new Blob(['mock audio'], { type: 'audio/wav' });
    mockMediaRecorder.ondataavailable({ data: audioBlob });
    mockMediaRecorder.onstop();

    // Verify transcription called
    await waitFor(() => {
      expect(transcriptionService.transcribeAudio).toHaveBeenCalledWith(
        expect.any(Blob),
        '',
        expect.objectContaining({ provider: TranscriptionProvider.GEMINI })
      );
    });

    // Verify witness response generation
    await waitFor(() => {
      expect(geminiService.generateWitnessResponse).toHaveBeenCalledWith(
        expect.stringContaining('witness-'),
        'Hello, witness.',
        expect.any(String),
        expect.any(String),
        expect.any(String)
      );
    });

    // Verify TTS called
    await waitFor(() => {
      expect(elevenLabsService.synthesizeSpeech).toHaveBeenCalledWith('Hello, attorney.');
    });

    // Verify Audio Playback called
    await waitFor(() => {
      expect(elevenLabsService.playAudioBuffer).toHaveBeenCalled();
    });
  });
});
