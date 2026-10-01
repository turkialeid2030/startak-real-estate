# C16 — Governed Auction Acquisition Intelligence

## Purpose
C16 is a deterministic, fail-closed review layer for real-estate auction opportunities. It evaluates explicit auction-event evidence, bidder-registration/document evidence, an externally supplied acquisition ceiling and a non-executing proposed bid.

C16 does not place bids, register bidders, move money, accept auction terms, infer legal eligibility, calculate market value, derive a maximum acquisition price, or authorize a transaction.

## Evidence model
### Auction evidence
The governed auction record binds:
- case, property and auction IDs;
- auction provider and source/evidence references;
- source-version SHA-256, verification time and review window;
- auction status;
- registration deadline, bidding start and bidding close;
- explicit starting/current bid and minimum increment;
- bidder deposit and explicit deposit treatment;
- explicit auction charges and their treatment;
- required bidder-document types;
- deterministic auction-evidence SHA-256.

### Bidder evidence
The bidder record binds:
- exact case/property/auction and bidder;
- externally evidenced registration status;
- registration evidence SHA-256;
- supplied bidder-document types;
- reviewer, verification timestamp and validity window;
- deterministic bidder-evidence SHA-256.

Software does not convert this evidence into a legal-eligibility opinion.

### Acquisition ceiling
The maximum bid is never derived by C16. It must be supplied through a governed external instruction containing:
- exact auction-evidence hash;
- maximum bid SAR;
- optional maximum known cash exposure SAR;
- instruction issuer/reference/rationale;
- review time and validity window;
- deterministic SHA-256.

The ceiling is an analytical boundary, not transaction approval.

### Bid proposal
The proposed bid is a non-executing analytical proposal. It is explicitly marked:
- `bidSubmitted=false`
- `paymentInitiated=false`
- `termsAccepted=false`
- `transactionAuthorized=false`

## Auction arithmetic
Only explicit mechanics are calculated:
- next minimum bid;
- headroom to the external maximum bid;
- separately payable explicit auction charges;
- deposit treatment without double-counting;
- known cash exposure;
- headroom to an externally supplied maximum known cash exposure.

Unknown deposit or charge treatment is never treated as zero.

## Fail-closed controls
C16 holds when it encounters:
- tampered hashes;
- cross-case/property/auction binding errors;
- stale/future evidence;
- expired bidding window or non-actionable auction status;
- unregistered bidder or missing required bidder documents;
- unresolved deposit/charge treatment;
- proposed bid below the explicit next minimum;
- proposed bid above the external maximum;
- known cash exposure above an external cash-exposure ceiling;
- weakened Phase-0 policy controls.

## Non-API source interaction
C16 does not itself scrape auction websites. Auction artifacts can be supplied by the qualified C2N non-API acquisition layer through permitted open-data/document downloads, user-authorized exports or manual governed evidence, subject to source-specific rights and provenance gates.

## Explicit non-goals
- automated bidding or bidder registration;
- deposit/payment transfer;
- acceptance of auction terms;
- legal eligibility, title or encumbrance opinion;
- RETT, VAT, tax or fee applicability determination;
- valuation, market-value inference, NPV, IRR or financing approval;
- automatic acquisition recommendation;
- transaction, approval, production, Public AI or commercial authority.

## Governance posture
- `COMMERCIAL_GO_LIVE = HOLD`
- `TRANSACTION_AUTHORITY = FALSE`
- `APPROVAL_AUTHORIZED = FALSE`
- `PUBLIC_AI = FALSE`
- `CANONICAL_BASELINE_ACTIVATION_AUTHORIZED = FALSE`
- `MERGE HOLD = ON`
- `DEPLOY = NO`
