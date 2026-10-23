# N11 — Reproducible public asset-manifest inconsistency, 23 October 2026

## Confirmed observations (do not erase)

1. Owner-authorized deployment run [40031880117](https://github.com/turkialeid2030/startak-real-estate/actions/runs/40031880117) built and uploaded main `a605355e697e9bb4b59b200f18de0d3cd0dd55cb`; the provider control-plane commit matched and HTTP root returned 200.
2. **The first public-byte verification FAILED**, before reading HTML or JS:
   `DEPLOYED_ASSET_BYTES=FAIL ASSET_MANIFEST_SOURCE_INVALID` at
   **2026-10-23T22:13:15.345Z**, recorded in artifact ID **12535262482**
   (`deployed-assets.json`; SHA input bound). The file provided only code,
   expected SHA, observation time and no automatic retries.
3. This is a direct case of **control-plane deployment identity not implying
   public manifest identity**. The failed verifier refuses both wrong source
   and invalid schema/asset lists under the same coarse reason code. At this
   point the *actual observed manifest source* and Cloudflare ray are **not**
   recorded by the old verifier; don't infer which old commit was delivered.
4. A later N11 six-sample window succeeded on the same SHA. This is *additional
   bounded delivery evidence*, not a replacement for the earlier FAIL.
   These tests do not establish provider-side CDN root cause.

## Improvement under review

The verifier's mismatch path now retains on FIRST failed observation:
`observedAssetManifestSourceCommit` (only if well-formed),
`manifestSha256`, byte length, schema version, asset count, bounded
`cf-ray` / `cf-cache-status` / `cache-control` / `age` response
metadata and timestamps. It never persists manifest bodies, private document
bytes, request tokens or cookies and makes **zero automatic retries**. A
single failed observation remains FAILED regardless of later successes.

## Provider/operator evidence required for final closure

Obtain deployment ID and exact published artifact route, data-center/edge
routing corresponding to each observed `cf-ray`, cache purge and
propagation logs, origin/object version and conditional request behavior,
HTTP response headers for both contemporaneous and failed observations,
whether the same URL temporarily routed to a prior manifest or invalid
build, and corrective action with a bounded multi-region counterexample
test. No independent physical CDN PoP diversity claim arises from two
GitHub runners alone. Until causal proof + corrected deployment is
independently confirmed, **N11 is OPEN** even if a rerun passes.

This is separate from commercial/go-live licensing and N03/N06/N12 gates.
