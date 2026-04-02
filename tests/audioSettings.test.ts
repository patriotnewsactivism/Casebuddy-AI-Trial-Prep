import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AUDIO_SETTINGS_STORAGE_KEY, loadAudioSettings, shouldPreferElevenLabs } from '../utils/audioSettings';

describe('audioSettings', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('returns stored audio settings when JSON is valid', () => {
    localStorage.setItem(AUDIO_SETTINGS_STORAGE_KEY, JSON.stringify({ preferElevenLabs: true, volume: 60 }));

    expect(loadAudioSettings()).toEqual({ preferElevenLabs: true, volume: 60 });
  });

  it('returns empty object when JSON is invalid', () => {
    localStorage.setItem(AUDIO_SETTINGS_STORAGE_KEY, '{not-json');

    expect(loadAudioSettings()).toEqual({});
  });

  it('prefers explicit user setting over default', () => {
    localStorage.setItem(AUDIO_SETTINGS_STORAGE_KEY, JSON.stringify({ preferElevenLabs: false }));

    expect(shouldPreferElevenLabs(true)).toBe(false);
  });

  it('falls back to provided default when no preference is stored', () => {
    expect(shouldPreferElevenLabs(false)).toBe(false);
    expect(shouldPreferElevenLabs(true)).toBe(true);
  });
});
