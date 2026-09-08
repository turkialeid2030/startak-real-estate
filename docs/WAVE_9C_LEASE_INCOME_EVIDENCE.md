# Wave 9C — Governed Lease-Level & Income Evidence

Status: engineering candidate only. No merge to `main`; no production deployment authorization.

## Purpose

Wave 9C establishes a lease-level evidence model and rent-roll reconciliation gate for the professional income workflow. It captures contractual facts and provenance without interpreting the contract or automatically adopting DCF assumptions.

## Lease evidence

Each lease captures:

- case/property/unit/tenant/interest references;
- area;
- base annual rent;
- explicitly evidenced contracted annual rent at the stated as-of date;
- lease start and expiry;
- escalation structure and evidence;
- break and renewal options;
- incentives;
- recoveries;
- source class/reference/document hash;
- verification provenance;
- deterministic SHA-256.

Higher source labels such as `OFFICIAL_REGISTERED_LEASE` and `VERIFIED_EXECUTED_LEASE` require verified status. The module does not infer legal enforceability or interpret contractual language.

## Rent-roll snapshot

A professional handoff requires a verified rent-roll snapshot carrying total lettable area, occupied area, annual contract rent, active lease count, source/document hash, verification provenance and exact as-of date.

## Reconciliation

At the requested as-of date, the gate:

- isolates the correct case/property;
- identifies active leases from explicit dates;
- requires verified active leases when professional handoff is requested;
- detects multiple active leases for the same unit;
- reconciles active leased area to rent-roll occupied area under an explicit tolerance;
- reconciles annual contracted rent to rent-roll rent under an explicit tolerance;
- reconciles active lease count;
- prevents active leased area from exceeding total lettable area;
- preserves unverified inactive leases as warnings rather than silently treating them as active evidence.

## Deliberate non-actions

The module explicitly leaves the following false:

- `contractualInterpretationPerformed`
- `automaticDCFAdoption`
- `financialEngineInputsWritten`
- `noiCalculated`
- `valuationConclusionProduced`
- `certifiedValuationEstablished`
- `transactionAuthorized`

## Qualification marker

`WAVE_9C_LEASE_INCOME_EVIDENCE=PASS`

## Next controlled sub-wave

Wave 9D: professional market/income evidence handoff into valuation-method inputs, including explicit capitalization/discount/exit-rate provenance and method-input completeness gates, while preserving the canonical calculation-engine boundary.
