export interface StoredAudioSettings {
  preferElevenLabs?: boolean;
  volume?: number;
  defaultVoice?: string;
}

export const AUDIO_SETTINGS_STORAGE_KEY = 'audioSettings';

export const loadAudioSettings = (): StoredAudioSettings => {
  if (typeof window === 'undefined') {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(AUDIO_SETTINGS_STORAGE_KEY);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw) as StoredAudioSettings;
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
};

export const shouldPreferElevenLabs = (defaultValue = true): boolean => {
  const settings = loadAudioSettings();
  if (typeof settings.preferElevenLabs === 'boolean') {
    return settings.preferElevenLabs;
  }
  return defaultValue;
};
