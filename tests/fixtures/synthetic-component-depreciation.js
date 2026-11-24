'use strict';
const {PROPERTY_EVIDENCE_PACKET_STATUS}=require('../../src/property/property-evidence-bridge');
const {COST_BASIS,COST_COMPONENT_CLASS,COST_SOURCE_CLASS,COST_VERIFICATION_STATUS,LAND_VALUE_METHOD_REFERENCE,
 DEPRECIATION_TYPE:T,DEPRECIATION_METHOD:M,createCostComponentRecord,createProfessionalLandValueInput,createDepreciationRecord,
 buildCostApproachInputPacket}=require('../../src/cost/cost-approach-inputs');
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
module.exports={args,scope,asOf,packet,allocations,omissionReviews,ageLifeChecks};
