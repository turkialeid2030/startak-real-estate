# External Evidence Form — Human Release Authority & Production Execution

Issue: #208
Parent tracker: #202
Qualified E2I head: `f910a086039b0cbde93faa063b468bfd0c28a3f9`
Current operating mode: `UNLICENSED_DECISION_SUPPORT`

## Purpose

Record the final real human authorization and actual production execution evidence after Issues #203–#207 and all material remediation are complete.

This form does not itself authorize release. It is completed only from real decisions and real execution records.

# 1. Release candidate identity

- Release candidate ID:
- Source commit SHA:
- Release artifact SHA-256:
- Target environment:
- Environment configuration hash/reference:
- Build/package evidence reference:
- External readiness tracker reference: #202

# 2. Preconditions

Before any RELEASE decision, confirm:

- [ ] #203 canonical-source comparison accepted
- [ ] #204 Saudi legal review accepted
- [ ] #205 PDPL/data-governance review accepted
- [ ] #206 professional valuation/standards-scope review accepted
- [ ] #207 security/performance/resilience validation accepted
- [ ] all material remediation closed or formally accepted by competent authority
- [ ] no unresolved Critical security finding
- [ ] no unresolved High security finding
- [ ] operating-mode claims verified against Issue #13
- [ ] release candidate/artifact/environment still match the reviewed evidence

If any prerequisite is false, the release decision must be `HOLD` or `REJECT`.

# 3. Human RELEASE decision

- Decision ID:
- Authorized person / governance body:
- Authority basis / mandate:
- Identity/authentication evidence reference:
- Decision: `APPROVE` / `REJECT` / `HOLD`
- Exact release candidate approved:
- Conditions / limitations:
- Decision timestamp:
- Signature / controlled approval evidence reference:
- Evidence SHA-256:

# 4. Human MERGE decision

- Decision ID:
- Authorized person / governance body:
- Authority basis / mandate:
- Identity/authentication evidence reference:
- Decision: `APPROVE` / `REJECT` / `HOLD`
- Approved source branch / commit:
- Approved target branch:
- Conditions / limitations:
- Decision timestamp:
- Signature / controlled approval evidence reference:
- Evidence SHA-256:

A MERGE approval requires an approved RELEASE decision for the same release candidate.

# 5. Human DEPLOYMENT decision

- Decision ID:
- Authorized person / governance body:
- Authority basis / mandate:
- Identity/authentication evidence reference:
- Decision: `APPROVE` / `REJECT` / `HOLD`
- Approved artifact:
- Approved environment:
- Approved environment configuration:
- Conditions / limitations:
- Decision timestamp:
- Signature / controlled approval evidence reference:
- Evidence SHA-256:

A DEPLOYMENT approval requires approved RELEASE and MERGE decisions.

## Separation of duties

Record the governed subject for each decision:

- RELEASE authority subject:
- MERGE authority subject:
- DEPLOYMENT authority subject:

The same governed subject must not approve all three decisions. Merge and deployment authority should remain separated in accordance with the E2G controls.

# 6. Actual merge execution evidence

Complete only after merge actually occurs.

- Merge execution ID / PR:
- Merge method:
- Pre-merge approved head SHA:
- Resulting merge commit SHA:
- Executor identity:
- Execution timestamp:
- GitHub/provider evidence reference:
- Attestation/reference SHA-256:

# 7. Actual deployment evidence

Complete only after deployment actually occurs.

- Deployment ID / provider reference:
- Deployed merge/source commit SHA:
- Deployed artifact SHA-256:
- Environment:
- Environment configuration reference/hash:
- Deployment executor:
- Start/end timestamps:
- Provider evidence reference:
- Attestation/reference SHA-256:

# 8. Post-deployment smoke validation

- Smoke validation ID:
- Independent validator identity:
- Deployment ID tested:
- Critical user journeys tested:
- Result: `PASS` / `FAIL` / `INCONCLUSIVE`
- Findings:
- Timestamp:
- Evidence reference / SHA-256:

# 9. Rollback readiness

- Rollback package/version/reference:
- Rollback procedure version:
- Restore/rollback validation evidence:
- Result: `VERIFIED` / `REJECTED` / `INCONCLUSIVE`
- Validator identity:
- Timestamp:
- Evidence reference / SHA-256:

# 10. Operating-mode claims confirmation

For the deployed product confirm:

- [ ] no claim of certified/accredited valuation
- [ ] no claim of licensed real-estate consultancy unless separately licensed and authorized
- [ ] no brokerage/transaction authority claim
- [ ] no regulated investment-advice claim
- [ ] no legal-opinion claim
- [ ] required `UNLICENSED_DECISION_SUPPORT` notices remain present where required
- [ ] formal valuation/legal/regulated outputs still escalate to licensed-professional review
- [ ] `transactionAuthorized=false`
- [ ] no automatic standards activation has occurred

Reviewer / confirmer:
Evidence reference:
Evidence SHA-256:
Timestamp:

# 11. Final software go-live disposition

Select one:

- `GO_LIVE_APPROVED_FOR_UNLICENSED_DECISION_SUPPORT`
- `GO_LIVE_APPROVED_WITH_CONDITIONS`
- `HOLD`
- `REJECT`

Conditions / unresolved items:

Final authority identity:
Final decision timestamp:
Final evidence reference / SHA-256:

## Authority boundary

Even a successful software go-live does not by itself establish:

- Saudi professional valuation licensing;
- certified valuation authority;
- external professional valuation issuance authority;
- transaction authority;
- automatic standards/rules activation.