'use strict';

const {ASSET_CLASS}=require('../project-model/project-profile');
const MODEL_VERSION='PERSONAL_LIMITED_PROPERTY_INTEREST_DCF_V1';
const RIGHTS=Object.freeze({LEASEHOLD:'LEASEHOLD',USUFRUCT:'USUFRUCT',WAQF_RESTRICTED:'WAQF_RESTRICTED'});
const STATUS=Object.freeze({HOLD:'HOLD_PROPERTY_RIGHT_AND_CASHFLOW',RESEARCH:'PERSONAL_RIGHT_INTEREST_CASHFLOW_RESEARCH'});
function finite(n,max=1e13){return typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=max;}
function validDate(x){if(typeof x!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(x))return false;
 const n=new Date(x+'T00:00:00Z');return Number.isFinite(n.getTime())&&n.toISOString().slice(0,10)===x;}
function cloneFreeze(x){if(x&&typeof x==='object'){for(const y of Object.values(x))cloneFreeze(y);Object.freeze(x);}return x;}
function hold(reasonCodes){
 return cloneFreeze({version:MODEL_VERSION,status:STATUS.HOLD,reasonCodes,
  propertyCashflowPvSar:null,ownerInvestmentNpvAfterUpfrontSar:null,
  periods:[],propertyInterestMarketValueEstablished:false,
  legalTransferabilityIndependentlyVerified:false,professionalValuationCertified:false,
  purchaseAuthorized:false,terminalReversionAssumed:false});
}
function assessLimitedPropertyInterest({
 assetClass,propertyRight,valuationDate,termYears,annualPropertyIncomeSar,
 annualPropertyOperatingExpenseSar,annualGroundRentSar,annualSustainingCapexSar,
 incomeEscalationRate,operatingExpenseEscalationRate,groundRentEscalationRate,
 nominalDiscountRate,upfrontRightConsiderationSar,
 termsCheckedAgainstContract=false,propertyOnlyCashflowsConfirmed=false,
 improvementOwnershipAtTermEnd=false,assignabilityRequiresConsent=false,
 consentEvidenceIndependentlyVerified=false,
}={}){
 const bad=[];
 if(!Object.values(ASSET_CLASS).includes(assetClass))bad.push('UNKNOWN_ASSET_CLASS');
 if(!Object.values(RIGHTS).includes(propertyRight))bad.push('LIMITED_PROPERTY_RIGHT_REQUIRED');
 if(!validDate(valuationDate))bad.push('VALUATION_DATE_REQUIRED');
 if(!Number.isSafeInteger(termYears)||termYears<1||termYears>80)bad.push('REMAINING_RIGHT_TERM_1_TO_80_YEARS_REQUIRED');
 for(const [key,n] of Object.entries({
  annualPropertyIncomeSar,annualPropertyOperatingExpenseSar,annualGroundRentSar,
  annualSustainingCapexSar,upfrontRightConsiderationSar,
 }))if(!finite(n))bad.push('INVALID_AMOUNT_'+key);
 if(!finite(annualPropertyIncomeSar)||annualPropertyIncomeSar<=0)
  bad.push('PROPERTY_REVENUE_REQUIRED');
 const rates={incomeEscalationRate,operatingExpenseEscalationRate,groundRentEscalationRate};
 for(const [key,n] of Object.entries(rates))
  if(typeof n!=='number'||!Number.isFinite(n)||n< -0.5||n>0.5)bad.push('INVALID_ESCALATION_'+key);
 if(typeof nominalDiscountRate!=='number'||!Number.isFinite(nominalDiscountRate)||
  nominalDiscountRate<=0||nominalDiscountRate>0.75)bad.push('INVALID_NOMINAL_DISCOUNT_RATE');
 if(!termsCheckedAgainstContract)bad.push('CONTRACTUAL_TERM_AND_OBLIGATIONS_NOT_DECLARED_REVIEWED');
 if(!propertyOnlyCashflowsConfirmed)bad.push('PROPERTY_REVENUE_EXCLUDING_OPERATING_BUSINESS_NOT_CONFIRMED');
 if(improvementOwnershipAtTermEnd)bad.push('IMPROVEMENT_REVERSION_REQUIRES_SEPARATE_VERIFIED_MODEL');
 if(assignabilityRequiresConsent&&!consentEvidenceIndependentlyVerified)
  bad.push('ASSIGNABILITY_CONSENT_NOT_ESTABLISHED');
 if(propertyRight===RIGHTS.WAQF_RESTRICTED)
  bad.push('WAQF_RESTRICTED_INTEREST_REQUIRES_INDEPENDENT_LEGAL_REVIEW');
 if(bad.length)return hold(bad);
 let income=annualPropertyIncomeSar,opex=annualPropertyOperatingExpenseSar,
 ground=annualGroundRentSar;
 const flows=[];
 let presentValue=0;
 for(let y=1;y<=termYears;y++){
  const netBeforeCapex=income-opex-ground;
  const netCashflow=netBeforeCapex-annualSustainingCapexSar;
  const discounted=netCashflow/(1+nominalDiscountRate)**y;
  if(!Number.isFinite(netCashflow)||!Number.isFinite(discounted)||
    Math.abs(netCashflow)>1e15||Math.abs(discounted)>1e15)
   return hold(['NON_FINITE_RIGHTS_CASHFLOW']);
  flows.push({year:y,incomeSar:income,opexSar:opex,groundRentSar:ground,
   sustainingCapexSar:annualSustainingCapexSar,netSar:netCashflow,
   discountedNetSar:discounted});
  presentValue+=discounted;
  income*=1+incomeEscalationRate;
  opex*=1+operatingExpenseEscalationRate;
  ground*=1+groundRentEscalationRate;
 }
 const ownerNpv=presentValue-upfrontRightConsiderationSar;
 if(!Number.isFinite(ownerNpv)||Math.abs(ownerNpv)>1e15)return hold(['NON_FINITE_RIGHTS_NPV']);
 return cloneFreeze({
  version:MODEL_VERSION,status:STATUS.RESEARCH,reasonCodes:[
   'ASSUMPTIONS_USER_SUPPLIED_NOT_INDEPENDENTLY_VERIFIED',
   'TERMINAL_REVERSION_NOT_ASSUMED',
   'CONTRACTUAL_AND_LEGAL_RISK_REVIEW_REQUIRED',
  ],assetClass,propertyRight,valuationDate,termYears,
  nominalDiscountRate,periods:flows,
  propertyCashflowPvSar:presentValue,upfrontRightConsiderationSar,
  ownerInvestmentNpvAfterUpfrontSar:ownerNpv,
  positiveInvestmentNpv:ownerNpv>0,
  propertyInterestMarketValueEstablished:false,
  legalTransferabilityIndependentlyVerified:false,
  professionalValuationCertified:false,purchaseAuthorized:false,
  terminalReversionAssumed:false,
  semantics:'Dated, fixed-term, undiscounted nominal source cashflows and annual discounted owner interest. Assumes no reversion value and no automatic renewal. This is not market value or legal approval.',
 });
}
module.exports={MODEL_VERSION,RIGHTS,STATUS,assessLimitedPropertyInterest};
