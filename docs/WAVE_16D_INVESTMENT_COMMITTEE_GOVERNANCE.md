# Wave 16D — Investment Committee Evidence & Human Resolution Governance

## Objective
Create a controlled Investment Committee evidence and resolution record without allowing the system, AI layer, valuation layer or portfolio analytics to approve a transaction or create an execution action.

## Evidence packet
Wave 16D records content-addressed evidence items for explicit subject scope (`ASSET` or `PORTFOLIO`). The caller must state the required evidence classes. The system checks completeness, integrity, source date/freshness and subject binding; it does not invent due-diligence requirements or interpret legal/tax/technical evidence.

Evidence classes include professional valuation output, investment analysis, uncertainty analysis, portfolio analysis, legal, tax, technical and other explicit evidence.

## Committee meeting
A meeting is bound to the exact evidence-packet hash. Members, attendance, voting status, conflict disclosure/recusal and an explicit quorum policy reference are recorded. Quorum is checked mechanically against the caller-supplied policy value, but committee authority itself is not validated by the system.

## Voting and resolution
Votes are immutable human records. Recused, absent or non-voting members cannot vote. The module records tally information but does not infer a resolution from the tally.

The final resolution must be explicitly recorded by a human with meeting minutes and policy provenance. `PROCEED_TO_NEXT_INTERNAL_STAGE` requires the caller-supplied minimum support threshold, but remains only an internal workflow resolution.

## Deliberate boundaries
- no automatic BUY / SELL / APPROVE / REJECT action
- no transaction instruction or execution object
- no AI committee member or AI vote
- no system-derived committee resolution
- no professional valuation modification
- no credential/committee-authority validation
- no legal opinion
- no external report issuance

Maximum state: `HUMAN_IC_RESOLUTION_RECORDED`.

This state is evidence of an internal human governance event only. It is not transaction authority.

## Preserved invariants
- `humanResolutionRecorded=true`
- `systemDerivedResolution=false`
- `aiResolutionPermitted=false`
- `committeeAuthorityValidated=false`
- `decisionActionAuthorized=false`
- `executionActionCreated=false`
- `professionalValuationConclusionModified=false`
- `certifiedValuationAuthorized=false`
- `externalIssuanceAuthorized=false`
- `legalOpinionEstablished=false`
- `transactionAuthorized=false`
- operating mode `UNLICENSED_DECISION_SUPPORT`

## Qualification
Exact-head qualification requires Wave 16C portfolio regression, the Wave 16D governance regression, and canonical `npm run release:verify`.

Engineering qualification does not authorize merge, deployment or live transaction use.
