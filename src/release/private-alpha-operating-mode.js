'use strict';

const OPERATING_MODE = Object.freeze({
  PRIVATE_ALPHA: 'PRIVATE_ALPHA',
  CONTROLLED_PILOT: 'CONTROLLED_PILOT',
  COMMERCIAL_PRODUCTION: 'COMMERCIAL_PRODUCTION',
});

const PRIVATE_ALPHA_DECISION = Object.freeze({
  ALLOW_PRIVATE_ALPHA: 'ALLOW_PRIVATE_ALPHA',
  HOLD: 'HOLD',
  NO_GO: 'NO_GO',
});

const EXTERNAL_C30_GATES = Object.freeze([
  'SECURITY_REVIEW_AUTHORIZATION',
  'PRIVACY_REVIEW_AUTHORIZATION',
  'AI_PROVIDER_PRODUCTION_AUTHORIZATION',
  'SOURCE_RIGHTS_AUTHORIZATION',
  'UAT_HUMAN_APPROVAL',
  'HISTORICAL_REPLAY_EVIDENCE',
  'ROLLBACK_OPERATIONAL_VERIFICATION',
  'LEGAL_REGULATORY_APPROVAL',
]);

const DEFAULT_PRIVATE_ALPHA_CONTROLS = Object.freeze({
  ownerOnly: true,
  publicAccess: false,
  commercialUse: false,
  transactionExecution: false,
  approvalAuthority: false,
  certifiedValuationClaim: false,
  publicAi: false,
  credentialBypass: false,
  captchaBypass: false,
  accessControlEvasion: false,
  rateLimitEvasion: false,
});

function unique(values) {
  return [...new Set(values)];
}

function controlViolations(controls = {}) {
  const merged = { ...DEFAULT_PRIVATE_ALPHA_CONTROLS, ...controls };
  const violations = [];
  if (merged.ownerOnly !== true) violations.push('PRIVATE_ALPHA_OWNER_ONLY_REQUIRED');
  if (merged.publicAccess === true) violations.push('PRIVATE_ALPHA_PUBLIC_ACCESS_FORBIDDEN');
  if (merged.commercialUse === true) violations.push('PRIVATE_ALPHA_COMMERCIAL_USE_FORBIDDEN');
  if (merged.transactionExecution === true) violations.push('PRIVATE_ALPHA_TRANSACTION_EXECUTION_FORBIDDEN');
  if (merged.approvalAuthority === true) violations.push('PRIVATE_ALPHA_APPROVAL_AUTHORITY_FORBIDDEN');
  if (merged.certifiedValuationClaim === true) violations.push('PRIVATE_ALPHA_CERTIFIED_VALUATION_CLAIM_FORBIDDEN');
  if (merged.publicAi === true) violations.push('PRIVATE_ALPHA_PUBLIC_AI_FORBIDDEN');
  if (merged.credentialBypass === true) violations.push('PRIVATE_ALPHA_CREDENTIAL_BYPASS_FORBIDDEN');
  if (merged.captchaBypass === true) violations.push('PRIVATE_ALPHA_CAPTCHA_BYPASS_FORBIDDEN');
  if (merged.accessControlEvasion === true) violations.push('PRIVATE_ALPHA_ACCESS_CONTROL_EVASION_FORBIDDEN');
  if (merged.rateLimitEvasion === true) violations.push('PRIVATE_ALPHA_RATE_LIMIT_EVASION_FORBIDDEN');
  return { controls: Object.freeze(merged), violations: Object.freeze(violations) };
}

