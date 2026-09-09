'use strict';

const assert = require('assert');
const crypto = require('crypto');
const {
  JWT_VERIFICATION_STATUS,
  verifyOidcJwt,
} = require('../../src/security/oidc-jwt-verifier');
const {
  createRemoteJwksProvider,
} = require('../../src/security/remote-jwks-provider');
const {
  AUTHENTICATION_STATUS,
  extractBearerToken,
  createOidcBearerAuthenticator,
} = require('../../src/security/oidc-bearer-authenticator');
const {
  requireVerifiedIdentityContext,
} = require('../../src/security/verified-identity-context');

const NOW = 1_800_000_000;
const ISSUER = 'https://issuer.example/';
const AUDIENCE = 'startak-real-estate-api';
const TENANT = 'tenant-a';
const KID = 'test-rsa-key-1';

const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const publicJwk = publicKey.export({ format: 'jwk' });
const trustedJwk = Object.freeze({ ...publicJwk, kid: KID, alg: 'RS256', use: 'sig' });
const jwks = Object.freeze({ keys: Object.freeze([trustedJwk]) });

function b64urlJson(value) {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}

function signJwt(claimOverrides = {}, headerOverrides = {}) {
  const header = { alg: 'RS256', typ: 'JWT', kid: KID, ...headerOverrides };
  const claims = {
    iss: ISSUER,
    aud: AUDIENCE,
    sub: 'actor-123',
    tenant_id: TENANT,
    roles: ['ANALYST'],
    iat: NOW - 30,
    nbf: NOW - 30,
    exp: NOW + 300,
    ...claimOverrides,
  };
  const signingInput = `${b64urlJson(header)}.${b64urlJson(claims)}`;
  const signature = crypto.sign('RSA-SHA256', Buffer.from(signingInput, 'ascii'), privateKey).toString('base64url');
  return `${signingInput}.${signature}`;
}

function verify(token, overrides = {}) {
  return verifyOidcJwt({
    token,
    issuer: ISSUER,
    audience: AUDIENCE,
    jwks,
    requiredTenantId: TENANT,
    nowEpochSeconds: NOW,
    clockToleranceSeconds: 0,
    maxTokenAgeSeconds: 600,
    ...overrides,
  });
}

