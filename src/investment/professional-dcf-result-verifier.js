'use strict';

const crypto = require('crypto');
const {
  PROFESSIONAL_DCF_MODEL_VERSION,
  PROFESSIONAL_DCF_RESULT_STATUS,
} = require('../engines/valuation/professional-dcf');

function stableClone(value) {
  if (Array.isArray(value)) return value.map(stableClone);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map(key=>[key,stableClone(value[key])]));
}
function sha256(value) { return crypto.createHash('sha256').update(JSON.stringify(stableClone(value))).digest('hex'); }
function validSha(value) { return typeof value === 'string' && /^[a-f0-9]{64}$/i.test(value); }

function professionalDcfResultCore(result) {
  return {
    schemaVersion: result.schemaVersion,
    modelVersion: result.modelVersion,
    caseId: result.caseId,
    propertyRef: result.propertyRef,
    valuationDate: result.valuationDate,
    inputPacketHashSha256: result.inputPacketHashSha256,
    timingConvention: result.timingConvention,
    terminalTimingConvention: result.terminalTimingConvention,
    professionalNoiCalculationHashSha256: result.professionalNoiCalculationHashSha256,
    noiConvention: result.noiConvention,
    discountRate: result.discountRate,
    discountRateProvenance: result.discountRateProvenance,
    exitCapRate: result.exitCapRate,
    exitCapRateProvenance: result.exitCapRateProvenance,
    operatingPresentValueTrace: result.operatingPresentValueTrace,
    operatingPresentValueSar: result.operatingPresentValueSar,
    terminalNoiInput: result.terminalNoiInput,
    grossTerminalValueSar: result.grossTerminalValueSar,
    dispositionCostInput: result.dispositionCostInput,
    dispositionCostSar: result.dispositionCostSar,
    netTerminalValueSar: result.netTerminalValueSar,
    terminalPeriodIndex: result.terminalPeriodIndex,
    terminalDiscountFactor: result.terminalDiscountFactor,
    terminalPresentValueSar: result.terminalPresentValueSar,
    valueIndicationSar: result.valueIndicationSar,
  };
}

