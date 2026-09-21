# E2B External Evidence Receipt Checklist — #371

Use this checklist only when genuine external material is actually received. A blank or internally completed checklist is not evidence.

## A. Review artifact

- [ ] Artifact actually received from identified external reviewer/firm.
- [ ] `candidateId` matches a qualified E2 applicability candidate.
- [ ] `evidenceClass` is required for that candidate.
- [ ] `reviewerRef` identifies the actual reviewer.
- [ ] `issuerOrFirmRef` identifies the actual issuer/firm.
- [ ] Artifact states actual review scope.
- [ ] Findings/conclusion are present where applicable.
- [ ] `issuedAt` is taken from the issued artifact/source.
- [ ] `receivedAt` records actual receipt time.
- [ ] Artifact is retained outside the repository under the controlled artifact root.
- [ ] SHA-256 is computed from exact received bytes; not copied from an unverified statement.

## B. Reviewer credential / authority artifact

- [ ] Credential/authority material actually received or independently retrieved from the stated genuine source.
- [ ] `subjectReviewerRef` matches the reviewer referenced by review evidence.
- [ ] `authorityRef` records the claimed authority.
- [ ] `credentialClass` describes the actual credential/authority evidence.
- [ ] `verificationSourceRef` identifies the real verification source.
- [ ] `observedAt` records the actual observation time.
- [ ] Artifact is retained outside the repository under the controlled artifact root.
- [ ] SHA-256 is computed from exact received bytes.

## C. E2B intake

- [ ] No placeholder/template values remain.
- [ ] `artifactRelativePath` is relative to the dedicated artifact root.
- [ ] No symlink/path traversal/absolute path is used.
- [ ] Review artifact declared hash equals computed byte hash.
- [ ] Credential artifact declared hash equals computed byte hash.
- [ ] Intake result is exactly `READY_FOR_EXTERNAL_AUTHORITY_VALIDATION` before E2C preparation.

## D. E2C separation and validation

- [ ] Verification source/artifact exists for each applicable validation type.
- [ ] Eligible verifier is not directly self-validating their own review/credential item.
- [ ] Canonical unsigned signing request is generated from the qualified E2B envelope.
- [ ] Genuine `RSA-SHA256` signature is created outside repository automation/chat.
- [ ] Signature verifies against the independently pinned eligible public key.
- [ ] No production authority is inferred merely from successful structural intake.

## Stop conditions

Stop and keep E2B/E2C on HOLD if any required artifact is missing, template-derived, unverifiable as received bytes, inconsistent with the candidate/reviewer, or if self-validation would occur.

`CHECKLIST_IS_EVIDENCE=false`
`FAIL_CLOSED=true`
