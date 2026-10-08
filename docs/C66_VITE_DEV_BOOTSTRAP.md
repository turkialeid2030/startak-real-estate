# C66 — Real development server CommonJS bridge (#632)

## Observed reproducible root cause
C63 actual Chromium showed empty React root in Vite dev mode due to browser `ReferenceError: require is not defined` when serving `src/main.jsx` and source CommonJS directly. Production Vite build+preview passed separately (C63/C64), so relying on `npm run build` alone concealed the development server defect.

## Bounded fix
- The Vite **serve-only** `startak-dev-local-commonjs-bridge` chooses a tiny ESM `src/dev-bridge-entry.mjs` for the index module.
- That ESM module imports an explicit optimized local source dependency `@startak-local-app`, aliased to the unchanged real `src/main.jsx`. Vite's built-in Rolldown dependency optimizer performs CommonJS interop as a whole graph, instead of placing a fake `require` on `window`. No one changes `src/engines` or stores user data globally.
- Production build continues to use the original `src/main.jsx` entry. The dev optimizer is forced to update when starting the server; HMR/source editing conformance must be verified separately and cannot be inferred from startup tests.
- Exact head action runs **npm run dev**, installs Chromium, and requires real Arabic root, configured locale, legal scope warning and land/development institutional HOLD. A separate production build/release/security regression must remain PASS.

## Final acceptance
C66 is not technically qualified merely because this file exists: only real dev Chromium success and release CI at exact SHA can close the reproducible startup defect. It is not professional appraisal, external market source authentication or broader C64 specialist/report/browser coverage.
