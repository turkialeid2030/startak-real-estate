# STATIC_HOSTING_REQUIREMENTS

- HTTPS: mandatory
- Serving: static files from `dist/` only -- no backend/server-side runtime required
- MIME types: standard (`.js` → `text/javascript`, `.css` → `text/css`, `index.html` → `text/html`)
- SPA fallback: NOT required -- this application has no client-side routing (single page, tab-based navigation within one document)
- Directory listing: must be disabled
- Compression: gzip/brotli recommended (JS bundle 624KB uncompressed)
- Cache: hashed asset filenames (`index-<hash>.js`/`.css`) support long-lived immutable caching; `index.html` itself should use a short/no-cache policy
- Security headers: see `CSP_POLICY` below (provider-neutral; no host has been chosen or authorized)

STATIC_DEPLOYMENT_ARTIFACT = PASS (fresh `dist/` rebuilt this session: static-only, 0 source maps, 0 secrets, 0 absolute paths, 0 remote fonts, 0 unclassified network dependency)
