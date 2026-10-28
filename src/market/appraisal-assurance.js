'use strict';
// Pure, fail-closed appraisal-report diagnostics. No PDF uploads, identifiers, or certified values are bundled.
// Never treat a professional report as a verified market transaction or a model-training label.
const {evaluateSectorAppraisalEvidence}=require('./appraisal-sector-readiness');
const MAX = 1e15;
function number(input) {
  if (typeof input === 'number') return Number.isFinite(input) && Math.abs(input) <= MAX ? input : null;
  if (typeof input !== 'string') return null;
  let s = input.trim().replace(/[\u200e\u200f\u061c\u202a-\u202e]/g, '').replace(/[٠-٩]/g, c => String(c.charCodeAt(0) - 1632)).replace(/[۰-۹]/g, c => String(c.charCodeAt(0) - 1776));
  s = s.replace(/\u066b/g, '.').replace(/\u066c/g, ',');
  // Preserve decimal precision; reject noncanonical grouping rather than silently multiplying by ten.
  if (!/^[+-]?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/.test(s)) return null;
  const n = Number(s.replace(/,/g, ''));
  return Number.isFinite(n) && Math.abs(n) <= MAX ? n : null;
}
const cents = n => Math.round((n + Number.EPSILON) * 100) / 100;
const clean = x => typeof x === 'string' ? x.trim().replace(/\s+/g, ' ') : '';
const id = x => clean(x).replace(/[\s\-]/g, '').replace(/[٠-٩]/g, c => String(c.charCodeAt(0) - 1632));
const comparable = (a, b, toleranceSar = 1000, tolerancePct = 0.25) =>
  Math.abs(a - b) <= Math.max(toleranceSar, Math.abs(b) * tolerancePct / 100);
