'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
let checks = 0;
function check(fn) { fn(); checks += 1; }
function read(relativePath) { return fs.readFileSync(path.join(ROOT, relativePath), 'utf8'); }

const evidence = JSON.parse(read('release/evidence/c47-internal-privacy-pdpl-readiness.json'));
check(() => assert.strictEqual(evidence.scope, 'C47_INTERNAL_PRIVACY_PDPL_READINESS'));
check(() => assert.strictEqual(evidence.baseC46QualifiedHeadSha, '65f1acd60335660396f0d84f5cc4839e6745ebdf'));
check(() => assert.strictEqual(evidence.internalEngineeringDecision, 'READY_FOR_INDEPENDENT_PRIVACY_REVIEW'));
for (const field of [
  'externalPrivacyAuthorizationGranted',
  'gate546Satisfied',
  'pdplComplianceCertified',
  'legalOpinionObtained',
  'productionPrivacyCertified',
  'deploymentAuthorized',
  'commercialGoLiveAuthorized',
  'dataSubjectRightsOperationallyValidated',
  'retentionDeletionOperationallyValidated',
  'crossBorderTransferLegalBasisValidated',
  'providerPersonalDataTransferAuthorized',
  'externalTelemetryRawUserContentAllowed',
]) {
  check(() => assert.strictEqual(evidence[field], false, `${field} must remain false`));
}
check(() => assert(Array.isArray(evidence.blockingOperationalItems) && evidence.blockingOperationalItems.length >= 4));

const observabilitySource = read('src/observability/report-runtime-error.js');
const observability = require('../../src/observability/report-runtime-error.js');
check(() => assert(!observability.ALLOWED_ENVELOPE_FIELDS.includes('userAgent')));
check(() => assert(observability.ALLOWED_ENVELOPE_FIELDS.includes('message')));
check(() => assert.strictEqual(observability.safeProviderMessage('window_error'), 'STARTAK window error'));
check(() => assert.strictEqual(observability.safeProviderMessage('unhandled_rejection'), 'STARTAK unhandled rejection'));
check(() => assert.strictEqual(observability.safeProviderMessage('anything_else'), 'STARTAK runtime error'));

const maliciousEnvelope = observability.sanitizeEnvelope({
  appVersion: '1.2.3',
  buildHash: 'abc123',
  timestamp: '2026-10-04T08:00:00.000Z',
  category: 'window_error',
  message: 'Jane Doe jane@example.com token=top-secret project=private',
  surface: 'global',
  locale: 'en-US',
  userAgent: 'raw-user-agent-private-value',
});
const serializedEnvelope = JSON.stringify(maliciousEnvelope);
check(() => assert.strictEqual(maliciousEnvelope.message, 'STARTAK window error'));
for (const forbidden of ['Jane Doe', 'jane@example.com', 'top-secret', 'private', 'raw-user-agent-private-value']) {
  check(() => assert(!serializedEnvelope.includes(forbidden), `telemetry envelope leaked ${forbidden}`));
}
check(() => assert(!Object.prototype.hasOwnProperty.call(maliciousEnvelope, 'userAgent')));
check(() => assert(observabilitySource.includes('sendDefaultPii: false')));
check(() => assert(observabilitySource.includes('defaultIntegrations: false')));
check(() => assert(observabilitySource.includes('attachStacktrace: false')));
check(() => assert(observabilitySource.includes('message: safeProviderMessage(category)')));
check(() => assert(!observabilitySource.includes('message: e?.message')));
check(() => assert(!observabilitySource.includes('e?.reason?.message')));

const gateway = read('src/ai/governed-live-provider-gateway.js');
check(() => assert(gateway.includes('item.dataClass === DATA_CLASS.PERSONAL_DATA')));
check(() => assert(gateway.includes('C23_PRIVACY_PERSONAL_DATA_EXTERNAL_TRANSFER_NOT_AUTHORIZED')));
check(() => assert(gateway.includes("b.startsWith('C23_PRIVACY_')")));
check(() => assert(gateway.includes('if (!readiness.providerInvocationReady) return freeze({ ...readiness, providerCalled: false, providerResponse: null });')));

