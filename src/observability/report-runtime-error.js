// src/observability/report-runtime-error.js -- PR-11: provider-agnostic
// client error reporting boundary. Currently wired to a console-safe no-op
// provider only -- no live monitoring backend is configured (none exists in
// this environment; none is fabricated here). Swapping in a real provider
// later means implementing sendToProvider() without touching call sites.

const ALLOWED_ENVELOPE_FIELDS = ['appVersion', 'buildHash', 'timestamp', 'category', 'message', 'surface', 'locale', 'userAgent'];

function sanitizeEnvelope(raw) {
  const safe = {};
  for (const key of ALLOWED_ENVELOPE_FIELDS) if (key in raw) safe[key] = raw[key];
  return safe; // never Saved Deal records, never financial inputs, never project titles/user content, never raw stack with local paths
}

let reportInFlight = false; // guards against recursive/looping reports if the provider itself throws

function sendToProvider(envelope) {
  // NOOP / console-safe development provider. No live monitoring backend is
  // configured in this environment -- this intentionally does not call any
  // external endpoint. Swap this function's body when a real provider is
  // authorized and configured.
  try { console.info('[runtime-error-report]', envelope); } catch (e) { /* never let the provider itself crash the app */ }
}

function reportRuntimeError(event) {
  if (reportInFlight) return; // avoid recursive reporting loops
  reportInFlight = true;
  try {
    const envelope = sanitizeEnvelope({
      appVersion: typeof window !== 'undefined' ? window.__STARTAK_BUILD_ID__ : undefined,
      timestamp: new Date().toISOString(),
      category: event?.category || 'unknown',
      message: (event?.message || '').slice(0, 500),
      surface: event?.surface,
      locale: event?.locale,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
    });
    sendToProvider(envelope);
  } catch (e) {
    // Telemetry must never crash the app it's trying to report about.
  } finally {
    reportInFlight = false;
  }
}

function installGlobalHandlers() {
  if (typeof window === 'undefined') return;
  window.addEventListener('error', (e) => {
    reportRuntimeError({ category: 'window_error', message: e?.message, surface: 'global' });
  });
  window.addEventListener('unhandledrejection', (e) => {
    reportRuntimeError({ category: 'unhandled_rejection', message: String(e?.reason?.message || e?.reason || 'unknown'), surface: 'global' });
  });
}

module.exports = { reportRuntimeError, installGlobalHandlers, sanitizeEnvelope, ALLOWED_ENVELOPE_FIELDS };
