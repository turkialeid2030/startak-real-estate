# C70 — Live C61 specialist evidence reference intake and case storage

## Problem
C69 ensures hotel and industrial V1 classes cannot silently route through the OFFICE/RETAIL/RESIDENTIAL valuation method, but it provides no actual in-app mechanism for collecting evidence references or executing the existing nine-control C61 specialist structural gate on a saved deal.

## Shipped code (pending acceptance)
- `SpecialistEvidenceIntakePanel.jsx` displays the nine **C61 control categories** with accessible bilingual Arabic/English references, a non-default selected specialist subtype, property reference and explicit inventory date. It offers a deliberate Save operation through the same `onChangeValuationCase` persistence path as V1, writing a distinct `valuationCase.institutionalEvidence.specialistIntake` object, **not** mutating the original legacy economic fields, prior C62 claims or original evidence.
- `specialist-reference-intake.js` validates schema and precise asset-type/subtype ownership; limits reference identifiers to at most 80 permitted characters; rejects arbitrary JSON fields, URLs with colon and slashes, cross-asset packet reuse and invalid dates. The local reference list records metadata **only**. This is not a document uploader, external data connector, verifier or legally valid document registry.
- The real C61 `evaluateSpecializedAssetEvidence` now runs from the actual specialist case context with every recorded reference deliberately marked `RECEIVED_UNVERIFIED` and **no invented source hash, independently licensed reviewer, hotel operating packet, hotel real-property business bridge or engineer-issued industrial inspection**. It must stay `HOLD_SPECIALIZED_ASSET_EVIDENCE` and never authorize a value, professional appraisal, transaction or report even with 9/9 references.
- Malformed/synthetic foreign-asset references fail closed to C69 six existing blockers; specialist routing never drops the refusal or substitutes office-style NOI.
- A real browser test performs both hotel and industrial entry, saves a valid three-reference intake, tries malicious URL input and verifies rejection, saves Arabic deals, reloads the entire browser, opens deals and verifies the same three references and continued C61/C69/C62 HOLD. Existing C69 and C63 real Chromium routes rerun separately.

## Explicit nonclosure
- No **actual document bytes**, cryptographic real-doc provenance, authenticity of transactions, right to reuse data, appraisal license verification, external C61 specialist attestation, hotel operating model, industrial engineering measurements, certified report or real human UAT are provided.
- Entering arbitrary references does not make C61 ready; it is intentionally a *real internal gate* with deliberately unverified metadata. The method adapter still returns no specialist valuation.
- Other sector journeys, C5/C6 report export and comprehensive Saudi market backtesting remain open under #634/#622. This Draft has not been merged or deployed.
