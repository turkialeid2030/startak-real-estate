import React from 'react';
import aiAssistClient from '../residential-income-acquisition/ai-assist-client';

const { requestResidentialIncomeAiAssist, AI_ASSIST_CLIENT_STATUS } = aiAssistClient;

function Tone({ severity }) {
  const cls = severity === 'HIGH'
    ? 'border-rose-900/60 bg-rose-950/20 text-rose-200'
    : severity === 'MEDIUM'
      ? 'border-amber-900/60 bg-amber-950/20 text-amber-200'
      : 'border-slate-800 bg-slate-950/20 text-slate-300';
  return <span className={`rounded border px-2 py-0.5 text-[10px] ${cls}`}>{severity}</span>;
}

function TextList({ items, emptyLabel }) {
  if (!Array.isArray(items) || items.length === 0) {
    return <div className="rounded-lg border border-dashed border-slate-800 p-3 text-xs text-slate-500">{emptyLabel}</div>;
  }
  return (
    <ul className="space-y-2">
      {items.map((item, index) => (
        <li key={`${index}-${item.slice(0, 24)}`} className="rounded-lg border border-slate-800 bg-slate-950/20 p-3 text-xs leading-6 text-slate-300">
          {item}
        </li>
      ))}
    </ul>
  );
}

function ResultSection({ title, children }) {
  return (
    <section className="rounded-xl border border-slate-800 bg-slate-950/30 p-4">
      <h4 className="mb-3 text-xs font-semibold text-slate-100">{title}</h4>
      {children}
    </section>
  );
}

