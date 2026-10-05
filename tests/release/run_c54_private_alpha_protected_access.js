'use strict';

const assert = require('assert');
const {
  CAPABILITY,
  OWNER_POLICY_NAME,
  isValidEmail,
  hashOwnerEmail,
  ownerPolicyPayload,
  classifyPreMutationPolicies,
  evaluateObservedAccessPolicies,
} = require('../../src/release/private-alpha-protected-access');

let checks = 0;
function ok(value, message) { assert.ok(value, message); checks += 1; }
function eq(actual, expected, message) { assert.strictEqual(actual, expected, message); checks += 1; }

const OWNER = 'owner@example.com';
eq(CAPABILITY, 'C54_PRIVATE_ALPHA_PROTECTED_ACCESS_V1', 'capability expected');
eq(isValidEmail(OWNER), true, 'valid email expected');
eq(isValidEmail('not-an-email'), false, 'invalid email rejected');
eq(hashOwnerEmail(OWNER).length, 64, 'owner identity should be represented by hash in evidence');

const payload = ownerPolicyPayload(OWNER);
eq(payload.name, OWNER_POLICY_NAME, 'owner policy name expected');
eq(payload.decision, 'allow', 'owner policy must allow only authenticated owner');
eq(payload.include.length, 1, 'one selector expected');
eq(payload.include[0].email.email, OWNER, 'exact owner email selector expected');
eq(payload.precedence, 1, 'owner policy precedence expected');

const prePublic = classifyPreMutationPolicies([
  { id: 'public', name: 'STARTAK Public Website - No Login', decision: 'bypass', include: [{ everyone: {} }] },
  { id: 'svc', name: 'backend', decision: 'service_auth', include: [{ service_token: { token_id: 'x' } }] },
], OWNER);
eq(prePublic.ready, true, 'single known public bypass may be converted');
eq(prePublic.mode, 'REPLACE_PUBLIC_BYPASS', 'public bypass replacement expected');
eq(prePublic.publicBypassPolicyId, 'public', 'public policy id expected');
eq(prePublic.serviceAuthPolicyIds[0], 'svc', 'service auth may be preserved');

const preOwner = classifyPreMutationPolicies([
  { id: 'owner', name: OWNER_POLICY_NAME, decision: 'allow', include: [{ email: { email: OWNER } }] },
], OWNER);
eq(preOwner.ready, true, 'existing exact owner policy should verify');
eq(preOwner.mode, 'VERIFY_EXISTING_OWNER_ONLY', 'existing owner mode expected');

const unexpected = classifyPreMutationPolicies([
  { id: 'public', decision: 'bypass', include: [{ everyone: {} }] },
  { id: 'other', name: 'Other user', decision: 'allow', include: [{ email: { email: 'other@example.com' } }] },
], OWNER);
eq(unexpected.ready, false, 'unexpected human policy must block before mutation');
ok(unexpected.blockers.includes('C54_UNEXPECTED_HUMAN_ACCESS_POLICY_PRESENT'), 'unexpected policy blocker expected');

const multiplePublic = classifyPreMutationPolicies([
  { id: 'p1', decision: 'bypass', include: [{ everyone: {} }] },
  { id: 'p2', decision: 'bypass', include: [{ everyone: {} }] },
], OWNER);
eq(multiplePublic.ready, false, 'multiple public bypasses must fail closed');
ok(multiplePublic.blockers.includes('C54_MULTIPLE_PUBLIC_BYPASS_POLICIES'), 'multiple bypass blocker expected');

const protectedState = evaluateObservedAccessPolicies([
  { id: 'owner', name: OWNER_POLICY_NAME, decision: 'allow', include: [{ email: { email: OWNER } }] },
  { id: 'svc', name: 'service', decision: 'service_auth', include: [{ service_token: { token_id: 'x' } }] },
  { id: 'block', name: 'block', decision: 'block', include: [{ everyone: {} }] },
], OWNER);
eq(protectedState.privateAlphaProtected, true, 'owner-only state should pass');
eq(protectedState.ownerPolicyCount, 1, 'exactly one owner policy expected');
eq(protectedState.publicBypassAllowed, false, 'public bypass must never be authorized');
eq(protectedState.publicAccessAuthorized, false, 'public access authority remains false');
eq(protectedState.commercialGoLiveAuthorized, false, 'commercial go-live remains false');

const publicState = evaluateObservedAccessPolicies([
  { id: 'public', name: 'public', decision: 'bypass', include: [{ everyone: {} }] },
  { id: 'owner', name: OWNER_POLICY_NAME, decision: 'allow', include: [{ email: { email: OWNER } }] },
], OWNER);
eq(publicState.privateAlphaProtected, false, 'remaining bypass must block');
ok(publicState.blockers.some((x) => x.startsWith('C54_BYPASS_POLICY_FORBIDDEN:')), 'bypass blocker expected');

const domainState = evaluateObservedAccessPolicies([
  { id: 'domain', name: OWNER_POLICY_NAME, decision: 'allow', include: [{ email_domain: { domain: 'example.com' } }] },
], OWNER);
eq(domainState.privateAlphaProtected, false, 'email-domain access is too broad for owner-only alpha');
ok(domainState.blockers.some((x) => x.includes('NON_OWNER_HUMAN_SELECTOR_FORBIDDEN')), 'broad selector blocker expected');

const otherEmailState = evaluateObservedAccessPolicies([
  { id: 'other', name: OWNER_POLICY_NAME, decision: 'allow', include: [{ email: { email: 'other@example.com' } }] },
], OWNER);
eq(otherEmailState.privateAlphaProtected, false, 'non-owner email must block');
ok(otherEmailState.blockers.some((x) => x.includes('NON_OWNER_EMAIL_FORBIDDEN')), 'non-owner email blocker expected');

const duplicateOwner = evaluateObservedAccessPolicies([
  { id: 'a', name: OWNER_POLICY_NAME, decision: 'allow', include: [{ email: { email: OWNER } }] },
  { id: 'b', name: OWNER_POLICY_NAME, decision: 'allow', include: [{ email: { email: OWNER } }] },
], OWNER);
eq(duplicateOwner.privateAlphaProtected, false, 'duplicate owner policies must block exact posture');
ok(duplicateOwner.blockers.includes('C54_EXACT_OWNER_POLICY_COUNT:2'), 'duplicate owner count blocker expected');

console.log(`C54_PRIVATE_ALPHA_PROTECTED_ACCESS_CHECKS=${checks}`);
console.log('C54_PRIVATE_ALPHA_PROTECTED_ACCESS_RESULT=PASS');
