'use strict';

const assert = require('assert/strict');
const {
  SOURCE_TIER,
  SOURCE_PROVIDER_KIND,
  SOURCE_LICENSING_STATUS,
  SOURCE_USAGE_ROLE,
  SOURCE_PROVENANCE_GATE_STATUS,
  PROFESSIONAL_LICENSE_AUTHORITY,
} = require('../../src/contracts/source-intelligence');
const {
  evaluateSourceProvenanceBundle,
  hashValue,
} = require('../../src/source-intelligence/source-provenance-governance');

const AS_OF = '2026-09-30T07:00:00.000Z';
const TRUSTED_PROVENANCE_VERIFIER = 'C2S-PROVENANCE-VERIFIER';
const TRUSTED_LICENSE_VERIFIER = 'C2S-LICENSE-VERIFIER';

function payload(kind, value) {
  return { kind, value };
}

function provenanceVerificationFields(provenanceVerified, suffix) {
  return provenanceVerified === true ? {
    provenanceVerifiedBy: TRUSTED_PROVENANCE_VERIFIER,
    provenanceVerificationReference: `PROVENANCE-VERIFY-${suffix}`,
    provenanceVerifiedAt: '2026-09-30T06:30:00.000Z',
  } : {
    provenanceVerifiedBy: null,
    provenanceVerificationReference: null,
    provenanceVerifiedAt: null,
  };
}

function baseRecord(overrides = {}) {
  const evidencePayload = overrides.evidencePayload || payload('MARKET_EVIDENCE', { amountSar: 10000000 });
  const provenanceVerified = Object.prototype.hasOwnProperty.call(overrides, 'provenanceVerified')
    ? overrides.provenanceVerified
    : true;
  return {
    id: 'official-rega-1',
    sourceProvider: 'REGA_REAL_ESTATE_INDICATORS',
    underlyingAuthority: 'MINISTRY_OF_JUSTICE_REAL_ESTATE_TRANSACTIONS',
    provenanceVerified,
    ...provenanceVerificationFields(provenanceVerified, 'REGA-001'),
    sourceTier: SOURCE_TIER.A_OFFICIAL_AUTHORITATIVE,
    licensingStatus: SOURCE_LICENSING_STATUS.NOT_APPLICABLE_OFFICIAL,
    sourceUrl: 'https://rei.rega.gov.sa/ar/advanced-search/deals',
    retrievedAt: '2026-09-30T06:00:00.000Z',
    effectiveAt: '2026-09-29T12:00:00.000Z',
    validUntil: '2026-10-30T06:00:00.000Z',
    originalSourceReference: 'REGA-DEAL-001',
    methodologyVersion: 'REGA-METHOD-2026-09',
    corroboratedBy: [],
    evidencePayload,
    evidenceHashSha256: hashValue(evidencePayload),
    ...overrides,
  };
}

function statisticalOfficialRecord(overrides = {}) {
  const evidencePayload = overrides.evidencePayload || payload('OFFICIAL_STATISTICAL_INDEX', { index: 118.4 });
  const provenanceVerified = Object.prototype.hasOwnProperty.call(overrides, 'provenanceVerified')
    ? overrides.provenanceVerified
    : true;
  return {
    id: 'official-gastat-1',
    sourceProvider: 'GASTAT_REAL_ESTATE_INDICES',
    underlyingAuthority: 'GASTAT_REAL_ESTATE_INDICES',
    provenanceVerified,
    ...provenanceVerificationFields(provenanceVerified, 'GASTAT-001'),
    sourceTier: SOURCE_TIER.A_OFFICIAL_AUTHORITATIVE,
    licensingStatus: SOURCE_LICENSING_STATUS.NOT_APPLICABLE_OFFICIAL,
    sourceUrl: 'https://www.stats.gov.sa/',
    retrievedAt: '2026-09-30T06:05:00.000Z',
    effectiveAt: '2026-09-28T00:00:00.000Z',
    validUntil: '2026-10-30T06:05:00.000Z',
    originalSourceReference: 'GASTAT-INDEX-001',
    methodologyVersion: 'GASTAT-METHOD-2026-Q3',
    corroboratedBy: [],
    evidencePayload,
    evidenceHashSha256: hashValue(evidencePayload),
    ...overrides,
  };
}

