# C2S — Source Intelligence & Evidence Provenance Registry

## Status
Phase-0 foundation. Independent from C3I and stacked on the qualified C3M head.

## Purpose
C2S prevents Startak Real Estate from confusing a data provider with the underlying authority of the data. It creates a governed provenance layer before market, geospatial, AVM or professional-valuation evidence is allowed to influence downstream decision logic.

## Source tiers
1. `A_OFFICIAL_AUTHORITATIVE` — official government/statistical sources.
2. `B_COMMERCIAL_CORROBORATION` — commercial intelligence/discovery platforms such as Earth and Suhail.
3. `C_INDICATIVE_AVM` — external automated valuation models such as Tathmin.
4. `D_LICENSED_PROFESSIONAL` — a specifically governed professional valuation provider whose license has been independently verified through a trusted process.

## Mandatory provenance metadata
- `sourceProvider`
- `underlyingAuthority`
- `provenanceVerified`
- `sourceTier`
- `licensingStatus`
- `sourceUrl`
- `retrievedAt`
- `effectiveAt`
- `validUntil`
- `originalSourceReference`
- `methodologyVersion`
- `corroboratedBy`
- `evidencePayload`
- `evidenceHashSha256`

## Authority rules
- A commercial provider can never self-elevate into authoritative evidence.
- A commercial or AVM record claiming official underlying provenance must be corroborated by the hash of an independently verified official evidence record in the same governed bundle.
- An AVM is a benchmark/challenger input only.
- A professional opinion requires a governed provider registry entry, a Taqeem-framework license assertion, a trusted license verifier, verification reference, verification timestamp and non-expired license validity.
- Public web availability never implies API, machine-access, redistribution or production-ingestion rights.
- C2S never establishes final valuation, certified valuation, transaction authority or Public AI authority.

## Canonical provider registry
The initial registry contains conservative provider identities for REGA, Ministry of Justice, Real Estate Registry, Ejar, GASTAT, Balady, Earth, Suhail and Tathmin. Machine-access flags remain disabled/unverified. Specific professional valuation firms are intentionally not pre-trusted; they must be supplied through a governed professional-provider registry and independently license-verified.

## Deterministic integrity
Every record verifies `evidenceHashSha256` against a canonical JSON hash of `evidencePayload`. The normalized provenance record is separately hashed, and the bundle hash is stable under record ordering.

## Integration boundary
This wave does not modify C3I. A later integration wave can require a C2S provenance packet before C2/C3M/C3I accepts an external source. That later change requires separate regression and exact-head qualification.

## Authority boundary
- `COMMERCIAL_GO_LIVE = HOLD`
- `TRANSACTION_AUTHORITY = FALSE`
- `PUBLIC_AI = FALSE`
- `CANONICAL_BASELINE_ACTIVATION_AUTHORIZED = FALSE`

No merge or deployment is authorized by this foundation.
