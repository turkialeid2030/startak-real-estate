import './index.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './app/App.jsx';
const { LocaleProvider } = require('./i18n/LocaleContext.js');
const { installGlobalHandlers } = require('./observability/report-runtime-error.js');
const { activateCustomerFacingVerdictPresentation } = require('./app/compliance-verdict-presentation.js');

activateCustomerFacingVerdictPresentation();
installGlobalHandlers(); // PR-11B: privacy-minimized live Sentry provider

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <LocaleProvider defaultLocale="ar-SA">
      <App />
    </LocaleProvider>
  </React.StrictMode>
);
