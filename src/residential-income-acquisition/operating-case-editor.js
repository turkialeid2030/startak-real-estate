'use strict';
const {parseNumericText}=require('../validation/numeric-text');
const {leaseWithoutHistory,appendLeaseChange,assertLeaseIntervals}=require('./lease-history');
const {validDate,defaultCashHorizonEnd}=require('./cash-horizon');

const {
  OPERATING_INPUT_STATUS,
  LINEAGE_KIND,
  createEvidenceLineageRecord,
  createEvidenceAwareValue,
  createLease,
  createUnit,
  createRentEscalation,
  createRentCollectionRecord,
  createResidentialIncomeOperatingCase,
} = require('./contracts');

function requiredText(value, field) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${field} is required`);
  return value.trim();
}

function nonNegativeNumber(value, field) {
  if (typeof value !== 'number' && typeof value !== 'string') throw Object.assign(new TypeError(`${field}: OPERATING_AMOUNT_REQUIRED`), {code:'OPERATING_AMOUNT_REQUIRED',field});
  const result=parseNumericText(value);
  if(!result.ok)throw Object.assign(new TypeError(`${field}: OPERATING_AMOUNT_REQUIRED`),{code:'OPERATING_AMOUNT_REQUIRED',field});
  const parsed=result.value;
  if (!Number.isFinite(parsed) || parsed < 0) throw new TypeError(`${field} must be a finite number >= 0`);
  if (!Number.isSafeInteger(Math.round(parsed * 100))) throw new TypeError(`${field}: OPERATING_AMOUNT_OUT_OF_RANGE`);
  return parsed;
}

function isoDate(value, field) {
  const text = requiredText(value, field);
  const day = text.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(text) || !Number.isFinite(Date.parse(day)) || new Date(day).toISOString().slice(0, 10) !== day) throw new TypeError(`${field} must be a valid ISO date`);
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) throw new TypeError(`${field} must be a valid date`);
  return text;
}

function extendEvidenceLineage(operatingCase, { sourceRef, adoptionDecisionRef, recordedAt, note }) {
  const records = [...operatingCase.evidenceLineage];
  const source = records.find((record) => record.refId === sourceRef);
  if (source && ![LINEAGE_KIND.SOURCE_DOCUMENT, LINEAGE_KIND.EVIDENCE_FACT].includes(source.kind)) {
    throw new TypeError('EDITOR_SOURCE_LINEAGE_KIND_INVALID');
  }
  if (!source) {
    records.push(createEvidenceLineageRecord({
      caseId: operatingCase.caseId,
      refId: sourceRef,
      kind: LINEAGE_KIND.EVIDENCE_FACT,
      recordedAt,
      note,
    }));
  }
  const adoption = records.find((record) => record.refId === adoptionDecisionRef);
  if (adoption && adoption.kind !== LINEAGE_KIND.UNDERWRITING_ADOPTION) {
    throw new TypeError('EDITOR_ADOPTION_LINEAGE_KIND_INVALID');
  }
  if (!adoption) {
    records.push(createEvidenceLineageRecord({
      caseId: operatingCase.caseId,
      refId: adoptionDecisionRef,
      kind: LINEAGE_KIND.UNDERWRITING_ADOPTION,
      recordedAt,
      note: 'Explicit human adoption recorded through the STARTAK operating workspace.',
    }));
  }
  return records;
}

function verifiedMoney(field, value, sourceRef, adoptionDecisionRef, effectiveDate) {
  return createEvidenceAwareValue({
    field,
    value: nonNegativeNumber(value, field),
    unit: 'SAR',
    sourceRef,
    evidenceType: 'OPERATOR_VERIFIED_SOURCE_ENTRY',
    effectiveDate,
    verificationStatus: OPERATING_INPUT_STATUS.VERIFIED_FACT,
    confidence: 1,
    adoptedForUnderwriting: true,
    adoptionDecisionRef,
  });
}

function rebuildCase(operatingCase, overrides) {
  return createResidentialIncomeOperatingCase({
    caseId: operatingCase.caseId,
    asOfDate: overrides.asOfDate || operatingCase.asOfDate,
    propertyInterest: operatingCase.propertyInterest,
    property: operatingCase.property,
    buildings: operatingCase.buildings,
    units: overrides.units || operatingCase.units,
    leases: overrides.leases || operatingCase.leases,
    rentCollections: overrides.rentCollections || operatingCase.rentCollections || [],
    receivablesLedger: operatingCase.receivablesLedger,
    tenants: operatingCase.tenants,
    operatingExpenses: operatingCase.operatingExpenses,
    capexItems: operatingCase.capexItems,
    capitalPaymentPlan: operatingCase.capitalPaymentPlan,
    operatingPaymentPlan: operatingCase.operatingPaymentPlan,
    cashScenario: operatingCase.cashScenario,
    bankRentStatement: operatingCase.bankRentStatement,
    exitScenarios: operatingCase.exitScenarios,
    additionalOperatingInputs: operatingCase.additionalOperatingInputs,
    evidenceLineage: overrides.evidenceLineage || operatingCase.evidenceLineage,
  });
}

function updateVerifiedLeaseTerms(operatingCase, draft, { recordedAt = new Date().toISOString() } = {}) {
  if (!draft || draft.confirmed !== true) throw new TypeError('EXPLICIT_VERIFICATION_CONFIRMATION_REQUIRED');
  const leaseId = requiredText(draft.leaseId, 'leaseId');
  const sourceRef = requiredText(draft.sourceRef, 'sourceRef');
  const adoptionDecisionRef = requiredText(draft.adoptionDecisionRef, 'adoptionDecisionRef');
  const target = operatingCase.leases.find((lease) => lease.leaseId === leaseId);
  if (!target) throw new TypeError('LEASE_NOT_FOUND');
  const endDate = isoDate(draft.endDate, 'endDate');
  if(target.escalation.schedule.some(entry=>Date.parse(entry.effectiveDate)>=Date.parse(endDate)))throw new TypeError('LEASE_SCHEDULE_OUTSIDE_TERM');
  const baseRentValue = nonNegativeNumber(draft.baseRent, 'baseRent');
  const evidenceLineage = extendEvidenceLineage(operatingCase, {
    sourceRef,
    adoptionDecisionRef,
    recordedAt,
    note: 'Lease terms evidence explicitly verified through the STARTAK operating workspace.',
  });
  const baseRent = createEvidenceAwareValue({
    field: `lease.${leaseId}.baseRent`,
    value: baseRentValue,
    unit: target.baseRent.unit,
    sourceRef,
    evidenceType: 'OPERATOR_VERIFIED_LEASE_TERMS',
    effectiveDate: operatingCase.asOfDate,
    verificationStatus: OPERATING_INPUT_STATUS.VERIFIED_FACT,
    confidence: 1,
    adoptedForUnderwriting: true,
    adoptionDecisionRef,
  });
  const updatedLease = createLease({
    caseId: target.caseId,
    propertyInterestId: target.propertyInterestId,
    propertyId: target.propertyId,
    buildingId: target.buildingId,
    unitId: target.unitId,
    leaseId: target.leaseId,
    tenantId: target.tenantId,
    lifecycleStatus: target.lifecycleStatus,
    startDate: target.startDate,
    endDate,
    baseRent,
    rentFrequency: target.rentFrequency,
    escalation: target.escalation,
    securityRefs: target.securityRefs,
    termsEvidenceRef: sourceRef,
    termsAdoptionDecisionRef: adoptionDecisionRef,
    evidenceRefs: target.evidenceRefs,
  });
  const revised=appendLeaseChange(target,updatedLease,{kind:'TERMS_REPLACED',recordedAt,caseDateBefore:operatingCase.asOfDate,sourceRef,adoptionDecisionRef,reason:'Locally entered replacement of lease terms; previous terms retained.'});
  const leases = operatingCase.leases.map((lease) => lease.leaseId === leaseId ? revised : lease);
  assertLeaseIntervals(leases,target.unitId);
  return rebuildCase(operatingCase, { leases, evidenceLineage });
}

function addVerifiedRentCollection(operatingCase, draft, { recordedAt = new Date().toISOString() } = {}) {
  if (!draft || draft.confirmed !== true) throw new TypeError('EXPLICIT_VERIFICATION_CONFIRMATION_REQUIRED');
  const collectionId = requiredText(draft.collectionId, 'collectionId');
  const leaseId = typeof draft.leaseId === 'string' && draft.leaseId.trim() ? draft.leaseId.trim() : null;
  const sourceRef = requiredText(draft.sourceRef, 'sourceRef');
  const adoptionDecisionRef = requiredText(draft.adoptionDecisionRef, 'adoptionDecisionRef');
  const periodStart = isoDate(draft.periodStart, 'periodStart');
  const periodEnd = isoDate(draft.periodEnd, 'periodEnd');
  if (Date.parse(periodEnd) > Date.parse(operatingCase.asOfDate)) throw new TypeError('COLLECTION_PERIOD_ENDS_AFTER_AS_OF_DATE');
  const lease = leaseId ? operatingCase.leases.find((record) => record.leaseId === leaseId) : null;
  if (leaseId && !lease) throw new TypeError('LEASE_NOT_FOUND');
  const unitId = lease ? lease.unitId : requiredText(draft.unitId, 'unitId');
  const unit = operatingCase.units.find((record) => record.unitId === unitId);
  if (!unit) throw new TypeError('UNIT_NOT_FOUND');
  const evidenceLineage = extendEvidenceLineage(operatingCase, {
    sourceRef,
    adoptionDecisionRef,
    recordedAt,
    note: 'Collection evidence explicitly verified through the STARTAK operating workspace.',
  });
  const money = (key, value) => verifiedMoney(`collection.${collectionId}.${key}`, value, sourceRef, adoptionDecisionRef, periodEnd);
  const collection = createRentCollectionRecord({
    caseId: operatingCase.caseId,
    collectionId,
    propertyId: unit.propertyId,
    buildingId: unit.buildingId,
    unitId: unit.unitId,
    leaseId,
    periodStart,
    periodEnd,
    contractualRentDue: money('contractualRentDue', draft.contractualRentDue),
    collectedRent: money('collectedRent', draft.collectedRent),
    potentialGrossRent: money('potentialGrossRent', draft.potentialGrossRent),
    concessions: money('concessions', draft.concessions),
    evidenceRefs: [sourceRef, adoptionDecisionRef],
  });
  return rebuildCase(operatingCase, {
    rentCollections: [...(operatingCase.rentCollections || []), collection],
    evidenceLineage,
  });
}

function updateVerifiedLeaseSchedule(operatingCase,draft,{recordedAt=new Date().toISOString()}={}) {
  if(!draft||draft.confirmed!==true)throw new TypeError('EXPLICIT_VERIFICATION_CONFIRMATION_REQUIRED');
  const target=operatingCase.leases.find(lease=>lease.leaseId===draft.leaseId);
  if(!target)throw new TypeError('LEASE_NOT_FOUND');
  if(!['ACTIVE','FUTURE'].includes(target.lifecycleStatus)||!['NONE','STEP_RENT','MANUAL_SCHEDULE'].includes(target.escalation.type))throw new TypeError('LEASE_SCHEDULE_TYPE_UNSUPPORTED');
  if(!Array.isArray(draft.entries)||draft.entries.length===0||draft.entries.length>200)throw new TypeError('LEASE_SCHEDULE_REQUIRED');
  const sourceRef=requiredText(draft.sourceRef,'sourceRef');
  const adoptionDecisionRef=requiredText(draft.adoptionDecisionRef,'adoptionDecisionRef');
  let previous=-Infinity;
  const schedule=draft.entries.map((entry,index)=>{
    const effectiveDate=isoDate(entry.effectiveDate,'effectiveDate');
    if(!/^\d{4}-\d{2}-\d{2}$/.test(effectiveDate))throw new TypeError('LEASE_SCHEDULE_DATE_ONLY_REQUIRED');
    const date=Date.parse(effectiveDate);
    if(!target.startDate||!target.endDate||date<Date.parse(target.startDate)||date>=Date.parse(target.endDate))throw new TypeError('LEASE_SCHEDULE_OUTSIDE_TERM');
    if(date<=previous)throw new TypeError('LEASE_SCHEDULE_DATES_NOT_INCREASING');
    previous=date;
    const rent=createEvidenceAwareValue({...verifiedMoney(`lease.${target.leaseId}.schedule.${index}.rent`,entry.rent,sourceRef,adoptionDecisionRef,operatingCase.asOfDate),unit:target.baseRent.unit});
    return {effectiveDate,rent};
  });
  const evidenceLineage=extendEvidenceLineage(operatingCase,{sourceRef,adoptionDecisionRef,recordedAt,note:'Locally declared lease schedule review; does not authenticate source, reviewer or regulatory applicability.'});
  const next=createLease({...leaseWithoutHistory(target),escalation:createRentEscalation({type:'MANUAL_SCHEDULE',schedule}),evidenceRefs:[...new Set([...target.evidenceRefs,sourceRef,adoptionDecisionRef])]});
  const updated=appendLeaseChange(target,next,{kind:'SCHEDULE_REPLACED',recordedAt,caseDateBefore:operatingCase.asOfDate,sourceRef,adoptionDecisionRef,reason:'Locally entered replacement of the complete dated rent schedule; previous schedule retained.'});
  return rebuildCase(operatingCase,{leases:operatingCase.leases.map(lease=>lease.leaseId===target.leaseId?updated:lease),evidenceLineage});
}

function addDocumentedFutureLease(operatingCase,draft,{recordedAt=new Date().toISOString()}={}) {
  if(draft?.confirmed!==true)throw new TypeError('EXPLICIT_VERIFICATION_CONFIRMATION_REQUIRED');
  const previous=operatingCase.leases.find(x=>x.leaseId===draft.previousLeaseId);
  if(!previous||!previous.endDate)throw new TypeError('LEASE_NOT_FOUND');
  const leaseId=requiredText(draft.leaseId,'leaseId'),tenantId=requiredText(draft.tenantId,'tenantId');
  if(operatingCase.leases.some(x=>x.leaseId===leaseId))throw new TypeError('FUTURE_LEASE_DUPLICATE_ID');
  if(!operatingCase.tenants.some(x=>x.tenantId===tenantId))throw new TypeError('FUTURE_LEASE_TENANT_REQUIRED');
  const startDate=isoDate(draft.startDate,'startDate'),endDate=isoDate(draft.endDate,'endDate');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(startDate)||!/^\d{4}-\d{2}-\d{2}$/.test(endDate)||Date.parse(startDate)<=Date.parse(operatingCase.asOfDate)||Date.parse(startDate)<Date.parse(previous.endDate)||Date.parse(endDate)<=Date.parse(startDate))throw new TypeError('FUTURE_LEASE_DATES_INVALID');
  if(operatingCase.leases.some(x=>x.unitId===previous.unitId&&['ACTIVE','FUTURE'].includes(x.lifecycleStatus)&&Date.parse(startDate)<Date.parse(x.endDate)&&Date.parse(x.startDate)<Date.parse(endDate)))throw new TypeError('FUTURE_LEASE_OVERLAP');
  const sourceRef=requiredText(draft.sourceRef,'sourceRef'),adoptionDecisionRef=requiredText(draft.adoptionDecisionRef,'adoptionDecisionRef');
  const evidenceLineage=extendEvidenceLineage(operatingCase,{sourceRef,adoptionDecisionRef,recordedAt,note:'Locally reviewed future lease document; not an assumed automatic renewal or legal authentication.'});
  const baseRent=createEvidenceAwareValue({...verifiedMoney(`lease.${leaseId}.baseRent`,draft.baseRent,sourceRef,adoptionDecisionRef,operatingCase.asOfDate),unit:previous.baseRent.unit});
  const lease=createLease({caseId:operatingCase.caseId,propertyInterestId:previous.propertyInterestId,propertyId:previous.propertyId,buildingId:previous.buildingId,unitId:previous.unitId,leaseId,tenantId,lifecycleStatus:'FUTURE',startDate,endDate,baseRent,rentFrequency:previous.rentFrequency,termsEvidenceRef:sourceRef,termsAdoptionDecisionRef:adoptionDecisionRef});
  const units=operatingCase.units.map(unit=>unit.unitId===lease.unitId?createUnit({...unit,leaseIds:[...unit.leaseIds,leaseId]}):unit);
  return rebuildCase(operatingCase,{leases:[...operatingCase.leases,lease],units,evidenceLineage});
}

function recordDocumentedLeaseLifecycle(operatingCase,draft,{recordedAt=new Date().toISOString()}={}){
 if(draft?.confirmed!==true)throw new TypeError('EXPLICIT_VERIFICATION_CONFIRMATION_REQUIRED');
 if(!['EARLY_END','CANCEL_FUTURE','REVIEW_DATE','RESTORE_PREVIOUS'].includes(draft.action))throw new TypeError('LEASE_LIFECYCLE_ACTION_INVALID');
 const sourceRef=requiredText(draft.sourceRef,'sourceRef'),adoptionDecisionRef=requiredText(draft.adoptionDecisionRef,'adoptionDecisionRef'),reason=requiredText(draft.reason,'reason');
 if(reason.length>1000)throw new TypeError('LEASE_HISTORY_REASON_LIMIT');
 const asOf=operatingCase.asOfDate.slice(0,10),reviewDate=draft.action==='REVIEW_DATE'?draft.date:asOf;
 if(!validDate(reviewDate)||reviewDate<asOf)throw new TypeError('LEASE_REVIEW_DATE_INVALID');
 if(draft.action==='REVIEW_DATE')defaultCashHorizonEnd(reviewDate);
 const evidenceLineage=extendEvidenceLineage(operatingCase,{sourceRef,adoptionDecisionRef,recordedAt,note:'Local documentary lifecycle review only; no legal action, authenticated identity, notice, billing or cash execution.'});
 const meta={recordedAt,caseDateBefore:asOf,caseDateAfter:reviewDate,sourceRef,adoptionDecisionRef,reason};
 let leases;
 if(draft.action==='REVIEW_DATE'){
  let reviewed=0;
  leases=operatingCase.leases.map(lease=>{
   if(lease.lifecycleStatus==='TERMINATED'||lease.lifecycleStatus==='EXPIRED')return lease;
   if(!['ACTIVE','FUTURE'].includes(lease.lifecycleStatus)||!lease.startDate||!lease.endDate)throw new TypeError('LEASE_LIFECYCLE_TERMS_REQUIRED');
   const state=reviewDate<lease.startDate.slice(0,10)?'FUTURE':reviewDate>=lease.endDate.slice(0,10)?'EXPIRED':'ACTIVE';reviewed++;
   const next=createLease({...leaseWithoutHistory(lease),lifecycleStatus:state});
   return appendLeaseChange(lease,next,{...meta,kind:'STATE_REVIEWED'});
  });
  if(!reviewed)throw new TypeError('LEASE_LIFECYCLE_NO_REVIEWABLE_LEASE');
 }else{
  const target=operatingCase.leases.find(lease=>lease.leaseId===draft.leaseId);if(!target)throw new TypeError('LEASE_NOT_FOUND');
  let next,kind,effectiveDate=asOf;
  if(draft.action==='EARLY_END'){
   if(target.lifecycleStatus!=='ACTIVE'||!target.startDate||!target.endDate||!validDate(draft.date)||draft.date<=target.startDate.slice(0,10)||draft.date>=target.endDate.slice(0,10))throw new TypeError('LEASE_EARLY_END_INVALID');
   if(!['NONE','STEP_RENT','MANUAL_SCHEDULE'].includes(target.escalation.type))throw new TypeError('LEASE_SCHEDULE_TYPE_UNSUPPORTED');
   effectiveDate=draft.date;
   const schedule=target.escalation.schedule.filter(entry=>entry.effectiveDate.slice(0,10)<draft.date);
   const escalation=schedule.length?createRentEscalation({...target.escalation,schedule}):createRentEscalation({type:'NONE'});
   next=createLease({...leaseWithoutHistory(target),endDate:draft.date,lifecycleStatus:draft.date<=asOf?'TERMINATED':'ACTIVE',escalation,termsEvidenceRef:sourceRef,termsAdoptionDecisionRef:adoptionDecisionRef});kind='EARLY_END_RECORDED';
  }else if(draft.action==='CANCEL_FUTURE'){
   if(target.lifecycleStatus!=='FUTURE'||!target.startDate||target.startDate.slice(0,10)<=asOf)throw new TypeError('LEASE_CANCEL_FUTURE_INVALID');
   next=createLease({...leaseWithoutHistory(target),lifecycleStatus:'TERMINATED',termsEvidenceRef:sourceRef,termsAdoptionDecisionRef:adoptionDecisionRef});kind='FUTURE_CANCELLED';
  }else{
   const previous=target.changeLog?.at(-1);
   if(!previous||previous.kind==='STATE_REVIEWED'||previous.caseDateAfter!==asOf)throw new TypeError('LEASE_RESTORE_PREVIOUS_INVALID');
   next=createLease({...previous.before,termsEvidenceRef:sourceRef,termsAdoptionDecisionRef:adoptionDecisionRef});kind='PREVIOUS_TERMS_RESTORED';
   if((next.lifecycleStatus==='ACTIVE'&&(!next.startDate||!next.endDate||next.startDate.slice(0,10)>asOf||next.endDate.slice(0,10)<=asOf))||(next.lifecycleStatus==='FUTURE'&&(!next.startDate||next.startDate.slice(0,10)<=asOf)))throw new TypeError('LEASE_RESTORE_PREVIOUS_INVALID');
  }
  const revised=appendLeaseChange(target,next,{...meta,kind,effectiveDate});
  leases=operatingCase.leases.map(lease=>lease===target?revised:lease);
 }
 assertLeaseIntervals(leases);
 // Canonical reconstruction retains receipts and rejects contradictory periods.
 return rebuildCase(operatingCase,{leases,evidenceLineage,asOfDate:reviewDate});
}

module.exports = {
  recordDocumentedLeaseLifecycle,
  addDocumentedFutureLease,
  updateVerifiedLeaseSchedule,
  updateVerifiedLeaseTerms,
  addVerifiedRentCollection,
};
