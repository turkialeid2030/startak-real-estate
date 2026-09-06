import fs from 'fs';
import { performance } from 'perf_hooks';

const POLICY_PATH = 'governance/release-governance-policy.json';
const EVIDENCE_DIR = 'runtime-evidence/release-governance';
const policy = JSON.parse(fs.readFileSync(POLICY_PATH, 'utf8'));
const healthPolicy = policy.releaseHealth;
const BASE_URL = process.env.BASE_URL || policy.productionHost;
const EXPECTED_DEPLOYED_SHA = process.env.EXPECTED_DEPLOYED_SHA || null;

fs.mkdirSync(EVIDENCE_DIR, { recursive: true });

const report = {
  schemaVersion: 1,
  suite: 'STARTAK_PRODUCTION_RELEASE_HEALTH_V1',
  policyId: policy.policyId,
  baseUrl: BASE_URL,
  expectedDeployedSha: EXPECTED_DEPLOYED_SHA,
  startedAt: new Date().toISOString(),
  policy: healthPolicy,
  samples: [],
  checks: [],
};

let failed = false;

function record(name, passed, detail = null) {
  report.checks.push({ name, status: passed ? 'PASS' : 'FAIL', detail });
  if (!passed) failed = true;
  const suffix = detail === null ? '' : ` -- ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`;
  console.log(`${name}=${passed ? 'PASS' : 'FAIL'}${suffix}`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function percentile95(values) {
  if (!values.length) return null;
  const ordered = [...values].sort((a, b) => a - b);
  const index = Math.max(0, Math.ceil(ordered.length * 0.95) - 1);
  return ordered[index];
}

async function probe(index) {
  const started = performance.now();
  try {
    const response = await fetch(`${BASE_URL}/`, {
      redirect: 'follow',
      cache: 'no-store',
      headers: {
        'user-agent': 'STARTAK-Release-Health-Verify/1.0',
        'cache-control': 'no-cache',
      },
      signal: AbortSignal.timeout(healthPolicy.requestTimeoutMs),
    });
    const body = await response.text();
    const durationMs = Number((performance.now() - started).toFixed(1));
    const contentType = response.headers.get('content-type') || '';
    const hasDocument = /<!doctype html|<html/i.test(body);
    const hasRoot = /id=["']root["']/.test(body);
    const sample = {
      index,
      status: response.status,
      durationMs,
      contentType,
      bodyLength: body.length,
      hasDocument,
      hasRoot,
      requestError: null,
    };
    report.samples.push(sample);
    console.log(`RELEASE_HEALTH_SAMPLE_${index}=status:${response.status},durationMs:${durationMs},bodyLength:${body.length}`);
    return sample;
  } catch (error) {
    const durationMs = Number((performance.now() - started).toFixed(1));
    const sample = {
      index,
      status: null,
      durationMs,
      contentType: null,
      bodyLength: 0,
      hasDocument: false,
      hasRoot: false,
      requestError: `${error.name}: ${error.message}`,
    };
    report.samples.push(sample);
    console.log(`RELEASE_HEALTH_SAMPLE_${index}=ERROR -- ${sample.requestError}`);
    return sample;
  }
}

for (let index = 1; index <= healthPolicy.samples; index += 1) {
  await probe(index);
  if (index < healthPolicy.samples) await sleep(healthPolicy.intervalMs);
}

const successfulSamples = report.samples.filter((sample) => {
  if (sample.requestError) return false;
  if (healthPolicy.requireHttp200 && sample.status !== 200) return false;
  if (healthPolicy.requireHtmlDocument && !sample.hasDocument) return false;
  if (healthPolicy.requireRootMount && !sample.hasRoot) return false;
  return true;
});

const successRate = report.samples.length ? successfulSamples.length / report.samples.length : 0;
const durations = report.samples.filter((sample) => !sample.requestError).map((sample) => sample.durationMs);
const p95ResponseMs = percentile95(durations);
const http5xx = report.samples.filter((sample) => Number.isInteger(sample.status) && sample.status >= 500);
const requestErrors = report.samples.filter((sample) => sample.requestError);

record('RELEASE_HEALTH_SAMPLE_COUNT', report.samples.length === healthPolicy.samples, {
  expected: healthPolicy.samples,
  actual: report.samples.length,
});
record('RELEASE_HEALTH_SUCCESS_RATE', successRate >= healthPolicy.requiredSuccessRate, {
  required: healthPolicy.requiredSuccessRate,
  actual: Number(successRate.toFixed(4)),
  successfulSamples: successfulSamples.length,
});
record('RELEASE_HEALTH_NO_REQUEST_ERRORS', requestErrors.length === 0, requestErrors.slice(0, 3));
record('RELEASE_HEALTH_NO_HTTP_5XX', healthPolicy.allowHttp5xx || http5xx.length === 0, http5xx.slice(0, 3));
record('RELEASE_HEALTH_P95_RESPONSE_TIME', p95ResponseMs !== null && p95ResponseMs <= healthPolicy.maxP95ResponseMs, {
  maxMs: healthPolicy.maxP95ResponseMs,
  actualMs: p95ResponseMs,
});
record('RELEASE_HEALTH_HTML_STRUCTURE', report.samples.every((sample) => {
  if (sample.requestError) return false;
  return (!healthPolicy.requireHtmlDocument || sample.hasDocument)
    && (!healthPolicy.requireRootMount || sample.hasRoot);
}), {
  requireHtmlDocument: healthPolicy.requireHtmlDocument,
  requireRootMount: healthPolicy.requireRootMount,
});

report.completedAt = new Date().toISOString();
report.metrics = {
  sampleCount: report.samples.length,
  successfulSamples: successfulSamples.length,
  successRate: Number(successRate.toFixed(4)),
  p95ResponseMs,
  requestErrorCount: requestErrors.length,
  http5xxCount: http5xx.length,
};
report.result = failed ? 'FAIL' : 'PASS';
report.transactionAuthorized = false;
report.caveats = [
  'This is a short release-health observation window, not a monthly or contractual uptime SLO measurement.',
  'Exact deployed-SHA correlation is inherited from the preceding production-control-plane/post-release chain when EXPECTED_DEPLOYED_SHA is populated.',
  'No production mutation or automatic rollback is performed by this suite.',
];

fs.writeFileSync(`${EVIDENCE_DIR}/production-release-health.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
process.exit(report.result === 'PASS' ? 0 : 1);
