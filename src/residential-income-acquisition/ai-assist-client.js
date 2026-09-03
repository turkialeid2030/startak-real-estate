'use strict';

const {
  AI_ASSIST_STATUS,
  buildResidentialIncomeAiDecisionSnapshot,
  validateResidentialIncomeAiAssistResponse,
} = require('./ai-assist-contract');

const AI_ASSIST_ENDPOINT = '/api/riai/ai-assist';
const CLIENT_TIMEOUT_MS = 20000;

const AI_ASSIST_CLIENT_STATUS = Object.freeze({
  SUCCESS: 'SUCCESS',
  NOT_READY: 'NOT_READY',
  UNAVAILABLE: 'UNAVAILABLE',
  INVALID_RESPONSE: 'INVALID_RESPONSE',
});

async function requestResidentialIncomeAiAssist(viewModel, options = {}) {
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

  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timeoutMs = Number.isFinite(options.timeoutMs) ? Math.max(1000, Math.min(options.timeoutMs, 30000)) : CLIENT_TIMEOUT_MS;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;

  let response;
  try {
    response = await fetchImpl(AI_ASSIST_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'same-origin',
      cache: 'no-store',
      body: JSON.stringify({ decisionSnapshot: snapshot.decisionSnapshot }),
      ...(controller ? { signal: controller.signal } : {}),
    });
  } catch (error) {
    if (timer) clearTimeout(timer);
    return Object.freeze({
      status: AI_ASSIST_CLIENT_STATUS.UNAVAILABLE,
      reasonCode: error && error.name === 'AbortError' ? 'AI_ASSIST_TIMEOUT' : 'AI_ASSIST_NETWORK_FAILED',
      aiModelUsed: false,
      result: null,
    });
  }
  if (timer) clearTimeout(timer);

  let payload;
  try { payload = await response.json(); }
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

module.exports = {
  AI_ASSIST_ENDPOINT,
  AI_ASSIST_CLIENT_STATUS,
  requestResidentialIncomeAiAssist,
};
