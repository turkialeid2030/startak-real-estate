'use strict';

const {
  AI_ASSIST_STATUS,
  buildResidentialIncomeAiDecisionSnapshot,
  validateResidentialIncomeAiAssistResponse,
} = require('./ai-assist-contract');
const { prepareTurnstileToken } = require('./turnstile-client');
const { readBoundedJson } = require('./bounded-json-client');

const AI_ASSIST_ENDPOINT = '/api/riai/ai-assist';
const CLIENT_TIMEOUT_MS = 20000;

const AI_ASSIST_CLIENT_STATUS = Object.freeze({
  SUCCESS: 'SUCCESS',
  NOT_READY: 'NOT_READY',
  UNAVAILABLE: 'UNAVAILABLE',
  INVALID_RESPONSE: 'INVALID_RESPONSE',
});

async function performReview(viewModel, options = {}) {
  const snapshot = buildResidentialIncomeAiDecisionSnapshot(viewModel);
  if (snapshot.status !== AI_ASSIST_STATUS.READY) {
    return Object.freeze({
      status: AI_ASSIST_CLIENT_STATUS.NOT_READY,
      reasonCode: snapshot.reasonCode,
      aiModelUsed: false,
      result: null,
    });
  }

  const fetchImpl = options.fetchImpl || (typeof fetch === 'function' ? fetch : null);
  if (typeof fetchImpl !== 'function') {
    return Object.freeze({ status: AI_ASSIST_CLIENT_STATUS.UNAVAILABLE, reasonCode: 'FETCH_UNAVAILABLE', aiModelUsed: false, result: null });
  }

  const turnstile = await prepareTurnstileToken(fetchImpl, options);
  if (options.signal?.aborted) throw new Error('AI_ASSIST_CANCELLED');
  if (!turnstile.ok) {
    return Object.freeze({
      status: AI_ASSIST_CLIENT_STATUS.UNAVAILABLE,
      reasonCode: turnstile.reasonCode,
      aiModelUsed: false,
      result: null,
    });
  }

  const requestBody = { decisionSnapshot: snapshot.decisionSnapshot };
  if (turnstile.token) requestBody.turnstileToken = turnstile.token;

  let response;
  try {
    response = await fetchImpl(AI_ASSIST_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'same-origin',
      cache: 'no-store',
      body: JSON.stringify(requestBody),
      signal: options.signal,
    });
  } catch (error) {
    return Object.freeze({
      status: AI_ASSIST_CLIENT_STATUS.UNAVAILABLE,
      reasonCode: error && error.name === 'AbortError' ? 'AI_ASSIST_TIMEOUT' : 'AI_ASSIST_NETWORK_FAILED',
      aiModelUsed: false,
      result: null,
    });
  }

  let payload;
  try { payload = await readBoundedJson(response, 65536, options.signal); }
  catch (_) {
    return Object.freeze({ status: AI_ASSIST_CLIENT_STATUS.INVALID_RESPONSE, reasonCode: 'AI_ASSIST_RESPONSE_INVALID_JSON', aiModelUsed: false, result: null });
  }

  if (!response.ok || !payload || payload.ok !== true) {
    return Object.freeze({
      status: AI_ASSIST_CLIENT_STATUS.UNAVAILABLE,
      reasonCode: payload && payload.code || `AI_ASSIST_HTTP_${response.status}`,
      aiModelUsed: false,
      result: null,
    });
  }

  if (payload.aiModelUsed !== true || payload.deterministicScoreRemainsAuthoritative !== true || payload.advisoryOnly !== true) {
    return Object.freeze({ status: AI_ASSIST_CLIENT_STATUS.INVALID_RESPONSE, reasonCode: 'AI_ASSIST_GOVERNANCE_METADATA_INVALID', aiModelUsed: false, result: null });
  }

  const validated = validateResidentialIncomeAiAssistResponse(payload.result);
  if (validated.status !== AI_ASSIST_STATUS.VALID) {
    return Object.freeze({ status: AI_ASSIST_CLIENT_STATUS.INVALID_RESPONSE, reasonCode: validated.reasonCode, aiModelUsed: false, result: null });
  }

  return Object.freeze({
    status: AI_ASSIST_CLIENT_STATUS.SUCCESS,
    reasonCode: null,
    aiModelUsed: true,
    model: typeof payload.model === 'string' ? payload.model : null,
    generatedAt: typeof payload.generatedAt === 'string' ? payload.generatedAt : null,
    advisoryOnly: true,
    deterministicScoreRemainsAuthoritative: true,
    result: validated.value,
  });
}

// The deadline covers configuration, challenge, headers AND response body. A race
// also settles callers whose injected transport does not implement abort.
async function requestResidentialIncomeAiAssist(viewModel, options = {}) {
  const controller = new AbortController();
  const timeoutMs = Number.isFinite(options.timeoutMs) ? Math.max(1000, Math.min(options.timeoutMs, 30000)) : CLIENT_TIMEOUT_MS;
  let timer;
  let onAbort;
  const stopped = new Promise((resolve) => {
    const stop = (reasonCode) => {
      controller.abort();
      resolve(Object.freeze({ status: AI_ASSIST_CLIENT_STATUS.UNAVAILABLE, reasonCode, aiModelUsed: false, result: null }));
    };
    onAbort = () => stop('AI_ASSIST_CANCELLED');
    timer = setTimeout(() => stop('AI_ASSIST_TIMEOUT'), timeoutMs);
    options.signal?.addEventListener('abort', onAbort, { once: true });
    if (options.signal?.aborted) onAbort();
  });
  try {
    if (controller.signal.aborted) return await stopped;
    return await Promise.race([stopped, performReview(viewModel, { ...options, signal: controller.signal })]);
  } catch (_) {
    return Object.freeze({ status: AI_ASSIST_CLIENT_STATUS.UNAVAILABLE, reasonCode: 'AI_ASSIST_NETWORK_FAILED', aiModelUsed: false, result: null });
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', onAbort);
    controller.abort();
  }
}

module.exports = {
  AI_ASSIST_ENDPOINT,
  AI_ASSIST_CLIENT_STATUS,
  requestResidentialIncomeAiAssist,
};
