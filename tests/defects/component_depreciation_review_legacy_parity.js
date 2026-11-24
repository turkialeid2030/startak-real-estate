'use strict';
const assert=require('node:assert/strict');
const {PROPERTY_EVIDENCE_PACKET_STATUS}=require('../../src/property/property-evidence-bridge');
const {COST_BASIS,COST_COMPONENT_CLASS,COST_SOURCE_CLASS,COST_VERIFICATION_STATUS,LAND_VALUE_METHOD_REFERENCE,
 DEPRECIATION_TYPE:T,DEPRECIATION_METHOD:M,createCostComponentRecord,createProfessionalLandValueInput,createDepreciationRecord,
 buildCostApproachInputPacket}=require('../../src/cost/cost-approach-inputs');
const {calculateCostApproachIndication}=require('../../src/engines/valuation/cost-approach');
const {assessCostDepreciationAttribution:assess,STATUS}=require('../../src/cost/component-depreciation-review');
const scope={caseId:'SYNTH-C59',propertyRef:'SYNTH-PROPERTY'},date='2026-10-20',asOf='2026-10-29';
const review={preparedByRef:'SYNTH-PREPARER',preparedAt:date,reviewedByRef:'SYNTH-REVIEWER',reviewedAt:date,reviewEvidenceRef:'SYNTH-REVIEW'};
const component=(id,componentClass,unitCostSar)=>createCostComponentRecord({...scope,componentId:id,componentClass,description:'synthetic',quantity:1,unit:'item',unitCostSar,
 costBasis:COST_BASIS.REPLACEMENT_COST_NEW,sourceClass:COST_SOURCE_CLASS.VERIFIED_QUANTITY_SURVEY,sourceName:'synthetic',sourceRef:'SYNTH-COST',sourceDate:date,capturedAt:date,
 verification:{status:COST_VERIFICATION_STATUS.VERIFIED,verifiedByRef:'SYNTH-REVIEWER',verifiedAt:date,verificationEvidenceRef:'SYNTH-CHECK'}});
const land=createProfessionalLandValueInput({...scope,...review,landValueId:'SYNTH-LAND',valueSar:500000,methodReference:LAND_VALUE_METHOD_REFERENCE.SALES_COMPARISON,
 rationale:'synthetic',evidenceRefs:['SYNTH-LAND-EVIDENCE'],valuationDate:date});
const dep=(id,type,method,magnitude)=>createDepreciationRecord({...scope,...review,depreciationId:id,type,method,magnitude,rationale:'synthetic',evidenceRefs:['SYNTH-DEP']});
const packet=buildCostApproachInputPacket({...scope,packetId:'SYNTH-PACKET',valuationDate:date,
 propertyEvidencePacket:{...scope,status:PROPERTY_EVIDENCE_PACKET_STATUS.READY_FOR_PROFESSIONAL_VALUATION_WORKFLOW,professionalValuationWorkflowReady:true,packetHashSha256:'a'.repeat(64)},
 costComponents:[component('structure',COST_COMPONENT_CLASS.STRUCTURE,700000),component('mep',COST_COMPONENT_CLASS.MEP,300000)],landValueInput:land,
 depreciationRecords:[dep('physical',T.PHYSICAL_INCURABLE,M.PERCENT_OF_IMPROVEMENT_COST_NEW,0.2),dep('external',T.EXTERNAL_OBSOLESCENCE,M.AMOUNT_SAR,50000)],
 allowedCostSourceClasses:[COST_SOURCE_CLASS.VERIFIED_QUANTITY_SURVEY],maxCostSourceAgeDays:365,preparedByRef:'SYNTH-PREPARER',preparedAt:date,packetEvidenceRef:'SYNTH-PACKET-REF'});
