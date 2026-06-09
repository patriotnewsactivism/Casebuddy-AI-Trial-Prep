const BASE_URL = process.env.REACT_APP_BASE44_API_URL || 'https://superagent-344f8b2b.base44.app';

async function callFunction(name: string, payload: any) {
  const token = localStorage.getItem('cb_token') || '';
  const res = await fetch(`${BASE_URL}/functions/${name}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  return res.json();
}

export const analyzeDocument = (payload: any) => callFunction('analyzeDocument', payload);
export const aiParalegal = (payload: any) => callFunction('aiParalegal', payload);
export const discoveryMiner = (payload: any) => callFunction('discoveryMiner', payload);
export const trialCoach = (payload: any) => callFunction('trialCoach', payload);
