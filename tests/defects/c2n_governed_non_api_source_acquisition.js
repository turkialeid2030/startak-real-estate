'use strict';

const assert = require('assert');
const {
  ACQUISITION_METHOD,
  EXTRACTION_METHOD,
  RIGHTS_MODE,
  NON_API_ACQUISITION_STATUS,
  buildGovernedNonApiAcquisitionPlan,
  createGovernedNonApiAcquisitionRecord,
  computeNonApiAcquisitionRecordHash,
  verifyNonApiAcquisitionRecordIntegrity,
  evaluateGovernedNonApiAcquisition,
} = require('../../src/source-intelligence/governed-non-api-acquisition');
const { getCanonicalSourceProvider } = require('../../src/source-intelligence/source-provider-registry');

const AS_OF = '2026-10-01T09:30:00Z';
const H1 = '1'.repeat(64);
const H2 = '2'.repeat(64);

for (const providerId of [
  'RIYADH_MUNICIPALITY_GEOSPATIAL',
  'MADINAH_MUNICIPALITY_GEOSPATIAL',
  'JEDDAH_MUNICIPALITY_GEOSPATIAL',
]) {
  const provider = getCanonicalSourceProvider(providerId);
  assert(provider, `${providerId} must be registered`);
  assert.strictEqual(provider.sourceTier, 'A_OFFICIAL_AUTHORITATIVE');
  assert.strictEqual(provider.productionAdapterEnabled, false);
}

function openDataRecord(overrides = {}) {
  return createGovernedNonApiAcquisitionRecord({
    acquisitionId: 'ACQ-BALADY-1',
    profileId: 'BALADY_OPEN_DATA_DOWNLOADS',
    sourceProvider: 'BALADY_URBAN_MAPS',
    sourceUrl: 'https://open.data.gov.sa/example/balady.csv',
    acquisitionMethod: ACQUISITION_METHOD.OFFICIAL_OPEN_DATA_FILE_DOWNLOAD,
    automatedRetrieval: true,
    retrievedAt: '2026-10-01T09:00:00Z',
    sourceEffectiveAt: '2026-09-30T00:00:00Z',
    artifactMimeType: 'text/csv',
    artifactFormat: 'CSV',
    artifactHashSha256: H1,
    extractionMethod: EXTRACTION_METHOD.STRUCTURED_FILE_PARSE,
    extractorVersion: 'C2N-CSV-1',
    extractedPayload: { rows: [{ planNo: 'P-100', landUse: 'RESIDENTIAL' }] },
    termsEvidenceRef: 'BALADY-OPEN-DATA-TERMS-2026-08-10',
    licenseReference: 'BALADY-OPEN-DATA-CREATIVE-COMMONS',
    attributionText: 'Source: Balady / Ministry of Municipalities and Housing',
    provenanceVerificationRef: 'C2N-RESEARCH-BALADY-2026-10-01',
    ...overrides,
  });
}

const balady = openDataRecord();
assert(verifyNonApiAcquisitionRecordIntegrity(balady));
assert.strictEqual(computeNonApiAcquisitionRecordHash(balady), balady.acquisitionRecordHashSha256);
const baladyResult = evaluateGovernedNonApiAcquisition(balady, { asOf: AS_OF });
assert.strictEqual(baladyResult.status, NON_API_ACQUISITION_STATUS.READY_FOR_C2S_PROVENANCE_EVALUATION);
assert.strictEqual(baladyResult.readyForC2SProvenanceEvaluation, true);
assert.strictEqual(baladyResult.authoritativeEvidenceEstablished, false);
assert.strictEqual(baladyResult.transactionAuthorized, false);
assert.strictEqual(baladyResult.publicAiAuthorized, false);

