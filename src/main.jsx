import './index.css';
import React, {lazy,Suspense} from 'react';
import AssetSupportPanel from './components/AssetSupportPanel.jsx';
import ReactDOM from 'react-dom/client';
import App from './app/App.jsx';
const LocalDocumentEvidenceWorkspace=lazy(()=>import('./components/LocalDocumentEvidenceWorkspace.jsx'));
import ComplianceBoundaryNotice from './components/ComplianceBoundaryNotice.jsx';
import ExitCapGuidanceEnhancer from './components/ExitCapGuidanceEnhancer.jsx';
const CanonicalCaseWorkspacePanel=lazy(()=>import('./components/CanonicalCaseWorkspacePanel.jsx'));
import StrictArabicSurfaceGuard from './components/StrictArabicSurfaceGuard.jsx';
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
      <AssetSupportPanel />
      <App />
      <ExitCapGuidanceEnhancer />
      <Suspense fallback={<p role="status" className="p-4 text-slate-200">جارٍ تحميل مساحات المستندات والحالة…</p>}>
        <LocalDocumentEvidenceWorkspace />
        <CanonicalCaseWorkspacePanel />
      </Suspense>
      <StrictArabicSurfaceGuard />
    </LocaleProvider>
  </React.StrictMode>
);
