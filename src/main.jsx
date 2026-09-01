import './index.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './app/App.jsx';
import DecisionIntelligenceWorkspacePanel from './components/DecisionIntelligenceWorkspacePanel.jsx';
const { LocaleProvider } = require('./i18n/LocaleContext.js');
const { installGlobalHandlers } = require('./observability/report-runtime-error.js');
const { activateCustomerFacingVerdictPresentation } = require('./app/compliance-verdict-presentation.js');

activateCustomerFacingVerdictPresentation();
installGlobalHandlers(); // PR-11B: privacy-minimized live Sentry provider

const runtimeDecisionWorkspace = typeof window !== 'undefined'
  && window.__STARTAK_DECISION_INTELLIGENCE_WORKSPACE__
  && typeof window.__STARTAK_DECISION_INTELLIGENCE_WORKSPACE__ === 'object'
  ? window.__STARTAK_DECISION_INTELLIGENCE_WORKSPACE__
  : null;

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <LocaleProvider defaultLocale="ar-SA">
      <App />
      {runtimeDecisionWorkspace ? <DecisionIntelligenceWorkspacePanel workspace={runtimeDecisionWorkspace} /> : null}
    </LocaleProvider>
  </React.StrictMode>
);
