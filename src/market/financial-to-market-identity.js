'use strict';
// D06: A deterministic and *explicit* identity bridge, not a market fact or title proof.
const finitePositive=n=>typeof n==='number'&&Number.isFinite(n)&&n>0&&n<=1e10?n:null;
const safeName=n=>typeof n==='string'&&n.trim().length<=160?n.trim():'';
function proposeFinancialToMarketIdentity({mode,inputs={},results={},validationError=null,dealName=''}={}){
 const blocked={
  status:'HOLD_FINANCIAL_IDENTITY_UNAVAILABLE',subjectPatch:null,
  independentTitleVerified:false,propertyLocationVerified:false,marketSourceVerified:false,
  replacementRequiresUserConfirmation:true,
 };
 if(validationError||!['building','land'].includes(mode)||
    !inputs||typeof inputs!=='object'||!results||typeof results!=='object'||
    results.financialModelStatus!=='VALID')return {...blocked,reasons:['CURRENT_FINANCIAL_CALCULATION_INVALID']};
 const landArea=finitePositive(results.landArea);
 if(!landArea)return {...blocked,reasons:['LAND_AREA_MISSING']};
 const name=safeName(dealName)||safeName(inputs.projectTitle);
 const patch={name,landArea:String(landArea)};
 if(mode==='land')patch.assetType='LAND';
 else{
  const builtArea=finitePositive(results.totalFloorArea);
  const rentableArea=finitePositive(results.netLeasableArea);
  if(builtArea)patch.builtArea=String(builtArea);
  if(rentableArea)patch.rentableArea=String(rentableArea);
 }
 return Object.freeze({
  status:'USER_CONFIRMATION_REQUIRED',
  subjectPatch:Object.freeze(patch),
  suggestedAssetClass:mode==='land'?'LAND':null,
  assetTypeMustBeSelectedByUser:mode==='building',
  independentTitleVerified:false,propertyLocationVerified:false,marketSourceVerified:false,
  replacementRequiresUserConfirmation:true,
  notes:['NO_AUTOMATIC_PROPERTY_TYPE_GUESS','LOCATION_NOT_COPIED','NO_SOURCE_AUTHENTICATION'],
 });
}
function applyFinancialToMarketIdentity({proposal,subject,confirmed=false}={}){
 if(proposal?.status!=='USER_CONFIRMATION_REQUIRED'||!proposal.subjectPatch||
    confirmed!==true||!subject||typeof subject!=='object'||Array.isArray(subject))
  return {status:'HOLD_NO_EXPLICIT_CONFIRMATION',subject:null};
 const p=proposal.subjectPatch;
 // Never substitute an office, residential compound, land parcel or hotel classification
 // from a string label. A building's property type must already be selected by the user.
 if(proposal.assetTypeMustBeSelectedByUser&&(!subject.assetType||
   subject.assetType==='RESIDENTIAL_COMPOUND'&&!subject.userConfirmedAssetType))
  return {status:'HOLD_ASSET_TYPE_MUST_BE_EXPLICITLY_SELECTED',subject:null};
 const {userConfirmedAssetType:_drop,...cleanSubject}=subject;
 return {status:'COPIED_USER_CONFIRMED_NOT_VERIFIED',
   subject:{...cleanSubject,...p},
   independentlyVerified:false,certifiedPropertyIdentity:false,
   copiedFields:Object.keys(p)};
}
module.exports={proposeFinancialToMarketIdentity,applyFinancialToMarketIdentity};