const browserStorage = read('src/storage/browser-local-storage-provider.js');
check(() => assert(browserStorage.includes('window.localStorage.setItem')));
check(() => assert(browserStorage.includes('window.localStorage.removeItem')));
check(() => assert(browserStorage.includes('delete: del')));
check(() => assert(!/expiresAt|expires_at|retentionDays|retention_days/.test(browserStorage)));

const backup = read('src/storage/saved-deals-backup.js');
check(() => assert(backup.includes("outputClassification: 'USER_MANAGED_DATA_BACKUP'")));
check(() => assert(backup.includes('USER_MANAGED_SAVED_DEALS_BACKUP')));
check(() => assert(backup.includes("JSON.stringify(record)")));
check(() => assert(!/encrypt|cipher|passwordProtect/i.test(backup)));

const postgresMigration = read('src/storage/postgres-canonical-workspace-migration.js');
check(() => assert(postgresMigration.includes("'  payload jsonb NOT NULL")));
check(() => assert(postgresMigration.includes('Generated code is not proof that this migration has been executed')));
check(() => assert(!/expires_at|deleted_at|retention_until/.test(postgresMigration)));

const localIntake = read('src/components/LocalDocumentEvidenceIntakePanel.jsx');
check(() => assert(localIntake.includes('const MAX_FILE_BYTES = 40 * 1024 * 1024')));
check(() => assert(localIntake.includes('Processing is local in this interface; this module does not send the file to an external service.')));
check(() => assert(localIntake.includes("globalThis.crypto.subtle.digest('SHA-256', buffer)")));

const docs = read('docs/C47_INTERNAL_PRIVACY_PDPL_READINESS.md');
check(() => assert(docs.includes('not a legal opinion')));
check(() => assert(docs.includes('does **not certify PDPL compliance**')));
check(() => assert(docs.includes('External privacy / PDPL gate: **#546**')));
check(() => assert(docs.includes('C47_GATE_546_SATISFIED=FALSE')));
check(() => assert(docs.includes('C47_DEPLOYMENT_AUTHORIZED=FALSE')));
check(() => assert(docs.includes('C47_COMMERCIAL_GO_LIVE_AUTHORIZED=FALSE')));

const workflow = read('.github/workflows/c47-internal-privacy-pdpl-readiness.yml');
const immutableUse = /^\s*-?\s*uses:\s*[^\s@]+@[a-f0-9]{40}\s*$/i;
const usesLines = workflow.split(/\r?\n/).filter((line) => /^\s*-?\s*uses:/.test(line));
check(() => assert(usesLines.length > 0, 'C47 workflow must use at least one external action'));
usesLines.forEach((line) => check(() => assert(immutableUse.test(line), `mutable action reference: ${line.trim()}`)));
check(() => assert(/permissions:\s*\n\s*contents:\s*read/m.test(workflow)));
check(() => assert(workflow.includes('branches:\n      - c46-internal-security-review-and-hardening')));
check(() => assert(workflow.includes('C47_PDPL_COMPLIANCE_CERTIFIED=FALSE'));
check(() => assert(workflow.includes('C47_GATE_546_SATISFIED=FALSE'));
check(() => assert(workflow.includes('C47_DEPLOYMENT_AUTHORIZED=FALSE'));
check(() => assert(workflow.includes('C47_COMMERCIAL_GO_LIVE_AUTHORIZED=FALSE'));

console.log(`C47_INTERNAL_PRIVACY_PDPL_READINESS=PASS checks=${checks}`);
console.log('C47_READY_FOR_INDEPENDENT_PRIVACY_REVIEW=PASS');
console.log('C47_PDPL_COMPLIANCE_CERTIFIED=FALSE');
console.log('C47_GATE_546_SATISFIED=FALSE');
console.log('C47_DEPLOYMENT_AUTHORIZED=FALSE');
console.log('C47_COMMERCIAL_GO_LIVE_AUTHORIZED=FALSE');