function commercialRecord(overrides = {}) {
  const evidencePayload = overrides.evidencePayload || payload('COMMERCIAL_MARKET_VIEW', { pricePerSqmSar: 5100 });
  const provenanceVerified = Object.prototype.hasOwnProperty.call(overrides, 'provenanceVerified')
    ? overrides.provenanceVerified
    : false;
  return {
    id: 'earth-1',
    sourceProvider: 'EARTHAPP_COMMERCIAL_INTELLIGENCE',
    underlyingAuthority: null,
    provenanceVerified,
    ...provenanceVerificationFields(provenanceVerified, 'COMMERCIAL-001'),
    sourceTier: SOURCE_TIER.B_COMMERCIAL_CORROBORATION,
    licensingStatus: SOURCE_LICENSING_STATUS.TERMS_OR_LICENSE_NOT_VERIFIED,
    sourceUrl: 'https://map.earthapp.com.sa/',
    retrievedAt: '2026-09-30T06:10:00.000Z',
    effectiveAt: '2026-09-29T12:00:00.000Z',
    validUntil: '2026-10-30T06:10:00.000Z',
    originalSourceReference: 'EARTH-VIEW-001',
    methodologyVersion: 'UNVERIFIED_COMMERCIAL_METHOD',
    corroboratedBy: [],
    evidencePayload,
    evidenceHashSha256: hashValue(evidencePayload),
    ...overrides,
  };
}

function avmRecord(overrides = {}) {
  const evidencePayload = overrides.evidencePayload || payload('INDICATIVE_AVM', { valueSar: 12600000 });
  const provenanceVerified = Object.prototype.hasOwnProperty.call(overrides, 'provenanceVerified')
    ? overrides.provenanceVerified
    : false;
  return {
    id: 'tathmin-1',
    sourceProvider: 'TATHMIN_INDICATIVE_AVM',
    underlyingAuthority: null,
    provenanceVerified,
    ...provenanceVerificationFields(provenanceVerified, 'AVM-001'),
    sourceTier: SOURCE_TIER.C_INDICATIVE_AVM,
    licensingStatus: SOURCE_LICENSING_STATUS.TERMS_OR_LICENSE_NOT_VERIFIED,
    sourceUrl: 'https://tathmin.online/valuation',
    retrievedAt: '2026-09-30T06:15:00.000Z',
    effectiveAt: '2026-09-30T06:00:00.000Z',
    validUntil: '2026-10-07T06:15:00.000Z',
    originalSourceReference: 'TATHMIN-AVM-001',
    methodologyVersion: 'EXTERNAL_AVM_UNVERIFIED_METHOD',
    corroboratedBy: [],
    evidencePayload,
    evidenceHashSha256: hashValue(evidencePayload),
    ...overrides,
  };
}

const professionalProviders = {
  RIYADH_VALUER_EXAMPLE: {
    id: 'RIYADH_VALUER_EXAMPLE',
    organization: 'Riyadh Valuer Example LLC',
    sourceTier: SOURCE_TIER.D_LICENSED_PROFESSIONAL,
    providerKind: SOURCE_PROVIDER_KIND.LICENSED_PROFESSIONAL_FIRM,
    officialDomains: ['valuer.example.com'],
    licenseAuthority: PROFESSIONAL_LICENSE_AUTHORITY.TAQEEM_LICENSE_FRAMEWORK,
    productionAdapterEnabled: false,
  },
};

function professionalRecord(overrides = {}) {
  const evidencePayload = overrides.evidencePayload || payload('PROFESSIONAL_VALUATION_OPINION', { opinionSar: 12700000 });
  const provenanceVerified = Object.prototype.hasOwnProperty.call(overrides, 'provenanceVerified')
    ? overrides.provenanceVerified
    : true;
  return {
    id: 'professional-1',
    sourceProvider: 'RIYADH_VALUER_EXAMPLE',
    underlyingAuthority: PROFESSIONAL_LICENSE_AUTHORITY.TAQEEM_LICENSE_FRAMEWORK,
    provenanceVerified,
    ...provenanceVerificationFields(provenanceVerified, 'PROFESSIONAL-001'),
    sourceTier: SOURCE_TIER.D_LICENSED_PROFESSIONAL,
    licensingStatus: SOURCE_LICENSING_STATUS.PROFESSIONAL_LICENSE_VERIFIED,
    sourceUrl: 'https://valuer.example.com/report/001',
    retrievedAt: '2026-09-30T06:20:00.000Z',
    effectiveAt: '2026-09-30T05:00:00.000Z',
    validUntil: '2026-10-30T06:20:00.000Z',
    originalSourceReference: 'PRO-REPORT-001',
    methodologyVersion: 'PROFESSIONAL-REPORT-METHOD-1',
    corroboratedBy: [],
    evidencePayload,
    evidenceHashSha256: hashValue(evidencePayload),
    licenseVerification: {
      licenseAuthority: PROFESSIONAL_LICENSE_AUTHORITY.TAQEEM_LICENSE_FRAMEWORK,
      licenseId: 'TAQEEM-LICENSE-EXAMPLE-001',
      licensedEntity: 'Riyadh Valuer Example LLC',
      verifiedBy: TRUSTED_LICENSE_VERIFIER,
      verificationReference: 'LICENSE-VERIFY-001',
      verifiedAt: '2026-09-30T06:25:00.000Z',
      validUntil: '2027-09-30T00:00:00.000Z',
    },
    ...overrides,
  };
}

