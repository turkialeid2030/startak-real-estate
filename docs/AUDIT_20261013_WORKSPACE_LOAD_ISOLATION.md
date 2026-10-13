# Workspace load failure isolation — 13 October 2026

## Observed failure
Public acceptance run 38390689581 attempt 1, artifact 11808917380, recorded HTTP 200 with text/html for `/assets/evidence-verification-readiness-hMFI6GrK.js`. The browser rejected that module and the CanonicalCaseWorkspacePanel import. The root UI then disappeared, so the saved-deals locator timed out. The underlying asset delivery inconsistency remains unproven; a manifest match alone does not prove all modules are available.

## Implemented containment
Each supplementary lazy workspace has its own error boundary and Suspense. A render/import error hides only that workspace and shows an explicit unavailable result. The study, saved deals, export, and the healthy sibling remain mounted. Reporting uses fixed labels through the existing privacy-minimized error reporter, not raw exceptions or document content.

No automatic reload or automatic retry discards unsaved input. The notice tells the user to save work in available sections before manually reloading. Reloading creates a fresh lazy import after asset delivery recovers; it does not guarantee recovery while an outage persists.

## Acceptance
The existing real-browser study suite injects HTTP 200 text/html into each actual workspace chunk request in separate synthetic desktop/mobile sessions. It requires the unavailable notice, healthy sibling, saved-deals interaction, editable purchase input and independently verified export. After removing the injected response it explicitly reloads and requires recovery. Normal unmodified acceptance still requires zero page errors. The failure-injection tests do not replace or loosen normal acceptance.

## Still open
This closes root-wide failure propagation for the two lazy workspaces. It does not claim to fix the provider's asset-serving behavior, protect failure of the initial entry script, or guarantee all other runtime paths. Asset-delivery diagnosis remains in issue #658.

## Entry document mismatch confirmed
Attempt 1 of public run 38392928323 (artifact 11810541928) requested index-CTszGufm.js, LocalDocumentEvidenceWorkspace-Blj0DJ8R.js and CanonicalCaseWorkspacePanel-do6sw-4g.js while the release manifest reported c22a0ca1cd7ab039a663f3599d4f63458321c6a1. A clean production-metadata build of the preceding d98d712fbea96ed1c1b0ff2f6b771c03cc7e9904 reproduces all three exact filenames. The new c22a0ca build instead uses index-v7ciTZiH.js. Thus the failed page was serving the previous entry graph; it was not testing the new error boundary. Attempt 2 passed all 752 browser checks including fault injection. The precise cache/propagation layer remains unknown.

The entry document (root and index.html) and release manifest now send Cache-Control: no-store, using the Pages `_headers` configuration documented at https://developers.cloudflare.com/pages/configuration/headers/. This prevents future storage by conforming caches; it cannot retroactively invalidate old responses or override intermediary policies. No global cache changes or asset cache lifetime assumptions are made.

The build emits a source-commit meta tag directly in the entry HTML. Deployment acceptance requires both the manifest and ordinary root URL to match the reviewed commit and carry no-store. The real browser separately checks the loaded HTML identity and public cache header before interacting, then still validates the source in the exported report. No query parameter is added to browser navigation and no browser retry is introduced.
