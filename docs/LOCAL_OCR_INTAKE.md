# Local single-page Arabic/English OCR

The document workspace can explicitly OCR one selected PDF page or one PNG/JPEG
image. Native Office/PDF text intake remains available. OCR is a candidate text
extraction step, never automatic verified evidence or financial input. It does
not infer document authenticity, legal title, table semantics or complete file
coverage. A confidence score is an engine score, not measured accuracy.

Automatic layout is the default. Users can explicitly choose Single text block
for text arranged in one block; it is unsuitable for multiple columns. The
selection is recorded on every OCR atom and export, and changing it clears the
previous result/candidate/preview. Automatic layout can omit clear Arabic lines
even with high confidence: the browser-generated Firefox font fixture reproduces
this with pinned models, while Single text block reads both Arabic and Latin
lines from those same pixels. No silent retry or merged alternative text is used.

## Source and lifecycle

The original file SHA-256 is checked again before rendering. A PDF selection
keeps the original PDF digest and selected page number; the raster never replaces
source identity. Each line retains raw text, pixel bounds, raster dimensions,
engine/language version and actual confidence. Coordinates and confidence survive
explicit semantic mapping and the local source journal. OCR candidates cannot
silently receive the old default confidence of 1. A mismatched source digest or
invalid OCR score rejects mapping.

The source preview is transient memory. JSON export contains all extracted
lines, coordinates, source references and limitations, with no source image.
Case replacement, a new file, page changes, cancel and errors remove the previous
displayed result/candidate. Manual-transcription drafts reset on source/case
replacement. No original file or page image is written to the journal.

The application owns the OCR worker before initialization, using the explicitly
pinned Tesseract.js 7 worker protocol. Every success, failure, cancellation and
deadline terminates it, including initialization/download stalls. The version
must not be changed without protocol and real-browser regression. The overall
deadline covers source hashing, PDF/image rasterization, initialization and
recognition. Late completions cannot publish into a replacement case.

## Same-origin assets and CSP

Dependencies are pinned: `tesseract.js@7.0.0` and Arabic/English data packages
`@tesseract.js-data/{ara,eng}@1.0.0`. The build emits a content-addressed directory
with the worker, best-integer language models, every LSTM platform variant
(non-SIMD, SIMD and relaxed-SIMD), package notices and engine licenses. The owned
client always requests LSTM-only/OEM 1; legacy/OSD is unsupported. No CDN fallback
or provider call is configured. Models load from this site only after an OCR
request; model IndexedDB caching is disabled. No paid service is activated.

Every emitted resource is included in the final byte/hash manifest and public
delivery verification. CSP permits WebAssembly compilation with
`wasm-unsafe-eval`, keeps general JavaScript `unsafe-eval` disallowed, and restricts
workers to self. Worker responses use the same production policy. Browser tests
apply that policy where preview servers omit Pages headers, and never relax an
existing public policy. HTTP loopback previews are forwarded through temporary
local HTTPS because WebKit upgrades their subresources under the unchanged
`upgrade-insecure-requests` directive. Certificate checking is bypassed only for
that ephemeral loopback fixture; published HTTPS acceptance uses normal checks.
Private user attachments are absent from the repository,
test fixtures, CI uploads and bundled resources.

## Limits

| Boundary | Limit |
| --- | --- |
| Original file | 40 MiB |
| PDF document / selected page | At most 200 pages; exactly one explicit selected page |
| Input PNG/JPEG | At most 6 million pixels, validated before and after decode |
| Rendered PDF image | At most 6 million output pixels; embedded images capped at 20 million pixels |
| Extracted output | 500 nonempty lines, 32,000 text characters, bounded 4 MB engine result |
| Complete request | 60 seconds including initialization; cancellation holds no partial result |

Invalid headers, pixels, page selection, geometry, text bounds, source identity,
engine errors and timeouts fail closed. Empty pages are explicitly unrecognized,
not verified empty documents. Layout/reading order, decimal separators, dates and
tables require comparison with the visible source. Images needing rotation,
handwriting, degraded scans or complex layouts have no accuracy qualification.

## Verification and open work

Tests exercise actual pinned WASM/model execution with a synthetic exact decimal,
source identity, geometry, confidence, semantic/journal lineage, cancellation,
deadlines, limits and missing data. Three-browser desktop/mobile acceptance uses
real Arabic pixels, a scanned two-page PDF with exclusive page selection, public
CSP, no external requests, exported values and terminating workers during blocked
initialization. Populated UI screenshots are retained in acceptance artifacts.

This implements the previously missing local OCR path. It does not establish
independent OCR accuracy across real documents, automatic table understanding,
bulk file coverage, authenticated source/reviewer identity, market accuracy or
professional/institutional qualification. Those audit requirements remain open.
