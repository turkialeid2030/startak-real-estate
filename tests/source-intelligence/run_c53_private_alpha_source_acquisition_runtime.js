'use strict';

const assert = require('assert');
const {
  CAPABILITY,
  AcquisitionRuntimeError,
  acquirePublicArtifact,
  acquireWithBrowserAdapter,
  acquireManualArtifact,
  sha256Bytes,
} = require('../../src/source-intelligence/private-alpha-acquisition-runtime');
const {
  ACCESS_MODE,
  ACQUISITION_METHOD,
} = require('../../src/source-intelligence/private-alpha-acquisition-orchestrator');

let checks = 0;
function ok(value, message) { assert.ok(value, message); checks += 1; }
function eq(actual, expected, message) { assert.strictEqual(actual, expected, message); checks += 1; }
async function rejectsCode(fn, code) {
  let caught = null;
  try { await fn(); } catch (error) { caught = error; }
  ok(caught instanceof AcquisitionRuntimeError, `expected AcquisitionRuntimeError for ${code}`);
  eq(caught.code, code, `expected ${code}`);
}

function headers(map = {}) {
  const normalized = Object.fromEntries(Object.entries(map).map(([k, v]) => [k.toLowerCase(), String(v)]));
  return { get: (name) => normalized[String(name).toLowerCase()] ?? null };
}
function response({ status = 200, body = '', headers: headerMap = {} } = {}) {
  const bytes = Buffer.from(body);
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: headers({ 'content-type': 'text/html; charset=utf-8', 'content-length': bytes.length, ...headerMap }),
    arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  };
}

