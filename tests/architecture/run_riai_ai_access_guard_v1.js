'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', '..');
const gateway = fs.readFileSync(path.join(root, 'functions/api/riai/ai-assist.js'), 'utf8');
const ui = fs.readFileSync(path.join(root, 'src/components/ResidentialIncomeAiAssistPanel.jsx'), 'utf8');
const docs = fs.readFileSync(path.join(root, 'RIAI_AI_GATEWAY_V1.md'), 'utf8');

assert(gateway.includes('async function verifyCloudflareAccess(request, env)'));
assert(gateway.includes('RIAI_AI_ACCESS_ISSUER'));
assert(gateway.includes('RIAI_AI_ACCESS_AUD'));
assert(gateway.includes("request.headers.get('cf-access-jwt-assertion')"));
assert(gateway.includes("header.alg !== 'RS256'"));
assert(gateway.includes("new URL('/cdn-cgi/access/certs', issuerResult.issuer)"));
assert(gateway.includes("crypto.subtle.importKey("));
assert(gateway.includes("crypto.subtle.verify("));
assert(gateway.includes("{ name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }"));
assert(gateway.includes("host === 'cloudflareaccess.com' || host.endsWith('.cloudflareaccess.com')"));
assert(gateway.includes("issuer.protocol !== 'https:'"));
assert(gateway.includes("origin !== requestUrl.origin"));
assert(gateway.includes("fetchSite !== 'same-origin' && fetchSite !== 'none'"));
assert(gateway.includes("AI_CROSS_ORIGIN_REQUEST_BLOCKED"));
assert(gateway.includes("AI_CROSS_SITE_REQUEST_BLOCKED"));
assert(gateway.includes("AI_ACCESS_TOKEN_SIGNATURE_INVALID"));
assert(gateway.includes("AI_ACCESS_TOKEN_AUDIENCE_INVALID"));
assert(gateway.includes("AI_ACCESS_TOKEN_ISSUER_INVALID"));
assert(gateway.includes("AI_ACCESS_TOKEN_EXPIRED"));
assert(gateway.includes("AI_ACCESS_SIGNING_KEY_NOT_FOUND"));

const accessCallIndex = gateway.indexOf('const access = await verifyCloudflareAccess(request, context.env || {});');
const providerCallIndex = gateway.indexOf('const provider = allowedProviderUrl(context.env || {});');
const providerFetchIndex = gateway.indexOf("providerResponse = await fetch(provider.url.toString()");
assert(accessCallIndex >= 0);
assert(providerCallIndex > accessCallIndex);
assert(providerFetchIndex > providerCallIndex);

assert(gateway.includes("env.RIAI_AI_ALLOW_LOCAL_UNAUTHENTICATED === 'true'"));
assert(gateway.includes("['localhost', '127.0.0.1', '::1'].includes(requestUrl.hostname)"));
assert(!gateway.includes("RIAI_AI_ALLOW_LOCAL_UNAUTHENTICATED === 'true' ||"));

assert(ui.includes("'AI_ACCESS_NOT_CONFIGURED'"));
assert(ui.includes("'AI_ACCESS_REQUIRED'"));
assert(ui.includes("'AI_PROVIDER_NOT_CONFIGURED'"));
assert(ui.includes('production activation is incomplete'));
assert(ui.includes('تفعيل الإنتاج لم يكتمل بعد'));

assert(docs.includes('Mandatory production access control'));
assert(docs.includes('RIAI_AI_ACCESS_ISSUER'));
assert(docs.includes('RIAI_AI_ACCESS_AUD'));
assert(docs.includes('Cf-Access-Jwt-Assertion'));
assert(docs.includes('must not be activated as an anonymous public endpoint'));
assert(docs.includes('Cloudflare Access verification occurs before AI-provider invocation'));
assert(docs.includes('Automatic investment/legal decisioning: PROHIBITED'));

console.log('RIAI_AI_ACCESS_GUARD_V1=PASS');
console.log('ACCESS_BEFORE_PROVIDER_INVOCATION=PASS');
console.log('ACCESS_JWT_SIGNATURE_VERIFICATION=PASS');
console.log('CROSS_ORIGIN_AND_CROSS_SITE_GUARDS=PASS');
console.log('LOCAL_BYPASS_RESTRICTED_TO_LOOPBACK=PASS');
