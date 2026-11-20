# STARTAK Real Estate — SECURITY-HARDENING-V1.0
**Date:** 2026-11-18 (Saudi Arabia). **Scope:** only `turkialeid2030/startak-real-estate`.  
**Branch:** `security/hardening-v1`, stacked on draft #802. **Change policy:** No main merge, no deployment, no real-data mutation. **Commercial decision:** `HOLD_NOT_AUTHORIZED`.

## 1. Explicit evidence classification
- **Inspected source:** GitHub file tree and actual code at the #802 candidate plus this branch: `src/server/canonical-workspace-http-api.js`, `src/server/canonical-workspace-server-composition.js`, `src/runtime/authenticated-canonical-workspace-service.js`, `src/runtime/canonical-workspace-runtime.js`, `src/runtime/canonical-workspace-persistence.js`, `src/storage/postgres-canonical-workspace-provider.js`, `src/security/{verified-identity-context,oidc-jwt-verifier,tenant-boundary,authorization-audit}.js`, `functions/api/{personal-data/kite-transactions.js,riai/ai-assist.js}` and their regression tests.
- **Proven from source before patch:** canonical workspace persistence was scoped by **tenant + workspace ID only**, with RBAC granted at runtime but no verified **record-owner** check. A same-tenant identity with the authorized VIEW role could request a peer workspace by ID. A peer ANALYST could attempt to overwrite that object with the matching version and an attributed actor of their own. This is a **candidate BOLA/IDOR exploit path**, not proof of a live intrusion.
- **Not accessed:** live IdP/account directory, Cloudflare production bindings, genuine customer accounts, official data API credentials, real PostgreSQL, executed RLS policies, tenant database, object storage, provider logs, backups, pen-test environment, actual production page or secret store. No live A/B operator test or production compromise claim.
- **Test data:** generated tokens, memory providers and fake upstreams are synthetic and must never count as live enterprise isolation proof.

## 2. Technical inventory and trust boundaries
| Component | Candidate source / boundary | Scope inspected |
|---|---|---|
| Browser | React + Vite owner app, Saved Deals and local document panels | Inventory; browser storage is **not a secure multi-user tenant vault** |
| Workspace REST | `src/server/canonical-workspace-http-api.js`: GET/PUT `/v1/workspaces/:workspaceId` | HTTP entry and error/status handling |
| Identity | OIDC Bearer + RS256 JWKS verifier; verified token `sub`, `tenant_id`, `roles` | Source and synthetic tests only |
| Authorization | `canonical-workspace-runtime.js`, `authorization-audit.js`, `canonical-workspace-persistence.js` | RBAC + verified identity + BOLA patch |
| Database | PostgreSQL-compatible server provider, transaction-scoped tenant setting, generated RLS | Source only; **no actual DB connection** |
| AI | `POST /api/riai/ai-assist` behind Cloudflare Access or configured Turnstile public fallback, snapshot restrictions and quota | Gateway source + synthetic tests; no RAG or cross-tenant live AI proof |
| Owner research | `GET /api/personal-data/kite-transactions` with owner bearer secret, independent upstream credential, bounded filters | One-owner research connection; NOT an institution/account tenancy system |
| Owner Console | No production administrator SaaS data plane or role matrix has been independently verified | **Unqualified, no production access authorization** |
| Files / backups | Local-document and RLS/custody contract components | No externally qualified storage ACL, signed URL, key rotation or restore test |

