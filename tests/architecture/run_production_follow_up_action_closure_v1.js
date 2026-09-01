'use strict';

const assert = require('assert');
const {
  PRODUCTION_FOLLOW_UP_ACTION_CLOSURE_STATUS: STATUS,
  buildProductionFollowUpActionClosureEvidence,
} = require('../../src/production-readiness/production-follow-up-action-closure');

const scope = { caseId: 'CASE-ACTION-CLOSE-001', projectId: 'PROJECT-ACTION-CLOSE-001' };

function decision(overrides = {}) {
  const actions = [
    {
      actionId: 'ACT-1', description: 'Verify alert routing', ownerRef: 'owner://ops/1',
      dueAt: '2026-09-02T12:00:00+03:00', actionEvidenceRef: 'evidence://action/1', requiresFollowUpEvidence: true,
    },
    {
      actionId: 'ACT-2', description: 'Review capacity trend', ownerRef: 'owner://ops/2',
      dueAt: '2026-09-03T12:00:00+03:00', actionEvidenceRef: 'evidence://action/2', requiresFollowUpEvidence: true,
    },
  ];
  return {
    ...scope,
    status: 'DECISION_RECORDED',
    humanContinuityDecisionRecorded: true,
    productionServiceContinuationApprovedByHuman: true,
    continuationActionsRemain: true,
    continuedProductionUseAuthorizedByThisModule: false,
    rollbackExecuted: false,
    transactionAuthorized: false,
    decision: {
      decisionId: 'CONT-DEC-1', outcome: 'CONTINUE_WITH_ACTIONS', decidedByRef: 'reviewer://ops/1',
      decidedAt: '2026-09-01T18:00:00+03:00', decisionEvidenceRef: 'evidence://continuity-decision/1', actions,
    },
    evidenceRefs: ['evidence://continuity/1', 'reviewer://ops/1', 'evidence://continuity-decision/1'],
    ...overrides,
  };
}

function completions(overrides = {}) {
  const rows = [
    {
      actionId: 'ACT-1', ownerRef: 'owner://ops/1', completedByRef: 'reviewer://ops/2',
      completedAt: '2026-09-02T10:00:00+03:00', completionEvidenceRef: 'evidence://completion/1', completed: true,
    },
    {
      actionId: 'ACT-2', ownerRef: 'owner://ops/2', completedByRef: 'reviewer://ops/3',
      completedAt: '2026-09-03T11:00:00+03:00', completionEvidenceRef: 'evidence://completion/2', completed: true,
    },
  ];
  return rows.map((row) => row.actionId === overrides.actionId ? { ...row, ...overrides } : row);
}

function refs(dec = decision(), rows = completions(), incidents = []) {
  return [...new Set([
    ...(dec.evidenceRefs || []),
    dec.decision.decidedByRef,
    dec.decision.decisionEvidenceRef,
    ...dec.decision.actions.flatMap((a) => [a.ownerRef, a.actionEvidenceRef]),
    ...rows.flatMap((r) => [r.ownerRef, r.completedByRef, r.completionEvidenceRef]),
    ...incidents.map((i) => i.evidenceRef),
  ].filter(Boolean))];
}

function base(overrides = {}) {
  const dec = overrides.continuityDecision || decision();
  const rows = overrides.completions || completions();
  const incidents = overrides.incidents || [];
  return { ...scope, continuityDecision: dec, completions: rows, incidents, evidenceRefs: refs(dec, rows, incidents), ...overrides };
}

let checks = 0;
function check(name, fn) {
  fn();
  checks += 1;
  console.log(`PASS ${name}`);
}

check('complete follow-up evidence is ready for human closure review without self-closing', () => {
  const out = buildProductionFollowUpActionClosureEvidence(base());
  assert.strictEqual(out.status, STATUS.READY_FOR_HUMAN_ACTION_CLOSURE_REVIEW);
  assert.strictEqual(out.allActionsCompleted, true);
  assert.strictEqual(out.readyForHumanActionClosureReview, true);
  assert.strictEqual(out.actionsClosedByThisModule, false);
  assert.strictEqual(out.continuedProductionUseAuthorizedByThisModule, false);
  assert.strictEqual(out.rollbackAuthorizedByThisModule, false);
  assert.strictEqual(out.transactionAuthorized, false);
});

check('scope mismatch fails closed', () => {
  assert.strictEqual(buildProductionFollowUpActionClosureEvidence(base({ continuityDecision: decision({ caseId: 'OTHER' }) })).status, STATUS.HOLD_SCOPE);
});

