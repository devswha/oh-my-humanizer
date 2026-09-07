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
    channel: new Set(['unattributed', 'github', 'blog', 'social', 'community']),
    campaign: new Set(['none', 'multilingual-20260907']),
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

  // Memory belongs to this loaded page only. No cookies, browser storage,
  // identifiers, timers, or retry queue; the success count saturates at two.
  let arrival = null;
  let successes = 0;

  function attribution() {
    const fallback = { channel: 'unattributed', campaign: 'none' };
    try {
      const search = window.location?.search;
      if (typeof search !== 'string' || search.length > 4096) return fallback;
      const params = new window.URLSearchParams(search);
      const pick = (name, allowed, otherwise) => {
        const candidates = params.getAll(name);
        return candidates.length === 1 && allowed.has(candidates[0]) ? candidates[0] : otherwise;
      };
      return {
        channel: pick('utm_source', values.channel, fallback.channel),
        campaign: pick('utm_campaign', values.campaign, fallback.campaign),
      };
    } catch {
      return fallback;
    }
  }

  function send(name, safeData) {
    try {
      if (typeof window.fetch === 'function') {
        window.fetch('/api/funnel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, data: safeData }),
          credentials: 'omit',
          referrerPolicy: 'no-referrer',
          keepalive: true,
        }).catch(() => {});
      }
    } catch {
      // Analytics must never affect rewriting or checkout.
    }
  }

  // The controller calls this only AFTER language, controls and UI initialize.
  // Later language changes keep the arrival language as the funnel denominator.
  window.patinaFunnelReady = function patinaFunnelReady(lang) {
    try {
      if (arrival || !values.lang.has(lang)) return;
      arrival = { lang, ...attribution() };
      send('Funnel Progress', { ...arrival, stage: 'arrival' });
    } catch { /* analytics is optional */ }
  };

  window.patinaTrack = function patinaTrack(name, data) {
    try {
      // Milestones can only be emitted through the page lifecycle below.
      if (!Object.hasOwn(events, name)) return;
      const allowedKeys = events[name];
      if (!allowedKeys || !data || typeof data !== 'object' || Array.isArray(data)) return;
      const safeData = {};
      for (const [key, value] of Object.entries(data)) {
        if (!allowedKeys.has(key) || !values[key]?.has(value)) return;
        safeData[key] = value;
      }
      if (Object.keys(safeData).length !== allowedKeys.size) return;
      if (allowedKeys.has('surface')) {
        const surfaces = name === 'Checkout Started' ? ['pricing', 'quota']
          : name === 'Tier Selected' ? ['pricing', 'controls'] : ['hero', 'chat'];
        if (!surfaces.includes(safeData.surface)) return;
      }

      send(name, safeData);
      // The controller deduplicates terminal events per request. Failures,
      // result actions, and requests never advance these page milestones.
      if (name === 'Rewrite Completed' && safeData.mpsBand !== 'failed'
        && safeData.fidelityBand !== 'failed' && arrival && successes < 2) {
        successes += 1;
        send('Funnel Progress', { ...arrival, stage: successes === 1 ? 'first-success' : 'reuse' });
      }
    } catch {
      // Analytics must never affect rewriting or checkout.
    }
  };
}());
