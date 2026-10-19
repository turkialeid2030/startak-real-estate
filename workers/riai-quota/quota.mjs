const positive = value => Number.isSafeInteger(value) && value > 0;
const deny = code => ({ allowed: false, code });
async function count(tx, key) {
  const value = await tx.get(key);
  if (value === undefined || value === null) return 0;
  if (!Number.isSafeInteger(value) || value < 0) throw new Error('CORRUPT_QUOTA_STATE');
  return value;
}

// Requires a real, shared, persistent transaction store. No process-local lock.
export async function reserveQuota(storage, input) {
  const { id, subjectHash, now, tokens, limits, money } = input || {};
  if (!storage || typeof storage.transaction !== 'function') return deny('ATOMIC_STORE_REQUIRED');
  if (!/^[a-zA-Z0-9-]{16,80}$/.test(id || '') || !/^[a-f0-9]{64}$/.test(subjectHash || '') || !Number.isSafeInteger(now) || now < 0 || !positive(tokens)
    || !limits || !['minute', 'subjectDay', 'globalDay', 'tokensDay'].every(key => positive(limits[key]))) return deny('INVALID_QUOTA_INPUT');
  if (money !== undefined && (!money || !positive(money.reservedUsdMicros) || !positive(money.limitUsdMicros)
    || typeof money.model !== 'string' || !money.model.trim() || money.model.length>200)) return deny('INVALID_MONETARY_INPUT');
  const day = Math.floor(now / 86400000);
  const minute = Math.floor(now / 60000);
  try {
    return await storage.transaction(async tx => {
      const reservationKey = `reservation:${id}`;
      const existing = await tx.get(reservationKey);
      if (existing) {
        if (existing.subjectHash !== subjectHash || existing.tokens !== tokens || existing.day !== day
          || existing.reservedUsdMicros !== money?.reservedUsdMicros || existing.priceModel !== money?.model) return deny('RESERVATION_CONFLICT');
        return { allowed: true, replayed: true, id, reservedTokens: tokens, reservedUsdMicros:existing.reservedUsdMicros };
      }
      const keys = [`minute:${minute}:${subjectHash}`, `subject:${day}:${subjectHash}`, `global:${day}`, `tokens:${day}`];
      if (money) keys.push(`usd-micros:${day}`);
      const values = await Promise.all(keys.map(key => count(tx, key)));
      if (await tx.get(`blocked:${day}`)) return deny('QUOTA_RECONCILIATION_REQUIRED');
      const ceilings = [limits.minute, limits.subjectDay, limits.globalDay, limits.tokensDay];
      const increments = [1, 1, 1, tokens];
      if (money) { ceilings.push(money.limitUsdMicros); increments.push(money.reservedUsdMicros); }
      for (let i = 0; i < keys.length; i++) {
        if (values[i] > ceilings[i] - increments[i]) return deny(['MINUTE_LIMIT', 'SUBJECT_DAY_LIMIT', 'GLOBAL_DAY_LIMIT', 'TOKEN_DAY_LIMIT','MONETARY_DAY_LIMIT'][i]);
      }
      for (let i = 0; i < keys.length; i++) await tx.put(keys[i], values[i] + increments[i]);
      await tx.put(reservationKey, { id, day, subjectHash, tokens, state: 'RESERVED',
        ...(money ? {reservedUsdMicros:money.reservedUsdMicros,priceModel:money.model} : {}) });
      return { allowed: true, replayed: false, id, reservedTokens: tokens, reservedUsdMicros:money?.reservedUsdMicros, remainingTokens: limits.tokensDay - values[3] - tokens };
    });
  } catch (_) { return deny('QUOTA_STORAGE_FAILED'); }
}

// Missing/uncertain usage must not be refunded. Settle only server-verified usage.
export async function settleQuota(storage, { id, actualTokens } = {}) {
  if (!storage || typeof storage.transaction !== 'function') return { settled: false, code: 'ATOMIC_STORE_REQUIRED' };
  if (!/^[a-zA-Z0-9-]{16,80}$/.test(id || '') || !Number.isSafeInteger(actualTokens) || actualTokens < 0) return { settled: false, code: 'INVALID_USAGE' };
  try {
    return await storage.transaction(async tx => {
      const key = `reservation:${id}`;
      const reservation = await tx.get(key);
      if (!reservation) return { settled: false, code: 'RESERVATION_NOT_FOUND' };
      if (reservation.state === 'SETTLED') return reservation.actualTokens === actualTokens
        ? { settled: true, replayed: true, overage: actualTokens > reservation.tokens }
        : { settled: false, code: 'SETTLEMENT_CONFLICT' };
      const tokensKey = `tokens:${reservation.day}`;
      const current = await count(tx, tokensKey);
      const adjusted = current - reservation.tokens + actualTokens;
      if (current < reservation.tokens || !Number.isSafeInteger(adjusted) || adjusted < 0) throw new Error('CORRUPT_QUOTA_STATE');
      const overage = actualTokens > reservation.tokens;
      await tx.put(tokensKey, adjusted);
      // Retain the monetary ceiling even after token settlement: token usage is
      // not an independently reconciled bill. Timeouts and uncertain outcomes
      // also retain it. No refund or currency conversion is inferred here.
      if (overage) await tx.put(`blocked:${reservation.day}`, true);
      await tx.put(key, { ...reservation, state: 'SETTLED', actualTokens });
      return { settled: true, replayed: false, overage };
    });
  } catch (_) { return { settled: false, code: 'QUOTA_STORAGE_FAILED' }; }
}
