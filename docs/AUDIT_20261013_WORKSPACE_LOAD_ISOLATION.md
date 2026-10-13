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
