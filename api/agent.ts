// CaseBuddy AI — the firm's own AI backend (Vercel serverless function).
// Replaces the third-party Base44 superagent as the primary brain so the
// agents stay up even when external services hit quota. Calls Google Gemini
// directly with a server-side key (set GEMINI_API_KEY in Vercel env vars).
//
// POST /api/agent  { task: 'aiParalegal'|'trialCoach'|'analyzeDocument'|'discoveryMiner', payload: {...} }
// Responses mirror the shapes the frontend already consumes.

const GEMINI_KEY = process.env.GEMINI_API_KEY || process.env.REACT_APP_GEMINI_API_KEY || '';
const PRIMARY_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const FALLBACK_MODEL = 'gemini-2.0-flash';

interface ChatMessage { role: string; content: string; }

async function callGemini(model: string, system: string, messages: ChatMessage[]): Promise<string> {
  const contents = (messages.length ? messages : [{ role: 'user', content: 'Begin the conversation with your opening message.' }])
    .map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: system }] },
        contents,
        generationConfig: { temperature: 0.7, maxOutputTokens: 8192 },
      }),
    }
  );
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json?.error?.message || `Gemini HTTP ${res.status}`);
  }
  const text = (json?.candidates?.[0]?.content?.parts || [])
    .map((p: any) => p.text || '')
    .join('')
    .trim();
  if (!text) throw new Error('Empty model response');
  return text;
}

async function generate(system: string, messages: ChatMessage[]): Promise<string> {
  try {
    return await callGemini(PRIMARY_MODEL, system, messages);
  } catch (e) {
    if (FALLBACK_MODEL && FALLBACK_MODEL !== PRIMARY_MODEL) {
      return await callGemini(FALLBACK_MODEL, system, messages);
    }
    throw e;
  }
}

function extractJson(text: string): any | null {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try { return JSON.parse(match[0]); } catch { return null; }
}

function parseIntakeSummary(reply: string): any | null {
  const match = reply.match(/<INTAKE_SUMMARY>([\s\S]*?)<\/INTAKE_SUMMARY>/);
  if (!match) return null;
  try { return JSON.parse(match[1].replace(/```json|```/g, '').trim()); } catch { return null; }
}

const TRIAL_ROLES: Record<string, string> = {
  opposing_counsel: 'a ruthless, highly skilled opposing counsel',
  judge: 'a no-nonsense federal judge who demands precision and proper procedure',
  hostile_witness: 'a hostile witness who is evasive, defensive, and resistant',
  friendly_witness: 'a cooperative witness for our side',
  expert_witness: 'a credentialed expert witness who defends their methodology',
  prosecutor: 'an aggressive Assistant United States Attorney',
  juror: 'a skeptical juror who voices doubts plainly',
};

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'POST only' });
    return;
  }
  if (!GEMINI_KEY) {
    // Not configured — the frontend falls back to the legacy backend.
    res.status(501).json({ error: 'not_configured' });
    return;
  }

  const { task, payload = {} } = (typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body) || {};

  try {
    if (task === 'aiParalegal') {
      const system = payload.agentPersona || 'You are a helpful, professional AI legal assistant named Maya.';
      const reply = await generate(system, payload.messages || []);
      res.status(200).json({ reply, intakeSummary: parseIntakeSummary(reply) });
      return;
    }

    if (task === 'trialCoach') {
      const cfg = payload.config || {};
      const system = `You are Rex, CaseBuddy AI's battle-hardened trial coach, currently playing ${TRIAL_ROLES[cfg.role] || 'a formidable courtroom adversary'} in a ${cfg.mode || 'courtroom'} simulation at "${cfg.difficulty || 'Practice'}" difficulty.
Stay fully in character and challenge the user hard — that's how they improve. Keep replies tight and realistic for live courtroom dialogue (2-6 sentences unless asked for written work).
${cfg.witness_profile ? `WITNESS PROFILE: ${cfg.witness_profile}` : ''}
${cfg.case_facts ? `CASE CONTEXT:\n${cfg.case_facts}` : ''}`;
      const reply = await generate(system, payload.messages || []);
      res.status(200).json({ reply });
      return;
    }

    if (task === 'analyzeDocument') {
      const system = `You are Doc, CaseBuddy AI's meticulous legal document analyst.
If the user's message contains its own explicit instructions or a JSON schema to follow, follow those instructions EXACTLY and output in the requested format.
Otherwise, analyze the provided document and respond with ONLY a JSON object:
{"summary":"2-3 sentence summary","key_facts":["fact"],"gems":["statement or fact that strongly helps the client"],"risks":["risk, inconsistency or admissibility concern"],"admissibility":"brief admissibility assessment","motions_suggested":["motion worth filing"]}`;
      const userText = `DOCUMENT TYPE: ${payload.document_type || 'Unknown'}
${payload.case_summary ? `CASE CONTEXT: ${payload.case_summary}\n` : ''}
CONTENT:
${String(payload.text || '').slice(0, 28000)}`;
      const raw = await generate(system, [{ role: 'user', content: userText }]);
      res.status(200).json({ analysis: extractJson(raw) || raw });
      return;
    }

    if (task === 'discoveryMiner') {
      const docs = (payload.documents || [])
        .map((d: any, i: number) => `--- DOCUMENT ${i + 1}: "${d.title}" (${d.document_type}) ---\n${String(d.content_text || '').slice(0, 12000)}`)
        .join('\n\n');
      const system = `You are Doc, CaseBuddy AI's forensic discovery analyst. Cross-reference ALL provided documents against each other and the case theory. Respond with ONLY a JSON object:
{"overall_assessment":"2-3 sentence strategic assessment","smoking_guns":[{"document":"title","quote":"exact quote","significance":"why it matters","action":"how to use it"}],"contradictions":[{"contradiction":"what conflicts","doc1":"title","doc2":"title","exploit":"how to exploit it"}],"timeline":[{"date":"YYYY-MM-DD or description","event":"what happened","document_source":"title"}],"missing_documents":["document that should exist but wasn't provided"]}`;
      const userText = `CASE THEORY (representing ${payload.side || 'Plaintiff'}): ${payload.case_theory || 'Not provided'}\n\n${docs}`;
      const raw = await generate(system, [{ role: 'user', content: userText }]);
      res.status(200).json({ mining_results: extractJson(raw) || { overall_assessment: raw } });
      return;
    }

    res.status(400).json({ error: `Unknown task: ${task}` });
  } catch (e: any) {
    res.status(502).json({ error: String(e?.message || e) });
  }
}
