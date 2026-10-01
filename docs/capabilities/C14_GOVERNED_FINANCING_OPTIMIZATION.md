# C14 — Governed Financing Option Comparison / Optimization Intelligence

## Purpose

C14 implements roadmap #464 backlog item 8 above exact qualified C13 head `4da183bcd326fb83fe32696b7a2d2e531794b06d`.

It compares explicit, provenance-bound financing offers and their complete quoted repayment cash flows. It may produce a deterministic analytical ordering only under an explicit governed comparison policy. It does not select a lender, approve financing, interpret financing documents, determine Sharia compliance, forecast reference rates, or authorize a transaction.

## Evidence contract

Each financing offer is bound to:

- offer ID;
- case and property;
- financing provider reference;
- externally supplied structure label;
- SAR comparison principal;
- explicit upfront fees;
- complete dated repayment schedule;
- quoted funding date;
- quote-valid-until date;
- maturity date;
- optional explicit rate-disclosure reference;
- covenant evidence references;
- security evidence references;
- source authority/reference/evidence reference;
- source version SHA-256;
- source verification/review window;
- professional reviewer/reference;
- review evidence SHA-256;
- reviewed-at and valid-until dates;
- deterministic financing-offer SHA-256.

The engine does not manufacture missing economic or legal terms.

## Repayment schedule semantics

Phase 0 accepts only explicit SAR payments with one of these caller-supplied classifications:

- `DEBT_SERVICE`
- `BALLOON`
- `OTHER_CONTRACTUAL_FINANCING_PAYMENT`

Every payment requires an ID, date, classification and positive SAR amount.

The caller must mark the quoted repayment schedule as complete for the exact comparison principal. Payments must fall on or after the target funding date and on or before the stated maturity date.

`upfrontFeesSar` is treated as an explicit upfront cash outflow outside the repayment schedule. The evidence pack must avoid duplicating the same fee inside scheduled payments.

## Deterministic comparison metrics

C14 may calculate only deterministic arithmetic from explicit offer evidence:

- upfront fees;
- total scheduled payments;
- nominal financing cost: `upfront fees + scheduled payments - comparison principal`;
- nominal financing-cost / principal ratio;
- maximum calendar-year scheduled debt service;
- explicit balloon total;
- tenor in days from target funding date to maturity date;
- annual scheduled debt-service lineage.

These are comparison metrics, not an APR/EIR, discount rate, present value, IRR, credit decision, debt-capacity opinion or covenant-compliance conclusion.

## Governed comparison policy

No default lender preference, financing preference, market threshold, weighting or optimization objective is embedded.

The selected policy must bind:

- case/property/as-of/target funding date;
- exact sorted financing-offer hashes;
- allowed structure labels;
- whether equal comparison principal is mandatory;
- any disclosures required for comparability (`RATE`, `COVENANTS`, `SECURITY`);
- an ordered list of supported comparison metrics and `MIN` / `MAX` direction;
- optional caller-supplied review thresholds;
- reviewer/reference/timestamp;
- policy SHA-256.

## Analytical ordering

When all evidence, policy and comparability gates pass, C14 may emit a lexicographic analytical ordering based only on the exact policy criteria.

- criteria are applied in policy order;
- no hidden weights exist;
- equal criteria remain ties;
- deterministic offer-ID ordering is used only to serialize tied rows consistently;
- the ordering is non-binding and cannot select a lender or structure.

## Review thresholds

Optional policy thresholds are review flags only.

A threshold specifies:

- a supported metric;
- `MAX` or `MIN` operator;
- explicit numeric value.

Threshold breaches do not create transaction authority, lender rejection or credit approval.

## Fail-closed behavior

C14 holds when any required gate fails, including:

- missing/invalid case, property, as-of date or target funding date;
- missing offers;
- duplicate offer IDs;
- offer hash tampering;
- case/property mismatch;
- missing required offer metadata;
- stale/future source evidence;
- professional review after the as-of date;
- evidence expiry before target funding;
- quoted funding date mismatch;
- quote expiry before target funding;
- maturity before target funding;
- unsupported currency;
- non-positive/non-finite comparison principal;
- negative/non-finite fees;
- incomplete/invalid repayment schedule;
- payment before funding or after maturity;
- missing/tampered/context-mismatched policy;
- policy-offer binding mismatch;
- disallowed structure label;
- missing policy-required disclosures;
- unequal principals when equal-principal comparability is required;
- unsupported/duplicate ranking criteria or review thresholds;
- non-finite derived metrics.

Hold outputs do not expose a financing ranking as though the comparison were valid.

## Authority boundary

C14 always keeps the following false:

- lender selected;
- credit approved;
- financing committed;
- Sharia compliance determined;
- legal financing opinion established;
- security priority determined;
- reference-rate forecast generated;
- DSCR compliance determined;
- LTV compliance determined;
- valuation calculated;
- NPV calculated;
- IRR calculated;
- automatic underwriting adoption;
- automatic acquisition/closing recommendation;
- transaction authority;
- approval authority;
- production authority;
- Public AI authority;
- Commercial Go-Live;
- canonical baseline activation.

C14 does not replace lender underwriting, treasury review, legal review, Sharia review, valuation, tax advice or investment-committee approval.

## Qualification

Dedicated exact-head qualification must run:

1. exact candidate-head assertion;
2. `node tests/defects/c14_governed_financing_optimization.js`;
3. canonical `npm run release:verify`.

Technical qualification does not authorize merge or production deployment. The PR remains Draft / Merge Hold / No Production Deploy until separate governed approval.
