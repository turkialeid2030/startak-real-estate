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
// Legacy KV admission is intentionally disabled: callers must use the atomic namespace.
async function checkAndConsumeRateLimit({ store } = {}) {
  return Object.freeze({ allowed:false,status:503,code:store?'AI_ATOMIC_QUOTA_REQUIRED':'AI_RATE_LIMIT_STORE_UNAVAILABLE' });
}

async function sha256Hex(text) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(text)));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function buildAuditRecord({ subjectKey, subjectSalt, snapshot, model, outcome, reasonCode = null, tokenLimit = null, accessMode = null, latencyMs = null, resultSummary = null, invocationId = null, now = Date.now() } = {}) {
  const subjectHash = await sha256Hex(`${subjectSalt || ''}:${subjectKey || ''}`);
  const snapshotHash = await sha256Hex(JSON.stringify(snapshot === undefined ? null : snapshot));
  const resultHash = resultSummary == null ? null : await sha256Hex(JSON.stringify(resultSummary));
  return Object.freeze({ schemaVersion: 1, recordType: 'RIAI_AI_ASSIST_INVOCATION', eventId: crypto.randomUUID(), invocationId, timestamp: new Date(now).toISOString(), subjectHash, snapshotHash, resultHash, model: model || null, accessMode, outcome, reasonCode, tokenLimit, latencyMs, payloadStored: false });
}

async function writeAuditRecord({ store, record, ttlSeconds = 34560000, timeoutMs = 3000 } = {}) {
  if (!store || typeof store.put !== 'function') return Object.freeze({ written: false, code: 'AI_AUDIT_STORE_UNAVAILABLE' });
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) return Object.freeze({ written: false, code: 'AI_AUDIT_INVALID_TIMEOUT' });
  const key = `audit:${record.timestamp}:${record.snapshotHash.slice(0, 12)}:${crypto.randomUUID()}`;
  let timer;
  try {
    await Promise.race([
      Promise.resolve().then(() => store.put(key, JSON.stringify(record), { expirationTtl: ttlSeconds })),
      new Promise((_, reject) => { timer = setTimeout(() => reject(Object.assign(new Error('audit timeout'), { code: 'AI_AUDIT_WRITE_TIMEOUT' })), timeoutMs); }),
    ]);
    return Object.freeze({ written: true, key });
  }
  catch (error) { return Object.freeze({ written: false, code: error?.code === 'AI_AUDIT_WRITE_TIMEOUT' ? error.code : 'AI_AUDIT_WRITE_FAILED' }); }
  finally { clearTimeout(timer); }
}

export { SNAPSHOT_TOKEN_PATTERN, SNAPSHOT_LIMITS, enforceSnapshotDataDiscipline, RATE_LIMIT_DEFAULTS, resolveRateLimitConfig, checkAndConsumeRateLimit, sha256Hex, buildAuditRecord, writeAuditRecord };
