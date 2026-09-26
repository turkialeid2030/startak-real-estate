'use strict';

const MONTE_CARLO_VERSION = 'MONTE_CARLO_RISK_V3';
const MONTE_CARLO_STATUS = Object.freeze({ QUALIFIED: 'QUALIFIED', REVIEW_REQUIRED: 'REVIEW_REQUIRED', HOLD: 'HOLD' });
function freeze(v){if(v&&typeof v==='object'&&!Object.isFrozen(v)){Object.freeze(v);Object.values(v).forEach(freeze);}return v;}
function finite(v){return typeof v==='number'&&Number.isFinite(v);}
function probability(v){return finite(v)&&v>=0&&v<=1;}
function mulberry32(seed){let a=seed>>>0;return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
function normal(rng){let u=0,v=0;while(u===0)u=rng();while(v===0)v=rng();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v);}
function sample(rng,d){if(!d||!d.type)return NaN;if(d.type==='fixed')return d.value;if(d.type==='uniform')return d.min+rng()*(d.max-d.min);if(d.type==='normal')return d.mean+normal(rng)*d.sd;if(d.type==='triangular'){const u=rng(),f=(d.mode-d.min)/(d.max-d.min);return u<f?d.min+Math.sqrt(u*(d.max-d.min)*(d.mode-d.min)):d.max-Math.sqrt((1-u)*(d.max-d.min)*(d.max-d.mode));}return NaN;}
function validDistribution(d){if(!d||typeof d!=='object')return false;if(d.type==='fixed')return finite(d.value);if(d.type==='uniform')return finite(d.min)&&finite(d.max)&&d.max>=d.min;if(d.type==='normal')return finite(d.mean)&&finite(d.sd)&&d.sd>=0;if(d.type==='triangular')return finite(d.min)&&finite(d.mode)&&finite(d.max)&&d.min<=d.mode&&d.mode<=d.max&&d.max>d.min;return false;}
function percentile(sorted,p){if(!sorted.length)return null;const i=(sorted.length-1)*p,lo=Math.floor(i),hi=Math.ceil(i);return lo===hi?sorted[lo]:sorted[lo]+(sorted[hi]-sorted[lo])*(i-lo);}
function periodicNpv(rate,cashflows){if(!finite(rate)||rate<=-1||!Array.isArray(cashflows)||!cashflows.length)return NaN;return cashflows.reduce((sum,amount,t)=>sum+amount/Math.pow(1+rate,t),0);}
function solvePeriodicIrr(cashflows,{rateTolerance=1e-12,npvTolerance=null,maxIterations=300}={}){
  if(!Array.isArray(cashflows)||cashflows.length<2||cashflows.some(v=>!finite(v))||!cashflows.some(v=>v<0)||!cashflows.some(v=>v>0))return null;
  const scale=cashflows.reduce((s,v)=>s+Math.abs(v),0),effectiveNpvTolerance=npvTolerance===null?Math.max(.01,scale*1e-10):npvTolerance;
  if(!finite(rateTolerance)||rateTolerance<=0||!finite(effectiveNpvTolerance)||effectiveNpvTolerance<=0||!Number.isInteger(maxIterations)||maxIterations<1)return null;
  let lo=-0.9999,hi=1,flo=periodicNpv(lo,cashflows),fhi=periodicNpv(hi,cashflows);
  if(!finite(flo)||!finite(fhi))return null;
  if(Math.abs(flo)<=effectiveNpvTolerance)return lo;if(Math.abs(fhi)<=effectiveNpvTolerance)return hi;
  let expansions=0;while(Math.sign(flo)===Math.sign(fhi)&&hi<1e6&&expansions<60){hi=hi*2+1;fhi=periodicNpv(hi,cashflows);if(!finite(fhi))return null;expansions++;}
  if(Math.sign(flo)===Math.sign(fhi))return null;
  for(let i=0;i<maxIterations;i++){
    const mid=(lo+hi)/2,fmid=periodicNpv(mid,cashflows);if(!finite(fmid))return null;
    if(Math.abs(fmid)<=effectiveNpvTolerance)return mid;
    if(Math.abs(hi-lo)<=rateTolerance)return Math.abs(fmid)<=effectiveNpvTolerance?mid:null;
    if(Math.sign(fmid)===Math.sign(flo)){lo=mid;flo=fmid;}else{hi=mid;fhi=fmid;}
  }
  return null;
}
function runGovernedMonteCarlo({seed,iterations,base,distributions,thresholds}={}){
  const blockers=[];
  if(!Number.isInteger(seed)||seed<0)blockers.push('REPRODUCIBLE_SEED_REQUIRED');
  if(!Number.isInteger(iterations)||iterations<100||iterations>100000)blockers.push('ITERATIONS_OUT_OF_RANGE');
  if(!base||!finite(base.initialInvestmentSar)||base.initialInvestmentSar<=0||!finite(base.baseNoiSar)||base.baseNoiSar<=0||!Number.isInteger(base.horizonYears)||base.horizonYears<1)blockers.push('VALID_BASE_CASE_REQUIRED');
  if(base&&base.annualDebtServiceSar!==undefined&&(!finite(base.annualDebtServiceSar)||base.annualDebtServiceSar<0))blockers.push('ANNUAL_DEBT_SERVICE_INVALID');
  const required=['noiGrowth','exitCapRate','discountRate'];
  if(!distributions||required.some(k=>!validDistribution(distributions[k])))blockers.push('VALID_GOVERNED_DISTRIBUTIONS_REQUIRED');
  if(!thresholds||!finite(thresholds.hurdleIrr)||thresholds.hurdleIrr<=-1||!finite(thresholds.minDscr)||thresholds.minDscr<0||!probability(thresholds.maxProbabilityNpvNegative)||!probability(thresholds.maxProbabilityIrrBelowHurdle)||!probability(thresholds.maxProbabilityDscrBreach))blockers.push('GOVERNED_THRESHOLDS_REQUIRED');
  if(blockers.length)return freeze({version:MONTE_CARLO_VERSION,status:MONTE_CARLO_STATUS.HOLD,blockers,warnings:[],summary:null});
  const rng=mulberry32(seed),npvs=[],irrs=[],dscrs=[];let npvNeg=0,irrBreach=0,dscrBreach=0,invalid=0;
  const debt=base.annualDebtServiceSar>0?base.annualDebtServiceSar:null;
  const npvClassificationToleranceSar=Math.max(.01,base.initialInvestmentSar*1e-9);
  const irrClassificationTolerance=Math.max(1e-12,Math.abs(thresholds.hurdleIrr)*1e-10);
  for(let n=0;n<iterations;n++){
    const g=sample(rng,distributions.noiGrowth),exitCap=sample(rng,distributions.exitCapRate),disc=sample(rng,distributions.discountRate);
    if(!finite(g)||g<=-1||!finite(exitCap)||exitCap<=0||!finite(disc)||disc<=-1){invalid++;continue;}
    let noi=base.baseNoiSar,minDscr=Infinity;const periodicCashflows=[-base.initialInvestmentSar];
    for(let y=1;y<=base.horizonYears;y++){
      noi*=1+g;if(debt)minDscr=Math.min(minDscr,noi/debt);
      const terminal=y===base.horizonYears?noi/exitCap:0;
      periodicCashflows.push(noi+terminal);
    }
    const npv=periodicNpv(disc,periodicCashflows),irr=solvePeriodicIrr(periodicCashflows);
    if(!finite(npv)||irr===null||!finite(irr)){invalid++;continue;}
    npvs.push(npv);irrs.push(irr);if(debt)dscrs.push(minDscr);
    if(npv < -npvClassificationToleranceSar)npvNeg++;
    if(irr < thresholds.hurdleIrr-irrClassificationTolerance)irrBreach++;
    if(debt&&minDscr<thresholds.minDscr)dscrBreach++;
  }
  if(invalid>0||npvs.length!==iterations)return freeze({version:MONTE_CARLO_VERSION,status:MONTE_CARLO_STATUS.HOLD,blockers:['INVALID_SIMULATION_DRAW'],warnings:[],invalidDraws:invalid,summary:null});
  npvs.sort((a,b)=>a-b);irrs.sort((a,b)=>a-b);dscrs.sort((a,b)=>a-b);
  const pNpv=npvNeg/iterations,pIrr=irrBreach/iterations,pDscr=debt?dscrBreach/iterations:null,warnings=[];
  if(pNpv>thresholds.maxProbabilityNpvNegative)warnings.push('NPV_NEGATIVE_PROBABILITY_BREACH');
  if(pIrr>thresholds.maxProbabilityIrrBelowHurdle)warnings.push('IRR_HURDLE_PROBABILITY_BREACH');
  if(pDscr!==null&&pDscr>thresholds.maxProbabilityDscrBreach)warnings.push('DSCR_BREACH_PROBABILITY_BREACH');
  return freeze({version:MONTE_CARLO_VERSION,status:warnings.length?MONTE_CARLO_STATUS.REVIEW_REQUIRED:MONTE_CARLO_STATUS.QUALIFIED,seed,iterations,blockers:[],warnings,numericalTolerances:{npvClassificationToleranceSar,irrClassificationTolerance},summary:{npvSar:{p05:percentile(npvs,.05),p50:percentile(npvs,.5),p95:percentile(npvs,.95),probabilityNegative:pNpv},irr:{method:'EXACT_PERIODIC_IRR',p05:percentile(irrs,.05),p50:percentile(irrs,.5),p95:percentile(irrs,.95),probabilityBelowHurdle:pIrr},dscr:debt?{p05:percentile(dscrs,.05),p50:percentile(dscrs,.5),p95:percentile(dscrs,.95),probabilityBelowMinimum:pDscr}:null},semantics:'Seeded Monte Carlo is a governed uncertainty diagnostic using exact annual-period IRR over the simulated cash-flow stream. Numerical noise within disclosed tolerances is not classified as an economic breach. It is not a forecast, certified valuation, investment approval, or transaction authority.'});
}
module.exports={MONTE_CARLO_VERSION,MONTE_CARLO_STATUS,periodicNpv,solvePeriodicIrr,runGovernedMonteCarlo};
