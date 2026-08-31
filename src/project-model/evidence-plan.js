'use strict';

const {
  ASSET_CLASS,
  LIFECYCLE_STAGE,
  INVESTMENT_STRATEGY,
  INCOME_MODEL,
} = require('./project-profile');

const EVIDENCE_DOMAIN = Object.freeze({
  IDENTITY: 'IDENTITY',
  LOCATION: 'LOCATION',
  RIGHTS_OWNERSHIP: 'RIGHTS_OWNERSHIP',
  SITE_LAND: 'SITE_LAND',
  BUILT_FORM: 'BUILT_FORM',
  DEVELOPMENT: 'DEVELOPMENT',
  TRANSACTION: 'TRANSACTION',
  LEASING: 'LEASING',
  OPERATIONS: 'OPERATIONS',
  FINANCIAL: 'FINANCIAL',
  FINANCING: 'FINANCING',
  MARKET: 'MARKET',
  VALUATION: 'VALUATION',
  REGULATORY: 'REGULATORY',
  TAX: 'TAX',
  CAPEX: 'CAPEX',
  EXIT: 'EXIT',
  SCHEDULE: 'SCHEDULE',
  RISK: 'RISK',
  ESG: 'ESG',
});

const REQUIREMENT = Object.freeze({
  REQUIRED: 'REQUIRED',
  CONDITIONAL: 'CONDITIONAL',
  RECOMMENDED: 'RECOMMENDED',
});

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) freeze(child);
  return value;
}

function item(domain, requirement, reason) {
  return { domain, requirement, reason };
}

