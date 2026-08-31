# STARTAK Real Estate — Document Intelligence & Evidence Reconciliation Foundation

Status: **FOUNDATION IMPLEMENTATION — NOT YET UI/CONNECTOR COMPLETE**

## Governing doctrine

> Document ≠ Evidence  
> Evidence ≠ Verified Fact  
> Verified Fact ≠ Decision Value

This module exists to prevent uploaded documents, extracted text, presentations, spreadsheets, or model outputs from being silently treated as authoritative investment facts.

## Target pipeline

`INGEST → HASH → CLASSIFY → EXTRACT → NORMALIZE → EVIDENCE LINK → RECONCILE → VERIFY → CONFIDENCE → UNDERWRITING READINESS`

The current foundation implements the deterministic control-plane portions of that pipeline. It does **not** claim OCR, PDF parsing, Excel parsing, external registry verification, title verification, or AI extraction connectivity.

## Implemented in this foundation

1. **Immutable document intake record**
   - SHA-256 content identity.
   - Case/document identifiers.
   - MIME/file metadata.
   - Explicit duplicate-content detection scoped to the same investment case.
   - Document-type classification from metadata only.
   - Authority is never inferred from filename or document type.

2. **Evidence fact contract**
   - Preserves raw value and normalized value separately.
   - Requires an explicit source locator (page/cell/slide/section/document metadata).
   - Carries extraction method and extraction confidence.
   - Requires the evidence `caseId` to match the owning document `caseId`.
   - Defaults to `EXTRACTED_EVIDENCE` and `NOT_VERIFIED`.
   - No extracted value is automatically promoted to verified fact.

3. **Normalization controls**
   - Deterministic string/number/boolean/date normalization.
   - Arabic-Indic and Eastern-Arabic numeric digit support.
   - No silent unit conversion.
   - Unit mismatches remain visible to reconciliation.

4. **Cross-document reconciliation**
   - Groups evidence by semantic key within one investment case only.
   - Fails closed if facts from multiple cases are supplied together.
   - Returns `MISSING`, `SINGLE_SOURCE_UNCORROBORATED`, `AGREEMENT`, `CONFLICT`, or `UNIT_MISMATCH`.
   - Does not select a winner when sources conflict.
   - Preserves source traceability for every compared value.

5. **Explicit verification promotion**
   - A fact may become `VERIFIED_FACT` only through an explicit verification action carrying method, verifier type, and verification reference.
   - Verification returns a new immutable fact; the extracted evidence object is not mutated.

6. **Evidence-to-underwriting readiness gate**
   - Required evidence policies specify minimum independent sources and conflict policy.
   - Missing evidence, unresolved material conflicts, unit mismatches, or insufficient corroboration hold the evidence packet.
   - Mixed-case reconciliations are rejected rather than combined.
   - Passing this gate means only `READY_FOR_UNDERWRITING_INPUT`; it is **not** an investment recommendation or IC approval.

## Explicitly not implemented yet

- PDF/PPT/XLSX/DOCX parser adapters.
- OCR.
- Table extraction.
- AI/LLM extraction.
- Saudi official-source connectors.
- Title deed / survey / permit live verification.
- Evidence UI and side-by-side source viewer.
- Case-level persistent evidence store.
- Human reviewer workflow.
- Automated decision impact mapping into the financial engine.

## Safety invariants

- No document is authoritative merely because it was uploaded.
- No evidence item may attach to a document owned by another investment case.
- No duplicate-content link is created across investment cases.
- No reconciliation or readiness assessment may mix cases.
- No extracted value overwrites another source silently.
- No conflict is auto-resolved by source ordering.
- No unit conversion occurs unless an explicit future conversion rule is invoked.
- No evidence is called verified without a verification record.
- No evidence packet directly changes the existing financial engine in this foundation.
- Existing production calculations remain behaviorally frozen.

## Initial target document classes

- Title deed / ownership record.
- Survey / cadastral / plot plan.
- Valuation / appraisal.
- Lease / rent roll.
- Financial model / feasibility workbook.
- Presentation / investment memorandum.
- Building permit / license.
- Zoning / urban-code evidence.
- Due-diligence report.
- Unknown / unclassified.

## Gate for the next implementation wave

The next wave may connect parsers only after this foundation remains green under `npm run release:verify`. Parser output must enter through the Evidence Fact contract; parsers must not write directly into financial-engine inputs.
