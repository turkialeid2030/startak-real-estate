# CHARACTERIZATION_TEST_REPORT

## Test seam approach
tests/load_engines.js extracts lines 1-423 of platform-source.jsx VERBATIM (byte-for-byte, confirmed JSX-free by direct inspection before writing the loader -- first JSX token appears at line 425). The only test-only transformation is neutralizing 3 import statements (react/recharts/lucide-react, lines 1-10) into empty local bindings, since the calculation functions never reference them (confirmed by the full-file audit read). This is NOT a hand-reimplementation -- `computeNPV.toString()` printed from the loaded module matches the source file's own text exactly. The loader verifies the source SHA256 before every load and refuses to run if it has changed.

## Results
| gold_id | study | financing | status | fields compared | mismatches |
|---|---|---|---|---|---|
| RE-GOLD-001-U | land | unlevered | PASS | 48 | 0 |
| RE-GOLD-001-L | land | levered | PASS | 48 | 0 |
| RE-GOLD-002-U | building | unlevered | PASS | 54 | 0 |
| RE-GOLD-002-L | building | levered | PASS | 54 | 0 |

TOTAL_COMPARED_FIELDS = 204 (matches the earlier independent-audit reproduction exactly)
FIELD_MISMATCHES = 0, MAX_ABSOLUTE_ERROR = 0, MAX_RELATIVE_ERROR = 0
CASH_FLOW_ARRAY_MISMATCHES = 0 (full array length + every element compared, not totals only)
RECOMMENDATION_MISMATCHES = 0 (exact Arabic verdict strings compared, not normalized)

## Canonical command
`npm test` (also aliased `npm run test:characterization`) -- runs all 4 cases in one command, no manual steps.

## Preserved findings (unchanged by this pass)
DEF-001 (POTENTIAL_DEFECT/MEDIUM), DEF-002 (CONFIRMED_DEFECT/HIGH), DEF-003 (CONFIRMED_DEFECT/HIGH), DEF-004 (CONFIRMED_DEFECT/LOW), COV-001, COV-002 (COVERAGE_GAP), OBS-001 (OBSERVATION) -- none fixed, none re-classified. This test suite characterizes CURRENT behavior including these defects; it does not certify correctness.
