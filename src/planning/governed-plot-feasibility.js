'use strict';

const crypto = require('crypto');
const {
  PLANNING_CONSTRAINT_TYPE,
  PLANNING_EVIDENCE_STATUS,
} = require('./planning-evidence');
const {
  TITLE_SURVEY_VERIFICATION_STATUS,
} = require('../property/governed-title-survey-verification');

const CAPABILITY = 'C9_GOVERNED_URBAN_CODE_PLOT_FEASIBILITY_V1';

const PLOT_FEASIBILITY_STATUS = Object.freeze({
  READY_FOR_PROFESSIONAL_PLOT_REVIEW: 'READY_FOR_PROFESSIONAL_PLOT_REVIEW',
  HOLD_UPSTREAM_EVIDENCE: 'HOLD_UPSTREAM_EVIDENCE',
  HOLD_POLICY: 'HOLD_POLICY',
  HOLD_INTEGRITY: 'HOLD_INTEGRITY',
  HOLD_CONSTRAINT_BINDING: 'HOLD_CONSTRAINT_BINDING',
  HOLD_UNIT_COMPATIBILITY: 'HOLD_UNIT_COMPATIBILITY',
  HOLD_GEOMETRY: 'HOLD_GEOMETRY',
  INFEASIBLE_ENVELOPE: 'INFEASIBLE_ENVELOPE',
});

const GEOMETRY_MODEL = Object.freeze({
  SURVEYED_RECTANGLE: 'SURVEYED_RECTANGLE',
});

const REQUIRED_PROFILE_CONSTRAINTS = Object.freeze([
  PLANNING_CONSTRAINT_TYPE.FAR,
  PLANNING_CONSTRAINT_TYPE.BCR,
  PLANNING_CONSTRAINT_TYPE.SETBACK,
]);

function nonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function assertNonEmpty(value, field) {
  if (!nonEmpty(value)) throw new TypeError(`${field} must be a non-empty string`);
}

function iso(value, field) {
  assertNonEmpty(value, field);
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw new TypeError(`${field} must be a valid date/time`);
  return d.toISOString();
}

function stableClone(value) {
  if (Array.isArray(value)) return value.map(stableClone);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value).sort().reduce((out, key) => {
    out[key] = stableClone(value[key]);
    return out;
  }, {});
}

function sha256(value) {
  return crypto.createHash('sha256').update(JSON.stringify(stableClone(value))).digest('hex');
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function isSha256(value) {
  return typeof value === 'string' && /^[a-f0-9]{64}$/i.test(value);
}

function verifyHashBoundObject(value, hashField) {
  if (!value || typeof value !== 'object' || !isSha256(value[hashField])) return false;
  const payload = { ...value };
  delete payload[hashField];
  return sha256(payload) === String(value[hashField]).toLowerCase();
}

function finiteNonNegative(value, field) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new TypeError(`${field} must be a finite non-negative number`);
  }
  return value;
}

function finitePositive(value, field) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new TypeError(`${field} must be a finite positive number`);
  }
  return value;
}

function uniqueStrings(values, field) {
  if (!Array.isArray(values) || values.length === 0) throw new TypeError(`${field} must be a non-empty array`);
  const normalized = values.map((value, index) => {
    assertNonEmpty(value, `${field}[${index}]`);
    return value.trim();
  });
  return [...new Set(normalized)].sort();
}

function round12(value) {
  return Number(Number(value).toFixed(12));
}

function eligibleEvidenceIdsByType(planningEvidenceSet) {
  const map = new Map();
  for (const trace of Array.isArray(planningEvidenceSet?.trace) ? planningEvidenceSet.trace : []) {
    const ids = new Set();
    for (const item of Array.isArray(trace?.values) ? trace.values : []) {
      if (nonEmpty(item?.evidenceId)) ids.add(item.evidenceId.trim());
    }
    map.set(trace.type, ids);
  }
  return map;
}

function normalizeConstraintEvidenceIdsByType(planningEvidenceSet, input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('constraintEvidenceIdsByType must be an object');
  }
  const eligible = eligibleEvidenceIdsByType(planningEvidenceSet);
  const normalized = {};
  for (const type of REQUIRED_PROFILE_CONSTRAINTS) {
    const ids = uniqueStrings(input[type], `constraintEvidenceIdsByType.${type}`);
    const eligibleIds = eligible.get(type) || new Set();
    for (const id of ids) {
      if (!eligibleIds.has(id)) throw new TypeError(`PLANNING_EVIDENCE_REFERENCE_NOT_ELIGIBLE:${type}:${id}`);
    }
    normalized[type] = ids;
  }
  return normalized;
}

