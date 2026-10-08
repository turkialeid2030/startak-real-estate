# C67 — Native Vite 8 experimental bundled development (actual browser)

## Why this is different from C66
The standard native `vite` source server loaded repo-owned static CommonJS `require` directly in the browser and raised `ReferenceError: require is not defined` (issue #632). The first C66 local-dependency optimizer attempt failed, and the C66 `dev:stable` recovery provides only watched production-build+preview with manual reload. That is not native Vite developer hot-update semantics.

Vite v8.1+ provides an **experimental native bundled development mode** via documented `--experimental-bundle` or `experimental.bundledDev: true`, using Rolldown for the browser graph and retaining a native Vite development server rather than preview. This C67 trial adds an **opt-in** `npm run dev:bundled -- --host 127.0.0.1 --port 4175` command. Normal `npm run dev` remains unchanged until independent browser and live-edit HMR evidence support replacing it.

## Actual CI acceptance
- Real Chromium visits the actual server on 4175, mounts app's real React root, sees Arabic scope warning, C64 land institutional HOLD and four blockers, and confirms browser `window.require` is **not** injected.
- The real app emits a Vite client module request (not production preview); no browser script exception or failed network request.
- Then original C62-C65 financial/decision regressions, production build, package, release and npm audit must PASS on the exact candidate head.
- CI **must not** treat committing a Vite flag as PASS; behavior must be evidenced by the actual Chromium run.
- Native bundled mode is experimental and has plugin interoperability limitations, notably React and Tailwind transformations. If CI fails, preserve as a negative finding. No claimed HMR edit/reload acceptance unless separate source-edit test succeeds.

## Scope limitations
No independent source authentication, lawful Saudi executed sales, professional appraisal licensing, report issuance, eight-sector complete UAT, production deploy, or transaction permission is established. No user input or external data is sent by this trial. Source code of numerical engines and hard evidence gates is unchanged.
