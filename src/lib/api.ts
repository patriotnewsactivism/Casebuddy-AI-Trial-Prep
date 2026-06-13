// CaseBuddy AI — frontend API layer.
// Primary brain: our own serverless function (/api/agent → Gemini, key
// server-side). Fallback: the legacy Base44 superagent. If both fail, a
// friendly message is returned so agents never go silent.

const BASE_URL = process.env.REACT_APP_BASE44_API_URL || 'https://superagent-344f8b2b.base44.app';

function friendlyError(detail: string): string {
  if (/429|too many tokens|rate limit|quota|capacity|RESOURCE_EXHAUSTED/i.test(detail)) {
    return "I'm so sorry — our AI service has hit its capacity limit and I can't process requests right now. Your conversation is saved; please try again in a little while.";
  }
  if (/timeout|abort/i.test(detail)) {
    return "I'm sorry — that took too long to process. Could you try saying that again?";
  }
  return "I'm sorry — I'm having trouble reaching the AI service right now. Please give it a moment and try again.";
}

async function postJson(url: string, body: any, headers: Record<string, string>, timeoutMs: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    let json: any = {};
    try { json = await res.json(); } catch { json = {}; }
    return { ok: res.ok, status: res.status, json };
  } finally {
    clearTimeout(timer);
  }
}

function hasUsefulResult(json: any): boolean {
  return !!(json && !json.error && (json.reply || json.analysis || json.mining_results));
}

async function callFunction(name: string, payload: any) {
  let lastDetail = '';

  // 1) Our own backend
  try {
    const own = await postJson('/api/agent', { task: name, payload }, {}, 55000);
    if (own.ok && hasUsefulResult(own.json)) return own.json;
    lastDetail = String(own.json?.error || `HTTP ${own.status}`);
  } catch (e: any) {
    lastDetail = String(e?.message || e);
  }

  // 2) Legacy Base44 backend
  try {
    const token = localStorage.getItem('cb_token') || '';
    const legacy = await postJson(
      `${BASE_URL}/functions/${name}`,
      payload,
      { 'Authorization': `Bearer ${token}` },
      55000
    );
    if (hasUsefulResult(legacy.json)) return legacy.json;
    lastDetail = String(legacy.json?.error || lastDetail || `HTTP ${legacy.status}`);
  } catch (e: any) {
    lastDetail = String(e?.message || e) || lastDetail;
  }

  return { reply: friendlyError(lastDetail), serviceError: lastDetail };
}

export const analyzeDocument = (payload: any) => callFunction('analyzeDocument', payload);
export const aiParalegal = (payload: any) => callFunction('aiParalegal', payload);
export const discoveryMiner = (payload: any) => callFunction('discoveryMiner', payload);
export const trialCoach = (payload: any) => callFunction('trialCoach', payload);
