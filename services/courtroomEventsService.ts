/**
 * Courtroom Events Service — Dynamic interruptions, objections, & jury reactions
 *
 * Works alongside the Live Trial Simulator to inject realistic courtroom events:
 * - Judge interruptions (sustained/overruled objections, warnings, bench conferences)
 * - Opposing counsel objections (triggered by detected weak arguments)
 * - Jury reaction signals (body language cues, visible reactions)
 * - Evidence presentation moments
 *
 * These events appear as overlays/notifications during the live voice session,
 * adding realism without breaking the audio flow.
 */

import { GoogleGenAI, Type } from '@google/genai';
import { TrialPhase, SimulationMode } from '../types';

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

// ── Types ────────────────────────────────────────────────────────────────────

export type EventType =
  | 'judge_interruption'
  | 'judge_ruling'
  | 'judge_warning'
  | 'opposing_objection'
  | 'opposing_sidebar'
  | 'jury_reaction'
  | 'bench_conference'
  | 'evidence_moment';

export interface CourtroomEvent {
  id: string;
  type: EventType;
  speaker: 'judge' | 'opposing_counsel' | 'jury' | 'system';
  text: string;
  subtext?: string;           // e.g., legal basis for objection
  severity: 'info' | 'warning' | 'critical';
  emoji: string;
  duration: number;           // ms to show on screen
  timestamp: number;
  requiresResponse: boolean;  // Does the user need to respond?
  suggestedResponse?: string; // Hint for what user should say
}

export interface JuryMood {
  attention: number;        // 0-100
  sympathy: number;         // 0-100
  confusion: number;        // 0-100
  engagement: number;       // 0-100
  leaningToward: 'plaintiff' | 'defense' | 'neutral';
  notableReactions: string[];
}

// ── Event Generation ─────────────────────────────────────────────────────────

/**
 * Analyzes the last few transcript turns and decides if a courtroom event
 * should fire. Called periodically during live sessions.
 */
