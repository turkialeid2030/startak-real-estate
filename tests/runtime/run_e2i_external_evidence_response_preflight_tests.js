'use strict';

const assert = require('assert');
const crypto = require('crypto');
const policy = require('../../governance/e2i-production-evidence-go-live-readiness-policy-2026-09-08.json');
const {
  EVIDENCE_TYPE,
  EVIDENCE_RESULT,
  createReadinessEvidenceSigningPayload,
  normalizeReadinessVerifierRegistry,
} = require('../../src/standards/production-evidence-go-live-readiness');
const {
  STATUS,
  preflightExternalEvidenceResponses,
} = require('../../src/qualification/e2i-external-evidence-response-preflight');

const results = [];
const CLOSEOUT_HASH = 'a'.repeat(64);
const ARTIFACT_HASH = 'b'.repeat(64);
const ENV_HASH = 'c'.repeat(64);
const SOURCE_COMMIT = 'd'.repeat(40);
const RELEASE_ID = 'rc-startak-production-001';
const ENVIRONMENT_REF = 'production:startak-real-estate';
const CLOSEOUT_PREPARED_AT = '2026-09-11T01:00:00.000Z';
const INTAKE_AT = '2026-09-11T03:00:00.000Z';

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function sha256Text(value) {
  return crypto.createHash('sha256').update(String(value), 'utf8').digest('hex');
}

async function test(id, fn) {
  try {
    await fn();
    results.push([id, 'PASS']);
    console.log(`${id} PASS`);
  } catch (error) {
    results.push([id, `FAIL: ${error.message}`]);
    console.log(`${id} FAIL: ${error.message}`);
  }
}

function generateVerifier(verifierId, subjectRef, allowedEvidenceTypes) {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }).trim();
  return {
    registryRecord: {
      verifierId,
      verifierSubjectRef: subjectRef,
      allowedEvidenceTypes,
      publicKeyPem,
      publicKeySha256: sha256Text(publicKeyPem),
      governanceEvidenceRef: `governance:${verifierId}`,
      activeFrom: '2026-09-10T00:00:00.000Z',
      activeUntil: '2026-12-31T23:59:59.000Z',
    },
    privateKey,
  };
}

const TYPES = Object.values(EVIDENCE_TYPE);
const verifierA = generateVerifier('verifier-a', 'subject:legal-privacy', TYPES.slice(0, 3));
const verifierB = generateVerifier('verifier-b', 'subject:professional-production', TYPES.slice(3));

function registry(overrides = {}) {
  return {
    registryId: 'production-readiness-verifiers-2026-09-11',
    governanceArtifactSha256: 'e'.repeat(64),
    verifiers: [verifierA.registryRecord, verifierB.registryRecord],
    ...overrides,
  };
}

function releaseBinding(overrides = {}) {
  return {
    upstreamCloseoutPacketHashSha256: CLOSEOUT_HASH,
    releaseCandidateId: RELEASE_ID,
    sourceCommitSha: SOURCE_COMMIT,
    artifactSha256: ARTIFACT_HASH,
    environmentRef: ENVIRONMENT_REF,
    environmentConfigSha256: ENV_HASH,
    upstreamCloseoutPreparedAt: CLOSEOUT_PREPARED_AT,
    ...overrides,
  };
}

function signerForType(type) {
  return verifierA.registryRecord.allowedEvidenceTypes.includes(type) ? verifierA : verifierB;
}

function signedEvidence(type, index, overrides = {}) {
  const signer = signerForType(type);
  const base = {
    evidenceId: `evidence-${index + 1}`,
    evidenceType: type,
    upstreamCloseoutPacketHashSha256: CLOSEOUT_HASH,
    releaseCandidateId: RELEASE_ID,
    sourceCommitSha: SOURCE_COMMIT,
    artifactSha256: ARTIFACT_HASH,
    environmentRef: ENVIRONMENT_REF,
    environmentConfigSha256: ENV_HASH,
    verifierId: signer.registryRecord.verifierId,
    sourceRef: `sha256:${String(index + 1).padStart(64, '0')}`,
    evidenceArtifactSha256: crypto.createHash('sha256').update(`artifact-${index}`).digest('hex'),
    verifiedAt: '2026-09-11T02:00:00.000Z',
    expiresAt: '2026-10-11T02:00:00.000Z',
    result: EVIDENCE_RESULT.VERIFIED,
    scopeRef: `scope:${type}`,
    signatureAlgorithm: 'RSA-SHA256',
    ...overrides,
  };
  const payload = createReadinessEvidenceSigningPayload(base, policy);
  const signature = crypto.sign('RSA-SHA256', Buffer.from(stableStringify(payload), 'utf8'), signer.privateKey);
  return { ...base, signatureBase64: signature.toString('base64') };
}

