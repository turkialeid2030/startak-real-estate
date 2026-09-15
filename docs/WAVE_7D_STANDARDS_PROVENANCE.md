# Wave 7D — Standards Provenance & Historical Saved-Deal Snapshot

## Scope

Completes the Wave 7 standards-core lineage by binding a professionally ready assignment and its qualified standards route to Saved Deal envelope metadata. This wave is stacked on qualified Wave 7C and remains non-production.

## Saved Deal metadata contract

When standards provenance is present, the Saved Deal carries the complete top-level group:

- `standardsSnapshotVersion`
- `standardsSnapshot`
- `valuationStandardsContext`

The group is optional for backward compatibility with historical pre-Wave-7 records, but it is atomic: partial presence fails closed.

The metadata is expressly separated from `inputs`. Standards/version/provenance keys inside economic inputs are rejected.

## Historical reconstruction contract

The saved context records:

- valuation date
- report date
- purpose
- intended use
- intended user
- asset type
- jurisdiction
- exact model version
- exact standards route hash
- professional assignment snapshot hash
- exact selected standards/version snapshot

Policy is fixed as:

`USE_SAVED_STANDARDS_SNAPSHOT_NOT_CURRENT_REGISTRY`

and:

`automaticRecalculationOnNewStandard = false`

Historical reconstruction therefore uses the saved standards environment and does not silently consult the current registry.

## Integrity controls

A valid persisted standards context requires:

- deterministic `standardsSnapshotVersion` hash;
- snapshot/version equality;
- at least one selected standard;
- every selected production standard remains recorded as `ACTIVE` at the saved valuation context;
- route hash and assignment snapshot hash;
- valuation/report date ordering;
- snapshot/context purpose, asset type, jurisdiction and valuation-date equality;
- historical reproduction flag = true;
- automatic recalculation flag = false;
- legal approval, certified valuation and transaction authority = false.

Tampering or partial metadata fails the canonical Saved Deal structural validator as:

`INVALID_STANDARDS_SNAPSHOT_METADATA`

Attempting to place standards metadata in economic inputs fails as:

`STANDARDS_METADATA_IN_ECONOMIC_INPUTS`

## Backup / restore preservation

The existing backup envelope remains version 4 because this change is an additive per-deal extension, not a top-level backup-format break.

`projectDealRecord()` now explicitly preserves all canonical additive envelope metadata:

- `assumptionModelVersion`
- `zakatCase`
- `operatingCase`
- `valuationCase`
- `standardsSnapshotVersion`
- `standardsSnapshot`
- `valuationStandardsContext`

This closes a preservation gap in backup projection without changing financial inputs or calculations.

## Regression coverage

`tests/saved-deals/run_standards_snapshot_persistence_v1.js` verifies with synthetic-only standards and assignment data:

- deterministic standards snapshot persistence;
- model version and valuation/report dates preserved;
- standards metadata never enters economic inputs;
- complete metadata passes canonical Saved Deal validation;
- partial metadata fails closed;
- snapshot-version tampering is detected;
- DRAFT selected versions cannot appear in a production snapshot;
- historical reconstruction ignores a newer current registry version;
- assignment/route valuation-date mismatch fails closed;
- backup export preserves standards provenance and assumption-model metadata;
- restore preserves exact historical standards identities;
- no certified valuation, legal approval or transaction authority is created.

Expected marker:

`WAVE_7D_STANDARDS_PROVENANCE=PASS`

## Wave 7 completion boundary

With 7A–7D qualified, Wave 7 provides the engineering chain:

`Standard → Registry → Lifecycle → Rule → Router → Assignment → Standards Snapshot → Saved Deal → Historical Reconstruction → Test Evidence`

Live Saudi/international standards content remains separately subject to source verification and professional/legal review before activation.

## Governance

- No merge to `main` authorized by this wave.
- No production deployment authorized by this wave.
- No certified valuation output is introduced.
- No legal opinion is introduced.
- No transaction authority is introduced.
- No financial formula or golden fixture is modified.

## Next controlled wave

Wave 8 — Documents + Inspection + Measurements + Evidence, beginning with canonical evidence records, document extraction provenance, sensitive-field verification gates and material property-data discrepancy handling.
