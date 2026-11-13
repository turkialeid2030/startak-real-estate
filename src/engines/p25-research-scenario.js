'use strict';
// Isolated analytical sensitivity runner. This is NOT an approval workflow.
const { STUDY_TYPE } = require('../contracts/study-type');
const { V2_APPROVED_ASSUMPTIONS } = require('../assumptions/assumption-model');
const {
  buildCriticalAssumptionOverrideGovernance,
} = require('../assumptions/critical-assumption-override-governance');

const P25_WHAT_IF_STATUS = Object.freeze({
  ANALYTICAL_HOLD:'ANALYTICAL_HOLD_FOR_INDEPENDENT_APPROVAL',
  INVALID:'HOLD_INVALID_SCENARIO',
});
const METRICS = Object.freeze([
  'NOI','npv','irr','netYieldOnCost','marketValueByIncomeCap',
  'totalPurchaseCost','loanAmount','dscrMin','leveredNPV','leveredIRR',
]);
function deny(reasons, governance = null) {
  return Object.freeze({
    schemaVersion:1,status:P25_WHAT_IF_STATUS.INVALID,
    reasonCodes:Object.freeze([...reasons]),
    structuralReview:governance?.status || null,
    baseline:null,whatIf:null,deltas:null,
    independentApprovalVerified:false,professionalValuationAuthorized:false,
    financialDecisionAuthorized:false,transactionAuthorized:false,
    productionOverrideActivated:false,
  });
}
function economicView(result) {
  const values = Object.fromEntries(METRICS.map(key => [
    key,typeof result[key]==='number' && Number.isFinite(result[key]) ? result[key] : null,
  ]));
  for (const field of ['cashflows','leveredCashflows']) {
    values[field] = Array.isArray(result[field]) && result[field].every(Number.isFinite)
      ? Object.freeze([...result[field]]) : null;
  }
  return Object.freeze(values);
}
function evaluateP25ResearchScenario({
  studyType,inputs,leverageEnabled,assumptionModelVersion,assumptionRegistry,asOf,
} = {}, {runBaseline,runScenario} = {}) {
  if (typeof runBaseline !== 'function' || typeof runScenario !== 'function') {
    throw new TypeError('P25_EXECUTOR_NOT_AVAILABLE');
  }
  if (studyType !== STUDY_TYPE.EXISTING_BUILDING
      || assumptionModelVersion !== 'V2'
      || !inputs || typeof inputs !== 'object' || Array.isArray(inputs)) {
    return deny(['P25_WHAT_IF_V2_BUILDING_INPUTS_REQUIRED']);
  }
  if (!Array.isArray(assumptionRegistry) || assumptionRegistry.length===0) {
    return deny(['P25_CRITICAL_OVERRIDE_REGISTRY_REQUIRED']);
  }
  // The original P25 source parser intentionally skips irrelevant fields.
  // Research scenarios must reject those ambiguous extra records instead
  // of misreporting a partial user intent as the complete scenario.
  const recognized = Object.keys(V2_APPROVED_ASSUMPTIONS);
  if (assumptionRegistry.some(item => !item || typeof item!=='object' || Array.isArray(item)
      || item.override !== true || !recognized.includes(item.id))) {
    return deny(['P25_UNKNOWN_OR_MALFORMED_OVERRIDE_FORBIDDEN']);
  }
  const governance = buildCriticalAssumptionOverrideGovernance({
    assumptionRegistry,assumptionModelVersion,asOf,
  });
  if (!governance.hasCriticalOverrides || governance.decisionReady !== true
      || governance.status !== 'READY') {
    return deny(governance.blockers.length ? governance.blockers : ['P25_DOCUMENTATION_REQUIRED'],governance);
  }
  const overrides = Object.freeze({...governance.resolvedOverrides});
  if (!Object.keys(overrides).length) return deny(['P25_NUMERIC_OVERRIDE_REQUIRED'],governance);
  const terms={studyType,inputs,leverageEnabled,assumptionModelVersion:'V2'};
  let baseline,scenario;
  try {
    baseline=runBaseline(terms);
    scenario=runScenario(terms,overrides);
  } catch (error) {
    // Invalid or out-of-range overrides must not return a partial financial
    // scenario; numerical validation is owned by the canonical calculator.
    return deny(['P25_FINANCIAL_SCENARIO_INPUTS_INVALID',String(error?.code||error?.rule||'INVALID')],governance);
  }
  if (!baseline || !scenario
      || baseline.decisionStatus==='INCOMPLETE_INPUTS'
      || scenario.decisionStatus==='INCOMPLETE_INPUTS') {
    return deny(['P25_BASELINE_OR_SCENARIO_NOT_ECONOMICALLY_COMPLETE'],governance);
  }
  const base=economicView(baseline),whatIf=economicView(scenario);
  const deltas=Object.freeze(Object.fromEntries(METRICS.map(key=>[
    key,base[key]===null||whatIf[key]===null?null:whatIf[key]-base[key],
  ])));
  return Object.freeze({
    schemaVersion:1,studyType,assumptionModelVersion:'V2',
    status:P25_WHAT_IF_STATUS.ANALYTICAL_HOLD,
    reasonCodes:Object.freeze([
      'P25_SOURCE_APPROVAL_NOT_INDEPENDENTLY_AUTHENTICATED',
      'P25_WHAT_IF_IS_NOT_AN_INVESTMENT_VERDICT',
    ]),
    structuralReview:governance.status,
    comparedAssumptionKeys:Object.freeze(Object.keys(overrides)),
    baseline:base,whatIf,deltas,
    independentApprovalVerified:false,professionalValuationAuthorized:false,
    financialDecisionAuthorized:false,transactionAuthorized:false,
    productionOverrideActivated:false,
    semantics:'Analytical V2 cashflow sensitivity only; no authenticated approval, professional valuation or investment decision.',
  });
}
module.exports={P25_WHAT_IF_STATUS,evaluateP25ResearchScenario};
