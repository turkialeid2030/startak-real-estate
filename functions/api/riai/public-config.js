function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'no-referrer',
    },
  });
}

export async function onRequestGet(context) {
  const env = context.env || {};
  const publicAiEnabled = String(env.RIAI_PUBLIC_AI_ENABLED || '').toLowerCase() === 'true';
  const turnstileSiteKey = publicAiEnabled && typeof env.RIAI_TURNSTILE_SITE_KEY === 'string'
    ? env.RIAI_TURNSTILE_SITE_KEY.trim()
    : '';

  return json({
    schemaVersion: 1,
    publicAiEnabled,
    turnstileSiteKey: turnstileSiteKey || null,
  });
}

export async function onRequest(context) {
  if (context.request.method === 'GET') return onRequestGet(context);
  return json({ ok: false, code: 'METHOD_NOT_ALLOWED' }, 405);
}
