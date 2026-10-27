// STARTAK location-aware personal scenario engine.
// No network calls, no inferred transactions, no implicit professional approval.
'use strict';

const ASSET_TYPES = Object.freeze({
  RESIDENTIAL_COMPOUND: 'مجمع سكني',
  RESIDENTIAL_BUILDING: 'عمارة سكنية',
  COMMERCIAL_COMPLEX: 'مجمع تجاري',
  OFFICE_TOWER: 'برج مكتبي',
  MIXED_USE: 'متعدد الاستخدامات',
  WAREHOUSE: 'مستودعات',
  LAND: 'أرض',
});

function number(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string' || !value.trim()) return null;
  let s = value.trim().replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[\u066C\u00A0\s,]/g, '').replace(/\u066B/g, '.');
  return /^-?\d+(?:\.\d+)?$/.test(s) ? Number(s) : null;
}
function validCoordinate(lat, lng) {
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}
function extractCoordinates(input) {
  if (typeof input !== 'string' || input.length > 2500) return null;
  const raw = input.trim();
  const plain = raw.match(/^\s*(-?\d+(?:\.\d+)?)\s*[,،]\s*(-?\d+(?:\.\d+)?)\s*$/);
  if (plain) {
    const lat = Number(plain[1]), lng = Number(plain[2]);
    return validCoordinate(lat, lng) ? { lat, lng } : null;
  }
  let url;
  try { url = new URL(raw); } catch { return null; }
  if (url.protocol !== 'https:' || !['google.com', 'www.google.com', 'maps.google.com', 'maps.app.goo.gl', 'goo.gl'].includes(url.hostname)) return null;
  // Shortened map links cannot be resolved locally. Never guess their position.
  let match = url.href.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (!match) match = url.href.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
  if (!match) {
    for (const key of ['q', 'query', 'll', 'center']) {
      const value = url.searchParams.get(key);
      if (value) {
        match = value.match(/^(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/);
        if (match) break;
      }
    }
  }
  if (!match) return null;
  const lat = Number(match[1]), lng = Number(match[2]);
  return validCoordinate(lat, lng) ? { lat, lng } : null;
}
function distanceKm(a, b) {
  if (!a || !b || !validCoordinate(a.lat, a.lng) || !validCoordinate(b.lat, b.lng)) return null;
  const radians = x => x * Math.PI / 180;
  const dLat = radians(b.lat - a.lat), dLng = radians(b.lng - a.lng);
  const q = Math.sin(dLat / 2) ** 2 + Math.cos(radians(a.lat)) * Math.cos(radians(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371.0088 * 2 * Math.atan2(Math.sqrt(q), Math.sqrt(1 - q));
}
function dateIsCurrent(date, now, maximumAgeDays) {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = Date.parse(date + 'T00:00:00Z');
  return Number.isFinite(parsed) && new Date(parsed).toISOString().slice(0, 10) === date &&
    parsed <= now.getTime() && (now.getTime() - parsed) / 86400000 <= maximumAgeDays;
}
function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a,b) => a-b), half = Math.floor(sorted.length/2);
  return sorted.length % 2 ? sorted[half] : (sorted[half-1]+sorted[half])/2;
}
function sourceAvailable(url) {
  if (typeof url !== 'string') return false;
  try { const x = new URL(url); return x.protocol === 'https:' && !x.username && !x.password; }
  catch { return false; }
}
function evaluateMarketStudy({ subject, sales = [], rentals = [], projects = [], assumptions = {}, asOf = new Date() }) {
  const now = asOf instanceof Date ? asOf : new Date(asOf);
  if (!Number.isFinite(now.getTime())) throw new Error('AS_OF_INVALID');
  const type = subject && subject.assetType;
  const location = extractCoordinates(subject?.location || '');
  const basisArea = type === 'LAND' ? number(subject?.landArea) : number(subject?.builtArea);
  const lettableArea = number(subject?.rentableArea);
  const buildings = number(subject?.buildingCount), units = number(subject?.unitCount);
  const occupancy = number(assumptions.occupancy), expenseRatio = number(assumptions.expenseRatio);
  const capRate = number(assumptions.capRate);
  const issues = [];
  if (!Object.prototype.hasOwnProperty.call(ASSET_TYPES, type)) issues.push('ASSET_TYPE_REQUIRED');
  if (!location) issues.push('COORDINATES_REQUIRED');
  if (!(basisArea > 0)) issues.push('COMPARISON_AREA_REQUIRED');
  if (!(lettableArea > 0)) issues.push('RENTABLE_AREA_REQUIRED');
  if (!Number.isInteger(buildings) || buildings < 0) issues.push('BUILDING_COUNT_REQUIRED');
  if (!Number.isInteger(units) || units < 0) issues.push('UNIT_COUNT_REQUIRED');
  if (!(occupancy >= 0 && occupancy <= 1)) issues.push('OCCUPANCY_INVALID');
  if (!(expenseRatio >= 0 && expenseRatio < 1)) issues.push('EXPENSE_RATIO_INVALID');
  if (!(capRate > 0 && capRate < 1)) issues.push('CAP_RATE_INVALID');
  const radius = 5, ageLimit = 365;
  const admissible = (row, amountKey, areaKey) => {
    const amount = number(row?.[amountKey]), area = number(row?.[areaKey]);
    const point = extractCoordinates(row?.location || '');
    const km = distanceKm(location, point);
    return Boolean(location && amount > 0 && area > 0 &&
      row?.assetType === type && row?.status === 'EXECUTED' &&
      sourceAvailable(row?.sourceUrl) && dateIsCurrent(row?.date, now, ageLimit) &&
      km !== null && km <= radius);
  };
  const eligibleSales = sales.filter(r => admissible(r, 'price', type === 'LAND' ? 'landArea' : 'builtArea'));
  const eligibleRentals = rentals.filter(r => admissible(r, 'annualRent', 'rentableArea'));
  const saleUnitValues = eligibleSales.map(r => number(r.price) / number(type === 'LAND' ? r.landArea : r.builtArea));
  const rentUnitValues = eligibleRentals.map(r => number(r.annualRent) / number(r.rentableArea));
  const perSqmSale = eligibleSales.length >= 3 ? median(saleUnitValues) : null;
  const perSqmRent = eligibleRentals.length >= 3 ? median(rentUnitValues) : null;
  const saleIndication = perSqmSale !== null && basisArea > 0 ? perSqmSale * basisArea : null;
  const marketRentPotential = perSqmRent !== null && lettableArea > 0 ? perSqmRent * lettableArea : null;
  const annualOccupiedRent = marketRentPotential !== null && occupancy >= 0 && occupancy <= 1 ? marketRentPotential * occupancy : null;
  const annualNOI = annualOccupiedRent !== null && expenseRatio >= 0 && expenseRatio < 1 ? annualOccupiedRent * (1 - expenseRatio) : null;
  const incomeIndication = annualNOI !== null && capRate > 0 && capRate < 1 ? annualNOI / capRate : null;
  const values = [saleIndication, incomeIndication].filter(x => x !== null);
  const todayValueScenario = values.length ? values.reduce((x,y)=>x+y, 0)/values.length : null;
  const nearbyProjects = projects.map(row => ({
    name: String(row?.name || '').trim().slice(0, 120),
    status: row?.status || 'UNKNOWN',
    sourceUrl: row?.sourceUrl || '',
    distanceKm: distanceKm(location, extractCoordinates(row?.location || '')),
    claimedImpactPct: number(row?.impactPct),
  })).filter(x => x.name && x.distanceKm !== null && x.distanceKm <= 10);
  const supportedProjects = nearbyProjects.filter(x => sourceAvailable(x.sourceUrl));
  // Catalysts are displayed as separately claimed scenarios; never baked into the primary valuation.
  const impacts = supportedProjects.map(x => x.claimedImpactPct)
    .filter(v => v !== null && v >= -0.1 && v <= 0.1);
  const overallScenarioImpact = Math.max(-0.2, Math.min(0.2, impacts.reduce((a,b)=>a+b,0)));
  const projectScenario = todayValueScenario !== null && impacts.length ?
    todayValueScenario * (1 + overallScenarioImpact) : null;
  const inRiyadh = String(subject?.city || '').trim() === 'الرياض';
  const rentRegulation = !inRiyadh || subject?.urbanBoundary !== 'YES' ? 'SCOPE_VERIFICATION_REQUIRED' :
    subject?.leaseHistory === 'FIRST_LEASE' ? 'FIRST_LEASE_TERMS_REQUIRE_REVIEW' :
    subject?.leaseHistory === 'PREVIOUSLY_LEASED' ? 'EXISTING_RENT_FREEZE_REQUIRES_EJAR_REVIEW' : 'LEASE_HISTORY_REQUIRED';
  return {
    asOf: now.toISOString(), location, assetType: type, subjectArea: basisArea,
    eligibleSalesCount: eligibleSales.length, eligibleRentalsCount: eligibleRentals.length,
    excludedSalesCount: sales.length - eligibleSales.length,
    excludedRentalsCount: rentals.length - eligibleRentals.length,
    medianExecutedSaleSarPerSqm: perSqmSale, medianExecutedRentSarPerSqmYear: perSqmRent,
    saleIndicationSar: saleIndication, marketAnnualRentPotentialSar: marketRentPotential,
    expectedCollectedAnnualRentSar: annualOccupiedRent, estimatedAnnualNoiSar: annualNOI,
    incomeIndicationSar: incomeIndication, todayValueScenarioSar: todayValueScenario,
    averageMarketAnnualRentPerUnitSar: marketRentPotential !== null && units > 0 ? marketRentPotential / units : null,
    nearbyProjects: supportedProjects, projectScenarioSar: projectScenario,
    claimedProjectScenarioImpactPct: impacts.length ? overallScenarioImpact : null,
    rentRegulation, issues,
    hasLiveLicensedFeed: false, independentlyVerified: false, certifiedMarketValue: false,
    evidenceStatus: 'USER_ENTERED_UNVERIFIED',
    methodology: 'Median of at least three recent (<=365 days), same-type, within-5-km user-supplied executed transactions or leases; two available methods equally reconciled. Subject land/built/rentable areas must use matching bases. No automatic project uplift.',
  };
}
module.exports = { ASSET_TYPES, number, extractCoordinates, distanceKm, evaluateMarketStudy };
