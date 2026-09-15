# P70 — Successor Fresh Composite Evidence Verifier

P70 verifies exact executable evidence for the P69 successor fresh governed-composite candidate while keeping the authoritative canonical baseline unchanged in legacy mode.

## Verification chain

P70 first validates the complete P69 candidate record, including its deterministic candidate hash, schema-v4 proposed registry, canonical serialized content, authority-false boundary and successor-cycle lineage. It then recomputes the P69 candidate from the supplied P68 activation plan plus the exact current legacy registry object and raw bytes.

The current legacy state must match both the logical canonical registry hash and the raw-content SHA-256 recorded in P69. Raw bytes must parse to the same logical registry object.

## Exact evidence

The verifier compares:

- exact observed Git commit SHA against the successor baseline manifest
- SHA-256 of supplied release-artifact bytes against the P69 governed-composite candidate
- SHA-256 of supplied environment-config bytes against the P69 governed-composite candidate
- successor governance-cycle and reviewer-lifecycle-lock hashes
- prior legacy logical/content hashes
- predecessor incident-closeout, human decision, governance reset, RCA and CAPA hashes carried by the successor candidate

Highest state:

`SUCCESSOR_FRESH_COMPOSITE_EVIDENCE_MATCH_NOT_ACTIVE`

## Authority boundary

A successful P70 result is evidence only. The candidate remains non-active and all activation, reactivation, release, merge, deployment, go-live, transaction and registry-mutation authority remains false.

Success still requires successor shadow verification, cutover rehearsal, safety evidence, fresh owner authorization, an explicit activation-change contract, and a successor-specific active-mode verifier before any later activation can be considered.

## Operator safety

`tools/successor-fresh-composite-evidence-verifier.js` reads bounded regular files, rejects symlinks, duplicate/unknown/private-or-secret-key arguments, hashes exact artifact/config bytes and has no mutation path.

## Operational status

Regression fixtures use local synthetic artifact/config bytes only. P70 does not claim real production artifact provenance or real external owner/reviewer authorization. No merge, deploy, go-live or canonical-registry mutation is performed.
