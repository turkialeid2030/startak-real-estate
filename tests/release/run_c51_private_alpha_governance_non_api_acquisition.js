'use strict';

const assert = require('assert');
const {
  OPERATING_MODE,
  PRIVATE_ALPHA_DECISION,
  EXTERNAL_C30_GATES,
  evaluatePrivateAlphaOperatingMode,
} = require('../../src/release/private-alpha-operating-mode');
const {
  ACCESS_MODE,
  ACQUISITION_METHOD,
  ATTEMPT_STATUS,
  createPrivateAlphaAcquisitionPlan,
  selectNextAcquisitionAttempt,
  validateAcquisitionExecutionSafety,
} = require('../../src/source-intelligence/private-alpha-acquisition-orchestrator');

let checks = 0;
function ok(value, message) { assert.ok(value, message); checks += 1; }
function eq(actual, expected, message) { assert.strictEqual(actual, expected, message); checks += 1; }

function externalHoldPack() {
  return {
    decision: 'HOLD',
    blockerRegister: EXTERNAL_C30_GATES.map((id) => ({
      source: 'EXTERNAL', id, state: 'NOT_SUPPLIED', decisionEffect: 'HOLD', reasonCode: 'NOT_SUPPLIED',
    })),
  };
}

const alpha = evaluatePrivateAlphaOperatingMode({
  operatingMode: OPERATING_MODE.PRIVATE_ALPHA,
  c30Pack: externalHoldPack(),
});
eq(alpha.decision, PRIVATE_ALPHA_DECISION.ALLOW_PRIVATE_ALPHA, 'external-only C30 holds must not block private alpha');
eq(alpha.privateAlphaDeployAuthorized, true, 'private alpha deploy should be authorized');
eq(alpha.privateAlphaMergeAuthorized, true, 'private alpha merge should be authorized');
eq(alpha.privateAlphaTestingAuthorized, true, 'private alpha testing should be authorized');
eq(alpha.commercialProductionAuthorized, false, 'commercial production must remain unauthorized');
eq(alpha.publicDeploymentAuthorized, false, 'public deployment must remain unauthorized');
eq(alpha.transactionAuthorized, false, 'transactions must remain unauthorized');
eq(alpha.approvalAuthorized, false, 'approval authority must remain false');
eq(alpha.certifiedValuationEstablished, false, 'certified valuation must remain false');
eq(alpha.externalEvidenceRequiredForPrivateAlpha, false, 'external evidence is advisory for private alpha');
eq(alpha.externalEvidenceRequiredForCommercialProduction, true, 'external evidence remains required for commercial production');
eq(alpha.advisoryExternalGates.length, 8, 'all eight external gates should remain visible as advisory');
eq(alpha.c30DecisionPreserved, 'HOLD', 'C30 commercial decision must be preserved');

const noGoPack = externalHoldPack();
noGoPack.blockerRegister = [...noGoPack.blockerRegister, {
  source: 'TECHNICAL', id: 'PRODUCTION_BUILD', state: 'FAIL', decisionEffect: 'NO_GO', reasonCode: 'BUILD_FAILED',
}];
const noGo = evaluatePrivateAlphaOperatingMode({ operatingMode: OPERATING_MODE.PRIVATE_ALPHA, c30Pack: noGoPack });
eq(noGo.decision, PRIVATE_ALPHA_DECISION.NO_GO, 'technical NO_GO must block private alpha');
eq(noGo.privateAlphaDeployAuthorized, false, 'NO_GO must not deploy');

const holdPack = externalHoldPack();
holdPack.blockerRegister = [...holdPack.blockerRegister, {
  source: 'TECHNICAL', id: 'PACKAGE_VERIFICATION', state: 'NOT_EVALUATED', decisionEffect: 'HOLD', reasonCode: 'MISSING',
}];
const hold = evaluatePrivateAlphaOperatingMode({ operatingMode: OPERATING_MODE.PRIVATE_ALPHA, c30Pack: holdPack });
eq(hold.decision, PRIVATE_ALPHA_DECISION.HOLD, 'non-external technical HOLD must still block');
eq(hold.privateAlphaDeployAuthorized, false, 'technical HOLD must not deploy');

const publicViolation = evaluatePrivateAlphaOperatingMode({
  operatingMode: OPERATING_MODE.PRIVATE_ALPHA,
  c30Pack: externalHoldPack(),
  controls: { publicAccess: true },
});
eq(publicViolation.decision, PRIVATE_ALPHA_DECISION.HOLD, 'public access must block private-alpha authorization');
ok(publicViolation.blockers.includes('PRIVATE_ALPHA_PUBLIC_ACCESS_FORBIDDEN'), 'public access blocker expected');

const commercial = evaluatePrivateAlphaOperatingMode({
  operatingMode: OPERATING_MODE.COMMERCIAL_PRODUCTION,
  c30Pack: externalHoldPack(),
});
eq(commercial.privateAlphaDeployAuthorized, false, 'commercial mode cannot use private-alpha bypass');
ok(commercial.blockers.includes('C30_GO_REQUIRED_OUTSIDE_PRIVATE_ALPHA'), 'commercial production should require C30 GO');

