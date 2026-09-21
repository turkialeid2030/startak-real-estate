# Owner Admin Actions — Immediate Execution

Applies to repository owner `github:turkialeid2030` for frozen RC `startak-real-estate-rc-2026-09-16-e876208c19ff`.

## 1. Close #326 — Main ruleset hardening

Current live state of ruleset `21861129`:

- name: `STARTAK Main Production Governance`
- enforcement: `active`
- target: default branch
- strict required status checks: `true`
- bypass actors: none
- current required status checks: `release-verify` only

Required administrator action:

1. GitHub repository → Settings → Rules → Rulesets.
2. Open `STARTAK Main Production Governance` / ruleset `21861129`.
3. Keep `release-verify` required.
4. Add `trusted-main-production-governance` as an additional required status check.
5. Preserve strict enforcement.
6. Do not add bypass actors.
7. Save.
8. Re-read ruleset and attach non-secret evidence to #326.

Closure condition: live read must show both status contexts together, strict=true, bypass actors empty.

## 2. Progress #327 — Production Environment controls

GitHub repository → Settings → Environments → `production`.

Verify and document without exposing any secret value:

1. Environment name is exactly `production`.
2. Deployment branches/tags are restricted to the governed `main` production path.
3. `CLOUDFLARE_API_TOKEN` is scoped as an Environment secret where operationally possible and broader repository-level exposure is removed/minimized.
4. Deployment-capable jobs cannot obtain production credentials before the Environment approval boundary.
5. Required reviewers are enabled.

### Required-reviewer dependency

The current owner is designated as `MERGE_APPROVAL` authority. Therefore the production deployment approval path must not collapse back to the same human subject. A distinct `DEPLOYMENT_APPROVAL` human is still required.

Recommended operational alignment once that person is named:

- use the distinct Deployment authority, or an appropriately controlled production-governance reviewer group containing that authority, in the `production` Environment review path;
- do not make `github:turkialeid2030` the sole production reviewer if that would collapse Merge and Deployment authority.

Until a distinct Deployment authority is named and the Environment reviewer control is evidenced, #327 remains HOLD.

## 3. Owner roles already prepared

Current owner:

- `RELEASE_APPROVAL` authority: designated, pending E2F + RSA public-key registration + external signature.
- `MERGE_APPROVAL` authority: designated, pending E2F + RSA public-key registration + external signature.
- GitHub administrative executor: active for #326/#327.

Not assigned to current owner:

- independent reviewer #254;
- independent E2F verifier;
- `DEPLOYMENT_APPROVAL` authority.

## 4. Safety

Do not paste private keys, tokens, passwords, Cloudflare credentials, GitHub secrets, recovery codes, or signing secrets into issues, PRs, CI logs, or chat.

`#326=OWNER_ADMIN_ACTION_REQUIRED`
`#327=OWNER_ADMIN_ACTION_PLUS_DISTINCT_DEPLOYMENT_AUTHORITY_REQUIRED`
`MERGE=HOLD`
`DEPLOY=HOLD`
