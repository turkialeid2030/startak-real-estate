'use strict';

// Browser-only compatibility surface for the narrow Node `crypto.createHash`
// usage that exists in deterministic governance modules bundled by Vite.
//
// This module deliberately implements SHA-256 only. It does not expose random,
// signing, encryption, key-management or authority-bearing operations. Node
// test/runtime code continues to use the native `crypto` module; Vite aliases
// `crypto`/`node:crypto` to this file only for browser builds.

const K = Object.freeze([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5,
  0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
  0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
  0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3,
  0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5,
  0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

function rotr(value, bits) {
  return (value >>> bits) | (value << (32 - bits));
}

function utf8Bytes(value) {
  const text = typeof value === 'string' ? value : String(value);
  if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(text);

  // Standards-compatible fallback for runtimes without TextEncoder. This path
  // is not expected in supported browsers/Node 24, but keeps the shim explicit.
  const encoded = unescape(encodeURIComponent(text)); // eslint-disable-line no-undef
  const out = new Uint8Array(encoded.length);
  for (let i = 0; i < encoded.length; i += 1) out[i] = encoded.charCodeAt(i);
  return out;
}

function toBytes(value) {
  if (typeof value === 'string') return utf8Bytes(value);
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  return utf8Bytes(value);
}

function concatBytes(chunks) {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

function sha256Bytes(message) {
  const length = message.length;
  const bitLengthHi = Math.floor((length * 8) / 0x100000000);
  const bitLengthLo = (length * 8) >>> 0;
  const paddedLength = (((length + 9 + 63) >> 6) << 6);
  const bytes = new Uint8Array(paddedLength);
  bytes.set(message);
  bytes[length] = 0x80;
  const view = new DataView(bytes.buffer);
  view.setUint32(paddedLength - 8, bitLengthHi >>> 0, false);
  view.setUint32(paddedLength - 4, bitLengthLo, false);

  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;
  const w = new Uint32Array(64);

  for (let offset = 0; offset < paddedLength; offset += 64) {
    for (let i = 0; i < 16; i += 1) w[i] = view.getUint32(offset + (i * 4), false);
    for (let i = 16; i < 64; i += 1) {
      const s0 = (rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3)) >>> 0;
      const s1 = (rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10)) >>> 0;
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }

    let a = h0; let b = h1; let c = h2; let d = h3;
    let e = h4; let f = h5; let g = h6; let h = h7;

    for (let i = 0; i < 64; i += 1) {
      const S1 = (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) >>> 0;
      const ch = ((e & f) ^ ((~e) & g)) >>> 0;
      const temp1 = (h + S1 + ch + K[i] + w[i]) >>> 0;
      const S0 = (rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) >>> 0;
      const maj = ((a & b) ^ (a & c) ^ (b & c)) >>> 0;
      const temp2 = (S0 + maj) >>> 0;

      h = g; g = f; f = e; e = (d + temp1) >>> 0;
      d = c; c = b; b = a; a = (temp1 + temp2) >>> 0;
    }

    h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0; h5 = (h5 + f) >>> 0;
    h6 = (h6 + g) >>> 0; h7 = (h7 + h) >>> 0;
  }

  const out = new Uint8Array(32);
  const outView = new DataView(out.buffer);
  [h0, h1, h2, h3, h4, h5, h6, h7].forEach((word, index) => outView.setUint32(index * 4, word, false));
  return out;
}

function bytesToHex(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function createHash(algorithm) {
  if (String(algorithm).toLowerCase().replace(/-/g, '') !== 'sha256') {
    throw new Error('STARTAK_BROWSER_CRYPTO_ONLY_SHA256_SUPPORTED');
  }
  const chunks = [];
  let finalized = false;
  return Object.freeze({
    update(value) {
      if (finalized) throw new Error('STARTAK_BROWSER_CRYPTO_HASH_FINALIZED');
      chunks.push(toBytes(value));
      return this;
    },
    digest(encoding) {
      if (finalized) throw new Error('STARTAK_BROWSER_CRYPTO_HASH_FINALIZED');
      finalized = true;
      const digest = sha256Bytes(concatBytes(chunks));
      if (encoding === 'hex') return bytesToHex(digest);
      if (encoding === undefined || encoding === null) return digest;
      throw new Error(`STARTAK_BROWSER_CRYPTO_ENCODING_UNSUPPORTED:${encoding}`);
    },
  });
}

module.exports = Object.freeze({ createHash });
