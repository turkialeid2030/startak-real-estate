'use strict';

const crypto = require('node:crypto');
const {strictCalendarDateMs}=require('../validation/strict-calendar-instant');
const {isPlainJson}=require('../validation/plain-json-boundary');

const MEASUREMENT_TYPE = Object.freeze({
  LAND_AREA: 'LAND_AREA',
  GFA: 'GFA',
  BUA: 'BUA',
  NLA: 'NLA',
  GLA: 'GLA',
  RENTABLE_AREA: 'RENTABLE_AREA',
  COMMON_AREA: 'COMMON_AREA',
  SALEABLE_AREA: 'SALEABLE_AREA',
  ROOM_KEY_COUNT: 'ROOM_KEY_COUNT',
  RESIDENTIAL_UNIT_COUNT: 'RESIDENTIAL_UNIT_COUNT',
});

const COUNT_TYPES=Object.freeze([MEASUREMENT_TYPE.ROOM_KEY_COUNT,MEASUREMENT_TYPE.RESIDENTIAL_UNIT_COUNT]);
const isCountType=t=>COUNT_TYPES.includes(t);
const MEASUREMENT_SOURCE = Object.freeze({
  TITLE_DEED: 'TITLE_DEED',
  REAL_ESTATE_REGISTRY: 'REAL_ESTATE_REGISTRY',
  APPROVED_PLAN: 'APPROVED_PLAN',
  SURVEY: 'SURVEY',
  INSPECTION: 'INSPECTION',
  CLIENT_PROVIDED: 'CLIENT_PROVIDED',
  OTHER: 'OTHER',
});

const MEASUREMENT_RECONCILIATION_STATUS = Object.freeze({
  CLEAR: 'CLEAR',
  HOLD_INSUFFICIENT_EVIDENCE: 'HOLD_INSUFFICIENT_EVIDENCE',
  MEASUREMENT_CONFLICT: 'MEASUREMENT_CONFLICT',
});

function nonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function assertNonEmpty(value, field) {
  if (!nonEmpty(value)) throw new TypeError(`${field} must be a non-empty string`);
}

function assertEnum(value, enumeration, field) {
  if (!Object.values(enumeration).includes(value)) throw new TypeError(`${field} is invalid`);
}

function iso(value, field) {
  if (!nonEmpty(value)) throw new TypeError(`${field} is required`);
  const date = new Date(strictCalendarDateMs(value));
  if (Number.isNaN(date.getTime())) throw new TypeError(`${field} must be a valid date/time`);
  return date.toISOString();
}

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) freeze(child);
  return Object.freeze(value);
}

function hash(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}
function canonical(v){
 if(Array.isArray(v))return v.map(canonical);
 if(v&&typeof v==='object')return Object.fromEntries(Object.keys(v).sort().map(k=>{
  if(['__proto__','constructor','prototype'].includes(k))throw TypeError('MEASUREMENT_UNSAFE_KEY');
  return [k,canonical(v[k])];
 }));
 return v;
}
const digest=v=>hash(canonical(v));

function createMeasurementRecord({
  measurementId,
  caseId,
  inspectionId = null,
  type,
  valueSqm,
  source,
  sourceEvidenceRef,
  measurementStandardRef,
  measurementMethod,
  measuredByRef,
  measuredAt,
}) {
  assertNonEmpty(measurementId, 'measurementId');
  assertNonEmpty(caseId, 'caseId');
  assertEnum(type, MEASUREMENT_TYPE, 'type');
  if(isCountType(type))throw new TypeError('MEASUREMENT_COUNT_REQUIRES_EXPLICIT_COUNT_CONSTRUCTOR');
  assertEnum(source, MEASUREMENT_SOURCE, 'source');
  assertNonEmpty(sourceEvidenceRef, 'sourceEvidenceRef');
  assertNonEmpty(measurementStandardRef, 'measurementStandardRef');
  assertNonEmpty(measurementMethod, 'measurementMethod');
  assertNonEmpty(measuredByRef, 'measuredByRef');
  if (typeof valueSqm !== 'number' || !Number.isFinite(valueSqm) || valueSqm <= 0) throw new TypeError('valueSqm must be a finite positive number');
  if (inspectionId !== null && !nonEmpty(inspectionId)) throw new TypeError('inspectionId must be null or non-empty string');

  const record = {
    schemaVersion: 1,
    measurementId: measurementId.trim(),
    caseId: caseId.trim(),
    inspectionId: inspectionId ? inspectionId.trim() : null,
    type,
    value: valueSqm,
    unit: 'SQM',
    source,
    sourceEvidenceRef: sourceEvidenceRef.trim(),
    measurementStandardRef: measurementStandardRef.trim(),
    measurementMethod: measurementMethod.trim(),
    measuredByRef: measuredByRef.trim(),
    measuredAt: iso(measuredAt, 'measuredAt'),
  };
  record.measurementHashSha256 = hash(record);
  return freeze(record);
}

