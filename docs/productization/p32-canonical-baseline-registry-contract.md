# P32 — Canonical Baseline Registry Contract

P32 introduces an explicit repository record of the currently active canonical-baseline mode and a fail-closed registry validator. The current mode remains the historical `LEGACY_FILE_SHA256` baseline; no successor baseline is activated.

## Current registry

`config/governance/canonical-baseline.json` records:

- `activeMode = LEGACY_FILE_SHA256`;
- the pinned historical SHA-256;
- `sourceAvailability = UNAVAILABLE`;
- `evidenceStatus = NOT_EVALUATED`;
- no governed-composite baseline;
- no activation-plan hash;
- `activationApplied = false`;
- all release/merge/deployment/go-live/transaction authority fields remain false.

The validator rejects unknown fields, a silent mode switch, hash drift, a fabricated legacy-evidence state, premature activation data or authority escalation.

## Future composite candidate

P32 can convert a valid P31 activation plan into a deterministic **candidate** for a later explicit reviewed registry code change. The candidate binds the P31 successor manifest and activation-plan hash but remains:

- `candidateOnly = true`;
- `activationApplied = false`;
- `canonicalBaselineChanged = false`.

A candidate is not written into the active registry automatically.

## Why this exists

The P31 activation contract targets `config/governance/canonical-baseline.json`. P32 makes that target explicit now, under the unchanged legacy mode, so a later human-reviewed activation is a narrow and auditable registry change rather than an implicit code convention.

## Authority boundary

P32 does not verify the unavailable historical source, complete the independent review, activate the successor baseline, satisfy E2I canonical evidence or grant release authority.