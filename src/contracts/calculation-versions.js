// src/contracts/calculation-versions.js -- metadata-only version contract.
function createCalculationVersions() {
  return {
    study_version: '1.0.0-rebase-wave-b3',
    input_version: '1.0.0',
    formula_version: 'forward-noi-cap-1.0.0', // DEF-001 decision: both studies standardized on Forward NOI Cap exit-value convention (D5/D6)
    rule_version: '1.0.0',
    source_version: 'ac0767d3f13c463259f401a5d7af06c1140ee780a9f86489eb17ad9d7c72dc71',
    calculation_run_id: null,
  };
}
module.exports = { createCalculationVersions };
