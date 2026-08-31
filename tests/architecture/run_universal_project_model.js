'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { STUDY_TYPE } = require('../../src/contracts/study-type');
const {
  ASSET_CLASS,
  LIFECYCLE_STAGE,
  INVESTMENT_STRATEGY,
  INCOME_MODEL,
  EVIDENCE_DOMAIN,
  REQUIREMENT,
  ENGINE_ROUTE_STATUS,
  createProjectProfile,
  buildEvidenceDomainPlan,
  resolveExecutableEngine,
} = require('../../src/project-model');

function domains(plan, requirement) {
  return new Set(plan.allDomains.filter((item) => !requirement || item.requirement === requirement).map((item) => item.domain));
}

function assertDomains(plan, requirement, expected) {
  const actual = domains(plan, requirement);
  for (const domain of expected) assert.ok(actual.has(domain), `${domain} expected as ${requirement || 'planned'}`);
}

function decisionSignature(profile) {
  const plan = buildEvidenceDomainPlan(profile);
  const route = resolveExecutableEngine(profile);
  return {
    domains: plan.allDomains.map(({ domain, requirement }) => `${domain}:${requirement}`).sort(),
    route: { status: route.status, studyType: route.studyType, adapterId: route.adapterId },
  };
}

function main() {
  let checks = 0;
  const check = (condition, message) => { assert.ok(condition, message); checks++; };

  const land = createProjectProfile({
    projectId: 'P-LAND-001',
    projectName: 'Generic Land Development',
    assetClasses: [ASSET_CLASS.LAND],
    lifecycleStage: LIFECYCLE_STAGE.PLANNED,
    investmentStrategy: INVESTMENT_STRATEGY.DEVELOPMENT,
    incomeModel: INCOME_MODEL.UNIT_SALES,
  });
  check(land.traits.landOnly === true && land.traits.hasBuiltAsset === false, 'Land traits are incorrect');
  const landPlan = buildEvidenceDomainPlan(land);
  assertDomains(landPlan, REQUIREMENT.REQUIRED, [
    EVIDENCE_DOMAIN.IDENTITY, EVIDENCE_DOMAIN.LOCATION, EVIDENCE_DOMAIN.RIGHTS_OWNERSHIP,
    EVIDENCE_DOMAIN.SITE_LAND, EVIDENCE_DOMAIN.DEVELOPMENT, EVIDENCE_DOMAIN.CAPEX,
    EVIDENCE_DOMAIN.SCHEDULE, EVIDENCE_DOMAIN.MARKET, EVIDENCE_DOMAIN.REGULATORY, EVIDENCE_DOMAIN.RISK,
  ]);
  checks++;
  const landRoute = resolveExecutableEngine(land);
  check(landRoute.status === ENGINE_ROUTE_STATUS.QUALIFIED && landRoute.studyType === STUDY_TYPE.LAND_DEVELOPMENT, 'Land development should route only to qualified LAND_DEVELOPMENT engine');

  const office = createProjectProfile({
    projectId: 'P-OFFICE-001',
    assetClasses: [ASSET_CLASS.OFFICE],
    lifecycleStage: LIFECYCLE_STAGE.EXISTING_OPERATING,
    investmentStrategy: INVESTMENT_STRATEGY.ACQUIRE_HOLD,
    incomeModel: INCOME_MODEL.LEASE_INCOME,
  });
  const officePlan = buildEvidenceDomainPlan(office);
  assertDomains(officePlan, REQUIREMENT.REQUIRED, [
    EVIDENCE_DOMAIN.BUILT_FORM, EVIDENCE_DOMAIN.TRANSACTION, EVIDENCE_DOMAIN.LEASING,
    EVIDENCE_DOMAIN.OPERATIONS, EVIDENCE_DOMAIN.FINANCIAL,
  ]);
  checks++;
  const officeRoute = resolveExecutableEngine(office);
  check(officeRoute.status === ENGINE_ROUTE_STATUS.QUALIFIED && officeRoute.studyType === STUDY_TYPE.EXISTING_BUILDING, 'Generic leased office should route to EXISTING_BUILDING');

  const industrial = createProjectProfile({
    projectId: 'P-IND-001',
    assetClasses: [ASSET_CLASS.INDUSTRIAL_LOGISTICS],
    lifecycleStage: LIFECYCLE_STAGE.STABILIZED,
    investmentStrategy: INVESTMENT_STRATEGY.CORE_INCOME,
    incomeModel: INCOME_MODEL.LEASE_INCOME,
  });
  check(resolveExecutableEngine(industrial).studyType === STUDY_TYPE.EXISTING_BUILDING, 'Qualified existing-building engine must not be restricted to office examples');

  const hotel = createProjectProfile({
    projectId: 'P-HOTEL-001',
    assetClasses: [ASSET_CLASS.HOSPITALITY],
    lifecycleStage: LIFECYCLE_STAGE.EXISTING_OPERATING,
    investmentStrategy: INVESTMENT_STRATEGY.ACQUIRE_HOLD,
    incomeModel: INCOME_MODEL.OPERATING_BUSINESS,
  });
  const hotelPlan = buildEvidenceDomainPlan(hotel);
  assertDomains(hotelPlan, REQUIREMENT.REQUIRED, [EVIDENCE_DOMAIN.BUILT_FORM, EVIDENCE_DOMAIN.OPERATIONS, EVIDENCE_DOMAIN.FINANCIAL]);
  checks++;
  const hotelRoute = resolveExecutableEngine(hotel);
  check(hotelRoute.status === ENGINE_ROUTE_STATUS.HOLD_NO_QUALIFIED_ENGINE && hotelRoute.evidencePipelineSupported === true && hotelRoute.financialEngineQualified === false,
    'Operating hotel must be accepted by evidence pipeline but fail closed for unqualified financial engine');

  const mixedUse = createProjectProfile({
    projectId: 'P-MIXED-001',
    assetClasses: [ASSET_CLASS.RESIDENTIAL, ASSET_CLASS.RETAIL, ASSET_CLASS.MIXED_USE],
    lifecycleStage: LIFECYCLE_STAGE.UNDER_DEVELOPMENT,
    investmentStrategy: INVESTMENT_STRATEGY.DEVELOPMENT,
    incomeModel: INCOME_MODEL.MIXED,
  });
  check(mixedUse.traits.multiAssetOrMixedUse === true && mixedUse.traits.developmentOrRepositioning === true, 'Mixed-use traits are incorrect');
  const mixedPlan = buildEvidenceDomainPlan(mixedUse);
  assertDomains(mixedPlan, REQUIREMENT.REQUIRED, [
    EVIDENCE_DOMAIN.SITE_LAND, EVIDENCE_DOMAIN.BUILT_FORM, EVIDENCE_DOMAIN.DEVELOPMENT,
    EVIDENCE_DOMAIN.CAPEX, EVIDENCE_DOMAIN.SCHEDULE, EVIDENCE_DOMAIN.LEASING,
    EVIDENCE_DOMAIN.OPERATIONS, EVIDENCE_DOMAIN.FINANCIAL,
  ]);
  checks++;
  check(resolveExecutableEngine(mixedUse).status === ENGINE_ROUTE_STATUS.HOLD_NO_QUALIFIED_ENGINE, 'Mixed-use development must not borrow another engine silently');

  const custom = createProjectProfile({
    projectId: 'P-CUSTOM-001',
    assetClasses: [ASSET_CLASS.OTHER],
    customAssetClass: 'Research Campus',
    lifecycleStage: LIFECYCLE_STAGE.OTHER,
    customLifecycleStage: 'Adaptive Reuse Pilot',
    investmentStrategy: INVESTMENT_STRATEGY.OTHER,
    customInvestmentStrategy: 'Mission-Aligned Hold',
    incomeModel: INCOME_MODEL.UNKNOWN,
  });
  check(custom.customAssetClass === 'Research Campus', 'Custom asset class must remain available for future/unlisted project types');
  check(resolveExecutableEngine(custom).status === ENGINE_ROUTE_STATUS.HOLD_NO_QUALIFIED_ENGINE, 'Custom project must fail closed only at financial-engine routing');
  check(buildEvidenceDomainPlan(custom).requiredDomains.length >= 6, 'Custom project must still receive universal core evidence plan');

  assert.throws(() => createProjectProfile({
    projectId: 'BAD-EMPTY', assetClasses: [], lifecycleStage: LIFECYCLE_STAGE.PLANNED,
    investmentStrategy: INVESTMENT_STRATEGY.DEVELOPMENT,
  }), /assetClasses/);
  checks++;
  assert.throws(() => createProjectProfile({
    projectId: 'BAD-OTHER', assetClasses: [ASSET_CLASS.OTHER], lifecycleStage: LIFECYCLE_STAGE.PLANNED,
    investmentStrategy: INVESTMENT_STRATEGY.DEVELOPMENT,
  }), /customAssetClass/);
  checks++;

  const profileA = createProjectProfile({
    projectId: 'NAME-INDEPENDENCE', projectName: 'Project Alpha', assetClasses: [ASSET_CLASS.OFFICE],
    lifecycleStage: LIFECYCLE_STAGE.EXISTING_OPERATING, investmentStrategy: INVESTMENT_STRATEGY.ACQUIRE_HOLD,
    incomeModel: INCOME_MODEL.LEASE_INCOME,
  });
  const profileB = createProjectProfile({
    projectId: 'NAME-INDEPENDENCE', projectName: 'Completely Different Name', assetClasses: [ASSET_CLASS.OFFICE],
    lifecycleStage: LIFECYCLE_STAGE.EXISTING_OPERATING, investmentStrategy: INVESTMENT_STRATEGY.ACQUIRE_HOLD,
    incomeModel: INCOME_MODEL.LEASE_INCOME,
  });
  check(JSON.stringify(decisionSignature(profileA)) === JSON.stringify(decisionSignature(profileB)), 'Project name must not influence evidence plan or engine routing');

  check(Object.keys(STUDY_TYPE).length === 2, 'Existing executable StudyType contract must not be falsely expanded without qualified engines');

  const projectModelRoot = path.join(__dirname, '..', '..', 'src', 'project-model');
  const source = fs.readdirSync(projectModelRoot).filter((file) => file.endsWith('.js'))
    .map((file) => fs.readFileSync(path.join(projectModelRoot, file), 'utf8')).join('\n');
  check(!/ابو\s*بكر|أبو\s*بكر|الوادي|حي\s*الندى/i.test(source), 'Universal project model contains exemplar-specific project names');
  check(!source.includes('calculateInvestmentCase'), 'Universal project model must not call the financial engine directly');

  console.log(`UNIVERSAL_PROJECT_MODEL_CHECKS=${checks}`);
  console.log(`ASSET_CLASS_COUNT=${Object.keys(ASSET_CLASS).length}`);
  console.log(`EVIDENCE_DOMAIN_COUNT=${Object.keys(EVIDENCE_DOMAIN).length}`);
  console.log(`HOTEL_ENGINE_STATUS=${hotelRoute.status}`);
  console.log('UNIVERSAL_PROJECT_MODEL_RESULT=PASS');
}

main();
