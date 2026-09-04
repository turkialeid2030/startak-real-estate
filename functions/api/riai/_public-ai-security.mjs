import { sha256Hex } from './_guardrails.mjs';

const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const TURNSTILE_TIMEOUT_MS = 5000;
const TURNSTILE_ACTION = 'riai_ai_assist';
const MAX_TURNSTILE_TOKEN_LENGTH = 4096;
const DEFAULT_BUDGET_TTL_SECONDS = 90000;

function trim(value, max = 4096) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function validateSameOriginRequest(request) {
  let requestUrl;
  try { requestUrl = new URL(request.url); }
  catch (_) { return Object.freeze({ ok: false, status: 400, code: 'AI_REQUEST_URL_INVALID' }); }

  const origin = request.headers.get('origin');
  if (origin && origin !== requestUrl.origin) {
    return Object.freeze({ ok: false, status: 403, code: 'AI_CROSS_ORIGIN_REQUEST_BLOCKED' });
  }
  const fetchSite = request.headers.get('sec-fetch-site');
  if (fetchSite && fetchSite !== 'same-origin' && fetchSite !== 'none') {
    return Object.freeze({ ok: false, status: 403, code: 'AI_CROSS_SITE_REQUEST_BLOCKED' });
  }
  return Object.freeze({ ok: true, requestUrl });
}

function publicAiEnabled(env = {}) {
  return String(env.RIAI_PUBLIC_AI_ENABLED || '').toLowerCase() === 'true';
}

async function verifyTurnstile({ request, env = {}, token, fetchImpl = fetch } = {}) {
  const secret = trim(env.RIAI_TURNSTILE_SECRET_KEY, 4096);
  if (!secret) return Object.freeze({ ok: false, status: 503, code: 'AI_TURNSTILE_NOT_CONFIGURED' });

  const responseToken = trim(token, MAX_TURNSTILE_TOKEN_LENGTH + 1);
  if (!responseToken) return Object.freeze({ ok: false, status: 401, code: 'AI_TURNSTILE_REQUIRED' });
  if (responseToken.length > MAX_TURNSTILE_TOKEN_LENGTH) {
    return Object.freeze({ ok: false, status: 400, code: 'AI_TURNSTILE_TOKEN_INVALID' });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TURNSTILE_TIMEOUT_MS);
  let response;
  try {
    const form = new URLSearchParams();
    form.set('secret', secret);
    form.set('response', responseToken);
    response = await fetchImpl(TURNSTILE_VERIFY_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
      signal: controller.signal,
    });
  } catch (_) {
    clearTimeout(timer);
    return Object.freeze({ ok: false, status: 503, code: 'AI_TURNSTILE_UNAVAILABLE' });
  }
  clearTimeout(timer);
  if (!response.ok) return Object.freeze({ ok: false, status: 503, code: 'AI_TURNSTILE_UNAVAILABLE' });

  let payload;
  try { payload = await response.json(); }
  catch (_) { return Object.freeze({ ok: false, status: 503, code: 'AI_TURNSTILE_RESPONSE_INVALID' }); }

  if (!payload || payload.success !== true) {
    return Object.freeze({ ok: false, status: 403, code: 'AI_TURNSTILE_FAILED' });
  }
  if (payload.action !== TURNSTILE_ACTION) {
    return Object.freeze({ ok: false, status: 403, code: 'AI_TURNSTILE_ACTION_INVALID' });
  }

  const requestHost = new URL(request.url).hostname.toLowerCase();
  const verifiedHost = trim(payload.hostname, 253).toLowerCase();
  if (!verifiedHost || verifiedHost !== requestHost) {
    return Object.freeze({ ok: false, status: 403, code: 'AI_TURNSTILE_HOSTNAME_INVALID' });
  }

  return Object.freeze({ ok: true, mode: 'CLOUDFLARE_TURNSTILE' });
}

