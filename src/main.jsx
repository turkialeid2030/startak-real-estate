import './index.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './app/App.jsx';
import ComplianceBoundaryNotice from './components/ComplianceBoundaryNotice.jsx';
import ExitCapGuidanceEnhancer from './components/ExitCapGuidanceEnhancer.jsx';
import IntegratedCaseReviewPanel from './components/IntegratedCaseReviewPanel.jsx';
import StrictArabicSurfaceGuard from './components/StrictArabicSurfaceGuard.jsx';
const { LocaleProvider } = require('./i18n/LocaleContext.js');
const { installRuntimeBuildMetadata } = require('./runtime/build-metadata.js');
const { installGlobalHandlers } = require('./observability/report-runtime-error.js');
const { activateCustomerFacingVerdictPresentation } = require('./app/compliance-verdict-presentation.js');

// Post-C30 bundle hardening: these supplementary governed workspaces are split
// into independent production chunks. They still mount automatically and retain
// exactly the same authority/data boundaries; code splitting changes only load
// timing, not calculation, evidence, review or authorization semantics.
const LocalDocumentEvidenceWorkspace = React.lazy(() => import('./components/LocalDocumentEvidenceWorkspace.jsx'));
const CanonicalCaseWorkspacePanel = React.lazy(() => import('./components/CanonicalCaseWorkspacePanel.jsx'));

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
      <React.Suspense fallback={null}>
        <LocalDocumentEvidenceWorkspace />
      </React.Suspense>
      <React.Suspense fallback={null}>
        <CanonicalCaseWorkspacePanel />
      </React.Suspense>
      <IntegratedCaseReviewPanel />
      <StrictArabicSurfaceGuard />
    </LocaleProvider>
  </React.StrictMode>
);
