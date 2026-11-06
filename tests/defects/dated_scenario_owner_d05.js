'use strict';
const assert=require('node:assert/strict');
const {reviewOwnerDatedScenario}=require('../../src/valuation-intelligence/dated-scenario-review');
let checks=0;const ok=(value,message)=>{assert.ok(value,message);checks++};
const rows=[
 {date:'2026-01-01',amount:'-1,000',sourceReference:'synthetic/acquisition'},
 {date:'2027-01-01',amount:'١٬١٠٠',sourceReference:'synthetic/sale'}
];
let r=reviewOwnerDatedScenario({rows,annualDiscountRate:'0.1'});
ok(r.status.startsWith('HOLD'),'no consent => HOLD');
ok(r.blockers.includes('EXPLICIT_DATA_RIGHTS_AND_EVIDENCE_ATTESTATION_REQUIRED'),'explicit attestation required');
r=reviewOwnerDatedScenario({rows,annualDiscountRate:'٠٫١',rightsConfirmed:true});
ok(r.status==='UNVERIFIED_DATED_SCENARIO_CALCULATED','valid synthetic case can be calculated');
ok(Math.abs(r.xirr-0.1000696569738)<1e-7,'ACT/365.2425 dated return independently characterized');
ok(Number.isFinite(r.xnpvSar),'XNPV finite');
ok(r.canonicalReturnsChanged===false&&r.boundToCanonicalFinancialStudy===false,
 'standalone reviewer can never rewrite annual canonical outputs');
ok(r.transactionAuthorized===false&&r.professionalValuationAuthorized===false&&
 r.independentlyVerified===false,'scenario has no certification or transaction authority');
ok(r.sourceReferencesUserAttested===true,'source claims distinguished from independent verification');
for(const bad of [
 {rows:[rows[0]],annualDiscountRate:'0.1',rightsConfirmed:true},
 {rows:[{...rows[0],sourceReference:''},rows[1]],annualDiscountRate:'0.1',rightsConfirmed:true},
 {rows:[{...rows[0],date:'2026-02-30'},rows[1]],annualDiscountRate:'0.1',rightsConfirmed:true},
 {rows:[{...rows[0],amount:'1e3'},rows[1]],annualDiscountRate:'0.1',rightsConfirmed:true},
 {rows,annualDiscountRate:'١٨٠٠٫٥٫٢',rightsConfirmed:true},
 {rows,annualDiscountRate:'-1',rightsConfirmed:true},
 {rows,annualDiscountRate:'10',rightsConfirmed:true},
 {rows,annualDiscountRate:'1',rightsConfirmed:true},
 {rows,annualDiscountRate:'',rightsConfirmed:true},
 {rows:[{...rows[0],amount:'1000'},rows[1]],annualDiscountRate:'0.10',rightsConfirmed:true},
 {rows:[{...rows[0],date:'2027-01-01'},rows[1]],annualDiscountRate:'0.1',rightsConfirmed:true}
]){const res=reviewOwnerDatedScenario(bad);
 ok(res.status.startsWith('HOLD')&&res.xirr===null&&res.xnpvSar===null,'invalid input fails closed');}
ok(reviewOwnerDatedScenario({rows:[...rows,...Array(40).fill(rows[1])],annualDiscountRate:'.1',rightsConfirmed:true}).status.startsWith('HOLD'),
 'oversized dated scenario fails closed');
const ambig=reviewOwnerDatedScenario({rows:[
 {date:'2026-01-01',amount:'-1000',sourceReference:'a'},
 {date:'2027-01-01',amount:'3000',sourceReference:'b'},
 {date:'2028-01-01',amount:'-2200',sourceReference:'c'},
],annualDiscountRate:'0.1',rightsConfirmed:true});
ok(ambig.status.startsWith('HOLD')&&ambig.blockers.includes('SOLVER_MULTIPLE_IRR_AMBIGUITY'),
 'multiple IRRs must not be hidden behind one rate');
console.log('D05_OWNER_DATED_SCENARIO_SEPARATE_FROM_CANONICAL=PASS checks='+checks);