async function createPublicAccessIdentity(request, env = {}) {
  const salt = trim(env.RIAI_AUDIT_SUBJECT_SALT, 4096);
  if (!salt) return Object.freeze({ ok: false, status: 503, code: 'AI_PUBLIC_SUBJECT_SALT_NOT_CONFIGURED' });

  const connectingIp = trim(request.headers.get('cf-connecting-ip'), 128);
  if (!connectingIp) return Object.freeze({ ok: false, status: 503, code: 'AI_PUBLIC_SUBJECT_UNAVAILABLE' });

  const digest = await sha256Hex(`${salt}:${connectingIp}`);
  return Object.freeze({
    ok: true,
    mode: 'CLOUDFLARE_TURNSTILE',
    subjectPresent: true,
    subject: `PUBLIC:${digest}`,
  });
}

function resolveTokenBudgetConfig(env = {}) {
  const raw = Number(env.RIAI_AI_GLOBAL_TOKEN_BUDGET_PER_DAY);
  const ttlRaw = Number(env.RIAI_AI_TOKEN_BUDGET_TTL_SECONDS);
  return Object.freeze({
    globalPerDay: Number.isInteger(raw) && raw > 0 ? raw : null,
    ttlSeconds: Number.isInteger(ttlRaw) && ttlRaw >= 86400 ? ttlRaw : DEFAULT_BUDGET_TTL_SECONDS,
  });
}

function estimateProviderTokenReservation(snapshot, maxOutputTokens) {
  const serialized = JSON.stringify(snapshot === undefined ? null : snapshot);
  const inputBytes = new TextEncoder().encode(serialized).length;
  const conservativeInputTokens = Math.ceil(inputBytes / 3);
  const outputTokens = Number.isInteger(maxOutputTokens) && maxOutputTokens > 0 ? maxOutputTokens : 0;
  return Math.max(1, conservativeInputTokens + outputTokens);
}

function dayBucket(now) {
  return Math.floor(now / 86400000);
}

async function checkAndReserveGlobalTokenBudget({ store, estimatedTokens, config, now = Date.now() } = {}) {
  if (!store || typeof store.get !== 'function' || typeof store.put !== 'function') {
    return Object.freeze({ allowed: false, status: 503, code: 'AI_TOKEN_BUDGET_STORE_UNAVAILABLE' });
  }
  if (!config || !Number.isInteger(config.globalPerDay) || config.globalPerDay <= 0) {
    return Object.freeze({ allowed: false, status: 503, code: 'AI_TOKEN_BUDGET_NOT_CONFIGURED' });
  }
  if (!Number.isInteger(estimatedTokens) || estimatedTokens <= 0) {
    return Object.freeze({ allowed: false, status: 503, code: 'AI_TOKEN_BUDGET_ESTIMATE_INVALID' });
  }

  const key = `budget:tokens:global:${dayBucket(now)}`;
  let current = 0;
  try {
    const raw = await store.get(key);
    const parsed = Number(raw);
    current = Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  } catch (_) {
    return Object.freeze({ allowed: false, status: 503, code: 'AI_TOKEN_BUDGET_STORE_UNAVAILABLE' });
  }

  const projected = current + estimatedTokens;
  if (projected > config.globalPerDay) {
    return Object.freeze({
      allowed: false,
      status: 429,
      code: 'AI_TOKEN_BUDGET_EXCEEDED',
      remainingTokens: Math.max(0, config.globalPerDay - current),
      retryAfterSeconds: 3600,
    });
  }

  try {
    await store.put(key, String(projected), { expirationTtl: config.ttlSeconds });
  } catch (_) {
    return Object.freeze({ allowed: false, status: 503, code: 'AI_TOKEN_BUDGET_STORE_UNAVAILABLE' });
  }

  return Object.freeze({
    allowed: true,
    code: null,
    reservedTokens: estimatedTokens,
    remainingTokens: config.globalPerDay - projected,
  });
}

export {
  TURNSTILE_VERIFY_URL,
  TURNSTILE_ACTION,
  validateSameOriginRequest,
  publicAiEnabled,
  verifyTurnstile,
  createPublicAccessIdentity,
  resolveTokenBudgetConfig,
  estimateProviderTokenReservation,
  checkAndReserveGlobalTokenBudget,
};
