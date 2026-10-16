const assert = require('node:assert/strict');
(async () => {
const { readBoundedText } = await import('../../functions/api/riai/_bounded-body.mjs');

const options = { maxBytes: 8, timeoutMs: 100 };
assert.equal(await readBoundedText(new Response('مرح'), options), 'مرح');
assert.equal(await readBoundedText(new Response(null), options), '');
await assert.rejects(readBoundedText(new Response('123456789'), options), { code: 'BODY_TOO_LARGE' });
const bytes = new TextEncoder().encode('مرح');
assert.equal(await readBoundedText(new Response(new ReadableStream({ start(c) { for (const byte of bytes) c.enqueue(Uint8Array.of(byte)); c.close(); } })), options), 'مرح');
await assert.rejects(readBoundedText(new Response(Uint8Array.of(255)), options), TypeError);
let cancelled = false;
const stalled = new Response(new ReadableStream({ cancel() { cancelled = true; return new Promise(() => {}); } }));
await assert.rejects(readBoundedText(stalled, { ...options, timeoutMs: 10 }), { code: 'BODY_READ_TIMEOUT' });
assert.equal(cancelled, true);
const controller = new AbortController();
controller.abort();
await assert.rejects(readBoundedText(new Response('abc'), { ...options, signal: controller.signal }), { code: 'BODY_READ_ABORTED' });
await assert.rejects(readBoundedText(new Response('a'), { maxBytes: 0, timeoutMs: 1 }), /INVALID_READ_LIMIT/);
console.log('RIAI_BOUNDED_BODY=PASS');
})().catch(error => { console.error(error); process.exitCode = 1; });
