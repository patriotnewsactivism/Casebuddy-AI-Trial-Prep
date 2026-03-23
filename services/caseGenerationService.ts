import { Case, CaseStatus, ClientProfile, CourtDate, FiledMotion, TimelineEvent } from '../types';
import { callGeminiProxy } from './apiProxy';
import { Type } from '@google/genai';

export const generateRealisticCase = async (prompt: string): Promise<Partial<Case>> => {
  const systemPrompt = `You are a legal case generator. Create a highly realistic and detailed legal case based on the user's brief description.
  Include realistic parties, docket numbers, court locations (e.g., "Southern District of New York", "Harris County District Court"), and a detailed summary of the legal theory and key issues.

  Also generate initial court dates, pending motions, and timeline events. The case should feel like it's pulled from a real law firm's database.`;

  try {
    const response = await callGeminiProxy({
      prompt: `Generate a realistic legal case based on this: ${prompt}`,
      systemPrompt,
      model: 'gemini-2.5-flash',
      options: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            client: { type: Type.STRING },
            opposingParty: { type: Type.STRING },
            opposingCounsel: { type: Type.STRING },
            judge: { type: Type.STRING },
            docketNumber: { type: Type.STRING },
            courtLocation: { type: Type.STRING },
            jurisdiction: { type: Type.STRING },
            summary: { type: Type.STRING },
            legalTheory: { type: Type.STRING },
            keyIssues: { type: Type.ARRAY, items: { type: Type.STRING } },
            clientType: { type: Type.STRING, enum: ['plaintiff', 'defendant', 'prosecution'] },
            clientProfile: {
              type: Type.OBJECT,
              properties: {
                fullName: { type: Type.STRING },
                email: { type: Type.STRING },
                phone: { type: Type.STRING },
                retainerAmount: { type: Type.NUMBER },
                billingRate: { type: Type.NUMBER },
              },
            },
            initialCourtDates: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  date: { type: Type.STRING },
                  type: { type: Type.STRING, enum: ['hearing', 'trial', 'deposition', 'mediation', 'deadline', 'other'] },
                  notes: { type: Type.STRING },
                },
              },
            },
            initialMotions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  type: { type: Type.STRING, enum: ['motion', 'pleading', 'brief', 'order', 'stipulation'] },
                  status: { type: Type.STRING, enum: ['drafting', 'filed', 'pending', 'granted', 'denied', 'moot', 'withdrawn'] },
                  notes: { type: Type.STRING },
                },
              },
            },
            seedTimelineEvents: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  date: { type: Type.STRING },
                  description: { type: Type.STRING },
                  type: { type: Type.STRING, enum: ['incident', 'evidence', 'witness', 'filing', 'hearing', 'other'] },
                  importance: { type: Type.STRING, enum: ['low', 'medium', 'high', 'critical'] },
                },
              },
            },
          },
          required: ['title', 'client', 'summary']
        }
      }
    });

    if (!response.success || !response.text) {
      throw new Error(response.error?.message || 'Failed to generate case: Empty response from AI');
    }

    const cleaned = response.text.replace(/^```(?:json)?\s*/m, '').replace(/\s*```\s*$/m, '').trim();
    const data = JSON.parse(cleaned);

    // Map initialCourtDates to courtDates with IDs
    const courtDates: CourtDate[] = (data.initialCourtDates || []).map((cd: any) => ({
      id: crypto.randomUUID(),
      caseId: '',
      title: cd.title || '',
      date: cd.date || '',
      type: cd.type || 'other',
      notes: cd.notes,
      completed: false,
    }));

    // Map initialMotions to motions with IDs
    const motions: FiledMotion[] = (data.initialMotions || []).map((m: any) => ({
      id: crypto.randomUUID(),
      caseId: '',
      title: m.title || '',
      type: m.type || 'motion',
      status: m.status || 'drafting',
      notes: m.notes,
    }));

    // Map seedTimelineEvents to timelineEvents with IDs
    const timelineEvents: TimelineEvent[] = (data.seedTimelineEvents || []).map((e: any) => ({
      id: crypto.randomUUID(),
      title: e.title || '',
      date: e.date || '',
      description: e.description || '',
      type: e.type || 'other',
      importance: e.importance || 'medium',
    }));

    const clientProfile: ClientProfile | undefined = data.clientProfile ? {
      fullName: data.clientProfile.fullName || '',
      email: data.clientProfile.email,
      phone: data.clientProfile.phone,
      retainerAmount: data.clientProfile.retainerAmount,
      billingRate: data.clientProfile.billingRate,
    } : undefined;

    return {
      ...data,
      status: CaseStatus.PRE_TRIAL,
      winProbability: 50,
      evidence: [],
      tasks: [],
      nextCourtDate: 'TBD',
      clientProfile,
      courtDates,
      motions,
      timelineEvents,
      budgetEntries: [],
      expertWitnesses: [],
    };
  } catch (error) {
    console.error('Failed to generate realistic case:', error);
    throw error;
  }
};
