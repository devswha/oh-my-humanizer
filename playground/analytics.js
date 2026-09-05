/* global window */
// Only categorical values from these allowlists can cross the application boundary.
(function initPatinaAnalytics() {
  const values = {
    surface: new Set(['hero', 'chat', 'pricing', 'quota', 'controls']),
    lang: new Set(['en', 'ko', 'zh', 'ja']),
    tier: new Set(['free', 'pro', 'byok']),
    mode: new Set(['first', 'refine', 'verify']),
    inputBucket: new Set(['0-99', '100-499', '500-1999', '2000+']),
    latencyBucket: new Set(['<5s', '5-10s', '10-30s', '30s+']),
    mpsBand: new Set(['failed', '70-79', '80-89', '90-100']),
    fidelityBand: new Set(['failed', '70-79', '80-89', '90-100']),
    outcome: new Set(['preflight', 'stream', 'number-safety', 'scoring', 'floor', 'cancelled', 'unknown', 'quota', 'concurrency', 'service', 'input', 'auth']),
    action: new Set(['copy', 'download', 'export', 'audit']),
  };
  const events = {
    'Input Started': new Set(['surface', 'lang']),
    'Rewrite Requested': new Set(['surface', 'lang', 'tier', 'mode', 'inputBucket']),
    'Rewrite Completed': new Set(['surface', 'lang', 'tier', 'mode', 'inputBucket', 'latencyBucket', 'mpsBand', 'fidelityBand']),
    'Rewrite Failed': new Set(['surface', 'lang', 'tier', 'mode', 'inputBucket', 'latencyBucket', 'outcome']),
    'Result Action': new Set(['action']),
    'Checkout Started': new Set(['surface', 'lang']),
    'Tier Selected': new Set(['tier', 'surface']),
  };

  window.patinaTrack = function patinaTrack(name, data) {
    try {
      const allowedKeys = events[name];
      if (!allowedKeys || !data || typeof data !== 'object' || Array.isArray(data)) return;
      const safeData = {};
      for (const [key, value] of Object.entries(data)) {
        if (!allowedKeys.has(key) || !values[key]?.has(value)) return;
        safeData[key] = value;
      }
      if (Object.keys(safeData).length !== allowedKeys.size) return;

      const body = JSON.stringify({ name, data: safeData });
      if (typeof window.fetch === 'function') {
        window.fetch('/api/funnel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
          credentials: 'omit',
          referrerPolicy: 'no-referrer',
          keepalive: true,
        }).catch(() => {});
      }
    } catch {
      // Analytics must never affect rewriting or checkout.
    }
  };
}());