const baladyPlan = buildGovernedNonApiAcquisitionPlan({
  profileId: 'BALADY_OPEN_DATA_DOWNLOADS',
  sourceUrl: 'https://open.data.gov.sa/example/balady.csv',
  preferredMethod: ACQUISITION_METHOD.OFFICIAL_OPEN_DATA_FILE_DOWNLOAD,
});
assert.strictEqual(baladyPlan.noApi, true);
assert.strictEqual(baladyPlan.automatedRetrievalEligible, true);
assert.strictEqual(baladyPlan.hiddenEndpointDiscoveryAllowed, false);
assert.strictEqual(baladyPlan.credentialBypassAllowed, false);
assert.strictEqual(baladyPlan.captchaBypassAllowed, false);
assert.strictEqual(baladyPlan.accessControlEvasionAllowed, false);
assert.strictEqual(baladyPlan.rateLimitEvasionAllowed, false);
assert.strictEqual(baladyPlan.rightsMode, RIGHTS_MODE.PUBLISHED_OPEN_DATA_REUSE);

const madinah = createGovernedNonApiAcquisitionRecord({
  acquisitionId: 'ACQ-MADINAH-1',
  profileId: 'MADINAH_OPEN_DATA_DOWNLOADS',
  sourceProvider: 'MADINAH_MUNICIPALITY_GEOSPATIAL',
  sourceUrl: 'https://www.amana-md.gov.sa/OpenData/ApprovedSchemes',
  acquisitionMethod: ACQUISITION_METHOD.OFFICIAL_OPEN_DATA_FILE_DOWNLOAD,
  automatedRetrieval: true,
  retrievedAt: '2026-10-01T09:00:00Z',
  sourceEffectiveAt: '2025-05-05T00:00:00Z',
  artifactMimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  artifactFormat: 'XLSX',
  artifactHashSha256: H2,
  extractionMethod: EXTRACTION_METHOD.STRUCTURED_FILE_PARSE,
  extractorVersion: 'C2N-XLSX-1',
  extractedPayload: { dataset: 'approved-schemes', year: 2024 },
  termsEvidenceRef: 'MADINAH-OPEN-DATA-POLICY',
  licenseReference: 'MADINAH-OPEN-DATA-REUSE-POLICY',
  attributionText: 'Source: Madinah Municipality open data',
});
assert.strictEqual(evaluateGovernedNonApiAcquisition(madinah, { asOf: AS_OF }).status,
  NON_API_ACQUISITION_STATUS.READY_FOR_C2S_PROVENANCE_EVALUATION);

const riyadhOpen = createGovernedNonApiAcquisitionRecord({
  acquisitionId: 'ACQ-RIYADH-OPEN-1',
  profileId: 'RIYADH_OPEN_DATA_DOWNLOADS',
  sourceProvider: 'RIYADH_MUNICIPALITY_GEOSPATIAL',
  sourceUrl: 'https://rmp.alriyadh.gov.sa/ar/open-data',
  acquisitionMethod: ACQUISITION_METHOD.OFFICIAL_REPORT_DOWNLOAD,
  automatedRetrieval: true,
  retrievedAt: '2026-10-01T09:00:00Z',
  artifactMimeType: 'application/pdf',
  artifactFormat: 'PDF',
  artifactHashSha256: H1,
  extractionMethod: EXTRACTION_METHOD.DOCUMENT_TEXT_EXTRACTION,
  extractorVersion: 'C2N-PDF-TEXT-1',
  extractedPayload: { publication: 'open-data-export' },
  termsEvidenceRef: 'RIYADH-OPEN-DATA-POLICY',
  licenseReference: 'RIYADH-OPEN-DATA-LICENSE',
  attributionText: 'Source: Riyadh Municipality open data',
});
assert.strictEqual(evaluateGovernedNonApiAcquisition(riyadhOpen, { asOf: AS_OF }).status,
  NON_API_ACQUISITION_STATUS.READY_FOR_C2S_PROVENANCE_EVALUATION);

