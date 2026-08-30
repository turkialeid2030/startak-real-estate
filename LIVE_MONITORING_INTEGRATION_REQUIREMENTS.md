# LIVE_MONITORING_INTEGRATION_REQUIREMENTS

APPLICATION_OBSERVABILITY_HOOKS = PASS (`src/observability/report-runtime-error.js`, wired into `main.jsx`, catches `window.onerror` + `unhandledrejection`)
TELEMETRY_SENSITIVE_PAYLOAD_FIELDS = 0 (confirmed: `sanitizeEnvelope()` strips any field not in the 8-field allowlist)
PRODUCTION_MONITORING_PROVIDER = NOT_CONFIGURED

## Safe event schema (already implemented, provider-agnostic)
```
{ appVersion, buildHash, timestamp, category, message (≤500 chars), surface, locale, userAgent }
```
Never included: Saved Deal records, financial inputs, project titles/user content, localStorage dumps, credentials, raw stack traces with local paths.

## Integration point
Implement `sendToProvider(envelope)` in `report-runtime-error.js` -- currently a console-safe no-op. No vendor (Sentry/Datadog/etc.) is hardcoded or assumed; none is authorized in this environment.