const common={...scope,evidenceRef:'SYNTH-CAUSE',reviewedByRef:'SYNTH-REVIEWER',reviewEvidenceRef:'SYNTH-REVIEW',reviewedAt:date};
const allocations=[
 {...common,depreciationId:'physical',componentId:'structure',depreciationType:T.PHYSICAL_INCURABLE,causeId:'age',amountSar:140000,curabilityBasisRef:'SYNTH-AGE'},
 {...common,depreciationId:'physical',componentId:'mep',depreciationType:T.PHYSICAL_INCURABLE,causeId:'age',amountSar:60000,curabilityBasisRef:'SYNTH-AGE'},
 {...common,depreciationId:'external',componentId:'structure',depreciationType:T.EXTERNAL_OBSOLESCENCE,causeId:'market',amountSar:50000,externalMarketImpactRef:'SYNTH-MARKET'},
];
const omissionReviews=[T.PHYSICAL_CURABLE,T.FUNCTIONAL_CURABLE,T.FUNCTIONAL_INCURABLE].map(type=>({...common,type,rationale:'synthetic absence review'}));
const ageLifeChecks=[{...scope,componentId:'structure',effectiveAgeYears:10,totalEconomicLifeYears:50,inspectorEvidenceRef:'SYNTH-AGE',reviewerRef:'SYNTH-REVIEWER'}];
const args={packet,allocations,omissionReviews,ageLifeChecks,asOf};
const result=assess(args),canonical=calculateCostApproachIndication(packet);
assert.equal(result.status,STATUS.READY_FOR_INDEPENDENT_PROFESSIONAL_REVIEW);
assert.equal(result.costApproachValueIndicationSar,1250000);
assert.equal(result.costApproachValueIndicationSar,canonical.costApproachValueIndicationSar);
assert.equal(result.canonicalCostResultHashSha256,canonical.calculationHashSha256);
assert.equal(result.accruedDepreciationSar,250000);
assert.equal(result.componentDepreciationTrace.reduce((s,r)=>s+r.residualImprovementValueSar,0),750000);
assert.equal(result.ageLifeDiagnosticOnly[0].estimatedPhysicalLossForDiagnosisOnlySar,140000);
for(const key of ['transactionAuthorized','certifiedValuationEstablished','productionDecisionAuthorized','sourceAuthenticityIndependentlyVerified'])assert.equal(result[key],false);
assert.equal(assess(args).resultHashSha256,result.resultHashSha256);
const cases=[
 [{packet:{...packet,landValueInput:{...packet.landValueInput,valueSar:1}}},'INVALID_CANONICAL_COST_INPUT_PACKET'],
 [{asOf:'2026-02-30'},'ASOF_NOT_VALID_OR_BEFORE_VALUATION'],
 [{asOf:'2026-10-19'},'ASOF_NOT_VALID_OR_BEFORE_VALUATION'],
 [{allocations:[{...allocations[0],caseId:'OTHER'},...allocations.slice(1)]},'ALLOCATION_CASE_OR_PROPERTY_MISMATCH'],
 [{allocations:[{...allocations[0],amountSar:139999},...allocations.slice(1)]},'ALLOCATION_NOT_RECONCILED_TO_CANONICAL_DEPRECIATION'],
 [{allocations:[...allocations,allocations[0]]},'DUPLICATED_CAUSE_ON_SAME_COMPONENT'],
 [{allocations:[...allocations.slice(0,2),{...allocations[2],causeId:'age'}]},'DOUBLE_COUNT_CAUSE_BETWEEN_DEPRECIATION_TYPES'],
 [{allocations:[...allocations.slice(0,2),{...allocations[2],externalMarketImpactRef:''}]},'EXTERNAL_MARKET_IMPACT_EVIDENCE_REQUIRED'],
 [{allocations:[{...allocations[0],reviewedAt:'2026-02-30'},...allocations.slice(1)]},'MISSING_CAUSAL_PROFESSIONAL_EVIDENCE'],
 [{omissionReviews:omissionReviews.slice(1)},'LOSS_CLASS_UNREVIEWED'],
 [{omissionReviews:[{...omissionReviews[0],propertyRef:'OTHER'},...omissionReviews.slice(1)]},'OMISSION_CASE_OR_PROPERTY_MISMATCH'],
 [{ageLifeChecks:[{...ageLifeChecks[0],effectiveAgeYears:51}]},'AGE_LIFE_EVIDENCE_OR_RANGE_INVALID'],
 [{ageLifeChecks:[{...ageLifeChecks[0],propertyRef:'OTHER'}]},'AGE_LIFE_CASE_OR_PROPERTY_MISMATCH'],
];
for(const [patch,code] of cases){const r=assess({...args,...patch});assert.equal(r.status,STATUS.HOLD,code);assert.ok(r.blockers.some(x=>x.startsWith(code)),code);assert.equal(r.transactionAuthorized,false);}
console.log('C59_COMPONENT_DEPRECIATION_PARITY=PASS synthetic_only=true authority=false negative_cases='+cases.length);