## 3. Finding SHV1-001 — same-tenant workspace object-level authorization
**Priority:** HIGH for a proposed multi-user workspace API. **CWE-639 / OWASP API1:2023 BOLA**.  
**Root cause:** `createCanonicalWorkspacePersistence.load/save` trusted tenant scoping and runtime role alone. `storageKey(namespace,tenantId,workspaceId)` did not additionally check the requested record's actor ownership. RBAC permitted all VIEWER/ANALYST in a tenant to use GET, and ANALYST could SAVE.
**Impact if deployed as-is:** reading a peer workspace and overwriting a same-tenant peer's record when its ID/version are known. No real incident has been established.
**Remediation (in this branch):**
1. On first save, persist `ownerActorId` from verified identity `sub` in the **server-owned envelope**, not request JSON.
2. On every load and on every existing-record save, enforce `ownerActorId === identity.actorId` unless the independently verified identity has tenant `ADMIN` role **or** a separately trusted, per-record, per-actor, per-action grant resolver returns a documented positive grant. Retain tenant-scoped physical storage checks even for ADMIN and delegated reviewers. Do not infer review rights from `IC_MEMBER` role alone. The grant resolver is not wired into the default server composition; real assignment registry remains external evidence.
3. Refuse access to legacy envelopes without an **attested ownerActorId** for non-admins. Do not infer owner from mutable `updatedBy`; manual provenance-backed migration remains a separate approval requirement.
4. Keep `ownerActorId` unchanged for administrative edits. Unauthorized read/write maps to identical generic HTTP `404 WORKSPACE_NOT_FOUND` to reduce enumeration.
5. Preserve JWT validation, other policy and financial data code, original records, workspaces and version CAS operations.

**Limits:** this does not create project-level ACLs, delegated sharing, records-per-employee permission management, IdP revocation, live DB RLS or a real cloud deployment. Tenant ADMIN remains a powerful role; its assignment must be independently governed.

## 4. Available authorization matrix — actual workspace code, not all UI roles
| Principal | View own workspace | View peer in same tenant | Save own workspace | Save peer | View different tenant |
|---|---|---|---|---|---|
| Tenant ADMIN (verified token) | Allow | Allow within tenant | Allow | Allow within tenant | Deny/absent due tenant isolation |
| ANALYST (verified, owner) | Allow | Deny | Allow | Deny | Deny/absent |
| VIEWER (verified, owner) | Allow | Deny | Deny | Deny | Deny/absent |
| IC_MEMBER (verified, owner) | Allow | Deny absent explicit trusted record grant; allow only granted READ for designated workspace | Deny | Deny | Deny/absent |
| Platform owner | **Not implemented/verified as separate server role** | Deny unless explicitly granted | Not established | Not established | No omnipotent implicit access |
| Client / supplier / auditor role | No verified mapping in canonical workspace API | Default Deny | Default Deny | Default Deny | Default Deny |
| AI tool/service | No workspace credential or independent grant from the gateway itself | Default Deny | Default Deny | Default Deny | Default Deny |
| Suspended account or stale JWT | Must be rejected by real IdP/revocation and session verification | **Not live-tested** | Not live-tested | Not live-tested | Not live-tested |
| Anonymous | Deny (bearer required) | Deny | Deny | Deny | Deny |

Notes: a role is taken from cryptographically verified OIDC claims by the server composition. Role names beyond ADMIN, ANALYST, VIEWER and IC_MEMBER are **not** assumed to exist. Server code is not proof that a separate production Owner Console or account revocation is connected.

## 5. Remediation files and regression scope
- `src/runtime/canonical-workspace-persistence.js`: deny cross-actor same-tenant reads/writes, trusted server-record ownership, legacy quarantine.
- `src/server/canonical-workspace-http-api.js`: generic 404 for forbidden record access, no peer existence disclosure.
- `tests/architecture/run_authenticated_canonical_workspace_service_v1.js`: signed synthetic JWT owner, peer VIEWER and ANALYST, tenant ADMIN, overwrite/lookup.
- `tests/architecture/run_canonical_workspace_product_runtime_v1.js`: owner downgrade, ADMIN read, quarantine prior unowned envelopes.
- `tests/runtime/run_canonical_workspace_http_api_tests.js`: real loopback Node HTTP, generic 404 on peer read/write (service stub for this particular assertion).
- `tests/architecture/run_authenticated_investment_committee_runtime_v1.js` and `tests/architecture/run_authenticated_reporting_runtime_v1.js`: explicit *synthetic, trusted, READ-only, resource-specific* reviewer grants preserve intended IC/report paths while denying peer/sibling access; there is **no production reviewer assignment registry deployment evidence**.
- `tests/architecture/run_canonical_workspace_product_runtime_v1.js`: additionally verifies delegated READ never confers WRITE even with ANALYST role.
- `.github/workflows/security-hardening-v1-verify.yml`: focused CI tests and high-severity dependency audit, with explicit external qualification HOLD.

