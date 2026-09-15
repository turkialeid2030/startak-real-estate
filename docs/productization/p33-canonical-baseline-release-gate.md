# P33 — Canonical Baseline Release Gate

P33 wires the P32 baseline registry into the canonical Release Verify path. This turns the explicit current baseline registry from documentation into a mandatory fail-closed engineering gate.

## Release Verify behavior

A new mandatory step runs before legacy canonical-source evidence evaluation:

`CANONICAL_BASELINE_REGISTRY_VERIFICATION`

The step verifies that `config/governance/canonical-baseline.json` still represents the approved current state:

- `activeMode = LEGACY_FILE_SHA256`;
- pinned legacy SHA-256 unchanged;
- historical source recorded as unavailable;
- evidence state remains `NOT_EVALUATED`;
- no governed-composite activation data is present;
- no release/merge/deployment/go-live/transaction authority is enabled.

If the registry is missing, malformed, silently switched, hash-drifted or authority-escalated, Release Verify fails.

## Future activation boundary

P33 deliberately does not accept `GOVERNED_COMPOSITE_BASELINE` as an active mode yet. A future successor-baseline activation therefore requires an explicit reviewed code change to the registry and the release gate after the real P27/P30/P31 governance evidence exists.

This prevents a data-only silent mode switch from bypassing the human-reviewed activation path.

## Canonical source evidence remains separate

After the registry gate passes, the existing legacy canonical-source check still runs. Because the historical original bytes remain unavailable, normal engineering CI continues to report:

`CANONICAL_SOURCE_HASH_VERIFICATION: NOT_EVALUATED`

P33 does not convert that state into PASS and does not fabricate missing evidence.