'use strict';

const crypto = require('crypto');

const CAPABILITY = 'C54_PRIVATE_ALPHA_PROTECTED_ACCESS_V1';
const OWNER_POLICY_NAME = 'STARTAK Private Alpha Owner Only';

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function isValidEmail(value) {
  const email = normalizeEmail(value);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

function hashOwnerEmail(value) {
  const email = normalizeEmail(value);
  if (!isValidEmail(email)) throw new Error('C54_OWNER_EMAIL_INVALID');
  return crypto.createHash('sha256').update(email).digest('hex');
}

function ownerPolicyPayload(ownerEmail, precedence = 1) {
  const email = normalizeEmail(ownerEmail);
  if (!isValidEmail(email)) throw new Error('C54_OWNER_EMAIL_INVALID');
  return Object.freeze({
    name: OWNER_POLICY_NAME,
    decision: 'allow',
    precedence,
    include: Object.freeze([{ email: Object.freeze({ email }) }]),
  });
}

function ruleGrantsHumanAccess(rule, ownerEmail) {
  if (!rule || typeof rule !== 'object') return { allowed: false, reason: 'INVALID_RULE' };
  if (Object.prototype.hasOwnProperty.call(rule, 'everyone')) return { allowed: false, reason: 'EVERYONE_RULE_FORBIDDEN' };
  if (rule.email) {
    const email = normalizeEmail(rule.email.email);
    if (email === normalizeEmail(ownerEmail)) return { allowed: true, reason: 'OWNER_EMAIL' };
    return { allowed: false, reason: 'NON_OWNER_EMAIL_FORBIDDEN' };
  }
  return { allowed: false, reason: 'NON_OWNER_HUMAN_SELECTOR_FORBIDDEN' };
}

function evaluateObservedAccessPolicies(policies, ownerEmail) {
  if (!isValidEmail(ownerEmail)) {
    return Object.freeze({ privateAlphaProtected: false, blockers: Object.freeze(['C54_OWNER_EMAIL_INVALID']) });
  }
  if (!Array.isArray(policies)) {
    return Object.freeze({ privateAlphaProtected: false, blockers: Object.freeze(['C54_POLICIES_REQUIRED']) });
  }

  const blockers = [];
  let exactOwnerPolicyCount = 0;
  for (const policy of policies) {
    if (!policy || typeof policy !== 'object') {
      blockers.push('C54_POLICY_RECORD_INVALID');
      continue;
    }
    if (policy.decision === 'service_auth') continue;
    if (policy.decision === 'block') continue;
    if (!['allow', 'bypass'].includes(policy.decision)) {
      blockers.push(`C54_UNEXPECTED_POLICY_DECISION:${policy.decision || 'MISSING'}`);
      continue;
    }
    const include = Array.isArray(policy.include) ? policy.include : [];
    if (policy.decision === 'bypass') {
      blockers.push(`C54_BYPASS_POLICY_FORBIDDEN:${policy.id || policy.name || 'UNKNOWN'}`);
      continue;
    }
    if (include.length !== 1) {
      blockers.push(`C54_ALLOW_POLICY_MUST_HAVE_ONE_OWNER_RULE:${policy.id || policy.name || 'UNKNOWN'}`);
      continue;
    }
    const access = ruleGrantsHumanAccess(include[0], ownerEmail);
    if (!access.allowed) {
      blockers.push(`C54_ALLOW_POLICY_FORBIDDEN:${access.reason}:${policy.id || policy.name || 'UNKNOWN'}`);
      continue;
    }
    if (policy.name !== OWNER_POLICY_NAME) {
      blockers.push(`C54_OWNER_POLICY_NAME_MISMATCH:${policy.id || policy.name || 'UNKNOWN'}`);
      continue;
    }
    exactOwnerPolicyCount += 1;
  }

  if (exactOwnerPolicyCount !== 1) blockers.push(`C54_EXACT_OWNER_POLICY_COUNT:${exactOwnerPolicyCount}`);
  return Object.freeze({
    privateAlphaProtected: blockers.length === 0,
    ownerPolicyCount: exactOwnerPolicyCount,
    blockers: Object.freeze([...new Set(blockers)].sort()),
    ownerEmailSha256: hashOwnerEmail(ownerEmail),
    publicBypassAllowed: false,
    publicAccessAuthorized: false,
    commercialGoLiveAuthorized: false,
  });
}

function classifyPreMutationPolicies(policies, ownerEmail) {
  if (!Array.isArray(policies)) throw new Error('C54_POLICIES_REQUIRED');
  if (!isValidEmail(ownerEmail)) throw new Error('C54_OWNER_EMAIL_INVALID');
  const publicBypass = [];
  const ownerAllow = [];
  const serviceAuth = [];
  const block = [];
  const unexpected = [];

  for (const policy of policies) {
    if (!policy || typeof policy !== 'object') { unexpected.push(policy); continue; }
    if (policy.decision === 'service_auth') { serviceAuth.push(policy); continue; }
    if (policy.decision === 'block') { block.push(policy); continue; }
    const include = Array.isArray(policy.include) ? policy.include : [];
    const isPublicBypass = policy.decision === 'bypass' && include.some((rule) => rule && Object.prototype.hasOwnProperty.call(rule, 'everyone'));
    if (isPublicBypass) { publicBypass.push(policy); continue; }
    const isOwner = policy.decision === 'allow' && policy.name === OWNER_POLICY_NAME && include.length === 1 && ruleGrantsHumanAccess(include[0], ownerEmail).allowed;
    if (isOwner) { ownerAllow.push(policy); continue; }
    unexpected.push(policy);
  }

  const blockers = [];
  if (publicBypass.length > 1) blockers.push('C54_MULTIPLE_PUBLIC_BYPASS_POLICIES');
  if (ownerAllow.length > 1) blockers.push('C54_MULTIPLE_OWNER_POLICIES');
  if (unexpected.length) blockers.push('C54_UNEXPECTED_HUMAN_ACCESS_POLICY_PRESENT');
  if (publicBypass.length === 0 && ownerAllow.length === 0) blockers.push('C54_NO_MUTATABLE_ACCESS_POLICY_FOUND');

  return Object.freeze({
    ready: blockers.length === 0,
    mode: publicBypass.length === 1 ? 'REPLACE_PUBLIC_BYPASS' : 'VERIFY_EXISTING_OWNER_ONLY',
    publicBypassPolicyId: publicBypass[0]?.id || null,
    existingOwnerPolicyId: ownerAllow[0]?.id || null,
    serviceAuthPolicyIds: Object.freeze(serviceAuth.map((x) => x.id).filter(Boolean)),
    blockPolicyIds: Object.freeze(block.map((x) => x.id).filter(Boolean)),
    blockers: Object.freeze(blockers),
  });
}

module.exports = Object.freeze({
  CAPABILITY,
  OWNER_POLICY_NAME,
  normalizeEmail,
  isValidEmail,
  hashOwnerEmail,
  ownerPolicyPayload,
  classifyPreMutationPolicies,
  evaluateObservedAccessPolicies,
});
