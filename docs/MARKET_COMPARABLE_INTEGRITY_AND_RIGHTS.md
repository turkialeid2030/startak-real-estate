# Market comparable integrity boundary — 23 October 2026

This patch reinforces an **existing** market-comparable evidence module, and
does not claim to connect to a government source, authenticate an official
transaction, grant usage rights, or qualify a commercial Saudi appraisal.

## Proven engineering conditions

- `createComparableEvidenceRecord` normalizes input and produces a SHA-256
  fingerprint. Creation now rejects `verification.verifiedAt` dated **before
  the underlying transaction** or **after the record's capture**.
- `evaluateComparableSetQuality` now recomputes that fingerprint from the
  serialized normalized record on every use. A changed price, asset source,
  transaction date, reviewer or location without consistent fingerprint is
  rejected. It rejects an inconsistent rank, manipulated price/sqm or duplicate
  comparable ID before quality selection.
- A matching SHA-256 **does not authenticate** the source: an attacker who
  controls a record can recompute a matching digest. The result therefore
  explicitly reports
  `sourceUsageRightsEstablished=false`,
  `officialSourceAuthenticationEstablished=false`,
  `professionalMarketUseAuthorized=false`, and
  `certifiedValuationEstablished=false` even if the synthetic, quality-only
  `QUALIFIED_FOR_PROFESSIONAL_SELECTION` status is reached.
- This is a fail-closed in-memory data-integrity guard, not a cryptographic
  signature, anti-tamper storage or legal authority assertion.

## External evidence still needed for N03/N06/G01/G02/G09/G10/G14

For each prospective licensed integration, obtain official permission terms
covering the exact dataset, field-level and geographical scope, purpose,
retention, rates, data redistribution and expiry. Use an approved server-side
authentication and access pathway, verify observed records against source
IDs/property and deed or transaction identity, reject non-arm's-length cases,
pre-register independently held-out validation data, and secure independent
professional appraisal review. A source URL, username, token, or self-declared
reviewer string alone does not satisfy these requirements.

This engineering change does not change the user-facing licence decision;
institutional and certified valuation use remain HOLD / NOT_AUTHORIZED until
those approvals and independent validations are documented.

## Point-in-time market evidence control

Quality checks now reject a comparable for an as-of analysis whenever its source publication, acquisition/capture or verification took place after the valuation cutoff. This prevents hindsight data leakage in historical comparisons; a completed transaction date alone does not establish that the information was publicly or legally available when the decision was made. The original record is preserved for audit, but excluded from the qualified count with the `FUTURE_KNOWLEDGE_COMPARABLE` blocker. This is not a substitute for a licensed data feed or independent transaction authenticity proof.
