# REBASE_BUILD_READINESS
BUILD_STATUS = NOT_CONFIGURED (no bundler; this is the immediate post-Rebase task, non-blocking per this Wave's own instructions)
PACKAGE_MANAGER = npm (package.json + package-lock.json exist)
FRONTEND_ENTRYPOINT = src/app/App.jsx (not yet wired to an actual bundler/dev-server)
APP_COMPONENT = App (default export, line ~1245 region)
TEST_COMMAND = npm test (also npm run test:characterization)
KNOWN_RUNTIME_GAPS = no React build pipeline configured; no browser has ever rendered this working copy; all 15 verification scripts run in plain Node.js against the calculation/contract layer only, not the UI layer visually.
