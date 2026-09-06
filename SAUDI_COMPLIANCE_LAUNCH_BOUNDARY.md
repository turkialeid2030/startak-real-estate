# STARTAK Real Estate — Saudi Compliance Launch Boundary

Status date: 2026-09-06

## Purpose

This document records an engineering and release-governance boundary. It is **not a legal opinion**, does not establish that STARTAK is licensed or exempt from licensing, and does not certify compliance with Saudi law or regulation.

## Current machine-enforced operating boundary

- Operating mode: `UNLICENSED_DECISION_SUPPORT`
- Customer-facing decisions: analytical/screening/risk/evidence language only
- Certified valuation claim: prohibited
- Legal opinion claim: prohibited
- Regulated investment-advice claim: prohibited
- Brokerage recommendation / transaction instruction: prohibited
- Unconditional BUY / SELL / APPROVE / REJECT: prohibited
- Transaction authority: `false`
- Licensed-provider mode: not enabled
- Title/legal interpretation: fail closed to `LEGAL_REVIEW_REQUIRED`
- Valuation output: non-certified analytical indication only
- Saved-deal export: v4 compliance notice + source-bound export provenance

## Required visible disclosure

Arabic short form:

> تحليل داعم للقرار — غير مرخص كاستشارة أو تقييم معتمد.

Arabic full form:

> أداة دعم قرار وتحليل معلوماتي وليست استشارة عقارية مرخصة أو تقييماً عقارياً معتمداً أو رأياً قانونياً أو توصية استثمارية ملزمة. تعتمد النتائج على البيانات والافتراضات المتاحة، ويجب التحقق منها ومراجعة المسائل التي تتطلب ترخيصاً أو رأياً مهنياً لدى المختص المرخص قبل اتخاذ القرار أو إتمام أي تصرف.

The production entry point must render both Arabic and English variants through the canonical compliance module.

## Regulatory-source evidence boundary

The engineering registry in `src/compliance/saudi-regulatory-source-registry.js` records official-source metadata and a review cadence. It intentionally does not convert that metadata into a legal conclusion.

Current source classes include:

1. Real Estate General Authority (REGA) — Real Estate Brokerage Law.
2. REGA — Executive Regulations of the Real Estate Brokerage Law.
3. REGA — Regulation for Real Estate Consultancy and Analysis.
4. Saudi Data & AI Authority (SDAIA) — Personal Data Protection Law knowledge-center source.
5. SDAIA — Implementing Regulation of the Personal Data Protection Law.

A stale, incomplete, or contradictory regulatory-source record must produce a review hold. Official government sources outrank marketing or secondary descriptions for this engineering registry.

## PDPL engineering boundary

`src/compliance/pdpl-engineering-controls.js` is a fail-closed engineering evidence gate. It requires explicit evidence for tenant isolation, least privilege, retention policy, deletion support, sensitive-data redaction, audit logging, encryption in transit/at rest, controller/processor role recording, purpose binding, data minimization, and cross-border review when applicable.

A PASS from that evaluator means only that the enumerated engineering controls and evidence references are present. It does **not** establish PDPL legal compliance or the lawfulness of any processing or transfer.

## Release status

- `ENGINEERING_GUARD_IMPLEMENTATION=IN_QUALIFICATION`
- `SAUDI_LEGAL_REVIEW_STATUS=PENDING`
- `PDPL_LEGAL_REVIEW_STATUS=PENDING`
- `COMMERCIAL_EXTERNAL_LAUNCH=HOLD`
- `TRANSACTION_AUTHORIZED=false`

The issue or launch hold must not be closed solely because automated tests pass. Before a commercial external launch, a qualified Saudi legal/regulatory reviewer must document the applicable operating classification, required licences/permissions, approved customer-facing scope, privacy/controller-processor posture, and any conditions or restrictions.

## Human review record

The fields below must be completed by an authorized human reviewer; software must not self-approve them.

- Reviewer name: _pending_
- Reviewer role / professional capacity: _pending_
- Review date: _pending_
- Reviewed operating scope: _pending_
- Licensing determination / conditions: _pending_
- PDPL/controller-processor determination: _pending_
- Approved commercial launch scope: _pending_
- Evidence reference: _pending_

Until those fields are completed and governance accepts the evidence, commercial external launch remains `HOLD`.
