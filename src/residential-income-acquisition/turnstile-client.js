'use strict';

const { readBoundedJson } = require('./bounded-json-client');

const PUBLIC_CONFIG_ENDPOINT = '/api/riai/public-config';
const TURNSTILE_SCRIPT_ID = 'startak-riai-turnstile-script';
const TURNSTILE_SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
const TURNSTILE_ACTION = 'riai_ai_assist';
const TURNSTILE_CLIENT_TIMEOUT_MS = 15000;

function unavailable(reasonCode) {
  return Object.freeze({ ok: false, required: true, token: null, reasonCode });
}

async function fetchPublicAiConfig(fetchImpl, signal) {
  let response;
  try {
    response = await fetchImpl(PUBLIC_CONFIG_ENDPOINT, {
      signal,
      method: 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { accept: 'application/json' },
    });
  } catch (_) {
    return Object.freeze({ ok: false, reasonCode: 'AI_PUBLIC_CONFIG_UNAVAILABLE' });
  }
  if (!response.ok) return Object.freeze({ ok: false, reasonCode: `AI_PUBLIC_CONFIG_HTTP_${response.status}` });
  let payload;
  try { payload = await readBoundedJson(response, 8192, signal); }
  catch (_) { return Object.freeze({ ok: false, reasonCode: 'AI_PUBLIC_CONFIG_INVALID_JSON' }); }
  if (!payload || payload.schemaVersion !== 1 || typeof payload.publicAiEnabled !== 'boolean') {
    return Object.freeze({ ok: false, reasonCode: 'AI_PUBLIC_CONFIG_INVALID' });
  }
  return Object.freeze({
    ok: true,
    publicAiEnabled: payload.publicAiEnabled,
    turnstileSiteKey: typeof payload.turnstileSiteKey === 'string' ? payload.turnstileSiteKey.trim() : null,
  });
}

function loadTurnstileScript(signal) {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.reject(new Error('TURNSTILE_BROWSER_REQUIRED'));
  }
  if (window.turnstile && typeof window.turnstile.render === 'function') return Promise.resolve(window.turnstile);

  return new Promise((resolve, reject) => {
    let script = document.getElementById(TURNSTILE_SCRIPT_ID);
    let timer;
    const finish = (error) => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
      script?.removeEventListener('load', onReady);
      script?.removeEventListener('error', onError);
      if (error) { script?.remove(); reject(error); }
      else resolve(window.turnstile);
    };
    const onReady = () => finish(window.turnstile && typeof window.turnstile.render === 'function' ? null : new Error('TURNSTILE_API_UNAVAILABLE'));
    const onError = () => finish(new Error('TURNSTILE_SCRIPT_FAILED'));
    const onAbort = () => finish(new Error('TURNSTILE_CANCELLED'));
    timer = setTimeout(() => finish(new Error('TURNSTILE_SCRIPT_TIMEOUT')), TURNSTILE_CLIENT_TIMEOUT_MS);
    signal?.addEventListener('abort', onAbort, { once: true });
    if (signal?.aborted) { onAbort(); return; }

    if (!script) {
      script = document.createElement('script');
      script.id = TURNSTILE_SCRIPT_ID;
      script.src = TURNSTILE_SCRIPT_URL;
      script.async = true;
      script.defer = true;
      script.addEventListener('load', onReady, { once: true });
      script.addEventListener('error', onError, { once: true });
      document.head.appendChild(script);
      return;
    }

    script.addEventListener('load', onReady, { once: true });
    script.addEventListener('error', onError, { once: true });
    setTimeout(() => {
      if (window.turnstile && typeof window.turnstile.render === 'function') onReady();
    }, 0);
  });
}

async function executeTurnstile(siteKey, timeoutMs = TURNSTILE_CLIENT_TIMEOUT_MS, signal) {
  let api;
  try { api = await loadTurnstileScript(signal); }
  catch (_) { return unavailable('AI_TURNSTILE_CLIENT_UNAVAILABLE'); }

  if (signal?.aborted) return unavailable('AI_ASSIST_CANCELLED');
  return new Promise((resolve) => {
    const container = document.createElement('div');
    container.setAttribute('data-startak-turnstile', 'riai-ai-assist');
    container.style.position = 'fixed';
    container.style.right = '16px';
    container.style.bottom = '16px';
    container.style.zIndex = '2147483647';
    document.body.appendChild(container);

    let widgetId = null;
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
      try { if (widgetId !== null && typeof api.remove === 'function') api.remove(widgetId); } catch (_) {}
      try { container.remove(); } catch (_) {}
      resolve(result);
    };
    const onAbort = () => finish(unavailable('AI_ASSIST_CANCELLED'));
    const timer = setTimeout(() => finish(unavailable('AI_TURNSTILE_CLIENT_TIMEOUT')), timeoutMs);
    signal?.addEventListener('abort', onAbort, { once: true });

    try {
      widgetId = api.render(container, {
        sitekey: siteKey,
        action: TURNSTILE_ACTION,
        execution: 'execute',
        appearance: 'interaction-only',
        theme: 'auto',
        callback: (token) => {
          const clean = typeof token === 'string' ? token.trim() : '';
          finish(clean
            ? Object.freeze({ ok: true, required: true, token: clean, reasonCode: null })
            : unavailable('AI_TURNSTILE_CLIENT_EMPTY_TOKEN'));
        },
        'error-callback': () => finish(unavailable('AI_TURNSTILE_CLIENT_FAILED')),
        'expired-callback': () => finish(unavailable('AI_TURNSTILE_CLIENT_EXPIRED')),
        'timeout-callback': () => finish(unavailable('AI_TURNSTILE_CLIENT_TIMEOUT')),
      });
      if (settled) {
        if (typeof api.remove === 'function') api.remove(widgetId);
      } else api.execute(widgetId);
    } catch (_) {
      finish(unavailable('AI_TURNSTILE_CLIENT_FAILED'));
    }
  });
}

async function prepareTurnstileToken(fetchImpl, options = {}) {
  if (typeof options.turnstileToken === 'string' && options.turnstileToken.trim()) {
    return Object.freeze({ ok: true, required: true, token: options.turnstileToken.trim(), reasonCode: null });
  }

  const config = await fetchPublicAiConfig(fetchImpl, options.signal);
  if (!config.ok) {
    return Object.freeze({ ok: true, required: false, token: null, reasonCode: config.reasonCode });
  }
  if (!config.publicAiEnabled) return Object.freeze({ ok: true, required: false, token: null, reasonCode: null });
  if (!config.turnstileSiteKey) return unavailable('AI_TURNSTILE_SITE_KEY_NOT_CONFIGURED');
  return executeTurnstile(config.turnstileSiteKey, options.turnstileTimeoutMs, options.signal);
}

module.exports = {
  PUBLIC_CONFIG_ENDPOINT,
  TURNSTILE_ACTION,
  fetchPublicAiConfig,
  prepareTurnstileToken,
};
