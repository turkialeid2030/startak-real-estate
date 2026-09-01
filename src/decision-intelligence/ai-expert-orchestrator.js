'use strict';

const AI_ROLE = Object.freeze({
  ANALYST: 'ANALYST',
  CHALLENGER: 'CHALLENGER',
  SYNTHESIZER: 'SYNTHESIZER',
});

const AI_STAGE_STATUS = Object.freeze({
  READY_FOR_MODEL_CALL: 'READY_FOR_MODEL_CALL',
  HOLD_STALE_CONTEXT: 'HOLD_STALE_CONTEXT',
  HOLD_DECISION_GATE: 'HOLD_DECISION_GATE',
  HOLD_RELIABILITY: 'HOLD_RELIABILITY',
  HOLD_PROFESSIONAL_REVIEW: 'HOLD_PROFESSIONAL_REVIEW',
  OUTPUT_ACCEPTED: 'OUTPUT_ACCEPTED',
  OUTPUT_REJECTED: 'OUTPUT_REJECTED',
});

// V2 guard targets imperative/final-decision language rather than raw noun
// substrings. Descriptive analytical phrases such as "purchase price", "sale
// value", "تكلفة الشراء", or "سعر البيع" are legitimate real-estate terms and
// must not be rejected merely because they contain a decision-related noun.
const ENGLISH_DECISION_PATTERNS = Object.freeze([
  /(?:^|[.!?;:\n]\s*)(?:please\s+)?(?:buy|sell|approve|reject|acquire|dispose\s+of)\b/i,
  /\b(?:should|must|shall|need\s+to|ought\s+to)\s+(?:buy|sell|approve|reject|acquire|dispose\s+of)\b/i,
  /\b(?:recommend|recommends|recommended|recommendation\s*(?::|is\s+to)?)\s+(?:to\s+)?(?:buy|sell|approve|reject|acquire|dispose\s+of)\b/i,
  /\b(?:decision|verdict)\s*:\s*(?:buy|sell|approve|reject)\b/i,
  /\b(?:final\s+)?(?:approval|rejection)\s+(?:is|should\s+be)\s+(?:granted|issued|given|required)\b/i,
]);

const ARABIC_DECISION_PATTERNS = Object.freeze([
  /(?:^|[\s،,:;.!؟\n])(?:اشتر|اشترِ|اشتروا|استحوذ|استحوذوا|اعتمد|اعتمدوا|ارفض|ارفضوا)(?:$|[\s،,:;.!؟\n])/,
  /(?:^|[\s،,:;.!؟\n])(?:بِع|بع)(?:$|[\s،,:;.!؟\n])/,
  /(?:يجب|ينبغي|يلزم)\s+(?:الشراء|البيع|الاستحواذ|التخارج|الموافقة|الرفض|اعتماد|رفض)/,
  /(?:يوصى|نوصي|أوصي)\s+(?:ب|بال|بـ)?(?:الشراء|البيع|الاستحواذ|التخارج|الموافقة|الرفض)/,
  /(?:التوصية|القرار|الحكم)\s*:\s*(?:شراء|بيع|استحواذ|تخارج|موافقة|رفض|اعتماد)/,
  /(?:قم|قوموا)\s+ب(?:شراء|بيع|الشراء|البيع|الاستحواذ|الرفض|الموافقة)/,
]);

const GUARDED_TEXT_FIELDS = Object.freeze([
  'narrative',
  'uncertainties',
  'disagreements',
  'diligenceSuggestions',
]);

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) freeze(child);
  return value;
}

function assertNonEmpty(value, name) {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${name} must be a non-empty string`);
}

function requireObject(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${name} must be an object`);
  return value;
}

function normalizeEvidenceRefs(refs) {
  if (!Array.isArray(refs)) throw new TypeError('evidenceRefs must be an array');
  const out = refs.map((ref) => String(ref).trim()).filter(Boolean);
  return Object.freeze([...new Set(out)]);
}

function normalizeTextArray(value, fieldName) {
  if (value == null) return { values: [], invalid: false };
  if (!Array.isArray(value)) return { values: [], invalid: true, fieldName };
  const values = [];
  for (const item of value) {
    if (typeof item !== 'string') return { values: [], invalid: true, fieldName };
    const text = item.trim();
    if (text) values.push(text);
  }
  return { values, invalid: false };
}

