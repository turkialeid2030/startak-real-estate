'use strict';

const C3_VALUATION_RECONCILIATION_SCHEMA_VERSION = 'C3_VALUATION_RECONCILIATION_V1';

const VALUATION_APPROACH_FAMILY = Object.freeze({
  MARKET: 'MARKET',
  INCOME: 'INCOME',
  COST: 'COST',
});

const RECONCILIATION_GATE_STATUS = Object.freeze({
  READY: 'READY',
  HOLD_EVIDENCE: 'HOLD_EVIDENCE',
  HOLD_RECONCILIATION: 'HOLD_RECONCILIATION',
});

const RECONCILIATION_CONFIDENCE_CLASS = Object.freeze({
  HIGH: 'HIGH',
  MODERATE: 'MODERATE',
  LOW: 'LOW',
  NOT_ESTABLISHED: 'NOT_ESTABLISHED',
});

const RECOGNIZED_METHOD_MODELS = Object.freeze({
  LAND_SALES_COMPARISON_1_0: Object.freeze({
    modelVersion: 'LAND_SALES_COMPARISON_1.0',
    approachFamily: VALUATION_APPROACH_FAMILY.MARKET,
    acceptedStatuses: Object.freeze(['LAND_VALUE_INDICATION_READY']),
    valueField: 'landValueIndicationSar',
    indicationTypeField: 'indicationType',
    expectedIndicationType: 'LAND_SALES_COMPARISON_VALUE_INDICATION',
  }),
  DIRECT_CAPITALIZATION_1_0: Object.freeze({
    modelVersion: 'DIRECT_CAPITALIZATION_1.0',
    approachFamily: VALUATION_APPROACH_FAMILY.INCOME,
    acceptedStatuses: Object.freeze(['DIRECT_CAPITALIZATION_VALUE_INDICATION_READY']),
    valueField: 'valueIndicationSar',
    indicationTypeField: 'indicationType',
    expectedIndicationType: 'DIRECT_CAPITALIZATION_VALUE_INDICATION',
  }),
  PROFESSIONAL_DCF_1_0: Object.freeze({
    modelVersion: 'PROFESSIONAL_DCF_1.0',
    approachFamily: VALUATION_APPROACH_FAMILY.INCOME,
    acceptedStatuses: Object.freeze(['DCF_VALUE_INDICATION_READY']),
    valueField: 'valueIndicationSar',
    indicationTypeField: 'indicationType',
    expectedIndicationType: 'PROFESSIONAL_DCF_VALUE_INDICATION',
  }),
  COST_APPROACH_1_0: Object.freeze({
    modelVersion: 'COST_APPROACH_1.0',
    approachFamily: VALUATION_APPROACH_FAMILY.COST,
    acceptedStatuses: Object.freeze(['VALUE_INDICATION_READY_FOR_RECONCILIATION']),
    valueField: 'costApproachValueIndicationSar',
    indicationTypeField: 'valueIndicationType',
    expectedIndicationType: 'COST_APPROACH_VALUE_INDICATION',
  }),
});

const RECOGNIZED_METHOD_MODELS_BY_VERSION = Object.freeze(
  Object.values(RECOGNIZED_METHOD_MODELS).reduce((acc, model) => {
    acc[model.modelVersion] = model;
    return acc;
  }, Object.create(null)),
);

module.exports = {
  C3_VALUATION_RECONCILIATION_SCHEMA_VERSION,
  VALUATION_APPROACH_FAMILY,
  RECONCILIATION_GATE_STATUS,
  RECONCILIATION_CONFIDENCE_CLASS,
  RECOGNIZED_METHOD_MODELS,
  RECOGNIZED_METHOD_MODELS_BY_VERSION,
};
