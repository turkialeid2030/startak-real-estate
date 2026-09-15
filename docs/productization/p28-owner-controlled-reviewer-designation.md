# P28 — Owner-Controlled Canonical Re-baseline Reviewer Designation

P28 allows the repository owner/proposal preparer to designate the independent-review workflow assignee and to replace that assignee later, provided no independent review decision has yet been accepted for the active designation.

## Current workflow designation

- display name: `سعيد المراجع`
- reviewer ref: `reviewer:saeed-pending`
- state: designated for workflow, pending final identity/trust binding
- owner may replace the reviewer before an accepted independent review

This designation is not an independent review and is not evidence that the named person has reviewed or approved anything.

## Design rules

A designation is bound to the exact P24 proposal hash and the proposal owner. The owner cannot designate themselves as the independent reviewer. Replacing a reviewer requires a new designation record, which may reference the prior designation hash. A new reviewer designation causes a newly generated P26 review packet and therefore a different packet hash.

P25 and P26 accept the effective reviewer from a valid owner designation. P27 still requires the actual reviewer identity to be bound to a trusted out-of-band reviewer registry and a valid RSA-SHA256 review attestation before a reviewer decision can be cryptographically accepted.

## Authority boundary

P28 grants only the narrow governance capability to designate or replace the review assignee before accepted review. It does not grant or imply release, merge, deployment, go-live, professional issuance or transaction authority. The canonical baseline is not changed by a reviewer designation.
