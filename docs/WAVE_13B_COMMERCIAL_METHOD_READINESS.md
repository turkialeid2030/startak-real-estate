# Wave 13B — Commercial Method Readiness

Status: engineering candidate only. No merge to `main`; no production deployment authorization.

Wave 13B evaluates whether a qualified Wave 13A commercial specialization packet has sufficient evidence to enter one or more existing valuation-method workflows. It does not select a valuation method, adopt inputs, perform valuation arithmetic or reconcile method indications.

## Explicit methods only

The caller must explicitly list the methods to assess. Supported methods are:
- Sales Comparison
- Direct Capitalization
- Discounted Cash Flow
- Cost Approach

There is no `AUTO_CHOOSE_BEST` or equivalent route. The output always keeps `selectedMethod = null` and `automaticMethodSelection = false`.

## Evidence readiness

Method-specific evidence topics are derived from the commercial specialization packet and its occupancy structure. Occupied commercial assets require lease/rent-roll and tenant-covenant evidence for income approaches; multi-tenant or mixed structures also require service-charge/recovery evidence. DCF additionally requires capital-expenditure evidence. Sales Comparison requires qualified sale-comparable evidence.

Wave 13B only accepts evidence that already passed the Wave 13A specialization gate. It does not bypass or weaken Wave 13A quality controls.

## Cost Approach supplemental evidence

Because the Wave 13A commercial evidence taxonomy is not a substitute for the dedicated Cost Approach workflow, Cost Approach readiness additionally requires three explicit supplemental evidence roles:
- Replacement or Reproduction Cost Evidence
- Land Value Evidence
- Depreciation Evidence

Each supplemental record carries case/property identity, source, evidence references, as-of date, preparer/reviewer provenance and deterministic SHA-256 integrity. `ASSUMED` or `CLIENT_PROVIDED_UNVERIFIED` cannot satisfy a required supplemental role.

A readiness result does not mean that the cost, land-value or depreciation figure itself has been calculated or accepted by a canonical valuation engine. It means only that the evidence prerequisites to enter the existing dedicated method workflow are present.

## Safety and governance boundary

Wave 13B:
- does not select a valuation method;
- does not write valuation inputs;
- does not perform valuation arithmetic;
- does not reconcile method indications;
- does not establish a final or certified valuation;
- does not establish a legal opinion;
- does not authorize a transaction.

The successful status is `READY_FOR_EXISTING_METHOD_WORKFLOW` and is limited to evidence/workflow readiness for the explicitly requested method.

Qualification marker: `WAVE_13B_COMMERCIAL_METHOD_READINESS=PASS`.

Next controlled sub-wave: Wave 13C — governed commercial operating metrics and tenant/lease concentration analytics, keeping those analytics separate from property value and from regulated credit-rating conclusions.
