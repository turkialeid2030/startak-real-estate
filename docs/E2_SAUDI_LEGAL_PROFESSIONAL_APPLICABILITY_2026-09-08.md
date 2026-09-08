# STARTAK Real Estate — E2 Saudi Legal / Professional Applicability Review Gate

Date: 2026-09-08

## Objective

E2 converts the qualified source-evidence chain into deterministic **review candidates**. It does not convert source evidence into legal conclusions, professional opinions, standards activation or compliance claims.

The highest internally generated state is:

`READY_FOR_SAUDI_LEGAL_PROFESSIONAL_REVIEW`

If human dispositions are recorded, the maximum state becomes:

`HUMAN_REVIEW_DISPOSITIONS_RECORDED_PENDING_AUTHORITY_VALIDATION`

Neither state establishes that the reviewer is authorized, licensed, independent or professionally qualified. Those matters require external validation.

Operating mode remains `UNLICENSED_DECISION_SUPPORT`.

## Why this layer is separate from the production standards router

The existing purpose-based standards router selects production standards only from qualified `ACTIVE` registry records and explicitly keeps draft/future/under-review records advisory. The existing regulated-context router likewise requires selected ACTIVE standards before regulated-context binding.

The source-evidence packages added after Wave 17 are intentionally `UNDER_REVIEW`. Therefore E2 must not insert them directly into the production router. It creates an external-review packet first.

## Candidate matrix

E2 currently defines 16 source-backed candidates:

1. REGA real-estate service / brokerage licensing characterization.
2. Taqeem professional valuation licensing and qualification.
3. IVS / Taqeem standards applicability and rule-level conformance review.
4. Taqeem professional report-QA context.
5. CMA real-estate investment-fund context.
6. SAMA supervised valuation-client context.
7. SAMA collateral valuation context.
8. SOCPA / IFRS 13 financial-reporting fair-value context.
9. ZATCA real-estate transaction tax context.
10. SDAIA PDPL personal-data processing context.
11. SDAIA cross-border personal-data processing context.
12. REGA real-estate contributions context.
13. IPMS building-measurement methodology context.
14. ICMS 3 cost/carbon methodology context.
15. Appraisal Institute comparative professional reference.
16. RICS Red Book professional-context review.

Each candidate contains:

- explicit trigger conditions;
- official source-evidence references;
- a question for the human/legal/professional reviewer;
- an explicit `nonConclusion` statement;
- `candidateState=UNDER_REVIEW`;
- `activationAuthorized=false`.

## Deterministic behavior

`createSaudiApplicabilityReviewPacket()` validates the complete evidence-register chain and the candidate matrix before evaluating context triggers.

Missing source evidence fails closed as:

`HOLD_SOURCE_EVIDENCE`

A context that does not trigger any candidate returns:

`NO_APPLICABILITY_CANDIDATES_TRIGGERED`

A context with one or more candidates returns:

`READY_FOR_SAUDI_LEGAL_PROFESSIONAL_REVIEW`

The packet is SHA-256 content-addressed and integrity-verifiable.

## Human disposition recording

E2 can record an explicit human disposition of:

- `APPLICABLE`
- `NOT_APPLICABLE`
- `CONDITIONAL`
- `HOLD`

with reviewer reference, claimed authority, evidence reference and timestamp.

The claimed authority is **not verified by STARTAK in E2**. Therefore even after every disposition is recorded:

- `reviewerAuthorityClaimVerified=false`
- `legalConclusionEstablished=false`
- `professionalApplicabilityEstablished=false`
- `standardsOrRulesActivated=false`

This prevents an internal reviewer name or uploaded memo from being misrepresented as externally validated Saudi legal/professional authority.

## Authority boundary

E2 always preserves false for:

- automatic applicability conclusion
- automatic legal conclusion
- automatic professional conclusion
- standards/rule activation
- formal standards conformance
- Saudi professional licensing
- reviewer credential verification
- reviewer independence verification
- PDPL compliance
- tax compliance
- financial-reporting compliance
- certified valuation authority
- external report issuance
- release authorization
- merge authorization
- deployment authorization
- transaction authorization

## Next controlled stage

After E2 engineering qualification, the next stage is external evidence collection and authority validation, not automatic rule activation.

Recommended next track:

`E2B_EXTERNAL_REVIEW_AND_CREDENTIAL_EVIDENCE`

That stage should accept actual review evidence from qualified Saudi legal/professional/data/tax/accounting reviewers and independently verifiable credential/licensing evidence. Only after those external gates are validated may a separate controlled activation proposal be prepared.