function evaluatePrivateAlphaOperatingMode({ operatingMode, c30Pack, controls } = {}) {
  if (!Object.values(OPERATING_MODE).includes(operatingMode)) {
    return Object.freeze({
      operatingMode: operatingMode || null,
      decision: PRIVATE_ALPHA_DECISION.HOLD,
      privateAlphaDeployAuthorized: false,
      commercialProductionAuthorized: false,
      blockers: Object.freeze(['OPERATING_MODE_INVALID']),
      advisoryExternalGates: Object.freeze([]),
    });
  }

  if (!c30Pack || typeof c30Pack !== 'object' || !Array.isArray(c30Pack.blockerRegister)) {
    return Object.freeze({
      operatingMode,
      decision: PRIVATE_ALPHA_DECISION.HOLD,
      privateAlphaDeployAuthorized: false,
      commercialProductionAuthorized: false,
      blockers: Object.freeze(['C30_PACK_REQUIRED']),
      advisoryExternalGates: Object.freeze([]),
    });
  }

  const { controls: normalizedControls, violations } = controlViolations(controls);
  const blockers = [];
  const advisoryExternalGates = [];

  for (const blocker of c30Pack.blockerRegister) {
    if (!blocker || typeof blocker !== 'object') {
      blockers.push('C30_BLOCKER_RECORD_INVALID');
      continue;
    }
    if (blocker.decisionEffect === 'NO_GO') {
      blockers.push(`C30_NO_GO:${blocker.source || 'UNKNOWN'}:${blocker.id || 'UNKNOWN'}`);
      continue;
    }
    const externalHold = blocker.source === 'EXTERNAL' && EXTERNAL_C30_GATES.includes(blocker.id);
    if (externalHold) advisoryExternalGates.push(blocker.id);
    else blockers.push(`C30_NON_EXTERNAL_HOLD:${blocker.source || 'UNKNOWN'}:${blocker.id || 'UNKNOWN'}`);
  }

  if (operatingMode !== OPERATING_MODE.PRIVATE_ALPHA) {
    if (c30Pack.decision !== 'GO') blockers.push('C30_GO_REQUIRED_OUTSIDE_PRIVATE_ALPHA');
    if (violations.length) blockers.push(...violations);
    return Object.freeze({
      operatingMode,
      decision: blockers.some((x) => x.startsWith('C30_NO_GO:')) ? PRIVATE_ALPHA_DECISION.NO_GO : PRIVATE_ALPHA_DECISION.HOLD,
      privateAlphaDeployAuthorized: false,
      commercialProductionAuthorized: false,
      blockers: Object.freeze(unique(blockers).sort()),
      advisoryExternalGates: Object.freeze(unique(advisoryExternalGates).sort()),
      c30DecisionPreserved: c30Pack.decision || null,
      controls: normalizedControls,
    });
  }

  blockers.push(...violations);
  const noGo = blockers.some((x) => x.startsWith('C30_NO_GO:'));
  const authorized = !noGo && blockers.length === 0;

  return Object.freeze({
    operatingMode,
    decision: noGo
      ? PRIVATE_ALPHA_DECISION.NO_GO
      : authorized
        ? PRIVATE_ALPHA_DECISION.ALLOW_PRIVATE_ALPHA
        : PRIVATE_ALPHA_DECISION.HOLD,
    privateAlphaDeployAuthorized: authorized,
    privateAlphaMergeAuthorized: authorized,
    privateAlphaTestingAuthorized: authorized,
    commercialProductionAuthorized: false,
    publicDeploymentAuthorized: false,
    transactionAuthorized: false,
    approvalAuthorized: false,
    certifiedValuationEstablished: false,
    externalEvidenceRequiredForPrivateAlpha: false,
    externalEvidenceRequiredForCommercialProduction: true,
    blockers: Object.freeze(unique(blockers).sort()),
    advisoryExternalGates: Object.freeze(unique(advisoryExternalGates).sort()),
    c30DecisionPreserved: c30Pack.decision || null,
    controls: normalizedControls,
  });
}

module.exports = Object.freeze({
  OPERATING_MODE,
  PRIVATE_ALPHA_DECISION,
  EXTERNAL_C30_GATES,
  DEFAULT_PRIVATE_ALPHA_CONTROLS,
  evaluatePrivateAlphaOperatingMode,
});
