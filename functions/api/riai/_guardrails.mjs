const SNAPSHOT_TOKEN_PATTERN = /^[A-Za-z0-9_.:*+\-/]{1,200}$/;
const SNAPSHOT_LIMITS = Object.freeze({ maxBytes: 16384, maxDepth: 8, maxNodes: 2000, maxStringLength: 200 });

function fail(code, path = null) { return Object.freeze({ ok: false, code, path }); }

function enforceSnapshotDataDiscipline(snapshot, limits = SNAPSHOT_LIMITS) {
  let serialized;
  try { serialized = JSON.stringify(snapshot); } catch (_) { return fail('SNAPSHOT_NOT_SERIALIZABLE'); }
  if (typeof serialized !== 'string') return fail('SNAPSHOT_NOT_SERIALIZABLE');
  if (new TextEncoder().encode(serialized).length > limits.maxBytes) return fail('SNAPSHOT_EXCEEDS_DATA_BUDGET');
  let nodes = 0;
  const stack = [{ value: snapshot, depth: 0, path: '' }];
  while (stack.length) {
    const { value, depth, path } = stack.pop();
    nodes += 1;
    if (nodes > limits.maxNodes) return fail('SNAPSHOT_EXCEEDS_NODE_BUDGET', path);
    if (depth > limits.maxDepth) return fail('SNAPSHOT_EXCEEDS_DEPTH_BUDGET', path);
    if (value === null || typeof value === 'boolean') continue;
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) return fail('SNAPSHOT_NON_FINITE_NUMBER', path);
      continue;
    }
    if (typeof value === 'string') {
      if (value.length > limits.maxStringLength) return fail('SNAPSHOT_STRING_TOO_LONG', path);
      if (!SNAPSHOT_TOKEN_PATTERN.test(value)) return fail('SNAPSHOT_FREE_TEXT_NOT_PERMITTED', path);
      continue;
    }
    if (Array.isArray(value)) {
      value.forEach((item, index) => stack.push({ value: item, depth: depth + 1, path: `${path}[${index}]` }));
      continue;
    }
    if (typeof value === 'object') {
      for (const [key, child] of Object.entries(value)) {
        if (!SNAPSHOT_TOKEN_PATTERN.test(key)) return fail('SNAPSHOT_KEY_NOT_PERMITTED', path ? `${path}.${key}` : key);
        stack.push({ value: child, depth: depth + 1, path: path ? `${path}.${key}` : key });
      }
      continue;
    }
    return fail('SNAPSHOT_UNSUPPORTED_VALUE_TYPE', path);
  }
  return Object.freeze({ ok: true, nodes, bytes: new TextEncoder().encode(serialized).length });
}

const RATE_LIMIT_DEFAULTS = Object.freeze({ perSubjectPerMinute: 6, perSubjectPerDay: 60, globalPerDay: 2000, ttlSeconds: 90000 });
function positiveInt(raw, fallback) { const value = Number(raw); return Number.isInteger(value) && value > 0 ? value : fallback; }
function resolveRateLimitConfig(env = {}) {
  return Object.freeze({
    perSubjectPerMinute: positiveInt(env.RIAI_AI_RATE_PER_MINUTE, RATE_LIMIT_DEFAULTS.perSubjectPerMinute),
    perSubjectPerDay: positiveInt(env.RIAI_AI_RATE_PER_DAY, RATE_LIMIT_DEFAULTS.perSubjectPerDay),
    globalPerDay: positiveInt(env.RIAI_AI_RATE_GLOBAL_PER_DAY, RATE_LIMIT_DEFAULTS.globalPerDay),
    ttlSeconds: positiveInt(env.RIAI_AI_RATE_TTL_SECONDS, RATE_LIMIT_DEFAULTS.ttlSeconds),
  });
}
function minuteBucket(now) { return Math.floor(now / 60000); }
function dayBucket(now) { return Math.floor(now / 86400000); }
async function readCounter(store, key) { const raw = await store.get(key); const value = Number(raw); return Number.isFinite(value) && value >= 0 ? value : 0; }

