const BASE_URL = process.env.REACT_APP_BASE44_API_URL || 'https://superagent-344f8b2b.base44.app';

// Friendly fallback so the agents never go silent — backend failures are
// spoken/shown in the conversation instead of leaving the user hanging.
function friendlyError(detail: string): string {
  if (/429|too many tokens|rate limit|quota|capacity/i.test(detail)) {
    return "I'm so sorry — our AI service has hit its daily capacity limit and I can't process requests right now. Your conversation is saved; please try again in a little while.";
  }
  if (/timeout|abort/i.test(detail)) {
    return "I'm sorry — that took too long to process. Could you try saying that again?";
  }
  return "I'm sorry — I'm having trouble reaching the AI service right now. Please give it a moment and try again.";
}

async function callFunction(name: string, payload: any) {
  const token = localStorage.getItem('cb_token') || '';
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 60000);
    const res = await fetch(`${BASE_URL}/functions/${name}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timer);
    let json: any = {};
    try { json = await res.json(); } catch { json = {}; }
    if (json.error || (!res.ok && !json.reply && !json.analysis && !json.mining_results)) {
      const detail = String(json.error || `HTTP ${res.status}`);
      return { ...json, reply: json.reply || friendlyError(detail), serviceError: detail };
    }
    return json;
  } catch (e: any) {
    const detail = String(e?.message || e);
    return { reply: friendlyError(detail), serviceError: detail };
  }
}

export const analyzeDocument = (payload: any) => callFunction('analyzeDocument', payload);
export const aiParalegal = (payload: any) => callFunction('aiParalegal', payload);
export const discoveryMiner = (payload: any) => callFunction('discoveryMiner', payload);
export const trialCoach = (payload: any) => callFunction('trialCoach', payload);
