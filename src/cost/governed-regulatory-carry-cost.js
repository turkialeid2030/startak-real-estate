'use strict';
const crypto = require('crypto');

const CAPABILITY = 'C12_GOVERNED_REGULATORY_CARRY_COST_V1';
const POLICY_VERSION = 'C12_REGULATORY_CARRY_COST_REVIEW_POLICY_V1';
const REGULATORY_CARRY_STATUS = Object.freeze({
  READY_FOR_PROFESSIONAL_REGULATORY_CARRY_COST_REVIEW: 'READY_FOR_PROFESSIONAL_REGULATORY_CARRY_COST_REVIEW',
  HOLD_CONTEXT: 'HOLD_CONTEXT', HOLD_EVIDENCE: 'HOLD_EVIDENCE', HOLD_INTEGRITY: 'HOLD_INTEGRITY',
  HOLD_POLICY: 'HOLD_POLICY', HOLD_CALCULATION: 'HOLD_CALCULATION',
});
const COST_BASIS = Object.freeze({
  FIXED_ANNUAL_SAR: 'FIXED_ANNUAL_SAR', FIXED_ONE_TIME_SAR: 'FIXED_ONE_TIME_SAR',
  PERCENT_OF_EXPLICIT_BASE_ANNUAL: 'PERCENT_OF_EXPLICIT_BASE_ANNUAL', PER_SQM_ANNUAL_SAR: 'PER_SQM_ANNUAL_SAR',
});
const ANNUAL_ACCRUAL_CONVENTION = Object.freeze({
  ACTUAL_DAYS_365: 'ACTUAL_DAYS_365', FULL_CALENDAR_YEAR_IF_ACTIVE: 'FULL_CALENDAR_YEAR_IF_ACTIVE',
});
const nonEmpty = (v) => typeof v === 'string' && v.trim().length > 0;
const clean = (v) => nonEmpty(v) ? v.trim() : '';
const validSha = (v) => typeof v === 'string' && /^[a-f0-9]{64}$/i.test(v);
const finiteNN = (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0;
const finitePos = (v) => typeof v === 'number' && Number.isFinite(v) && v > 0;
function iso(v, field) { if (!nonEmpty(v) || !Number.isFinite(Date.parse(v))) throw new TypeError(`${field} must be a valid date/time`); return new Date(v).toISOString(); }
function stable(v) { if (Array.isArray(v)) return v.map(stable); if (!v || typeof v !== 'object') return v; return Object.keys(v).sort().reduce((o, k) => { o[k] = stable(v[k]); return o; }, {}); }
function sha256(v) { try { return crypto.createHash('sha256').update(JSON.stringify(stable(v))).digest('hex'); } catch (_) { return null; } }
function without(v, fields) { const o = { ...v }; fields.forEach((f) => delete o[f]); return o; }
function freeze(v) { if (!v || typeof v !== 'object' || Object.isFrozen(v)) return v; Object.values(v).forEach(freeze); return Object.freeze(v); }

function computeRegulatoryCarryCostEvidenceHash(item) { return item && typeof item === 'object' && !Array.isArray(item) ? sha256(without(item, ['costEvidenceHashSha256'])) : null; }
function verifyRegulatoryCarryCostEvidenceIntegrity(item) { return !!item && validSha(item.costEvidenceHashSha256) && computeRegulatoryCarryCostEvidenceHash(item) === item.costEvidenceHashSha256.toLowerCase(); }

function createGovernedRegulatoryCarryCostEvidence(x = {}) {
  const strings = ['itemId','caseId','propertyRef','category','basis','sourceAuthority','sourceRef','sourceEvidenceRef','applicabilityDeterminedByRef','reviewEvidenceRef'];
  strings.forEach((f) => { if (!nonEmpty(x[f])) throw new TypeError(`${f} must be a non-empty string`); });
  if (!Object.values(COST_BASIS).includes(x.basis)) throw new TypeError('UNSUPPORTED_REGULATORY_CARRY_COST_BASIS');
  if ((x.currency || 'SAR') !== 'SAR') throw new TypeError('C12_PHASE0_REQUIRES_SAR');
  if (!validSha(x.sourceVersionHashSha256)) throw new TypeError('C12_SOURCE_VERSION_HASH_REQUIRED');
  if (!validSha(x.reviewEvidenceHashSha256)) throw new TypeError('C12_REVIEW_EVIDENCE_HASH_REQUIRED');
  const sourceVerifiedAt = iso(x.sourceVerifiedAt, 'sourceVerifiedAt');
  const sourceReviewAfter = iso(x.sourceReviewAfter, 'sourceReviewAfter');
  const reviewedAt = iso(x.reviewedAt, 'reviewedAt');
  const validUntil = iso(x.validUntil, 'validUntil');
  if (Date.parse(sourceReviewAfter) < Date.parse(sourceVerifiedAt)) throw new TypeError('C12_SOURCE_REVIEW_AFTER_BEFORE_VERIFIED_AT');
  if (Date.parse(validUntil) < Date.parse(reviewedAt)) throw new TypeError('C12_VALID_UNTIL_BEFORE_REVIEWED_AT');

  let effectiveFrom = null; let effectiveTo = null; let chargeDate = null;
  const econ = { amountSar: null, rate: null, explicitBaseAmountSar: null, ratePerSqmSar: null, explicitAreaSqm: null };
  if (x.basis === COST_BASIS.FIXED_ONE_TIME_SAR) {
    if (!finiteNN(x.amountSar)) throw new TypeError('C12_ONE_TIME_AMOUNT_SAR_INVALID');
    chargeDate = iso(x.chargeDate, 'chargeDate'); econ.amountSar = x.amountSar;
    if (x.annualAccrualConvention != null) throw new TypeError('C12_ONE_TIME_ACCRUAL_CONVENTION_NOT_ALLOWED');
    if (Date.parse(chargeDate) > Date.parse(validUntil)) throw new TypeError('C12_ONE_TIME_CHARGE_AFTER_EVIDENCE_VALIDITY');
  } else {
    effectiveFrom = iso(x.effectiveFrom, 'effectiveFrom'); effectiveTo = iso(x.effectiveTo, 'effectiveTo');
    if (Date.parse(effectiveTo) < Date.parse(effectiveFrom)) throw new TypeError('C12_EFFECTIVE_TO_BEFORE_EFFECTIVE_FROM');
    if (Date.parse(effectiveTo) > Date.parse(validUntil)) throw new TypeError('C12_RECURRING_PERIOD_EXCEEDS_EVIDENCE_VALIDITY');
    if (!Object.values(ANNUAL_ACCRUAL_CONVENTION).includes(x.annualAccrualConvention)) throw new TypeError('C12_ANNUAL_ACCRUAL_CONVENTION_REQUIRED');
    if (x.basis === COST_BASIS.FIXED_ANNUAL_SAR) { if (!finiteNN(x.amountSar)) throw new TypeError('C12_ANNUAL_AMOUNT_SAR_INVALID'); econ.amountSar = x.amountSar; }
    if (x.basis === COST_BASIS.PERCENT_OF_EXPLICIT_BASE_ANNUAL) {
      if (!(finiteNN(x.rate) && x.rate <= 1)) throw new TypeError('C12_PERCENT_RATE_INVALID');
      if (!finiteNN(x.explicitBaseAmountSar)) throw new TypeError('C12_EXPLICIT_BASE_AMOUNT_SAR_INVALID');
      econ.rate = x.rate; econ.explicitBaseAmountSar = x.explicitBaseAmountSar;
    }
    if (x.basis === COST_BASIS.PER_SQM_ANNUAL_SAR) {
      if (!finiteNN(x.ratePerSqmSar)) throw new TypeError('C12_RATE_PER_SQM_SAR_INVALID');
      if (!finitePos(x.explicitAreaSqm)) throw new TypeError('C12_EXPLICIT_AREA_SQM_INVALID');
      econ.ratePerSqmSar = x.ratePerSqmSar; econ.explicitAreaSqm = x.explicitAreaSqm;
    }
  }
  const core = {
    schemaVersion: 1, itemId: x.itemId.trim(), caseId: x.caseId.trim(), propertyRef: x.propertyRef.trim(), category: x.category.trim(), basis: x.basis, currency: 'SAR',
    ...econ, annualAccrualConvention: x.basis === COST_BASIS.FIXED_ONE_TIME_SAR ? null : x.annualAccrualConvention,
    effectiveFrom, effectiveTo, chargeDate, sourceAuthority: x.sourceAuthority.trim(), sourceRef: x.sourceRef.trim(), sourceEvidenceRef: x.sourceEvidenceRef.trim(),
    sourceVersionHashSha256: x.sourceVersionHashSha256.toLowerCase(), sourceVerifiedAt, sourceReviewAfter,
    applicabilityDeterminedByRef: x.applicabilityDeterminedByRef.trim(), reviewedAt, validUntil, reviewEvidenceRef: x.reviewEvidenceRef.trim(),
    reviewEvidenceHashSha256: x.reviewEvidenceHashSha256.toLowerCase(), applicabilityExternallyDetermined: true,
    statutoryRateInferredBySoftware: false, legalApplicabilityInferredBySoftware: false, silentUnitConversionApplied: false,
  };
  return freeze({ ...core, costEvidenceHashSha256: sha256(core) });
}

function regulatoryCostBindings(items) { return Array.isArray(items) ? items.map((x) => ({ itemId: clean(x?.itemId) || null, costEvidenceHashSha256: clean(x?.costEvidenceHashSha256).toLowerCase() || null })).sort((a,b) => String(a.itemId).localeCompare(String(b.itemId))) : []; }
function computeRegulatoryCarryCostReviewPolicyHash(p) { return p && typeof p === 'object' && !Array.isArray(p) ? sha256(without(p, ['policyHashSha256'])) : null; }
function calendarPeriods(start, end) {
  const a = Date.parse(start); const b = Date.parse(end); if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return [];
  const out = []; for (let y = new Date(a).getUTCFullYear(); y <= new Date(b).getUTCFullYear(); y += 1) {
    const ys = new Date(Date.UTC(y,0,1)).toISOString(); const ye = new Date(Date.UTC(y,11,31,23,59,59,999)).toISOString();
    out.push({ year: y, periodStart: a > Date.parse(ys) ? start : ys, periodEnd: b < Date.parse(ye) ? end : ye });
  } return out;
}
function annualAmount(x) {
  if (x.basis === COST_BASIS.FIXED_ANNUAL_SAR) return x.amountSar;
  if (x.basis === COST_BASIS.PERCENT_OF_EXPLICIT_BASE_ANNUAL) return x.rate * x.explicitBaseAmountSar;
  if (x.basis === COST_BASIS.PER_SQM_ANNUAL_SAR) return x.ratePerSqmSar * x.explicitAreaSqm;
  return null;
}
function amountForPeriod(x, p) {
  if (x.basis === COST_BASIS.FIXED_ONE_TIME_SAR) { const d = Date.parse(x.chargeDate); return d >= Date.parse(p.periodStart) && d <= Date.parse(p.periodEnd) ? x.amountSar : 0; }
  const s = Math.max(Date.parse(x.effectiveFrom), Date.parse(p.periodStart)); const e = Math.min(Date.parse(x.effectiveTo), Date.parse(p.periodEnd)); if (e < s) return 0;
  const annual = annualAmount(x); if (!Number.isFinite(annual)) return Number.NaN;
  if (x.annualAccrualConvention === ANNUAL_ACCRUAL_CONVENTION.FULL_CALENDAR_YEAR_IF_ACTIVE) return annual;
  if (x.annualAccrualConvention === ANNUAL_ACCRUAL_CONVENTION.ACTUAL_DAYS_365) return annual * (((e - s + 1) / 86400000) / 365);
  return Number.NaN;
}

function validatePolicy(p, c) {
  const b = []; if (!p || typeof p !== 'object' || Array.isArray(p)) return ['C12_GOVERNED_POLICY_OBJECT_REQUIRED'];
  if (clean(p.version) !== POLICY_VERSION) b.push('C12_POLICY_VERSION_MISMATCH'); if (clean(p.policyId) !== c.policyId) b.push('C12_POLICY_ID_MISMATCH');
  if (clean(p.caseId) !== c.caseId) b.push('C12_POLICY_CASE_MISMATCH'); if (clean(p.propertyRef) !== c.propertyRef) b.push('C12_POLICY_PROPERTY_MISMATCH');
  [['asOfDate','AS_OF_DATE',c.asOfDate],['horizonStart','HORIZON_START',c.horizonStart],['horizonEnd','HORIZON_END',c.horizonEnd]].forEach(([f,l,e]) => { let a=null; try { a=iso(p[f],`policy.${f}`); } catch (_) { b.push(`C12_POLICY_${l}_INVALID`); } if (a && a !== e) b.push(`C12_POLICY_${l}_MISMATCH`); });
  if (JSON.stringify(regulatoryCostBindings(p.costItemBindings)) !== JSON.stringify(c.costItemBindings)) b.push('C12_POLICY_COST_ITEM_BINDINGS_MISMATCH');
  const ac = Array.isArray(p.allowedCategories) ? [...new Set(p.allowedCategories.map(clean).filter(Boolean))] : [];
  const rc = Array.isArray(p.requiredCategories) ? [...new Set(p.requiredCategories.map(clean).filter(Boolean))] : [];
  const ab = Array.isArray(p.allowedBases) ? [...new Set(p.allowedBases)] : []; const aa = Array.isArray(p.allowedAccrualConventions) ? [...new Set(p.allowedAccrualConventions)] : [];
  if (!ac.length) b.push('C12_POLICY_ALLOWED_CATEGORIES_REQUIRED'); if (!ab.length || ab.some((x) => !Object.values(COST_BASIS).includes(x))) b.push('C12_POLICY_ALLOWED_BASES_INVALID');
  if (aa.some((x) => !Object.values(ANNUAL_ACCRUAL_CONVENTION).includes(x))) b.push('C12_POLICY_ACCRUAL_CONVENTIONS_INVALID'); if (rc.some((x) => !ac.includes(x))) b.push('C12_POLICY_REQUIRED_CATEGORY_NOT_ALLOWED');
  if (p.maximumAnnualCarryCostSar != null && !finiteNN(p.maximumAnnualCarryCostSar)) b.push('C12_POLICY_MAX_ANNUAL_CARRY_COST_SAR_INVALID');
  const hs = p.maximumAnnualCarryCostShareOfExplicitReference != null; const hr = p.explicitReferenceAmountSar != null;
  if (hs !== hr) b.push('C12_POLICY_SHARE_THRESHOLD_REFERENCE_PAIR_REQUIRED'); if (hs && !finiteNN(p.maximumAnnualCarryCostShareOfExplicitReference)) b.push('C12_POLICY_MAX_ANNUAL_CARRY_COST_SHARE_INVALID'); if (hr && !finitePos(p.explicitReferenceAmountSar)) b.push('C12_POLICY_EXPLICIT_REFERENCE_AMOUNT_INVALID');
  if (!nonEmpty(p.reviewedByRef)) b.push('C12_POLICY_REVIEWER_REQUIRED'); if (!nonEmpty(p.reviewEvidenceRef)) b.push('C12_POLICY_REVIEW_EVIDENCE_REQUIRED');
  let r=null; try { r=iso(p.reviewedAt,'policy.reviewedAt'); } catch (_) { b.push('C12_POLICY_REVIEWED_AT_INVALID'); } if (r && Date.parse(r) > Date.parse(c.asOfDate)) b.push('C12_POLICY_REVIEW_AFTER_AS_OF');
  const h = computeRegulatoryCarryCostReviewPolicyHash(p); if (!validSha(p.policyHashSha256) || !h || h !== p.policyHashSha256.toLowerCase()) b.push('C12_POLICY_INTEGRITY_HASH_MISMATCH');
  return b;
}

function result(status, blockers, c = {}, schedule = [], items = [], riskFlags = []) {
  const ready = status === REGULATORY_CARRY_STATUS.READY_FOR_PROFESSIONAL_REGULATORY_CARRY_COST_REVIEW;
  return freeze({
    capability: CAPABILITY, policyVersion: POLICY_VERSION, status, professionalRegulatoryCarryCostReviewReady: ready,
    caseId: c.caseId || null, propertyRef: c.propertyRef || null, asOfDate: c.asOfDate || null, horizonStart: c.horizonStart || null, horizonEnd: c.horizonEnd || null,
    reviewPolicyId: c.policyId || null, reviewPolicyHashSha256: c.policyHashSha256 || null, costItemBindings: c.costItemBindings || [],
    schedule, items, totalCarryCostSar: ready ? schedule.reduce((s,p) => s + p.totalCarryCostSar, 0) : null, riskFlags, blockers: [...new Set(blockers)],
    statutoryRateInferredBySoftware: false, legalApplicabilityInferredBySoftware: false, taxOrZakatOpinionEstablished: false,
    acquisitionTransactionCostCalculated: false, exitTransactionCostCalculated: false, discountRateDerived: false, npvCalculated: false, irrCalculated: false,
    certifiedValuationEstablished: false, automaticUnderwritingAdoption: false, automaticAcquisitionRecommendation: false,
    transactionAuthorized: false, approvalAuthorized: false, decisionBinding: false, productionAuthorityGranted: false, publicAiAuthorized: false,
    commercialGoLiveAuthorized: false, canonicalBaselineActivationAuthorized: false,
    semantics: 'C12 quantifies only explicit provenance-bound property-level regulatory carry-cost evidence using caller-selected accrual conventions and governed policy. It does not infer legal applicability, statutory rates, tax/zakat treatment, acquisition/exit transaction costs, valuation, underwriting, transaction authority, or production authority.',
  });
}

function evaluateGovernedRegulatoryCarryCost(x = {}) {
  const c = { caseId: clean(x.caseId) || null, propertyRef: clean(x.propertyRef) || null, asOfDate: null, horizonStart: null, horizonEnd: null, policyId: clean(x.reviewPolicyId) || null, costItemBindings: [] };
  const cb=[]; if (!c.caseId) cb.push('C12_CASE_ID_REQUIRED'); if (!c.propertyRef) cb.push('C12_PROPERTY_REF_REQUIRED');
  try { c.asOfDate=iso(x.asOfDate,'asOfDate'); } catch (_) { cb.push('C12_AS_OF_DATE_INVALID'); } try { c.horizonStart=iso(x.horizonStart,'horizonStart'); } catch (_) { cb.push('C12_HORIZON_START_INVALID'); } try { c.horizonEnd=iso(x.horizonEnd,'horizonEnd'); } catch (_) { cb.push('C12_HORIZON_END_INVALID'); }
  if (c.horizonStart && c.horizonEnd && Date.parse(c.horizonEnd) < Date.parse(c.horizonStart)) cb.push('C12_HORIZON_END_BEFORE_START'); if (c.asOfDate && c.horizonStart && Date.parse(c.horizonStart) < Date.parse(c.asOfDate)) cb.push('C12_HORIZON_START_BEFORE_AS_OF');
  if (cb.length) return result(REGULATORY_CARRY_STATUS.HOLD_CONTEXT, cb, c);
  if (!Array.isArray(x.regulatoryCostEvidence) || !x.regulatoryCostEvidence.length) return result(REGULATORY_CARRY_STATUS.HOLD_EVIDENCE,['C12_REGULATORY_COST_EVIDENCE_REQUIRED'],c);

  const eb=[]; const seen=new Set(); const items=[]; const asOf=Date.parse(c.asOfDate);
  for (const item of x.regulatoryCostEvidence) {
    const id=clean(item?.itemId); if (!id) { eb.push('C12_ITEM_ID_REQUIRED'); continue; } if (seen.has(id)) { eb.push(`C12_DUPLICATE_ITEM_ID:${id}`); continue; } seen.add(id);
    if (!verifyRegulatoryCarryCostEvidenceIntegrity(item)) { eb.push(`C12_COST_EVIDENCE_INTEGRITY_FAILED:${id}`); continue; }
    if (clean(item.caseId)!==c.caseId || clean(item.propertyRef)!==c.propertyRef) { eb.push(`C12_COST_EVIDENCE_CONTEXT_MISMATCH:${id}`); continue; }
    const rv=Date.parse(item.reviewedAt), vu=Date.parse(item.validUntil), sv=Date.parse(item.sourceVerifiedAt), sr=Date.parse(item.sourceReviewAfter);
    if (![rv,vu,sv,sr].every(Number.isFinite)) { eb.push(`C12_COST_EVIDENCE_DATES_INVALID:${id}`); continue; }
    if (!validSha(item.sourceVersionHashSha256) || !validSha(item.reviewEvidenceHashSha256)) { eb.push(`C12_COST_EVIDENCE_SOURCE_OR_REVIEW_HASH_INVALID:${id}`); continue; }
    if (sv>asOf || sr<asOf || sr<sv) { eb.push(`C12_COST_EVIDENCE_SOURCE_STALE_OR_FUTURE:${id}`); continue; } if (rv>asOf) { eb.push(`C12_COST_EVIDENCE_REVIEW_AFTER_AS_OF:${id}`); continue; } if (vu<asOf) { eb.push(`C12_COST_EVIDENCE_EXPIRED:${id}`); continue; }
    if (item.applicabilityExternallyDetermined!==true || item.legalApplicabilityInferredBySoftware!==false || item.statutoryRateInferredBySoftware!==false) { eb.push(`C12_COST_EVIDENCE_AUTHORITY_INVALID:${id}`); continue; }
    if (item.currency!=='SAR' || !Object.values(COST_BASIS).includes(item.basis)) { eb.push(`C12_COST_EVIDENCE_BASIS_OR_CURRENCY_INVALID:${id}`); continue; }
    if (item.basis===COST_BASIS.FIXED_ONE_TIME_SAR) {
      const d=Date.parse(item.chargeDate); if (!finiteNN(item.amountSar) || !Number.isFinite(d)) { eb.push(`C12_ONE_TIME_ECONOMICS_INVALID:${id}`); continue; }
      if (d<Date.parse(c.horizonStart)||d>Date.parse(c.horizonEnd)) { eb.push(`C12_ONE_TIME_CHARGE_OUTSIDE_HORIZON:${id}`); continue; } if (d>vu) { eb.push(`C12_ONE_TIME_CHARGE_AFTER_EVIDENCE_VALIDITY:${id}`); continue; }
    } else {
      const a=Date.parse(item.effectiveFrom), b=Date.parse(item.effectiveTo); if (!Number.isFinite(a)||!Number.isFinite(b)||b<a) { eb.push(`C12_RECURRING_EFFECTIVE_PERIOD_INVALID:${id}`); continue; }
      if (b<Date.parse(c.horizonStart)||a>Date.parse(c.horizonEnd)) { eb.push(`C12_RECURRING_PERIOD_OUTSIDE_HORIZON:${id}`); continue; } if (b>vu) { eb.push(`C12_RECURRING_PERIOD_EXCEEDS_EVIDENCE_VALIDITY:${id}`); continue; }
      if (!Object.values(ANNUAL_ACCRUAL_CONVENTION).includes(item.annualAccrualConvention)||!finiteNN(annualAmount(item))) { eb.push(`C12_RECURRING_ECONOMICS_INVALID:${id}`); continue; }
    } items.push(item);
  }
  if (eb.length) return result(REGULATORY_CARRY_STATUS.HOLD_INTEGRITY,eb,c);
  c.costItemBindings=regulatoryCostBindings(items);
  if (!c.policyId) return result(REGULATORY_CARRY_STATUS.HOLD_POLICY,['C12_GOVERNED_POLICY_ID_REQUIRED'],c);
  if (!x.governedReviewPolicies || typeof x.governedReviewPolicies!=='object' || Array.isArray(x.governedReviewPolicies)) return result(REGULATORY_CARRY_STATUS.HOLD_POLICY,['C12_GOVERNED_POLICY_REGISTRY_REQUIRED'],c);
  const p=x.governedReviewPolicies[c.policyId]; if (!p) return result(REGULATORY_CARRY_STATUS.HOLD_POLICY,[`C12_GOVERNED_POLICY_NOT_FOUND:${c.policyId}`],c);
  const pb=validatePolicy(p,c); if (pb.some((z)=>z.includes('INTEGRITY_HASH')||z.includes('BINDINGS_MISMATCH'))) return result(REGULATORY_CARRY_STATUS.HOLD_INTEGRITY,pb,c); if (pb.length) return result(REGULATORY_CARRY_STATUS.HOLD_POLICY,pb,c); c.policyHashSha256=p.policyHashSha256.toLowerCase();
  const ac=new Set(p.allowedCategories.map(clean)), ab=new Set(p.allowedBases), aa=new Set(p.allowedAccrualConventions||[]), sb=[];
  items.forEach((i)=>{ if(!ac.has(i.category)) sb.push(`C12_CATEGORY_NOT_ALLOWED:${i.itemId}:${i.category}`); if(!ab.has(i.basis)) sb.push(`C12_BASIS_NOT_ALLOWED:${i.itemId}:${i.basis}`); if(i.basis!==COST_BASIS.FIXED_ONE_TIME_SAR&&!aa.has(i.annualAccrualConvention)) sb.push(`C12_ACCRUAL_CONVENTION_NOT_ALLOWED:${i.itemId}:${i.annualAccrualConvention}`); });
  const observed=new Set(items.map((i)=>i.category)); (p.requiredCategories||[]).forEach((q)=>{if(!observed.has(q)) sb.push(`C12_REQUIRED_CATEGORY_MISSING:${q}`);}); if(sb.length) return result(REGULATORY_CARRY_STATUS.HOLD_POLICY,sb,c);
  const periods=calendarPeriods(c.horizonStart,c.horizonEnd); if(!periods.length) return result(REGULATORY_CARRY_STATUS.HOLD_CALCULATION,['C12_ANALYSIS_PERIODS_UNAVAILABLE'],c);
  const schedule=periods.map((period)=>{const itemCharges=items.map((i)=>({itemId:i.itemId,category:i.category,basis:i.basis,amountSar:amountForPeriod(i,period),costEvidenceHashSha256:i.costEvidenceHashSha256})).filter((e)=>e.amountSar!==0);return {...period,itemCharges,totalCarryCostSar:itemCharges.reduce((s,e)=>s+e.amountSar,0)};});
  if(schedule.some((q)=>!finiteNN(q.totalCarryCostSar)||q.itemCharges.some((e)=>!finiteNN(e.amountSar)))) return result(REGULATORY_CARRY_STATUS.HOLD_CALCULATION,['C12_NON_FINITE_OR_NEGATIVE_DERIVED_COST'],c);
  const risk=[]; schedule.forEach((q)=>{if(finiteNN(p.maximumAnnualCarryCostSar)&&q.totalCarryCostSar>p.maximumAnnualCarryCostSar) risk.push(`ANNUAL_CARRY_COST_ABOVE_POLICY_MAXIMUM:${q.year}:${q.totalCarryCostSar}:${p.maximumAnnualCarryCostSar}`); if(finitePos(p.explicitReferenceAmountSar)&&finiteNN(p.maximumAnnualCarryCostShareOfExplicitReference)){const s=q.totalCarryCostSar/p.explicitReferenceAmountSar;if(s>p.maximumAnnualCarryCostShareOfExplicitReference) risk.push(`ANNUAL_CARRY_COST_SHARE_ABOVE_POLICY_MAXIMUM:${q.year}:${s}:${p.maximumAnnualCarryCostShareOfExplicitReference}`);}});
  const summaries=items.map((i)=>({itemId:i.itemId,category:i.category,basis:i.basis,currency:i.currency,annualAccrualConvention:i.annualAccrualConvention,sourceAuthority:i.sourceAuthority,sourceRef:i.sourceRef,sourceEvidenceRef:i.sourceEvidenceRef,sourceVersionHashSha256:i.sourceVersionHashSha256,sourceVerifiedAt:i.sourceVerifiedAt,sourceReviewAfter:i.sourceReviewAfter,applicabilityDeterminedByRef:i.applicabilityDeterminedByRef,reviewEvidenceRef:i.reviewEvidenceRef,reviewEvidenceHashSha256:i.reviewEvidenceHashSha256,costEvidenceHashSha256:i.costEvidenceHashSha256})).sort((a,b)=>a.itemId.localeCompare(b.itemId));
  return result(REGULATORY_CARRY_STATUS.READY_FOR_PROFESSIONAL_REGULATORY_CARRY_COST_REVIEW,[],c,schedule,summaries,risk);
}

module.exports = { CAPABILITY, POLICY_VERSION, REGULATORY_CARRY_STATUS, COST_BASIS, ANNUAL_ACCRUAL_CONVENTION,
  createGovernedRegulatoryCarryCostEvidence, computeRegulatoryCarryCostEvidenceHash, verifyRegulatoryCarryCostEvidenceIntegrity,
  regulatoryCostBindings, computeRegulatoryCarryCostReviewPolicyHash, buildCalendarYearPeriods: calendarPeriods, evaluateGovernedRegulatoryCarryCost };