(async () => {
  const calls = [];
  const direct = await acquirePublicArtifact({
    sourceProvider: 'REGA_REAL_ESTATE_INDICATORS',
    sourceUrl: 'https://rei.rega.gov.sa/',
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return response({ body: '<html><body>official indicators</body></html>' });
    },
    now: () => '2026-10-05T06:30:00.000Z',
  });
  eq(direct.capability, CAPABILITY, 'capability expected');
  eq(direct.acquisitionMethod, ACQUISITION_METHOD.DIRECT_HTTPS_FETCH, 'direct method expected');
  eq(direct.sourceProvider, 'REGA_REAL_ESTATE_INDICATORS', 'provider expected');
  eq(direct.metadata.apiUsed, false, 'API must not be used');
  eq(direct.metadata.credentialsSent, false, 'public fetch must not send credentials');
  eq(direct.artifactHashSha256, sha256Bytes(Buffer.from('<html><body>official indicators</body></html>')), 'artifact hash expected');
  eq(direct.text.includes('official indicators'), true, 'text body expected');
  eq(direct.rightsApprovalEstablished, false, 'runtime must not claim rights approval');
  eq(direct.commercialUseAuthorized, false, 'runtime must not authorize commercial use');
  eq(calls[0].options.redirect, 'manual', 'redirects must be validated manually');
  eq(Boolean(calls[0].options.headers.authorization), false, 'Authorization header must not be sent');
  eq(Boolean(calls[0].options.headers.cookie), false, 'Cookie header must not be sent');

  let redirectCalls = 0;
  const redirected = await acquirePublicArtifact({
    sourceProvider: 'REGA_REAL_ESTATE_INDICATORS',
    sourceUrl: 'https://rega.gov.sa/start',
    fetchImpl: async () => {
      redirectCalls += 1;
      if (redirectCalls === 1) return response({ status: 302, headers: { location: 'https://www.rega.gov.sa/final' } });
      return response({ body: 'done', headers: { 'content-type': 'text/plain' } });
    },
  });
  eq(redirected.finalUrl, 'https://www.rega.gov.sa/final', 'same-provider redirect should be allowed');
  eq(redirectCalls, 2, 'redirect should be followed once');

  await rejectsCode(() => acquirePublicArtifact({
    sourceProvider: 'REGA_REAL_ESTATE_INDICATORS',
    sourceUrl: 'https://rega.gov.sa/start',
    fetchImpl: async () => response({ status: 302, headers: { location: 'https://example.com/escape' } }),
  }), 'C53_FINAL_URL_PROVIDER_MISMATCH');

  await rejectsCode(() => acquirePublicArtifact({
    sourceProvider: 'REGA_REAL_ESTATE_INDICATORS',
    sourceUrl: 'https://example.com/',
    fetchImpl: async () => response({ body: 'x' }),
  }), 'C53_ACQUISITION_PLAN_NOT_READY');

  await rejectsCode(() => acquirePublicArtifact({
    sourceProvider: 'REGA_REAL_ESTATE_INDICATORS',
    sourceUrl: 'https://rega.gov.sa/',
    maxBytes: 2,
    fetchImpl: async () => response({ body: 'oversize' }),
  }), 'C53_ARTIFACT_TOO_LARGE');

  await rejectsCode(() => acquirePublicArtifact({
    sourceProvider: 'REGA_REAL_ESTATE_INDICATORS',
    sourceUrl: 'https://rega.gov.sa/',
    fetchImpl: async () => response({ body: 'bin', headers: { 'content-type': 'image/png' } }),
  }), 'C53_CONTENT_TYPE_NOT_ALLOWED');

  const browser = await acquireWithBrowserAdapter({
    sourceProvider: 'REGA_REAL_ESTATE_INDICATORS',
    sourceUrl: 'https://rei.rega.gov.sa/',
    accessMode: ACCESS_MODE.PUBLIC_WEB,
    browserAdapter: async (contract) => {
      eq(contract.captchaBypassAllowed, false, 'browser adapter must receive no-CAPTCHA-bypass contract');
      eq(contract.accessControlEvasionAllowed, false, 'browser adapter must receive no-access-evasion contract');
      return { finalUrl: 'https://rei.rega.gov.sa/', html: '<html>rendered</html>', contentType: 'text/html' };
    },
  });
  eq(browser.acquisitionMethod, ACQUISITION_METHOD.PUBLIC_BROWSER_RENDER, 'public browser method expected');
  eq(browser.metadata.browserRendered, true, 'browser-rendered marker expected');

  await rejectsCode(() => acquireWithBrowserAdapter({
    sourceProvider: 'EJAR_REGISTERED_RENT_CONTRACTS',
    sourceUrl: 'https://www.ejar.sa/',
    accessMode: ACCESS_MODE.USER_AUTHENTICATED,
    userAuthorizedSession: false,
    browserAdapter: async () => ({ html: 'should-not-run' }),
  }), 'C53_BROWSER_EXECUTION_UNSAFE');

  const ejar = await acquireWithBrowserAdapter({
    sourceProvider: 'EJAR_REGISTERED_RENT_CONTRACTS',
    sourceUrl: 'https://www.ejar.sa/',
    accessMode: ACCESS_MODE.USER_AUTHENTICATED,
    userAuthorizedSession: true,
    browserAdapter: async () => ({
      finalUrl: 'https://www.ejar.sa/',
      html: '<html>authorized owner session</html>',
      contentType: 'text/html',
      captchaBypassUsed: false,
      credentialBypassUsed: false,
      accessControlEvasionUsed: false,
      rateLimitEvasionUsed: false,
    }),
  });
  eq(ejar.metadata.authenticatedSession, true, 'Ejar authorized session marker expected');
  eq(ejar.metadata.userAuthorizedSession, true, 'Ejar owner authorization marker expected');
  eq(ejar.commercialUseAuthorized, false, 'Ejar capture must remain non-commercial');

  await rejectsCode(() => acquireWithBrowserAdapter({
    sourceProvider: 'EJAR_REGISTERED_RENT_CONTRACTS',
    sourceUrl: 'https://www.ejar.sa/',
    accessMode: ACCESS_MODE.USER_AUTHENTICATED,
    userAuthorizedSession: true,
    browserAdapter: async () => ({
      finalUrl: 'https://www.ejar.sa/', html: 'bad', captchaBypassUsed: true,
    }),
  }), 'C53_BROWSER_RESULT_UNSAFE');

  const manual = acquireManualArtifact({
    sourceProvider: 'GASTAT_REAL_ESTATE_INDICES',
    sourceUrl: 'https://www.stats.gov.sa/',
    bytes: Buffer.from('date,index\n2026-01,100'),
    contentType: 'text/csv',
  });
  eq(manual.acquisitionMethod, ACQUISITION_METHOD.MANUAL_UPLOAD, 'manual upload expected');
  eq(manual.text.includes('2026-01'), true, 'manual text should be preserved');
  eq(manual.provenance.handoff, 'C2N/C2S', 'provenance handoff expected');

  const exported = acquireManualArtifact({
    sourceProvider: 'EJAR_REGISTERED_RENT_CONTRACTS',
    sourceUrl: 'https://www.ejar.sa/',
    bytes: Buffer.from('authorized export'),
    contentType: 'text/plain',
    method: ACQUISITION_METHOD.USER_AUTHORIZED_EXPORT,
  });
  eq(exported.acquisitionMethod, ACQUISITION_METHOD.USER_AUTHORIZED_EXPORT, 'user export expected');
  eq(exported.metadata.apiUsed, false, 'manual export must remain no-API');

  await rejectsCode(async () => acquireManualArtifact({
    sourceProvider: 'GASTAT_REAL_ESTATE_INDICES',
    sourceUrl: 'https://www.stats.gov.sa/',
    bytes: Buffer.alloc(0),
  }), 'C53_EMPTY_ARTIFACT');

  console.log(`C53_PRIVATE_ALPHA_SOURCE_ACQUISITION_RUNTIME_CHECKS=${checks}`);
  console.log('C53_PRIVATE_ALPHA_SOURCE_ACQUISITION_RUNTIME_RESULT=PASS');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
