# STARTAK Real Estate — Historical PR #763/#764/#766 ancestry and preview audit control

> Verified against the current draft engineering branch on 20 Nov 2026. This proves **Git ancestry**, not full code-feature parity, production deployment or signed external approval.

## Exact Git ancestry check

Target candidate: `6dc9821d25acbca3fb331917717f59fb589ee58d`, draft `security/hardening-v1`, not `main`.

| Historic PR | Original SHA | Compare original -> current candidate | Consequence |
|---|---|---|---|
| [#763](https://github.com/turkialeid2030/startak-real-estate/pull/763) | `802e27443a19a7a87f5df3f8b576185cee99e726` | `status=ahead`, **548 ahead / 0 behind** | Original head is an ancestor of the candidate, not an independent unrelated snapshot |
| [#764](https://github.com/turkialeid2030/startak-real-estate/pull/764) | `f8eb90cd9e960cc4d6647f291a888b181d891958` | `status=ahead`, **428 ahead / 0 behind** | Original history incorporated; subsequent edits require a no-loss functional check |
| [#766](https://github.com/turkialeid2030/startak-real-estate/pull/766) | `fa92a89c0cc093fb46321af6b24b2f5ae5c05b18` | `status=ahead`, **346 ahead / 0 behind** | The original D01–D07 history is present in the modern branch history |

- These comparisons returned hundreds of **changed modern files** and one historical workflow removal. They are **not byte-for-byte identity**, and do not prove that every registered feature remains mounted in production, has preserved semantics, or passed a real user end-to-end workflow.
- These three PRs remain separate OPEN PR records. Their head SHAs being ancestors of the candidate **does not imply approved main merge** or authorize automatic closure.
- [PR #461](https://github.com/turkialeid2030/startak-real-estate/pull/461) is different: its old P25 head was **diverged**, with **20 commits behind** the comparison candidate and 1104 commits ahead in the reverse direction. Full P25 economic-path parity is explicitly still open.

## Removed immutable Cloudflare preview workflow

- Historical `.github/workflows/owner-immutable-preview-20261028.yml` targeted a fixed `https://1647dc09.startak-real-estate.pages.dev/` and a fixed expected source SHA from October. Its network probes could classify an Access login or HTML masquerading as a JSON manifest, but **could not qualify a changing latest deployment** from a pinned obsolete URL alone.
- The modern `.github/workflows/authenticated-preview-delivery-manual.yml` retains a **read-only PR self-test** without service secrets and permits an **approved main-branch-only workflow_dispatch** on protected `startak-preview-audit` environment with owner-reviewed Cloudflare Access credentials and exact deployment URL+SHA. This is a more appropriate control boundary.
- **Do not re-add the old fixed-sha preview workflow as a production shortcut.** Instead verify deployment reachability with authorized protected credentials and evidence from the actual Cloudflare environment. The controlled production preview test is still an **external operating prerequisite**, not completed by this Git ancestry check.

## Remaining W16/W19 closure conditions

1. Trace the user-facing workflows of location study, sale/rent comparables, market sectors, document evidence, D01–D07 bilingual controls, saved deals and reports from the current actual deployed/preview build.
2. Compare the 57 historic source-path contracts and their modern anchors with negative tests, not by filename/commit lineage alone.
3. Retain 17 private appraisal cases and four supplementary calculations outside the source repo; verify the **real** calculation/export engine against those originals and professional appraiser tolerances.
4. Perform independent penetration/identity/tenant checks, production KMS/vault, live SaaS integrations, professional/PDPL/financial acceptance and all 36 QCR signed evidences.
5. Record reviewer-owned disposition per source behavior and PR; no arbitrary branch deletion, forced close or unapproved merge.

**Decision: GIT ANCESTRY VERIFIED (3/3) / FEATURE PARITY UNPROVEN / `HOLD_NOT_AUTHORIZED`.**
