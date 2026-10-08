# C66 — Developer availability fallback (native Vite #632 still OPEN)

## Actual evidence, failed attempt
- C63 real Chromium confirmed the Vite 8 native source module browser crashes with `ReferenceError: require is not defined` before React mounts.
- The first C66 attempt to force Vite local CommonJS entry optimization **FAILED** again on real Chromium. CI [run #37761508683](https://github.com/turkialeid2030/startak-real-estate/actions/runs/37761508683) logged `Cannot optimize dependency: @startak-local-app`, empty React root and the original require error. That attempt was reverted and its temporary module removed. **Do not classify it as passed.**

## Deliberately limited operational workaround
- Native `npm run dev` remains unchanged and BROKEN. Root issue #632 stays OPEN.
- New developer-only command: `npm run dev:stable -- --host 127.0.0.1 --port 4174 --strictPort`. Portable Node script `tools/startak-dev-stable.js` starts Vite `build --watch` on the real production module graph and serves the current real bundle via `vite preview`.
- This avoids exposing browser-side global `require`, retains real production-bundle transformations, preserves the financial/math/evidence/security engine and uses explicitly non-authoritative `local-watched-developer-preview` build metadata. Browser manually reloads to see latest changed compiled output; **native Vite HMR IS NOT provided**.
- Exact-head Chromium opens this watched preview and demands real React mount, genuine Arabic scope/legal warning, land institutional C64 HOLD, no uncaught `require` error, and nonauthorizing runtime metadata. CI executes full production build, package/release and npm audit.
- `npm run dev:stable` is a **fallback** for developer usability, NOT a native Vite source CommonJS fix. Further architecturally correct migration to first-class ESM or proven source-transform plugin is required to close #632. Do not silently redirect `npm run dev` to this workaround.

## Exclusions
The fallback does not validate actual Saudi comps, human UAT, professional appraisal, certified reports, eight asset types, C55 development cash-flow integration or production deployment.
