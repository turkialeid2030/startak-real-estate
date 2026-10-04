# C47 — Internal Privacy / PDPL Readiness Review

## Scope and decision boundary

C47 is an internal engineering privacy-readiness review of the exact candidate derived from the C46 qualified head `65f1acd60335660396f0d84f5cc4839e6745ebdf`.

Internal engineering decision: **READY_FOR_INDEPENDENT_PRIVACY_REVIEW**.

This document is **not a legal opinion**, does **not certify PDPL compliance**, does not satisfy external gate #546, and does not authorize production deployment or commercial go-live.

## Data-flow inventory reviewed

| Surface | Technical observation | C47 posture |
| --- | --- | --- |
| Browser Saved Deals | Saved Deal records are persisted through browser/host storage abstractions. The browser fallback uses namespaced `localStorage` and provides explicit deletion, but no TTL or encryption-at-rest contract is present in that provider. | User/browser-side persistence exists; retention policy is not inferred from storage mechanics. |
| Saved Deal backup/export | Backup export serializes canonically validated Saved Deal records into a user-managed JSON envelope. Structural validation and provenance do not provide confidentiality or encryption. | Treat exported backup files as user-controlled sensitive business data. |
| Local document intake | XLSX/PPTX/PDF intake is bounded to 40 MB. The implemented interface reads the file in-browser, hashes it locally, and explicitly states that the module does not send the file to an external service. | Positive local-processing boundary for this path only. |
| PostgreSQL canonical workspace | The generated schema stores tenant-scoped JSONB payloads with RLS migration support. The schema currently has no expiry/deletion lifecycle columns and generation is explicitly not proof of migration execution. | Server-side retention/deletion and DSR workflows remain operationally unvalidated. |
| External telemetry | Sentry transport is configured with `sendDefaultPii: false`, no default integrations, and no stack traces. C47 additionally removes user-agent transmission and converts runtime errors/rejections to static provider-safe messages. | Raw runtime/user content is prohibited from the telemetry envelope. |
| Governed live AI provider gateway | Provider authorization already requires security/privacy/DLP/contract/residency/retention/no-training evidence references and remains non-production. C47 adds an independent fail-closed blocker for grounding items classified `PERSONAL_DATA`. | External transfer of `PERSONAL_DATA` is blocked by default even if a model profile is reconfigured to allow that class. |

## C47 hardening changes

### 1. Telemetry content minimization

`src/observability/report-runtime-error.js` now:

- excludes `userAgent` from the outbound allowlist;
- never forwards raw `Error.message`, rejection reason, user/project content, request bodies, cookies, Saved Deal payloads, or stack traces;
- maps runtime categories to static messages such as `STARTAK window error`;
- regenerates the safe message in `beforeSend` instead of trusting an SDK event message;
- constrains outbound category/surface/locale/build metadata to bounded token-shaped values.

This is a technical data-minimization control, not a determination of the lawful basis for the telemetry processor or any cross-border transfer.

### 2. External AI personal-data fail-closed boundary

`src/ai/governed-live-provider-gateway.js` now emits:

`C23_PRIVACY_PERSONAL_DATA_EXTERNAL_TRANSFER_NOT_AUTHORIZED:<itemId>`

for any grounding item whose data class is `PERSONAL_DATA`. The blocker is classified as `HOLD_SECURITY`. Because provider execution exits before adapter invocation whenever readiness is blocked, this prevents the provider call on that path.

No internal evidence reference can convert this C47 rule into legal authorization for personal-data transfer. A future change would require a separately reviewed policy and external privacy/legal approval.

## Known gaps intentionally left open

The following are **not** internally declared complete:

1. Server-side retention schedule, deletion execution, backup deletion propagation, and legal-hold semantics.
2. Operational data-subject access/correction/deletion workflow and response evidence.
3. Independent processor/subprocessor review for telemetry, AI providers, hosting, and other third parties.
4. Cross-border/data-residency legal basis and transfer assessment.
5. Independent PDPL/privacy review of the exact candidate SHA.
6. Production privacy certification, deployment authorization, and commercial go-live authorization.

These items must remain fail-closed in release governance. Missing external evidence must never be converted into an internal approval.

## External gate

External privacy / PDPL gate: **#546**.

Required outcome remains one of the independent reviewer dispositions defined by that gate. Until an identifiable independent reviewer evaluates the exact candidate SHA and provides the required immutable evidence, the project posture remains:

- `C47_GATE_546_SATISFIED=FALSE`
- `C47_PDPL_COMPLIANCE_CERTIFIED=FALSE`
- `C47_DEPLOYMENT_AUTHORIZED=FALSE`
- `C47_COMMERCIAL_GO_LIVE_AUTHORIZED=FALSE`

## Internal qualification claim

C47 may claim only:

**INTERNAL_PRIVACY_ENGINEERING_QUALIFIED_READY_FOR_INDEPENDENT_PRIVACY_REVIEW_EXTERNAL_PDPL_GATE_HOLD**

It may not claim statutory compliance, a legal opinion, external certification, production approval, or commercial launch approval.
