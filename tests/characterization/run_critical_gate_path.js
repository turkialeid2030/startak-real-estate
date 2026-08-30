// tests/characterization/run_critical_gate_path.js -- Section 15: for all 4
// Golden Investment Cases, verify 16 gates each, valid IDs, allowed statuses,
// zero fabricated PASS/FAIL/CONDITIONAL, financial result unchanged.
const fs = require('fs');
const path = require('path');
const { calculateInvestmentCase, STUDY_TYPE } = require('../../src/engines');
const { createExecutableInvestmentCase } = require('../../src/contracts/executable-investment-case');

const FIXTURE_DIR = path.join(__dirname, 'fixtures');
const studyTypeMap = { land: STUDY_TYPE.LAND_DEVELOPMENT, building: STUDY_TYPE.EXISTING_BUILDING };
const fixtureFiles = ['RE-GOLD-001-U', 'RE-GOLD-001-L', 'RE-GOLD-002-U', 'RE-GOLD-002-L'];
const VALID_STATUSES = ['NOT_EVALUATED', 'INSUFFICIENT_EVIDENCE', 'PASS', 'FAIL', 'CONDITIONAL', 'NOT_APPLICABLE'];
const FABRICATABLE_STATUSES = ['PASS', 'FAIL', 'CONDITIONAL'];

let totalGateRecords = 0, fabricatedDecisions = 0, financialMismatches = 0, invalidStatuses = 0, invalidIds = 0;
const expectedIds = new Set(Array.from({length:16}, (_,i)=>`CG-${String(i+1).padStart(2,'0')}`));

for (const fid of fixtureFiles) {
  const fixture = JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, fid + '.json'), 'utf8'));
  const raw = calculateInvestmentCase({ studyType: studyTypeMap[fixture.study_type], inputs: fixture.input_set, leverageEnabled: fixture.input_set.leverageEnabled });
  const ic = createExecutableInvestmentCase({ caseId: fid, studyType: studyTypeMap[fixture.study_type], inputs: fixture.input_set, engineResult: raw, verdict: raw.verdict });

  const gates = ic.criticalGates.items;
  totalGateRecords += gates.length;
  if (gates.length !== 16) console.log(`${fid}: WRONG GATE COUNT ${gates.length}`);

  for (const g of gates) {
    if (!expectedIds.has(g.gate_id)) invalidIds++;
    if (!VALID_STATUSES.includes(g.status)) invalidStatuses++;
    if (FABRICATABLE_STATUSES.includes(g.status)) fabricatedDecisions++; // any non-NOT_EVALUATED/INSUFFICIENT_EVIDENCE/NOT_APPLICABLE default = fabrication
  }

  // Financial result must be byte-identical to a call WITHOUT the InvestmentCase wrapper.
  if (ic.financialModel.irr !== raw.irr || ic.financialModel.npv !== raw.npv || JSON.stringify(ic.financialModel.cashflows) !== JSON.stringify(raw.cashflows)) financialMismatches++;
  if (ic.recommendation.verdict !== raw.verdict) financialMismatches++;

  console.log(`${fid}: gates=${gates.length}, all NOT_EVALUATED=${gates.every(g=>g.status==='NOT_EVALUATED')}, financial unchanged=${ic.financialModel.irr===raw.irr}`);
}

console.log('');
console.log(`CRITICAL_GATE_CASES=${fixtureFiles.length}`);
console.log(`CRITICAL_GATE_RECORDS_TESTED=${totalGateRecords}`);
console.log(`INVALID_GATE_IDS=${invalidIds}`);
console.log(`INVALID_GATE_STATUSES=${invalidStatuses}`);
console.log(`FABRICATED_CRITICAL_GATE_DECISIONS=${fabricatedDecisions}`);
console.log(`CRITICAL_GATE_INTEGRATION_FINANCIAL_MISMATCHES=${financialMismatches}`);
process.exit(totalGateRecords === 64 && invalidIds === 0 && invalidStatuses === 0 && fabricatedDecisions === 0 && financialMismatches === 0 ? 0 : 1);