function issue(code, severity, detail, pages = []) { return {code, severity, detail, pages: [...new Set(pages.filter(p => Number.isInteger(p) && p > 0))]}; }
function auditAppraisal(report = {}) {
  const issues = [], metrics = {};
  const reported = report.reported || {}, income = report.income || {}, rent = report.marketRent || {};
  const provenance = report.provenance || {}, citations = report.pages || {};
  const capital = number(reported.capitalValueSar), marketRent = number(reported.marketRentSar);
  const numeric = (v, label, allowZero = false) => {
    if (v === undefined || v === null || v === '') return null;
    const n = number(v);
    if (n === null || (allowZero ? n < 0 : n <= 0)) issues.push(issue('INVALID_NUMERIC_INPUT', 'BLOCK', label));
    return n !== null && (allowZero ? n >= 0 : n > 0) ? n : null;
  };
  numeric(reported.capitalValueSar, 'reported.capitalValueSar');
  numeric(reported.marketRentSar, 'reported.marketRentSar');
  const noi = numeric(income.annualNoiSar, 'income.annualNoiSar', true);
  const cap = numeric(income.capitalizationRatePct, 'income.capitalizationRatePct');
  const indicated = numeric(income.indicatedValueSar, 'income.indicatedValueSar');
  if (cap !== null && cap > 100) issues.push(issue('CAP_RATE_INVALID', 'BLOCK', 'Capitalization rate exceeds 100%'));
  if (noi !== null && cap !== null && cap <= 100) {
    const calculated = noi / (cap / 100);
    metrics.capitalizedIncomeValueSar = cents(calculated);
    if (indicated !== null && !comparable(indicated, calculated)) {
      metrics.incomeArithmeticDifferenceSar = cents(indicated - calculated);
      issues.push(issue('INCOME_CAPITALIZATION_MISMATCH', 'BLOCK', 'Indicated income-method value does not reconcile to NOI / cap rate', [citations.income]));
    }
  }
  const revenue = numeric(income.annualGrossRevenueSar, 'income.annualGrossRevenueSar', true);
  const vacancy = numeric(income.vacancyLossSar, 'income.vacancyLossSar', true);
  const costs = numeric(income.operatingExpensesSar, 'income.operatingExpensesSar', true);
  if (revenue !== null && vacancy !== null && costs !== null && noi !== null) {
    const expected = revenue - vacancy - costs;
    metrics.recalculatedNoiSar = cents(expected);
    if (expected < 0 || !comparable(noi, expected))
      issues.push(issue('NOI_RECONCILIATION_MISMATCH', 'BLOCK', 'NOI does not reconcile to revenue minus vacancy minus operating expenses', [citations.income]));
  }
  if (costs === 0 && income.leaseStructure !== 'EVIDENCED_TRIPLE_NET')
    issues.push(issue('ZERO_OPERATING_COST_UNSUPPORTED', 'REVIEW', 'Zero owner expenses require evidence of lease allocation', [citations.income]));
  const rentAmount = numeric(rent.annualRentSar, 'marketRent.annualRentSar');
  const rentBasis = numeric(rent.capitalValueBasisSar, 'marketRent.capitalValueBasisSar');
  const rentPct = numeric(rent.percentOfCapitalValue, 'marketRent.percentOfCapitalValue');
  if (rentPct !== null && rentPct > 100) issues.push(issue('RENT_PERCENT_INVALID', 'BLOCK', 'Rent percentage exceeds 100%'));
  if (rentAmount !== null && rentBasis !== null && rentPct !== null && rentPct <= 100) {
    metrics.rentAsValuePercentageSar = cents(rentBasis * rentPct / 100);
    if (!comparable(rentAmount, metrics.rentAsValuePercentageSar, 1, 0.01))
      issues.push(issue('RENT_PERCENTAGE_ARITHMETIC_MISMATCH', 'BLOCK', 'Reported rent does not match percentage × capital basis', [citations.rent]));
  }
  const derivedFromCapital = rent.derivation === 'CAPITAL_VALUE_PERCENTAGE' || (rentBasis !== null && rentPct !== null);
  if (derivedFromCapital) {
    issues.push(issue('RENT_DERIVED_FROM_CAPITAL_NOT_MARKET_EVIDENCE', 'REVIEW', 'Rent derived from asset value is not independent market-rent evidence', [citations.rent]));
    if (income.rentUsesThisEstimate === true || rent.usedAsIncomeApproachEvidence === true)
      issues.push(issue('CIRCULAR_VALUATION', 'BLOCK', 'Income approach reuses rent inferred from value as independent confirmation', [citations.rent, citations.income]));
  }
  if (capital !== null && marketRent !== null) metrics.grossQuotedRentToCapitalPct = cents(marketRent / capital * 100);
  if (!clean(report.valuationDate)) issues.push(issue('VALUATION_DATE_MISSING', 'REVIEW', 'Date of value must be recorded'));
  if (!clean(provenance.reportFileHash)) issues.push(issue('FILE_PROVENANCE_MISSING', 'REVIEW', 'Keep private file SHA-256 in controlled storage; do not put report in public repository'));
  if (provenance.comparableEvidenceIndependentlyVerified !== true)
    issues.push(issue('INDEPENDENT_MARKET_EVIDENCE_NOT_VERIFIED', 'REVIEW', 'External comparable evidence has not been independently confirmed'));
  const sectorSource=report.sectorEvidence&&typeof report.sectorEvidence==='object'?
    Object.fromEntries(Object.entries(report.sectorEvidence).map(([k,v])=>[k,
      typeof v==='string'&&/^(?:availableRoomNights|occupiedRoomNights|roomRevenueSar|otherOperatingRevenueSar|hotelOperatingExpensesSar|ffAndEReserveSar|operatingBusinessExclusionSar|realPropertyNoiSar|grossLeasableAreaSqm|leasedAreaSqm|annualBaseRentSar|annualTurnoverRentSar|annualOtherPropertyRevenueSar|vacancyLossSar|landlordOperatingExpensesSar|builtAreaSqm|netLeasableAreaSqm|clearHeightMeters|annualPropertyRentSar|operatingBusinessIncomeSar)$/.test(k)?
        number(v):v])):{};
  const sector=evaluateSectorAppraisalEvidence({assetType:report.property?.assetType,evidence:sectorSource});
  if(sector.applicable){
    metrics.sectorReview=sector;
    if(sector.status==='HOLD_SPECIALIST_EVIDENCE')
      issues.push(issue('SPECIALIST_EVIDENCE_HOLD','BLOCK',
        'Specialist real-property NOI / operating-business separation and use evidence required',
        [citations.income]));
  }
  const blocked = issues.some(x => x.severity === 'BLOCK');
  return {status: blocked ? 'HOLD' : 'REVIEW_REQUIRED', certification:'NOT_AUTHORIZED', approvedForPublication:false, metrics, issues};
}
const PATHS = ['valuationDate', 'property.owner', 'property.deedNumber', 'property.rightType', 'property.areaSqm',
  'reported.capitalValueSar', 'reported.marketRentSar', 'income.annualNoiSar', 'income.capitalizationRatePct',
  'income.indicatedValueSar', 'income.operatingExpensesSar', 'marketRent.annualRentSar',
  'marketRent.percentOfCapitalValue', 'marketRent.derivation'];
