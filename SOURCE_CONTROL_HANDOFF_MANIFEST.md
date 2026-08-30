# SOURCE_CONTROL_HANDOFF_MANIFEST

GIT_REPOSITORY_CURRENT_STATE = NOT_PRESENT (no `.git` directory exists)
GIT_INIT = NOT_PERFORMED (per explicit instruction, to avoid any ambiguity around the NO_COMMIT boundary)
SOURCE_CONTROL_PACKAGE_PREPARED = TRUE

## Must be version-controlled
`src/`, `tests/`, `tools/`, `package.json`, `package-lock.json`, `vite.config.js`, `index.html`, `.gitignore`, all `*.md` reports/manifests in the repository root, `tests/reference/`, `tests/fixtures/`, `tests/config/`.

## Must NOT be version-controlled
`node_modules/`, `dist/`, any local caches, Playwright temp artifacts, screenshots not explicitly required, `.DS_Store`/OS files -- all enforced by `.gitignore` (created this session).

## Entrypoint / commands
- Entry: `src/main.jsx`
- Install: `npm ci` (uses the committed lockfile)
- Build: `npm run build`
- Test: the 79 permanent files under `tests/{characterization,architecture,defects,runtime,i18n,saved-deals}/`
- Package verify: `npm run verify:package`
- **Canonical release gate (CI must call this)**: `npm run release:verify`

## Canonical original protection
SHA-256 (immutable reference, not part of the deployable app):
`ac0767d3f13c463259f401a5d7af06c1140ee780a9f86489eb17ad9d7c72dc71`

## Node/npm expectation
Node 18+ (ES modules, `crypto` module used in `tools/release-verify.js`).
