# C2 — Official Market Evidence & Comparable Transactions Foundation

Status: **Phase-0 engineering foundation only**

Roadmap: #464  
Tracking issue: #468

## Purpose

C2 creates a versioned, fail-closed evidence foundation for Saudi real-estate market comparables. It is designed to prevent four common decision defects:

1. treating asking/listing prices as if they were closed transactions;
2. pooling evidence from different geographies, asset types or analytical contexts without an explicit rule;
3. treating a public web page as proof of API/licensing/production machine-access rights;
4. converting a market-data calculation into a professional/certified valuation opinion.

## Public-source research basis — 29 Sep 2026

The official REGA Real Estate Indicators platform publicly states that it provides real-estate sale and rental market indicators and historical deal views. It identifies official data sources including Ministry of Justice, Real Estate Registry and Ejar, and publishes index series linked to official statistical sources including GASTAT.

Reference pages used for Phase-0 source classification:

- REGA Real Estate Indicators: `https://rei.rega.gov.sa/ar`
- REGA sale-deals view: `https://rei.rega.gov.sa/ar/advanced-search/deals`
- Ministry of Justice: `https://www.moj.gov.sa/`
- Real Estate Registry: `https://www.rer.sa/`
- Ejar: `https://www.ejar.sa/`
- GASTAT: `https://www.stats.gov.sa/`

These public references establish **source identity and public-service existence only**. They do not establish API availability, bulk-download rights, licensing, redistribution rights, SLA, authentication method or production-use permission.

## Contract

Schema version: `C2_MARKET_EVIDENCE_V1`

Evidence types are explicitly separated:

- `CLOSED_SALE_TRANSACTION`
- `CLOSED_RENT_TRANSACTION`
- `ASKING_SALE_LISTING`
- `ASKING_RENT_LISTING`
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
- official-domain source URL and source reference;
- trusted verifier and verification reference;
- governed freshness policy;
- non-future observation timestamp and non-stale validity window;
- JSON-safe deterministic normalized value;
- official resolution method appropriate to the evidence type.

Closed transactions additionally require a stable `transactionKey` and a usable price/rent-per-square-metre metric, supplied directly or deterministically derived from total amount and area.

## Minimum comparable count

C2 intentionally does **not** hard-code a universal minimum comparable count.

Decision readiness requires an evaluator-supplied minimum-count policy whose `policyId` is present in a separately governed policy allow-list. This prevents a caller from inventing a threshold ad hoc while also avoiding an unsupported universal threshold in the engine.

## Duplicate and conflict handling

- the same transaction key with the same normalized value may be corroborated across official sources and is deduplicated;
- the same transaction key with different normalized values is a hard evidence conflict and returns `HOLD_EVIDENCE`;
- unrelated transaction keys remain separate comparables;
- supplemental asking evidence never resolves an authoritative conflict.

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

For evidence labelled as an official/authoritative type, the Sandbox checks source registry scope and official-domain alignment but **cannot** convert that capture into trusted official evidence.

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
4. establish minimum-comparable policies by decision/use case;
5. privacy/security review for location and transaction evidence;
6. review field-level source semantics and transformation rules;
7. human review and explicit integration authorization;
8. regression, provenance, security and decision-integrity qualification on the eventual integration head.