const ejar = createPrivateAlphaAcquisitionPlan({
  sourceProvider: 'EJAR_REGISTERED_RENT_CONTRACTS',
  sourceUrl: 'https://www.ejar.sa/',
  accessMode: ACCESS_MODE.USER_AUTHENTICATED,
});
eq(ejar.ready, true, 'Ejar private-alpha plan should be ready');
eq(ejar.apiRequired, false, 'API must not be required');
eq(ejar.apiPreferred, false, 'API must not be preferred');
eq(ejar.methods[0], ACQUISITION_METHOD.USER_AUTHORIZED_BROWSER_SESSION, 'authorized browser session should be first');
ok(ejar.methods.includes(ACQUISITION_METHOD.USER_AUTHORIZED_EXPORT), 'authorized export fallback expected');
ok(ejar.methods.includes(ACQUISITION_METHOD.MANUAL_ASSISTED_CAPTURE), 'manual-assisted fallback expected');
eq(ejar.safety.captchaBypassAllowed, false, 'CAPTCHA bypass must remain forbidden');
eq(ejar.safety.credentialBypassAllowed, false, 'credential bypass must remain forbidden');
eq(ejar.safety.authenticatedSessionMustBeUserAuthorized, true, 'authenticated session must be owner-authorized');

const rega = createPrivateAlphaAcquisitionPlan({
  sourceProvider: 'REGA_REAL_ESTATE_INDICATORS',
  sourceUrl: 'https://rei.rega.gov.sa/',
  accessMode: ACCESS_MODE.PUBLIC_WEB,
  contentHints: ['HTML'],
});
eq(rega.ready, true, 'REGA public-web plan should be ready');
eq(rega.methods[0], ACQUISITION_METHOD.DIRECT_HTTPS_FETCH, 'direct HTTPS should be tried first for public web');
ok(rega.methods.includes(ACQUISITION_METHOD.PUBLIC_BROWSER_RENDER), 'browser rendering fallback expected');
ok(rega.methods.includes(ACQUISITION_METHOD.OFFICIAL_FILE_DOWNLOAD), 'file download fallback expected');
ok(rega.methods.includes(ACQUISITION_METHOD.SITEMAP_RSS_DISCOVERY), 'discovery fallback expected');

const fileFirst = createPrivateAlphaAcquisitionPlan({
  sourceProvider: 'GASTAT_REAL_ESTATE_INDICES',
  sourceUrl: 'https://www.stats.gov.sa/',
  accessMode: ACCESS_MODE.PUBLIC_WEB,
  contentHints: ['XLSX'],
});
eq(fileFirst.methods[0], ACQUISITION_METHOD.OFFICIAL_FILE_DOWNLOAD, 'download hint should prioritize official file acquisition');

const mismatch = createPrivateAlphaAcquisitionPlan({
  sourceProvider: 'EJAR_REGISTERED_RENT_CONTRACTS',
  sourceUrl: 'https://example.com/',
  accessMode: ACCESS_MODE.PUBLIC_WEB,
});
eq(mismatch.ready, false, 'provider/domain mismatch must block');
ok(mismatch.blockers.includes('SOURCE_URL_PROVIDER_MISMATCH'), 'provider/domain mismatch blocker expected');

let next = selectNextAcquisitionAttempt(rega, []);
eq(next.status, 'NEXT', 'first acquisition attempt should be returned');
eq(next.method, ACQUISITION_METHOD.DIRECT_HTTPS_FETCH, 'first public method should be direct fetch');
next = selectNextAcquisitionAttempt(rega, [{ method: ACQUISITION_METHOD.DIRECT_HTTPS_FETCH, status: ATTEMPT_STATUS.FAILED }]);
eq(next.status, 'NEXT', 'failed method should fall through');
eq(next.method, ACQUISITION_METHOD.OFFICIAL_FILE_DOWNLOAD, 'second method should be file download');
next = selectNextAcquisitionAttempt(rega, [{ method: ACQUISITION_METHOD.PUBLIC_BROWSER_RENDER, status: ATTEMPT_STATUS.SUCCESS }]);
eq(next.status, 'COMPLETE', 'success should complete acquisition');
eq(next.method, ACQUISITION_METHOD.PUBLIC_BROWSER_RENDER, 'successful method should be retained');

const safe = validateAcquisitionExecutionSafety({
  accessMode: ACCESS_MODE.USER_AUTHENTICATED,
  userAuthorizedSession: true,
});
eq(safe.safe, true, 'authorized user session should be safe');
const unsafe = validateAcquisitionExecutionSafety({
  accessMode: ACCESS_MODE.USER_AUTHENTICATED,
  userAuthorizedSession: false,
  captchaBypassUsed: true,
});
eq(unsafe.safe, false, 'unsafe bypass must be blocked');
ok(unsafe.blockers.includes('CAPTCHA_BYPASS_FORBIDDEN'), 'CAPTCHA bypass blocker expected');
ok(unsafe.blockers.includes('USER_AUTHORIZED_SESSION_REQUIRED'), 'authorized session blocker expected');

console.log(`C51_PRIVATE_ALPHA_GOVERNANCE_NON_API_ACQUISITION_CHECKS=${checks}`);
console.log('C51_PRIVATE_ALPHA_GOVERNANCE_NON_API_ACQUISITION_RESULT=PASS');