// Count is not an area. Preserve the existing area constructor and digests.
function createCountMeasurementRecord(input){
 if(!input||typeof input!=='object'||Array.isArray(input)||!isPlainJson(input))throw TypeError('MEASUREMENT_COUNT_INPUT_INVALID');
 const {measurementId,caseId,inspectionId=null,type,valueCount,source,sourceEvidenceRef,measurementStandardRef,measurementMethod,measuredByRef,measuredAt}=input;
 if(!isCountType(type)||!Number.isSafeInteger(valueCount)||valueCount<=0||Object.hasOwn(input,'valueSqm'))throw TypeError('MEASUREMENT_COUNT_POSITIVE_INTEGER_REQUIRED');
 for(const [k,v] of Object.entries({measurementId,caseId,sourceEvidenceRef,measurementStandardRef,measurementMethod,measuredByRef}))assertNonEmpty(v,k);
 assertEnum(source,MEASUREMENT_SOURCE,'source');
 if(inspectionId!==null&&!nonEmpty(inspectionId))throw TypeError('inspectionId must be null or non-empty string');
 const record={schemaVersion:1,measurementId:measurementId.trim(),caseId:caseId.trim(),inspectionId:inspectionId?inspectionId.trim():null,type,value:valueCount,unit:'COUNT',source,sourceEvidenceRef:sourceEvidenceRef.trim(),measurementStandardRef:measurementStandardRef.trim(),measurementMethod:measurementMethod.trim(),measuredByRef:measuredByRef.trim(),measuredAt:iso(measuredAt,'measuredAt')};
 record.measurementHashSha256=hash(record);return freeze(record);
}
function verifyMeasurementRecord(record){
 try{
  if(!isPlainJson(record)||!record||typeof record!=='object'||Array.isArray(record))return false;
  const rebuilt=isCountType(record.type)?createCountMeasurementRecord({...record,valueCount:record.value}):createMeasurementRecord({...record,valueSqm:record.value});
  const stable=v=>Array.isArray(v)?v.map(stable):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])])):v;
  return JSON.stringify(stable(record))===JSON.stringify(stable(rebuilt));
 }catch{return false;}
}
function withinTolerance(a, b, tolerance) {
  const absolute = Number.isFinite(tolerance?.absoluteSqm) ? Math.max(0, tolerance.absoluteSqm) : 0;
  const relative = Number.isFinite(tolerance?.relative) ? Math.max(0, tolerance.relative) : 0;
  const delta = Math.abs(a - b);
  if (delta <= absolute) return true;
  const scale = Math.max(Math.abs(a), Math.abs(b), 1);
  return delta <= scale * relative;
}

