'use strict';

const MONTE_CARLO_VERSION = 'MONTE_CARLO_RISK_V1';
const MONTE_CARLO_STATUS = Object.freeze({ QUALIFIED: 'QUALIFIED', REVIEW_REQUIRED: 'REVIEW_REQUIRED', HOLD: 'HOLD' });
function freeze(v){if(v&&typeof v==='object'&&!Object.isFrozen(v)){Object.freeze(v);Object.values(v).forEach(freeze);}return v;}
function finite(v){return typeof v==='number'&&Number.isFinite(v);}
function probability(v){return finite(v)&&v>=0&&v<=1;}
function mulberry32(seed){let a=seed>>>0;return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
function normal(rng){let u=0,v=0;while(u===0)u=rng();while(v===0)v=rng();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v);}
function sample(rng,d){if(!d||!d.type)return NaN;if(d.type==='fixed')return d.value;if(d.type==='uniform')return d.min+rng()*(d.max-d.min);if(d.type==='normal')return d.mean+normal(rng)*d.sd;if(d.type==='triangular'){const u=rng(),f=(d.mode-d.min)/(d.max-d.min);return u<f?d.min+Math.sqrt(u*(d.max-d.min)*(d.mode-d.min)):d.max-Math.sqrt((1-u)*(d.max-d.min)*(d.max-d.mode));}return NaN;}
function validDistribution(d){if(!d||typeof d!=='object')return false;if(d.type==='fixed')return finite(d.value);if(d.type==='uniform')return finite(d.min)&&finite(d.max)&&d.max>=d.min;if(d.type==='normal')return finite(d.mean)&&finite(d.sd)&&d.sd>=0;if(d.type==='triangular')return finite(d.min)&&finite(d.mode)&&finite(d.max)&&d.min<=d.mode&&d.mode<=d.max&&d.max>d.min;return false;}
function percentile(sorted,p){if(!sorted.length)return null;const i=(sorted.length-1)*p,lo=Math.floor(i),hi=Math.ceil(i);return lo===hi?sorted[lo]:sorted[lo]+(sorted[hi]-sorted[lo])*(i-lo);}
function runGovernedMonteCarlo({seed,iterations,base,distributions,thresholds}={}){
  const blockers=[];
  if(!Number.isInteger(seed)||seed<0)blockers.push('REPRODUCIBLE_SEED_REQUIRED');
  if(!Number.isInteger(iterations)||iterations<100||iterations>100000)blockers.push('ITERATIONS_OUT_OF_RANGE');
  if(!base||!finite(base.initialInvestmentSar)||base.initialInvestmentSar<=0||!finite(base.baseNoiSar)||base.baseNoiSar<=0||!Number.isInteger(base.horizonYears)||base.horizonYears<1)blockers.push('VALID_BASE_CASE_REQUIRED');
  const required=['noiGrowth','exitCapRate','discountRate'];
  if(!distributions||required.some(k=>!validDistribution(distributions[k])))blockers.push('VALID_GOVERNED_DISTRIBUTIONS_REQUIRED');
  if(!thresholds||!finite(thresholds.hurdleIrr)||!finite(thresholds.minDscr)||!probability(thresholds.maxProbabilityNpvNegative)||!probability(thresholds.maxProbabilityIrrBelowHurdle)||!probability(thresholds.maxProbabilityDscrBreach))blockers.push('GOVERNED_THRESHOLDS_REQUIRED');
  if(blockers.length)return freeze({version:MONTE_CARLO_VERSION,status:MONTE_CARLO_STATUS.HOLD,blockers,warnings:[],summary:null});
  const rng=mulberry32(seed),npvs=[],irrs=[],dscrs=[];let npvNeg=0,irrBreach=0,dscrBreach=0,invalid=0;
  const debt=finite(base.annualDebtServiceSar)&&base.annualDebtServiceSar>0?base.annualDebtServiceSar:null;
  for(let n=0;n<iterations;n++){
    const g=sample(rng,distributions.noiGrowth),exitCap=sample(rng,distributions.exitCapRate),disc=sample(rng,distributions.discountRate);
    if(!finite(g)||g<=-1||!finite(exitCap)||exitCap<=0||!finite(disc)||disc<=-1){invalid++;continue;}
    let npv=-base.initialInvestmentSar,noi=base.baseNoiSar,minDscr=Infinity;
    for(let y=1;y<=base.horizonYears;y++){noi*=1+g;if(debt)minDscr=Math.min(minDscr,noi/debt);const terminal=y===base.horizonYears?noi/exitCap:0;npv+=(noi+terminal)/Math.pow(1+disc,y);}
    const terminalNoi=base.baseNoiSar*Math.pow(1+g,base.horizonYears),terminalValue=terminalNoi/exitCap,totalFuture=terminalValue+terminalNoi;
    const approxIrr=Math.pow(Math.max(totalFuture,0)/base.initialInvestmentSar,1/base.horizonYears)-1;
    npvs.push(npv);irrs.push(approxIrr);if(debt)dscrs.push(minDscr);if(npv<0)npvNeg++;if(approxIrr<thresholds.hurdleIrr)irrBreach++;if(debt&&minDscr<thresholds.minDscr)dscrBreach++;
  }
  if(invalid>0||npvs.length!==iterations)return freeze({version:MONTE_CARLO_VERSION,status:MONTE_CARLO_STATUS.HOLD,blockers:['INVALID_SIMULATION_DRAW'],warnings:[],invalidDraws:invalid,summary:null});
  npvs.sort((a,b)=>a-b);irrs.sort((a,b)=>a-b);dscrs.sort((a,b)=>a-b);
  const pNpv=npvNeg/iterations,pIrr=irrBreach/iterations,pDscr=debt?dscrBreach/iterations:null,warnings=[];
  if(pNpv>thresholds.maxProbabilityNpvNegative)warnings.push('NPV_NEGATIVE_PROBABILITY_BREACH');
  if(pIrr>thresholds.maxProbabilityIrrBelowHurdle)warnings.push('IRR_HURDLE_PROBABILITY_BREACH');
  if(pDscr!==null&&pDscr>thresholds.maxProbabilityDscrBreach)warnings.push('DSCR_BREACH_PROBABILITY_BREACH');
  return freeze({version:MONTE_CARLO_VERSION,status:warnings.length?MONTE_CARLO_STATUS.REVIEW_REQUIRED:MONTE_CARLO_STATUS.QUALIFIED,seed,iterations,blockers:[],warnings,summary:{npvSar:{p05:percentile(npvs,.05),p50:percentile(npvs,.5),p95:percentile(npvs,.95),probabilityNegative:pNpv},irr:{p05:percentile(irrs,.05),p50:percentile(irrs,.5),p95:percentile(irrs,.95),probabilityBelowHurdle:pIrr},dscr:debt?{p05:percentile(dscrs,.05),p50:percentile(dscrs,.5),p95:percentile(dscrs,.95),probabilityBelowMinimum:pDscr}:null},semantics:'Seeded Monte Carlo is a governed uncertainty diagnostic based on declared distributions; it is not a forecast, certified valuation, investment approval, or transaction authority.'});
}
module.exports={MONTE_CARLO_VERSION,MONTE_CARLO_STATUS,runGovernedMonteCarlo};
