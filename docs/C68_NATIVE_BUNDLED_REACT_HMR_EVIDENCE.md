# C68 — Actual React HMR source edit in Vite 8 bundled development

## Risk to address
C67 actual Chromium demonstrated source CommonJS can boot in native Vite 8 experimental bundled development without a browser `require` shim. That startup check alone **does not** establish HMR reliability, preserving React state, or source code edit behavior.

## Executed test methodology
The CI test boots `npm run dev:bundled` against a REAL Vite native dev server, opens genuine Chromium with actual app C64 land institutional HOLD, then:
1. Takes the **real C64 land institutional notice React JSX component** `src/components/LandDevelopmentInstitutionalNotice.jsx` and records original bytes.
2. Changes precisely one visible land-mode Arabic React warning heading to a unique new Arabic phrase on the CI runner's ephemeral working tree.
3. Requires the already-open Chromium page to update the title **without navigating/reloading the document** (a page `load` event would fail the test), while land mode and institutional HOLD remain intact.
4. Restores exact original source in a finally block even on test failure, then tests `git status` for clean production component.
5. Preserves C62–C65 source evidence/financial math, build, canonical release and npm security audit.

No in-product dev injection, injected browser `require`, or modification to persisted deal data; test-only ephemeral source edit is automatically removed.

## Acceptance limitations
- If actual React HMR or HMR preservation fails, leave this stage and issue #632 OPEN and keep dev:bundled explicitly experimental/opt-in.
- Even passing this specific React title HMR experiment proves **only this edit path**; concurrent edits, CSS HMR, sophisticated module cycles, multi-tab state, all-sector source route changes and debugging tools still require a wider matrix before switching `npm run dev` default.
- No externally authenticated Saudi transactions, independent legally licensed appraisal, official reports, human UAT or live production deployment.

## Actual Vite-Tailwind plugin compatibility defect
- The first real JSX edit attempt failed with `[plugin @tailwindcss/vite:generate:serve] TypeError: Cannot read properties of undefined (reading 'environments')`, not a financial calculation error. Upstream acknowledges the exact Vite8 bundledDev `hotUpdate` signature without `options.server`, and the Tailwind fix returns early when no server exists. See https://github.com/tailwindlabs/tailwindcss/issues/20378.
- This candidate adds an **opt-in only** Tailwind plugin wrapper in `vite.config.mjs` for the `--experimental-bundle` CLI. It skips the incompatible `generate:serve` hotUpdate cross-environment loop only when `options.server` is absent. It never replaces the transform/build hooks and does not change normal unbundled dev, production build, engine inputs, source rights, official report authority or persistent records.
- The original C68 test wrongly targeted the unmounted existing-building panel while LAND mode was displayed; later tests edit the **mounted land institutional React notice** instead. Neither test design nor plugin compatibility shall be counted as qualified until exact-head Chromium shows a visible hot update **without reload**.