const riyadhMapAttempt = createGovernedNonApiAcquisitionRecord({
  acquisitionId: 'ACQ-RIYADH-MAP-1',
  profileId: 'RIYADH_MAP_PORTAL_RESTRICTED',
  sourceProvider: 'RIYADH_MUNICIPALITY_GEOSPATIAL',
  sourceUrl: 'https://maps.alriyadh.gov.sa/geoportal/geomap',
  acquisitionMethod: ACQUISITION_METHOD.PUBLIC_BROWSER_RENDERED_CAPTURE,
  automatedRetrieval: true,
  retrievedAt: '2026-10-01T09:00:00Z',
  artifactMimeType: 'text/html',
  artifactFormat: 'HTML',
  artifactHashSha256: H1,
  extractionMethod: EXTRACTION_METHOD.BROWSER_RENDERED_SNAPSHOT_EXTRACTION,
  extractorVersion: 'C2N-BROWSER-1',
  extractedPayload: { attempted: true },
  termsEvidenceRef: 'RIYADH-PORTAL-TERMS',
  attributionText: 'Source: Riyadh Municipality map portal',
});
const riyadhBlocked = evaluateGovernedNonApiAcquisition(riyadhMapAttempt, { asOf: AS_OF });
assert.strictEqual(riyadhBlocked.status, NON_API_ACQUISITION_STATUS.HOLD_RIGHTS);
assert(riyadhBlocked.blockers.includes('C2N_ACQUISITION_METHOD_NOT_ALLOWED_BY_PROFILE'));
assert(riyadhBlocked.blockers.includes('C2N_RIGHTS_VERIFICATION_REQUIRED'));

const regaScrape = createGovernedNonApiAcquisitionRecord({
  acquisitionId: 'ACQ-REGA-WEB-1',
  profileId: 'REGA_INDICATOR_WEB_UI_RESTRICTED',
  sourceProvider: 'REGA_REAL_ESTATE_INDICATORS',
  sourceUrl: 'https://rei.rega.gov.sa/ar',
  acquisitionMethod: ACQUISITION_METHOD.PUBLIC_BROWSER_RENDERED_CAPTURE,
  automatedRetrieval: true,
  retrievedAt: '2026-10-01T09:00:00Z',
  artifactMimeType: 'text/html',
  artifactFormat: 'HTML',
  artifactHashSha256: H1,
  extractionMethod: EXTRACTION_METHOD.HTML_TABLE_EXTRACTION,
  extractorVersion: 'C2N-HTML-1',
  extractedPayload: { attempted: true },
  termsEvidenceRef: 'REGA-INDICATOR-TERMS-2026-06-25',
  attributionText: 'Source: REGA Real Estate Indicators',
});
const regaScrapeBlocked = evaluateGovernedNonApiAcquisition(regaScrape, { asOf: AS_OF });
assert.notStrictEqual(regaScrapeBlocked.status, NON_API_ACQUISITION_STATUS.READY_FOR_C2S_PROVENANCE_EVALUATION);
assert(regaScrapeBlocked.blockers.includes('C2N_ACQUISITION_METHOD_NOT_ALLOWED_BY_PROFILE'));

const regaOpen = createGovernedNonApiAcquisitionRecord({
  acquisitionId: 'ACQ-REGA-OPEN-1',
  profileId: 'REGA_OPEN_DATA_DOWNLOADS',
  sourceProvider: 'REGA_REAL_ESTATE_INDICATORS',
  sourceUrl: 'https://rega.gov.sa/open-data/example',
  acquisitionMethod: ACQUISITION_METHOD.OFFICIAL_OPEN_DATA_FILE_DOWNLOAD,
  automatedRetrieval: false,
  retrievedAt: '2026-10-01T09:00:00Z',
  artifactMimeType: 'text/csv',
  artifactFormat: 'CSV',
  artifactHashSha256: H2,
  extractionMethod: EXTRACTION_METHOD.STRUCTURED_FILE_PARSE,
  extractorVersion: 'C2N-CSV-1',
  extractedPayload: { rows: [1, 2, 3] },
  termsEvidenceRef: 'REGA-OPEN-DATA-POLICY',
  licenseReference: 'REGA-OPEN-DATA-RIGHTS-REVIEW',
  attributionText: 'Source: Real Estate General Authority open data',
  rightsVerified: true,
  rightsVerifiedByRef: 'RIGHTS-COUNSEL-1',
  rightsVerifiedAt: '2026-10-01T08:00:00Z',
  rightsEvidenceRef: 'REGA-OPEN-DATA-RIGHTS-EVIDENCE',
});
assert.strictEqual(evaluateGovernedNonApiAcquisition(regaOpen, {
  asOf: AS_OF,
  trustedRightsVerifierIds: ['RIGHTS-COUNSEL-1'],
}).status, NON_API_ACQUISITION_STATUS.READY_FOR_C2S_PROVENANCE_EVALUATION);

