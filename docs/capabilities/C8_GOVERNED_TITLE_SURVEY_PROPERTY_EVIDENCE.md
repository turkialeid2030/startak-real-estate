# C8 — Governed Title / Survey / Property-Evidence Verification

## Purpose

C8 implements the second extended-capability backlog item in roadmap #464 above the technically qualified C7 head `a4f10e81366ea0f2887ddfcaa2b4bd2d4d123c8d`.

C8 is an evidence-consistency and readiness gate. It does not establish legal title validity, issue a legal opinion, certify a valuation, authorize a transaction, or write financial-engine inputs.

## Relationship to existing property evidence controls

C8 is additive to the existing Wave 8C property-evidence bridge. The existing bridge already links professional assignment, inspection, evidence and measurements, but deliberately does not establish legal title validity.

C8 reuses the existing professional evidence chain and evidence reconciliation primitives, then adds a governed title/survey verification policy with explicit source, freshness, semantic-class and independent-evidence requirements.

## Governed policy

The caller must supply a policy containing:

- policy identity and version;
- required evidence source roles;
- required semantic property keys;
- semantic class mapping for each required key;
- maximum evidence age by source role;
- minimum independent source count by required key;
- explicit land-area comparison tolerance;
- any exact restriction/encumbrance/easement values that should block progression.

C8 does not manufacture a statutory freshness period, area tolerance, source hierarchy or legal rule.

## Evidence hard gates

C8 fails closed when any of the following applies:

- case/property identity is missing;
- governed policy is missing or malformed;
- a required evidence source role is missing;
- professional evidence-chain integrity fails;
- the stored fact payload no longer matches the hash-bound fact projection;
- evidence is not admissible for professional-report use;
- verification timestamp is missing, invalid, in the future, or stale under the supplied policy;
- a required property key is missing;
- independent evidence is below the supplied per-key threshold;
- cross-document material evidence conflicts;
- land-area units conflict or values disagree outside the explicit supplied tolerance;
- an exact material-finding value is configured by policy as blocking.

No source winner, automatic averaging or silent unit conversion occurs.

## Semantic mismatch classes

Policy mappings allow conflicts to be surfaced explicitly as applicable:

- `PROPERTY_IDENTITY_MISMATCH`
- `OWNER_MISMATCH`
- `PARCEL_MISMATCH`
- `PLOT_MISMATCH`
- `PLAN_MISMATCH`
- `LAND_AREA_MISMATCH`
- `LAND_AREA_UNIT_MISMATCH`
- generic `MATERIAL_PROPERTY_DATA_CONFLICT`

These are evidence-conflict classifications, not legal findings.

## Restriction / encumbrance / easement handling

Evidence mapped to `RESTRICTION`, `ENCUMBRANCE` or `EASEMENT` is always surfaced with provenance when supplied. It becomes a hard gate only when the governed policy lists an exact normalized value for that key as blocking.

This prevents the engine from inferring legal effect from arbitrary text or local practice.

## Determinism and integrity

C8:

- canonically sorts supplied evidence before reconciliation;
- preserves document, verification, review and chain lineage;
- hashes the normalized policy;
- returns a deterministic SHA-256 result hash;
- rebinds the current fact payload to the professional evidence-chain fact projection to detect payload/projection divergence.

## Output states

- `READY_FOR_PROFESSIONAL_REVIEW`
- `HOLD_POLICY`
- `HOLD_INTEGRITY`
- `HOLD_EVIDENCE`
- `HOLD_FRESHNESS`
- `MATERIAL_PROPERTY_DATA_CONFLICT`
- `HOLD_MATERIAL_FINDING`

`READY_FOR_PROFESSIONAL_REVIEW` is not a title-validity conclusion or authorization.

## Authority boundary

Every C8 result keeps:

- `legalTitleValidityEstablished=false`
- `certifiedValuationEstablished=false`
- `automaticUnderwritingAdoption=false`
- `financialEngineInputsWritten=false`
- `transactionAuthorized=false`
- `approvalAuthorized=false`
- `decisionBinding=false`

Project-level boundaries remain:

- `COMMERCIAL_GO_LIVE = HOLD`
- `TRANSACTION_AUTHORITY = FALSE`
- `PUBLIC_AI = FALSE`
- `CANONICAL_BASELINE_ACTIVATION_AUTHORIZED = FALSE`

## Qualification gate

The dedicated C8 workflow must pass on the exact candidate head:

1. `node tests/defects/c8_governed_title_survey_property_evidence.js`
2. canonical `npm run release:verify`

The branch and PR remain **Draft / Merge Hold / No Deploy** until a separate explicit authorization.