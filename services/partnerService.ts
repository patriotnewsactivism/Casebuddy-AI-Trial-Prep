/**
 * AI Partner Service — Senior case strategist
 *
 * Deep case analysis that a senior managing partner would do:
 * - Full case health assessment
 * - Weakness identification & mitigation strategies
 * - Win probability with explanation
 * - Opposing counsel prediction (what they'll argue)
 * - Pre-trial checklist
 * - Settlement vs. trial recommendation
 * - Devil's advocate briefing
 */

import { GoogleGenAI, Type } from '@google/genai';
import { Case } from '../types';

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

// ── Types ────────────────────────────────────────────────────────────────────

export interface CaseHealthReport {
  overallScore: number;          // 0-100
  verdict: string;               // "Strong case" | "Needs work" | etc
  strengths: StrengthWeakness[];
  weaknesses: StrengthWeakness[];
  criticalIssues: string[];
  winProbability: number;
  winExplanation: string;
  timestamp: string;
}

export interface StrengthWeakness {
  title: string;
  detail: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  mitigation?: string;          // For weaknesses: how to fix
}

export interface OpposingCounselBrief {
  theirTheory: string;
  keyArguments: OpposingArgument[];
  likelyMotions: string[];
  crossExamTargets: string[];
  evidenceTheyWillUse: string[];
  surpriseMoves: string[];
}

export interface OpposingArgument {
  argument: string;
  strength: 'weak' | 'moderate' | 'strong';
  yourCounter: string;
  caseLaw?: string;
}

export interface PreTrialChecklist {
  items: ChecklistItem[];
  completionPercentage: number;
  nextDeadline?: string;
}

export interface ChecklistItem {
  category: 'discovery' | 'motions' | 'witnesses' | 'evidence' | 'strategy' | 'logistics';
  task: string;
  status: 'done' | 'in_progress' | 'not_started' | 'overdue';
  priority: 'low' | 'medium' | 'high' | 'critical';
  deadline?: string;
  notes?: string;
}

export interface SettlementAssessment {
  recommendation: 'settle' | 'trial' | 'negotiate';
  confidence: number;
  reasoning: string;
  settlementRange: { low: number; mid: number; high: number };
  trialRange: { low: number; mid: number; high: number };
  riskFactors: string[];
  clientConsiderations: string[];
}

export interface DevilsAdvocateBrief {
  worstCaseScenario: string;
  blindSpots: string[];
  uncomfortableQuestions: string[];
  evidenceProblems: string[];
  witnessVulnerabilities: string[];
  proceduralRisks: string[];
  juryPerception: string;
}

// ── Case Health Assessment ───────────────────────────────────────────────────

export const assessCaseHealth = async (caseData: Case): Promise<CaseHealthReport> => {
  const context = buildFullContext(caseData);

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: `You are a senior managing partner at a top litigation firm. You're reviewing this case for the first time and need to give a brutally honest assessment.

${context}

Evaluate the case like a seasoned litigator:
1. Overall health score (0-100) — be harsh
2. List specific STRENGTHS with evidence from the case
3. List specific WEAKNESSES with severity and how to mitigate each
4. Critical issues that could lose this case
5. Win probability with detailed explanation

Don't be generic. Every point must reference specific facts from THIS case.

Return JSON.`,
    config: {
      thinkingConfig: { thinkingBudget: 12000 },
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          overallScore: { type: Type.NUMBER },
          verdict: { type: Type.STRING },
          strengths: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                detail: { type: Type.STRING },
                severity: { type: Type.STRING },
              },
            },
          },
          weaknesses: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                detail: { type: Type.STRING },
                severity: { type: Type.STRING },
                mitigation: { type: Type.STRING },
              },
            },
          },
          criticalIssues: { type: Type.ARRAY, items: { type: Type.STRING } },
          winProbability: { type: Type.NUMBER },
          winExplanation: { type: Type.STRING },
        },
      },
    },
  });

  const result = JSON.parse(response.text || '{}');
  return {
    ...result,
    timestamp: new Date().toISOString(),
  };
};

// ── Opposing Counsel Prediction ──────────────────────────────────────────────

export const predictOpposingCounsel = async (caseData: Case): Promise<OpposingCounselBrief> => {
  const context = buildFullContext(caseData);

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: `You are an experienced trial attorney who has been HIRED BY THE OPPOSING SIDE. You need to build the strongest possible case against the plaintiff/defendant in this case.

${context}

Think like opposing counsel:
1. What is your theory of the case?
2. What are your strongest arguments? For each, rate strength and note the counter-argument.
3. What motions will you file?
4. Who are your cross-examination targets and what will you hit them on?
5. What evidence will you rely on most?
6. What surprise moves might you pull (ambush witnesses, last-minute exhibits, etc.)?

Cite specific case law where possible.

Return JSON.`,
    config: {
      thinkingConfig: { thinkingBudget: 8192 },
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          theirTheory: { type: Type.STRING },
          keyArguments: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                argument: { type: Type.STRING },
                strength: { type: Type.STRING },
                yourCounter: { type: Type.STRING },
                caseLaw: { type: Type.STRING },
              },
            },
          },
          likelyMotions: { type: Type.ARRAY, items: { type: Type.STRING } },
          crossExamTargets: { type: Type.ARRAY, items: { type: Type.STRING } },
          evidenceTheyWillUse: { type: Type.ARRAY, items: { type: Type.STRING } },
          surpriseMoves: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
      },
    },
  });

  return JSON.parse(response.text || '{}');
};

