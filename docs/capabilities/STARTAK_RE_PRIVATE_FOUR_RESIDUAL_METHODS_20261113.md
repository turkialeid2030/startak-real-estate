# STARTAK Real Estate — four residual-method private-source acceptance contract
**2026-11-13. No owner source data stored in GitHub.**

## Prior documented status
The owner reference intake fixture records 17 main real-estate source cases and **four separate residual/income reference cases**. The existing public `tools/verify-owner-external-golden-17.mjs` characterizes only the 17 main cases, and rightly returns `ENGINE_PARITY=BLOCKED_TRUSTED_EXECUTION_PROOF_REQUIRED` until external engine logs and source verification are supplied. This task **does not alter** that limit.

## Added private offline CLI
`node tools/verify-owner-private-residual-4.mjs --fixture=/authorized/private/path/golden-cases-17.json`

The file path is local only; the source document, expected values and any private client property or tenant fields must **never** be copied into the public repository or printed into CI logs.

The CLI requires exactly **four distinct residual cases** with the following shape and reference checks:
1. **Two hotel seasonal income cases:** 365-day seasonal occupancy × licensed room count × ADR → annual gross revenue; owner OPEX → NOI; capitalization → GDV; development/other costs and discount periods → present value; rounded unit land residual rate.
2. **One unit/compound income case:** typed unit count × documented annual rent × occupancy → gross revenue; OPEX → NOI; NOI / capitalization rate → research income indication.
3. **One multi-scenario commercial residual:** checks supplied scenario-land expectations, weights (sum 100%), discounted weighted land present value, residual unit rate and blended market/reference land rate.

**Critical methodological HOLD:** the private source fixture lists the commercial residual *scenario land amounts as expected values* but does not supply a complete, independently validated GDV → development/marketing/contingency/profit → scenario-land formula. The CLI **must not invent that missing formula**, and therefore always emits `COMM_SCENARIO_FORMULA=BLOCKED_NOT_SPECIFIED` and `OVERALL=HOLD` even when all supplied reference arithmetic agrees.

All supplied expected values are *self-consistency references*, not verified appraisal reports or independently executed engine evidence. This tool is not an independent value-of-property calculator or proof of a professional valuation; it does not compare the private cases against the current production valuation engine.

## Public CI acceptance
A **fully synthetic four-case** fixture is generated in a temporary directory during CI. Positive check confirms every reference calculation; negative tests reject altered expected revenues, present value, annual period completeness, scenario weights, case IDs and missing cases; no real property names, numbers, title deeds, signed reports, or private source SHA are embedded in GitHub.

## Production gates
- Exactly reproduced, independently authenticated raw owner source files and legal rights to process them.
- Independent reconciliation of all 17 main cases plus the four residual cases against exact current engine SHA with signed execution proof and allowable tolerance.
- Professional method review for the commercial residual GDV/development-profit model (no guessed formula), as-of valuation dates, lease terms and income-case basis.
- Separate independent annual market-rent comparables; historical yield-derived rental estimates must NOT be represented as signed comparable rents.

`FOUR_RESIDUAL_REFERENCE_ARITHMETIC=PARTIAL`; `COMM_SCENARIO_FORMULA=HOLD`; `ENGINE_PARITY=HOLD`; `SOURCE_AUTHENTICITY=HOLD`; `PRODUCTION=HOLD_NOT_AUTHORIZED`.