function reconcileMeasurementRecords({
  caseId,
  records,
  materialTypes,
  toleranceByType = {},
  minimumIndependentSourcesByType = {},
} = {}) {
  assertNonEmpty(caseId, 'caseId');
  if (!Array.isArray(records)||records.length>5000) throw new TypeError('records must be a bounded array');
  if (!Array.isArray(materialTypes) || materialTypes.length === 0) throw new TypeError('materialTypes must be a non-empty array');
  for (const type of materialTypes) assertEnum(type, MEASUREMENT_TYPE, 'materialTypes[]');
  for (const record of records) {
    if (!record || record.caseId !== caseId) throw new TypeError('CASE_ISOLATION_VIOLATION: measurement record belongs to another case');
    if(record.unit!==(isCountType(record.type)?'COUNT':'SQM'))throw new TypeError('MEASUREMENT_UNIT_UNSUPPORTED: measurement unit must match its governed type');
    if(isCountType(record.type)&&!materialTypes.includes(record.type))throw TypeError('MEASUREMENT_COUNT_MUST_BE_MATERIAL');
  }

  const policy={materialTypes:[...new Set(materialTypes)].sort(),toleranceByType:{},minimumIndependentSourcesByType:{}};
  for(const type of policy.materialTypes){
   const tolerance=toleranceByType[type]??{},min=minimumIndependentSourcesByType[type]??1;
   const count=isCountType(type);
   if(!tolerance||typeof tolerance!=='object'||Array.isArray(tolerance)||Object.keys(tolerance).some(k=>!(count?['absoluteCount','relative']:['absoluteSqm','relative']).includes(k))||
    Object.values(tolerance).some(v=>typeof v!=='number'||!Number.isFinite(v)||v<0)||
    (tolerance.relative??0)>1||!Number.isSafeInteger(min)||min<(count?2:1)||min>Object.keys(MEASUREMENT_SOURCE).length||(count&&((tolerance.absoluteCount??0)!==0||(tolerance.relative??0)!==0)))
     throw TypeError('MEASUREMENT_POLICY_INVALID');
   policy.toleranceByType[type]=count?{absoluteCount:0,relative:0}:{absoluteSqm:tolerance.absoluteSqm??0,relative:tolerance.relative??0};
   policy.minimumIndependentSourcesByType[type]=min;
  }
  const invalidIds=new Set(records.filter(r=>!verifyMeasurementRecord(r)).map(r=>r.measurementId));
  const duplicateIds=new Set(records.map(r=>r.measurementId)).size!==records.length;
  const checks = [];
  const conflicts = [];
  const insufficient = [];

  for (const type of [...new Set(materialTypes)]) {
    const group = records.filter((record) => record.type === type);
    const sources = [...new Set(group.map((record) => record.source))];
    const minimumSources=policy.minimumIndependentSourcesByType[type];
    const evidenceInsufficient = group.length === 0 || sources.length < minimumSources||duplicateIds||invalidIds.size>0||new Set(group.map(r=>r.sourceEvidenceRef)).size<minimumSources;
    if (evidenceInsufficient) insufficient.push({ type, sourceCount: sources.length, requiredSourceCount: minimumSources });

    let conflict = false;
    if (group.length > 1) {
      conflict = new Set(group.map(r=>r.measurementStandardRef)).size!==1||group.some((a,i)=>group.slice(i+1).some(b=>isCountType(type)?a.value!==b.value:!withinTolerance(a.value,b.value,toleranceByType[type]||{})));
      if (conflict) {
        conflicts.push({
          type,
          values: group.map((record) => record.value),
          measurementIds: group.map((record) => record.measurementId),
          sources,
          code: 'MEASUREMENT_CONFLICT',
        });
      }
    }

    checks.push({
      type,
      recordCount: group.length,
      sources,
      sourceCount: sources.length,
      requiredSourceCount: minimumSources,
      evidenceInsufficient,
      conflict,
      ...(isCountType(type)?{consensusValueCount:!conflict&&!evidenceInsufficient&&group.length?group[0].value:null,unit:'COUNT'}:{consensusValueSqm: !conflict && !evidenceInsufficient && group.length ? group[0].value : null}),
    });
  }

  let status = MEASUREMENT_RECONCILIATION_STATUS.CLEAR;
  if (conflicts.length) status = MEASUREMENT_RECONCILIATION_STATUS.MEASUREMENT_CONFLICT;
  else if (insufficient.length) status = MEASUREMENT_RECONCILIATION_STATUS.HOLD_INSUFFICIENT_EVIDENCE;

  const core={
    schemaVersion: 2,
    caseId,
    measurementRecordsHashSha256:digest(records),
    policy,
    status,
    checks,
    conflicts,
    insufficient,
    readyForInspectionCompletion: status === MEASUREMENT_RECONCILIATION_STATUS.CLEAR,
    professionalValuationProgressionAllowed: status === MEASUREMENT_RECONCILIATION_STATUS.CLEAR,
    financialEngineAdoptionAllowed: status === MEASUREMENT_RECONCILIATION_STATUS.CLEAR,
    transactionAuthorized: false,
    certifiedValuationEstablished: false,
    semantics: policy.materialTypes.some(isCountType)?'Measurement reconciliation compares canonical square metres separately from exact positive integer counts. No unit conversion, count tolerance, standard substitution or source winner selection.':'Measurement reconciliation compares evidence already expressed in canonical square metres. No silent unit conversion, standard substitution, or source winner selection is performed.',
  };
  return freeze({...core,measurementGateHashSha256:digest(core)});
}

function verifyMeasurementGate(gate,inputs){
 try{
  const replay=reconcileMeasurementRecords(inputs);
  return replay.status===MEASUREMENT_RECONCILIATION_STATUS.CLEAR&&digest(gate)===digest(replay);
 }catch{return false;}
}
module.exports = {
  MEASUREMENT_TYPE,
  MEASUREMENT_SOURCE,
  MEASUREMENT_RECONCILIATION_STATUS,
  createMeasurementRecord,
  createCountMeasurementRecord,
  verifyMeasurementRecord,
  verifyMeasurementGate,
  reconcileMeasurementRecords,
};
