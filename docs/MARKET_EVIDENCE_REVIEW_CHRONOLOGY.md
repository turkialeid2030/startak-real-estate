# Market-evidence review cutoff safeguard — 24 October 2026

## Engineering scope

The existing `qualifyMarketEvidence` process already rejected observation
dates after the as-of date and stale sources. It did not require the review
date to follow observation or occur before the valuation's as-of cutoff.
Consequently, a retrospective valuation could include a later professional
review that did not exist when the decision was made.

This correction rejects two impossible or look-ahead states:
- `REVIEW_BEFORE_OBSERVATION`: review timestamp predates observed source.
- `REVIEW_AFTER_AS_OF_DATE`: review is later than the valuation cutoff.

Both yield `HOLD_REVIEW` with indexed evidence failure; any invalid evidence
causes the **whole batch** to remain `analyticalUseAllowed=false`, preserving
the original hold semantics. Existing `HOLD_STALE` for future observation
dates remains unchanged.

The status `QUALIFIED_FOR_ANALYTICAL_USE` only means a supplied item passed
the **caller-provided** freshness/geography/grade/review metadata rules. It
does not prove the reviewer acted, the source is genuine, its rights permit
reuse, or a licensed Saudi valuation. The output now explicitly retains
`sourceUsageRightsEstablished=false` and
`officialSourceAuthenticationEstablished=false` in both HOLD and qualified
results.

## Still-open external gates

N03: permissioned Saudi registered transaction provenance, official market
API/data use license and rights; N06: independent Saudi market holdout QA,
licensed reviewer, precommitted acceptance thresholds; N10 specialist
industry/hotel/industrial scopes; N11 CDN historical missing JS investigation;
N12 IAM, data residency, privacy, encrypted vault and tested enterprise DR.
A synthetic regression cannot independently close any of these.