function normalizeSetbacks(setbacks) {
  if (!setbacks || typeof setbacks !== 'object' || Array.isArray(setbacks)) {
    throw new TypeError('setbacks must be an object');
  }
  return {
    front: finiteNonNegative(setbacks.front, 'setbacks.front'),
    rear: finiteNonNegative(setbacks.rear, 'setbacks.rear'),
    left: finiteNonNegative(setbacks.left, 'setbacks.left'),
    right: finiteNonNegative(setbacks.right, 'setbacks.right'),
  };
}

function normalizeOptionalStrings(values, field) {
  if (values === undefined || values === null) return [];
  if (!Array.isArray(values)) throw new TypeError(`${field} must be an array`);
  const normalized = values.map((value, index) => {
    assertNonEmpty(value, `${field}[${index}]`);
    return value.trim();
  });
  return [...new Set(normalized)].sort();
}

function createUrbanCodeProfile({
  profileId,
  caseId,
  propertyRef,
  planningEvidenceSet,
  constraintEvidenceIdsByType,
  far,
  bcr,
  setbacks,
  areaUnit,
  lengthUnit,
  permittedUses = [],
  heightLimit = null,
  parkingRequirement = null,
  interpretationEvidenceRef,
  reviewedByRef,
  reviewedAt,
} = {}) {
  for (const [field, value] of [
    ['profileId', profileId], ['caseId', caseId], ['propertyRef', propertyRef],
    ['areaUnit', areaUnit], ['lengthUnit', lengthUnit],
    ['interpretationEvidenceRef', interpretationEvidenceRef], ['reviewedByRef', reviewedByRef],
  ]) assertNonEmpty(value, field);

  if (!planningEvidenceSet || typeof planningEvidenceSet !== 'object') throw new TypeError('planningEvidenceSet is required');
  if (planningEvidenceSet.caseId !== caseId || planningEvidenceSet.propertyRef !== propertyRef) {
    throw new TypeError('CASE_OR_PROPERTY_ISOLATION_VIOLATION:planningEvidenceSet');
  }
  if (planningEvidenceSet.status !== PLANNING_EVIDENCE_STATUS.READY_FOR_HBU_LEGAL_REVIEW
      || planningEvidenceSet.readyForHbuLegalReview !== true) {
    throw new TypeError('PLANNING_EVIDENCE_NOT_READY_FOR_PROFILE');
  }
  if (!verifyHashBoundObject(planningEvidenceSet, 'planningEvidenceSetHashSha256')) {
    throw new TypeError('PLANNING_EVIDENCE_SET_INTEGRITY_FAILED');
  }

  const normalizedFar = finiteNonNegative(far, 'far');
  const normalizedBcr = finiteNonNegative(bcr, 'bcr');
  if (normalizedBcr > 1) throw new TypeError('bcr must be expressed as a ratio between 0 and 1');
  const normalizedSetbacks = normalizeSetbacks(setbacks);
  const normalizedEvidenceIds = normalizeConstraintEvidenceIdsByType(planningEvidenceSet, constraintEvidenceIdsByType);
  const reviewedAtIso = iso(reviewedAt, 'reviewedAt');

  let normalizedHeightLimit = null;
  if (heightLimit !== null && heightLimit !== undefined) {
    if (!heightLimit || typeof heightLimit !== 'object' || Array.isArray(heightLimit)) throw new TypeError('heightLimit must be null or an object');
    normalizedHeightLimit = {
      value: finiteNonNegative(heightLimit.value, 'heightLimit.value'),
      unit: nonEmpty(heightLimit.unit) ? heightLimit.unit.trim() : null,
    };
    if (!normalizedHeightLimit.unit) throw new TypeError('heightLimit.unit is required when heightLimit is supplied');
  }

  const profile = {
    schemaVersion: 1,
    capability: CAPABILITY,
    profileId: profileId.trim(),
    caseId: caseId.trim(),
    propertyRef: propertyRef.trim(),
    planningEvidenceSetHashSha256: planningEvidenceSet.planningEvidenceSetHashSha256,
    constraintEvidenceIdsByType: normalizedEvidenceIds,
    adoptedConstraints: {
      far: normalizedFar,
      bcr: normalizedBcr,
      setbacks: normalizedSetbacks,
      areaUnit: areaUnit.trim(),
      lengthUnit: lengthUnit.trim(),
      permittedUses: normalizeOptionalStrings(permittedUses, 'permittedUses'),
      heightLimit: normalizedHeightLimit,
      parkingRequirement: parkingRequirement === undefined ? null : stableClone(parkingRequirement),
    },
    interpretationEvidenceRef: interpretationEvidenceRef.trim(),
    reviewedByRef: reviewedByRef.trim(),
    reviewedAt: reviewedAtIso,
    statutoryInterpretationEstablished: false,
    planningComplianceEstablished: false,
    buildingPermitEstablished: false,
    automaticUseSelection: false,
    transactionAuthorized: false,
  };
  profile.urbanCodeProfileHashSha256 = sha256(profile);
  return deepFreeze(profile);
}