export const evaluateForEvents = async (
  recentTranscript: Array<{ user: boolean; text: string }>,
  phase: TrialPhase,
  mode: SimulationMode,
  caseContext: string,
  eventHistory: CourtroomEvent[],
): Promise<CourtroomEvent | null> => {
  // Don't spam events — at least 15 seconds between them in learn mode, 8 in trial
  const lastEvent = eventHistory[eventHistory.length - 1];
  const minGap = mode === 'learn' ? 15000 : mode === 'practice' ? 10000 : 8000;
  if (lastEvent && Date.now() - lastEvent.timestamp < minGap) return null;

  // Need at least 2 turns to evaluate
  if (recentTranscript.length < 2) return null;

  const last3 = recentTranscript.slice(-4);
  const lastUserTurn = last3.filter(t => t.user).pop();
  if (!lastUserTurn) return null;

  // Frequency control: in learn mode, events happen ~20% of the time; trial ~60%
  const eventChance = mode === 'learn' ? 0.2 : mode === 'practice' ? 0.4 : 0.6;
  if (Math.random() > eventChance) return null;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `You are monitoring a live courtroom simulation. Analyze the recent transcript and decide if a courtroom event should occur.

TRIAL PHASE: ${phase}
DIFFICULTY: ${mode}
CASE: ${caseContext}

RECENT TRANSCRIPT:
${last3.map(t => `${t.user ? '[ATTORNEY]' : '[AI JUDGE/WITNESS]'}: ${t.text}`).join('\n')}

EVENTS THAT HAVE ALREADY FIRED:
${eventHistory.slice(-5).map(e => `- ${e.type}: ${e.text}`).join('\n') || 'None yet'}

Should a courtroom event fire right now? Consider:
- Did the attorney make a leading question during direct examination? → Opposing objects
- Did the attorney make a hearsay statement? → Opposing objects
- Was there a speculation question? → Judge may intervene
- Was the argument particularly strong? → Jury pays attention
- Is the attorney rambling? → Judge interrupts
- Was there a key admission? → Jury reacts

${mode === 'learn' ? 'This is LEARN mode — events should be educational, with explanations.' : ''}
${mode === 'trial' ? 'This is TRIAL mode — events should be aggressive and realistic.' : ''}

If no event is warranted, return shouldFire as false.
If an event should fire, provide the details.

Return JSON.`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            shouldFire: { type: Type.BOOLEAN },
            type: { type: Type.STRING, enum: ['judge_interruption', 'judge_ruling', 'judge_warning', 'opposing_objection', 'opposing_sidebar', 'jury_reaction', 'bench_conference', 'evidence_moment'] },
            speaker: { type: Type.STRING, enum: ['judge', 'opposing_counsel', 'jury', 'system'] },
            text: { type: Type.STRING },
            subtext: { type: Type.STRING },
            severity: { type: Type.STRING, enum: ['info', 'warning', 'critical'] },
            requiresResponse: { type: Type.BOOLEAN },
            suggestedResponse: { type: Type.STRING },
          },
        },
      },
    });

    const result = JSON.parse(response.text || '{}');
    if (!result.shouldFire) return null;

    const EMOJIS: Record<EventType, string> = {
      judge_interruption: '⚖️',
      judge_ruling: '🔨',
      judge_warning: '⚠️',
      opposing_objection: '🚫',
      opposing_sidebar: '🤫',
      jury_reaction: '👥',
      bench_conference: '🏛️',
      evidence_moment: '📋',
    };

    const DURATIONS: Record<EventType, number> = {
      judge_interruption: 6000,
      judge_ruling: 5000,
      judge_warning: 7000,
      opposing_objection: 5000,
      opposing_sidebar: 4000,
      jury_reaction: 4000,
      bench_conference: 8000,
      evidence_moment: 5000,
    };

    const eventType = result.type as EventType;

    return {
      id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      type: eventType,
      speaker: result.speaker || 'judge',
      text: result.text || '',
      subtext: result.subtext,
      severity: result.severity || 'info',
      emoji: EMOJIS[eventType] || '⚖️',
      duration: DURATIONS[eventType] || 5000,
      timestamp: Date.now(),
      requiresResponse: result.requiresResponse || false,
      suggestedResponse: result.suggestedResponse,
    };
  } catch (err) {
    console.warn('[CourtroomEvents] Evaluation failed:', err);
    return null;
  }
};

// ── Jury Mood Evaluation ─────────────────────────────────────────────────────

