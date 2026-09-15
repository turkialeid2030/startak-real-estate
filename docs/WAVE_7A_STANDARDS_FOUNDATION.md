# Wave 7A — Standards Foundation

## Scope

Engineering foundation for STARTAK Real Estate's standards/regulatory intelligence layer. This wave is intentionally stacked on the qualified Wave B2 head `146f4929a2f7893cb7f82db045a4a88d6184dc7e` and does not authorize merge to `main` or production deployment.

## Directive contract implemented

The platform standards lifecycle is restricted to exactly:

- `ACTIVE`
- `FUTURE`
- `DRAFT`
- `SUPERSEDED`
- `RETIRED`
- `SUSPENDED`
- `UNDER_REVIEW`

A `DRAFT` or `FUTURE` standard cannot affect a production calculation, compliance conclusion, report approval, or production rule effect.

Draft material is limited to non-production analysis contexts:

- Gap Analysis
- Future Readiness
- Impact Assessment
- Development Planning

## Canonical Standards Registry record

Wave 7A implements the required registry fields:

- `standard_id`
- `title_ar`
- `title_en`
- `issuer`
- `jurisdiction`
- `category`
- `version`
- `publication_date`
- `effective_date`
- `expiry_date`
- `status`
- `source_url`
- `official_source`
- `last_verified`
- `next_review`
- `supersedes`
- `superseded_by`
- `applicable_asset_classes`
- `applicable_purposes`
- `mandatory_or_guidance`
- `rule_version_hash`
- `reviewer`
- `legal_review_status`

Optional applicability dimensions are also supported for later router work: reporting framework, regulated-entity status, transaction context, financing context, intended use, and intended user.

## Controlled activation

A `FUTURE` standard does not become `ACTIVE` merely because its effective date arrives. Activation requires all eight governed gates:

1. source verified
2. legal/professional review completed
3. impact analysis completed
4. code updated
5. regression tests passed
6. standards conformance passed
7. report templates updated
8. release approved

Only then may the new version become `ACTIVE`; supersession of the prior version is explicit and separately recorded.

## Historical reproducibility

`createStandardsSnapshot()` produces a deterministic `standards_snapshot_version` from the exact active versions selected for a dated context. It records that historical reports must remain reproducible and must not be automatically recalculated under a later standards version.

## Standards freshness

A record whose `next_review` date is past emits:

`STANDARD_VERIFICATION_STALE`

This is an engineering/provenance warning. The module never establishes legal approval, licensing status, transaction authority, or a professional valuation conclusion.

## Saudi precedence boundary

When a Saudi mandatory requirement conflicts with an international mandatory reference, the engine can record:

`SAUDI_MANDATORY_REQUIREMENT_PREVAILS`

All other unresolved conflicts fail to `HUMAN_REVIEW_REQUIRED`. The software does not self-establish a legal opinion.

## Executable StandardRule foundation

`src/standards/standard-rule-engine.js` binds each executable rule to:

`standard → provision → version → effective date → module → implementation → code reference → test → rule hash`

A `REQUIRE` or `BLOCK` rule cannot have production effect unless its exact standard/version is `ACTIVE`, date-applicable, context-applicable, and hash-matched.

`buildStandardRequirementsMatrix()` produces the first executable `STANDARD_REQUIREMENTS_MATRIX` representation with deterministic matrix hashing.

## Test coverage

`tests/architecture/run_standards_foundation_v1.js` verifies, using synthetic-only standards data:

- only the seven lifecycle states are accepted;
- unknown lifecycle states fail closed;
- DRAFT cannot be production-enforced;
- FUTURE cannot be production-enforced before governed activation;
- effective date alone cannot activate a FUTURE version;
- all eight activation gates are mandatory;
- prior ACTIVE version can be explicitly superseded only after replacement activation;
- standards snapshots preserve the historical active version;
- snapshot hashes are deterministic and input-order independent;
- stale verification emits `STANDARD_VERIFICATION_STALE`;
- Saudi mandatory precedence is represented without creating legal authority;
- StandardRule binding fails on version/date/hash drift;
- DRAFT rules cannot have production effect;
- standards requirements matrix preserves code/test traceability.

Expected marker:

`WAVE_7A_STANDARDS_FOUNDATION=PASS`

## Explicit non-goals

Wave 7A does **not** populate live Taqeem, IVS, RICS, CMA, SAMA, SOCPA, ZATCA, SBC, or SDAIA standards versions. Live entries require authoritative source verification and the designated professional/legal review before activation.

Wave 7A also does not yet implement the complete Purpose-Based Standards Router or Professional Assignment workflow; those are the next controlled sub-waves.

## Governance

- No merge to `main` authorized by this wave.
- No production deployment authorized by this wave.
- No transaction authority is introduced.
- No certified valuation status is introduced.
- No existing financial formula is modified.
- Golden financial fixtures remain untouched.
