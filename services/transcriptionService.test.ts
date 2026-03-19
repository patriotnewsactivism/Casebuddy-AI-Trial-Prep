import { describe, expect, it } from 'vitest';
import { parseSegmentsFromResponse } from './transcriptionService';

describe('parseSegmentsFromResponse', () => {
  it('parses plain JSON array responses', () => {
    const response = JSON.stringify([
      { start: 0, end: 1.5, speaker: 'Speaker 1', text: 'Hello' },
      { start: 1.5, end: 3, speaker: 'Speaker 2', text: 'World' }
    ]);

    const result = parseSegmentsFromResponse(response);

    expect(result).toEqual([
      { start: 0, end: 1.5, speaker: 'Speaker 1', text: 'Hello' },
      { start: 1.5, end: 3, speaker: 'Speaker 2', text: 'World' }
    ]);
  });

  it('parses fenced JSON and normalizes malformed values', () => {
    const response = "```json\n[{\"start\":\"2.1\",\"end\":null,\"speaker\":null,\"text\":\"  Statement  \"}]\n```";

    const result = parseSegmentsFromResponse(response);

    expect(result).toEqual([
      { start: 2.1, end: 0, speaker: 'Speaker', text: 'Statement' }
    ]);
  });

  it('filters empty text segments', () => {
    const response = JSON.stringify([
      { start: 0, end: 1, speaker: 'A', text: '   ' },
      { start: 1, end: 2, speaker: 'B', text: 'Valid' }
    ]);

    const result = parseSegmentsFromResponse(response);

    expect(result).toEqual([
      { start: 1, end: 2, speaker: 'B', text: 'Valid' }
    ]);
  });

  it('throws for non-array payloads', () => {
    const response = JSON.stringify({ text: 'not an array' });

    expect(() => parseSegmentsFromResponse(response)).toThrow('Transcription response was not a JSON array');
  });
});
