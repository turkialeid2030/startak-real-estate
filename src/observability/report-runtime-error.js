// src/observability/report-runtime-error.js -- privacy-minimized live provider
// The application emits only a strict allowlisted envelope; no Saved Deal
// payloads, financial inputs, project/user content, cookies, request bodies, or
// raw exception stacks are sent by this module.

const { getBuildMetadata } = require('../runtime/build-metadata.js');

const ALLOWED_ENVELOPE_FIELDS = Object.freeze(['appVersion', 'buildHash', 'timestamp', 'category', 'message', 'surface', 'locale']);
const SENTRY_DSN = 'https://bd62d30796feffcafda5b70c53c72604@o4512003775004672.ingest.de.sentry.io/4512003802005584';
const SENTRY_INGEST_HOST = 'o4512003775004672.ingest.de.sentry.io';

const CATEGORIES = Object.freeze({
  window_error:'Runtime error',
  unhandled_rejection:'Unhandled rejection',
  'workspace-unavailable':'Supplementary workspace unavailable',
  unknown:'STARTAK runtime error',
});
const SURFACES = new Set(['global','documents','canonical','local-urban-growth','local-asset-efficiency','local-policy-shock']);
function sanitizeEnvelope(raw) {
  // Drop arbitrary values, not just unknown field names. Exception messages
  // may contain document text, financial inputs, URLs or identity data.
  const build = getBuildMetadata();
  const category = typeof raw?.category==='string'&&Object.hasOwn(CATEGORIES,raw.category)?raw.category:'unknown';
  return {
    appVersion:/^\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]{1,64})?$/.test(build.appVersion)?build.appVersion:'unknown',
    buildHash:/^[a-f0-9]{40}$/.test(build.sourceCommit||'')?build.sourceCommit:'unverified',
    timestamp:new Date().toISOString(),
    category,
    message:CATEGORIES[category],
    surface:SURFACES.has(raw?.surface)?raw.surface:'unknown',
    locale:['ar-SA','en'].includes(raw?.locale)?raw.locale:'unknown',
  };
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
          const envelope=sanitizeEnvelope(event?.tags);
          const safeTags=Object.fromEntries(['appVersion','buildHash','category','surface','locale'].map(k=>[k,envelope[k]]));
          const safeMessage=envelope.message;
          return {
            event_id: event?.event_id,
            timestamp: event?.timestamp,
            platform: 'javascript',
            level: 'error',
            message: safeMessage,
            tags: safeTags,
            extra: { reportedAt: envelope.timestamp },
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
    const envelope = sanitizeEnvelope(event);
    sendToProvider(envelope);
  } catch (e) {
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
  ALLOWED_ENVELOPE_FIELDS,
  SENTRY_INGEST_HOST,
};
