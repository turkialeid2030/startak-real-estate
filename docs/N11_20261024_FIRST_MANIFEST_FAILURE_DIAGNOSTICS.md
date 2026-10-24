# N11 — manifest first-response failure evidence (2026-10-24)

## Background

Production run #40031880117 had **an actual failed public byte observation**:
`ASSET_MANIFEST_SOURCE_INVALID` despite the provider claiming an exact
control-plane deployment. PR #711 started recording observed source, digest
and cache headers for valid JSON with the wrong source/schema.

Other materially distinct first-failure scenarios remained as bare error
codes: HTTP 404, Cloudflare HTML fallback with HTTP 200/MIME HTML, invalid JSON,
oversized manifest or an invalid manifest entry. Those paths lost the
observable response status, CDN ray, MIME, byte digest and capture time, so
a later passing sample could not explain whether the failure came from a
mixed deployment, fallback, stale edge or malformed bytes.

## Changed engineering boundary

The existing `verifyDeployedAssets` remains **one no-retry** observation.
For all five manifest classes, it now records only:
- exact expected main SHA; observed well-formed source SHA if available;
- error code and index for a malformed manifest entry, no path or object;
- response HTTP status, bounded Content-Type, `cf-ray`,
  `cf-cache-status`, cache-control, age, server and capture time;
- SHA-256 of the observed manifest bytes, byte count, bounded schema/count;
- `automaticRetries=0` and `status=FAIL`.

It does not serialize response bodies, HTML, manifest JSON, personal
documents, tokens, cookies or full request URLs, and does not auto-retry.
The sample remains FAIL even if the next sample is PASS.

## Closed vs not closed

**Closed after verifiable exact-SHA CI, merge and published acceptance:**
this specific diagnosis blind spot for manifest HTTP/MIME/JSON/schema/entry
failures.

**Still OPEN:** the actual CDN/source mismatch root cause (N11). Requires
Cloudflare/operator request logs correlated with `cf-ray`, origin object
version, deployment ID, edge cache status at failure, provider analysis,
remediation and bounded independent reproducibility testing. Neither a
zero-failure later run nor diagnostic code proves that a historical
failure was corrected.

N03/N06 official licensed Saudi market records and independent quantitative
valuation verification; N12 enterprise identity, storage, backup/DR and
licensed professional approval also remain separate external gates.
