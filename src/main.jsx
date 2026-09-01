import './index.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './app/App.jsx';
import LocalDocumentEvidenceWorkspace from './components/LocalDocumentEvidenceWorkspace.jsx';
const { LocaleProvider } = require('./i18n/LocaleContext.js');
const { installRuntimeBuildMetadata } = require('./runtime/build-metadata.js');
const { installGlobalHandlers } = require('./observability/report-runtime-error.js');
const { activateCustomerFacingVerdictPresentation } = require('./app/compliance-verdict-presentation.js');

// Install source-bound, immutable diagnostic metadata before any observability
// handlers. This does not authorize or certify a deployment.
installRuntimeBuildMetadata();
activateCustomerFacingVerdictPresentation();
installGlobalHandlers(); // privacy-minimized live Sentry provider

// SECURITY / INTEGRITY BOUNDARY:
// Governance-grade Decision Intelligence, Investment Committee, action-review,
// outcome-feedback and learning records are deliberately NOT read from ambient
// window globals. Browser console/script mutation is not an authenticated data
// boundary. Those panels may only be re-enabled through an explicit in-app data
// path that provides scoped, validated and attributable records.
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <LocaleProvider defaultLocale="ar-SA">
      <App />
      <LocalDocumentEvidenceWorkspace />
    </LocaleProvider>
  </React.StrictMode>
);
