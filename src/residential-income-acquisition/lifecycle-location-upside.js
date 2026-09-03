'use strict';

const INTELLIGENCE_STATUS = Object.freeze({
  CALCULATED: 'CALCULATED',
  CALCULATED_WITH_GAPS: 'CALCULATED_WITH_GAPS',
  NOT_CALCULABLE: 'NOT_CALCULABLE',
});

const FORWARD_STAGE = Object.freeze({
  RUMORED: 'RUMORED',
  ANNOUNCED: 'ANNOUNCED',
  APPROVED: 'APPROVED',
  FUNDED: 'FUNDED',
  CONTRACTED: 'CONTRACTED',
  UNDER_CONSTRUCTION: 'UNDER_CONSTRUCTION',
  OPERATIONAL: 'OPERATIONAL',
});

const FORWARD_STAGE_CAP = Object.freeze({
  [FORWARD_STAGE.RUMORED]: 0,
  [FORWARD_STAGE.ANNOUNCED]: 0.25,
  [FORWARD_STAGE.APPROVED]: 0.50,
  [FORWARD_STAGE.FUNDED]: 0.65,
  [FORWARD_STAGE.CONTRACTED]: 0.80,
  [FORWARD_STAGE.UNDER_CONSTRUCTION]: 0.90,
  [FORWARD_STAGE.OPERATIONAL]: 1.00,
});

const DIRECTION = Object.freeze({ POSITIVE: 'POSITIVE', NEGATIVE: 'NEGATIVE' });

const UPSIDE_TYPE = Object.freeze({
  SUBDIVISION: 'SUBDIVISION',
  RECONFIGURATION: 'RECONFIGURATION',
  CHANGE_OF_USE: 'CHANGE_OF_USE',
  ADDITIONAL_GFA: 'ADDITIONAL_GFA',
  PARKING_MONETIZATION: 'PARKING_MONETIZATION',
  ROOFTOP_ANCILLARY: 'ROOFTOP_ANCILLARY',
  LEASE_RESTRUCTURING: 'LEASE_RESTRUCTURING',
  AMENITY_UPGRADE: 'AMENITY_UPGRADE',
  ENERGY_RETROFIT: 'ENERGY_RETROFIT',
  OTHER: 'OTHER',
});

const REGULATORY_STATUS = Object.freeze({
  NOT_REVIEWED: 'NOT_REVIEWED',
  POTENTIALLY_FEASIBLE: 'POTENTIALLY_FEASIBLE',
  VERIFIED_FEASIBLE: 'VERIFIED_FEASIBLE',
  RESTRICTED: 'RESTRICTED',
  PROHIBITED: 'PROHIBITED',
});

const REGULATORY_CAP = Object.freeze({
  [REGULATORY_STATUS.NOT_REVIEWED]: 0,
  [REGULATORY_STATUS.POTENTIALLY_FEASIBLE]: 0.50,
  [REGULATORY_STATUS.VERIFIED_FEASIBLE]: 1.00,
  [REGULATORY_STATUS.RESTRICTED]: 0.20,
  [REGULATORY_STATUS.PROHIBITED]: 0,
});

const LOCATION_DIMENSIONS = Object.freeze([
  Object.freeze({ field: 'location.current.accessibilityScore', key: 'accessibility', weight: 0.20, risk: false }),
  Object.freeze({ field: 'location.current.servicesScore', key: 'services', weight: 0.15, risk: false }),
  Object.freeze({ field: 'location.current.employmentAccessScore', key: 'employmentAccess', weight: 0.15, risk: false }),
  Object.freeze({ field: 'location.current.marketDemandScore', key: 'marketDemand', weight: 0.20, risk: false }),
  Object.freeze({ field: 'location.current.exitLiquidityScore', key: 'exitLiquidity', weight: 0.10, risk: false }),
  Object.freeze({ field: 'location.current.environmentalResilienceScore', key: 'environmentalResilience', weight: 0.10, risk: false }),
  Object.freeze({ field: 'location.current.competitiveSupplyRiskScore', key: 'competitiveSupplyRisk', weight: 0.10, risk: true }),
]);