function get(obj, path) { return path.split('.').reduce((v, k) => v && typeof v === 'object' ? v[k] : undefined, obj); }
function compareVersions(left = {}, right = {}) {
  const flags = [];
  const sameReport = clean(left.reportId) && clean(left.reportId) === clean(right.reportId);
  if (!sameReport) flags.push(issue('REPORT_ID_MISMATCH', 'BLOCK', 'Cannot compare unrelated report IDs'));
  const oldDeed = id(get(left,'property.deedNumber')), newDeed = id(get(right,'property.deedNumber'));
  if (sameReport && oldDeed && newDeed && oldDeed !== newDeed)
    flags.push(issue('REPORT_IDENTITY_COLLISION', 'BLOCK', 'Same report ID refers to different deeds; do not collapse versions'));
  const changed = PATHS.flatMap(path => {
    const a = get(left, path), b = get(right, path);
    return a === b ? [] : [{path,previous:a ?? null,current:b ?? null}];
  });
  if (changed.some(x=>['reported.marketRentSar','income.capitalizationRatePct','income.operatingExpensesSar'].includes(x.path)) &&
      !changed.some(x=>x.path === 'reported.capitalValueSar'))
    flags.push(issue('DEPENDENT_VALUE_UNCHANGED', 'REVIEW', 'Assumptions changed while capital value remained unchanged; document the reconciliation'));
  if (changed.some(x=>x.path === 'property.owner'))
    flags.push(issue('OWNER_NAME_CHANGED', 'REVIEW', 'Check legal title and beneficial ownership rather than selecting a version automatically'));
  return {status: flags.some(x=>x.severity==='BLOCK') ? 'HOLD' : changed.length ? 'REVIEW_REQUIRED' : 'NO_DIFFERENCE',
    sameReport: Boolean(sameReport), changed, flags, automaticallySelectLatest:false};
}
function classifyReportIds(reports = []) {
  if (!Array.isArray(reports) || reports.length > 10000) throw Error('REPORT_LIST_INVALID');
  const groups = new Map();
  for (const report of reports) {
    const key = clean(report?.reportId);
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(report);
  }
  return [...groups].map(([reportId, versions]) => ({reportId, count:versions.length,
    status:versions.length>1?'MULTIPLE_VERSIONS_RECONCILIATION_REQUIRED':'SINGLE_REPORT',
    // Do not silently deduplicate property values into a portfolio total.
    additivePortfolioValueSar:null}));
}
module.exports = {number, auditAppraisal, compareVersions, classifyReportIds};
