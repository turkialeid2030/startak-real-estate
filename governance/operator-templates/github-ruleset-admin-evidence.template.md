# GitHub Ruleset Admin Evidence — Template

## Target

- Repository: `turkialeid2030/startak-real-estate`
- Ruleset ID: `21861129`
- Ruleset name: `STARTAK Main Production Governance`
- Default branch target: `main`

## Required administrator verification

Record the post-change live state without exposing credentials.

- [ ] `enforcement = active`
- [ ] `strict_required_status_checks_policy = true`
- [ ] `bypass_actors = []`
- [ ] `current_user_can_bypass = never` or equivalent no-bypass state for the release path
- [ ] required status check `release-verify` is present
- [ ] required status check `trusted-main-production-governance` is present
- [ ] no existing required status check was removed unintentionally

## Evidence

- Verified by: `REPLACE_WITH_ADMIN_SUBJECT_REF`
- Verified at: `REPLACE_WITH_ISO_TIMESTAMP`
- GitHub settings evidence reference: `REPLACE_WITH_NON_SECRET_EVIDENCE_REF`
- Live ruleset read reference: `REPLACE_WITH_API_OR_SCREENSHOT_REF`
- Notes: `REPLACE_WITH_NOTES`

## Decision

`RULESET_ADMIN = PASS | HOLD`

This evidence changes repository enforcement only. It does not grant release, merge, deployment, transaction, canonical activation, professional issuance, or commercial Go-Live authority.
