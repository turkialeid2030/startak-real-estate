'use strict';
// Explicit SAR amounts only. Reject sub-halalas and non-round-trippable values.
function toHalalas(v) {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) return null;
  const n = Math.round(v * 100);
  return Number.isSafeInteger(n) && n / 100 === v ? n : null;
}
function fromHalalas(n) {
  if (!Number.isSafeInteger(n)) return null;
  const v = n / 100;
  return toHalalas(Math.abs(v)) === Math.abs(n) ? v : null;
}
function sumHalalas(values) {
  let total = 0;
  for (const n of values) {
    if (!Number.isSafeInteger(n) || n < 0 || !Number.isSafeInteger(total + n)) return null;
    total += n;
  }
  return total;
}
module.exports = { toHalalas, fromHalalas, sumHalalas };
