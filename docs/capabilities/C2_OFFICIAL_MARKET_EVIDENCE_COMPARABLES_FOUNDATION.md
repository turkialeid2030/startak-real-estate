# C2 — Official Market Evidence & Comparable Transactions Foundation

Status: **Phase-0 engineering foundation only**

Roadmap: #464  
Tracking issue: #468

## Purpose

C2 creates a versioned, fail-closed evidence foundation for Saudi real-estate market comparables. It is designed to prevent recurring decision defects:

1. treating asking/listing prices as if they were closed transactions;
2. treating aggregate rental indicators as row-level registered rent transactions;
3. pooling evidence from different geographies, asset types or analytical contexts without an explicit rule;
4. conflating retrieval time with the transaction/index effective date;
5. collapsing multiple periods of one official index series into a false conflict;
6. treating a public web page as proof of API/licensing/production machine-access rights;
7. allowing a caller to lower a minimum-comparable threshold while reusing a governed policy identifier;
8. accepting duplicate transaction evidence as corroboration when the economic content agrees but the effective transaction date does not;
9. converting a market-data calculation into a professional/certified valuation opinion.

## Public-source research basis — 29 Sep 2026

The official REGA Real Estate Indicators platform publicly states that it provides real-estate sale and rental market indicators and historical sale-deal views. It identifies official upstream data sources including Ministry of Justice, Real Estate Registry and Ejar, and publishes index series linked to official statistical sources including GASTAT.

Reference pages used for Phase-0 source classification:

- REGA Real Estate Indicators: `https://rei.rega.gov.sa/ar`
- REGA sale-deals view: `https://rei.rega.gov.sa/ar/advanced-search/deals`
- Ministry of Justice: `https://www.moj.gov.sa/`
- Real Estate Registry: `https://www.rer.sa/`
- Ejar: `https://www.ejar.sa/`
- GASTAT: `https://www.stats.gov.sa/`

These public references establish **source identity and public-service existence only**. They do not establish API availability, bulk-download rights, licensing, redistribution rights, SLA, authentication method or production-use permission.

C2 therefore narrows REGA's Phase-0 scope deliberately: REGA may support historical closed-sale evidence and sale/rent aggregate or index evidence where the field semantics are independently verified, but C2 does **not** infer row-level closed-rent transaction authority from REGA's aggregate rental indicators. Row-level registered rent evidence is modeled separately under Ejar, subject to independent access and field-level verification.

## Contract

Schema version: `C2_MARKET_EVIDENCE_V1`

Evidence types are explicitly separated:

- `CLOSED_SALE_TRANSACTION`
- `CLOSED_RENT_TRANSACTION`
- `ASKING_SALE_LISTING`
- `ASKING_RENT_LISTING`
- `SALE_MARKET_AGGREGATE`
- `RENT_MARKET_AGGREGATE`
- `SALE_PRICE_INDEX`
- `RENT_INDEX`
- `MARKET_LIQUIDITY_INDICATOR`

Evidence classes are likewise separated:

- authoritative closed transaction;
- authoritative aggregate;
- supplemental asking/listing evidence.

Asking/listing evidence is never included in the authoritative closed-transaction distribution.

## Decision-readiness governance

Authoritative evidence requires:

- exact market-context binding;
- exact geography binding;
- exact asset-type binding;
- registered official source compatible with the evidence type;
- HTTPS official-domain source URL and source reference;
- trusted verifier and verification reference;
- governed freshness policy;
- explicit `effectiveAt` for the economic/market observation being represented;
- explicit `observedAt` for when the evidence was obtained/verified;
- `effectiveAt <= observedAt <= asOf`;
- non-stale validity window;
- JSON-safe deterministic normalized value;
- prototype-safe canonical hashing of normalized evidence;
- official resolution method appropriate to the evidence type.

Closed transactions additionally require a stable `transactionKey` and a usable price/rent-per-square-metre metric, supplied directly or deterministically derived from total amount and area.

Official aggregates/indices additionally require both:

- `seriesKey` — identity of the official series;
- `periodKey` — identity of the observation period.

This prevents legitimate quarter-to-quarter or month-to-month changes in the same series from being treated as contradictory evidence.

## Minimum comparable count

C2 intentionally does **not** hard-code a universal minimum comparable count.

Decision readiness selects a `minimumCountPolicyId`, but the threshold values are read from an evaluator-supplied **governed minimum-count policy registry**. The evidence payload cannot supply or lower those threshold values. If the selected policy is absent, malformed, or lacks a required evidence-type threshold, C2 fails closed.

This distinguishes:

- selecting an approved policy; from
- defining the contents of that policy.

The latter remains an external governance responsibility.

## Duplicate and conflict handling

For closed transactions:

- same transaction key + same normalized economic value + same `effectiveAt` may be corroborated across official sources and is deduplicated;
- same transaction key with a different normalized value **or a different effective date** is a hard conflict and returns `HOLD_EVIDENCE`.

For official aggregates/indices:

- identity is `evidenceType + seriesKey + periodKey`;
- different periods in the same series remain distinct valid observations;
- same series and same period with different normalized value or effective date returns `HOLD_EVIDENCE`.

Supplemental asking evidence never resolves an authoritative conflict.

## Supplemental asking/listing evidence

Asking evidence is structurally supplemental. It may be retained for context but cannot satisfy an authoritative evidence requirement or enter the authoritative closed-transaction distribution.

If a supplemental URL is supplied, C2 requires a syntactically valid HTTP(S) URL. This is transport hygiene only and does not promote that source to official authority.

## Sandbox boundary

`src/market/sandbox-market-evidence-draft.js` is deliberately non-authorizing.

It always creates:

- `UNVERIFIED` evidence;
- `USER_SUPPLIED` resolution;
- no verifier or verification reference;
- no decision readiness;
- no professional valuation opinion;
- no transaction authority;
- no Public AI authority.

The Sandbox can preserve `effectiveAt`, `seriesKey` and `periodKey` for later verification, but it cannot establish their authority.

For evidence labelled as an official/authoritative type, the Sandbox checks source-registry scope and official-domain alignment but **cannot** convert that capture into trusted official evidence.

## Explicit non-authority

C2 Phase 0 does not create or imply:

- API/licensing rights;
- professional or certified valuation authority;
- Taqeem-accredited valuation opinion;
- legal or tax opinion;
- lender approval;
- transaction authority;
- canonical-baseline activation;
- production deployment authorization;
- Public AI activation;
- Commercial Go-Live.

Current governance remains:

- `COMMERCIAL_GO_LIVE = HOLD`
- `TRANSACTION_AUTHORITY = FALSE`
- `PUBLIC_AI = FALSE`
- `CANONICAL_BASELINE_ACTIVATION_AUTHORIZED = FALSE`

## Remaining gates before governed integration

1. independently verify machine-access/API/licensing path for each production source;
2. name and govern the trusted-verifier registry owner;
3. name and govern freshness-policy ownership;
4. establish governed minimum-comparable policy definitions by decision/use case;
5. verify row-level field semantics for each transaction source independently from aggregate indicators;
6. privacy/security review for location and transaction evidence;
7. review source-specific transformation, canonical transaction-key and deduplication rules;
8. human review and explicit integration authorization;
9. regression, provenance, security and decision-integrity qualification on the eventual integration head.
