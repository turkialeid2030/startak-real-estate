# Financial Integrity P5 — Workflow Integration and Reconciliation

## Qualified parent

P5 starts from P4 qualified head `cfbb7f61d6be036f245fc252c83701a2e3c5d947`.

The parent head passed the canonical engineering gates before P5 was opened:

- Release Verify: PASS
- Comprehensive Verify: PASS
- Deep Platform Verify: PASS
- GitHub Actions Supply Chain Audit: PASS
- Regression: 437/437 PASS
- Production Build: PASS
- Package Verification: PASS
- npm audit: 0 vulnerabilities

## Objective

Integrate governed valuation indications into the active acquisition workflow without converting an engineering/evidence qualification into investment approval, certified valuation authority, lender approval, transaction authority, or commercial Go-Live.

## P5 requirements

1. Governed Direct Cap and governed dated DCF must be callable from the acquisition workflow through explicit adapters; workflow code must not silently reconstruct their arithmetic.
2. Missing or conflicting required valuation evidence must remain fail-closed.
3. Acquisition and disposal transaction costs must be represented outside NOI semantics. RETT, VAT, brokerage, legal, due-diligence, financing and disposal costs must not be silently netted into property NOI.
4. Direct Cap and DCF indications must be reconciled explicitly when both are available. The reconciliation result must expose absolute variance, percentage variance, configured review threshold, status, blockers/warnings and method provenance.
5. Material valuation-method variance must produce review status rather than silent averaging.
6. Reconciliation must not invent a final value when one method is on HOLD.
7. No valuation indication or reconciliation status may itself authorize an investment or transaction.
8. Regression coverage must include happy path, missing evidence, evidence conflict, material method variance, transaction-cost separation and non-authority semantics.

## Status model

P5 should preserve three distinct concepts:

- **Valuation indication** — method-specific calculated indication.
- **Reconciliation** — comparison and explainability layer between qualified indications.
- **Investment decision** — separately governed downstream decision; never implied by the first two.

## Release gate

P5 remains Draft until its final head passes all canonical repository verification gates. Production deployment and commercial Go-Live remain outside this scope.