(async () => {
  let checks = 0;
  function check(fn) { fn(); checks++; }
  async function checkAsync(fn) { await fn(); checks++; }

  const validToken = signJwt();
  const valid = verify(validToken);
  check(() => assert.strictEqual(valid.status, JWT_VERIFICATION_STATUS.VERIFIED_JWT));
  check(() => assert.strictEqual(valid.authorizationReady, true));
  check(() => assert.strictEqual(valid.cryptographicVerificationPerformedHere, true));
  check(() => assert.strictEqual(valid.productionAuthenticationValidated, false));
  check(() => assert.strictEqual(valid.transactionAuthorized, false));
  check(() => assert.strictEqual(valid.tokenMetadata.keyId, KID));
  check(() => assert.strictEqual(valid.tokenMetadata.algorithm, 'RS256'));
  check(() => assert.ok(/^sha256:[0-9a-f]{64}$/.test(valid.tokenMetadata.tokenDigest)));

  const identity = requireVerifiedIdentityContext(valid.identityContext);
  check(() => assert.strictEqual(identity.actorId, 'actor-123'));
  check(() => assert.strictEqual(identity.subject, 'actor-123'));
  check(() => assert.strictEqual(identity.tenantId, TENANT));
  check(() => assert.deepStrictEqual(identity.roles, ['ANALYST']));

  const parts = validToken.split('.');
  const signatureBytes = Buffer.from(parts[2], 'base64url');
  signatureBytes[0] ^= 0x01;
  const tampered = `${parts[0]}.${parts[1]}.${signatureBytes.toString('base64url')}`;
  check(() => assert.strictEqual(verify(tampered).status, JWT_VERIFICATION_STATUS.HOLD_SIGNATURE));

  const noneHeader = b64urlJson({ alg: 'none', kid: KID });
  const nonePayload = b64urlJson({ iss: ISSUER, aud: AUDIENCE, sub: 'actor-123', tenant_id: TENANT, roles: ['ANALYST'], exp: NOW + 300 });
  check(() => assert.strictEqual(verify(`${noneHeader}.${nonePayload}.x`).status, JWT_VERIFICATION_STATUS.HOLD_ALGORITHM));

  check(() => assert.strictEqual(verify(signJwt({}, { kid: 'unknown' })).status, JWT_VERIFICATION_STATUS.HOLD_SIGNING_KEY));
  check(() => assert.strictEqual(verify(signJwt({ iss: 'https://attacker.example/' })).status, JWT_VERIFICATION_STATUS.HOLD_ISSUER));
  check(() => assert.strictEqual(verify(signJwt({ aud: 'different-api' })).status, JWT_VERIFICATION_STATUS.HOLD_AUDIENCE));
  check(() => assert.strictEqual(verify(signJwt({ aud: [AUDIENCE, 'other-api'] })).status, JWT_VERIFICATION_STATUS.HOLD_AUTHORIZED_PARTY));
  check(() => assert.strictEqual(verify(signJwt({ aud: [AUDIENCE, 'other-api'], azp: AUDIENCE })).status, JWT_VERIFICATION_STATUS.VERIFIED_JWT));
  check(() => assert.strictEqual(verify(signJwt({ exp: NOW })).status, JWT_VERIFICATION_STATUS.HOLD_EXPIRY));
  check(() => assert.strictEqual(verify(signJwt({ nbf: NOW + 1 })).status, JWT_VERIFICATION_STATUS.HOLD_NOT_BEFORE));
  check(() => assert.strictEqual(verify(signJwt({ iat: NOW + 1 })).status, JWT_VERIFICATION_STATUS.HOLD_ISSUED_AT));
  check(() => assert.strictEqual(verify(signJwt({ iat: NOW - 1000 })).status, JWT_VERIFICATION_STATUS.HOLD_MAX_TOKEN_AGE));
  check(() => assert.strictEqual(verify(signJwt({ tenant_id: 'tenant-b' })).status, JWT_VERIFICATION_STATUS.HOLD_IDENTITY_CONTEXT));
  check(() => assert.strictEqual(verify(signJwt({ roles: [] })).status, JWT_VERIFICATION_STATUS.HOLD_IDENTITY_CONTEXT));

  check(() => assert.throws(() => verifyOidcJwt({
    token: validToken,
    issuer: ISSUER,
    audience: AUDIENCE,
    jwks,
    allowedAlgorithms: ['HS256'],
  }), /unsupported JWT algorithm/));

  const duplicateJwks = { keys: [trustedJwk, { ...trustedJwk }] };
  check(() => assert.strictEqual(verify(validToken, { jwks: duplicateJwks }).status, JWT_VERIFICATION_STATUS.HOLD_SIGNING_KEY));

  check(() => assert.strictEqual(extractBearerToken(`Bearer ${validToken}`), validToken));
  check(() => assert.strictEqual(extractBearerToken(`Basic ${validToken}`), null));
  check(() => assert.strictEqual(extractBearerToken('Bearer token with spaces'), null));

  let fetchCalls = 0;
  let clock = 10_000;
  const fakeFetch = async (url, options) => {
    fetchCalls++;
    assert.strictEqual(url, 'https://issuer.example/.well-known/jwks.json');
    assert.strictEqual(options.redirect, 'error');
    assert.strictEqual(options.method, 'GET');
    return {
      ok: true,
      status: 200,
      headers: { get: (name) => name.toLowerCase() === 'content-type' ? 'application/json; charset=utf-8' : null },
      text: async () => JSON.stringify(jwks),
    };
  };

  const provider = createRemoteJwksProvider({
    issuer: ISSUER,
    jwksUri: 'https://issuer.example/.well-known/jwks.json',
    fetchImpl: fakeFetch,
    cacheTtlMs: 5_000,
    nowMs: () => clock,
  });
  check(() => assert.strictEqual(provider.capabilities.redirectsAllowed, false));
  check(() => assert.strictEqual(provider.capabilities.productionJwksTrustValidated, false));

  await checkAsync(async () => {
    const first = await provider.getJwks();
    const second = await provider.getJwks();
    assert.strictEqual(first, second);
    assert.strictEqual(fetchCalls, 1);
  });

  clock += 5_001;
  await checkAsync(async () => {
    await provider.getJwks();
    assert.strictEqual(fetchCalls, 2);
  });

  const authenticator = createOidcBearerAuthenticator({
    issuer: ISSUER,
    audience: AUDIENCE,
    jwksProvider: provider,
    clockToleranceSeconds: 0,
    maxTokenAgeSeconds: 600,
  });

  await checkAsync(async () => {
    const result = await authenticator.authenticate({
      authorizationHeader: `Bearer ${validToken}`,
      requiredTenantId: TENANT,
      nowEpochSeconds: NOW,
    });
    assert.strictEqual(result.status, AUTHENTICATION_STATUS.AUTHENTICATED);
    assert.strictEqual(result.authorizationReady, true);
    assert.strictEqual(result.cryptographicVerificationPerformedHere, true);
    assert.strictEqual(result.productionAuthenticationValidated, false);
    assert.strictEqual(requireVerifiedIdentityContext(result.identityContext).tenantId, TENANT);
  });

  await checkAsync(async () => {
    const result = await authenticator.authenticate({ authorizationHeader: 'Basic no', requiredTenantId: TENANT, nowEpochSeconds: NOW });
    assert.strictEqual(result.status, AUTHENTICATION_STATUS.HOLD_AUTHORIZATION_HEADER);
    assert.strictEqual(result.authorizationReady, false);
  });

  await checkAsync(async () => {
    const result = await authenticator.authenticate({ authorizationHeader: `Bearer ${signJwt({ tenant_id: 'tenant-b' })}`, requiredTenantId: TENANT, nowEpochSeconds: NOW });
    assert.strictEqual(result.status, AUTHENTICATION_STATUS.HOLD_TOKEN_VERIFICATION);
    assert.strictEqual(result.authorizationReady, false);
  });

  check(() => assert.throws(() => createRemoteJwksProvider({
    issuer: ISSUER,
    jwksUri: 'http://issuer.example/jwks',
    fetchImpl: fakeFetch,
  }), /must use https/));

  check(() => assert.throws(() => createRemoteJwksProvider({
    issuer: 'https://user:pass@issuer.example/',
    jwksUri: 'https://issuer.example/jwks',
    fetchImpl: fakeFetch,
  }), /must not contain credentials/));

  const privateJwk = privateKey.export({ format: 'jwk' });
  const badProvider = createRemoteJwksProvider({
    issuer: ISSUER,
    jwksUri: 'https://issuer.example/private-jwks',
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      text: async () => JSON.stringify({ keys: [{ ...privateJwk, kid: 'private', alg: 'RS256' }] }),
    }),
  });
  await checkAsync(async () => {
    await assert.rejects(() => badProvider.getJwks(), /JWKS_PRIVATE_KEY_MATERIAL_REJECTED/);
  });

  console.log(`OIDC_JWT_JWKS_AUTHENTICATION_V1: PASS (${checks} checks)`);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
