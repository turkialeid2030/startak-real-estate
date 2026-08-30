# CHARACTERIZATION_BEHAVIOR_FREEZE

> **NOTE**: DEF-001/002/003/004 were all subsequently RESOLVED (see `FINAL_CLOSURE_SUMMARY.md` and `audit/DEFECT_REGISTER.csv`). This document reflects the pre-remediation characterization baseline only.

**THIS FREEZE PRESERVES CURRENT BEHAVIOR. IT DOES NOT CERTIFY FINANCIAL CORRECTNESS.**

Canonical source hash: ac0767d3f13c463259f401a5d7af06c1140ee780a9f86489eb17ad9d7c72dc71 (unchanged before/after test execution)
Fixture hashes: characterization/FIXTURE_SHA256SUMS (4 files, all verified)
Test harness: minimal Node.js, package.json + package-lock.json, zero production dependencies
Test runner command: `npm test`

## Four Golden case statuses
RE-GOLD-001-U (land/unlevered): PASS
RE-GOLD-001-L (land/levered): PASS
RE-GOLD-002-U (building/unlevered): PASS
RE-GOLD-002-L (building/levered): PASS

## Comparison totals
204/204 fields matched exactly (0 mismatches, 0 absolute error, 0 relative error)
Cash-flow arrays: full length + every element compared, 0 mismatches
Recommendation strings: exact Arabic text compared, 0 mismatches

## Known preserved defects (NOT fixed by this freeze)
- DEF-001: Exit-value forward-NOI-growth timing asymmetry (POTENTIAL_DEFECT/MEDIUM) -- product decision required
- DEF-002: Occupancy >100% accepted via ordinary UI, inflates recommendation (CONFIRMED_DEFECT/HIGH)
- DEF-003: 309+ digit input reaches Infinity via UI, isNaN guard insufficient (CONFIRMED_DEFECT/HIGH)
- DEF-004: maxPaybackThreshold<=0 via unvalidated persisted state produces silent 0 SAR guidance (CONFIRMED_DEFECT/LOW)

## Known preserved asymmetries (NOT normalized by this freeze)
Construction-period interest capitalization (land only), vacancy treatment (building only), exit-value growth timing (asymmetric, see DEF-001), DSCR branches (both studies structurally identical, genuinely different outcomes per RE-GOLD), recommendation criteria bases (differ per study's cost/value structure, intentionally).

## Known uncovered branches
COV-001: building exit-value under nonzero growth (current fixture uses 0% growth, masks the DEF-001 asymmetry entirely)
COV-002: the third recommendation tier ("لا يوصى بالشراء") never exercised by either fixture

## Modularization authorization
CAN_MODULARIZATION_BEGIN = TRUE_SUBJECT_TO_REBASE_SCOPE (characterization passed). This does NOT authorize fixing DEF-001/002/003/004 -- only the structural Rebase under behavior-preservation controls (this test suite must continue passing throughout).
