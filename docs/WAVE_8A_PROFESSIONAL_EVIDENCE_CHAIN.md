# Wave 8A — Professional Evidence Chain & Material Property Data Conflict Gate

Status: engineering candidate only. No merge to `main`; no production deployment authorization.

## Purpose

Wave 8A hardens the existing Document Intelligence foundation rather than replacing it. Existing document hashes, evidence facts, verification workflows, reconciliation, readiness, underwriting adoption, and evidence-to-calculation traceability remain authoritative components. This wave adds the professional evidence chain required by the 2026 STARTAK valuation architecture.

## Professional evidence chain

Every bounded professional evidence record carries:

- case and fact identity;
- source document identity and SHA-256 content hash;
- page/cell/slide/section locator already captured by the canonical evidence fact;
- extraction method and extraction confidence;
- source role;
- source reference and evidence link;
- extractor type/name/version;
- capture actor reference;
- risk/sensitivity class;
- deterministic chain SHA-256;
- optional accountable human professional review.

The chain hashes provenance metadata and a hash of the normalized value rather than treating extraction confidence as truth confidence.

## Target-specific admissibility

`ANALYSIS_ONLY` may display extracted evidence with explicit limitations. `PROFESSIONAL_REPORT` and `ENGINE_INPUT` require a canonical verified fact. MATERIAL/CRITICAL evidence additionally requires accountable human professional review. CRITICAL evidence also requires verified authority provenance.

No admissibility state establishes legal validity, a certified appraisal, licensed-provider status, or transaction authority.

## Material property-data conflict gate

The caller supplies the semantic keys that are material to the assignment. Evidence is reconciled across source roles such as title deed, real-estate registry, building permit, approved plan, survey, inspection, lease, and other bounded sources.

For a material key:

- conflicting normalized values => `MATERIAL_PROPERTY_DATA_CONFLICT`;
- incompatible units => `MATERIAL_PROPERTY_DATA_CONFLICT`;
- missing required evidence/source-role diversity => `HOLD_INSUFFICIENT_EVIDENCE`;
- no automatic source winner or silent unit conversion is permitted.

A material conflict blocks professional valuation progression, professional report readiness, and financial-engine adoption until an accountable human reconciliation workflow resolves it.

## Governance invariants

- Existing evidence verification remains a separate accountable workflow.
- Evidence readiness never authorizes a transaction.
- No financial formula or golden fixture is changed.
- No live professional standard is activated in this wave.
- No legal or licensing conclusion is inferred.
- Cross-case evidence is rejected fail-closed.

## Qualification marker

`WAVE_8A_PROFESSIONAL_EVIDENCE_CHAIN=PASS`

## Next sub-wave

Wave 8B: governed inspection lifecycle, inspection media integrity, and measurement model (land/GFA/BUA/NLA/GLA/rentable/common areas) with measurement-standard provenance and reconciliation against deed/plan/inspection evidence.
