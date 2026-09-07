# Wave 8C — Property Evidence Bridge

Status: engineering candidate only. No merge to `main`; no production deployment authorization.

## Purpose

Wave 8C closes the Wave 8 handoff between Professional Assignment, Document Intelligence, governed Inspection, professional Measurements, and the downstream valuation workflow.

The bridge does not calculate a value and does not write underwriting inputs. Its function is to construct one immutable evidence-linked property packet only after the upstream professional gates are satisfied.

## Required gates

A packet cannot become ready unless:

- the Professional Assignment is complete and eligible for standards routing;
- the inspection belongs to the same case/property and is genuinely completed with post-inspection review cleared;
- all mandatory inspection observation categories are present;
- inspection media exist and their manipulation checks are `PASS`;
- material measurement types reconcile to `CLEAR` under explicit tolerances/source requirements;
- every supplied property evidence record is admissible for `PROFESSIONAL_REPORT` use;
- caller-declared material property data reconcile without `MATERIAL_PROPERTY_DATA_CONFLICT`;
- case isolation is preserved across inspection, evidence, and measurements.

## Packet provenance

The ready packet preserves:

- assignment reference and assignment SHA-256;
- inspection identity and inspection SHA-256;
- valuation/report dates;
- jurisdiction, asset type and location;
- valued rights, basis of value and purpose;
- verified evidence fact provenance down to source document hash, locator, extraction method/confidence, verification reference, evidence link, chain hash and professional review evidence;
- professional measurement provenance including source, evidence, applied measurement-standard reference, method, measurer, timestamp and measurement hash;
- property-data and measurement gate status;
- deterministic packet SHA-256.

## Deliberate non-actions

`automaticUnderwritingAdoption=false` and `financialEngineInputsWritten=false` are architectural invariants. A property packet may support the next valuation workflow, but it cannot silently alter the canonical financial engine.

The packet also does not establish legal title validity, a certified appraisal, licensed-provider status, or transaction authorization.

## Failure states

- `HOLD_ASSIGNMENT`
- `HOLD_INSPECTION`
- `HOLD_MEASUREMENT`
- `HOLD_EVIDENCE`
- `MATERIAL_PROPERTY_DATA_CONFLICT`

No source winner, measurement average, unit conversion, or professional assumption is manufactured by the bridge.

## Qualification marker

`WAVE_8C_PROPERTY_EVIDENCE_BRIDGE=PASS`

## Wave 8 completion target

On qualification, Wave 8 establishes:

`Document / Evidence → Verification → Professional Evidence Chain → Property Conflict Gate → Inspection → Media Integrity → Measurement → Reconciliation → Property Evidence Packet → Professional Valuation Workflow Handoff`.

The next engineering wave is Wave 9: governed market evidence, comparable selection/verification, quantitative adjustment traceability, lease-level income evidence, and market-to-valuation handoff.