async function checkAndConsumeRateLimit({ store, subjectKey, now = Date.now(), config } = {}) {
  if (!store || typeof store.get !== 'function' || typeof store.put !== 'function') return Object.freeze({ allowed: false, code: 'AI_RATE_LIMIT_STORE_UNAVAILABLE', status: 503 });
  if (typeof subjectKey !== 'string' || !subjectKey) return Object.freeze({ allowed: false, code: 'AI_RATE_LIMIT_SUBJECT_MISSING', status: 401 });
  const limits = config || RATE_LIMIT_DEFAULTS;
  const minuteKey = `rl:min:${subjectKey}:${minuteBucket(now)}`;
  const dayKey = `rl:day:${subjectKey}:${dayBucket(now)}`;
  const globalKey = `rl:day:__global__:${dayBucket(now)}`;
  const [minuteCount, dayCount, globalCount] = await Promise.all([readCounter(store, minuteKey), readCounter(store, dayKey), readCounter(store, globalKey)]);
  if (minuteCount >= limits.perSubjectPerMinute) return Object.freeze({ allowed: false, code: 'AI_RATE_LIMIT_EXCEEDED_PER_MINUTE', status: 429, retryAfterSeconds: 60 - Math.floor((now % 60000) / 1000) });
  if (dayCount >= limits.perSubjectPerDay) return Object.freeze({ allowed: false, code: 'AI_RATE_LIMIT_EXCEEDED_PER_DAY', status: 429, retryAfterSeconds: 3600 });
  if (globalCount >= limits.globalPerDay) return Object.freeze({ allowed: false, code: 'AI_SPEND_BUDGET_EXHAUSTED', status: 429, retryAfterSeconds: 3600 });
  const options = { expirationTtl: limits.ttlSeconds };
  await Promise.all([
    store.put(minuteKey, String(minuteCount + 1), options),
    store.put(dayKey, String(dayCount + 1), options),
    store.put(globalKey, String(globalCount + 1), options),
  ]);
  return Object.freeze({ allowed: true, code: null, remainingThisMinute: limits.perSubjectPerMinute - minuteCount - 1, remainingToday: limits.perSubjectPerDay - dayCount - 1 });
}

async function sha256Hex(text) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(text)));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function buildAuditRecord({ subjectKey, subjectSalt, snapshot, model, outcome, reasonCode = null, tokenLimit = null, accessMode = null, latencyMs = null, resultSummary = null, now = Date.now() } = {}) {
  const subjectHash = await sha256Hex(`${subjectSalt || ''}:${subjectKey || ''}`);
  const snapshotHash = await sha256Hex(JSON.stringify(snapshot === undefined ? null : snapshot));
  const resultHash = resultSummary == null ? null : await sha256Hex(JSON.stringify(resultSummary));
  return Object.freeze({ schemaVersion: 1, recordType: 'RIAI_AI_ASSIST_INVOCATION', timestamp: new Date(now).toISOString(), subjectHash, snapshotHash, resultHash, model: model || null, accessMode, outcome, reasonCode, tokenLimit, latencyMs, payloadStored: false });
}

async function writeAuditRecord({ store, record, ttlSeconds = 34560000 } = {}) {
  if (!store || typeof store.put !== 'function') return Object.freeze({ written: false, code: 'AI_AUDIT_STORE_UNAVAILABLE' });
  const key = `audit:${record.timestamp}:${record.snapshotHash.slice(0, 12)}`;
  try { await store.put(key, JSON.stringify(record), { expirationTtl: ttlSeconds }); return Object.freeze({ written: true, key }); }
  catch (_) { return Object.freeze({ written: false, code: 'AI_AUDIT_WRITE_FAILED' }); }
}

export { SNAPSHOT_TOKEN_PATTERN, SNAPSHOT_LIMITS, enforceSnapshotDataDiscipline, RATE_LIMIT_DEFAULTS, resolveRateLimitConfig, checkAndConsumeRateLimit, sha256Hex, buildAuditRecord, writeAuditRecord };
