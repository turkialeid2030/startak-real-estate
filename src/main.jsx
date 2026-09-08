import './index.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './app/App.jsx';
import LocalDocumentEvidenceWorkspace from './components/LocalDocumentEvidenceWorkspace.jsx';
import ComplianceBoundaryNotice from './components/ComplianceBoundaryNotice.jsx';
import ExitCapGuidanceEnhancer from './components/ExitCapGuidanceEnhancer.jsx';
import CanonicalCaseWorkspacePanel from './components/CanonicalCaseWorkspacePanel.jsx';
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
// Governance-grade records are never read from ambient window globals. The
// canonical workspace below is the first explicit in-app route from validated
// Saved Deals + explicit project/case classification into a scoped canonical
// ExecutableInvestmentCase. Decision Intelligence may render only from that
// local canonical route. Investment Committee, action-review, outcome-feedback
// and learning remain disabled until they receive an equivalent controlled path.
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <LocaleProvider defaultLocale="ar-SA">
      <ComplianceBoundaryNotice />
      <App />
      <ExitCapGuidanceEnhancer />
      <LocalDocumentEvidenceWorkspace />
      <CanonicalCaseWorkspacePanel />
    </LocaleProvider>
  </React.StrictMode>
);
