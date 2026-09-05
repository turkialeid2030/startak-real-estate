'use strict';

const assert = require('assert');
const {
  VALUATION_STAGE_STATUS,
  METHOD_STATE,
  VALUATION_REASON_CODE,
} = require('../../src/valuation-intelligence');
const {
  STAGE_PRESENTATION_STATE,
  createValuationPresentation,
} = require('../../src/app/valuation-presentation');

(function testReadyStageProjectsToAvailableWithoutChangingDecisionSemantics() {
  const stage = {
    status: VALUATION_STAGE_STATUS.READY_FOR_DECISION_CONTROL,
    readyForDecisionControl: true,
    finalValue: 10000000,
    reasonCodes: [],
    evidenceGaps: [],
    methods: [{
      method: 'INCOME_DIRECT_CAPITALIZATION',
      state: METHOD_STATE.AVAILABLE,
      reasonCode: null,
      evidenceGaps: [],
      indication: { value: 10000000, weakestEvidenceGrade: 'D_OPERATING_ACTUAL' },
      evidenceQuality: { status: 'QUALIFIED' },
    }],
    reconciliation: null,
    singleMethodAcceptance: {
      method: 'INCOME_DIRECT_CAPITALIZATION',
      justification: 'Explicit professional governance acceptance for this single qualified method.',
    },
    humanDecisionRequired: true,
    transactionAuthorized: false,
  };

  const presentation = createValuationPresentation(stage);
  assert.strictEqual(presentation.state, STAGE_PRESENTATION_STATE.AVAILABLE);
  assert.strictEqual(presentation.readyForDecisionControl, true);
  assert.strictEqual(presentation.finalValue, 10000000);
  assert.strictEqual(presentation.transactionAuthorized, false);
  assert.strictEqual(presentation.methods[0].state, METHOD_STATE.AVAILABLE);
  assert.strictEqual(presentation.methods[0].indicationValue, 10000000);
  assert.strictEqual(presentation.reconciliationUsed, false);
  assert.strictEqual(presentation.singleMethodAcceptance.method, 'INCOME_DIRECT_CAPITALIZATION');
  assert.match(presentation.singleMethodAcceptance.justification, /Explicit professional governance acceptance/);
})();

(function testReconciledStageIdentifiesReconciliationWithoutSingleMethodAcceptance() {
  const presentation = createValuationPresentation({
    status: VALUATION_STAGE_STATUS.READY_FOR_DECISION_CONTROL,
    readyForDecisionControl: true,
    finalValue: 10500000,
    reasonCodes: [],
    evidenceGaps: [],
    methods: [
      { method: 'MARKET_COMPARABLE', state: METHOD_STATE.AVAILABLE, reasonCode: null, evidenceGaps: [], indication: { value: 11000000 }, evidenceQuality: { status: 'QUALIFIED' } },
      { method: 'INCOME_DIRECT_CAPITALIZATION', state: METHOD_STATE.AVAILABLE, reasonCode: null, evidenceGaps: [], indication: { value: 10000000 }, evidenceQuality: { status: 'QUALIFIED' } },
    ],
    reconciliation: { status: 'QUALIFIED', reconciledValue: 10500000 },
    singleMethodAcceptance: null,
  });

  assert.strictEqual(presentation.reconciliationUsed, true);
  assert.strictEqual(presentation.singleMethodAcceptance, null);
  assert.strictEqual(presentation.finalValue, 10500000);
})();

(function testHoldStageKeepsReasonAndEvidenceGapsVisible() {
  const stage = {
    status: VALUATION_STAGE_STATUS.HOLD_EVIDENCE,
    readyForDecisionControl: false,
    finalValue: null,
    reasonCodes: [VALUATION_REASON_CODE.EVIDENCE_QUALITY_HOLD],
    evidenceGaps: ['INCOME_DIRECT_CAPITALIZATION.capitalizationRate'],
    methods: [{
      method: 'INCOME_DIRECT_CAPITALIZATION',
      state: METHOD_STATE.HOLD,
      reasonCode: VALUATION_REASON_CODE.EVIDENCE_QUALITY_HOLD,
      evidenceGaps: ['INCOME_DIRECT_CAPITALIZATION.capitalizationRate'],
      indication: null,
      evidenceQuality: { status: 'HOLD_CRITICAL_FACT' },
    }],
    humanDecisionRequired: true,
    transactionAuthorized: false,
  };

  const presentation = createValuationPresentation(stage);
  assert.strictEqual(presentation.state, STAGE_PRESENTATION_STATE.HOLD);
  assert.strictEqual(presentation.readyForDecisionControl, false);
  assert.deepStrictEqual(presentation.reasonCodes, [VALUATION_REASON_CODE.EVIDENCE_QUALITY_HOLD]);
  assert.strictEqual(presentation.reasons[0].key, `valuation.presentation.reason.${VALUATION_REASON_CODE.EVIDENCE_QUALITY_HOLD}`);
  assert.deepStrictEqual(presentation.evidenceGaps, ['INCOME_DIRECT_CAPITALIZATION.capitalizationRate']);
  assert.strictEqual(presentation.methods[0].state, METHOD_STATE.HOLD);
  assert.strictEqual(presentation.methods[0].reasonCode, VALUATION_REASON_CODE.EVIDENCE_QUALITY_HOLD);
})();

(function testUnavailableStageProjectsToUnavailable() {
  const presentation = createValuationPresentation({
    status: VALUATION_STAGE_STATUS.UNAVAILABLE,
    readyForDecisionControl: false,
    finalValue: null,
    reasonCodes: [VALUATION_REASON_CODE.NO_QUALIFIED_VALUATION_METHOD],
    evidenceGaps: [],
    methods: [{
      method: 'INCOME_OPERATING_BUSINESS',
      state: METHOD_STATE.UNAVAILABLE,
      reasonCode: VALUATION_REASON_CODE.ASSET_ADAPTER_REQUIRED,
      evidenceGaps: [],
      indication: null,
      evidenceQuality: null,
    }],
  });

  assert.strictEqual(presentation.state, STAGE_PRESENTATION_STATE.UNAVAILABLE);
  assert.strictEqual(presentation.methods[0].state, METHOD_STATE.UNAVAILABLE);
  assert.strictEqual(presentation.methods[0].reasonKey, `valuation.presentation.reason.${VALUATION_REASON_CODE.ASSET_ADAPTER_REQUIRED}`);
})();

(function testPresentationRejectsMalformedSingleMethodAcceptance() {
  assert.throws(() => createValuationPresentation({
    status: VALUATION_STAGE_STATUS.READY_FOR_DECISION_CONTROL,
    methods: [],
    singleMethodAcceptance: { method: 'INCOME_DIRECT_CAPITALIZATION', justification: '' },
  }), /stage.singleMethodAcceptance.justification is required/);
})();

(function testPresentationRejectsUnknownEngineStateRatherThanGuessing() {
  assert.throws(() => createValuationPresentation({
    status: 'UNKNOWN_STATE',
    methods: [],
  }), /stage.status is invalid/);
})();

console.log('VALUATION_PRESENTATION_V1=PASS');