function evaluate(records, overrides = {}) {
  return evaluateSourceProvenanceBundle({
    records,
    asOf: AS_OF,
    trustedProvenanceVerifierIds: [TRUSTED_PROVENANCE_VERIFIER],
    ...overrides,
  });
}

const official = baseRecord();
const validOfficial = evaluate([official]);
assert.equal(validOfficial.status, SOURCE_PROVENANCE_GATE_STATUS.READY);
assert.equal(validOfficial.provenanceClassificationReady, true);
assert.equal(validOfficial.decisionReady, false);
assert.equal(validOfficial.authoritativeEvidenceReady, true);
assert.equal(validOfficial.authoritativeEvidence.length, 1);
assert.equal(validOfficial.authoritativeEvidence[0].usageRole, SOURCE_USAGE_ROLE.AUTHORITATIVE_EVIDENCE);
assert.equal(validOfficial.authoritativeEvidence[0].authoritativeEvidenceEligible, true);
assert.equal(validOfficial.verifiedOfficialEvidenceRecords.length, 1);

const unknownCommercial = evaluate([commercialRecord()]);
assert.equal(unknownCommercial.status, SOURCE_PROVENANCE_GATE_STATUS.READY);
assert.equal(unknownCommercial.provenanceClassificationReady, true);
assert.equal(unknownCommercial.decisionReady, false);
assert.equal(unknownCommercial.authoritativeEvidenceReady, false);
assert.equal(unknownCommercial.authoritativeEvidence.length, 0);
assert.equal(unknownCommercial.commercialCorroboration.length, 1);
assert.equal(unknownCommercial.authoritativeElevationFromCommercial, false);

const fakeAuthority = evaluate([
  commercialRecord({
    underlyingAuthority: 'MINISTRY_OF_JUSTICE_REAL_ESTATE_TRANSACTIONS',
    provenanceVerified: true,
  }),
]);
assert.equal(fakeAuthority.status, SOURCE_PROVENANCE_GATE_STATUS.HOLD_EVIDENCE);
assert.ok(fakeAuthority.blockers.includes('C2S_COMMERCIAL_OFFICIAL_PROVENANCE_UNCORROBORATED'));

const corroborated = commercialRecord({
  id: 'suhail-1',
  sourceProvider: 'SUHAIL_COMMERCIAL_INTELLIGENCE',
  sourceUrl: 'https://www.suhail.ai/',
  underlyingAuthority: 'MINISTRY_OF_JUSTICE_REAL_ESTATE_TRANSACTIONS',
  provenanceVerified: true,
  provenanceVerificationReference: 'PROVENANCE-VERIFY-SUHAIL-001',
  corroboratedBy: [official.evidenceHashSha256],
});
const corroboratedBundle = evaluate([official, corroborated]);
assert.equal(corroboratedBundle.status, SOURCE_PROVENANCE_GATE_STATUS.READY);
assert.equal(corroboratedBundle.decisionReady, false);
assert.equal(corroboratedBundle.authoritativeEvidence.length, 1);
assert.equal(corroboratedBundle.commercialCorroboration.length, 1);
assert.equal(corroboratedBundle.commercialCorroboration[0].officialUnderlyingProvenanceCorroborated, true);
assert.deepEqual(corroboratedBundle.commercialCorroboration[0].matchedOfficialEvidenceHashes, [official.evidenceHashSha256]);
assert.equal(corroboratedBundle.commercialCorroboration[0].authoritativeEvidenceEligible, false);