check('only CONTINUE_WITH_ACTIONS decision may enter action closure', () => {
  const dec = decision();
  dec.decision = { ...dec.decision, outcome: 'CONTINUE_SERVICE' };
  dec.continuationActionsRemain = false;
  assert.strictEqual(buildProductionFollowUpActionClosureEvidence(base({ continuityDecision: dec })).status, STATUS.HOLD_CONTINUITY_DECISION);
});

check('missing completion fails closed', () => {
  const rows = completions().slice(0, 1);
  assert.strictEqual(buildProductionFollowUpActionClosureEvidence(base({ completions: rows })).status, STATUS.HOLD_ACTION_COMPLETIONS);
});

check('duplicate action completion fails closed', () => {
  const rows = completions();
  rows[1] = { ...rows[1], actionId: 'ACT-1', ownerRef: 'owner://ops/1' };
  assert.strictEqual(buildProductionFollowUpActionClosureEvidence(base({ completions: rows })).status, STATUS.HOLD_ACTION_COMPLETIONS);
});

check('owner mismatch fails closed', () => {
  const rows = completions({ actionId: 'ACT-1', ownerRef: 'owner://other' });
  assert.strictEqual(buildProductionFollowUpActionClosureEvidence(base({ completions: rows })).status, STATUS.HOLD_ACTION_COMPLETIONS);
});

check('completion before decision fails closed', () => {
  const rows = completions({ actionId: 'ACT-1', completedAt: '2026-09-01T17:00:00+03:00' });
  assert.strictEqual(buildProductionFollowUpActionClosureEvidence(base({ completions: rows })).status, STATUS.HOLD_ACTION_COMPLETIONS);
});

check('late completion is surfaced rather than hidden or auto-failed', () => {
  const rows = completions({ actionId: 'ACT-1', completedAt: '2026-09-02T13:00:00+03:00' });
  const out = buildProductionFollowUpActionClosureEvidence(base({ completions: rows }));
  assert.strictEqual(out.status, STATUS.READY_FOR_HUMAN_ACTION_CLOSURE_REVIEW);
  assert.deepStrictEqual(out.diagnostics.lateActionIds, ['ACT-1']);
  assert.strictEqual(out.actionsClosedByThisModule, false);
});

check('unresolved high or critical incident fails closed', () => {
  for (const severity of ['HIGH', 'CRITICAL']) {
    const incidents = [{ incidentId: `INC-${severity}`, severity, type: 'RUNTIME', resolved: false, evidenceRef: `evidence://incident/${severity}` }];
    assert.strictEqual(buildProductionFollowUpActionClosureEvidence(base({ incidents })).status, STATUS.HOLD_INCIDENTS);
  }
});

check('any data leakage incident fails closed even when resolved', () => {
  const incidents = [{ incidentId: 'INC-LEAK', severity: 'LOW', type: 'DATA_LEAKAGE', resolved: true, evidenceRef: 'evidence://incident/leak' }];
  assert.strictEqual(buildProductionFollowUpActionClosureEvidence(base({ incidents })).status, STATUS.HOLD_INCIDENTS);
});

check('resolved non-leakage incident may coexist with complete action evidence', () => {
  const incidents = [{ incidentId: 'INC-1', severity: 'HIGH', type: 'RUNTIME', resolved: true, evidenceRef: 'evidence://incident/1' }];
  assert.strictEqual(buildProductionFollowUpActionClosureEvidence(base({ incidents })).status, STATUS.READY_FOR_HUMAN_ACTION_CLOSURE_REVIEW);
});

check('evidence chain is mandatory and deduplicated', () => {
  const input = base();
  input.evidenceRefs = input.evidenceRefs.filter((ref) => ref !== 'evidence://completion/1');
  assert.strictEqual(buildProductionFollowUpActionClosureEvidence(input).status, STATUS.HOLD_EVIDENCE_CHAIN);

  const complete = base();
  complete.evidenceRefs.push(complete.evidenceRefs[0]);
  const out = buildProductionFollowUpActionClosureEvidence(complete);
  assert.strictEqual(out.status, STATUS.READY_FOR_HUMAN_ACTION_CLOSURE_REVIEW);
  assert.strictEqual(new Set(out.evidenceRefs).size, out.evidenceRefs.length);
});

console.log(`PRODUCTION_FOLLOW_UP_ACTION_CLOSURE_V1=PASS checks=${checks}`);
