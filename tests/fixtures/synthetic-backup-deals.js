'use strict';
// Synthetic transfer fixtures only; no uploaded customer files or identifiers.
const gold=require('../reference/RE-GOLD-baseline.json');
const {operatingCase}=require('./synthetic-collections-case');
const {emptyValuationCaseDraft}=require('../../src/app/valuation-case-draft');
const {updateValuationEditorDraft}=require('../../src/app/valuation-editor-draft');
const {recordInputProvenance}=require('../../src/app/input-provenance');
const {createRentalCalendar}=require('../../src/app/rental-calendar-disclosure');
const {SAVED_DEAL_ASSUMPTION_REGISTRY_VERSION}=require('../../src/assumptions/saved-deal-assumption-registry');
const {ZAKAT_INPUT_SOURCE}=require('../../src/zakat/user-entered-zakat');
function syntheticBackupDeals(){
 const building={id:'transfer-building',name:'TRANSFER BUILDING / عقار تجريبي',mode:'building',inputs:{...gold['RE-GOLD-002_existing_building'].inputs},savedAt:'2026-10-20T00:00:00Z',assumptionModelVersion:'LEGACY'};
 building.operatingCase=JSON.parse(JSON.stringify(operatingCase()));
 const draft=emptyValuationCaseDraft();draft.projectId='UNAPPLIED-TRANSFER-DRAFT';building.valuationEditorDraft=updateValuationEditorDraft(null,'base',draft);
 building.inputProvenance=recordInputProvenance({mode:'building',inputs:building.inputs,field:'buildingPrice',unit:'SAR',sourceKind:'DOCUMENT_REFERENCE',sourceReference:'Synthetic source reference',sourceDate:'2026-10-20',location:'Synthetic page 1',reviewerRef:'SYNTHETIC-REVIEWER',documentDigestSha256:'b'.repeat(64),recordedAt:building.savedAt});
 building.rentalContext=createRentalCalendar({studyStartDate:'2026-10-20',locationScope:'UNKNOWN',leaseCategory:'RESIDENTIAL',contractReference:'Synthetic reference',lastRentReference:'Synthetic rent',exceptionReference:''});
 building.zakatCase={annualAmount:1800.5,source:Object.values(ZAKAT_INPUT_SOURCE)[0]};
 building.assumptionRegistry=[{id:'SYNTHETIC-ASSUMPTION',value:125,critical:false,sourceReference:'SYNTHETIC-UNVERIFIED'}];
 building.assumptionRegistryVersion=SAVED_DEAL_ASSUMPTION_REGISTRY_VERSION;
 const land={id:'transfer-land',name:'TRANSFER LAND / أرض تجريبية',mode:'land',inputs:{...gold['RE-GOLD-001_land_development'].inputs},savedAt:building.savedAt};
 return [building,land];
}
module.exports={syntheticBackupDeals};
