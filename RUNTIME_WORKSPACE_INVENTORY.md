# RUNTIME_WORKSPACE_INVENTORY

- package.json: exists, minimal (name/version/scripts only), NO dependencies section at all -- confirmed by direct read
- lockfile: package-lock.json exists but is a stub (created manually in Wave A for `npm test` to work, does not lock any real package versions)
- react/react-dom: NOT INSTALLED (0 packages in node_modules)
- recharts: NOT INSTALLED
- lucide-react: NOT INSTALLED
- src/app/App.jsx: exists, 1245 lines (post-cutover), imports React/recharts/lucide-react at the top (unchanged original import lines) plus `require('../engines')` (Wave B2 addition)
- src/engines/, src/contracts/, src/modules/, src/registries/, src/i18n/, src/migrations/, src/components/: all exist and populated (confirmed via prior Waves)
- CSS strategy: **App.jsx uses 117 Tailwind `className=` utility attributes but NO CSS file, NO Tailwind config, and NO PostCSS config exist anywhere in the workspace.** The original single-file artifact almost certainly relied on a hosting environment (e.g. an artifact preview sandbox) that injects Tailwind automatically -- this is NOT present in a plain Vite+React setup and must be added for the app to render with intended styling.
- existing test command: `npm test` runs tests/characterization/run_all.js (Node-only, no browser/bundler involved) -- this and all 15 other test/architecture scripts must remain untouched and passing throughout runtime enablement.

CONCLUSION: this is a from-scratch frontend bootstrap, not a repair of broken tooling.