const unrelatedOfficial = statisticalOfficialRecord();
const commercialWrongAuthorityHash = evaluate([
  unrelatedOfficial,
  commercialRecord({
    underlyingAuthority: 'MINISTRY_OF_JUSTICE_REAL_ESTATE_TRANSACTIONS',
    provenanceVerified: true,
    corroboratedBy: [unrelatedOfficial.evidenceHashSha256],
  }),
]);
assert.equal(commercialWrongAuthorityHash.status, SOURCE_PROVENANCE_GATE_STATUS.HOLD_EVIDENCE);
assert.ok(commercialWrongAuthorityHash.blockers.includes('C2S_COMMERCIAL_OFFICIAL_PROVENANCE_AUTHORITY_MISMATCH'));

const untrustedOfficialProvenance = evaluateSourceProvenanceBundle({
  records: [official],
  asOf: AS_OF,
  trustedProvenanceVerifierIds: ['OTHER-PROVENANCE-VERIFIER'],
});
assert.equal(untrustedOfficialProvenance.status, SOURCE_PROVENANCE_GATE_STATUS.HOLD_EVIDENCE);
assert.ok(untrustedOfficialProvenance.blockers.includes(
  `C2S_PROVENANCE_VERIFIER_UNTRUSTED:official-rega-1:${TRUSTED_PROVENANCE_VERIFIER}`,
));
assert.equal(untrustedOfficialProvenance.authoritativeEvidence.length, 0);

const selfAssertedProvenance = evaluate([
  baseRecord({
    provenanceVerified: true,
    provenanceVerifiedBy: null,
    provenanceVerificationReference: null,
    provenanceVerifiedAt: null,
  }),
]);
assert.equal(selfAssertedProvenance.status, SOURCE_PROVENANCE_GATE_STATUS.HOLD_EVIDENCE);
assert.ok(selfAssertedProvenance.blockers.includes('C2S_PROVENANCE_VERIFIER_REQUIRED:official-rega-1'));
assert.ok(selfAssertedProvenance.blockers.includes('C2S_PROVENANCE_VERIFICATION_REFERENCE_REQUIRED:official-rega-1'));
assert.ok(selfAssertedProvenance.blockers.includes('C2S_PROVENANCE_VERIFIED_AT_REQUIRED:official-rega-1'));

const validAvm = evaluate([avmRecord()]);
assert.equal(validAvm.status, SOURCE_PROVENANCE_GATE_STATUS.READY);
assert.equal(validAvm.provenanceClassificationReady, true);
assert.equal(validAvm.decisionReady, false);
assert.equal(validAvm.authoritativeEvidenceReady, false);
assert.equal(validAvm.avmBenchmarks.length, 1);
assert.equal(validAvm.avmCanEstablishCertifiedValuation, false);
assert.equal(validAvm.certifiedValuationEstablished, false);

const corroboratedAvm = evaluate([
  official,
  avmRecord({
    underlyingAuthority: 'MINISTRY_OF_JUSTICE_REAL_ESTATE_TRANSACTIONS',
    provenanceVerified: true,
    provenanceVerificationReference: 'PROVENANCE-VERIFY-TATHMIN-001',
    corroboratedBy: [official.evidenceHashSha256],
  }),
]);
assert.equal(corroboratedAvm.status, SOURCE_PROVENANCE_GATE_STATUS.READY);
assert.equal(corroboratedAvm.avmBenchmarks.length, 1);
assert.equal(corroboratedAvm.avmBenchmarks[0].officialUnderlyingProvenanceCorroborated, true);
assert.equal(corroboratedAvm.avmBenchmarks[0].authoritativeEvidenceEligible, false);

const avmWrongAuthorityHash = evaluate([
  unrelatedOfficial,
  avmRecord({
    underlyingAuthority: 'MINISTRY_OF_JUSTICE_REAL_ESTATE_TRANSACTIONS',
    provenanceVerified: true,
    corroboratedBy: [unrelatedOfficial.evidenceHashSha256],
  }),
]);
assert.equal(avmWrongAuthorityHash.status, SOURCE_PROVENANCE_GATE_STATUS.HOLD_EVIDENCE);
assert.ok(avmWrongAuthorityHash.blockers.includes('C2S_AVM_OFFICIAL_PROVENANCE_AUTHORITY_MISMATCH'));

const avmAuthorityInjection = evaluate([
  avmRecord({ certifiedValuationEstablished: true, transactionAuthorized: true }),
]);
assert.equal(avmAuthorityInjection.status, SOURCE_PROVENANCE_GATE_STATUS.HOLD_EVIDENCE);
assert.ok(avmAuthorityInjection.blockers.includes('C2S_AUTHORITY_INJECTION_ATTEMPT:certifiedValuationEstablished'));
assert.ok(avmAuthorityInjection.blockers.includes('C2S_AUTHORITY_INJECTION_ATTEMPT:transactionAuthorized'));