const ADOPTABLE_STATUSES = new Set(['VERIFIED_FACT', 'OBSERVED', 'ASSUMED']);
const LIFECYCLE_REQUIRED = Object.freeze([
  'category',
  'conditionScore',
  'remainingUsefulLifeYears',
  'replacementCost',
  'replacementYearOffset',
  'downtimeDays',
  'criticality',
]);
const FORWARD_REQUIRED = Object.freeze(['stage', 'direction', 'impactScore', 'probability', 'distanceKm']);
const UPSIDE_REQUIRED = Object.freeze([
  'type',
  'regulatoryStatus',
  'capex',
  'executionPeriodYears',
  'annualNoiLossDuringExecution',
  'incrementalAnnualNoi',
  'probability',
]);

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function finite(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function adopted(input) {
  return Boolean(
    input
    && input.adoptedForUnderwriting === true
    && ADOPTABLE_STATUSES.has(input.verificationStatus)
    && input.value !== null
    && input.value !== undefined,
  );
}

function projectedLineage(input) {
  if (!input) return null;
  return {
    field: input.field,
    value: input.value,
    unit: input.unit || null,
    sourceRef: input.sourceRef || null,
    verificationStatus: input.verificationStatus || null,
    confidence: finite(input.confidence) ? input.confidence : null,
    effectiveDate: input.effectiveDate || null,
    adoptionDecisionRef: input.adoptionDecisionRef || null,
    lineageRefs: Array.isArray(input.lineageRefs) ? [...input.lineageRefs] : [],
  };
}

function allInputs(operatingCase) {
  return Array.isArray(operatingCase && operatingCase.additionalOperatingInputs)
    ? operatingCase.additionalOperatingInputs
    : [];
}

function inputMap(operatingCase) {
  const map = new Map();
  for (const input of allInputs(operatingCase)) {
    if (input && typeof input.field === 'string' && !map.has(input.field)) map.set(input.field, input);
  }
  return map;
}

function collectDynamic(operatingCase, regex) {
  const grouped = new Map();
  for (const input of allInputs(operatingCase)) {
    if (!input || typeof input.field !== 'string') continue;
    const match = input.field.match(regex);
    if (!match) continue;
    const id = match[1];
    const attribute = match[2];
    if (!grouped.has(id)) grouped.set(id, {});
    grouped.get(id)[attribute] = input;
  }
  return grouped;
}

function usableNumber(input, min = -Infinity, max = Infinity) {
  return adopted(input) && finite(input.value) && input.value >= min && input.value <= max;
}

function usableString(input, allowed = null) {
  return adopted(input)
    && typeof input.value === 'string'
    && input.value.trim() !== ''
    && (!allowed || allowed.has(input.value));
}

function lifecycleComponent(record, componentId, issues) {
  const missing = LIFECYCLE_REQUIRED.filter((attr) => !record[attr]);
  if (missing.length) {
    issues.push({ code: 'LIFECYCLE_COMPONENT_FIELDS_MISSING', componentId, fields: missing });
    return null;
  }
  if (!usableString(record.category)) issues.push({ code: 'LIFECYCLE_CATEGORY_NOT_ADOPTED', componentId, field: record.category.field });
  if (!usableNumber(record.conditionScore, 0, 100)) issues.push({ code: 'LIFECYCLE_CONDITION_SCORE_INVALID', componentId, field: record.conditionScore.field });
  if (!usableNumber(record.remainingUsefulLifeYears, 0, 200)) issues.push({ code: 'LIFECYCLE_RUL_INVALID', componentId, field: record.remainingUsefulLifeYears.field });
  if (!usableNumber(record.replacementCost, 0)) issues.push({ code: 'LIFECYCLE_REPLACEMENT_COST_INVALID', componentId, field: record.replacementCost.field });
  if (!usableNumber(record.replacementYearOffset, 0, 200) || !Number.isInteger(record.replacementYearOffset.value)) issues.push({ code: 'LIFECYCLE_REPLACEMENT_YEAR_INVALID', componentId, field: record.replacementYearOffset.field });
  if (!usableNumber(record.downtimeDays, 0, 3650)) issues.push({ code: 'LIFECYCLE_DOWNTIME_INVALID', componentId, field: record.downtimeDays.field });
  if (!usableString(record.criticality)) issues.push({ code: 'LIFECYCLE_CRITICALITY_NOT_ADOPTED', componentId, field: record.criticality.field });
  if (issues.some((item) => item.componentId === componentId && item.code !== 'LIFECYCLE_COMPONENT_FIELDS_MISSING')) return null;

  const replacementCost = record.replacementCost.value;
  const remainingUsefulLifeYears = record.remainingUsefulLifeYears.value;
  return {
    componentId,
    category: record.category.value,
    conditionScore: record.conditionScore.value,
    remainingUsefulLifeYears,
    replacementCost,
    replacementYearOffset: record.replacementYearOffset.value,
    downtimeDays: record.downtimeDays.value,
    criticality: record.criticality.value,
    annualizedReserveProxy: replacementCost > 0 ? replacementCost / Math.max(remainingUsefulLifeYears, 1) : 0,
    lineage: Object.fromEntries(LIFECYCLE_REQUIRED.map((attr) => [attr, projectedLineage(record[attr])])),
  };
}

function calculateLifecycleIntelligence(operatingCase) {
  const issues = [];
  const grouped = collectDynamic(operatingCase, /^lifecycle\.component\.([^.]+)\.([A-Za-z0-9_]+)$/);
  if (!grouped.size) {
    return deepFreeze({
      schemaVersion: 1,
      caseId: operatingCase && operatingCase.caseId || null,
      status: INTELLIGENCE_STATUS.NOT_CALCULABLE,
      issues: [{ code: 'LIFECYCLE_COMPONENT_REGISTRY_REQUIRED', field: 'lifecycle.component.*' }],
      components: [],
      metrics: null,
      semantics: 'Lifecycle intelligence requires evidence-linked, adopted component condition, remaining-life, replacement-cost, replacement-timing, downtime, category, and criticality inputs. No legal or engineering conclusion is produced.',
    });
  }

  const components = [];
  for (const [componentId, record] of grouped.entries()) {
    const component = lifecycleComponent(record, componentId, issues);
    if (component) components.push(component);
  }
  if (!components.length) {
    return deepFreeze({
      schemaVersion: 1,
      caseId: operatingCase && operatingCase.caseId || null,
      status: INTELLIGENCE_STATUS.NOT_CALCULABLE,
      issues,
      components: [],
      metrics: null,
      semantics: 'Lifecycle intelligence was not calculated because no complete evidence-gated component record passed validation.',
    });
  }

  const costWeight = components.reduce((sum, item) => sum + item.replacementCost, 0);
  const weightedConditionScore = costWeight > 0
    ? components.reduce((sum, item) => sum + (item.conditionScore * item.replacementCost), 0) / costWeight
    : components.reduce((sum, item) => sum + item.conditionScore, 0) / components.length;
  const due3 = components.filter((item) => item.replacementYearOffset <= 3);
  const due5 = components.filter((item) => item.replacementYearOffset <= 5);
  const criticalDue = due3.filter((item) => ['LIFE_SAFETY', 'MISSION_CRITICAL', 'HIGH'].includes(item.criticality));
  const metrics = {
    componentCount: components.length,
    weightedConditionScore,
    knownReplacementCapex3y: due3.reduce((sum, item) => sum + item.replacementCost, 0),
    knownReplacementCapex5y: due5.reduce((sum, item) => sum + item.replacementCost, 0),
    componentsDueWithin3y: due3.length,
    componentsDueWithin5y: due5.length,
    criticalComponentsDueWithin3y: criticalDue.length,
    downtimeDaysDueWithin3y: due3.reduce((sum, item) => sum + item.downtimeDays, 0),
    annualizedLifecycleReserveProxy: components.reduce((sum, item) => sum + item.annualizedReserveProxy, 0),
  };
  const status = issues.length ? INTELLIGENCE_STATUS.CALCULATED_WITH_GAPS : INTELLIGENCE_STATUS.CALCULATED;
  return deepFreeze({
    schemaVersion: 1,
    caseId: operatingCase && operatingCase.caseId || null,
    status,
    issues,
    components,
    metrics,
    engineeringConclusion: null,
    legalConclusion: null,
    semantics: 'Lifecycle metrics are analytical planning outputs derived only from adopted evidence-linked component inputs. Annualized reserve is a planning proxy, not an engineering estimate, certified valuation, or maintenance instruction.',
  });
}

function calculateLocationIntelligence(operatingCase) {
  const map = inputMap(operatingCase);
  const issues = [];
  const dimensions = [];
  let weighted = 0;
  let usedWeight = 0;
  for (const definition of LOCATION_DIMENSIONS) {
    const input = map.get(definition.field);
    if (!usableNumber(input, 0, 100)) {
      issues.push({ code: 'LOCATION_DIMENSION_REQUIRED', field: definition.field });
      continue;
    }
    const normalized = definition.risk ? 100 - input.value : input.value;
    weighted += normalized * definition.weight;
    usedWeight += definition.weight;
    dimensions.push({
      key: definition.key,
      rawScore: input.value,
      normalizedScore: normalized,
      weight: definition.weight,
      riskDimension: definition.risk,
      lineage: projectedLineage(input),
    });
  }
  if (!dimensions.length) {
    return deepFreeze({
      schemaVersion: 1,
      caseId: operatingCase && operatingCase.caseId || null,
      status: INTELLIGENCE_STATUS.NOT_CALCULABLE,
      issues,
      currentLocationScore: null,
      dimensions: [],
      evidenceCoverage: 0,
      semantics: 'Location intelligence requires adopted evidence-linked dimension scores. The engine does not infer a neighborhood score from a place name alone.',
    });
  }
  const score = usedWeight > 0 ? weighted / usedWeight : null;
  return deepFreeze({
    schemaVersion: 1,
    caseId: operatingCase && operatingCase.caseId || null,
    status: issues.length ? INTELLIGENCE_STATUS.CALCULATED_WITH_GAPS : INTELLIGENCE_STATUS.CALCULATED,
    issues,
    currentLocationScore: score,
    dimensions,
    evidenceCoverage: dimensions.length / LOCATION_DIMENSIONS.length,
    semantics: 'The current-location score is an evidence-weighted analytical index across accessibility, services, employment access, demand, exit liquidity, resilience, and competitive supply risk. It is not a certified valuation or prediction.',
  });
}

function forwardCatalyst(record, catalystId, issues) {
  const missing = FORWARD_REQUIRED.filter((attr) => !record[attr]);
  if (missing.length) {
    issues.push({ code: 'FORWARD_CATALYST_FIELDS_MISSING', catalystId, fields: missing });
    return null;
  }
  const stages = new Set(Object.values(FORWARD_STAGE));
  const directions = new Set(Object.values(DIRECTION));
  if (!usableString(record.stage, stages)) issues.push({ code: 'FORWARD_STAGE_INVALID', catalystId, field: record.stage.field });
  if (!usableString(record.direction, directions)) issues.push({ code: 'FORWARD_DIRECTION_INVALID', catalystId, field: record.direction.field });
  if (!usableNumber(record.impactScore, 0, 100)) issues.push({ code: 'FORWARD_IMPACT_INVALID', catalystId, field: record.impactScore.field });
  if (!usableNumber(record.probability, 0, 1)) issues.push({ code: 'FORWARD_PROBABILITY_INVALID', catalystId, field: record.probability.field });
  if (!usableNumber(record.distanceKm, 0, 1000)) issues.push({ code: 'FORWARD_DISTANCE_INVALID', catalystId, field: record.distanceKm.field });
  for (const attr of ['rentPressureScore', 'vacancyPressureScore', 'exitLiquidityImpactScore']) {
    if (record[attr] && !usableNumber(record[attr], -100, 100)) issues.push({ code: 'FORWARD_EFFECT_INVALID', catalystId, field: record[attr].field });
  }
  if (record.expectedCompletionYear && (!usableNumber(record.expectedCompletionYear, 1900, 2200) || !Number.isInteger(record.expectedCompletionYear.value))) {
    issues.push({ code: 'FORWARD_COMPLETION_YEAR_INVALID', catalystId, field: record.expectedCompletionYear.field });
  }
  if (issues.some((item) => item.catalystId === catalystId && item.code !== 'FORWARD_CATALYST_FIELDS_MISSING')) return null;

  const stageCap = FORWARD_STAGE_CAP[record.stage.value];
  const probability = Math.min(record.probability.value, stageCap);
  const distanceFactor = 1 / (1 + (record.distanceKm.value / 5));
  const sign = record.direction.value === DIRECTION.POSITIVE ? 1 : -1;
  const effectiveImpact = sign * record.impactScore.value * probability * distanceFactor;
  const readEffect = (attr) => record[attr] && adopted(record[attr]) && finite(record[attr].value) ? record[attr].value * probability * distanceFactor : null;
  return {
    catalystId,
    stage: record.stage.value,
    direction: record.direction.value,
    impactScore: record.impactScore.value,
    statedProbability: record.probability.value,
    stageProbabilityCap: stageCap,
    effectiveProbability: probability,
    distanceKm: record.distanceKm.value,
    distanceFactor,
    expectedCompletionYear: record.expectedCompletionYear && adopted(record.expectedCompletionYear) ? record.expectedCompletionYear.value : null,
    effectiveImpact,
    rentPressureImpact: readEffect('rentPressureScore'),
    vacancyPressureImpact: readEffect('vacancyPressureScore'),
    exitLiquidityImpact: readEffect('exitLiquidityImpactScore'),
    lineage: Object.fromEntries(Object.entries(record).map(([key, input]) => [key, projectedLineage(input)])),
  };
}

function pressureDirection(score) {
  if (!finite(score)) return 'UNAVAILABLE';
  if (score >= 15) return 'POSITIVE';
  if (score <= -15) return 'NEGATIVE';
  return 'NEUTRAL';
}

function calculateForwardAttractionIntelligence(operatingCase) {
  const issues = [];
  const grouped = collectDynamic(operatingCase, /^forward\.catalyst\.([^.]+)\.([A-Za-z0-9_]+)$/);
  if (!grouped.size) {
    return deepFreeze({
      schemaVersion: 1,
      caseId: operatingCase && operatingCase.caseId || null,
      status: INTELLIGENCE_STATUS.NOT_CALCULABLE,
      issues: [{ code: 'FORWARD_CATALYST_REGISTRY_REQUIRED', field: 'forward.catalyst.*' }],
      catalysts: [],
      forwardAttractionScore: null,
      attractionDirection: 'UNAVAILABLE',
      semantics: 'Forward attraction is not inferred from announcements alone. Each catalyst requires an adopted stage, impact, probability, distance, and direction with evidence lineage.',
    });
  }
  const catalysts = [];
  for (const [catalystId, record] of grouped.entries()) {
    const item = forwardCatalyst(record, catalystId, issues);
    if (item) catalysts.push(item);
  }
  if (!catalysts.length) {
    return deepFreeze({
      schemaVersion: 1,
      caseId: operatingCase && operatingCase.caseId || null,
      status: INTELLIGENCE_STATUS.NOT_CALCULABLE,
      issues,
      catalysts: [],
      forwardAttractionScore: null,
      attractionDirection: 'UNAVAILABLE',
      semantics: 'Forward attraction was not calculated because no catalyst passed evidence and range validation.',
    });
  }
  const impactDenominator = catalysts.reduce((sum, item) => sum + (item.effectiveProbability * item.distanceFactor), 0);
  const score = impactDenominator > 0
    ? clamp(catalysts.reduce((sum, item) => sum + item.effectiveImpact, 0) / impactDenominator, -100, 100)
    : 0;
  const effectAverage = (key) => {
    const usable = catalysts.filter((item) => finite(item[key]));
    if (!usable.length) return null;
    const denom = usable.reduce((sum, item) => sum + (item.effectiveProbability * item.distanceFactor), 0);
    if (denom <= 0) return 0;
    return clamp(usable.reduce((sum, item) => sum + item[key], 0) / denom, -100, 100);
  };
  const rentPressureScore = effectAverage('rentPressureImpact');
  const vacancyPressureScore = effectAverage('vacancyPressureImpact');
  const exitLiquidityScore = effectAverage('exitLiquidityImpact');
  return deepFreeze({
    schemaVersion: 1,
    caseId: operatingCase && operatingCase.caseId || null,
    status: issues.length ? INTELLIGENCE_STATUS.CALCULATED_WITH_GAPS : INTELLIGENCE_STATUS.CALCULATED,
    issues,
    catalysts,
    forwardAttractionScore: score,
    attractionDirection: pressureDirection(score),
    rentGrowthPressure: { score: rentPressureScore, direction: pressureDirection(rentPressureScore) },
    vacancyPressure: { score: vacancyPressureScore, direction: pressureDirection(vacancyPressureScore) },
    exitLiquidityPressure: { score: exitLiquidityScore, direction: pressureDirection(exitLiquidityScore) },
    methodology: 'effectiveImpact = signedImpact × min(statedProbability, stageCap) × distanceFactor; stage caps are transparent analytical policy, not external facts',
    investmentRecommendation: null,
    semantics: 'Forward-attraction outputs are probability-haircut analytical signals. They do not automatically alter rent growth, vacancy, exit cap rates, or terminal value and must not be double-counted in financial scenarios.',
  });
}

function upsideCatalyst(record, catalystId, issues) {
  const missing = UPSIDE_REQUIRED.filter((attr) => !record[attr]);
  if (missing.length) {
    issues.push({ code: 'UPSIDE_CATALYST_FIELDS_MISSING', catalystId, fields: missing });
    return null;
  }
  const types = new Set(Object.values(UPSIDE_TYPE));
  const statuses = new Set(Object.values(REGULATORY_STATUS));
  if (!usableString(record.type, types)) issues.push({ code: 'UPSIDE_TYPE_INVALID', catalystId, field: record.type.field });
  if (!usableString(record.regulatoryStatus, statuses)) issues.push({ code: 'UPSIDE_REGULATORY_STATUS_INVALID', catalystId, field: record.regulatoryStatus.field });
  if (!usableNumber(record.capex, 0)) issues.push({ code: 'UPSIDE_CAPEX_INVALID', catalystId, field: record.capex.field });
  if (!usableNumber(record.executionPeriodYears, 0, 50)) issues.push({ code: 'UPSIDE_EXECUTION_INVALID', catalystId, field: record.executionPeriodYears.field });
  if (!usableNumber(record.annualNoiLossDuringExecution, 0)) issues.push({ code: 'UPSIDE_NOI_LOSS_INVALID', catalystId, field: record.annualNoiLossDuringExecution.field });
  if (!usableNumber(record.incrementalAnnualNoi, -1e15, 1e15)) issues.push({ code: 'UPSIDE_INCREMENTAL_NOI_INVALID', catalystId, field: record.incrementalAnnualNoi.field });
  if (!usableNumber(record.probability, 0, 1)) issues.push({ code: 'UPSIDE_PROBABILITY_INVALID', catalystId, field: record.probability.field });
  if (issues.some((item) => item.catalystId === catalystId && item.code !== 'UPSIDE_CATALYST_FIELDS_MISSING')) return null;

  const regulatoryStatus = record.regulatoryStatus.value;
  const regulatoryCap = REGULATORY_CAP[regulatoryStatus];
  const effectiveProbability = Math.min(record.probability.value, regulatoryCap);
  const capex = record.capex.value;
  const incrementalAnnualNoi = record.incrementalAnnualNoi.value;
  const profitOnCostProxy = capex > 0 ? incrementalAnnualNoi / capex : null;
  const simplePaybackYears = capex > 0 && incrementalAnnualNoi > 0 ? capex / incrementalAnnualNoi : null;
  return {
    catalystId,
    type: record.type.value,
    regulatoryStatus,
    regulatoryProbabilityCap: regulatoryCap,
    statedProbability: record.probability.value,
    effectiveProbability,
    capex,
    executionPeriodYears: record.executionPeriodYears.value,
    annualNoiLossDuringExecution: record.annualNoiLossDuringExecution.value,
    incrementalAnnualNoi,
    probabilityAdjustedIncrementalAnnualNoi: incrementalAnnualNoi * effectiveProbability,
    probabilityAdjustedCapexForExpectedValueOnly: capex * effectiveProbability,
    profitOnCostProxy,
    simplePaybackYears,
    requiresRegulatoryVerification: regulatoryStatus !== REGULATORY_STATUS.VERIFIED_FEASIBLE,
    prohibited: regulatoryStatus === REGULATORY_STATUS.PROHIBITED,
    lineage: Object.fromEntries(Object.entries(record).map(([key, input]) => [key, projectedLineage(input)])),
  };
}

function calculateUpsideIntelligence(operatingCase) {
  const issues = [];
  const grouped = collectDynamic(operatingCase, /^upside\.catalyst\.([^.]+)\.([A-Za-z0-9_]+)$/);
  if (!grouped.size) {
    return deepFreeze({
      schemaVersion: 1,
      caseId: operatingCase && operatingCase.caseId || null,
      status: INTELLIGENCE_STATUS.NOT_CALCULABLE,
      issues: [{ code: 'UPSIDE_CATALYST_REGISTRY_REQUIRED', field: 'upside.catalyst.*' }],
      catalysts: [],
      metrics: null,
      legalConclusion: null,
      semantics: 'Upside and subdivision intelligence requires evidence-linked catalyst economics and an explicit regulatory status. Potential feasibility is not treated as legal approval.',
    });
  }
  const catalysts = [];
  for (const [catalystId, record] of grouped.entries()) {
    const item = upsideCatalyst(record, catalystId, issues);
    if (item) catalysts.push(item);
  }
  if (!catalysts.length) {
    return deepFreeze({
      schemaVersion: 1,
      caseId: operatingCase && operatingCase.caseId || null,
      status: INTELLIGENCE_STATUS.NOT_CALCULABLE,
      issues,
      catalysts: [],
      metrics: null,
      legalConclusion: null,
      semantics: 'Upside intelligence was not calculated because no catalyst passed evidence, economic, and regulatory-status validation.',
    });
  }
  const eligible = catalysts.filter((item) => !item.prohibited && item.effectiveProbability > 0);
  const metrics = {
    catalystCount: catalysts.length,
    eligibleCatalystCount: eligible.length,
    verifiedFeasibleCount: catalysts.filter((item) => item.regulatoryStatus === REGULATORY_STATUS.VERIFIED_FEASIBLE).length,
    regulatoryVerificationRequiredCount: catalysts.filter((item) => item.requiresRegulatoryVerification).length,
    prohibitedCount: catalysts.filter((item) => item.prohibited).length,
    grossCapexIfAllEligibleExecuted: eligible.reduce((sum, item) => sum + item.capex, 0),
    grossIncrementalAnnualNoiIfAllEligibleExecuted: eligible.reduce((sum, item) => sum + item.incrementalAnnualNoi, 0),
    probabilityAdjustedIncrementalAnnualNoi: eligible.reduce((sum, item) => sum + item.probabilityAdjustedIncrementalAnnualNoi, 0),
    probabilityAdjustedCapexForExpectedValueOnly: eligible.reduce((sum, item) => sum + item.probabilityAdjustedCapexForExpectedValueOnly, 0),
  };
  return deepFreeze({
    schemaVersion: 1,
    caseId: operatingCase && operatingCase.caseId || null,
    status: issues.length ? INTELLIGENCE_STATUS.CALCULATED_WITH_GAPS : INTELLIGENCE_STATUS.CALCULATED,
    issues,
    catalysts,
    metrics,
    legalConclusion: null,
    investmentRecommendation: null,
    semantics: 'Catalyst economics are analytical and evidence-gated. POTENTIALLY_FEASIBLE is capped and remains Regulatory Verification Required. Probability-adjusted CAPEX is for expected-value comparison only; an executed catalyst still incurs its full modeled CAPEX.',
  });
}

function calculateLifecycleLocationUpsideIntelligence(operatingCase) {
  if (!operatingCase || typeof operatingCase !== 'object') throw new TypeError('operatingCase must be an object');
  const lifecycle = calculateLifecycleIntelligence(operatingCase);
  const location = calculateLocationIntelligence(operatingCase);
  const forwardAttraction = calculateForwardAttractionIntelligence(operatingCase);
  const upside = calculateUpsideIntelligence(operatingCase);
  const statuses = [lifecycle.status, location.status, forwardAttraction.status, upside.status];
  const calculatedCount = statuses.filter((status) => status !== INTELLIGENCE_STATUS.NOT_CALCULABLE).length;
  const status = calculatedCount === 4 && statuses.every((item) => item === INTELLIGENCE_STATUS.CALCULATED)
    ? INTELLIGENCE_STATUS.CALCULATED
    : calculatedCount > 0
      ? INTELLIGENCE_STATUS.CALCULATED_WITH_GAPS
      : INTELLIGENCE_STATUS.NOT_CALCULABLE;
  return deepFreeze({
    schemaVersion: 1,
    caseId: operatingCase.caseId || null,
    asOfDate: operatingCase.asOfDate || null,
    status,
    lifecycle,
    location,
    forwardAttraction,
    upside,
    calculatedModuleCount: calculatedCount,
    investmentDecision: null,
    legalConclusion: null,
    transactionAuthorized: false,
    semantics: 'This bundle separates current asset condition, current location quality, forward attraction, and upside catalysts. It does not convert announcements, potential subdivision, or analytical signals into an automatic investment recommendation or legal conclusion.',
  });
}

module.exports = {
  INTELLIGENCE_STATUS,
  FORWARD_STAGE,
  FORWARD_STAGE_CAP,
  DIRECTION,
  UPSIDE_TYPE,
  REGULATORY_STATUS,
  REGULATORY_CAP,
  LOCATION_DIMENSIONS,
  calculateLifecycleIntelligence,
  calculateLocationIntelligence,
  calculateForwardAttractionIntelligence,
  calculateUpsideIntelligence,
  calculateLifecycleLocationUpsideIntelligence,
};
