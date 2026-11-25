'use strict';
const {VERSION, KINDS, evaluateRentalIntelligence}=require('./saudi-rental-intelligence');
const {parseNumericText}=require('../validation/numeric-text');
const MAX_LOCAL_BYTES=65536;
function numeric(v){
 if(typeof v!=='string'||!v.trim())throw Error('WORKSPACE_NUMBER_REQUIRED');
 const n=parseNumericText(v);
 if(!n.ok||!Number.isFinite(n.value))throw Error('WORKSPACE_NUMBER_INVALID');
 return n.value;
}
function location(lat,lng){
 if(!lat.trim()&&!lng.trim())return null;
 return {lat:numeric(lat),lng:numeric(lng)};
}
function buildRentalWorkspaceInput(state){
 const {propertyRef,valuationDate,city,district,lat,lng,segmentsNonOverlapping,segments,comparables}=state;
 if(!Array.isArray(segments)||!Array.isArray(comparables))throw Error('WORKSPACE_ROWS_REQUIRED');
 return {version:VERSION,propertyRef,valuationDate,city,district,location:location(lat,lng),segmentsNonOverlapping,
 segments:segments.map(s=>({id:s.id,kind:s.kind,subtype:s.subtype,areaBasis:s.areaBasis,areaPerUnitSqm:numeric(s.areaPerUnitSqm),unitCount:numeric(s.unitCount),propertyRight:'FREEHOLD_PROPERTY_LEASE',occupancy:numeric(s.occupancy)/100,collection:numeric(s.collection)/100,contractAnnualExVatSar:s.contractAnnualExVatSar.trim()?numeric(s.contractAnnualExVatSar):null,contractRef:s.contractRef.trim()?s.contractRef:null})),
 comparables:comparables.map(c=>({sourceUrl:c.sourceUrl,sourceRecordId:c.sourceRecordId,contractRef:c.contractRef,status:c.status,kind:c.kind,subtype:c.subtype,city:c.city,district:c.district,location:location(c.lat,c.lng),areaBasis:c.areaBasis,areaSqm:numeric(c.areaSqm),propertyRight:'FREEHOLD_PROPERTY_LEASE',date:c.date,observedDate:c.observedDate,rentAmountSar:numeric(c.rentAmountSar),periodMonths:numeric(c.periodMonths),vatBasis:c.vatBasis,declaredVatRate:c.vatBasis==='INCLUDED'?numeric(c.declaredVatRate)/100:null,vatRef:c.vatBasis==='INCLUDED'?c.vatRef:null,rentOnly:c.rentOnly,usageRightsDeclared:c.usageRightsDeclared,adjustments:c.adjustments.map(a=>({category:a.category,fraction:numeric(a.percent)/100,evidenceRef:a.evidenceRef}))}))};
}
function evaluateWorkspace(state){return evaluateRentalIntelligence(buildRentalWorkspaceInput(state));}
function parseLocalRentalJson(raw){
 if(typeof raw!=='string'||new TextEncoder().encode(raw).length>MAX_LOCAL_BYTES)throw Error('WORKSPACE_FILE_SIZE');
 const parsed=JSON.parse(raw);
 if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw Error('WORKSPACE_FILE_INVALID');
 return parsed;
}
module.exports={MAX_LOCAL_BYTES,buildRentalWorkspaceInput,evaluateWorkspace,parseLocalRentalJson};