function buildRoleInstructions(role) {
  const common = [
    'Use only the supplied analytical context, evidence references, assumptions, scenarios, and deterministic outputs.',
    'Do not invent facts, market prices, regulations, legal conclusions, probabilities, or evidence.',
    'Cite evidenceRefs for every material factual claim.',
    'Label assumptions and scenarios explicitly.',
    'Do not state or imply a certified valuation, legal opinion, regulated investment advice, or transaction authorization.',
    'Do not issue imperative or final transaction language such as instructions to buy, sell, acquire, approve, or reject. Descriptive terms such as purchase price or sale value are allowed when analytically necessary.',
    'Do not override decision-control gates, professional-review requirements, or deterministic financial outputs.',
    'State uncertainty, conflicts, missing inputs, and stale context explicitly.',
  ];

  if (role === AI_ROLE.ANALYST) {
    return Object.freeze([...common,
      'Explain the analytical case, strongest supported drivers, key assumptions, evidence gaps, and downside exposure.',
      'Distinguish observed evidence from calculated outputs and from scenario assumptions.',
    ]);
  }
  if (role === AI_ROLE.CHALLENGER) {
    return Object.freeze([...common,
      'Construct the strongest evidence-grounded counter-case to the current analytical interpretation.',
      'Prioritize decision-reversal variables, downside sensitivities, evidence conflicts, and plausible failure modes.',
      'Do not manufacture a counterargument unsupported by supplied context.',
    ]);
  }
  if (role === AI_ROLE.SYNTHESIZER) {
    return Object.freeze([...common,
      'Reconcile analyst and challenger outputs without hiding disagreements.',
      'Identify what is known, disputed, conditional, and still requires human or licensed professional judgment.',
      'The synthesis may recommend further diligence, but it may not issue the final investment decision.',
    ]);
  }
  throw new Error(`UNSUPPORTED_AI_ROLE: ${role}`);
}

function buildAiExpertStage({
  role,
  caseId,
  projectId,
  contextVersionId,
  evidenceHash,
  decisionQuality,
  dossier,
  priorRoleOutputs = [],
} = {}) {
  if (!Object.values(AI_ROLE).includes(role)) throw new Error(`UNSUPPORTED_AI_ROLE: ${role}`);
  assertNonEmpty(caseId, 'caseId');
  assertNonEmpty(projectId, 'projectId');
  assertNonEmpty(contextVersionId, 'contextVersionId');
  assertNonEmpty(evidenceHash, 'evidenceHash');
  requireObject(decisionQuality, 'decisionQuality');
  requireObject(dossier, 'dossier');
  if (!Array.isArray(priorRoleOutputs)) throw new TypeError('priorRoleOutputs must be an array');

  if (decisionQuality.caseId !== caseId || dossier.caseId !== caseId) throw new Error('CASE_SCOPE_MISMATCH');
  if (decisionQuality.projectId !== projectId || dossier.projectId !== projectId) throw new Error('PROJECT_SCOPE_MISMATCH');

  const feedback = decisionQuality.feedback || {};
  const reliability = decisionQuality.reliability || {};
  const nextBest = decisionQuality.dueDiligence || {};

  let status = AI_STAGE_STATUS.READY_FOR_MODEL_CALL;
  const holdReasons = [];

  if (feedback.aiOpinion && ['STALE_REANALYSIS_REQUIRED', 'NOT_PROVIDED'].includes(feedback.aiOpinion.status) && feedback.materialUpstreamChange) {
    status = AI_STAGE_STATUS.HOLD_STALE_CONTEXT;
    holdReasons.push('MATERIAL_UPSTREAM_CHANGE_REQUIRES_REFRESHED_CONTEXT');
  }
  if (decisionQuality.status && String(decisionQuality.status).startsWith('HOLD_')) {
    status = AI_STAGE_STATUS.HOLD_DECISION_GATE;
    holdReasons.push(`DECISION_QUALITY_${decisionQuality.status}`);
  }
  const reliabilityLevel = reliability.overallReliability || reliability.overallLevel || reliability.level;
  if (['LOW', 'INSUFFICIENT'].includes(reliabilityLevel)) {
    status = AI_STAGE_STATUS.HOLD_RELIABILITY;
    holdReasons.push('RELIABILITY_BELOW_AI_SYNTHESIS_THRESHOLD');
  }
  if (dossier.dossierStatus === 'PROFESSIONAL_REVIEW_REQUIRED') {
    status = AI_STAGE_STATUS.HOLD_PROFESSIONAL_REVIEW;
    holdReasons.push('LICENSED_OR_PROFESSIONAL_REVIEW_REQUIRED');
  }

  const evidenceRefs = normalizeEvidenceRefs((dossier.aiNarrativeContext && dossier.aiNarrativeContext.factRefs || []).map((item) => item.ref));

  return freeze({
    schemaVersion: 2,
    role,
    status,
    holdReasons,
    caseId,
    projectId,
    contextVersionId,
    evidenceHash,
    evidenceRefs,
    instructions: buildRoleInstructions(role),
    context: {
      decisionQuality,
      dossier,
      priorRoleOutputs: priorRoleOutputs.map((item) => ({ ...item })),
      nextBestDueDiligence: nextBest.nextBestAction || null,
    },
    modelCallExecuted: false,
    humanDecisionRequired: true,
    transactionAuthorized: false,
    mayOverrideDeterministicOutputs: false,
    semantics: 'This object is a bounded context contract for a caller-supplied generative model. The module itself does not call an LLM and does not authorize a transaction.',
  });
}

function containsProhibitedDecisionLanguage(text) {
  const value = String(text || '').trim();
  if (!value) return false;
  return ENGLISH_DECISION_PATTERNS.some((pattern) => pattern.test(value))
    || ARABIC_DECISION_PATTERNS.some((pattern) => pattern.test(value));
}

