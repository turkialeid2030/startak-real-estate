# REBASE_PHASE_REFERENCE_MAPPING

## Canonical contract adopted
phase_id = "PHASE_{n}" (e.g. "PHASE_3") — the single stable foreign-key identifier used by BOTH registries. Display titles (e.g. "Saudi Data Fabric") are NOT used as keys anywhere.

## Historical note (honest timeline)
An earlier intermediate state of source-registry.json (during initial Wave C construction, before Wave C2's closing step) used a longer literal value `"PHASE_3_SAUDI_DATA_FABRIC"` for the `phase` field. This was corrected during Wave C2's own closing regression (not during this pass) via a direct field update: all 11 records' `phase` field was set to the canonical `"PHASE_3"` to match phase-registry.json's `phase_id` exactly.

## Verification performed THIS pass
Direct inspection of both files' current on-disk content (not assumed from memory):
- src/registries/source-registry.json: all 11 records have `phase: "PHASE_3"`
- src/registries/phase-registry.json: `phase_id` values are exactly `PHASE_0` through `PHASE_12`

Before/after mapping (all 11 sources, unchanged in this pass — already canonical):

| source_id | phase (before Wave C2 fix) | phase (current, verified this pass) |
|---|---|---|
| all 11 records | PHASE_3_SAUDI_DATA_FABRIC | PHASE_3 |

SOURCE_PHASE_REFERENCE_SEMANTIC_CHANGES = 0 (the field value changed in Wave C2; this pass changed nothing further — source identity, meaning, authority_class, connector_status, live_access, allowed_use, and prohibited_use were never touched by that or any other edit)
