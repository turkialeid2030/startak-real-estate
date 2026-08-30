import './index.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './app/App.jsx';
const { LocaleProvider } = require('./i18n/LocaleContext.js');
const { installGlobalHandlers } = require('./observability/report-runtime-error.js');

installGlobalHandlers(); // PR-11: safe no-op provider until a real monitoring backend is configured

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <LocaleProvider defaultLocale="ar-SA">
      <App />
    </LocaleProvider>
  </React.StrictMode>
);
