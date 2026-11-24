import './index.css';
import React, {lazy,Suspense} from 'react';
import WorkspaceErrorBoundary from './components/WorkspaceErrorBoundary.jsx';
import {AppraisalReviewSessionProvider} from './components/AppraisalReviewSessionContext.jsx';
import {PersonalCaseSessionProvider} from './components/PersonalCaseSessionContext.jsx';
import AssetSupportPanel from './components/AssetSupportPanel.jsx';
import ReactDOM from 'react-dom/client';
import App from './app/App.jsx';
const LocalDocumentEvidenceWorkspace=lazy(()=>import('./components/LocalDocumentEvidenceWorkspace.jsx'));
import ComplianceBoundaryNotice from './components/ComplianceBoundaryNotice.jsx';
import ExitCapGuidanceEnhancer from './components/ExitCapGuidanceEnhancer.jsx';
const CanonicalCaseWorkspacePanel=lazy(()=>import('./components/CanonicalCaseWorkspacePanel.jsx'));
const LocalDepreciationReviewPanel=lazy(()=>import('./components/LocalDepreciationReviewPanel.jsx'));
const LocalQuotedFinancingPanel=lazy(()=>import('./components/LocalQuotedFinancingPanel.jsx'));
const LocalIncomeAssetReviewPanel=lazy(()=>import('./components/LocalIncomeAssetReviewPanel.jsx'));
const LocalMarketIndicatorPanel=lazy(()=>import('./components/LocalMarketIndicatorPanel.jsx'));
const LocalPolicyShockReviewPanel=lazy(()=>import('./components/LocalPolicyShockReviewPanel.jsx'));
const LocalUrbanGrowthReviewPanel=lazy(()=>import('./components/LocalUrbanGrowthReviewPanel.jsx'));
const LocalAssetEfficiencyPanel=lazy(()=>import('./components/LocalAssetEfficiencyPanel.jsx'));
const LocalSupplementalResearchPanel=lazy(()=>import('./components/LocalSupplementalResearchPanel.jsx'));
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
// local canonical route. Institutional Investment Committee, action-review, outcome-feedback
// and learning remain disabled until they receive an equivalent controlled path.
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <LocaleProvider defaultLocale="ar-SA">
      <AppraisalReviewSessionProvider>
      <PersonalCaseSessionProvider>
      <div className="owner-advanced-only">
      <ComplianceBoundaryNotice />
      <AssetSupportPanel />
      </div>
      <App />
      <div className="owner-advanced-only">
      <ExitCapGuidanceEnhancer />
      <WorkspaceErrorBoundary surface="documents">
        <Suspense fallback={<p role="status" className="p-4 text-slate-200">جارٍ تحميل مساحة المستندات…</p>}>
          <LocalDocumentEvidenceWorkspace />
        </Suspense>
      </WorkspaceErrorBoundary>
      <WorkspaceErrorBoundary surface="local-depreciation">
        <Suspense fallback={<p role="status" className="p-4 text-slate-200">جارٍ تحميل مراجعة الإهلاك…</p>}>
          <div className="mx-auto w-full max-w-7xl px-4"><LocalDepreciationReviewPanel /></div>
        </Suspense>
      </WorkspaceErrorBoundary>
      <WorkspaceErrorBoundary surface="local-financing">
        <Suspense fallback={<p role="status" className="p-4 text-slate-200">…</p>}>
          <div className="mx-auto w-full max-w-7xl px-4"><LocalQuotedFinancingPanel /></div>
        </Suspense>
      </WorkspaceErrorBoundary>
      <WorkspaceErrorBoundary surface="local-income-review">
        <Suspense fallback={<p role="status" className="p-4 text-slate-200">…</p>}>
          <div className="mx-auto w-full max-w-7xl px-4"><LocalIncomeAssetReviewPanel /></div>
        </Suspense>
      </WorkspaceErrorBoundary>
      <WorkspaceErrorBoundary surface="local-market-indicators">
        <Suspense fallback={<p role="status" className="p-4 text-slate-200">…</p>}>
          <div className="mx-auto w-full max-w-7xl px-4"><LocalMarketIndicatorPanel /></div>
        </Suspense>
      </WorkspaceErrorBoundary>
      <WorkspaceErrorBoundary surface="local-policy-shock">
        <Suspense fallback={<p role="status" className="p-4 text-slate-200">…</p>}>
          <div className="mx-auto w-full max-w-7xl px-4"><LocalPolicyShockReviewPanel /></div>
        </Suspense>
      </WorkspaceErrorBoundary>
      <WorkspaceErrorBoundary surface="local-urban-growth">
        <Suspense fallback={<p role="status" className="p-4 text-slate-200">…</p>}>
          <div className="mx-auto w-full max-w-7xl px-4"><LocalUrbanGrowthReviewPanel /></div>
        </Suspense>
      </WorkspaceErrorBoundary>
      <WorkspaceErrorBoundary surface="local-asset-efficiency">
        <Suspense fallback={<p role="status" className="p-4 text-slate-200">…</p>}>
          <div className="mx-auto w-full max-w-7xl px-4"><LocalAssetEfficiencyPanel /></div>
        </Suspense>
      </WorkspaceErrorBoundary>
      <WorkspaceErrorBoundary surface="local-supplemental-finance">
        <Suspense fallback={<p role="status" className="p-4 text-slate-200">…</p>}>
          <div className="mx-auto w-full max-w-7xl px-4"><LocalSupplementalResearchPanel /></div>
        </Suspense>
      </WorkspaceErrorBoundary>
      <WorkspaceErrorBoundary surface="canonical">
        <Suspense fallback={<p role="status" className="p-4 text-slate-200">جارٍ تحميل مساحة الحالة…</p>}>
          <CanonicalCaseWorkspacePanel />
        </Suspense>
      </WorkspaceErrorBoundary>
      </div>
      <StrictArabicSurfaceGuard />
      </PersonalCaseSessionProvider>
      </AppraisalReviewSessionProvider>
    </LocaleProvider>
  </React.StrictMode>
);
