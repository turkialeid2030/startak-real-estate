# C53 — Private Alpha Source Acquisition Runtime

## Purpose

C53 turns the C52 non-API acquisition plan into executable owner-only PRIVATE_ALPHA acquisition primitives. It does not require an API and does not convert captured data into commercial/public-production authorization.

## Executable paths

- Direct HTTPS retrieval for governed public provider domains.
- Official file download.
- Sitemap/RSS retrieval.
- Browser-rendered capture through an injected browser adapter.
- User-authorized authenticated browser capture.
- User-authorized export/manual upload/manual-assisted capture.

A CLI is available through `npm run private-alpha:acquire -- ...` for governed HTTPS/file/browser acquisition. Authenticated browser use requires a local Playwright storage-state file plus the explicit `--authorized-session yes` acknowledgement. Session files are not stored in the repository.

## Runtime controls

Public HTTP retrieval is fail-closed around:

- HTTPS-only provider URLs;
- canonical source-provider/domain binding;
- manual redirect following with provider-domain revalidation on every hop;
- bounded response size;
- content-type allowlist;
- request timeout;
- no Authorization or Cookie headers in public mode;
- SHA-256 artifact hashing and retrieval timestamp.

Browser adapters are contract-bound to prohibit credential bypass, CAPTCHA bypass, access-control evasion and rate-limit evasion. Authenticated capture requires an explicitly user-authorized session.

## Provenance

Each acquisition produces a provenance envelope containing source provider, source URL, final URL, method, retrieval timestamp, byte length and SHA-256 artifact hash. The envelope is designed to hand off to the existing C2N/C2S evidence/provenance controls.

## Boundary

C53 captures evidence for personal/private-alpha testing. It does not establish source-rights approval, commercial reuse authority, certified valuation, transaction authority, approval authority or public deployment authority.
