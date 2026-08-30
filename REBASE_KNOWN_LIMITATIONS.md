# REBASE_KNOWN_LIMITATIONS

> **NOTE**: DEF-001/002/003/004 listed below were all subsequently RESOLVED. See `FINAL_CLOSURE_SUMMARY.md` and `audit/DEFECT_REGISTER.csv` for current status.

DEF-001: Exit Value Growth Timing Difference -- POTENTIAL_DEFECT/MEDIUM -- unchanged, unresolved, requires product decision
DEF-002: Occupancy Above 100% Accepted -- CONFIRMED_DEFECT/HIGH -- unchanged
DEF-003: UI Infinity Numeric Boundary -- CONFIRMED_DEFECT/HIGH -- unchanged
DEF-004: Invalid persisted/direct-engine zero denominator edge -- CONFIRMED_DEFECT/LOW -- unchanged
COV-001, COV-002: coverage gaps -- unchanged, unresolved
LIVE_CONNECTED_SOURCES = 0
Future Phase 0-12 capabilities: NOT implemented, not claimed
Production auth/database/RLS: intentionally NOT implemented at this stage
Regulatory fields (8): still DISCONNECTED_DECISION_INPUT, not connected to recommendation

## This pass's own limitation
This pass extracted the 4 engine files and proved their equivalence to the legacy
line-extraction path. It did NOT complete the remaining ~25 architectural items
this command requested (ExecutableInvestmentCase, StudyDefinitions, study levels,
version contract, i18n, terminology/source/phase/capability registries, critical
gates, Saved Deals migration, UI wiring). See the final response for the full
honest accounting of what remains.
