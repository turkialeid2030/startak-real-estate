# STARTAK Real Estate — Defect Register

STATUS: ACTIVE_ENGINEERING_REGISTER
VALID_AS_OF: 2026-09-06
SUPERSEDED_BY: none

This register records verified defects and their exact failure modes. It is not a claim of production certification, legal compliance, security certification, cross-browser certification, or independent financial-model validation.

## P1-01 — Saved deal semantic integrity

**Severity:** P1
**Status:** OPEN
**Canonical reproduction base:** `ca3c24ad83a7d3d777b7f10d1435ef231383dfdf`

### Corrected diagnosis

The existing saved-deal structural validator already rejects all of the following:

- missing `inputs`;
- non-object `inputs` such as a string;
- missing `mode`;
- unsupported `mode` values.

The verified defect is different and materially more dangerous:

1. `inputs: {}` is accepted even though it contains none of the mode-specific required engine fields;
2. `savedAt` is optional.

A named saved deal can therefore be structurally accepted while carrying no usable economic inputs. A later application load can present the record alongside application defaults, creating a risk that a user interprets default-populated values as the saved deal's actual underwriting inputs.

### Required correction

Saved-deal loading must follow an explicit fail-closed sequence:

`Parse -> Schema Version -> Structural -> Semantic -> Migration -> Load`

A deal must not be silently repaired. The public failure taxonomy for this boundary is:

- `DEAL_SCHEMA_INVALID`
- `DEAL_VERSION_UNSUPPORTED`
- `DEAL_MIGRATION_REQUIRED`

Mode-specific semantic validation must require the same minimum field set used by `REQUIRED_ENGINE_FIELDS`, and `savedAt` must be mandatory.

## P1-02 — Invalid UI state can be persisted

**Severity:** P1
**Status:** OPEN

The application may reach a state represented by `activeValidationError` while the persistence path does not explicitly gate on that state. A record saved in such a state must not appear analytically valid. Approved remediation for this wave: block save while an active validation error exists.

## P1-03 — Non-atomic public-AI token budget

**Severity:** P1
**Status:** OPEN

The global token-budget reservation uses a read-then-write pattern that can lose concurrent updates. Approved target contract:

`Reserve estimated -> Provider call -> Settle actual -> Daily ledger`

The reservation/settlement ledger must be atomic through a Cloudflare Durable Object and fail closed when the required binding is unavailable.

## P1-04 — Merge-governance gap

**Severity:** P1
**Status:** OPEN

A passing `release:verify` is insufficient on its own to prove the broader release contract. In particular, E2E/comprehensive/compliance checks are separate, missing regression suites can currently disappear without a suite-specific failure, and there is no repository-side minimum-regression-count contract tied to the release manifest.

Target governance contract:

- required release checks: `release-verify`, `comprehensive-verify`, `compliance-guard`;
- minimum regression count on the canonical reference: `235`;
- every mandatory regression suite directory must exist and contain at least one test file;
- independent review is required for changes under `src/engines/**`, `src/compliance/**`, `src/assumptions/**`, and `functions/api/**`;
- repository CODEOWNERS provides reviewer routing, but branch-protection enforcement must be independently verified/configured at repository administration level.

## DOC-001 — Status-document drift

**Severity:** Documentation governance
**Status:** OPEN

Current and historical engineering documents are not consistently labelled with validity/supersession metadata. Status-bearing documents must carry `STATUS`, `VALID_AS_OF`, and `SUPERSEDED_BY`, or be moved to an explicit archive location.
