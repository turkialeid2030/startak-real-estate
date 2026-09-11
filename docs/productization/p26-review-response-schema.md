# P26 Independent Review Response Contract

The independent reviewer response is intentionally narrow and P25-compatible.

Required fields:

- `decisionId`
- `actorRef`
- `result` — one of `APPROVE`, `REJECT`, `HOLD`
- `decisionSourceRef`
- `decisionArtifactSha256`
- `decidedAt`
- `rationaleRef`

Constraints:

- `actorRef` must equal the `independentReviewerRef` fixed by the P24 proposal.
- `actorRef` must differ from the owner/proposer.
- `decisionArtifactSha256` must be a 64-character SHA-256 digest.
- timestamps must be parseable ISO-compatible date/time values.
- an APPROVE response still does not change the baseline; it only becomes input for P25 re-evaluation.
- P26 does not cryptographically verify reviewer identity or the external review artifact.