export default function ResidentialIncomeAiAssistPanel({ viewModel, dir = 'rtl' }) {
  const ar = dir === 'rtl';
  const label = (arabic, english) => (ar ? arabic : english);
  const [state, setState] = React.useState({ status: 'IDLE', payload: null, reasonCode: null });
  const caseKey = `${viewModel?.caseId || ''}:${viewModel?.asOfDate || ''}:${viewModel?.summary?.evidenceLineageCount || 0}`;

  React.useEffect(() => {
    setState({ status: 'IDLE', payload: null, reasonCode: null });
  }, [caseKey]);

  if (!viewModel || viewModel.apiStatus !== 'CASE_LOADED') return null;

  const loading = state.status === 'LOADING';
  const result = state.payload?.result || null;

  const runReview = async () => {
    if (loading) return;
    setState({ status: 'LOADING', payload: null, reasonCode: null });
    const response = await requestResidentialIncomeAiAssist(viewModel);
    if (response.status === AI_ASSIST_CLIENT_STATUS.SUCCESS) {
      setState({ status: 'SUCCESS', payload: response, reasonCode: null });
      return;
    }
    setState({ status: 'ERROR', payload: null, reasonCode: response.reasonCode || response.status });
  };

  const providerNotConfigured = state.reasonCode === 'AI_PROVIDER_NOT_CONFIGURED';

  return (
    <section data-testid="riai-ai-assist-panel" className="rounded-xl border border-indigo-900/50 bg-indigo-950/10 p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="max-w-3xl">
          <div className="text-[10px] uppercase tracking-[0.18em] text-indigo-300/70">Governed AI Analytical Review v1</div>
          <h3 className="mt-1 text-sm font-semibold text-slate-100">
            {label('المراجعة التحليلية المساندة بالذكاء الاصطناعي', 'Governed AI analytical review')}
          </h3>
          <p className="mt-2 text-[11px] leading-5 text-slate-400">
            {label(
              'يرسل فقط ملخصاً تحليلياً منقحاً دون أسماء المستأجرين أو نصوص المستندات أو بيانات الحالة الخام. تبقى الدرجة الحتمية والحسابات المالية هي المرجع القابل للتدقيق.',
              'Only a sanitized analytical snapshot is sent; tenant names, document text, and the raw operating case are excluded. The deterministic score and financial calculations remain the auditable source of truth.',
            )}
          </p>
        </div>
        <button
          type="button"
          data-testid="riai-ai-assist-run"
          onClick={runReview}
          disabled={loading}
          className="rounded-lg border border-indigo-700/60 bg-indigo-950/30 px-4 py-2 text-xs font-semibold text-indigo-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading
            ? label('جارٍ التحليل…', 'Analyzing…')
            : state.status === 'SUCCESS'
              ? label('إعادة المراجعة', 'Run again')
              : label('تشغيل مراجعة AI', 'Run AI review')}
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-[10px] text-slate-500">
        <span className="rounded border border-slate-800 px-2 py-1">{label('تشغيل يدوي فقط', 'Manual only')}</span>
        <span className="rounded border border-slate-800 px-2 py-1">{label('لا تعديل تلقائي للحسابات', 'No automatic financial changes')}</span>
        <span className="rounded border border-slate-800 px-2 py-1">{label('لا توصية شراء/بيع', 'No buy/sell recommendation')}</span>
        <span className="rounded border border-slate-800 px-2 py-1">{label('لا رأي قانوني', 'No legal opinion')}</span>
      </div>

      {state.status === 'ERROR' ? (
        <div role="status" className="mt-4 rounded-lg border border-amber-900/50 bg-amber-950/10 p-3 text-xs leading-6 text-amber-200/90">
          {providerNotConfigured
            ? label(
                'مسار الذكاء الاصطناعي مُنفذ تقنياً، لكن مزود AI لم يُفعّل بعد في إعدادات Cloudflare. التحليل الحتمي الحالي يظل عاملاً بالكامل.',
                'The AI path is technically implemented, but the AI provider has not yet been activated in Cloudflare configuration. The deterministic analytical engine remains fully operational.',
              )
            : `${label('تعذر تنفيذ مراجعة AI في هذه المحاولة.', 'AI review could not be completed in this attempt.')} (${state.reasonCode})`}
        </div>
      ) : null}

      {state.status === 'SUCCESS' && result ? (
        <div className="mt-4 space-y-4" data-testid="riai-ai-assist-result">
          <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-500">
            <span className="rounded border border-emerald-900/50 bg-emerald-950/10 px-2 py-1 text-emerald-200">
              {label('AI مستخدم للمراجعة السردية فقط', 'AI used for narrative review only')}
            </span>
            {state.payload.model ? <span>{label('النموذج', 'Model')}: {state.payload.model}</span> : null}
            {state.payload.generatedAt ? <span>{state.payload.generatedAt}</span> : null}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <ResultSection title={label('الملاحظات التنفيذية', 'Executive observations')}>
              <TextList items={result.executiveObservations} emptyLabel={label('لا توجد ملاحظات إضافية.', 'No additional observations.')} />
            </ResultSection>

            <ResultSection title={label('إشارات المخاطر', 'Risk flags')}>
              {result.riskFlags?.length ? (
                <div className="space-y-2">
                  {result.riskFlags.map((flag, index) => (
                    <div key={`${flag.code}-${index}`} className="rounded-lg border border-slate-800 bg-slate-950/20 p-3 text-xs text-slate-300">
                      <div className="flex items-center justify-between gap-2">
                        <strong className="text-slate-100">{flag.code}</strong>
                        <Tone severity={flag.severity} />
                      </div>
                      <p className="mt-2 leading-6">{flag.rationale}</p>
                    </div>
                  ))}
                </div>
              ) : <div className="text-xs text-slate-500">{label('لا توجد إشارات إضافية.', 'No additional flags.')}</div>}
            </ResultSection>

            <ResultSection title={label('فجوات الأدلة', 'Evidence gaps')}>
              <TextList items={result.evidenceGaps} emptyLabel={label('لم يضف النموذج فجوات أخرى.', 'No additional gaps identified.')} />
            </ResultSection>

            <ResultSection title={label('أسئلة العناية الواجبة', 'Due-diligence questions')}>
              <TextList items={result.dueDiligenceQuestions} emptyLabel={label('لا توجد أسئلة إضافية.', 'No additional questions.')} />
            </ResultSection>

            <ResultSection title={label('فحوص السيناريو', 'Scenario checks')}>
              <TextList items={result.scenarioChecks} emptyLabel={label('لا توجد فحوص إضافية.', 'No additional scenario checks.')} />
            </ResultSection>

            <ResultSection title={label('مؤشرات الإنذار المبكر', 'Early-warning indicators')}>
              {result.earlyWarningIndicators?.length ? (
                <div className="space-y-2">
                  {result.earlyWarningIndicators.map((item, index) => (
                    <div key={`${index}-${item.indicator}`} className="rounded-lg border border-slate-800 bg-slate-950/20 p-3 text-xs text-slate-300">
                      <strong className="text-slate-100">{item.indicator}</strong>
                      <p className="mt-2 leading-6">{item.whyItMatters}</p>
                    </div>
                  ))}
                </div>
              ) : <div className="text-xs text-slate-500">{label('لا توجد مؤشرات إضافية.', 'No additional indicators.')}</div>}
            </ResultSection>
          </div>

          <div className="rounded-lg border border-amber-900/50 bg-amber-950/10 p-3 text-[11px] leading-6 text-amber-200/90">
            <strong>{label('حدود القرار:', 'Decision boundary:')}</strong> {result.decisionBoundary}
          </div>
        </div>
      ) : null}
    </section>
  );
}
