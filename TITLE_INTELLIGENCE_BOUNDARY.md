# Title & Property Legal-Fact Intelligence v1

## Purpose
This layer extracts and reconciles property/title facts for analytical decision support. It is deliberately separated from legal opinion and legal-title certification.

## Allowed outputs
- document/property identity facts
- owner/name facts as presented in supplied/verified sources
- area, city, parcel/plot and boundary facts
- observed encumbrance/mortgage/waqf/usufruct/easement/restriction indicators
- missing evidence and contradictions
- `HOLD_EVIDENCE`
- `LEGAL_REVIEW_REQUIRED`

## Prohibited outputs in unlicensed mode
- title is legally valid
- ownership is legally guaranteed
- transaction is legally safe
- encumbrance has no legal effect
- legal clearance
- legal opinion

## Fail-closed rules
1. Missing required identity/title facts block analytical underwriting.
2. Contradictory material title facts block analytical underwriting.
3. Legal-sensitive facts do not become automated legal conclusions; they route to licensed/professional legal review.
4. Case and property isolation are mandatory.
5. Source provenance must remain attached to each fact.

## Integration
The decision-control gate consumes Title Intelligence together with Evidence Readiness, Tenant/Covenant Intelligence, Regulatory Intelligence and Financial Engine qualification. A legal-review flag takes precedence over analytical readiness.

This document is an engineering boundary and not a legal opinion.
