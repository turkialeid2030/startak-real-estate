# STARTAK — Universal Platform Quality, Security, AI & Release Assurance V1.1
Date: 2026-10-28 (Asia/Riyadh). Evidence baseline: PR #764 stacked on #763, GitHub Actions and reviewed source files. This is an independent-in-scope engineering review, **not** an exhaustive pentest or a professional valuation certification.

## Product scope
STARTAK Real Estate is a Saudi property research and investment decision-support platform. The source inspected includes React/Vite frontend, Node.js calculation and risk governance modules, browser-local document intake, synthetic tests, GitHub Actions and draft professional reporting services. A tree inventory of 1,950 files (including 588 in src and 104 workflow files) is an **inventory only**, not evidence of complete testing. PR #763 and PR #764 are both open/unmerged.

## Evidence boundary
The previous full working PR head `9e122d154273623e15a603b49804ddaf43b12586` had 6/6 GitHub Actions success and 572/572 canonical regression tests. The new security patch `c4b338a1a795fedac40fd284f05c9b4760d4184d` also passed 6/6 workflows; qualification of any later documentation-only head must be checked separately. The public site and release-manifest could not be read from available browser tooling; container DNS resolution also failed. **BLOCKED**, not evidence of a production outage.

## Nine-domain assessment matrix
| ID | Domain | Status / verifiable basis |
|---|---|---|
| UPA-01 | Software, unit/integration/E2E, regressions | PARTIAL — 6/6 CI on audited code; no entire-codebase or live-API coverage claim |
| UPA-02 | Performance, concurrency, DR, load | PARTIAL — test scaffolding exists; no real-user load, RTO/RPO or production restore demonstration |
| UPA-03 | UX, RTL, WCAG, device browsers | PARTIAL — specific Arabic Playwright paths; not every screen/device or assistive tech |
| UPA-04 | User research, UAT and market validation | NOT TESTED — no observed unbiased real-user completion and satisfaction study |
| UPA-05 | Cybersecurity, identity, tenant and case separation | PARTIAL — repaired server-authorizer contract; no independent live pen test |
| UPA-06 | Data consistency and financial math | PARTIAL — deterministic test suites and HOLD contracts; Saudi authoritative feeds still not authenticated |
| UPA-07 | AI, LLM quality and tools | PARTIAL — deterministic orchestration and safety contracts, but no provider-live 18-axis benchmarking |
| UPA-08 | Operations, monitoring, rollback and business continuity | PARTIAL — procedures/workflows exist; no deployment evidence for this branch |
| UPA-09 | Legal/professional/regulatory/economic readiness | PARTIAL — governance documented, external signatures and ROI/scale metrics not proven |

## Findings with root cause, remediation and acceptance
| ID | Severity | Root cause and evidence | Resolution / acceptance |
|---|---|---|---|
| SEC-V11-001 | HIGH | `src/market/private-appraisal-evidence-vault.js` formerly accepted caller-supplied `authenticatedByTrustedBackend`. This is not an independent identity proof. | Fixed: require a separately injected *server-controlled* `authorizeActor` callback that returns trusted identity; deny spoofing and role escalation. Synthetic tests cover forged flags, denial and revocation. Still requires operational identity provider. |
| SEC-V11-002 | HIGH | Vault read formerly did not require caseRef, giving weak same-tenant case partitioning. | Fixed: require caseRef, verify server-allowed case and immutable stored case before decrypting. Negative tests added; server deployment still BLOCKED. |
| REL-V11-003 | BLOCKER | PR #763/#764 unmerged, production commit not proven. | Require correct release-manifest, E2F/E2G and authorized release evidence. |
| DATA-V11-004 | BLOCKER | Official transaction/title data rights and independently confirmed real transactions not established. | Signed source rights, authoritative legal/title evidence and held-out accuracy review. |
| OPS-V11-005 | BLOCKER | Vault is a Node contract only; no deployed KMS, IAM, secured database, durable audit/retention, backup or recovery evidence. | Deploy, encrypt, tenant-isolation pentest, key rotation and restore tests. |
| AI-V11-006 | HIGH | No comparable, live-provider task success, hallucination, prompt injection and cost/latency benchmark in scope. | Reference set with independent reviewers and identical model budgets. |
| UX-V11-007 | MEDIUM | All-device accessibility and real UAT not evidenced. | WCAG/mobile/keyboard/screen-reader and user completion studies. |
| PERF-V11-008 | HIGH | Production throughput/latency/SLO, failover, RTO/RPO and rollback unavailable. | Controlled staging and signed production drills. |
| LEGAL-V11-009 | BLOCKER | Licensed valuer, PDPL, land-rights and commercial approvals unverified. | Independent professional, legal and release authority signoffs. |
| EVID-V11-010 | BLOCKER | Direct Cloudflare website and manifest could not be fetched in this environment. | Test from an authorized connected browser, record timestamp, response, artifact hash and release deployment identifier. |

