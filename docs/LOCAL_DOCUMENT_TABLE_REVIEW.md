# Source-linked local document tables

`LOCAL_DOCUMENT_TABLE_V1` reconstructs one rectangular grid from native PDF
text-item boxes or actual local OCR word boxes. It runs in the document intake
workspace. It does not upload the document, authenticate its source, infer a
financial meaning, or write a financial assumption.

## Review workflow

1. Attach the original within the existing 40 MB intake limit and set the case
   ID. For a scanned page, run the existing single-page local OCR first.
2. Choose the page and within-cell/column reading direction. Propose a grid
   from common whitespace, or enter increasing row/column boundaries as page
   percentages. Boundaries always run from the physical left/top of the page;
   RTL changes column numbering and fragment order, never the digits inside a
   source string. Semicolons separate boundaries; Arabic digits are accepted.
3. Display the original page with the proposed grid. Compare every relevant
   cell with the original, including blank cells and split numbers.
4. Adjust the grid if text crosses a boundary, overlaps substantially or is
   rotated. An ambiguous grid cannot supply any evidence candidate. A missing
   or off-page text box blocks reconstruction for that page instead of hiding
   the omitted text. OCR or documented manual transcription remains available.
5. Choose a populated cell, then explicitly supply its semantic key, value
   type, source reference and human reviewer in the existing qualification
   panel. The resulting fact is still `EXTRACTED_EVIDENCE / NOT_VERIFIED`,
   with financial eligibility false. Existing verification/readiness gates
   remain in force. A grid change clears the selected candidate.

The alignment proposal is geometric. Two aligned prose columns can resemble a
table. Headers, merged cells, checkboxes, units, totals and accounting meaning
are not inferred. Blank cells are `null`, never invented zeros. Native text
boxes estimate font/item extents rather than exact glyph outlines. OCR word
confidence is an engine score, not an accuracy percentage; line-only OCR is
never split into invented word coordinates. Reading order inside mixed Arabic
and numeric fragments must be compared with the original.

## Provenance, transfer and persistence

Each cell retains the original atom/fragment IDs, text and bounds. A selected
fact additionally retains the original file SHA-256, page, coordinate units,
cell bounds, full row/column edges, reading direction, page-layout SHA-256 and
table SHA-256. Table-derived fact IDs include the whole atom identity hash, so
two rows or two different grids cannot share an ID merely because they select
the same column.

Table JSON export includes source-derived cell text and grid definitions,
including unresolved cells; it includes no original file or source image.
Restore requires reattaching the same file to the same case and re-extracting
the same source layout. Restore rebuilds the entire table from current source
fragments and compares the result, rather than trusting a supplied checksum or
promoted status. Changed strings, bounds, page, case, grid or eligibility flags
are rejected. Layout hashes are integrity markers, not identity signatures.
Different parser/OCR outputs may require a fresh grid review.

The selected cell is persisted by the existing source/review journal and its
export/restore workflow. The full grid is restored from its separate table JSON;
it is not silently re-adopted after reopening the browser. Source documents
remain local attachments and are never checked into the public repository.

Limits: 100 rows, 20 columns, 1000 cells, 2000 intersecting fragments and 32000
characters per grid; bounded fragment-to-cell assignments and overlap work;
2 MB table restore input; automatic proposals additionally limit page density.
Existing document/PDF/OCR limits also apply. Exceeding a limit stops the result.

## Qualification evidence and limits

`tests/architecture/run_document_tables.js` exercises actual pinned PDF text
extraction against independently declared coordinates/expected cells, RTL,
blank/negative strings, a merged/rotated item, OCR words and line-only fallback,
source-bound restores, forged cells, source journal persistence and authority
gates. Synthetic fixtures contain no customer information.

`tests/e2e/run_audit_20261021_document_tables_browser.js` is mandatory in branch
and deployed acceptance. It exercises Chromium, Firefox and WebKit at desktop
and narrow viewports, real PDF workers and real OCR/WASM, selected page, source
preview, keyboard selection, evidence mapping/journal/reopen, transfer/tamper
rejection, changed case, ambiguous boundaries and CSP. Evidence records source
SHA, raw synthetic OCR output, table exports, journals and screenshots.

Local private QA also compared two grids on one supplied PDF page with a
rendered original and independently read vector grid coordinates. One grid
had 13 rows/two data columns and retained its blank cell; another had six
rows/three columns. Neither private text nor originals are CI fixtures. This
limited observation does not establish extraction accuracy for other pages,
general table semantics, whole-document coverage or independent qualification.

Record final-head CI and exact-main public acceptance in the implementing PR.
N01/OCR remain open for independent accuracy, arbitrary layouts/merged cells,
source authentication and qualified real-world use. N02, N10 and institutional
backend requirements are separate remaining engineering/qualification work.
