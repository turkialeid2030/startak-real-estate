'use strict';

const STRESS_TEST_VERSION = 'STRESS_TEST_V2';
const STRESS_STATUS = Object.freeze({ QUALIFIED: 'QUALIFIED', REVIEW_REQUIRED: 'REVIEW_REQUIRED', HOLD: 'HOLD' });

function freeze(v){ if(v&&typeof v==='object'&&!Object.isFrozen(v)){Object.freeze(v);Object.values(v).forEach(freeze);} return v; }
function finite(v){ return typeof v==='number'&&Number.isFinite(v); }
function validRelativeShock(v){ return finite(v)&&v>-1; }

function runDeterministicStressTest({base, scenarios, thresholds}={}){
  const blockers=[];
  if(!base||!finite(base.noiSar)||base.noiSar<=0||!finite(base.valueSar)||base.valueSar<=0) blockers.push('VALID_BASE_CASE_REQUIRED');
  if(base&&base.effectiveRevenueSar!==undefined&&(!finite(base.effectiveRevenueSar)||base.effectiveRevenueSar<0)) blockers.push('EFFECTIVE_REVENUE_INVALID');
  if(base&&base.opexSar!==undefined&&(!finite(base.opexSar)||base.opexSar<0)) blockers.push('OPEX_INVALID');
  if(base&&base.annualDebtServiceSar!==undefined&&(!finite(base.annualDebtServiceSar)||base.annualDebtServiceSar<0)) blockers.push('ANNUAL_DEBT_SERVICE_INVALID');
  if(base&&base.capRate!==undefined&&(!finite(base.capRate)||base.capRate<=0)) blockers.push('BASE_CAP_RATE_INVALID');
  if(!Array.isArray(scenarios)||!scenarios.length) blockers.push('STRESS_SCENARIOS_REQUIRED');
  if(!thresholds||!finite(thresholds.maxValueDecline)||thresholds.maxValueDecline<0||thresholds.maxValueDecline>1||!finite(thresholds.minDscr)||thresholds.minDscr<0) blockers.push('GOVERNED_THRESHOLDS_REQUIRED');
  if(blockers.length) return freeze({version:STRESS_TEST_VERSION,status:STRESS_STATUS.HOLD,blockers:[...new Set(blockers)],warnings:[],results:[]});

  const results=[]; const warnings=[];
  for(const scenario of scenarios){
    if(!scenario||!scenario.id) return freeze({version:STRESS_TEST_VERSION,status:STRESS_STATUS.HOLD,blockers:['SCENARIO_ID_REQUIRED'],warnings,results});
    const rentShock=finite(scenario.rentShock)?scenario.rentShock:0;
    const occupancyShock=finite(scenario.occupancyShock)?scenario.occupancyShock:0;
    const opexShock=finite(scenario.opexShock)?scenario.opexShock:0;
    const capRateShock=finite(scenario.capRateShock)?scenario.capRateShock:0;
    const debtServiceShock=finite(scenario.debtServiceShock)?scenario.debtServiceShock:0;
    if(!validRelativeShock(rentShock)||!validRelativeShock(occupancyShock)||!validRelativeShock(opexShock)||!validRelativeShock(debtServiceShock)||!finite(capRateShock)){
      return freeze({version:STRESS_TEST_VERSION,status:STRESS_STATUS.HOLD,blockers:[`INVALID_STRESS_SCENARIO:${scenario.id}`],warnings,results});
    }
    const baseRevenue=finite(base.effectiveRevenueSar)?base.effectiveRevenueSar:base.noiSar+(base.opexSar||0);
    const baseOpex=finite(base.opexSar)?base.opexSar:baseRevenue-base.noiSar;
    if(baseRevenue<0||baseOpex<0) return freeze({version:STRESS_TEST_VERSION,status:STRESS_STATUS.HOLD,blockers:['BASE_REVENUE_OPEX_INCONSISTENT'],warnings,results});
    const stressedRevenue=baseRevenue*(1+rentShock)*(1+occupancyShock);
    const stressedOpex=baseOpex*(1+opexShock);
    const stressedNoi=stressedRevenue-stressedOpex;
    const baseCap=finite(base.capRate)&&base.capRate>0?base.capRate:base.noiSar/base.valueSar;
    const stressedCap=baseCap+capRateShock;
    if(stressedCap<=0) return freeze({version:STRESS_TEST_VERSION,status:STRESS_STATUS.HOLD,blockers:['STRESSED_CAP_RATE_INVALID'],warnings,results});
    const stressedValue=stressedNoi/stressedCap;
    const valueDecline=(base.valueSar-stressedValue)/base.valueSar;
    const debtService=finite(base.annualDebtServiceSar)?base.annualDebtServiceSar*(1+debtServiceShock):null;
    const dscr=debtService&&debtService>0?stressedNoi/debtService:null;
    const breached=[];
    if(valueDecline>thresholds.maxValueDecline) breached.push('MAX_VALUE_DECLINE');
    if(dscr!==null&&dscr<thresholds.minDscr) breached.push('MIN_DSCR');
    if(stressedNoi<=0) breached.push('NON_POSITIVE_NOI');
    if(breached.length) warnings.push(`SCENARIO_${scenario.id}_BREACH`);
    results.push({id:scenario.id,stressedRevenueSar:stressedRevenue,stressedOpexSar:stressedOpex,stressedNoiSar:stressedNoi,stressedCapRate:stressedCap,stressedValueSar:stressedValue,valueDecline,dscr,breached});
  }
  return freeze({version:STRESS_TEST_VERSION,status:warnings.length?STRESS_STATUS.REVIEW_REQUIRED:STRESS_STATUS.QUALIFIED,blockers:[],warnings:[...new Set(warnings)],results,thresholds,semantics:'Deterministic stress results are governed risk diagnostics under declared shocks, not forecasts, certified valuations, investment approvals, or transaction authority.'});
}

module.exports={STRESS_TEST_VERSION,STRESS_STATUS,runDeterministicStressTest};