## AI — 18 audit axes
Evidence for the below is **not a passing live-model evaluation**. Use shared reference datasets and identical cost/latency limits.
1. Domain response accuracy — NOT TESTED.
2. Multi-step reasoning — PARTIAL (orchestration/test contracts).
3. Retrieval quality — NOT TESTED.
4. Citation and provenance — PARTIAL (gates only).
5. Instruction following — NOT TESTED.
6. Structured output schema — PARTIAL (contract tests).
7. Arabic language and RTL — PARTIAL (specific browser paths).
8. Numeric fidelity and deterministic finance — PARTIAL (math regression, market labels not verified).
9. PDF/OCR field recognition — PARTIAL (manual workflow, no independent OCR metrics).
10. Visual/image interpretation — NOT TESTED.
11. Contradictory sources — PARTIAL (HOLD and version mismatch).
12. Hallucination reduction — PARTIAL (no professional price from LLM, no red-team rate).
13. Tool/API authorization — PARTIAL (policy interfaces, no every-tool live test).
14. Multi-agent task completion — NOT TESTED end-to-end live.
15. Prompt-injection defense — NOT TESTED live.
16. Privacy and exfiltration — PARTIAL (no independent production test).
17. Model drift, reliability, latency — NOT TESTED.
18. Human calibration and cost per *correct completed* task — NOT TESTED.

## Mandatory extra controls
- Discovery: PASS for repository inventory only.
- Requirement-to-evidence traceability: PARTIAL, this report and issue #765.
- Root-cause analysis: PASS for SEC-V11-001/002.
- Software supply chain: PARTIAL, npm audit and workflow inventory are not SBOM or production attestations.
- Tenant/user isolation: PARTIAL, unit contracts; independent live API pentest absent.
- Independent post-fix testing: CI is software evidence, not an independent production pen test.
- Versioning and rollback: PARTIAL, PR/commit pinned, production rollback not proven.
- RACI: proposed below; not signed.
- Failure/drift monitoring: PARTIAL, code paths without confirmed live telemetry.
- Commercial impact: NOT TESTED — no verified CAC/LTV, success rates or actual task cost.

## Release gates and decision
| Gate | Outcome | Blocking gap |
|---|---|---|
| G1 security/privacy | HOLD | No production authenticated vault, signed pen test or PDPL review |
| G2 core math and operations | PARTIAL; not release-authorizing | Engineering regressions passed but cannot prove market correctness or professional signoff |
| G3 data/integrations | HOLD | Official title, executed transaction data and rights unverified |
| G4 continuity/reliability | HOLD | No live load, backup restore, rollback and operational monitoring validation |
| G5 professional/commercial compliance | HOLD | No valuer/licensing/legal review or E2F/E2G/Q01–Q12 approval |

**Universal decision: HOLD / NOT_AUTHORIZED** for production/commercial/professional release. Neither GO nor CONDITIONAL GO is justified by CI alone.

## Owners and acceptance dependencies (RACI provisional)
Engineering: code fix and deterministic tests. Security/IAM/operations: server-side auth, tenant permissions, encryption/KMS and pentest (before sensitive storage). Data rights/legal: title verification, Saudi official transaction rights and PDPL (before external data or customer use). Licensed valuer: independent methodology and specialist NOI/market model review (before professional outputs). AI QA: live identical benchmarks, accuracy, injection, latency and price per correct task (before live model activation). Product/UAT: accessibility, device and user completion (before go-live). Release authority: E2F/E2G, signed external evidence, PR merge, deployment, rollback and release manifest (after all blockers resolved).

## Authoritative references checked on 2026-10-28
- [OWASP ASVS v5.0.0 stable](https://asvs.owasp.org/)
- [OWASP Web Top 10:2025](https://top10.owasp.org/2025/)
- [OWASP API Top 10:2023](https://api-security.owasp.org/editions/2023/en/)
- [OWASP LLM Top 10:2026](https://genai.owasp.org/resource/owasp-genai-llm-top-10-2026/)
- [NIST AI RMF and GenAI profile NIST AI 600-1](https://www.nist.gov/itl/ai-risk-management-framework)
- [SDAIA PDPL official guidance](https://dgp.sdaia.gov.sa/)

This assessment does not assert a certification by any of these organizations. Exact final CI results and remaining external acceptance criteria are tracked under issue #765 and PR #764.