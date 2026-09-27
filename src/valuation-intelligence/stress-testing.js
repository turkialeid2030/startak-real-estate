'use strict';

const STRESS_TEST_VERSION = 'STRESS_TEST_V2';
const STRESS_STATUS = Object.freeze({ QUALIFIED: 'QUALIFIED', REVIEW_REQUIRED: 'REVIEW_REQUIRED', HOLD: 'HOLD' });

function freeze(v){ if(v&&typeof v==='object'&&!Object.isFrozen(v)){Object.freeze(v);Object.values(v).forEach(freeze);} return v; }
function finite(v){ return typeof v==='number'&&Number.isFinite(v); }
function hasOwn(v,key){ return !!v&&typeof v==='object'&&Object.prototype.hasOwnProperty.call(v,key); }
function optionalFinite(v,key){ return !hasOwn(v,key)||v[key]===undefined||v[key]===null||finite(v[key]); }
function multiplicativeShockValid(v){ return finite(v)&&v>-1; }
function scenarioShock(scenario,key){ return hasOwn(scenario,key)&&scenario[key]!==undefined&&scenario[key]!==null?scenario[key]:0; }

function runDeterministicStressTest({base, scenarios, thresholds}={}){
  const blockers=[];
  if(!base||!finite(base.noiSar)||base.noiSar<=0||!finite(base.valueSar)||base.valueSar<=0) blockers.push('VALID_BASE_CASE_REQUIRED');
  if(base&&hasOwn(base,'effectiveRevenueSar')&&base.effectiveRevenueSar!==undefined&&base.effectiveRevenueSar!==null&&(!finite(base.effectiveRevenueSar)||base.effectiveRevenueSar<0)) blockers.push('BASE_EFFECTIVE_REVENUE_INVALID');
  if(base&&hasOwn(base,'opexSar')&&base.opexSar!==undefined&&base.opexSar!==null&&(!finite(base.opexSar)||base.opexSar<0)) blockers.push('BASE_OPEX_INVALID');
  if(base&&hasOwn(base,'annualDebtServiceSar')&&base.annualDebtServiceSar!==undefined&&base.annualDebtServiceSar!==null&&(!finite(base.annualDebtServiceSar)||base.annualDebtServiceSar<0)) blockers.push('BASE_DEBT_SERVICE_INVALID');
  if(base&&hasOwn(base,'capRate')&&base.capRate!==undefined&&base.capRate!==null&&(!finite(base.capRate)||base.capRate<=0)) blockers.push('BASE_CAP_RATE_INVALID');
  if(base&&hasOwn(base,'occupancyRate')&&base.occupancyRate!==undefined&&base.occupancyRate!==null&&(!finite(base.occupancyRate)||base.occupancyRate<0||base.occupancyRate>1)) blockers.push('BASE_OCCUPANCY_RATE_INVALID');
  if(!Array.isArray(scenarios)||!scenarios.length) blockers.push('STRESS_SCENARIOS_REQUIRED');
  if(!thresholds||!finite(thresholds.maxValueDecline)||thresholds.maxValueDecline<0||thresholds.maxValueDecline>1||!finite(thresholds.minDscr)||thresholds.minDscr<0) blockers.push('GOVERNED_THRESHOLDS_REQUIRED');
  if(blockers.length) return freeze({version:STRESS_TEST_VERSION,status:STRESS_STATUS.HOLD,blockers:[...new Set(blockers)],warnings:[],results:[]});

  const hasRevenue=hasOwn(base,'effectiveRevenueSar')&&base.effectiveRevenueSar!==undefined&&base.effectiveRevenueSar!==null;
  const hasOpex=hasOwn(base,'opexSar')&&base.opexSar!==undefined&&base.opexSar!==null;
  const baseRevenue=hasRevenue?base.effectiveRevenueSar:base.noiSar+(hasOpex?base.opexSar:0);
  const baseOpex=hasOpex?base.opexSar:baseRevenue-base.noiSar;
  const arithmeticTolerance=Math.max(0.01,Math.abs(base.noiSar)*1e-9);
  if(!finite(baseRevenue)||baseRevenue<0||!finite(baseOpex)||baseOpex<0||Math.abs((baseRevenue-baseOpex)-base.noiSar)>arithmeticTolerance){
    return freeze({version:STRESS_TEST_VERSION,status:STRESS_STATUS.HOLD,blockers:['BASE_CASE_ARITHMETIC_INCONSISTENT'],warnings:[],results:[]});
  }

  const baseCap=hasOwn(base,'capRate')&&base.capRate!==undefined&&base.capRate!==null?base.capRate:base.noiSar/base.valueSar;
  if(!finite(baseCap)||baseCap<=0) return freeze({version:STRESS_TEST_VERSION,status:STRESS_STATUS.HOLD,blockers:['BASE_CAP_RATE_INVALID'],warnings:[],results:[]});

  const results=[]; const warnings=[];
  for(const scenario of scenarios){
    if(!scenario||typeof scenario!=='object'||!scenario.id) return freeze({version:STRESS_TEST_VERSION,status:STRESS_STATUS.HOLD,blockers:['SCENARIO_ID_REQUIRED'],warnings,results});

    const shockFields=[
      ['rentShock','SCENARIO_RENT_SHOCK_INVALID',true],
      ['occupancyShock','SCENARIO_OCCUPANCY_SHOCK_INVALID',true],
      ['opexShock','SCENARIO_OPEX_SHOCK_INVALID',true],
      ['capRateShock','SCENARIO_CAP_RATE_SHOCK_INVALID',false],
      ['debtServiceShock','SCENARIO_DEBT_SERVICE_SHOCK_INVALID',true],
    ];
    for(const [field,code,multiplicative] of shockFields){
      if(!optionalFinite(scenario,field)) return freeze({version:STRESS_TEST_VERSION,status:STRESS_STATUS.HOLD,blockers:[code],warnings,results});
      const value=scenarioShock(scenario,field);
      if(multiplicative&&!multiplicativeShockValid(value)) return freeze({version:STRESS_TEST_VERSION,status:STRESS_STATUS.HOLD,blockers:[code],warnings,results});
    }

    const rentShock=scenarioShock(scenario,'rentShock');
    const occupancyShock=scenarioShock(scenario,'occupancyShock');
    const opexShock=scenarioShock(scenario,'opexShock');
    const capRateShock=scenarioShock(scenario,'capRateShock');
    const debtServiceShock=scenarioShock(scenario,'debtServiceShock');

    const stressedOccupancyRate=hasOwn(base,'occupancyRate')&&base.occupancyRate!==undefined&&base.occupancyRate!==null?base.occupancyRate*(1+occupancyShock):null;
    if(stressedOccupancyRate!==null&&(!finite(stressedOccupancyRate)||stressedOccupancyRate<0||stressedOccupancyRate>1)){
      return freeze({version:STRESS_TEST_VERSION,status:STRESS_STATUS.HOLD,blockers:['STRESSED_OCCUPANCY_RATE_INVALID'],warnings,results});
    }

    const stressedRevenue=baseRevenue*(1+rentShock)*(1+occupancyShock);
    const stressedOpex=baseOpex*(1+opexShock);
    if(!finite(stressedRevenue)||stressedRevenue<0) return freeze({version:STRESS_TEST_VERSION,status:STRESS_STATUS.HOLD,blockers:['STRESSED_REVENUE_INVALID'],warnings,results});
    if(!finite(stressedOpex)||stressedOpex<0) return freeze({version:STRESS_TEST_VERSION,status:STRESS_STATUS.HOLD,blockers:['STRESSED_OPEX_INVALID'],warnings,results});

    const stressedNoi=stressedRevenue-stressedOpex;
    const stressedCap=baseCap+capRateShock;
    if(!finite(stressedCap)||stressedCap<=0) return freeze({version:STRESS_TEST_VERSION,status:STRESS_STATUS.HOLD,blockers:['STRESSED_CAP_RATE_INVALID'],warnings,results});
    const stressedValue=stressedNoi/stressedCap;
    if(!finite(stressedValue)) return freeze({version:STRESS_TEST_VERSION,status:STRESS_STATUS.HOLD,blockers:['STRESSED_VALUE_INVALID'],warnings,results});
    const valueDecline=(base.valueSar-stressedValue)/base.valueSar;

    const debtService=hasOwn(base,'annualDebtServiceSar')&&base.annualDebtServiceSar!==undefined&&base.annualDebtServiceSar!==null?base.annualDebtServiceSar*(1+debtServiceShock):null;
    if(debtService!==null&&(!finite(debtService)||debtService<0)) return freeze({version:STRESS_TEST_VERSION,status:STRESS_STATUS.HOLD,blockers:['STRESSED_DEBT_SERVICE_INVALID'],warnings,results});
    const dscr=debtService!==null&&debtService>0?stressedNoi/debtService:null;
    if(dscr!==null&&!finite(dscr)) return freeze({version:STRESS_TEST_VERSION,status:STRESS_STATUS.HOLD,blockers:['STRESSED_DSCR_INVALID'],warnings,results});

    const breached=[];
    if(valueDecline>thresholds.maxValueDecline) breached.push('MAX_VALUE_DECLINE');
    if(dscr!==null&&dscr<thresholds.minDscr) breached.push('MIN_DSCR');
    if(stressedNoi<=0) breached.push('NON_POSITIVE_NOI');
    if(breached.length) warnings.push(`SCENARIO_${scenario.id}_BREACH`);
    results.push({id:scenario.id,stressedRevenueSar:stressedRevenue,stressedOpexSar:stressedOpex,stressedNoiSar:stressedNoi,stressedCapRate:stressedCap,stressedValueSar:stressedValue,valueDecline,stressedDebtServiceSar:debtService,stressedOccupancyRate,dscr,breached});
  }
  return freeze({version:STRESS_TEST_VERSION,status:warnings.length?STRESS_STATUS.REVIEW_REQUIRED:STRESS_STATUS.QUALIFIED,blockers:[],warnings:[...new Set(warnings)],results,thresholds,semantics:'Deterministic stress results are bounded risk diagnostics, not forecasts or transaction authority. Provided base values and scenario shocks are validated fail-closed; multiplicative shocks cannot reduce revenue, occupancy, operating expense, or debt service below zero.'});
}

module.exports={STRESS_TEST_VERSION,STRESS_STATUS,runDeterministicStressTest};