## 6. Required verification — evidence status
| Control | Evidence standard | Status at report creation |
|---|---|---|
| Same-tenant object authorization | Exact-head regression, signed synthetic test principals | 2026-11-18 GitHub security CI: PASS; latest committed follow-up regression requalification required |
| Node loopback REST 404 behavior | Exact-head HTTP regression | PASS in security CI; release verification on latest HEAD pending |
| JWT / tenant / RBAC source regression | Exact-head CI | PASS in scoped security run; latest HEAD pending |
| Cloudflare AI / Kite gateway negative tests | Stubbed upstream CI | PASS scoped security run, NOT real provider |
| Dependency vulnerability gate | `npm audit --omit=dev --audit-level=high` | PASS production dependency subset; full build tool audit FAIL: 5 HIGH via picomatch chain (issue #804); release blocked |
| SAST with independent scanner | Tool execution and saved results | NOT RUN |
| Comprehensive historical secret scan | Independent secret scanner / security access | NOT RUN |
| Multi-tenant live PostgreSQL RLS & IDOR | Real isolated database, real operator IdP, separate test accounts | BLOCKED: no tenant/DB/IdP credentials or environment |
| Live file/object ACL and signed URLs | Real object storage, separate identities, negative/positive tests | BLOCKED |
| AI/RAG cross-tenant retrieved document authorization | Real retrieval service and test tenants | BLOCKED |
| Revocation, session kill, MFA, password recovery | Connected identity provider and test accounts | BLOCKED |
| Pen test, backup/restore, incident RCA, secrets rotation | Authorized operations and external evidence | BLOCKED |
| Production GO sign-off | Signed independent evidence Q01–Q12, owners and authorities | NOT QUALIFIED |

A successful release regression or code gate **must not** be transformed into an external-authentication, production data-isolation or Saudi compliance certificate.

### Independent release regression discovery
The first integrated exact-head Release Verify `44284091308` reported **638/640 regression checks PASS**, with failures in the legitimate IC reviewer and report revalidation flows following the initial restrictive owner check. This drove a second remediation: an *explicit, trusted, actor/workspace/case/action-bound READ grant* for designated human reviewers, rather than blanket role access or removal of authorization. Regression requalification on the latest head is pending as of this report amendment. Full npm audit also blocks Release Verify. Do not claim engineering completion while any new test is failing.

## 7. Risks / release hold
- **P0 external:** live authentication and revocation; server-deployed RLS and owner-bound query tests with tenant A/B; staff-level and project-level role/ACL; owner/admin console data plane; data/backup/file authorization.
- **P0 external:** independent production secret scan, real attack testing within written permission, isolated staging DB with actual test employee/client accounts.
- **P1:** explicit record-sharing grants with verified reviewer/member workflows and audit persistence; approved migration for legacy ownerless workspaces.
- **P1:** source licensing, platform-specific AI document retrieval security, PDPL purpose/retention/export/deletion and transfers.

## 8. Saudi regulatory boundary
- PDPL and its implementing and cross-border data-transfer rules require an applicability/processing/retention/transfer analysis; a code test cannot sign off legal compliance. Reference: <https://dgp.sdaia.gov.sa/>.
- NCA ECC 2-2024 has a defined scope covering government entities and certain critical-national-infrastructure operators, with cloud controls applicable within its scope. Whether STARTAK's legal entity is directly within mandatory ECC scope requires a legal/sector classification. Reference: <https://nca.gov.sa/en/regulatory-documents/controls-list/ecc/>.
- Do not assume that Cloudflare default region is approved Saudi data residency. Verify the required storage/processing/backup locations and relevant contractual/legal basis before deployment.

## 9. RACI and final decision
| Workstream | Responsible | Accountable | Required proof |
|---|---|---|---|
| Source fix / negative tests | AppSec engineer and QA | Technical owner | Exact-head CI and peer IDOR replay |
| RLS and file isolation | Database/security engineer | Security lead | Real A/B tenant database & storage access evidence |
| Identity/admin roles | IAM engineer | Product owner | Revocation/MFA/admin policy live tests |
| AI/source governance | AI engineer, data steward | Data governance owner | Live retrieval authorization / source licenses |
| Legal/PDPL/NCA | Privacy/legal and GRC | Authorized company management | Applicability opinion and signed compliance matrix |
| Production release | Independent reviewer / release manager | Authorized owner/decision committee | All P0 controls, rollback, external signed GO |

**Decision: HOLD / NO MAIN MERGE / NO PRODUCTION DEPLOYMENT.** This change narrows a particular proposed server-route BOLA risk; no platform-wide claim of security completion is made.


## 2026-11-20 — dependency/security release requalification (supersedes earlier audit-gate status)
**Scope:** isolated PR #803 / security branch only. Earlier five HIGH npm audit findings and the PENDING statuses above are historical November 18 results; **do not treat them as current for this release candidate**.

### Remediation actually committed
- Vite `8.2.4` -> `8.2.6` with regenerated `package-lock.json` on the security branch ([commit `0b29ccd8`](https://github.com/turkialeid2030/startak-real-estate/commit/0b29ccd8feb6247d6a4613e774da8840736db302)); Rolldown `1.2.5` -> `1.2.19`. Mitigates `GHSA-p4f5-76q4-ffq7` dev-server RCE in vulnerable Vite 8.2.4 when exposed to the network. No forced downgrade of major Vite version.
- `tests/architecture/run_vite_security_patch_floor_v1.js` asserts pinned patched versions, trusted package lockfile and no explicit network binding via `dev` scripts.
- `GHSA-fc5q-39xc-vjpf` regarding `picomatch` was **withdrawn by GitHub on November 18, 2026**. No patch to `picomatch@4.0.7` is claimed; the historical five HIGH npm audit results ceased being reported after withdrawal, not because we removed the package or patched its implementation. An external `CVE-2026-112366` entry may persist elsewhere; do not interpret an advisory withdrawal as mathematical proof that all crafted glob patterns are harmless. Track new reviewed advisories and prevent untrusted glob input to dev tooling.

### Executed exact-head evidence before this documentation addendum
- [GitHub Security Hardening V1 run #44669746230](https://github.com/turkialeid2030/startak-real-estate/actions/runs/44669746230): **SUCCESS** with signed synthetic JWT same-tenant BOLA/read-only reviewer tests, isolated **real PostgreSQL 16** tenant A/B RLS positive/negative SQL, Cloudflare AI/Kite negative gateway mocks, `VITE_8_2_6_SECURITY_PATCH_FLOOR=PASS`, `npm audit --omit=dev --audit-level=high` and full `npm audit --audit-level=high` both **PASS / zero current vulnerabilities**.
- [GitHub Release Verify run #44669746231](https://github.com/turkialeid2030/startak-real-estate/actions/runs/44669746231): **SUCCESS**, `REGRESSION_TOTAL=641 PASSED=641`, `TEST_DISCOVERY_AND_REGRESSION=PASS`, `PRODUCTION_BUILD=PASS`, `VERIFY_PACKAGE=PASS`, and `NPM_AUDIT_RELEASE_THRESHOLD=PASS (critical=0 high=0 moderate=0 low=0)`.
- Exact implementation snapshot qualified in these runs: `5608a30032a3dcd6790b3ff1d041fd5fe9522def`. This addendum and historical-advisory log correction change the branch SHA; re-run exact-head CI after the documentation update to establish the final checkpoint. Do not carry forward the earlier run as proof for a later untested code SHA.

### Final status / reserved external gates
**Engineering source/builder qualification:** PASS only for scoped tested routes and exact SHA. **Commercial release and production:** `HOLD_NOT_AUTHORIZED`, no main merge or deployment, until real IdP/revocation/tenant A/B HTTP-to-deployed PostgreSQL RLS, per-record authorization in deployed system, encrypted files/ACLs/backup/DR, real AI retrieval access control, independent source-rights and appraisal reviews, full 17-case private parity, PDPL/NCA applicability and Q01–Q12 signed human approvals are independently evidenced.
