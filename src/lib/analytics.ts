// CaseBuddy AI — lightweight, pluggable analytics (TODO 5.3)
// Sends events to PostHog's capture API when REACT_APP_POSTHOG_KEY is set;
// a silent no-op otherwise. No SDK dependency, no cookies, never blocks the
// UI, and never sends case content — event names + coarse properties only.

const KEY = process.env.REACT_APP_POSTHOG_KEY || '';
const HOST = process.env.REACT_APP_POSTHOG_HOST || 'https://us.i.posthog.com';

function distinctId(): string {
  let id = localStorage.getItem('cb_distinct_id');
  if (!id) {
    id = Date.now().toString(36) + Math.random().toString(36).slice(2);
    localStorage.setItem('cb_distinct_id', id);
  }
  return id;
}

export function track(event: string, properties: Record<string, string | number | boolean> = {}) {
  if (!KEY) return;
  try {
    fetch(`${HOST}/capture/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
      body: JSON.stringify({
        api_key: KEY,
        event,
        distinct_id: distinctId(),
        properties: { ...properties, $current_url: window.location.pathname },
        timestamp: new Date().toISOString(),
      }),
    }).catch(() => {});
  } catch {
    // Analytics must never break the app.
  }
}
