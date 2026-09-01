import './index.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './app/App.jsx';
import DecisionIntelligenceWorkspacePanel from './components/DecisionIntelligenceWorkspacePanel.jsx';
import InvestmentCommitteeDossierPanel from './components/InvestmentCommitteeDossierPanel.jsx';
import OutcomeMonitoringPanel from './components/OutcomeMonitoringPanel.jsx';
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

const runtimeCommitteeDossier = typeof window !== 'undefined'
  && window.__STARTAK_INVESTMENT_COMMITTEE_DOSSIER__
  && typeof window.__STARTAK_INVESTMENT_COMMITTEE_DOSSIER__ === 'object'
  ? window.__STARTAK_INVESTMENT_COMMITTEE_DOSSIER__
  : null;

const runtimeActionReviewRegister = typeof window !== 'undefined'
  && window.__STARTAK_DECISION_ACTION_REVIEW_REGISTER__
  && typeof window.__STARTAK_DECISION_ACTION_REVIEW_REGISTER__ === 'object'
  ? window.__STARTAK_DECISION_ACTION_REVIEW_REGISTER__
  : null;

const runtimeOutcomeFeedback = typeof window !== 'undefined'
  && window.__STARTAK_OUTCOME_FEEDBACK__
  && typeof window.__STARTAK_OUTCOME_FEEDBACK__ === 'object'
  ? window.__STARTAK_OUTCOME_FEEDBACK__
  : null;

const runtimeDecisionLearningReview = typeof window !== 'undefined'
  && window.__STARTAK_DECISION_LEARNING_REVIEW__
  && typeof window.__STARTAK_DECISION_LEARNING_REVIEW__ === 'object'
  ? window.__STARTAK_DECISION_LEARNING_REVIEW__
  : null;

const runtimeHumanDecisionRecord = typeof window !== 'undefined'
  && window.__STARTAK_HUMAN_COMMITTEE_DECISION_RECORD__
  && typeof window.__STARTAK_HUMAN_COMMITTEE_DECISION_RECORD__ === 'object'
  ? window.__STARTAK_HUMAN_COMMITTEE_DECISION_RECORD__
  : null;

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <LocaleProvider defaultLocale="ar-SA">
      <App />
      {runtimeDecisionWorkspace ? <DecisionIntelligenceWorkspacePanel workspace={runtimeDecisionWorkspace} /> : null}
      {runtimeCommitteeDossier ? (
        <InvestmentCommitteeDossierPanel
          dossier={runtimeCommitteeDossier}
          actionReviewRegister={runtimeActionReviewRegister}
        />
      ) : null}
      {runtimeOutcomeFeedback ? (
        <OutcomeMonitoringPanel
          outcomeFeedback={runtimeOutcomeFeedback}
          learningReview={runtimeDecisionLearningReview}
          decisionRecord={runtimeHumanDecisionRecord}
        />
      ) : null}
    </LocaleProvider>
  </React.StrictMode>
);