// Replay the arithmetic and outcome from retained traces; a recomputed hash
// alone is not evidence of economic consistency or independent source rights.
function verifyProfessionalDcfArithmetic(result){
  const equal=(a,b)=>Number.isFinite(a)&&Number.isFinite(b)&&a===b;
  const positiveRate=x=>Number.isFinite(x)&&x>0&&x<=1;
  if(result.schemaVersion!==1||!positiveRate(result.discountRate)||!positiveRate(result.exitCapRate)||
     !['END_OF_PERIOD','MID_YEAR'].includes(result.timingConvention)||result.terminalTimingConvention!=='END_OF_FINAL_PERIOD')return false;
  if(result.unleveredPropertyCashFlowBasis!==true||result.indicationType!=='PROFESSIONAL_DCF_VALUE_INDICATION'||!Array.isArray(result.blockers)||result.blockers.length!==0||
    ['financingIncluded','debtServiceIncluded','incomeTaxCalculated','zakatCalculated','equityReturnAnalysisPerformed','automaticRateDerivation','automaticTerminalNoiDerivation','reconciliationPerformed','finalValuationConclusionEstablished','certifiedValuationEstablished','transactionAuthorized'].some(k=>result[k]!==false))return false;
  const flags=[],ids=new Set(),adjustments=new Set();let total=0;
  for(const [index,row] of result.operatingPresentValueTrace.entries()){
    if(!row||typeof row.periodId!=='string'||!row.periodId.trim()||ids.has(row.periodId)||row.periodIndex!==index+1||!Number.isFinite(row.selectedNoiSar)||!Array.isArray(row.adjustmentTrace))return false;
    ids.add(row.periodId);let inflows=0,outflows=0;
    for(const a of row.adjustmentTrace){
      if(!a||typeof a.adjustmentId!=='string'||!a.adjustmentId.trim()||adjustments.has(a.adjustmentId)||!validSha(a.dcfPeriodAdjustmentHashSha256)||!Number.isFinite(a.amountSar)||a.amountSar<0||!['INFLOW','OUTFLOW'].includes(a.direction))return false;
      adjustments.add(a.adjustmentId);if(a.direction==='INFLOW')inflows+=a.amountSar;else outflows+=a.amountSar;
    }
    const cf=row.selectedNoiSar+inflows-outflows,exponent=result.timingConvention==='MID_YEAR'?row.periodIndex-0.5:row.periodIndex;
    const factor=1/((1+result.discountRate)**exponent),pv=cf*factor;
    if(!equal(row.adjustmentInflowsSar,inflows)||!equal(row.adjustmentOutflowsSar,outflows)||!equal(row.unleveredPropertyCashFlowSar,cf)||!equal(row.timingExponent,exponent)||!equal(row.discountFactor,factor)||!equal(row.presentValueSar,pv))return false;
    if(cf<0)flags.push('NEGATIVE_UNLEVERED_PROPERTY_CASH_FLOW_REVIEW_REQUIRED:'+row.periodId);
    total+=pv;
  }
  const noi=result.terminalNoiInput?.amountSar,disposition=result.dispositionCostInput;
  if(!Number.isFinite(noi)||noi<=0||!Number.isFinite(disposition?.value)||disposition.value<0||!['AMOUNT_SAR','PERCENT_OF_GROSS_TERMINAL_VALUE'].includes(disposition.method)||(disposition.method==='PERCENT_OF_GROSS_TERMINAL_VALUE'&&disposition.value>1))return false;
  const gross=noi/result.exitCapRate,cost=disposition.method==='AMOUNT_SAR'?disposition.value:gross*disposition.value,net=gross-cost;
  const period=result.operatingPresentValueTrace.length,factor=1/((1+result.discountRate)**period),terminal=net*factor,value=total+terminal;
  if(!equal(result.operatingPresentValueSar,total)||!equal(result.grossTerminalValueSar,gross)||!equal(result.dispositionCostSar,cost)||!equal(result.netTerminalValueSar,net)||!equal(result.terminalPeriodIndex,period)||!equal(result.terminalDiscountFactor,factor)||!equal(result.terminalPresentValueSar,terminal)||!equal(result.valueIndicationSar,value))return false;
  if(net<=0)flags.push('NON_POSITIVE_NET_TERMINAL_VALUE_REVIEW_REQUIRED');
  if(value<=0)flags.push('NON_POSITIVE_DCF_VALUE_INDICATION_REVIEW_REQUIRED');
  if(cost>gross)flags.push('DISPOSITION_COST_EXCEEDS_GROSS_TERMINAL_VALUE_REVIEW_REQUIRED');
  return JSON.stringify(result.reviewFlags)===JSON.stringify(flags)&&result.status===(flags.length?PROFESSIONAL_DCF_RESULT_STATUS.REVIEW_REQUIRED:PROFESSIONAL_DCF_RESULT_STATUS.DCF_VALUE_INDICATION_READY);
}
function verifyProfessionalDcfResultIntegrity(result) {
  if (!result || typeof result !== 'object') return false;
  if (![PROFESSIONAL_DCF_RESULT_STATUS.DCF_VALUE_INDICATION_READY, PROFESSIONAL_DCF_RESULT_STATUS.REVIEW_REQUIRED].includes(result.status)) return false;
  if (result.modelVersion !== PROFESSIONAL_DCF_MODEL_VERSION || result.canonicalCalculationEngine !== true) return false;
  if (!validSha(result.calculationHashSha256) || !validSha(result.inputPacketHashSha256) || !validSha(result.professionalNoiCalculationHashSha256)) return false;
  if (!Array.isArray(result.operatingPresentValueTrace) || result.operatingPresentValueTrace.length === 0) return false;
  if (![result.operatingPresentValueSar, result.netTerminalValueSar, result.valueIndicationSar].every(Number.isFinite)) return false;
  try{return verifyProfessionalDcfArithmetic(result)&&sha256(professionalDcfResultCore(result)) === result.calculationHashSha256.toLowerCase();}catch{return false;}
}

module.exports = {
  professionalDcfResultCore,
  verifyProfessionalDcfResultIntegrity,
};
