// src/contracts/recommendation-result.js -- maps ACTUAL current recommendation fields.
// Arabic verdict strings preserved EXACTLY -- confirmed against source lines 143-144.
const RECOMMENDATION_RESULT_FIELDS = Object.freeze({
  c1: { present: 'BOTH', type: 'boolean' },
  c2: { present: 'BOTH', type: 'boolean' },
  c3: { present: 'BOTH', type: 'boolean' },
  c4: { present: 'BOTH', type: 'boolean' },
  c5: { present: 'BOTH_WHEN_LEVERED', type: 'boolean | null' },
  metCount: { present: 'BOTH', type: 'number' },
  totalCriteria: { present: 'BOTH', type: 'number (4 unlevered, 5 levered)' },
  verdict: { present: 'BOTH', type: 'string', values: ['يوصى بالشراء', 'يوصى بالشراء بشروط', 'لا يوصى بالشراء'] },
});
module.exports = { RECOMMENDATION_RESULT_FIELDS };
