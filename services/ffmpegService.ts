/**
 * FFmpeg Service — stub
 * Full audio extraction requires @ffmpeg/ffmpeg which is loaded lazily.
 * Falls back gracefully when FFmpeg is unavailable.
 */

export const extractAudio = async (
  _file: File,
  _options?: { format?: string; sampleRate?: number },
): Promise<Blob | null> => {
  console.warn('[ffmpegService] FFmpeg not available — returning null.');
  return null;
};

export const isFFmpegSupported = (): boolean => false;
