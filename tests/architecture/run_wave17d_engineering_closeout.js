'use strict';

const assert=require('assert');
const crypto=require('crypto');
const security=require('../../src/security/security-qualification-envelope.js');
const trust=require('../../src/security/security-evidence-trust-gate.js');
const performance=require('../../src/qualification/performance-resilience.js');
const release=require('../../src/qualification/independent-release.js');
let checks=0;const check=(fn)=>{fn();checks+=1;};const sha=(v)=>crypto.createHash('sha256').update(String(v)).digest('hex');

[
 'createSecurityQualificationEvidence','verifySecurityQualificationEvidence','buildSecurityQualificationEnvelope','verifySecurityQualificationEnvelope'
].forEach((n)=>check(()=>assert.strictEqual(typeof security[n],'function',`${n} missing`)));
[
 'createPerformanceEvidence','verifyPerformanceEvidence','buildPerformanceResilienceQualification','verifyPerformanceResilienceQualification'
].forEach((n)=>check(()=>assert.strictEqual(typeof performance[n],'function',`${n} missing`)));
[
 'createCanonicalReleaseEvidence','verifyCanonicalReleaseEvidence','buildIndependentReleaseQualification','verifyIndependentReleaseQualification'
].forEach((n)=>check(()=>assert.strictEqual(typeof release[n],'function',`${n} missing`)));

const commit='f'.repeat(40);
const secEvidence=security.createSecurityQualificationEvidence({evidenceId:'W17D-SEC-E',controlRef:'W17D-RLS',controlClass:security.SECURITY_CONTROL_CLASS.TENANT_ISOLATION_RLS,environmentClass:security.SECURITY_EVIDENCE_ENVIRONMENT.CI_TEST,environmentRef:'CI-W17D',exactCommitSha:commit,artifactId:'SEC-ART',artifactHashSha256:sha('sec'),evidenceRef:'ci://sec',result:'PASS',observedAt:'2026-09-08T10:00:00Z',reviewedAt:'2026-09-08T10:05:00Z',reviewerRef:'SEC-R',issuerRef:'CI'});
const secQ=security.buildSecurityQualificationEnvelope({qualificationId:'W17D-SEC-Q',upstreamSecurityTrustGate:{status:trust.SECURITY_EVIDENCE_TRUST_STATUS.READY_FOR_INDEPENDENT_SECURITY_REVIEW},targetEnvironmentClass:security.SECURITY_EVIDENCE_ENVIRONMENT.CI_TEST,targetEnvironmentRef:'CI-W17D',exactCommitSha:commit,requiredControlRefs:['W17D-RLS'],evidence:[secEvidence],maximumEvidenceAgeSeconds:86400,assessedAt:'2026-09-08T10:20:00Z',preparedBy:'SEC-P',reviewedBy:'SEC-R',preparedAt:'2026-09-08T10:10:00Z',reviewedAt:'2026-09-08T10:15:00Z'});
check(()=>assert.strictEqual(secQ.status,security.SECURITY_QUALIFICATION_STATUS.READY_FOR_INDEPENDENT_SECURITY_VALIDATION));
check(()=>assert.strictEqual(security.verifySecurityQualificationEnvelope(secQ).valid,true));
check(()=>assert.strictEqual(secQ.productionSecurityValidated,false));
check(()=>assert.strictEqual(secQ.mergeAuthorized,false));
check(()=>assert.strictEqual(secQ.deploymentAuthorized,false));

const perfEvidence=performance.createPerformanceEvidence({evidenceId:'W17D-PERF-E',evidenceClass:performance.PERFORMANCE_EVIDENCE_CLASS.LATENCY,environmentRef:'CI-W17D',exactCommitSha:commit,metricName:'p95',unit:'ms',observedValue:175,thresholdValue:250,thresholdDirection:'MAX',thresholdSourceRef:'W17D-PERF-POLICY',artifactId:'PERF-ART',artifactHashSha256:sha('perf'),observedAt:'2026-09-08T10:00:00Z',reviewedAt:'2026-09-08T10:05:00Z',reviewerRef:'PERF-R'});
const perfQ=performance.buildPerformanceResilienceQualification({qualificationId:'W17D-PERF-Q',environmentRef:'CI-W17D',exactCommitSha:commit,requiredEvidenceClasses:[performance.PERFORMANCE_EVIDENCE_CLASS.LATENCY],evidence:[perfEvidence],maximumEvidenceAgeSeconds:86400,assessedAt:'2026-09-08T10:20:00Z',preparedBy:'PERF-P',reviewedBy:'PERF-R'});
check(()=>assert.strictEqual(perfQ.status,performance.PERFORMANCE_QUALIFICATION_STATUS.READY_FOR_INDEPENDENT_RELEASE_QUALIFICATION));
check(()=>assert.strictEqual(performance.verifyPerformanceResilienceQualification(perfQ).valid,true));
check(()=>assert.strictEqual(perfQ.productionCapacityEstablished,false));
check(()=>assert.strictEqual(perfQ.mergeAuthorized,false));
check(()=>assert.strictEqual(perfQ.deploymentAuthorized,false));

const rel=release.createCanonicalReleaseEvidence({evidenceId:'W17D-REL-E',exactCommitSha:commit,regressionTotal:291,regressionPassed:291,productionBuildPass:true,packageVerificationPass:true,releaseVerifyPass:true,npmAudit:{critical:0,high:0,moderate:0,low:0},workflowRunRef:'github-actions://release',artifactRef:'W17D-RELEASE-ART',artifactHashSha256:sha('release'),reviewedBy:'REL-R',reviewedAt:'2026-09-08T10:25:00Z'});
const finalQ=release.buildIndependentReleaseQualification({qualificationId:'W17D-FINAL-Q',exactCommitSha:commit,securityQualification:secQ,performanceQualification:perfQ,releaseEvidence:rel,preparedBy:'REL-P',reviewedBy:'REL-R',assessedAt:'2026-09-08T10:30:00Z'});
check(()=>assert.strictEqual(finalQ.status,release.INDEPENDENT_RELEASE_STATUS.READY_FOR_HUMAN_RELEASE_REVIEW));
check(()=>assert.strictEqual(release.verifyIndependentReleaseQualification(finalQ).valid,true));
check(()=>assert.strictEqual(finalQ.humanReleaseReviewRequired,true));
check(()=>assert.strictEqual(finalQ.releaseApproved,false));
check(()=>assert.strictEqual(finalQ.mergeAuthorized,false));
check(()=>assert.strictEqual(finalQ.deploymentAuthorized,false));
check(()=>assert.strictEqual(finalQ.productionSecurityValidated,false));
check(()=>assert.strictEqual(finalQ.productionCapacityEstablished,false));
check(()=>assert.strictEqual(finalQ.regulatoryApprovalEstablished,false));
check(()=>assert.strictEqual(finalQ.externalProfessionalApprovalEstablished,false));
check(()=>assert.strictEqual(finalQ.transactionAuthorized,false));

check(()=>assert.strictEqual(security.verifySecurityQualificationEnvelope({...secQ,reviewedBy:'tampered'}).valid,false));
check(()=>assert.strictEqual(performance.verifyPerformanceResilienceQualification({...perfQ,reviewedBy:'tampered'}).valid,false));
check(()=>assert.strictEqual(release.verifyIndependentReleaseQualification({...finalQ,reviewedBy:'tampered'}).valid,false));

console.log(`WAVE_17_ENGINEERING_CLOSEOUT=PASS checks=${checks}`);
