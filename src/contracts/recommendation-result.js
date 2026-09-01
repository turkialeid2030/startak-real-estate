'use strict';

const RECOMMENDATION_RESULT_FIELDS = Object.freeze({
  c0: { present: 'BOTH', type: 'boolean', note: 'stabilized NOI must be positive' },
  c1: { present: 'BOTH', type: 'boolean' },
  c2: { present: 'BOTH', type: 'boolean' },
  c3: { present: 'BOTH', type: 'boolean' },
  c4: { present: 'BOTH', type: 'boolean' },
  c5: { present: 'BOTH_WHEN_LEVERED', type: 'boolean | null' },
  c6: { present: 'BOTH', type: 'boolean | null' },
  c7: { present: 'EXISTING_BUILDING_ONLY_WHEN_LEVERED', type: 'boolean | null' },
  metCount: { present: 'BOTH', type: 'number' },
  totalCriteria: { present: 'BOTH', type: 'number (model-version dependent)' },
  verdict: { present: 'BOTH', type: 'string', values: ['يوصى بالشراء', 'يوصى بالشراء بشروط', 'لا يوصى بالشراء'] },
  decisionStatus: { present: 'BOTH', type: 'ALL_CRITERIA_MET | SOFT_CONDITION_REQUIRED | HARD_GATE_FAILED | MULTIPLE_SOFT_CRITERIA_FAILED' },
  criteriaDetail: { present: 'BOTH', type: 'Array<{code:string,met:boolean,hardGate:boolean}>' },
  failedHardGates: { present: 'BOTH', type: 'string[]' },
  failedSoftCriteria: { present: 'BOTH', type: 'string[]' },
});
module.exports = { RECOMMENDATION_RESULT_FIELDS };