// ── Pre-Trial Checklist ──────────────────────────────────────────────────────

export const generatePreTrialChecklist = async (caseData: Case): Promise<PreTrialChecklist> => {
  const context = buildFullContext(caseData);

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: `You are a litigation paralegal preparing a pre-trial checklist for this case.

${context}

Generate a comprehensive pre-trial checklist organized by category. For each item:
- Determine its current status based on case facts (if evidence is gathered → done, etc.)
- Set priority (critical items that could sink the case at top)
- Add specific deadlines where applicable
- Include notes on HOW to accomplish each task

Categories: discovery, motions, witnesses, evidence, strategy, logistics

Return JSON.`,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          items: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                category: { type: Type.STRING },
                task: { type: Type.STRING },
                status: { type: Type.STRING },
                priority: { type: Type.STRING },
                deadline: { type: Type.STRING },
                notes: { type: Type.STRING },
              },
            },
          },
          completionPercentage: { type: Type.NUMBER },
          nextDeadline: { type: Type.STRING },
        },
      },
    },
  });

  return JSON.parse(response.text || '{}');
};

// ── Settlement vs Trial Assessment ───────────────────────────────────────────

export const assessSettlement = async (caseData: Case): Promise<SettlementAssessment> => {
  const context = buildFullContext(caseData);

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: `You are a senior litigator advising your client on whether to settle or go to trial.

${context}

Provide a thorough settlement vs. trial analysis:
1. Your recommendation (settle / trial / negotiate further) with confidence level
2. Detailed reasoning
3. Settlement value range (low/mid/high estimates)
4. Trial verdict range (low/mid/high if we win)
5. Risk factors that could swing the outcome
6. Client-specific considerations (financial situation, emotional toll, public exposure, etc.)

Be realistic — not optimistic. Clients need honest advice.

Return JSON.`,
    config: {
      thinkingConfig: { thinkingBudget: 8192 },
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          recommendation: { type: Type.STRING },
          confidence: { type: Type.NUMBER },
          reasoning: { type: Type.STRING },
          settlementRange: {
            type: Type.OBJECT,
            properties: {
              low: { type: Type.NUMBER },
              mid: { type: Type.NUMBER },
              high: { type: Type.NUMBER },
            },
          },
          trialRange: {
            type: Type.OBJECT,
            properties: {
              low: { type: Type.NUMBER },
              mid: { type: Type.NUMBER },
              high: { type: Type.NUMBER },
            },
          },
          riskFactors: { type: Type.ARRAY, items: { type: Type.STRING } },
          clientConsiderations: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
      },
    },
  });

  return JSON.parse(response.text || '{}');
};

// ── Devil's Advocate ─────────────────────────────────────────────────────────

export const runDevilsAdvocate = async (caseData: Case): Promise<DevilsAdvocateBrief> => {
  const context = buildFullContext(caseData);

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: `You are the devil's advocate — your job is to DESTROY this case. Find every flaw, every risk, every uncomfortable truth.

${context}

Be ruthless:
1. Worst case scenario — what does total loss look like?
2. Blind spots — what is the attorney NOT seeing?
3. Uncomfortable questions the opposing counsel WILL ask that we can't answer well
4. Evidence problems — what's weak, inadmissible, or could be challenged?
5. Witness vulnerabilities — who can be impeached and how?
6. Procedural risks — missed deadlines, standing issues, jurisdictional problems?
7. Jury perception — how does an average person see this case?

Don't be nice. Being nice loses cases.

Return JSON.`,
    config: {
      thinkingConfig: { thinkingBudget: 8192 },
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          worstCaseScenario: { type: Type.STRING },
          blindSpots: { type: Type.ARRAY, items: { type: Type.STRING } },
          uncomfortableQuestions: { type: Type.ARRAY, items: { type: Type.STRING } },
          evidenceProblems: { type: Type.ARRAY, items: { type: Type.STRING } },
          witnessVulnerabilities: { type: Type.ARRAY, items: { type: Type.STRING } },
          proceduralRisks: { type: Type.ARRAY, items: { type: Type.STRING } },
          juryPerception: { type: Type.STRING },
        },
      },
    },
  });

  return JSON.parse(response.text || '{}');
};

// ── Helper ───────────────────────────────────────────────────────────────────

const buildFullContext = (c: Case): string => `CASE: ${c.title}
Client: ${c.client}
Status: ${c.status}
Docket: ${c.docketNumber || 'N/A'}
Court: ${c.courtLocation || 'N/A'}
Jurisdiction: ${c.jurisdiction || 'Federal'}
Judge: ${c.judge || 'TBD'}
Opposing Counsel: ${c.opposingCounsel || 'Unknown'}
Opposing Party: ${c.opposingParty || 'Unknown'}
Client Type: ${c.clientType || 'Unknown'}
Next Court Date: ${c.nextCourtDate || 'Not set'}
Win Probability (current): ${c.winProbability}%
Summary: ${c.summary || 'No summary'}
Legal Theory: ${c.legalTheory || 'Not specified'}
Key Issues: ${c.keyIssues?.join(', ') || 'None listed'}
Evidence: ${c.evidence?.map(e => `${e.title || 'Untitled'} (${e.type || 'unknown'})`).join(', ') || 'None'}
Witnesses: ${c.witnesses?.map(w => `${w.name} (${w.role})`).join(', ') || 'None'}
Tasks: ${c.tasks?.map(t => `${t.title} [${t.status}]`).join(', ') || 'None'}`;
