# C3I/C2S — Governed Whole-Property Reconciliation Integration

## Status
Integration/requalification wave stacked on the technically qualified C2S head `0d098e907ea12cd78ba3b4542394f5838481ffca` and the qualified C3M ancestry.

## Objective
Integrate the qualified whole-property market sales-comparison indication into governed C3 reconciliation while requiring every C1 geospatial and C2 market evidence record consumed by C3I to pass the C2S provenance layer first.

The intended analytical coverage is a genuine whole-property three-approach reconciliation:
- MARKET — `WHOLE_PROPERTY_SALES_COMPARISON_1.0`
- INCOME — governed income indication such as direct capitalization
- COST — governed cost-approach indication

## C2S provenance gate
C3I calls C2S internally through `evaluateC3IC2SGovernedReconciliation` before invoking the base C3 reconciliation engine.

Every C1/C2 evidence record used by the reconciliation must have exactly one governed source-provenance binding. The binding must prove:
1. C2S classification is `READY`.
2. The bound source record is `authoritativeEvidenceEligible=true`.
3. `sourceProvider` exactly matches the evidence record `sourceId`.
4. `originalSourceReference` exactly matches the evidence `sourceReference`.
5. The normalized HTTPS source URL matches the evidence source URL.
6. `evidenceHashSha256` equals the canonical hash of the exact evidence record being re-evaluated by C3.
7. No single source-provenance record is reused for multiple C1/C2 evidence records.
8. Every C1/C2 record has a binding; missing, duplicate or dead bindings fail closed.

C2S `decisionReady=false` is intentionally preserved: C2S classifies source provenance, while C3I independently determines reconciliation readiness only after all source-evidence and valuation gates pass.

## Provider registry extension
The integration adds a conservative governed identity for `REGA_GEOSPATIAL_REAL_ESTATE_PORTAL`, matching the official REGA source ID already used by C1 fixtures. Its production adapter remains disabled and machine-access status remains unverified.

## Commercial and AVM boundary
Earth, Suhail and Tathmin may remain in a C2S bundle as commercial corroboration or AVM benchmark evidence, but they cannot substitute for an authoritative C1/C2 evidence binding. Attempting to bind commercial/AVM evidence as authoritative input fails closed before valuation arithmetic.

## Whole-property MARKET contract
C3 recognizes only the exact qualified C3M model contract:
- model version: `WHOLE_PROPERTY_SALES_COMPARISON_1.0`
- approach family: `MARKET`
- value scope: `WHOLE_PROPERTY`
- accepted status: `WHOLE_PROPERTY_MARKET_VALUE_INDICATION_READY`
- indication type: `WHOLE_PROPERTY_SALES_COMPARISON_VALUE_INDICATION`
- value field: `valueIndicationSar`

The result must also preserve the C3M safety flags and input-packet hash required by the model registry. LAND sales comparison remains `LAND_ONLY` and is rejected from a WHOLE_PROPERTY policy.

## Canonical C3M current-input binding
A syntactically valid 64-character `inputPacketHashSha256` is not sufficient. For every C3M method indication, C3I requires a governed raw C3M input draft in `wholePropertyMarketInputsByIndicationId` and independently rebuilds the canonical C3M packet.

The rebuild forcibly takes the following values from the current C3I request, rather than trusting the upstream result or draft:
- `propertyRef`
- `valuationDate`
- `asOf`
- current C2 `marketEvidence`
- current `marketContextBinding`
- current governed market-context binder registry

C3I then:
1. executes `buildWholePropertySalesComparisonInputPacket`;
2. requires the resulting packet to be ready and pass `verifyWholePropertySalesComparisonInputIntegrity`;
3. executes the canonical C3M calculation engine again;
4. requires the supplied upstream C3M result to match the recomputed canonical result on model, status, property, valuation date, scope, approach, indication type, input hash, property-evidence hash, market-evidence evaluation hash, calculation hash, value, unit-value arithmetic, subject basis quantity and authority/safety flags.

This closes the stale/fabricated-hash gap: a C3M result produced from an earlier or different C2 market packet cannot enter current C3 reconciliation merely by presenting a structurally valid hash.

## Adversarial coverage
The integration regression includes:
- valid six-record authoritative C1/C2 provenance binding;
- missing C2S packet;
- missing evidence binding;
- untrusted provenance verifier;
- commercial Earth record attempted as authoritative C1 evidence;
- wrong official provider bound to a market record;
- post-provenance evidence tampering / evidence-hash mismatch;
- duplicate evidence binding;
- missing C3M input draft;
- stale C3M result generated from a different market-evidence packet;
- forged C3M input-packet hash;
- forged C3M calculation hash;
- fabricated C3M status;
- fabricated C3M indication type;
- upstream transaction-authority injection;
- LAND_ONLY market indication attempted in WHOLE_PROPERTY reconciliation.

## Fail-closed output
If source provenance or exact C1/C2 binding fails, C3I returns `HOLD_EVIDENCE`. If canonical C3M input/result binding fails, it returns `HOLD_RECONCILIATION`. Both states emit no analytical value and preserve:
- `finalValuationConclusionEstablished = false`
- `certifiedValuationEstablished = false`
- `transactionAuthorized = false`
- `publicAiAuthorized = false`

## Qualification rule
This document does not claim technical qualification until the exact integration head passes:
- dedicated C3I/C2S integration verification;
- relevant C2S/C3 workflows triggered by changed paths;
- canonical `release:verify`.

Composite shadow, fresh shadow, successor shadow, cutover safety and external canonical-source hash gates remain separate and may remain `NOT_EVALUATED` when their external inputs are not supplied.

## Authority boundary
- `COMMERCIAL_GO_LIVE = HOLD`
- `TRANSACTION_AUTHORITY = FALSE`
- `PUBLIC_AI = FALSE`
- `CANONICAL_BASELINE_ACTIVATION_AUTHORIZED = FALSE`

No merge to `main`, production deployment or licensed/certified valuation opinion is authorized by this integration wave.