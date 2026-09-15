# Wave 8B — Governed Inspection Lifecycle & Measurement Model

Status: engineering candidate only. No merge to `main`; no production deployment authorization.

## Scope

Wave 8B implements the professional inspection and measurement layer required by the STARTAK 2026 valuation architecture.

## Inspection lifecycle

The governed state machine is:

`DRAFT → PRE_INSPECTION_READY → IN_PROGRESS → POST_INSPECTION_REVIEW → COMPLETED`

A returned inspection may re-enter pre-inspection preparation. Completion is blocked unless all professional field-work gates are satisfied.

### Pre-inspection gate

Requires explicit confirmation of access, title evidence, plan evidence, safety plan, equipment, conflict review, and location verification, with evidence references and accountable preparer identity.

### During inspection

The inspection records:

- site GPS anchor;
- device reference;
- timestamped/geolocated observations;
- condition;
- occupancy;
- construction;
- MEP;
- surroundings;
- defects;
- measurement observations and other supporting observations as needed.

### Inspection media integrity

Every media record includes:

- SHA-256 content hash;
- timestamp;
- GPS coordinates and optional accuracy;
- device reference;
- manipulation-check status;
- manipulation evidence reference when checked;
- deterministic integrity hash.

`FLAGGED` or `NOT_RUN` media cannot satisfy the completion gate.

## Measurement model

Canonical measurement types:

- LAND_AREA
- GFA
- BUA
- NLA
- GLA
- RENTABLE_AREA
- COMMON_AREA

Each measurement requires the measurement-standard reference actually used, measurement method, source/evidence reference, accountable measurer, timestamp, and source class. Values are stored in canonical square metres (`SQM`).

This wave deliberately does not guess or silently substitute IPMS or another measurement standard. The applicable standard must be supplied by the governed assignment/standards workflow.

## Measurement reconciliation

Caller-declared material measurement types are reconciled across independent source classes. Configured absolute/relative tolerances may be applied. Material discrepancies produce `MEASUREMENT_CONFLICT`; missing required evidence produces `HOLD_INSUFFICIENT_EVIDENCE`.

No automatic averaging, source winner, or silent unit conversion is performed.

## Post-inspection review

Completion requires:

- all mandatory observation categories recorded;
- at least one inspection media record;
- all media manipulation checks cleared;
- measurement gate status `CLEAR`;
- explicit reviewer acknowledgements;
- accountable review evidence.

Inspection completion does not establish a certified valuation, legal opinion, or transaction authority.

## Qualification marker

`WAVE_8B_INSPECTION_MEASUREMENT=PASS`

## Next sub-wave

Wave 8C: bridge inspection/measurement outputs into the professional evidence chain and Assignment/Property domain, including deed/registry/permit/plan/inspection reconciliation and evidence-linked property facts without automatic underwriting adoption.
