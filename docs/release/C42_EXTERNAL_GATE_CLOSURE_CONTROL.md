# C42 — External Gate Closure Control

## Purpose

C42 does not claim that any external release gate is satisfied. It converts the C39 historical-evidence audit into one current, deterministic closure-control plane so the remaining work is explicit, ordered and fail-closed.

Base lineage: `c39-historical-evidence-reuse-audit` at `c09a3308ce1ce08ab468e553931a84ce056992c1`.

## Governing rule

Engineering may prepare request packets, preserve exact candidate lineage, validate artifact structure/integrity and execute non-production technical checks. Engineering must not self-assert independent security, privacy, legal, human UAT, provider authorization, source-rights approval, real historical evidence, canonical source bytes or cutover authority.

The C42 manifest therefore keeps all 13 C30/C31 gates blocking and all release/deploy/go-live/transaction/Public-AI authority false.

## Closure order

1. `ROLLBACK_OPERATIONAL_VERIFICATION` — closest to closure. The controlled rehearsal, durable candidate evidence, Said reviewer designation, reviewer trust material and signed-response template already exist. Remaining requirement: genuine substantive RSA-SHA256-signed Said review, C38 verification and governed C30 ingestion.
2. `UAT_HUMAN_APPROVAL` — execute `release/evidence/c35-owner-uat-execution-pack.json` with an authorized business/professional reviewer and capture genuine sign-off.
3. `SECURITY_REVIEW_AUTHORIZATION` — independent exact-scope security review.
4. `PRIVACY_REVIEW_AUTHORIZATION` — qualified Saudi PDPL/privacy review.
5. `LEGAL_REGULATORY_APPROVAL` — qualified Saudi legal/compliance disposition.
6. `SOURCE_RIGHTS_AUTHORIZATION` — source-by-source reuse-rights disposition for the exact current source universe.
7. `AI_PROVIDER_PRODUCTION_AUTHORIZATION` — only if live AI is to be activated; simulation/engineering success is not provider authorization.
8. `HISTORICAL_REPLAY_EVIDENCE` — real historical cases, provenance, observed outcomes, predeclared measures and independent review.
9. `CANONICAL_SOURCE_HASH` — actual external canonical source bytes must be supplied and hash exactly to the governed expected digest.
10. `COMPOSITE_BASELINE_SHADOW` — real candidate/evidence pair.
11. `FRESH_COMPOSITE_SHADOW` — real fresh-cycle pair.
12. `SUCCESSOR_FRESH_COMPOSITE_SHADOW` — real successor-fresh pair.
13. `COMPOSITE_CUTOVER_SAFETY` — reviewer lifecycle, activation plan, shadow evidence and rehearsal set; even PASS does not itself authorize activation.

## Acceptance boundary

C42 engineering verification may be PASS while the release posture remains HOLD. This is intentional. The final state is not a voting outcome; a single unresolved governing gate remains sufficient to block merge/deploy/go-live authority when that gate is required by the release contract.

## Exact outputs

`tools/c42-external-gate-closure-control.js` validates:

- exact 13-gate coverage against C39;
- exact issue/state correspondence;
- no engineering self-satisfaction of external gates;
- Said rollback-review lineage and prepared artifacts;
- prepared UAT pack reference;
- governed canonical-source expected SHA-256;
- all authority flags remain false.

`tests/defects/c42_external_gate_closure_control.js` protects the fail-closed posture from regression.

`.github/workflows/c42-external-gate-closure-control.yml` binds qualification to one exact PR head SHA and runs C39 regression, C42 validation and canonical Release Verify.

## Current decision

`HOLD_EXTERNAL_EVIDENCE_AND_CANONICAL_INPUTS_REQUIRED`

C42 grants no merge, deployment, commercial go-live, transaction, approval, canonical activation or Public-AI authority.
