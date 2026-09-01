# Advanced Runtime Data Boundary v1

Governance-grade Decision Intelligence, Investment Committee, action-review, outcome-feedback, and learning records must not be sourced from ambient browser globals.

The previous `window.__STARTAK_*__` mounting path was removed because browser console/script mutation is not an authenticated, attributable, case-scoped data boundary. Advanced panels remain implemented in the codebase, but they must only be mounted through a future explicit in-app data path that validates scope, provenance, authorization, and record integrity before rendering.

This change does not claim that an authenticated backend integration already exists. It deliberately prefers an unavailable advanced panel over displaying mutable browser-injected governance records as if they were authoritative.
