# Startak C63 — Vite native developer boot and React HMR (26 October 2026)

## Verified problem
The former `npm run dev` ran native unbundled Vite 8, which sent repo-owned JSX/CommonJS `require` to the browser and failed with `ReferenceError: require is not defined`. This must never be hidden behind passing production-build tests.

## Developer usage
- `npm run dev`: native Vite 8 **experimental bundled** dev server, with actual browser React HMR.
- `npm run dev:bundled`: explicit alias for that identical mode.
- `npm run dev:unbundled-diagnostic`: legacy native unbundled mode, retained strictly to investigate CommonJS/ESM migration, **known not qualified to boot**.
- `npm run build`, `npm run preview`: regular production build and preview, unchanged.

The only compatibility wrapper in `vite.config.js` runs when Vite is invoked with `--experimental-bundle` and protects the Tailwind `@tailwindcss/vite:generate:serve` hot-update hook from Vite's reduced event missing a server. It does not inject `window.require`, disable project financial checks, or change production compilation.

## Actual CI gate
`tests/e2e/run_c63_current_native_dev_hmr_browser.js` launches **npm run dev**, then a genuine Chromium session against that server. It requires the actual AR/RTL app and all 13 property types, a real LAND study blocked on absent evidence, no fake browser require, a real source JSX modification reflected without full-page load, HOLD preserved, byte-for-byte restoration, and no page exceptions. A separate workflow runs this and canonical `npm run release:verify` on the exact branch SHA.

A single route/source edit with Chromium does not establish all-module HMR parity, CSS hot reload across environments, developer productivity across devices, or compliance. Any future plugin/Vite upgrade must rerun the real gate. Professionally accredited appraisal, market data rights, production AI models, multi-tenant authorization and final buy decisions remain separately HOLD.
