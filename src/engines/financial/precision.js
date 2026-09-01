'use strict';

// Financial Precision Remediation C1.
// Monetary arithmetic is performed in integer halalas (2 decimal places) and
// rate arithmetic in fixed 12-decimal units. This removes binary floating-point
// accumulation from core NPV and debt cash-flow mechanics without adding a
// third-party runtime dependency.
//
// Boundary: public engine inputs/outputs remain JavaScript Numbers for existing
// API/UI compatibility. Conversion to Number happens only at module boundaries;
// internal money/rate arithmetic in this module uses BigInt fixed-point values.

const MONEY_DIGITS = 2;
const MONEY_SCALE = 100n;
const RATE_DIGITS = 12;
const RATE_SCALE = 1000000000000n;
const IRR_NPV_DIGITS = 10;

function pow10(n) {
  return 10n ** BigInt(n);
}

function expandExponentialString(value) {
  const raw = String(value).trim().toLowerCase();
  if (!raw.includes('e')) return raw;
  const [mantissaRaw, exponentRaw] = raw.split('e');
  const exponent = Number(exponentRaw);
  if (!Number.isInteger(exponent)) throw new TypeError('invalid exponential decimal');
  const sign = mantissaRaw.startsWith('-') ? '-' : '';
  const mantissa = mantissaRaw.replace(/^[-+]/, '');
  const [whole, fraction = ''] = mantissa.split('.');
  const digits = `${whole}${fraction}` || '0';
  const decimalIndex = whole.length + exponent;
  if (decimalIndex <= 0) return `${sign}0.${'0'.repeat(-decimalIndex)}${digits}`;
  if (decimalIndex >= digits.length) return `${sign}${digits}${'0'.repeat(decimalIndex - digits.length)}`;
  return `${sign}${digits.slice(0, decimalIndex)}.${digits.slice(decimalIndex)}`;
}

function decimalToScaled(value, digits) {
  if (typeof value === 'bigint') return value * pow10(digits);
  if (typeof value !== 'number' && typeof value !== 'string') throw new TypeError('decimal value must be a number or string');
  if (typeof value === 'number' && !Number.isFinite(value)) throw new TypeError('decimal value must be finite');

  const rawExpanded = expandExponentialString(value);
  const negative = rawExpanded.startsWith('-');
  const unsigned = rawExpanded.replace(/^[-+]/, '');
  if (!/^\d*(?:\.\d*)?$/.test(unsigned) || unsigned === '' || unsigned === '.') {
    throw new TypeError(`invalid decimal value: ${value}`);
  }
  const [wholeRaw = '0', fractionRaw = ''] = unsigned.split('.');
  const whole = wholeRaw === '' ? '0' : wholeRaw;
  const scale = pow10(digits);
  const retained = fractionRaw.slice(0, digits).padEnd(digits, '0');
  const guard = fractionRaw.length > digits ? Number(fractionRaw[digits]) : 0;
  let scaled = BigInt(whole) * scale + BigInt(retained || '0');
  if (guard >= 5) scaled += 1n;
  return negative ? -scaled : scaled;
}

function roundDiv(numerator, denominator) {
  if (denominator === 0n) throw new RangeError('division by zero');
  let n = numerator;
  let d = denominator;
  if (d < 0n) { n = -n; d = -d; }
  const negative = n < 0n;
  const absN = negative ? -n : n;
  const q = absN / d;
  const r = absN % d;
  const rounded = r * 2n >= d ? q + 1n : q;
  return negative ? -rounded : rounded;
}

function scaledToNumber(value, digits) {
  const scale = Number(pow10(digits));
  return Number(value) / scale;
}

function toMoney(value) { return decimalToScaled(value, MONEY_DIGITS); }
function fromMoney(value) { return scaledToNumber(value, MONEY_DIGITS); }
function toRate(value) { return decimalToScaled(value, RATE_DIGITS); }
function fromRate(value) { return scaledToNumber(value, RATE_DIGITS); }

function money(value) { return fromMoney(toMoney(value)); }
function moneyAdd(...values) { return fromMoney(values.reduce((sum, value) => sum + toMoney(value), 0n)); }
function moneySub(a, b) { return fromMoney(toMoney(a) - toMoney(b)); }
function moneyMulRate(amount, rate) {
  return fromMoney(roundDiv(toMoney(amount) * toRate(rate), RATE_SCALE));
}
function moneyDivInt(amount, divisor) {
  if (!Number.isInteger(divisor) || divisor <= 0) throw new RangeError('divisor must be a positive integer');
  return fromMoney(roundDiv(toMoney(amount), BigInt(divisor)));
}

function rateDivInt(rate, divisor) {
  if (!Number.isInteger(divisor) || divisor <= 0) throw new RangeError('divisor must be a positive integer');
  return roundDiv(toRate(rate), BigInt(divisor));
}

function mulScaled(a, b, scale = RATE_SCALE) {
  return roundDiv(a * b, scale);
}

function divScaled(a, b, scale = RATE_SCALE) {
  if (b === 0n) throw new RangeError('division by zero');
  return roundDiv(a * scale, b);
}

function powScaled(base, exponent, scale = RATE_SCALE) {
  if (!Number.isInteger(exponent) || exponent < 0) throw new RangeError('exponent must be a non-negative integer');
  let result = scale;
  let factor = base;
  let n = exponent;
  while (n > 0) {
    if (n % 2 === 1) result = mulScaled(result, factor, scale);
    n = Math.floor(n / 2);
    if (n > 0) factor = mulScaled(factor, factor, scale);
  }
  return result;
}

