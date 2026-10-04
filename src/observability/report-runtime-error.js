// src/observability/report-runtime-error.js -- privacy-minimized live provider
// Only a bounded, non-user-content envelope may leave the browser. Raw error
// messages, rejection reasons, Saved Deal payloads, financial inputs, project
// content, cookies, request bodies, user-agent strings, and stack traces are not
// transmitted by this module.

const { getBuildMetadata } = require('../runtime/build-metadata.js');

const ALLOWED_ENVELOPE_FIELDS = ['appVersion', 'buildHash', 'timestamp', 'category', 'message', 'surface', 'locale'];
const SAFE_PROVIDER_MESSAGES = Object.freeze({
  window_error: 'STARTAK window error',
  unhandled_rejection: 'STARTAK unhandled rejection',
});
const SENTRY_DSN = 'https://bd62d30796feffcafda5b70c53c72604@o4512003775004672.ingest.de.sentry.io/4512003802005584';
const SENTRY_INGEST_HOST = 'o4512003775004672.ingest.de.sentry.io';

function safeToken(value, fallback = '') {
  const normalized = typeof value === 'string' ? value.trim() : '';
  return /^[A-Za-z0-9_.:-]{1,64}$/.test(normalized) ? normalized : fallback;
}

function safeProviderMessage(category) {
  return SAFE_PROVIDER_MESSAGES[category] || 'STARTAK runtime error';
}

function safeTimestamp(value) {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) return undefined;
  return new Date(value).toISOString();
}

function sanitizeEnvelope(raw = {}) {
  const category = safeToken(raw.category, 'unknown');
  const safe = {
    category,
    message: safeProviderMessage(category),
  };

  const appVersion = safeToken(raw.appVersion);
  const buildHash = safeToken(raw.buildHash);
  const timestamp = safeTimestamp(raw.timestamp);
  const surface = safeToken(raw.surface);
  const locale = safeToken(raw.locale);

  if (appVersion) safe.appVersion = appVersion;
  if (buildHash) safe.buildHash = buildHash;
  if (timestamp) safe.timestamp = timestamp;
  if (surface) safe.surface = surface;
  if (locale) safe.locale = locale;

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
            const fallback = key === 'category' ? 'unknown' : '';
            const value = safeToken(event?.tags?.[key], fallback);
            if (value) safeTags[key] = value;
          }
          const category = safeTags.category || 'unknown';
          return {
            event_id: event?.event_id,
            timestamp: event?.timestamp,
            platform: 'javascript',
            level: 'error',
            message: safeProviderMessage(category),
            tags: safeTags,
            extra: event?.extra?.reportedAt ? { reportedAt: safeTimestamp(String(event.extra.reportedAt)) } : undefined,
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
  const safeEnvelope = sanitizeEnvelope(envelope);
  loadSentryClient()
    .then((Sentry) => {
      Sentry.withScope((scope) => {
        for (const key of ['appVersion', 'buildHash', 'category', 'surface', 'locale']) {
          if (safeEnvelope[key] != null) scope.setTag(key, safeEnvelope[key]);
        }
        if (safeEnvelope.timestamp) scope.setExtra('reportedAt', safeEnvelope.timestamp);
        Sentry.captureMessage(safeEnvelope.message, 'error');
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
      surface: event?.surface,
      locale: event?.locale,
    });
    sendToProvider(envelope);
  } catch (_) {
    // Telemetry must never crash the app it is reporting about.
  } finally {
    reportInFlight = false;
  }
}

function installGlobalHandlers() {
  if (typeof window === 'undefined') return;
  window.addEventListener('error', () => {
    reportRuntimeError({ category: 'window_error', surface: 'global' });
  });
  window.addEventListener('unhandledrejection', () => {
    reportRuntimeError({ category: 'unhandled_rejection', surface: 'global' });
  });
}

module.exports = {
  reportRuntimeError,
  installGlobalHandlers,
  sanitizeEnvelope,
  safeProviderMessage,
  safeToken,
  ALLOWED_ENVELOPE_FIELDS,
  SAFE_PROVIDER_MESSAGES,
  SENTRY_INGEST_HOST,
};