function verifyUrbanCodeProfileIntegrity(profile) {
  return verifyHashBoundObject(profile, 'urbanCodeProfileHashSha256');
}

function createSurveyedRectangularPlotGeometry({
  geometryId,
  caseId,
  propertyRef,
  landArea,
  width,
  depth,
  areaUnit,
  lengthUnit,
  evidenceRefs,
  verifiedByRef,
  verifiedAt,
} = {}) {
  for (const [field, value] of [
    ['geometryId', geometryId], ['caseId', caseId], ['propertyRef', propertyRef],
    ['areaUnit', areaUnit], ['lengthUnit', lengthUnit], ['verifiedByRef', verifiedByRef],
  ]) assertNonEmpty(value, field);

  const geometry = {
    schemaVersion: 1,
    capability: CAPABILITY,
    geometryId: geometryId.trim(),
    caseId: caseId.trim(),
    propertyRef: propertyRef.trim(),
    geometryModel: GEOMETRY_MODEL.SURVEYED_RECTANGLE,
    landArea: finitePositive(landArea, 'landArea'),
    width: finitePositive(width, 'width'),
    depth: finitePositive(depth, 'depth'),
    areaUnit: areaUnit.trim(),
    lengthUnit: lengthUnit.trim(),
    evidenceRefs: uniqueStrings(evidenceRefs, 'evidenceRefs'),
    verifiedByRef: verifiedByRef.trim(),
    verifiedAt: iso(verifiedAt, 'verifiedAt'),
    rectangularGeometryProfessionallyVerified: true,
    planningComplianceEstablished: false,
    transactionAuthorized: false,
  };
  geometry.plotGeometryHashSha256 = sha256(geometry);
  return deepFreeze(geometry);
}

function verifySurveyedPlotGeometryIntegrity(geometry) {
  return verifyHashBoundObject(geometry, 'plotGeometryHashSha256');
}

function normalizeTolerance(tolerance) {
  if (!tolerance || typeof tolerance !== 'object' || Array.isArray(tolerance)) {
    throw new TypeError('geometryAreaTolerance must be an object with absolute and/or relative tolerance');
  }
  const hasAbsolute = Object.prototype.hasOwnProperty.call(tolerance, 'absolute');
  const hasRelative = Object.prototype.hasOwnProperty.call(tolerance, 'relative');
  if (!hasAbsolute && !hasRelative) throw new TypeError('geometryAreaTolerance must explicitly provide absolute and/or relative tolerance');
  const normalized = {};
  if (hasAbsolute) normalized.absolute = finiteNonNegative(tolerance.absolute, 'geometryAreaTolerance.absolute');
  if (hasRelative) normalized.relative = finiteNonNegative(tolerance.relative, 'geometryAreaTolerance.relative');
  return normalized;
}

function finalize(core) {
  const authorityBoundary = {
    professionalPlotReviewReady: core.status === PLOT_FEASIBILITY_STATUS.READY_FOR_PROFESSIONAL_PLOT_REVIEW,
    statutoryInterpretationEstablished: false,
    planningComplianceEstablished: false,
    buildingPermitEstablished: false,
    legalOpinionEstablished: false,
    highestBestUseEstablished: false,
    automaticUseSelection: false,
    certifiedValuationEstablished: false,
    automaticUnderwritingAdoption: false,
    financialEngineInputsWritten: false,
    transactionAuthorized: false,
    approvalAuthorized: false,
    decisionBinding: false,
  };
  const withoutHash = { ...core, ...authorityBoundary };
  return deepFreeze({ ...withoutHash, resultHashSha256: sha256(withoutHash) });
}

