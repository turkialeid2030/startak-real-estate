# Local Document Evidence Intake UI v1 — Claim Boundary

This feature activates a previously isolated Document Intelligence capability through an explicit application UI without introducing an official-agency connector or external upload path.

## Supported local behavior

- Accepts `.xlsx`, `.pptx`, and `.pdf` selections up to 40 MB before parsing.
- Computes a browser-local SHA-256 content digest and derives a local intake scope from that digest.
- Uses the existing bounded deterministic XLSX/PPTX adapters.
- Keeps PDF fail-closed as `PDF_BINARY_PARSER_NOT_YET_VETTED` even when the file has a valid PDF header.
- Shows parser status, adapter, warnings, reason, extracted-atom count, and a bounded preview.
- Does not automatically feed parsed content into the financial engine.

## Explicit non-claims

Parsed content is **not** verified evidence, authoritative market truth, legal evidence, certified valuation input, or an independently authenticated record. Source authority, provenance, evidence qualification, and human review remain separate steps.

The UI performs no `fetch`, `XMLHttpRequest`, WebSocket, or external document upload. Browser/runtime behavior is verified by a real-browser E2E check that records whether any external request occurs after local file selection.