function buildEvidenceDomainPlan(profile) {
  if (!profile || typeof profile !== 'object' || !profile.projectId || !Array.isArray(profile.assetClasses)) {
    throw new TypeError('qualified project profile is required');
  }

  const plan = [
    item(EVIDENCE_DOMAIN.IDENTITY, REQUIREMENT.REQUIRED, 'Every case needs stable project/property identity and source traceability.'),
    item(EVIDENCE_DOMAIN.LOCATION, REQUIREMENT.REQUIRED, 'Location is a core real-estate decision dimension regardless of asset class.'),
    item(EVIDENCE_DOMAIN.RIGHTS_OWNERSHIP, REQUIREMENT.REQUIRED, 'Rights, title, tenure, encumbrances, or equivalent legal interest must be established.'),
    item(EVIDENCE_DOMAIN.MARKET, REQUIREMENT.REQUIRED, 'Market context is required for any investment or development decision.'),
    item(EVIDENCE_DOMAIN.REGULATORY, REQUIREMENT.REQUIRED, 'Planning, licensing, use, and regulatory constraints can change feasibility.'),
    item(EVIDENCE_DOMAIN.RISK, REQUIREMENT.REQUIRED, 'Material risks must be identified independently from financial attractiveness.'),
    item(EVIDENCE_DOMAIN.TAX, REQUIREMENT.RECOMMENDED, 'Applicable taxes and transaction charges should be evidenced before final decision.'),
    item(EVIDENCE_DOMAIN.ESG, REQUIREMENT.RECOMMENDED, 'Environmental and sustainability constraints may affect value, capex, or permissibility.'),
  ];

  const hasLandComponent = profile.assetClasses.includes(ASSET_CLASS.LAND) || profile.traits.hasBuiltAsset || profile.traits.developmentOrRepositioning;
  if (hasLandComponent) {
    plan.push(item(EVIDENCE_DOMAIN.SITE_LAND, profile.traits.landOnly || profile.traits.developmentOrRepositioning ? REQUIREMENT.REQUIRED : REQUIREMENT.RECOMMENDED,
      'Site dimensions, access, services, topography, and plot constraints affect most real-estate assets.'));
  }

  if (profile.traits.hasBuiltAsset) {
    plan.push(item(EVIDENCE_DOMAIN.BUILT_FORM, REQUIREMENT.REQUIRED,
      'Existing or proposed built assets require evidence for areas, configuration, condition, and physical characteristics.'));
  }

  const transactionStrategies = new Set([
    INVESTMENT_STRATEGY.ACQUIRE_HOLD,
    INVESTMENT_STRATEGY.CORE_INCOME,
    INVESTMENT_STRATEGY.DISPOSAL,
    INVESTMENT_STRATEGY.JOINT_VENTURE,
    INVESTMENT_STRATEGY.SALE_LEASEBACK,
    INVESTMENT_STRATEGY.LEASE,
  ]);
  if (transactionStrategies.has(profile.investmentStrategy)) {
    plan.push(item(EVIDENCE_DOMAIN.TRANSACTION, REQUIREMENT.REQUIRED,
      'Transaction structure, price, costs, conditions, and counterparties must be evidenced.'));
  } else {
    plan.push(item(EVIDENCE_DOMAIN.TRANSACTION, REQUIREMENT.RECOMMENDED,
      'Transaction evidence remains useful even when the primary strategy is development or refinancing.'));
  }

  if (profile.traits.developmentOrRepositioning) {
    plan.push(
      item(EVIDENCE_DOMAIN.DEVELOPMENT, REQUIREMENT.REQUIRED, 'Development/repositioning scope and yield assumptions are core feasibility inputs.'),
      item(EVIDENCE_DOMAIN.CAPEX, REQUIREMENT.REQUIRED, 'Construction, fit-out, refurbishment, and contingency costs require evidence.'),
      item(EVIDENCE_DOMAIN.SCHEDULE, REQUIREMENT.REQUIRED, 'Program duration and phasing affect carrying cost, cash flow, and delivery risk.'),
    );
  } else {
    plan.push(item(EVIDENCE_DOMAIN.CAPEX, REQUIREMENT.RECOMMENDED, 'Lifecycle and deferred capex can materially change returns for existing assets.'));
  }

  if ([INCOME_MODEL.LEASE_INCOME, INCOME_MODEL.MIXED].includes(profile.incomeModel)) {
    plan.push(
      item(EVIDENCE_DOMAIN.LEASING, REQUIREMENT.REQUIRED, 'Lease income requires rent, occupancy, tenant, expiry, and service-charge evidence.'),
      item(EVIDENCE_DOMAIN.OPERATIONS, REQUIREMENT.REQUIRED, 'Operating costs and recoveries determine NOI and cash flow.'),
      item(EVIDENCE_DOMAIN.FINANCIAL, REQUIREMENT.REQUIRED, 'Income-producing assets require financial underwriting evidence.'),
    );
  } else if (profile.incomeModel === INCOME_MODEL.OPERATING_BUSINESS) {
    plan.push(
      item(EVIDENCE_DOMAIN.OPERATIONS, REQUIREMENT.REQUIRED, 'Operating-business real estate requires operating evidence beyond lease-only economics.'),
      item(EVIDENCE_DOMAIN.FINANCIAL, REQUIREMENT.REQUIRED, 'Operating performance and property economics must be distinguished and reconciled.'),
      item(EVIDENCE_DOMAIN.LEASING, REQUIREMENT.RECOMMENDED, 'Lease evidence may still matter for operator, management, or third-party occupancy structures.'),
    );
  } else if (profile.incomeModel === INCOME_MODEL.UNIT_SALES) {
    plan.push(item(EVIDENCE_DOMAIN.FINANCIAL, REQUIREMENT.REQUIRED, 'For-sale development requires sales, absorption, cost, and cash-flow evidence.'));
  } else {
    plan.push(item(EVIDENCE_DOMAIN.FINANCIAL, REQUIREMENT.RECOMMENDED, 'Financial evidence is recommended even when the asset is currently non-income-producing.'));
  }

  if (profile.investmentStrategy === INVESTMENT_STRATEGY.REFINANCE) {
    plan.push(item(EVIDENCE_DOMAIN.FINANCING, REQUIREMENT.REQUIRED, 'Refinancing is the primary strategy and financing terms are decision-critical.'));
  } else {
    plan.push(item(EVIDENCE_DOMAIN.FINANCING, REQUIREMENT.RECOMMENDED, 'Financing may materially change equity returns and risk even when not mandatory.'));
  }

  plan.push(
    item(EVIDENCE_DOMAIN.VALUATION, REQUIREMENT.RECOMMENDED, 'Independent or market-supported valuation is useful for price and exit reasonableness.'),
    item(EVIDENCE_DOMAIN.EXIT, REQUIREMENT.RECOMMENDED, 'Exit assumptions should be evidenced when returns depend on terminal value or disposal.'),
  );

  const rank = { [REQUIREMENT.REQUIRED]: 0, [REQUIREMENT.CONDITIONAL]: 1, [REQUIREMENT.RECOMMENDED]: 2 };
  const deduped = new Map();
  for (const entry of plan) {
    const existing = deduped.get(entry.domain);
    if (!existing || rank[entry.requirement] < rank[existing.requirement]) deduped.set(entry.domain, entry);
  }

  const domains = [...deduped.values()];
  return freeze({
    schemaVersion: 1,
    projectId: profile.projectId,
    requiredDomains: domains.filter((entry) => entry.requirement === REQUIREMENT.REQUIRED),
    recommendedDomains: domains.filter((entry) => entry.requirement === REQUIREMENT.RECOMMENDED),
    allDomains: domains,
    semantics: 'Evidence requirements are derived from project traits, never from project names or exemplar cases.',
  });
}

module.exports = { EVIDENCE_DOMAIN, REQUIREMENT, buildEvidenceDomainPlan };
