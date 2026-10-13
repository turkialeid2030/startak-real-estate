import React from 'react';
const { useLocale } = require('../i18n/LocaleContext.js');
const { reportRuntimeError } = require('../observability/report-runtime-error.js');

function UnavailableWorkspace({ surface }) {
  const { locale } = useLocale();
  const en = locale === 'en';
  const name = surface === 'documents'
    ? (en ? 'Document workspace' : 'مساحة المستندات')
    : (en ? 'Case workspace' : 'مساحة الحالة');
  return <section role="alert" data-testid={`workspace-unavailable-${surface}`}
    className="mx-auto my-4 max-w-7xl rounded-lg border border-amber-700 p-4 text-amber-200">
    <h2 className="font-semibold">{en ? `${name} is unavailable` : `تعذر عرض ${name}`}</h2>
    <p>{en
      ? 'This workspace could not load. Its results are unavailable. You can continue using the other available sections. Save your work there before reloading the page to try again.'
      : 'تعذر تحميل هذه المساحة؛ نتائجها غير متاحة. يمكنك متابعة الأقسام الأخرى المتاحة. احفظ عملك فيها قبل إعادة تحميل الصفحة للمحاولة مجددًا.'}</p>
  </section>;
}

// A rejected lazy import must not unmount the study, saved deals or its sibling.
// No automatic reload: it would discard unsaved user input. A full user-initiated
// reload also clears React.lazy's cached rejection after asset delivery recovers.
export default class WorkspaceErrorBoundary extends React.Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() {
    // Fixed labels only; never send document content or raw exception details.
    reportRuntimeError({ category: 'workspace-unavailable',
      message: 'Supplementary workspace unavailable',
      surface: this.props.surface === 'documents' ? 'documents' : 'canonical' });
  }
  render() {
    return this.state.failed ? <UnavailableWorkspace surface={this.props.surface} /> : this.props.children;
  }
}