const earth = createGovernedNonApiAcquisitionRecord({
  acquisitionId: 'ACQ-EARTH-1',
  profileId: 'EARTH_COMMERCIAL_RESTRICTED',
  sourceProvider: 'EARTHAPP_COMMERCIAL_INTELLIGENCE',
  sourceUrl: 'https://map.earthapp.com.sa/',
  acquisitionMethod: ACQUISITION_METHOD.USER_AUTHORIZED_BROWSER_EXPORT,
  automatedRetrieval: false,
  retrievedAt: '2026-10-01T09:00:00Z',
  artifactMimeType: 'application/pdf',
  artifactFormat: 'PDF',
  artifactHashSha256: H1,
  extractionMethod: EXTRACTION_METHOD.DOCUMENT_TEXT_EXTRACTION,
  extractorVersion: 'C2N-PDF-TEXT-1',
  extractedPayload: { parcel: 'user-authorized-export' },
  termsEvidenceRef: 'EARTH-TERMS-2026',
  licenseReference: 'EARTH-CONTRACT-RIGHTS-REF',
  attributionText: 'Source: Earth App',
  rightsVerified: true,
  rightsVerifiedByRef: 'RIGHTS-COUNSEL-1',
  rightsVerifiedAt: '2026-10-01T08:00:00Z',
  rightsEvidenceRef: 'EARTH-WRITTEN-RIGHTS-EVIDENCE',
  browserSessionAuthorizationRef: 'USER-SESSION-EXPORT-1',
});
const earthResult = evaluateGovernedNonApiAcquisition(earth, {
  asOf: AS_OF,
  trustedRightsVerifierIds: ['RIGHTS-COUNSEL-1'],
});
assert.strictEqual(earthResult.status, NON_API_ACQUISITION_STATUS.READY_FOR_C2S_PROVENANCE_EVALUATION);
assert.strictEqual(earthResult.corroborationOnly, true);
assert.strictEqual(earthResult.authoritativeEvidenceEstablished, false);

const earthAutomated = createGovernedNonApiAcquisitionRecord({ ...earth, acquisitionId: 'ACQ-EARTH-AUTO', automatedRetrieval: true });
const earthAutomatedResult = evaluateGovernedNonApiAcquisition(earthAutomated, {
  asOf: AS_OF,
  trustedRightsVerifierIds: ['RIGHTS-COUNSEL-1'],
});
assert.notStrictEqual(earthAutomatedResult.status, NON_API_ACQUISITION_STATUS.READY_FOR_C2S_PROVENANCE_EVALUATION);
assert(earthAutomatedResult.blockers.includes('C2N_AUTOMATED_RETRIEVAL_NOT_ALLOWED'));

const tathmin = createGovernedNonApiAcquisitionRecord({
  acquisitionId: 'ACQ-TATHMIN-1',
  profileId: 'TATHMIN_AVM_RESTRICTED',
  sourceProvider: 'TATHMIN_INDICATIVE_AVM',
  sourceUrl: 'https://tathmin.online/valuation',
  acquisitionMethod: ACQUISITION_METHOD.MANUAL_GOVERNED_UPLOAD,
  automatedRetrieval: false,
  retrievedAt: '2026-10-01T09:00:00Z',
  artifactMimeType: 'application/pdf',
  artifactFormat: 'PDF',
  artifactHashSha256: H1,
  extractionMethod: EXTRACTION_METHOD.MANUAL_VERIFIED_TRANSCRIPTION,
  extractorVersion: 'C2N-MANUAL-1',
  extractedPayload: { indicativeValueSar: 1000000, official: false },
  termsEvidenceRef: 'TATHMIN-TERMS-REVIEW-PENDING',
  licenseReference: 'TATHMIN-USE-RIGHTS-EVIDENCE',
  attributionText: 'Source: Tathmin indicative AVM',
  rightsVerified: true,
  rightsVerifiedByRef: 'RIGHTS-COUNSEL-1',
  rightsVerifiedAt: '2026-10-01T08:00:00Z',
  rightsEvidenceRef: 'TATHMIN-RIGHTS-EVIDENCE',
});
const tathminResult = evaluateGovernedNonApiAcquisition(tathmin, {
  asOf: AS_OF,
  trustedRightsVerifierIds: ['RIGHTS-COUNSEL-1'],
});
assert.strictEqual(tathminResult.status, NON_API_ACQUISITION_STATUS.READY_FOR_C2S_PROVENANCE_EVALUATION);
assert.strictEqual(tathminResult.avmBenchmarkOnly, true);
assert.strictEqual(tathminResult.authoritativeEvidenceEstablished, false);
assert.strictEqual(tathminResult.certifiedValuationEstablished, false);