const validProfessional = evaluate([professionalRecord()], {
  governedProfessionalProviders: professionalProviders,
  trustedLicenseVerifierIds: [TRUSTED_LICENSE_VERIFIER],
});
assert.equal(validProfessional.status, SOURCE_PROVENANCE_GATE_STATUS.READY);
assert.equal(validProfessional.provenanceClassificationReady, true);
assert.equal(validProfessional.decisionReady, false);
assert.equal(validProfessional.authoritativeEvidenceReady, false);
assert.equal(validProfessional.professionalValuationOpinions.length, 1);
assert.equal(validProfessional.professionalValuationOpinions[0].professionalValuationOpinionEligible, true);
assert.equal(validProfessional.certifiedValuationEstablished, false);
assert.equal(validProfessional.transactionAuthorized, false);

const untrustedProfessional = evaluate([professionalRecord()], {
  governedProfessionalProviders: professionalProviders,
  trustedLicenseVerifierIds: ['SOMEONE-ELSE'],
});
assert.equal(untrustedProfessional.status, SOURCE_PROVENANCE_GATE_STATUS.HOLD_EVIDENCE);
assert.ok(untrustedProfessional.blockers.includes(`C2S_PROFESSIONAL_LICENSE_VERIFIER_UNTRUSTED:${TRUSTED_LICENSE_VERIFIER}`));

const stale = evaluate([baseRecord({ validUntil: '2026-09-30T06:30:00.000Z' })]);
assert.equal(stale.status, SOURCE_PROVENANCE_GATE_STATUS.HOLD_EVIDENCE);
assert.ok(stale.blockers.includes('C2S_SOURCE_EVIDENCE_STALE'));

const future = evaluate([baseRecord({ retrievedAt: '2026-09-30T08:00:00.000Z' })]);
assert.equal(future.status, SOURCE_PROVENANCE_GATE_STATUS.HOLD_EVIDENCE);
assert.ok(future.blockers.includes('C2S_RETRIEVED_AT_FUTURE'));

const futureProvenanceVerification = evaluate([
  baseRecord({ provenanceVerifiedAt: '2026-09-30T08:00:00.000Z' }),
]);
assert.equal(futureProvenanceVerification.status, SOURCE_PROVENANCE_GATE_STATUS.HOLD_EVIDENCE);
assert.ok(futureProvenanceVerification.blockers.includes('C2S_PROVENANCE_VERIFIED_AT_FUTURE:official-rega-1'));

const tampered = baseRecord();
tampered.evidencePayload = payload('MARKET_EVIDENCE', { amountSar: 99999999 });
const tamperedBundle = evaluate([tampered]);
assert.equal(tamperedBundle.status, SOURCE_PROVENANCE_GATE_STATUS.HOLD_EVIDENCE);
assert.ok(tamperedBundle.blockers.includes('C2S_EVIDENCE_HASH_MISMATCH'));

const duplicateIds = evaluate([
  official,
  commercialRecord({ id: official.id }),
]);
assert.equal(duplicateIds.status, SOURCE_PROVENANCE_GATE_STATUS.HOLD_EVIDENCE);
assert.ok(duplicateIds.blockers.includes(`C2S_DUPLICATE_SOURCE_RECORD_ID:${official.id}`));

const deterministicA = evaluate([official, commercialRecord(), avmRecord()]);
const deterministicB = evaluate([avmRecord(), official, commercialRecord()]);
assert.equal(deterministicA.status, SOURCE_PROVENANCE_GATE_STATUS.READY);
assert.equal(deterministicA.bundleHashSha256, deterministicB.bundleHashSha256);

for (const result of [validOfficial, unknownCommercial, corroboratedBundle, validAvm, corroboratedAvm, validProfessional]) {
  assert.equal(result.provenanceClassificationReady, true);
  assert.equal(result.decisionReady, false);
  assert.equal(result.finalValuationConclusionEstablished, false);
  assert.equal(result.certifiedValuationEstablished, false);
  assert.equal(result.transactionAuthorized, false);
  assert.equal(result.publicAiAuthorized, false);
  assert.match(result.bundleHashSha256, /^[a-f0-9]{64}$/);
}

console.log('C2S_SOURCE_INTELLIGENCE_EVIDENCE_PROVENANCE_REGISTRY=PASS');
