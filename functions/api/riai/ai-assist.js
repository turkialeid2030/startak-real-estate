const MAX_REQUEST_BYTES = 32768;
const MAX_PROVIDER_BYTES = 65536;
const PROVIDER_TIMEOUT_MS = 15000;
const ALLOWED_SEVERITY = new Set(['LOW', 'MEDIUM', 'HIGH']);
const MAX_ITEMS = 8;
const MAX_TEXT = 500;
const FORBIDDEN_DECISION_PATTERNS = [
  /\b(buy|sell|approve|reject|invest|proceed|do not proceed)\b/i,
  /\b(اشتر|اشتري|بع|بيع|وافق|ارفض|استثمر|نفذ الصفقة|لا تنفذ الصفقة)\b/u,
];

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
    },
  });
}

function trimText(value, max = MAX_TEXT) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function validateSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return 'DECISION_SNAPSHOT_REQUIRED';
  if (snapshot.schemaVersion !== 1 || snapshot.capability !== 'RESIDENTIAL_INCOME_ACQUISITION_AI_ASSIST') return 'DECISION_SNAPSHOT_SCHEMA_INVALID';
  const governance = snapshot.governance;
  if (!governance || governance.rawOperatingCaseIncluded !== false || governance.tenantNamesIncluded !== false || governance.evidenceDocumentTextIncluded !== false) {
    return 'PRIVACY_GOVERNANCE_BOUNDARY_INVALID';
  }
  if (governance.automaticInvestmentRecommendationAllowed !== false || governance.legalConclusionAllowed !== false || governance.transactionAuthorizationAllowed !== false) {
    return 'DECISION_GOVERNANCE_BOUNDARY_INVALID';
  }
  return null;
}

function validateTextList(value, field) {
  if (!Array.isArray(value) || value.length > MAX_ITEMS) return `${field}_INVALID`;
  for (const item of value) {
    if (typeof item !== 'string' || !item.trim() || item.length > MAX_TEXT) return `${field}_INVALID`;
    if (FORBIDDEN_DECISION_PATTERNS.some((pattern) => pattern.test(item))) return 'AUTOMATIC_DECISION_LANGUAGE_PROHIBITED';
  }
  return null;
}

function sanitizeProviderOutput(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return { error: 'AI_RESPONSE_OBJECT_REQUIRED' };
  for (const field of ['executiveObservations', 'evidenceGaps', 'dueDiligenceQuestions', 'scenarioChecks']) {
    const error = validateTextList(payload[field], field);
    if (error) return { error };
  }
  if (!Array.isArray(payload.riskFlags) || payload.riskFlags.length > MAX_ITEMS) return { error: 'riskFlags_INVALID' };
  const riskFlags = [];
  for (const item of payload.riskFlags) {
    if (!item || typeof item !== 'object' || !ALLOWED_SEVERITY.has(item.severity)) return { error: 'riskFlags_INVALID' };
    const code = trimText(item.code, 120);
    const rationale = trimText(item.rationale);
    if (!code || !rationale || FORBIDDEN_DECISION_PATTERNS.some((pattern) => pattern.test(rationale))) return { error: 'riskFlags_INVALID' };
    riskFlags.push({ code, severity: item.severity, rationale });
  }
  if (!Array.isArray(payload.earlyWarningIndicators) || payload.earlyWarningIndicators.length > MAX_ITEMS) return { error: 'earlyWarningIndicators_INVALID' };
  const earlyWarningIndicators = [];
  for (const item of payload.earlyWarningIndicators) {
    if (!item || typeof item !== 'object') return { error: 'earlyWarningIndicators_INVALID' };
    const indicator = trimText(item.indicator, 220);
    const whyItMatters = trimText(item.whyItMatters);
    if (!indicator || !whyItMatters || FORBIDDEN_DECISION_PATTERNS.some((pattern) => pattern.test(`${indicator} ${whyItMatters}`))) return { error: 'earlyWarningIndicators_INVALID' };
    earlyWarningIndicators.push({ indicator, whyItMatters });
  }
  const decisionBoundary = trimText(payload.decisionBoundary);
  if (!decisionBoundary) return { error: 'decisionBoundary_INVALID' };
  return {
    value: {
      schemaVersion: 1,
      executiveObservations: payload.executiveObservations.map((item) => trimText(item)),
      riskFlags,
      evidenceGaps: payload.evidenceGaps.map((item) => trimText(item)),
      dueDiligenceQuestions: payload.dueDiligenceQuestions.map((item) => trimText(item)),
      scenarioChecks: payload.scenarioChecks.map((item) => trimText(item)),
      earlyWarningIndicators,
      decisionBoundary,
      investmentRecommendation: null,
      investmentDecision: null,
      legalConclusion: null,
      transactionAuthorized: false,
    },
  };
}

function allowedProviderUrl(env) {
  const rawUrl = trimText(env.RIAI_AI_PROVIDER_URL, 2048);
  const allowedHosts = trimText(env.RIAI_AI_ALLOWED_HOSTS, 2048)
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  if (!rawUrl || !allowedHosts.length) return { error: 'AI_PROVIDER_NOT_CONFIGURED' };
  let url;
  try { url = new URL(rawUrl); } catch (_) { return { error: 'AI_PROVIDER_URL_INVALID' }; }
  if (url.protocol !== 'https:') return { error: 'AI_PROVIDER_HTTPS_REQUIRED' };
  if (!allowedHosts.includes(url.hostname.toLowerCase())) return { error: 'AI_PROVIDER_HOST_NOT_ALLOWED' };
  return { url };
}

