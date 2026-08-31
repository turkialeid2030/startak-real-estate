'use strict';

const assert = require('assert');
const {
  OPERATING_MODE,
  EXTERNAL_DECISION_LABEL,
  FULL_SCOPE_NOTICE,
  externalizeInternalVerdict,
  renderDecisionSupportLabel,
  assertPermittedExternalOutput,
  createDecisionSupportEnvelope,
} = require('../../src/compliance/decision-support');
const {
  getVerdictLabel,
  getExternalDecisionSupportVerdictLabel,
} = require('../../src/i18n/domain-presentation');

let checks = 0;
function check(fn) { fn(); checks++; }

check(() => assert.strictEqual(
  externalizeInternalVerdict('يوصى بالشراء'),
  EXTERNAL_DECISION_LABEL.FAVOURABLE_ANALYTICAL_CASE,
));
check(() => assert.strictEqual(
  externalizeInternalVerdict('يوصى بالشراء بشروط'),
  EXTERNAL_DECISION_LABEL.CONDITIONAL,
));
check(() => assert.strictEqual(
  externalizeInternalVerdict('لا يوصى بالشراء'),
  EXTERNAL_DECISION_LABEL.HIGH_RISK,
));
check(() => assert.strictEqual(
  externalizeInternalVerdict('يوصى بالشراء', { evidenceReady: false }),
  EXTERNAL_DECISION_LABEL.HOLD_EVIDENCE,
));
check(() => assert.strictEqual(
  externalizeInternalVerdict('يوصى بالشراء', { requiresLicensedReview: true }),
  EXTERNAL_DECISION_LABEL.REQUIRES_LICENSED_REVIEW,
));

for (const prohibited of ['BUY', 'SELL', 'APPROVE', 'REJECT', 'CERTIFIED_VALUATION', 'LEGAL_OPINION', 'REGULATED_INVESTMENT_ADVICE', 'BROKER_RECOMMENDATION']) {
  check(() => assert.throws(
    () => assertPermittedExternalOutput(prohibited),
    (error) => error && error.code === 'COMPLIANCE_GUARD_BLOCKED_OUTPUT',
  ));
}

check(() => assert.throws(
  () => externalizeInternalVerdict('UNKNOWN_VERDICT'),
  /UNMAPPED_INTERNAL_VERDICT/,
));
check(() => assert.throws(
  () => externalizeInternalVerdict('يوصى بالشراء', { mode: OPERATING_MODE.LICENSED_PROVIDER }),
  /LICENSED_PROVIDER mode is not enabled/,
));

const arTranslator = (key) => ({
  'recommendation.buy': 'يوصى بالشراء',
  'recommendation.conditionalBuy': 'يوصى بالشراء بشروط',
  'recommendation.noBuy': 'لا يوصى بالشراء',
}[key]);
const enTranslator = (key) => ({
  'recommendation.buy': 'Recommended to Buy',
  'recommendation.conditionalBuy': 'Conditionally Recommended',
  'recommendation.noBuy': 'Not Recommended',
}[key]);

// Historical localization remains intact for regression/characterization.
check(() => assert.strictEqual(getVerdictLabel('يوصى بالشراء', arTranslator), 'يوصى بالشراء'));
check(() => assert.strictEqual(getVerdictLabel('يوصى بالشراء بشروط', arTranslator), 'يوصى بالشراء بشروط'));
check(() => assert.strictEqual(getVerdictLabel('لا يوصى بالشراء', arTranslator), 'لا يوصى بالشراء'));
check(() => assert.strictEqual(getVerdictLabel('يوصى بالشراء', enTranslator), 'Recommended to Buy'));
check(() => assert.strictEqual(getVerdictLabel('يوصى بالشراء بشروط', enTranslator), 'Conditionally Recommended'));
check(() => assert.strictEqual(getVerdictLabel('لا يوصى بالشراء', enTranslator), 'Not Recommended'));

// New/customer-facing decision-support presentation is compliance-bounded.
check(() => assert.strictEqual(getExternalDecisionSupportVerdictLabel('يوصى بالشراء', arTranslator), 'حالة تحليلية مواتية'));
check(() => assert.strictEqual(getExternalDecisionSupportVerdictLabel('يوصى بالشراء بشروط', arTranslator), 'حالة تحليلية مشروطة'));
check(() => assert.strictEqual(getExternalDecisionSupportVerdictLabel('لا يوصى بالشراء', arTranslator), 'مخاطر تحليلية مرتفعة'));
check(() => assert.strictEqual(getExternalDecisionSupportVerdictLabel('يوصى بالشراء', enTranslator), 'Favourable Analytical Case'));
check(() => assert.strictEqual(getExternalDecisionSupportVerdictLabel('يوصى بالشراء بشروط', enTranslator), 'Conditional Analytical Case'));
check(() => assert.strictEqual(getExternalDecisionSupportVerdictLabel('لا يوصى بالشراء', enTranslator), 'High Analytical Risk'));

for (const label of Object.values(EXTERNAL_DECISION_LABEL)) {
  const ar = renderDecisionSupportLabel(label, 'ar');
  const en = renderDecisionSupportLabel(label, 'en');
  check(() => assert.ok(ar && en));
  check(() => assert.ok(!/يوصى\s*بالشراء|شراء\s*العقار|بيع\s*العقار/i.test(ar)));
  check(() => assert.ok(!/\b(recommended to buy|buy|sell|approve|reject)\b/i.test(en)));
}

const envelope = createDecisionSupportEnvelope({
  analyticalLabel: EXTERNAL_DECISION_LABEL.FAVOURABLE_ANALYTICAL_CASE,
  locale: 'ar',
  assumptions: ['افتراض اختباري'],
  evidenceGaps: ['مستند ناقص'],
});
check(() => assert.strictEqual(envelope.outputType, 'ANALYTICAL_INDICATION'));
check(() => assert.strictEqual(envelope.operatingMode, OPERATING_MODE.UNLICENSED_DECISION_SUPPORT));
check(() => assert.strictEqual(envelope.scopeNotice, FULL_SCOPE_NOTICE.ar));
check(() => assert.ok(envelope.scopeNotice.includes('ليست استشارة عقارية مرخصة')));
check(() => assert.strictEqual(envelope.licensedReviewRequired, false));
check(() => assert.ok(Object.isFrozen(envelope)));

console.log(`COMPLIANCE_GUARD_ARCHITECTURE: PASS (${checks} checks)`);