function hold(status, reasons, context = {}) {
  return finalize({
    schemaVersion: 1,
    capability: CAPABILITY,
    status,
    reasons: [...new Set(reasons)].sort(),
    caseId: context.caseId || null,
    propertyRef: context.propertyRef || null,
    evaluatedAt: context.evaluatedAt || null,
    inputs: context.inputs || null,
    calculations: context.calculations || null,
    semantics: 'C9 failed closed. No statutory interpretation, planning-compliance conclusion, building-permit conclusion, valuation conclusion, financial-engine write, transaction authority or binding decision is created.',
  });
}

function evaluateGovernedPlotFeasibility({
  caseId,
  propertyRef,
  planningEvidenceSet,
  titleSurveyVerification,
  urbanCodeProfile,
  plotGeometry,
  geometryAreaTolerance,
  evaluatedAt,
} = {}) {
  const safeCaseId = nonEmpty(caseId) ? caseId.trim() : null;
  const safePropertyRef = nonEmpty(propertyRef) ? propertyRef.trim() : null;
  let evaluatedAtIso;
  try {
    if (!safeCaseId || !safePropertyRef) throw new TypeError('caseId and propertyRef are required');
    evaluatedAtIso = iso(evaluatedAt, 'evaluatedAt');
  } catch (error) {
    return hold(PLOT_FEASIBILITY_STATUS.HOLD_POLICY, [`CONTROL_INPUT_INVALID:${error.message}`], {
      caseId: safeCaseId,
      propertyRef: safePropertyRef,
    });
  }

  for (const [name, value] of [
    ['planningEvidenceSet', planningEvidenceSet],
    ['titleSurveyVerification', titleSurveyVerification],
    ['urbanCodeProfile', urbanCodeProfile],
    ['plotGeometry', plotGeometry],
  ]) {
    if (!value || typeof value !== 'object') {
      return hold(PLOT_FEASIBILITY_STATUS.HOLD_POLICY, [`${name.toUpperCase()}_REQUIRED`], {
        caseId: safeCaseId, propertyRef: safePropertyRef, evaluatedAt: evaluatedAtIso,
      });
    }
    if (value.caseId !== safeCaseId || value.propertyRef !== safePropertyRef) {
      return hold(PLOT_FEASIBILITY_STATUS.HOLD_UPSTREAM_EVIDENCE, [`CASE_OR_PROPERTY_ISOLATION_VIOLATION:${name}`], {
        caseId: safeCaseId, propertyRef: safePropertyRef, evaluatedAt: evaluatedAtIso,
      });
    }
  }

  const upstreamReasons = [];
  if (!verifyHashBoundObject(planningEvidenceSet, 'planningEvidenceSetHashSha256')) upstreamReasons.push('PLANNING_EVIDENCE_SET_INTEGRITY_FAILED');
  if (!verifyHashBoundObject(titleSurveyVerification, 'resultHashSha256')) upstreamReasons.push('C8_RESULT_INTEGRITY_FAILED');
  if (upstreamReasons.length) {
    return hold(PLOT_FEASIBILITY_STATUS.HOLD_INTEGRITY, upstreamReasons, {
      caseId: safeCaseId, propertyRef: safePropertyRef, evaluatedAt: evaluatedAtIso,
    });
  }

  if (planningEvidenceSet.status !== PLANNING_EVIDENCE_STATUS.READY_FOR_HBU_LEGAL_REVIEW
      || planningEvidenceSet.readyForHbuLegalReview !== true) {
    upstreamReasons.push(`PLANNING_EVIDENCE_NOT_READY:${planningEvidenceSet.status || 'UNKNOWN'}`);
  }
  if (titleSurveyVerification.status !== TITLE_SURVEY_VERIFICATION_STATUS.READY_FOR_PROFESSIONAL_REVIEW
      || titleSurveyVerification.professionalReviewReady !== true) {
    upstreamReasons.push(`C8_NOT_READY:${titleSurveyVerification.status || 'UNKNOWN'}`);
  }
  if (upstreamReasons.length) {
    return hold(PLOT_FEASIBILITY_STATUS.HOLD_UPSTREAM_EVIDENCE, upstreamReasons, {
      caseId: safeCaseId, propertyRef: safePropertyRef, evaluatedAt: evaluatedAtIso,
    });
  }

  const integrityReasons = [];
  if (!verifyUrbanCodeProfileIntegrity(urbanCodeProfile)) integrityReasons.push('URBAN_CODE_PROFILE_INTEGRITY_FAILED');
  if (!verifySurveyedPlotGeometryIntegrity(plotGeometry)) integrityReasons.push('PLOT_GEOMETRY_INTEGRITY_FAILED');
  if (integrityReasons.length) {
    return hold(PLOT_FEASIBILITY_STATUS.HOLD_INTEGRITY, integrityReasons, {
      caseId: safeCaseId, propertyRef: safePropertyRef, evaluatedAt: evaluatedAtIso,
    });
  }

  if (urbanCodeProfile.planningEvidenceSetHashSha256 !== planningEvidenceSet.planningEvidenceSetHashSha256) {
    return hold(PLOT_FEASIBILITY_STATUS.HOLD_CONSTRAINT_BINDING, ['URBAN_CODE_PROFILE_PLANNING_EVIDENCE_BINDING_MISMATCH'], {
      caseId: safeCaseId, propertyRef: safePropertyRef, evaluatedAt: evaluatedAtIso,
    });
  }

  try {
    normalizeConstraintEvidenceIdsByType(planningEvidenceSet, urbanCodeProfile.constraintEvidenceIdsByType);
  } catch (error) {
    return hold(PLOT_FEASIBILITY_STATUS.HOLD_CONSTRAINT_BINDING, [`CONSTRAINT_EVIDENCE_BINDING_INVALID:${error.message}`], {
      caseId: safeCaseId, propertyRef: safePropertyRef, evaluatedAt: evaluatedAtIso,
    });
  }

  if (Date.parse(urbanCodeProfile.reviewedAt) > Date.parse(evaluatedAtIso)
      || Date.parse(plotGeometry.verifiedAt) > Date.parse(evaluatedAtIso)) {
    return hold(PLOT_FEASIBILITY_STATUS.HOLD_POLICY, ['REVIEW_OR_GEOMETRY_VERIFICATION_TIMESTAMP_IN_FUTURE'], {
      caseId: safeCaseId, propertyRef: safePropertyRef, evaluatedAt: evaluatedAtIso,
    });
  }

  const areaUnit = urbanCodeProfile.adoptedConstraints?.areaUnit;
  const lengthUnit = urbanCodeProfile.adoptedConstraints?.lengthUnit;
  if (areaUnit !== plotGeometry.areaUnit || lengthUnit !== plotGeometry.lengthUnit) {
    return hold(PLOT_FEASIBILITY_STATUS.HOLD_UNIT_COMPATIBILITY, [
      `UNIT_MISMATCH:area:${areaUnit || 'UNKNOWN'}:${plotGeometry.areaUnit || 'UNKNOWN'}`,
      `UNIT_MISMATCH:length:${lengthUnit || 'UNKNOWN'}:${plotGeometry.lengthUnit || 'UNKNOWN'}`,
    ], {
      caseId: safeCaseId, propertyRef: safePropertyRef, evaluatedAt: evaluatedAtIso,
    });
  }

  let tolerance;
  try {
    tolerance = normalizeTolerance(geometryAreaTolerance);
  } catch (error) {
    return hold(PLOT_FEASIBILITY_STATUS.HOLD_POLICY, [`GEOMETRY_AREA_TOLERANCE_INVALID:${error.message}`], {
      caseId: safeCaseId, propertyRef: safePropertyRef, evaluatedAt: evaluatedAtIso,
    });
  }

  const rectangleArea = round12(plotGeometry.width * plotGeometry.depth);
  const areaDifference = round12(Math.abs(rectangleArea - plotGeometry.landArea));
  const allowedAreaDifference = round12(Math.max(
    tolerance.absolute || 0,
    (tolerance.relative || 0) * plotGeometry.landArea,
  ));
  const commonInputs = {
    planningEvidenceSetHashSha256: planningEvidenceSet.planningEvidenceSetHashSha256,
    c8ResultHashSha256: titleSurveyVerification.resultHashSha256,
    urbanCodeProfileHashSha256: urbanCodeProfile.urbanCodeProfileHashSha256,
    plotGeometryHashSha256: plotGeometry.plotGeometryHashSha256,
    geometryAreaTolerance: stableClone(tolerance),
  };

  if (areaDifference > allowedAreaDifference) {
    return hold(PLOT_FEASIBILITY_STATUS.HOLD_GEOMETRY, ['SURVEYED_RECTANGLE_AREA_OUTSIDE_EXPLICIT_TOLERANCE'], {
      caseId: safeCaseId,
      propertyRef: safePropertyRef,
      evaluatedAt: evaluatedAtIso,
      inputs: commonInputs,
      calculations: { rectangleArea, reportedLandArea: plotGeometry.landArea, areaDifference, allowedAreaDifference },
    });
  }

  const constraints = urbanCodeProfile.adoptedConstraints;
  const buildableWidth = round12(plotGeometry.width - constraints.setbacks.left - constraints.setbacks.right);
  const buildableDepth = round12(plotGeometry.depth - constraints.setbacks.front - constraints.setbacks.rear);
  const setbackEnvelopeArea = round12(Math.max(0, buildableWidth) * Math.max(0, buildableDepth));
  const bcrFootprintCap = round12(plotGeometry.landArea * constraints.bcr);
  const governingFootprintCap = round12(Math.min(setbackEnvelopeArea, bcrFootprintCap));
  const farGrossFloorAreaCap = round12(plotGeometry.landArea * constraints.far);
  const calculations = {
    rectangleArea,
    reportedLandArea: plotGeometry.landArea,
    areaDifference,
    allowedAreaDifference,
    buildableWidth,
    buildableDepth,
    setbackEnvelopeArea,
    bcrFootprintCap,
    governingFootprintCap,
    farGrossFloorAreaCap,
    areaUnit,
    lengthUnit,
  };

  if (buildableWidth <= 0 || buildableDepth <= 0 || governingFootprintCap <= 0 || farGrossFloorAreaCap <= 0) {
    return hold(PLOT_FEASIBILITY_STATUS.INFEASIBLE_ENVELOPE, ['NO_POSITIVE_BUILDABLE_CAPACITY_UNDER_ADOPTED_PROFILE'], {
      caseId: safeCaseId,
      propertyRef: safePropertyRef,
      evaluatedAt: evaluatedAtIso,
      inputs: commonInputs,
      calculations,
    });
  }

  return finalize({
    schemaVersion: 1,
    capability: CAPABILITY,
    status: PLOT_FEASIBILITY_STATUS.READY_FOR_PROFESSIONAL_PLOT_REVIEW,
    reasons: [],
    caseId: safeCaseId,
    propertyRef: safePropertyRef,
    evaluatedAt: evaluatedAtIso,
    inputs: commonInputs,
    adoptedConstraints: stableClone(constraints),
    calculations,
    evidenceTrace: {
      constraintEvidenceIdsByType: stableClone(urbanCodeProfile.constraintEvidenceIdsByType),
      geometryEvidenceRefs: [...plotGeometry.evidenceRefs],
      interpretationEvidenceRef: urbanCodeProfile.interpretationEvidenceRef,
      profileReviewedByRef: urbanCodeProfile.reviewedByRef,
      profileReviewedAt: urbanCodeProfile.reviewedAt,
      geometryVerifiedByRef: plotGeometry.verifiedByRef,
      geometryVerifiedAt: plotGeometry.verifiedAt,
    },
    semantics: 'C9 calculated a deterministic plot-envelope review aid from an explicit professional urban-code profile, governed planning evidence and verified rectangular survey geometry. READY_FOR_PROFESSIONAL_PLOT_REVIEW is not statutory interpretation, planning compliance, permit approval, HBU selection, valuation, underwriting adoption, transaction authority or a binding decision.',
  });
}

module.exports = {
  CAPABILITY,
  PLOT_FEASIBILITY_STATUS,
  GEOMETRY_MODEL,
  REQUIRED_PROFILE_CONSTRAINTS,
  createUrbanCodeProfile,
  verifyUrbanCodeProfileIntegrity,
  createSurveyedRectangularPlotGeometry,
  verifySurveyedPlotGeometryIntegrity,
  evaluateGovernedPlotFeasibility,
};
