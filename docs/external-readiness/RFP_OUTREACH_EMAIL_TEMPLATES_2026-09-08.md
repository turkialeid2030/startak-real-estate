# STARTAK Real Estate — External Reviewer RFP Outreach Templates

Date: 2026-09-08
Parent tracker: #202
Procurement tracker: #210

These are draft outreach templates only. Sending them creates an external commercial interaction and requires an authorized human sender.

## Common project statement

STARTAK Real Estate is being qualified for operation in `UNLICENSED_DECISION_SUPPORT` mode. Internal engineering qualification is complete for the current release candidate, but production go-live remains on HOLD pending independent external evidence. The requested work must evaluate the actual implemented product and/or exact release candidate where relevant. Internal CI, synthetic fixtures and self-attestation are not acceptable substitutes for independent evidence.

Current engineering reference:
- PR #201
- source head: `f910a086039b0cbde93faa063b468bfd0c28a3f9`
- operating mode: `UNLICENSED_DECISION_SUPPORT`

The final review may need to bind to a later immutable release artifact/environment reference if remediation occurs before engagement completion.

---

## Template A — Saudi legal operating-mode & licensing review (#204)

**Subject:** Request for Proposal — Saudi Legal Review of STARTAK Real Estate Operating Model and Licensing Boundary

Dear [Firm / Partner],

We invite your firm to submit a proposal for an independent Saudi legal/regulatory review of STARTAK Real Estate, a real-estate decision-support and analytics platform currently intended to operate in an unlicensed analytical decision-support mode.

The review is intended to assess the actual implemented product, intended commercial model, customer journey, output language, terms and external-use boundaries. The scope includes, where relevant, Saudi real-estate services and brokerage regulation, real-estate consultancy/analysis boundaries, accredited valuation/Taqeem involvement, and context-specific CMA/SAMA implications.

We require the engagement to identify a named Saudi-qualified reviewer, provide independently verifiable professional standing, disclose conflicts, review actual product materials/outputs, and issue an explicit disposition with assumptions, conditions and unresolved items.

Please confirm:
1. proposed lead reviewer and credentials;
2. conflicts / independence status;
3. understanding of the attached scope;
4. deliverables and explicit conclusion format;
5. estimated timeline;
6. commercial proposal;
7. confidentiality / NDA requirements.

The review pack for #204 should be treated as the controlling scope. A disclaimer-only review is insufficient; we require assessment of implemented behavior and intended operating model.

Regards,
[Authorized Sender]

---

## Template B — PDPL & data-governance review (#205)

**Subject:** Request for Proposal — Independent Saudi PDPL and Data-Governance Review for STARTAK Real Estate

Dear [Firm / Reviewer],

We invite a proposal for an independent production-oriented privacy and data-governance review of STARTAK Real Estate under the Saudi Personal Data Protection Law and related controls.

The work must examine actual system/data flows and controls, including data inventory/classification, controller/processor roles, lawful basis, minimization, retention/deletion, data-subject rights, access control, tenant isolation, encryption/logging exposure, subprocessors, incident handling and cross-border transfer conditions where applicable.

The final deliverable must include a control matrix, severity-ranked findings, explicit PASS / FAIL / INCONCLUSIVE or equivalent conclusions, remediation requirements, and retest evidence for material findings. Sensitive material should be handled through an agreed controlled repository; public GitHub will retain only non-sensitive metadata/hashes where necessary.

Please provide the named review team, relevant qualifications, independence statement, proposed methodology, timeline, deliverables, retest approach and commercial terms.

Regards,
[Authorized Sender]

---

## Template C — Professional valuation & standards-scope review (#206)

**Subject:** Request for Proposal — Independent Professional Review of STARTAK Real Estate Valuation and Standards Scope

Dear [Valuation Facility / Reviewer],

We request a proposal for an independent professional review of STARTAK Real Estate's valuation/analysis scope and report boundaries for intended Saudi use cases.

The review must address the distinction between internal analytical valuation indications and formal/certified valuation; intended-use/purpose/basis-of-value/valuation-date routing; property-rights identification; relevant IVS/Taqeem requirements and other guidance where used; Saudi-law precedence; and the conditions that require licensed/accredited professional involvement.

The reviewer must examine actual implemented workflows and output/report language rather than only reviewing a standards list. Any statement of formal standards conformance must be separately justified and must not be inferred from source-document presence.

Please identify the named reviewer, Taqeem or other relevant professional standing and official verification source, independence/conflict status, proposed review approach, deliverables, timeline and fee proposal.

Regards,
[Authorized Sender]

---

## Template D — Security / performance / resilience validation (#207)

**Subject:** Request for Proposal — Independent Production Security, Performance and Resilience Validation

Dear [Provider],

We invite a proposal for independent validation of the exact STARTAK Real Estate production release candidate and environment.

The engagement is expected to cover the applicable portions of:
- penetration testing/security assessment of web/API/authentication/authorization/tenant isolation/storage/uploads/exports/infrastructure;
- performance/load testing with a defined workload model and measured p50/p95/p99 (or appropriate equivalent), throughput, concurrency and saturation data;
- resilience/failure-mode testing, recovery/rollback verification and relevant RTO/RPO assumptions.

The assessment must bind to the exact source commit, release artifact and environment configuration reviewed. Security release threshold is no unresolved Critical or High findings. Material findings require remediation and independent retest.

Please identify the delivery team, relevant certifications/experience, methodology, tooling categories, environment requirements, test window, retest terms, deliverables, evidence integrity approach and commercial proposal.

If your organization provides only part of the required scope, please state clearly which classes you can independently validate rather than presenting a partial assessment as full #207 closure.

Regards,
[Authorized Sender]

---

## Template E — Canonical-source hash comparison (#203)

**Subject:** Independent Canonical Source Hash Comparison — STARTAK Real Estate

Dear [Verifier],

We require an independent comparison between a canonical original supplied out-of-band and the corresponding STARTAK source/reference artifact.

The verifier must record provenance, acquisition source/date, SHA-256 of both artifacts, comparison method/tool/version, verifier identity and independence, timestamp, and one explicit result: MATCH / MISMATCH / INCONCLUSIVE.

The implementation team must not self-certify this result. If the canonical original cannot be independently obtained or provenance is uncertain, the required result is INCONCLUSIVE and the release remains on HOLD.

Regards,
[Authorized Sender]

---

## Bid-response minimum data

Every proposal should include:
- legal entity name and registration/jurisdiction;
- named lead reviewer(s);
- credential/licence verification references where relevant;
- independence/conflict disclosure;
- workstream(s) accepted;
- methodology;
- deliverable structure;
- explicit conclusion/disposition format;
- remediation/retest terms where applicable;
- schedule;
- commercial terms;
- NDA / data-handling requirements;
- validity period of proposal.

## Boundary

Do not state in outreach that STARTAK is licensed, certified, professionally approved, PDPL-compliant, production-ready or formally standards-conformant. The purpose of these engagements is to obtain evidence needed to determine those boundaries for the approved operating mode.
