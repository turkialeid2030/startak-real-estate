'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const manifest = require('../../governance/source-evidence-convergence-manifest-2026-09-08.json');
const valuation = require('../../governance/official-valuation-standards-source-evidence-2026-09-08.json');
const saudiPhase1 = require('../../governance/official-saudi-regulatory-source-evidence-2026-09-08.json');
const saudiContext = require('../../governance/saudi-regulatory-context-source-evidence-2026-09-08.json');
const phase2 = require('../../governance/official-standards-and-licensing-source-evidence-phase2-2026-09-08.json');

let checks = 0;
function check(fn) { fn(); checks += 1; }

check(() => assert.strictEqual(manifest.manifestId, 'STARTAK-SOURCE-EVIDENCE-CONVERGENCE-2026-09-08'));
check(() => assert.strictEqual(manifest.operatingMode, 'UNLICENSED_DECISION_SUPPORT'));
check(() => assert.strictEqual(manifest.status, 'ENGINEERING_SOURCE_EVIDENCE_CONVERGED_WITH_EXTERNAL_AUTHORITY_BLOCKERS'));
check(() => assert.strictEqual(manifest.convergenceCommit, '8734fc1e585f5775465ab90e86151d2aa40b1c7a'));
check(() => assert.strictEqual(manifest.nextControlledTrack, 'E2_SAUDI_LEGAL_PROFESSIONAL_APPLICABILITY'));

check(() => assert.strictEqual(Array.isArray(manifest.lineage), true));
check(() => assert.deepStrictEqual(manifest.lineage.map((x) => x.pr), [188, 189, 190, 191]));
check(() => assert.strictEqual(manifest.lineage.every((x) => x.qualification.sourceEvidenceVerify === 'PASS'), true));
check(() => assert.strictEqual(manifest.lineage.every((x) => x.qualification.releaseVerify === 'PASS'), true));
check(() => assert.deepStrictEqual(manifest.lineage.map((x) => x.qualification.releaseVerifyRun), [567, 568, 569, 570]));

const p189 = manifest.lineage.find((x) => x.pr === 189);
const p190 = manifest.lineage.find((x) => x.pr === 190);
const p191 = manifest.lineage.find((x) => x.pr === 191);
check(() => assert.ok(p189));
check(() => assert.ok(p190));
check(() => assert.ok(p191));
check(() => assert.strictEqual(p189.relationship, 'PARALLEL_PHASE_1_A'));
check(() => assert.strictEqual(p190.relationship, 'PARALLEL_PHASE_1_B_RECONCILED_NOT_SUPERSEDED'));
check(() => assert.strictEqual(p191.relationship, 'PHASE_2_ON_PHASE_1_A'));
check(() => assert.strictEqual(p190.uniqueContextCoverage.length >= 8, true));

check(() => assert.strictEqual(manifest.convergenceRules.pr189AndPr190AreParallelQualifiedEvidenceIncrements, true));
check(() => assert.strictEqual(manifest.convergenceRules.pr190IsNotDiscarded, true));
check(() => assert.strictEqual(manifest.convergenceRules.pr190IsNotSilentlySupersededByPr189, true));
check(() => assert.strictEqual(manifest.convergenceRules.allUniqueEvidenceArtifactsPreserved, true));
check(() => assert.strictEqual(manifest.convergenceRules.standardsAutoActivationProhibited, true));
check(() => assert.strictEqual(manifest.convergenceRules.legalApplicabilityAutoDerivationProhibited, true));
check(() => assert.strictEqual(manifest.convergenceRules.credentialValidityAutoDerivationProhibited, true));
check(() => assert.strictEqual(manifest.convergenceRules.productionAuthorityAutoDerivationProhibited, true));

check(() => assert.strictEqual(manifest.convergedEvidenceArtifacts.length, 4));
manifest.convergedEvidenceArtifacts.forEach((relativePath) => {
  check(() => assert.strictEqual(fs.existsSync(path.join(__dirname, '..', '..', relativePath)), true));
});

check(() => assert.strictEqual(valuation.operatingMode, 'UNLICENSED_DECISION_SUPPORT'));
check(() => assert.strictEqual(valuation.standardsActivationAuthorized, false));
check(() => assert.strictEqual(valuation.professionalLegalReviewRequired, true));
check(() => assert.strictEqual(saudiPhase1.operatingMode, 'UNLICENSED_DECISION_SUPPORT'));
check(() => assert.strictEqual(saudiPhase1.regulatoryActivationAuthorized, false));
check(() => assert.strictEqual(saudiPhase1.professionalLegalReviewRequired, true));
check(() => assert.strictEqual(saudiContext.operatingMode, 'UNLICENSED_DECISION_SUPPORT'));
check(() => assert.strictEqual(saudiContext.regulatedContextActivationAuthorized, false));
check(() => assert.strictEqual(saudiContext.saudiLegalReviewComplete, false));
check(() => assert.strictEqual(phase2.operatingMode, 'UNLICENSED_DECISION_SUPPORT'));
check(() => assert.strictEqual(phase2.standardsActivationAuthorized, false));
check(() => assert.strictEqual(phase2.professionalLicensingEstablished, false));
check(() => assert.strictEqual(phase2.professionalLegalReviewRequired, true));

check(() => assert.strictEqual(Array.isArray(manifest.externalBlockers), true));
check(() => assert.strictEqual(manifest.externalBlockers.length, 8));
check(() => assert.strictEqual(manifest.externalBlockers.every((x) => x.closed === false), true));
check(() => assert.strictEqual(manifest.externalBlockers.some((x) => x.id === 'EXTERNAL_CANONICAL_SOURCE_HASH_COMPARISON'), true));
check(() => assert.strictEqual(manifest.externalBlockers.some((x) => x.id === 'HUMAN_RELEASE_AUTHORITY_APPROVAL'), true));

const authority = manifest.authorityState;
Object.entries(authority).forEach(([key, value]) => {
  check(() => assert.strictEqual(value, false, `${key} must remain false in source-evidence convergence`));
});

const allEvidence = JSON.stringify([valuation, saudiPhase1, saudiContext, phase2, manifest]);
check(() => assert.strictEqual(allEvidence.includes('"activationAuthorized":true'), false));
check(() => assert.strictEqual(allEvidence.includes('"mergeAuthorized":true'), false));
check(() => assert.strictEqual(allEvidence.includes('"deploymentAuthorized":true'), false));
check(() => assert.strictEqual(allEvidence.includes('"transactionAuthorized":true'), false));

console.log(`SOURCE_EVIDENCE_CONVERGENCE=PASS checks=${checks}`);