// Exact rational discount-factor accumulation. We deliberately do not keep a
// repeatedly rounded fixed-scale discount factor: rates close to -1 can drive a
// fixed-scale factor to zero after only a few periods. Instead we preserve
// (1+r)^t as BigInt numerator/denominator powers and round only each discounted
// monetary contribution.
function npvScaled(rate, cashflows, moneyDigits = MONEY_DIGITS) {
  if (!Number.isFinite(rate) || rate <= -1) throw new RangeError('NPV rate must be finite and > -1');
  if (!Array.isArray(cashflows)) throw new TypeError('cashflows must be an array');
  const onePlusRate = RATE_SCALE + toRate(rate);
  if (onePlusRate <= 0n) throw new RangeError('NPV discount factor must be positive');

  let basePower = 1n;
  let scalePower = 1n;
  let npv = 0n;
  for (let t = 0; t < cashflows.length; t += 1) {
    const cf = cashflows[t];
    if (!Number.isFinite(cf)) throw new TypeError(`cashflow[${t}] must be finite`);
    if (t > 0) {
      basePower *= onePlusRate;
      scalePower *= RATE_SCALE;
    }
    npv += roundDiv(decimalToScaled(cf, moneyDigits) * scalePower, basePower);
  }
  return npv;
}

function preciseNPV(rate, cashflows) {
  return scaledToNumber(npvScaled(rate, cashflows, MONEY_DIGITS), MONEY_DIGITS);
}

function signBigInt(value) {
  if (value > 0n) return 1;
  if (value < 0n) return -1;
  return 0;
}

function preciseIRR(cashflows, options = {}) {
  if (!Array.isArray(cashflows) || cashflows.length < 2) return NaN;
  if (cashflows.some((cf) => !Number.isFinite(cf))) return NaN;
  const hasPositive = cashflows.some((cf) => cf > 0);
  const hasNegative = cashflows.some((cf) => cf < 0);
  if (!hasPositive || !hasNegative) return NaN;

  let lo = options.lo == null ? -0.99 : options.lo;
  let hi = options.hi == null ? 10 : options.hi;
  let nLo = npvScaled(lo, cashflows, IRR_NPV_DIGITS);
  let nHi = npvScaled(hi, cashflows, IRR_NPV_DIGITS);
  if (nLo === 0n) return lo;
  if (nHi === 0n) return hi;
  if (signBigInt(nLo) === signBigInt(nHi)) return NaN;

  for (let i = 0; i < 220; i += 1) {
    const mid = (lo + hi) / 2;
    const nMid = npvScaled(mid, cashflows, IRR_NPV_DIGITS);
    if (nMid === 0n || Math.abs(hi - lo) < 1e-12) return mid;
    if (signBigInt(nLo) !== signBigInt(nMid)) {
      hi = mid;
      nHi = nMid;
    } else {
      lo = mid;
      nLo = nMid;
    }
  }
  return (lo + hi) / 2;
}

function allocateMoney(total, count) {
  if (!Number.isInteger(count) || count <= 0) throw new RangeError('count must be a positive integer');
  const cents = toMoney(total);
  const divisor = BigInt(count);
  const base = cents / divisor;
  let remainder = cents % divisor;
  const negative = remainder < 0n;
  if (negative) remainder = -remainder;
  const out = [];
  for (let i = 0; i < count; i += 1) {
    let part = base;
    if (BigInt(i) < remainder) part += negative ? -1n : 1n;
    out.push(fromMoney(part));
  }
  return out;
}

function fixedPointAnnuityPayment({ balance, annualRate, months, balloon = 0 }) {
  if (!Number.isInteger(months) || months <= 0) throw new RangeError('months must be a positive integer');
  const balanceMoney = toMoney(balance);
  const balloonMoney = toMoney(balloon);
  const monthlyRate = rateDivInt(annualRate, 12);
  if (monthlyRate === 0n) return fromMoney(roundDiv(balanceMoney - balloonMoney, BigInt(months)));

  const growth = powScaled(RATE_SCALE + monthlyRate, months);
  const pvBalloon = roundDiv(balloonMoney * RATE_SCALE, growth);
  const principalPv = balanceMoney - pvBalloon;
  const inverseGrowth = divScaled(RATE_SCALE, growth);
  const denominator = RATE_SCALE - inverseGrowth;
  if (denominator <= 0n) throw new RangeError('invalid annuity denominator');
  const paymentMoney = roundDiv(principalPv * monthlyRate, denominator);
  return fromMoney(paymentMoney);
}

module.exports = {
  MONEY_DIGITS,
  MONEY_SCALE,
  RATE_DIGITS,
  RATE_SCALE,
  IRR_NPV_DIGITS,
  decimalToScaled,
  roundDiv,
  toMoney,
  fromMoney,
  toRate,
  fromRate,
  money,
  moneyAdd,
  moneySub,
  moneyMulRate,
  moneyDivInt,
  rateDivInt,
  mulScaled,
  divScaled,
  powScaled,
  npvScaled,
  preciseNPV,
  preciseIRR,
  allocateMoney,
  fixedPointAnnuityPayment,
};
