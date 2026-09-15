# Wave 12E — Financial Reporting & Regulated Context Routers

Status: engineering candidate only. No merge to `main`; no production deployment authorization.

Wave 12E adds an explicit applicability bridge for financial-reporting and regulated contexts after the qualified purpose-based standards route. It does not add legal conclusions, accounting conclusions, regulatory approval, lending approval, certified valuation, regulated investment advice or transaction authority.

## Contexts

The router treats three domains separately:

- Financial reporting / accounting framework context.
- CMA-regulated entity context.
- SAMA-regulated financing/lender context.

Each domain is explicitly declared applicable or not applicable. Applicability is never inferred from the property value, financing metrics, AI text or a generic standard record.

## Standard binding

An applicable domain must bind one or more standards that are already `ACTIVE` and selected by the qualified Purpose-Based Standards Router for the same context. The binding is explicit and reviewer-controlled with:

- domain
- selected standard ID
- authority role
- rationale
- evidence reference

A standard not selected by the qualified route cannot support a regulated-context gate. A `DRAFT`, `FUTURE`, `SUPERSEDED`, `SUSPENDED`, `UNDER_REVIEW` or other non-`ACTIVE` standard cannot be used for production enforcement.

## Review gates

Applicable financial-reporting context requires accounting-professional review. CMA and SAMA contexts require regulatory-professional review and legal/compliance review before any external compliance statement.

The router outputs `REVIEW_REQUIRED`; it does not output `COMPLIANT`, `APPROVED`, `AUTHORIZED`, or equivalent legal/regulatory conclusions.

## Arithmetic boundary

The router cannot change:

- Professional NOI.
- Direct Capitalization indication.
- Professional DCF indication.
- Discount rate.
- Exit cap rate.
- Terminal NOI.
- Investment/financing metrics.

Financial-reporting or regulatory context therefore affects workflow, review, disclosures and reporting applicability only unless a later separately governed standard rule explicitly changes a permissible reporting treatment after professional approval.

## Safety boundaries

- no automatic accounting classification
- no automatic IFRS/SOCPA treatment conclusion
- no automatic CMA applicability conclusion
- no automatic SAMA applicability conclusion
- no regulatory-compliance claim
- no legal opinion
- no lender/credit approval
- no regulated investment advice authorization
- no certified valuation
- no transaction authority

Qualification marker: `WAVE_12E_REGULATED_CONTEXT_ROUTERS=PASS`.

Next controlled sub-wave: Wave 12F — governed financial-reporting disclosure packets and review evidence, preserving the distinction between property valuation, accounting/reporting treatment and regulated investment/financing decisions.