export const evaluateJuryMood = async (
  transcript: Array<{ user: boolean; text: string }>,
  phase: TrialPhase,
  caseContext: string,
): Promise<JuryMood> => {
  if (transcript.length < 4) {
    return { attention: 60, sympathy: 50, confusion: 10, engagement: 50, leaningToward: 'neutral', notableReactions: [] };
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Evaluate the jury's emotional state during this trial simulation.

PHASE: ${phase}
CASE: ${caseContext}

TRANSCRIPT (last 8 exchanges):
${transcript.slice(-8).map(t => `${t.user ? '[ATTORNEY]' : '[OPPOSING/JUDGE]'}: ${t.text}`).join('\n')}

Rate the jury's state and provide notable body language reactions.
Return JSON.`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            attention: { type: Type.NUMBER },
            sympathy: { type: Type.NUMBER },
            confusion: { type: Type.NUMBER },
            engagement: { type: Type.NUMBER },
            leaningToward: { type: Type.STRING, enum: ['plaintiff', 'defense', 'neutral'] },
            notableReactions: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
        },
      },
    });

    return JSON.parse(response.text || '{}');
  } catch {
    return { attention: 50, sympathy: 50, confusion: 20, engagement: 40, leaningToward: 'neutral', notableReactions: [] };
  }
};

// ── Pre-built Quick Events (for offline / instant triggers) ──────────────────

export const QUICK_OBJECTION_EVENTS: Record<string, Omit<CourtroomEvent, 'id' | 'timestamp'>> = {
  hearsay: {
    type: 'opposing_objection',
    speaker: 'opposing_counsel',
    text: '"Objection, Your Honor! Hearsay."',
    subtext: 'FRE 801-803 — Out-of-court statement offered for truth of the matter asserted',
    severity: 'warning',
    emoji: '🚫',
    duration: 5000,
    requiresResponse: true,
    suggestedResponse: 'Your Honor, this falls under the excited utterance exception, FRE 803(2).',
  },
  relevance: {
    type: 'opposing_objection',
    speaker: 'opposing_counsel',
    text: '"Objection — relevance, Your Honor."',
    subtext: 'FRE 401-403 — Evidence must tend to prove/disprove a fact of consequence',
    severity: 'info',
    emoji: '🚫',
    duration: 5000,
    requiresResponse: true,
    suggestedResponse: 'Your Honor, this goes directly to the defendant\'s state of mind at the time of the incident.',
  },
  leading: {
    type: 'opposing_objection',
    speaker: 'opposing_counsel',
    text: '"Objection! Counsel is leading the witness."',
    subtext: 'FRE 611(c) — Leading questions generally not allowed on direct examination',
    severity: 'warning',
    emoji: '🚫',
    duration: 5000,
    requiresResponse: true,
    suggestedResponse: 'I\'ll rephrase, Your Honor. [Witness], can you describe in your own words what happened next?',
  },
  speculation: {
    type: 'opposing_objection',
    speaker: 'opposing_counsel',
    text: '"Objection — calls for speculation."',
    subtext: 'FRE 602 — Witness may testify only to matters within personal knowledge',
    severity: 'info',
    emoji: '🚫',
    duration: 5000,
    requiresResponse: true,
    suggestedResponse: 'Your Honor, I\'m asking the witness to testify to what they personally observed.',
  },
  foundation: {
    type: 'opposing_objection',
    speaker: 'opposing_counsel',
    text: '"Objection — lack of foundation, Your Honor."',
    subtext: 'FRE 602, 901 — Must establish witness knowledge or document authenticity first',
    severity: 'warning',
    emoji: '🚫',
    duration: 5000,
    requiresResponse: true,
    suggestedResponse: 'Your Honor, allow me to lay proper foundation. [Witness], are you familiar with this document?',
  },
  asked_answered: {
    type: 'opposing_objection',
    speaker: 'opposing_counsel',
    text: '"Objection — asked and answered."',
    subtext: 'FRE 403, 611(a) — Repetitive questioning wastes time and may confuse',
    severity: 'info',
    emoji: '🚫',
    duration: 4000,
    requiresResponse: false,
  },
};

export const JUDGE_INTERRUPTIONS = {
  get_to_point: {
    type: 'judge_interruption' as EventType,
    speaker: 'judge' as const,
    text: '"Counsel, please get to the point."',
    subtext: 'The judge is losing patience with extended questioning.',
    severity: 'warning' as const,
    emoji: '⚖️',
    duration: 5000,
    requiresResponse: false,
  },
  approach_bench: {
    type: 'bench_conference' as EventType,
    speaker: 'judge' as const,
    text: '"Both counsel, approach the bench."',
    subtext: 'Sidebar conference requested.',
    severity: 'critical' as const,
    emoji: '🏛️',
    duration: 8000,
    requiresResponse: true,
    suggestedResponse: 'Your Honor, I believe this line of questioning is critical to establishing...',
  },
  sustained: {
    type: 'judge_ruling' as EventType,
    speaker: 'judge' as const,
    text: '"Sustained."',
    subtext: 'The objection was upheld. Move on to a different question.',
    severity: 'warning' as const,
    emoji: '🔨',
    duration: 3000,
    requiresResponse: false,
  },
  overruled: {
    type: 'judge_ruling' as EventType,
    speaker: 'judge' as const,
    text: '"Overruled. You may continue, counsel."',
    subtext: 'The objection was denied. Proceed.',
    severity: 'info' as const,
    emoji: '🔨',
    duration: 3000,
    requiresResponse: false,
  },
};