const noAttribution = openDataRecord({ acquisitionId: 'ACQ-NO-ATTR', attributionText: null });
const noAttributionResult = evaluateGovernedNonApiAcquisition(noAttribution, { asOf: AS_OF });
assert.strictEqual(noAttributionResult.status, NON_API_ACQUISITION_STATUS.HOLD_RIGHTS);
assert(noAttributionResult.blockers.includes('C2N_ATTRIBUTION_REQUIRED'));

const wrongDomain = openDataRecord({ acquisitionId: 'ACQ-WRONG-DOMAIN', sourceUrl: 'https://example.com/data.csv' });
const wrongDomainResult = evaluateGovernedNonApiAcquisition(wrongDomain, { asOf: AS_OF });
assert.strictEqual(wrongDomainResult.status, NON_API_ACQUISITION_STATUS.HOLD_SOURCE);

const tampered = { ...balady, extractedPayload: { rows: [{ planNo: 'TAMPERED' }] } };
const tamperedResult = evaluateGovernedNonApiAcquisition(tampered, { asOf: AS_OF });
assert.strictEqual(tamperedResult.status, NON_API_ACQUISITION_STATUS.HOLD_INTEGRITY);
assert(tamperedResult.blockers.includes('C2N_ACQUISITION_RECORD_INTEGRITY_FAILED'));
assert(tamperedResult.blockers.includes('C2N_EXTRACTED_PAYLOAD_HASH_INVALID'));

const future = openDataRecord({ acquisitionId: 'ACQ-FUTURE', retrievedAt: '2026-10-02T00:00:00Z' });
const futureResult = evaluateGovernedNonApiAcquisition(future, { asOf: AS_OF });
assert.strictEqual(futureResult.status, NON_API_ACQUISITION_STATUS.HOLD_TEMPORAL);
assert(futureResult.blockers.includes('C2N_RETRIEVED_AT_FUTURE'));

const forbiddenBypass = openDataRecord({ acquisitionId: 'ACQ-BYPASS', captchaBypassUsed: true });
const bypassResult = evaluateGovernedNonApiAcquisition(forbiddenBypass, { asOf: AS_OF });
assert.strictEqual(bypassResult.status, NON_API_ACQUISITION_STATUS.HOLD_POLICY);
assert(bypassResult.blockers.includes('C2N_CAPTCHA_BYPASS_FORBIDDEN'));

assert.throws(() => createGovernedNonApiAcquisitionRecord({
  acquisitionId: 'BAD-HASH', profileId: 'BALADY_OPEN_DATA_DOWNLOADS', sourceProvider: 'BALADY_URBAN_MAPS',
  sourceUrl: 'https://balady.gov.sa/data', acquisitionMethod: ACQUISITION_METHOD.MANUAL_GOVERNED_UPLOAD,
  retrievedAt: '2026-10-01T09:00:00Z', artifactMimeType: 'text/csv', artifactFormat: 'CSV',
  artifactHashSha256: 'bad', extractionMethod: EXTRACTION_METHOD.STRUCTURED_FILE_PARSE,
  extractorVersion: 'X', extractedPayload: {}, termsEvidenceRef: 'T',
}), /C2N_ARTIFACT_HASH_REQUIRED/);

console.log('C2N_GOVERNED_NON_API_SOURCE_ACQUISITION=PASS');