function inspectGuardedOutputText(output) {
  const fields = [];
  const invalidShapeFields = [];

  fields.push({ field: 'narrative', text: output.narrative });
  for (const field of GUARDED_TEXT_FIELDS.slice(1)) {
    const normalized = normalizeTextArray(output[field], field);
    if (normalized.invalid) {
      invalidShapeFields.push(field);
      continue;
    }
    for (const text of normalized.values) fields.push({ field, text });
  }

  const prohibitedFields = [...new Set(
    fields.filter((item) => containsProhibitedDecisionLanguage(item.text)).map((item) => item.field),
  )];
  return freeze({ prohibitedFields, invalidShapeFields });
}

function validateAiRoleOutput({ stage, output } = {}) {
  requireObject(stage, 'stage');
  requireObject(output, 'output');
  if (stage.status !== AI_STAGE_STATUS.READY_FOR_MODEL_CALL) {
    return freeze({ accepted: false, status: AI_STAGE_STATUS.OUTPUT_REJECTED, reasonCodes: ['STAGE_NOT_READY'], transactionAuthorized: false });
  }
  if (output.caseId !== stage.caseId || output.projectId !== stage.projectId) {
    return freeze({ accepted: false, status: AI_STAGE_STATUS.OUTPUT_REJECTED, reasonCodes: ['SCOPE_MISMATCH'], transactionAuthorized: false });
  }
  if (output.contextVersionId !== stage.contextVersionId || output.evidenceHash !== stage.evidenceHash) {
    return freeze({ accepted: false, status: AI_STAGE_STATUS.OUTPUT_REJECTED, reasonCodes: ['STALE_OR_MISMATCHED_CONTEXT'], transactionAuthorized: false });
  }
  if (output.role !== stage.role) {
    return freeze({ accepted: false, status: AI_STAGE_STATUS.OUTPUT_REJECTED, reasonCodes: ['ROLE_MISMATCH'], transactionAuthorized: false });
  }
  assertNonEmpty(output.narrative, 'output.narrative');
  const citedEvidenceRefs = normalizeEvidenceRefs(output.citedEvidenceRefs || []);
  const allowedRefs = new Set(stage.evidenceRefs);
  const unknownRefs = citedEvidenceRefs.filter((ref) => !allowedRefs.has(ref));
  const textInspection = inspectGuardedOutputText(output);
  const reasonCodes = [];
  if (unknownRefs.length) reasonCodes.push('UNKNOWN_EVIDENCE_REFERENCE');
  if (textInspection.invalidShapeFields.length) reasonCodes.push('INVALID_TEXT_FIELD_SHAPE');
  if (textInspection.prohibitedFields.length) reasonCodes.push('PROHIBITED_DECISION_LANGUAGE');
  if (output.certifiedValuationProduced === true) reasonCodes.push('CERTIFIED_VALUATION_NOT_ALLOWED');
  if (output.legalOpinionProduced === true) reasonCodes.push('LEGAL_OPINION_NOT_ALLOWED');
  if (output.transactionAuthorized === true) reasonCodes.push('TRANSACTION_AUTHORIZATION_NOT_ALLOWED');
  if (typeof output.numericConfidence === 'number') reasonCodes.push('UNCALIBRATED_NUMERIC_CONFIDENCE_NOT_ALLOWED');

  if (reasonCodes.length) {
    return freeze({
      accepted: false,
      status: AI_STAGE_STATUS.OUTPUT_REJECTED,
      reasonCodes,
      unknownEvidenceRefs: unknownRefs,
      prohibitedDecisionLanguageFields: textInspection.prohibitedFields,
      invalidTextShapeFields: textInspection.invalidShapeFields,
      transactionAuthorized: false,
    });
  }

  const uncertainties = normalizeTextArray(output.uncertainties, 'uncertainties').values;
  const disagreements = normalizeTextArray(output.disagreements, 'disagreements').values;
  const diligenceSuggestions = normalizeTextArray(output.diligenceSuggestions, 'diligenceSuggestions').values;

  return freeze({
    accepted: true,
    status: AI_STAGE_STATUS.OUTPUT_ACCEPTED,
    role: stage.role,
    caseId: stage.caseId,
    projectId: stage.projectId,
    contextVersionId: stage.contextVersionId,
    evidenceHash: stage.evidenceHash,
    narrative: output.narrative.trim(),
    citedEvidenceRefs,
    uncertainties,
    disagreements,
    diligenceSuggestions,
    numericConfidence: null,
    humanDecisionRequired: true,
    transactionAuthorized: false,
    certifiedValuationProduced: false,
    legalOpinionProduced: false,
  });
}

module.exports = {
  AI_ROLE,
  AI_STAGE_STATUS,
  GUARDED_TEXT_FIELDS,
  buildRoleInstructions,
  buildAiExpertStage,
  containsProhibitedDecisionLanguage,
  inspectGuardedOutputText,
  validateAiRoleOutput,
};
