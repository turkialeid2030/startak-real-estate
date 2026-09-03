# RIAI-01P — Operating Case Portability and Persistence

## Outcome

An Existing Building study can now load a real Residential Income operating case instead of always projecting the empty state. The path is local-only and does not upload documents or operating data to a server.

## File contract

The accepted JSON envelope is versioned:

```json
{
  "format": "STARTAK_RESIDENTIAL_INCOME_OPERATING_CASE",
  "snapshotVersion": 1,
  "exportedAt": "ISO-8601 timestamp",
  "operatingCase": {}
}
```

The payload is accepted only after every property interest, property, building, unit, tenant, lease, rent-collection record, evidence-aware input, operating expense, CAPEX item, and evidence-lineage record is reconstructed through the canonical contract factories.

## Safety boundaries

- Maximum JSON size: 5 MB.
- Dangerous object keys are rejected.
- Entity counts, projection counts, nesting depth, and object-graph size are bounded before reconstruction.
- Cross-property, cross-building, unit/lease, tenant, and evidence isolation rules are rerun.
- Invalid imports do not replace the currently loaded case.
- An operating case is valid only for a `building` Saved Deal; attaching one to `land` is rejected.
- No import triggers a financial write, valuation, recommendation, legal conclusion, or transaction authorization.

## Persistence

Saved Deal backup format v2 preserves the optional operating-case snapshot. Version-1 backups remain restorable and simply contain no operating case.

## Remaining boundary

Users can import/export a validated canonical case and use a guided workspace for verified lease-rent/end-date updates and collection records. Guided authoring for unit inventory, tenants, escalation schedules, OPEX, CAPEX, and evidence documents remains outside this portability wave.
