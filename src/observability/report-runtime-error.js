// src/observability/report-runtime-error.js -- privacy-minimized live provider
// The application emits only a strict allowlisted envelope; no Saved Deal
// payloads, financial inputs, project/user content, cookies, request bodies, or
// raw exception stacks are sent by this module.

const { getBuildMetadata } = require('../runtime/build-metadata.js');

const ALLOWED_ENVELOPE_FIELDS = ['appVersion', 'buildHash', 'timestamp', 'category', 'message', 'surface', 'locale', 'userAgent'];
const SENTRY_DSN = 'https://bd62d30796feffcafda5b70c53c72604@o4512003775004672.ingest.de.sentry.io/4512003802005584';
const SENTRY_INGEST_HOST = 'o4512003775004672.ingest.de.sentry.io';

function sanitizeEnvelope(raw) {
  const safe = {};
  for (const key of ALLOWED_ENVELOPE_FIELDS) if (key in raw) safe[key] = raw[key];
  return safe;
}

let reportInFlight = false;
let sentryClientPromise = null;

function loadSentryClient() {
  if (!sentryClientPromise) {
    sentryClientPromise = import('@sentry/react').then((Sentry) => {
      const build = getBuildMetadata();
      Sentry.init({
        dsn: SENTRY_DSN,
        environment: build.buildEnvironment,
        release: build.buildId,
        sendDefaultPii: false,
        defaultIntegrations: false,
        attachStacktrace: false,
        beforeSend(event) {
          const safeTags = {};
          for (const key of ['appVersion', 'buildHash', 'category', 'surface', 'locale']) {
            const value = event?.tags?.[key];
            if (value != null) safeTags[key] = String(value).slice(0, 200);
          }
          const safeMessage = typeof event?.message === 'string'
            ? event.message.slice(0, 500)
            : 'STARTAK runtime error';
          return {
            event_id: event?.event_id,
            timestamp: event?.timestamp,
            platform: 'javascript',
            level: 'error',
            message: safeMessage,
            tags: safeTags,
            extra: event?.extra?.reportedAt ? { reportedAt: String(event.extra.reportedAt).slice(0, 64) } : undefined,
            environment: build.buildEnvironment,
            release: build.buildId,
          };
        },
      });
      return Sentry;
    });
  }
  return sentryClientPromise;
}

function sendToProvider(envelope) {
  loadSentryClient()
    .then((Sentry) => {
      Sentry.withScope((scope) => {
        for (const key of ['appVersion', 'buildHash', 'category', 'surface', 'locale']) {
          if (envelope?.[key] != null) scope.setTag(key, String(envelope[key]).slice(0, 200));
        }
        if (envelope?.timestamp) scope.setExtra('reportedAt', String(envelope.timestamp).slice(0, 64));
        Sentry.captureMessage((envelope?.message || 'STARTAK runtime error').slice(0, 500), 'error');
      });
    })
    .catch(() => {
      // Monitoring must never crash or block the application.
    });
}

function reportRuntimeError(event) {
  if (reportInFlight) return;
  reportInFlight = true;
  try {
    const build = getBuildMetadata();
    const envelope = sanitizeEnvelope({
      appVersion: build.appVersion,
      buildHash: build.sourceCommit || build.buildId,
      timestamp: new Date().toISOString(),
      category: event?.category || 'unknown',
      message: (event?.message || '').slice(0, 500),
      surface: event?.surface,
      locale: event?.locale,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
    });
    sendToProvider(envelope);
  } catch (e) {
    // Telemetry must never crash the app it is reporting about.
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

module.exports = {
  reportRuntimeError,
  installGlobalHandlers,
  sanitizeEnvelope,
  ALLOWED_ENVELOPE_FIELDS,
  SENTRY_INGEST_HOST,
};
