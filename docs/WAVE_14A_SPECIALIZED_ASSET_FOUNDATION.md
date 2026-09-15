# Wave 14A — Hotels, Leisure & Heritage Specialized-Asset Foundation

Status: engineering candidate only. No merge to `main`; no production deployment authorization.

Wave 14A establishes the first specialized-asset evidence-completeness layer for hotels, serviced apartments, resorts, leisure attractions and heritage assets. It reuses the qualified Property Evidence Packet and does not create a parallel property-evidence, valuation or financial engine.

## Specialized asset taxonomy

Supported classes:
- full-service hotel;
- limited-service hotel;
- serviced apartments;
- resort;
- leisure attraction;
- heritage asset.

Operating state is modeled separately as operating, ramp-up, temporarily closed, vacant or development. Operating model is separately captured as owner-operated, management agreement, franchise, leased operator, independent operator or not applicable.

## Evidence model

The layer can require or conditionally require evidence for property rights/physical facts, measurements, room/key or unit inventory, operating statements, occupancy/ADR/RevPAR, market demand and competitive set, departmental revenues and expenses, management/franchise/operator agreements, FF&E reserve and CapEx, licenses/classification/permits, seasonality, food-and-beverage and other revenues, leisure attendance/spend, amenities, heritage restrictions, conservation/adaptive-reuse requirements, brand standards/PIP and supply pipeline.

Requirements vary by asset class, operating state and operating model. For example, an operating hotel requires operating statements and occupancy/ADR/RevPAR evidence, while a development hotel does not fabricate historical operating metrics. A leisure attraction requires attendance/spend evidence rather than hotel ADR/RevPAR. A heritage asset requires heritage-designation and conservation/adaptive-reuse evidence.

Management, franchise and leased-operator structures require the relevant operator-agreement evidence. Franchise structures additionally require brand-standard/PIP evidence.

## Fail-closed behavior

Mandatory evidence is satisfied only by `VERIFIED` or `PROFESSIONAL_REVIEWED`. `ASSUMED` and `CLIENT_PROVIDED_UNVERIFIED` cannot satisfy mandatory evidence. Conditional topics require an explicit applicability decision. Cross-case evidence, duplicate topics/IDs, tampered evidence, tampered property packets and active specialized assets with no operating-model classification fail closed.

## Governance boundary

Wave 14A does not:
- select a valuation method;
- adopt valuation inputs automatically;
- calculate ADR, RevPAR, GOP, NOI or a forecast;
- interpret management, franchise, lease or brand agreements;
- establish licensing or legal compliance;
- certify a valuation;
- authorize a transaction.

The layer is an internal evidence-completeness and provenance control only. Later Wave 14 sub-waves may build governed operating-metric and method-readiness modules on top of this foundation without bypassing the canonical valuation engines.

Qualification marker: `WAVE_14A_SPECIALIZED_ASSET_FOUNDATION=PASS`.
