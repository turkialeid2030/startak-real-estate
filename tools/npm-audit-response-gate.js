'use strict';

// An unavailable or malformed audit must never be interpreted as zero findings.
function requireAuditCounts(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data) || data.error) {
    throw new Error('NPM_AUDIT_RESPONSE_UNAVAILABLE');
  }
  const counts = data.metadata && data.metadata.vulnerabilities;
  const levels = ['info', 'low', 'moderate', 'high', 'critical'];
  if (!counts || typeof counts !== 'object' || Array.isArray(counts)
    || !levels.every(key => Number.isSafeInteger(counts[key]) && counts[key] >= 0)
    || !Number.isSafeInteger(counts.total) || counts.total < 0
    || levels.reduce((sum, key) => sum + counts[key], 0) !== counts.total
    || !data.vulnerabilities || typeof data.vulnerabilities !== 'object'
    || Array.isArray(data.vulnerabilities)) {
    throw new Error('NPM_AUDIT_COUNTS_INVALID');
  }
  const actual = Object.fromEntries(levels.map(key => [key, 0]));
  for (const record of Object.values(data.vulnerabilities)) {
    if (!record || !Object.hasOwn(actual, record.severity)) {
      throw new Error('NPM_AUDIT_RECORD_INVALID');
    }
    actual[record.severity]++;
  }
  if (!levels.every(key => actual[key] === counts[key])) {
    throw new Error('NPM_AUDIT_COUNTS_INCONSISTENT');
  }
  return counts;
}
module.exports = { requireAuditCounts };
