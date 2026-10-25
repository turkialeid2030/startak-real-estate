'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {RIGHTS,STATUS,assessLimitedPropertyInterest:run}=require('../../src/valuation-intelligence/personal-limited-interest-dcf');
let checks=0;
const eq=(x,y)=>{assert.deepEqual(x,y);checks++};
const near=(x,y)=>{assert.ok(Math.abs(x-y)<1e-6,`${x} != ${y}`);checks++};
const base={
 assetClass:'RETAIL',propertyRight:RIGHTS.LEASEHOLD,
 valuationDate:'2026-10-25',termYears:2,annualPropertyIncomeSar:1200,
 annualPropertyOperatingExpenseSar:100,annualGroundRentSar:100,
 annualSustainingCapexSar:100,incomeEscalationRate:0,
 operatingExpenseEscalationRate:0,groundRentEscalationRate:0,
 nominalDiscountRate:0.1,upfrontRightConsiderationSar:100,
 termsCheckedAgainstContract:true,propertyOnlyCashflowsConfirmed:true,
 improvementOwnershipAtTermEnd:false,
 assignabilityRequiresConsent:false,consentDocumentUserDeclared:false,
};
const good=run(base);
eq(good.status,STATUS.RESEARCH);
near(good.propertyCashflowPvSar,900/1.1+900/1.21);
near(good.ownerInvestmentNpvAfterUpfrontSar,900/1.1+900/1.21-100);
eq(good.periods.length,2);
eq(good.periods[0].netSar,900);
eq(good.terminalReversionAssumed,false);
eq(good.purchaseAuthorized,false);
eq(good.professionalValuationCertified,false);
eq(good.legalTransferabilityIndependentlyVerified,false);
eq(Object.isFrozen(good.periods[0]),true);
function held(modifications,reason){
 const r=run({...base,...modifications});
 eq(r.status,STATUS.HOLD);
 assert.ok(r.reasonCodes.includes(reason),JSON.stringify(r.reasonCodes));checks++;
 eq(r.ownerInvestmentNpvAfterUpfrontSar,null);
 eq(r.propertyCashflowPvSar,null);
}
held({propertyRight:RIGHTS.WAQF_RESTRICTED},
 'WAQF_RESTRICTED_INTEREST_REQUIRES_INDEPENDENT_LEGAL_REVIEW');
held({propertyRight:'FREEHOLD'},'LIMITED_PROPERTY_RIGHT_REQUIRED');
held({termYears:0},'REMAINING_RIGHT_TERM_1_TO_80_YEARS_REQUIRED');
held({termYears:81},'REMAINING_RIGHT_TERM_1_TO_80_YEARS_REQUIRED');
held({termYears:2.5},'REMAINING_RIGHT_TERM_1_TO_80_YEARS_REQUIRED');
held({valuationDate:'2026-02-30'},'VALUATION_DATE_REQUIRED');
held({nominalDiscountRate:0},'INVALID_NOMINAL_DISCOUNT_RATE');
held({nominalDiscountRate:1},'INVALID_NOMINAL_DISCOUNT_RATE');
held({annualPropertyIncomeSar:-1},'INVALID_AMOUNT_annualPropertyIncomeSar');
held({annualGroundRentSar:-1},'INVALID_AMOUNT_annualGroundRentSar');
held({annualSustainingCapexSar:-1},'INVALID_AMOUNT_annualSustainingCapexSar');
held({incomeEscalationRate:-0.9},'INVALID_ESCALATION_incomeEscalationRate');
held({termsCheckedAgainstContract:false},'CONTRACTUAL_TERM_AND_OBLIGATIONS_NOT_DECLARED_REVIEWED');
held({propertyOnlyCashflowsConfirmed:false},'PROPERTY_REVENUE_EXCLUDING_OPERATING_BUSINESS_NOT_CONFIRMED');
held({improvementOwnershipAtTermEnd:true},'IMPROVEMENT_REVERSION_REQUIRES_SEPARATE_VERIFIED_MODEL');
held({assignabilityRequiresConsent:true},'ASSIGNABILITY_CONSENT_NOT_ESTABLISHED');
const consent=run({...base,assignabilityRequiresConsent:true,consentDocumentUserDeclared:true});
eq(consent.status,STATUS.RESEARCH);
eq(consent.legalTransferabilityIndependentlyVerified,false);
const negative=run({...base,annualGroundRentSar:1500});
eq(negative.status,STATUS.RESEARCH);
assert.ok(negative.ownerInvestmentNpvAfterUpfrontSar<0);checks++;
const increasing=run({...base,incomeEscalationRate:0.1});
eq(increasing.status,STATUS.RESEARCH);
near(increasing.periods[1].incomeSar,1320);
eq(increasing.periods[1].opexSar,100);
for(const klass of ['LAND','RESIDENTIAL','OFFICE','RETAIL','INDUSTRIAL_LOGISTICS','HOSPITALITY','HEALTHCARE','EDUCATION','MIXED_USE','PARKING','DATA_CENTER','SPECIAL_PURPOSE','OTHER']){
 const r=run({...base,assetClass:klass,propertyRight:RIGHTS.USUFRUCT});
 eq(r.status,STATUS.RESEARCH);
 eq(r.professionalValuationCertified,false);
}
const ui=fs.readFileSync(path.resolve(__dirname,'../../src/components/PersonalLimitedInterestDcfPanel.jsx'),'utf8');
const host=fs.readFileSync(path.resolve(__dirname,'../../src/components/PersonalAssetUniversePanel.jsx'),'utf8');
assert.match(ui,/data-testid="limited-interest-calculate"/);checks++;
assert.match(ui,/data-testid="limited-interest-result"/);checks++;
assert.match(ui,/right===RIGHTS.WAQF_RESTRICTED|RIGHTS.WAQF_RESTRICTED/);checks++;
assert.match(ui,/type="checkbox" style=\{\{width:28,height:28/);checks++;
assert.match(host,/<PersonalLimitedInterestDcfPanel key=\{assetClass\+'-rights'\}/);checks++;
console.log('LIMITED_PROPERTY_INTEREST_DCF_V1=PASS checks='+checks);
