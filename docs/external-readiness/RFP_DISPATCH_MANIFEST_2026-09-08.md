# STARTAK Real Estate — External Review RFP Dispatch Manifest

Date: 2026-09-08
Parent tracker: #202
Procurement tracker: #210
Review-pack PR: #209
Qualified engineering baseline: PR #201 / `f910a086039b0cbde93faa063b468bfd0c28a3f9`
Operating mode: `UNLICENSED_DECISION_SUPPORT`

## Purpose

Provide one controlled dispatch sheet for an **authorized human sender** to issue the external-review RFPs required by #204–#207. This manifest does not send anything and does not advance procurement status by itself.

Current dispatch state for every row: `AWAITING_AUTHORIZED_SENDER`.

## Dispatch set

| Dispatch ID | Workstream | Target | Contact route | Controlling scope | Initial status |
|---|---|---|---|---|---|
| RFP-204-01 | #204 Saudi legal review | Khoshaim & Associates (K&A) | `Info@khoshaim.com` / official contact form | `SAUDI_LEGAL_OPERATING_MODE_REVIEW_REQUEST.md` | `AWAITING_AUTHORIZED_SENDER` |
| RFP-204-02 | #204 Saudi legal review | Al Tamimi & Company — Riyadh | `p.kotsis@tamimi.com`, `e.salameh@tamimi.com` | `SAUDI_LEGAL_OPERATING_MODE_REVIEW_REQUEST.md` | `AWAITING_AUTHORIZED_SENDER` |
| RFP-205-01 | #205 PDPL/data governance | KPMG Saudi Arabia | official Saudi RFP/contact form | `PDPL_DATA_GOVERNANCE_REVIEW_REQUEST.md` | `AWAITING_AUTHORIZED_SENDER` |
| RFP-205-02 | #205 PDPL/data governance | PwC Middle East — Saudi Arabia | official Saudi/Middle East contact route | `PDPL_DATA_GOVERNANCE_REVIEW_REQUEST.md` | `AWAITING_AUTHORIZED_SENDER` |
| RFP-206-01 | #206 professional valuation/standards scope | Qiam Valuation Company / شركة قيم للتقيم | Taqeem-verified facility + company official contact route | `PROFESSIONAL_VALUATION_STANDARDS_REVIEW_REQUEST.md` | `AWAITING_AUTHORIZED_SENDER` |
| RFP-206-02 | #206 professional valuation/standards scope | Barcode Valuation / شركة باركود للتقييم | Taqeem-verified facility route / verified public contact | `PROFESSIONAL_VALUATION_STANDARDS_REVIEW_REQUEST.md` | `AWAITING_AUTHORIZED_SENDER` |
| RFP-207-S01 | #207 independent security | sirar by stc | `info@sirar.com.sa` / official contact form | security portion of `PRODUCTION_SECURITY_PERFORMANCE_RESILIENCE_SOW.md` | `AWAITING_AUTHORIZED_SENDER` |
| RFP-207-P01 | #207 performance | Crewformance | official website contact route | performance portion of `PRODUCTION_SECURITY_PERFORMANCE_RESILIENCE_SOW.md` | `AWAITING_AUTHORIZED_SENDER` |
| RFP-207-P02 | #207 performance | Vast Edge — Riyadh | official contact route | performance portion of `PRODUCTION_SECURITY_PERFORMANCE_RESILIENCE_SOW.md` | `AWAITING_AUTHORIZED_SENDER` |
| RFP-207-R01 | #207 resilience | sirar by stc | `info@sirar.com.sa` / official contact form | resilience portion of `PRODUCTION_SECURITY_PERFORMANCE_RESILIENCE_SOW.md` | `AWAITING_AUTHORIZED_SENDER` |

## Required first-contact attachment/reference set

For each provider, the authorized sender should provide only the non-sensitive material needed for bid preparation:

1. `EXTERNAL_REVIEWER_SOLICITATION_PACK.md`
2. the workstream-specific controlling scope listed above;
3. `RFP_OUTREACH_EMAIL_TEMPLATES_2026-09-08.md` as the internal sender template, not necessarily as an attachment;
4. bid-response requirements from the solicitation pack;
5. a statement that sensitive materials will be shared only after NDA / approved confidential channel where required.

Do **not** send in the first-contact message:
- penetration-test-sensitive detail;
- credentials, secrets, tokens or internal infrastructure detail;
- personal-data inventory;
- privileged legal advice;
- confidential customer/property records;
- any statement that STARTAK is licensed, certified, PDPL-compliant, production-ready or professionally approved.

## #206 named-reviewer requirement

Qiam and Barcode are RFP targets because current Taqeem public records provide an official licensed-facility verification path. Award remains prohibited until the proposal identifies the **actual named reviewer** for STARTAK and the following are independently checked:

- current professional standing;
- licence/membership status appropriate to the scope;
- competence for standards-scope/applicability review;
- conflict/independence status;
- acceptance of the exact #206 review scope;
- willingness to issue the required explicit disposition.

A facility's active Taqeem record is not equivalent to acceptance of a specific reviewer.

## #207 split-scope rule

Security, measured performance, and resilience are separate evidence classes even if one provider can perform more than one class.

- sirar may be asked to bid security and resilience separately;
- Crewformance and Vast Edge should be asked to bid measured application performance/load testing;
- each provider must state clearly whether it can perform application-level failure-mode/recovery testing;
- no partial provider response may be represented as full #207 closure;
- final #207 acceptance requires exact-candidate/environment binding and all required classes independently evidenced.

## Bid response minimums

Every bidder must return, at minimum:

- legal entity name;
- named lead reviewer(s)/test lead(s);
- credential or qualification references where applicable;
- conflict and independence statement;
- exact scope accepted / excluded;
- methodology;
- deliverable format and explicit conclusion/disposition;
- release-candidate/environment requirements;
- remediation and retest terms where applicable;
- proposed schedule;
- commercial proposal;
- NDA/data-handling requirements;
- proposal validity period.

## Status transition rule

Do not change a row to `RFP_SENT` until an authorized human actually sends or submits the RFP through the listed channel and the dispatch timestamp/recipient is recorded in #210.

After actual dispatch, record:

```text
Dispatch ID:
Sent by:
Sent at:
Recipient/channel:
Workstream:
Scope version/reference:
NDA required? YES/NO
Acknowledged? YES/NO
Proposal due date:
Status: RFP_SENT
```

## #203 canonical comparison

#203 is intentionally not included in the commercial RFP dispatch table until the canonical-original artifact/source and an independent verifier route are fixed. It remains a separate external evidence blocker and cannot be closed by Release Verify's skipped comparison.

## Authority boundary

Preparation or dispatch of an RFP does not establish:

- external evidence acceptance;
- legal approval;
- PDPL compliance;
- professional valuation authority;
- formal standards conformance;
- security/performance/resilience PASS;
- release/merge/deployment authority;
- transaction authority.

Until real accepted evidence and the #208 human authority/execution chain exist, production readiness remains `HOLD`.
