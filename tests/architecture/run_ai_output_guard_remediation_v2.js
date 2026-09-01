'use strict';

const assert = require('assert');
const {
  AI_ROLE,
  buildAiExpertStage,
  containsProhibitedDecisionLanguage,
  validateAiRoleOutput,
} = require('../../src/decision-intelligence/ai-expert-orchestrator');

function makeStage(role = AI_ROLE.ANALYST) {
  return buildAiExpertStage({
    role,
    caseId: 'CASE-GUARD-1',
    projectId: 'PROJECT-GUARD-1',
    contextVersionId: 'CTX-1',
    evidenceHash: 'HASH-1',
    decisionQuality: {
      caseId: 'CASE-GUARD-1',
      projectId: 'PROJECT-GUARD-1',
      status: 'READY_FOR_HUMAN_REVIEW',
      feedback: { materialUpstreamChange: false, aiOpinion: { status: 'CURRENT' } },
      reliability: { overallReliability: 'MODERATE' },
      dueDiligence: {},
    },
    dossier: {
      caseId: 'CASE-GUARD-1',
      projectId: 'PROJECT-GUARD-1',
      dossierStatus: 'READY_ANALYTICAL_CASE',
      aiNarrativeContext: { factRefs: [{ ref: 'E-1' }] },
    },
  });
}

function output(overrides = {}) {
  return {
    role: AI_ROLE.ANALYST,
    caseId: 'CASE-GUARD-1',
    projectId: 'PROJECT-GUARD-1',
    contextVersionId: 'CTX-1',
    evidenceHash: 'HASH-1',
    narrative: 'The evidence supports a conditional analytical interpretation.',
    citedEvidenceRefs: ['E-1'],
    uncertainties: [],
    disagreements: [],
    diligenceSuggestions: [],
    ...overrides,
  };
}

let checks = 0;
function check(name, fn) { fn(); checks += 1; console.log(`PASS ${name}`); }

check('descriptive English real-estate terms are not false positives', () => {
  const text = 'The purchase price is 140 million and the terminal sale value is evidence-sensitive; the buy-side assumption requires review.';
  assert.strictEqual(containsProhibitedDecisionLanguage(text), false);
  assert.strictEqual(validateAiRoleOutput({ stage: makeStage(), output: output({ narrative: text }) }).accepted, true);
});

check('descriptive Arabic purchase and sale nouns are not false positives', () => {
  const text = 'تكلفة الشراء وسعر البيع المتوقع افتراضان تحليليان ويجب التحقق من أدلتهما السوقية.';
  assert.strictEqual(containsProhibitedDecisionLanguage(text), false);
  assert.strictEqual(validateAiRoleOutput({ stage: makeStage(), output: output({ narrative: text }) }).accepted, true);
});

check('direct English imperative is rejected', () => {
  const result = validateAiRoleOutput({ stage: makeStage(), output: output({ narrative: 'BUY the asset based on the current case.' }) });
  assert.strictEqual(result.accepted, false);
  assert.ok(result.reasonCodes.includes('PROHIBITED_DECISION_LANGUAGE'));
  assert.deepStrictEqual(result.prohibitedDecisionLanguageFields, ['narrative']);
});

check('equivalent acquisition imperative is rejected instead of bypassing BUY token', () => {
  const result = validateAiRoleOutput({ stage: makeStage(), output: output({ narrative: 'The committee should acquire the property now.' }) });
  assert.strictEqual(result.accepted, false);
  assert.ok(result.reasonCodes.includes('PROHIBITED_DECISION_LANGUAGE'));
});

check('Arabic imperative acquisition language is rejected', () => {
  const result = validateAiRoleOutput({ stage: makeStage(), output: output({ narrative: 'يجب الاستحواذ على العقار وفق التحليل الحالي.' }) });
  assert.strictEqual(result.accepted, false);
  assert.ok(result.reasonCodes.includes('PROHIBITED_DECISION_LANGUAGE'));
});

check('guard scans uncertainties rather than narrative only', () => {
  const result = validateAiRoleOutput({ stage: makeStage(), output: output({ uncertainties: ['The committee should buy the asset if vacancy falls.'] }) });
  assert.strictEqual(result.accepted, false);
  assert.deepStrictEqual(result.prohibitedDecisionLanguageFields, ['uncertainties']);
});

check('guard scans disagreements', () => {
  const result = validateAiRoleOutput({ stage: makeStage(), output: output({ disagreements: ['يوصى بالبيع رغم اختلاف التقييمات.'] }) });
  assert.strictEqual(result.accepted, false);
  assert.deepStrictEqual(result.prohibitedDecisionLanguageFields, ['disagreements']);
});

check('guard scans diligence suggestions', () => {
  const result = validateAiRoleOutput({ stage: makeStage(), output: output({ diligenceSuggestions: ['APPROVE the transaction after title review.'] }) });
  assert.strictEqual(result.accepted, false);
  assert.deepStrictEqual(result.prohibitedDecisionLanguageFields, ['diligenceSuggestions']);
});

check('non-string structured text entries fail closed', () => {
  const result = validateAiRoleOutput({ stage: makeStage(), output: output({ uncertainties: [{ text: 'hidden directive' }] }) });
  assert.strictEqual(result.accepted, false);
  assert.ok(result.reasonCodes.includes('INVALID_TEXT_FIELD_SHAPE'));
  assert.deepStrictEqual(result.invalidTextShapeFields, ['uncertainties']);
});

check('further diligence recommendation remains allowed', () => {
  const result = validateAiRoleOutput({
    stage: makeStage(),
    output: output({ diligenceSuggestions: ['Obtain an independent lease review and verify the market evidence before human committee consideration.'] }),
  });
  assert.strictEqual(result.accepted, true);
  assert.strictEqual(result.transactionAuthorized, false);
  assert.strictEqual(result.humanDecisionRequired, true);
});

console.log(`AI_OUTPUT_GUARD_REMEDIATION_V2=PASS checks=${checks}`);