function systemPrompt() {
  return [
    'You are an evidence-disciplined real-estate acquisition analysis assistant.',
    'Analyze only the supplied sanitized decision snapshot. Do not infer missing facts.',
    'Do not issue buy, sell, proceed, reject, approve, invest, financing, legal, regulatory, valuation-certification, or transaction-authorization recommendations.',
    'Do not claim a zoning, subdivision, title, permit, lease, tax, or regulatory conclusion.',
    'Separate observed model signals from evidence gaps and due-diligence questions.',
    'Do not reveal chain-of-thought. Return only concise conclusions in the required JSON object.',
    'Required JSON keys: executiveObservations (array), riskFlags (array of {code,severity,rationale}), evidenceGaps (array), dueDiligenceQuestions (array), scenarioChecks (array), earlyWarningIndicators (array of {indicator,whyItMatters}), decisionBoundary (string).',
    'Each array must contain at most 8 items. severity must be LOW, MEDIUM, or HIGH.',
  ].join(' ');
}

function extractProviderJson(payload) {
  const content = payload && payload.choices && payload.choices[0] && payload.choices[0].message && payload.choices[0].message.content;
  if (typeof content !== 'string' || !content.trim()) return { error: 'AI_PROVIDER_RESPONSE_UNSUPPORTED' };
  try { return { value: JSON.parse(content) }; } catch (_) { return { error: 'AI_PROVIDER_JSON_INVALID' }; }
}

export async function onRequestPost(context) {
  const request = context.request;
  const contentType = request.headers.get('content-type') || '';
  if (!contentType.toLowerCase().includes('application/json')) return json({ ok: false, code: 'JSON_CONTENT_TYPE_REQUIRED' }, 415);
  const lengthHeader = Number(request.headers.get('content-length'));
  if (Number.isFinite(lengthHeader) && lengthHeader > MAX_REQUEST_BYTES) return json({ ok: false, code: 'REQUEST_TOO_LARGE' }, 413);

  let text;
  try { text = await request.text(); } catch (_) { return json({ ok: false, code: 'REQUEST_READ_FAILED' }, 400); }
  if (new TextEncoder().encode(text).length > MAX_REQUEST_BYTES) return json({ ok: false, code: 'REQUEST_TOO_LARGE' }, 413);

  let body;
  try { body = JSON.parse(text); } catch (_) { return json({ ok: false, code: 'INVALID_JSON' }, 400); }
  const snapshotError = validateSnapshot(body && body.decisionSnapshot);
  if (snapshotError) return json({ ok: false, code: snapshotError }, 400);

  const provider = allowedProviderUrl(context.env || {});
  if (provider.error) return json({ ok: false, code: provider.error, aiModelUsed: false }, 503);
  const apiKey = trimText(context.env.RIAI_AI_PROVIDER_KEY, 4096);
  const model = trimText(context.env.RIAI_AI_MODEL, 200);
  if (!apiKey || !model) return json({ ok: false, code: 'AI_PROVIDER_NOT_CONFIGURED', aiModelUsed: false }, 503);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);
  let providerResponse;
  try {
    providerResponse = await fetch(provider.url.toString(), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt() },
          { role: 'user', content: JSON.stringify(body.decisionSnapshot) },
        ],
      }),
      signal: controller.signal,
    });
  } catch (error) {
    clearTimeout(timer);
    return json({ ok: false, code: error && error.name === 'AbortError' ? 'AI_PROVIDER_TIMEOUT' : 'AI_PROVIDER_UNREACHABLE', aiModelUsed: false }, 502);
  }
  clearTimeout(timer);

  if (!providerResponse.ok) return json({ ok: false, code: 'AI_PROVIDER_REJECTED_REQUEST', providerStatus: providerResponse.status, aiModelUsed: false }, 502);
  const providerText = await providerResponse.text();
  if (new TextEncoder().encode(providerText).length > MAX_PROVIDER_BYTES) return json({ ok: false, code: 'AI_PROVIDER_RESPONSE_TOO_LARGE', aiModelUsed: false }, 502);
  let providerPayload;
  try { providerPayload = JSON.parse(providerText); } catch (_) { return json({ ok: false, code: 'AI_PROVIDER_RESPONSE_INVALID_JSON', aiModelUsed: false }, 502); }
  const extracted = extractProviderJson(providerPayload);
  if (extracted.error) return json({ ok: false, code: extracted.error, aiModelUsed: false }, 502);
  const sanitized = sanitizeProviderOutput(extracted.value);
  if (sanitized.error) return json({ ok: false, code: sanitized.error, aiModelUsed: false }, 502);

  return json({
    ok: true,
    schemaVersion: 1,
    aiModelUsed: true,
    model,
    generatedAt: new Date().toISOString(),
    advisoryOnly: true,
    deterministicScoreRemainsAuthoritative: true,
    result: sanitized.value,
  });
}

export async function onRequest(context) {
  if (context.request.method === 'POST') return onRequestPost(context);
  return json({ ok: false, code: 'METHOD_NOT_ALLOWED' }, 405);
}
