# Wave 12F — Governed Financial Reporting Disclosure Packets

Status: engineering candidate only. No merge to `main`; no production deployment authorization.

Wave 12F creates a governed disclosure packet for later reporting workflows. It consumes only a qualified Wave 12E financial-reporting context and does not generate final financial statements, determine accounting treatment automatically, alter professional valuation arithmetic, certify a valuation, make a legal conclusion, or authorize a transaction.

## Purpose

The packet records professionally reviewed disclosure positions, the active standards explicitly bound to the financial-reporting gate, supporting evidence, reviewer provenance and immutable valuation references. It is an input to later report drafting and QA, not a substitute for the accounting professional, licensed valuer, auditor, legal reviewer or regulated authority.

## Disclosure records

Each disclosure record contains:

- topic
- decision / professional position
- claim nature
- statement and rationale
- selected active standard IDs
- evidence references
- as-of date
- preparer and reviewer provenance
- review evidence
- deterministic SHA-256 integrity

Only standards already bound to the Wave 12E financial-reporting gate may be cited. Unbound standard IDs, duplicate disclosure IDs, future-dated disclosure content or integrity failures are blocked.

## Immutable valuation references

A reporting packet may reference professional valuation method indications, but those references are read-only. Each reference binds the reported value to its original calculation hash, valuation date, source reference and evidence references. Wave 12F never recalculates or changes the professional value indication.

## Applicability

When financial reporting is not applicable, the packet records `NOT_APPLICABLE` and refuses stray disclosure content. Applicability cannot be created by adding a disclosure or a standard reference after the fact.

When financial reporting is applicable, at least one reviewed disclosure position is required before `READY_FOR_REPORT_DRAFT` can be produced.

## Safety boundaries

- no automatic IFRS/SOCPA accounting classification
- no automatic fair-value or presentation treatment conclusion
- no accounting compliance claim
- no legal conclusion
- no valuation arithmetic mutation
- no valuation recalculation
- no certified valuation
- no auditor opinion
- no CMA/SAMA approval or credit decision
- no regulated investment advice authorization
- no transaction authority

The output only authorizes a later **draft reporting workflow**, subject to report QA, accounting/audit review and all required professional or regulatory controls.

Qualification marker: `WAVE_12F_FINANCIAL_REPORTING_DISCLOSURES=PASS`.

With Wave 12F qualified, Wave 12 engineering is complete at the architecture layer: professional income and NOI, Direct Capitalization, professional DCF, separated investment/financing metrics, regulated-context routing and governed reporting-disclosure handoff.

Next controlled wave: Wave 13A — commercial real-estate specialization, beginning with commercial asset taxonomy and use-specific professional evidence requirements while reusing the qualified canonical valuation engines rather than duplicating formulas.