# C30 External Evidence Artifact Integrity

## Purpose

This control adds byte-level integrity verification for real external evidence artifacts after they are collected under the C30 external-evidence process.

It does **not** create, approve, sign, or independently verify any external authorization. It only confirms that a locally staged artifact is the same byte sequence represented by the SHA-256 recorded in the governed external-evidence manifest.

## Inputs

1. `release/evidence/c30-external-evidence-manifest.template.json` (or a governed successor populated with real evidence metadata).
2. An artifact index using scope `C30_EXTERNAL_ARTIFACT_INDEX_ONLY`.
3. A local artifact root containing the staged source files.

The canonical empty index is:

`release/evidence/c30-external-artifact-index.template.json`

Because all eight real external gates remain `NOT_SUPPLIED`, the canonical template contains zero artifact mappings.

## Verification contract

For every evidence record whose status is not `NOT_SUPPLIED`, exactly one artifact mapping is required.

The verifier:

- validates the external-evidence manifest through the existing C30 intake contract;
- requires the artifact index to bind to the same candidate Git SHA;
- rejects duplicate or unknown evidence identifiers;
- rejects artifact mappings for `NOT_SUPPLIED` records;
- rejects missing mappings for supplied or rejected evidence records;
- accepts only relative artifact paths;
- blocks `..` traversal and real-path/symlink escape from the provided artifact root;
- requires the mapped target to be a regular file;
- computes SHA-256 over the actual bytes;
- fails closed when the computed hash differs from `evidenceHashSha256` in the governed manifest.

## Authority boundary

A successful artifact-integrity result means only:

> the staged bytes match the hash declared in the governed C30 external-evidence record.

It does not establish:

- reviewer independence;
- legal validity;
- privacy approval;
- security authorization;
- source-rights authorization;
- provider-production authorization;
- UAT approval;
- historical replay sufficiency;
- rollback sufficiency;
- release approval;
- activation, merge, deployment, Public AI, transaction, or commercial go-live authority.

The verifier therefore always returns these authority flags as `false`.

Even if all eight records are synthetically populated for regression testing and all artifact hashes match, the collection result remains `EVIDENCE_COMPLETE_PENDING_RELEASE_REEVALUATION`, not automatic `GO`.

## CLI

```text
node tools/c30-external-evidence-artifact-verify.js <manifest.json> <artifact-index.json> [artifact-root]
```

Optional environment binding:

```text
C30_EXTERNAL_EXPECTED_CANDIDATE_SHA=<40-char-git-sha>
```

## Current real state

The real external-evidence state remains:

- 0 `SUPPLIED_VERIFIED`
- 8 `NOT_SUPPLIED`
- 0 `REJECTED`
- C30 decision effect: `HOLD`

No CI fixture, generated document, engineering attestation, synthetic artifact, or test hash is external release evidence.