function fullEvidence() {
  return TYPES.map((type, index) => signedEvidence(type, index));
}

function input(overrides = {}) {
  const r = registry();
  const normalized = normalizeReadinessVerifierRegistry(r);
  return {
    policy,
    readinessVerifierRegistry: r,
    expectedReadinessVerifierRegistryHashSha256: normalized.registryHashSha256,
    expectedReleaseBinding: releaseBinding(),
    readinessEvidence: fullEvidence(),
    intakePreparedAt: INTAKE_AT,
    ...overrides,
  };
}

(async () => {
  await test('E2I-RESPONSE-PREFLIGHT-01', async () => {
    const result = preflightExternalEvidenceResponses(input());
    assert.strictEqual(result.status, STATUS.READY_FOR_E2I_AGGREGATION_NOT_ACCEPTED);
    assert.strictEqual(result.readyForE2IAggregation, true);
    assert.strictEqual(result.e2iAcceptancePending, true);
    assert.strictEqual(result.readinessEvidence.length, 6);
    assert.strictEqual(result.verifierSubjects.length, 2);
    for (const value of Object.values(result.authority)) assert.strictEqual(value, false);
  });

  await test('E2I-RESPONSE-PREFLIGHT-02', async () => {
    const result = preflightExternalEvidenceResponses(input({ expectedReadinessVerifierRegistryHashSha256: 'f'.repeat(64) }));
    assert.strictEqual(result.status, STATUS.HOLD_READINESS_TRUST_ROOT);
    assert.ok(result.blockers.includes('READINESS_VERIFIER_REGISTRY_HASH_MISMATCH'));
  });

  await test('E2I-RESPONSE-PREFLIGHT-03', async () => {
    const evidence = fullEvidence().slice(0, 5);
    const result = preflightExternalEvidenceResponses(input({ readinessEvidence: evidence }));
    assert.strictEqual(result.status, STATUS.HOLD_EXTERNAL_EVIDENCE_RESPONSE_COVERAGE);
    assert.ok(result.blockers.some((item) => item.includes(TYPES[5])));
  });

  await test('E2I-RESPONSE-PREFLIGHT-04', async () => {
    const allVerifier = generateVerifier('verifier-only', 'subject:only', TYPES);
    const oneRegistry = {
      registryId: 'single-subject-registry',
      governanceArtifactSha256: '1'.repeat(64),
      verifiers: [allVerifier.registryRecord],
    };
    const normalized = normalizeReadinessVerifierRegistry(oneRegistry);
    const evidence = TYPES.map((type, index) => {
      const base = {
        evidenceId: `single-${index}`,
        evidenceType: type,
        upstreamCloseoutPacketHashSha256: CLOSEOUT_HASH,
        releaseCandidateId: RELEASE_ID,
        sourceCommitSha: SOURCE_COMMIT,
        artifactSha256: ARTIFACT_HASH,
        environmentRef: ENVIRONMENT_REF,
        environmentConfigSha256: ENV_HASH,
        verifierId: allVerifier.registryRecord.verifierId,
        sourceRef: `sha256:${String(index + 10).padStart(64, '0')}`,
        evidenceArtifactSha256: crypto.createHash('sha256').update(`single-${index}`).digest('hex'),
        verifiedAt: '2026-09-11T02:00:00.000Z',
        expiresAt: '2026-10-11T02:00:00.000Z',
        result: EVIDENCE_RESULT.VERIFIED,
        scopeRef: `scope:${type}`,
        signatureAlgorithm: 'RSA-SHA256',
      };
      const payload = createReadinessEvidenceSigningPayload(base, policy);
      const signature = crypto.sign('RSA-SHA256', Buffer.from(stableStringify(payload), 'utf8'), allVerifier.privateKey);
      return { ...base, signatureBase64: signature.toString('base64') };
    });
    const result = preflightExternalEvidenceResponses(input({
      readinessVerifierRegistry: oneRegistry,
      expectedReadinessVerifierRegistryHashSha256: normalized.registryHashSha256,
      readinessEvidence: evidence,
    }));
    assert.strictEqual(result.status, STATUS.HOLD_EXTERNAL_EVIDENCE_RESPONSE_COVERAGE);
    assert.ok(result.blockers.includes('SINGLE_VERIFIER_SUBJECT_FOR_ALL_READINESS_EVIDENCE_PROHIBITED'));
  });

  await test('E2I-RESPONSE-PREFLIGHT-05', async () => {
    const evidence = fullEvidence();
    evidence[0] = { ...evidence[0], signatureBase64: Buffer.from('tampered').toString('base64') };
    const result = preflightExternalEvidenceResponses(input({ readinessEvidence: evidence }));
    assert.strictEqual(result.status, STATUS.HOLD_EXTERNAL_EVIDENCE_RESPONSE_INTEGRITY);
    assert.ok(result.blockers.some((item) => item.startsWith('READINESS_EVIDENCE_SIGNATURE_INVALID:')));
  });

  await test('E2I-RESPONSE-PREFLIGHT-06', async () => {
    const evidence = fullEvidence();
    evidence[0] = signedEvidence(TYPES[0], 0, { releaseCandidateId: 'rc-other' });
    const result = preflightExternalEvidenceResponses(input({ readinessEvidence: evidence }));
    assert.strictEqual(result.status, STATUS.HOLD_EXTERNAL_EVIDENCE_RESPONSE_INTEGRITY);
    assert.ok(result.blockers.some((item) => item.startsWith('READINESS_RELEASE_CANDIDATE_MISMATCH:')));
  });

  await test('E2I-RESPONSE-PREFLIGHT-07', async () => {
    const evidence = fullEvidence();
    evidence[1] = signedEvidence(TYPES[1], 1, { result: EVIDENCE_RESULT.REJECTED });
    const result = preflightExternalEvidenceResponses(input({ readinessEvidence: evidence }));
    assert.strictEqual(result.status, STATUS.HOLD_EXTERNAL_EVIDENCE_RESPONSE_RESULT);
    assert.ok(result.blockers.some((item) => item.includes(':REJECTED')));
  });

  await test('E2I-RESPONSE-PREFLIGHT-08', async () => {
    const evidence = fullEvidence();
    evidence[2] = signedEvidence(TYPES[2], 2, { expiresAt: '2026-09-11T01:30:00.000Z' });
    const result = preflightExternalEvidenceResponses(input({ readinessEvidence: evidence }));
    assert.strictEqual(result.status, STATUS.HOLD_EXTERNAL_EVIDENCE_RESPONSE_INTEGRITY);
    assert.ok(result.blockers.some((item) => item.startsWith('READINESS_EVIDENCE_EXPIRY_BEFORE_VERIFICATION:')));
  });

  await test('E2I-RESPONSE-PREFLIGHT-09', async () => {
    const result = preflightExternalEvidenceResponses(input());
    assert.strictEqual(result.authority.goLiveAuthorized, false);
    assert.strictEqual(result.authority.externalEvidenceAcceptedByE2I, false);
    assert.strictEqual(result.authority.legalApprovalEstablished, false);
    assert.strictEqual(result.authority.professionalAuthorityEstablished, false);
  });

  const failed = results.filter((entry) => entry[1] !== 'PASS');
  const passed = results.length - failed.length;
  console.log(`E2I_EXTERNAL_EVIDENCE_RESPONSE_PREFLIGHT_RESULT=${failed.length === 0 ? 'PASS' : 'FAIL'} ${passed}/${results.length}`);
  if (failed.length) process.exit(1);
})().catch((error) => {
  console.error('E2I_EXTERNAL_EVIDENCE_RESPONSE_PREFLIGHT_FATAL', error && error.stack ? error.stack : error);
  process.exit(1);
});
