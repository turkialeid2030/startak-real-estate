import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Plus, Trash2, XCircle } from 'lucide-react';

const {
  VALUATION_METHOD,
  EVIDENCE_GRADE,
  INPUT_STATUS,
} = require('../valuation-intelligence');
const {
  emptyCriticalEvidenceRow,
  criticalEvidenceRowsFromValuationCase,
  applyCriticalEvidenceRowsToValuationCase,
} = require('../app/critical-evidence-draft');
const { getValuationMethodLabel } = require('../app/valuation-labels');

const COLORS = Object.freeze({
  ink: '#0D1526',
  panelRaised: '#1C2C4A',
  panelInput: '#18233C',
  hairline: '#2B3B5C',
  brass: '#C9A24C',
  brassSoft: '#E7D3A0',
  parchment: '#EDE6D6',
  slate: '#8C97AC',
  slateDim: '#647089',
  negative: '#B4544A',
});

const COPY = Object.freeze({
  'ar-SA': Object.freeze({
    title: 'متطلبات الأدلة الحرجة',
    subtitle: 'حدّد صراحة الأدلة التي يجب أن تحقق درجات وحالات مقبولة قبل تأهيل كل منهج. لا توجد ترقية تلقائية للدليل ولا أسماء حقول مفترضة.',
    open: 'فتح متطلبات الأدلة الحرجة',
    close: 'إغلاق متطلبات الأدلة الحرجة',
    add: 'إضافة متطلب',
    apply: 'تطبيق المتطلبات',
    applied: 'تم تطبيق متطلبات الأدلة الحرجة.',
    error: 'تعذر تطبيق متطلبات الأدلة الحرجة',
    method: 'منهج التقييم',
    field: 'اسم حقل الدليل داخل نتيجة المنهج',
    fieldHint: 'يجب أن يطابق field الفعلي الذي يولده محرك المنهج. للمقارنات السوقية استخدم comparable:<ID>.',
    grades: 'درجات الدليل المقبولة',
    statuses: 'حالات المدخل المقبولة',
    selectMethod: 'اختر منهجاً',
    fieldPlaceholder: 'مثال: effectiveGrossIncome',
    remove: 'حذف',
    none: 'لا توجد متطلبات حرجة حالياً.',
  }),
  en: Object.freeze({
    title: 'Critical Evidence Requirements',
    subtitle: 'Explicitly define evidence fields that must satisfy allowed grades and statuses before a method can qualify. No evidence is upgraded and no field names are inferred automatically.',
    open: 'Open critical evidence requirements',
    close: 'Close critical evidence requirements',
    add: 'Add requirement',
    apply: 'Apply requirements',
    applied: 'Critical evidence requirements were applied.',
    error: 'Critical evidence requirements could not be applied',
    method: 'Valuation method',
    field: 'Evidence field name emitted by the method',
    fieldHint: 'The field must exactly match the evidence field emitted by the method. For market comparables use comparable:<ID>.',
    grades: 'Allowed evidence grades',
    statuses: 'Allowed input statuses',
    selectMethod: 'Select a method',
    fieldPlaceholder: 'Example: effectiveGrossIncome',
    remove: 'Remove',
    none: 'No critical evidence requirements are configured.',
  }),
});

const STATIC_FIELD_SUGGESTIONS = Object.freeze({
  [VALUATION_METHOD.INCOME_DIRECT_CAPITALIZATION]: Object.freeze([
    'effectiveGrossIncome',
    'operatingExpenses',
    'capitalizationRate',
  ]),
  [VALUATION_METHOD.COST_DEPRECIATED_REPLACEMENT]: Object.freeze([
    'landValue',
    'replacementCost',
    'depreciationRate',
  ]),
});

function copyForLocale(locale) {
  return COPY[locale] || COPY.en;
}

function inputStyle() {
  return {
    background: COLORS.panelInput,
    border: `1px solid ${COLORS.hairline}`,
    color: COLORS.brassSoft,
    borderRadius: '0.6rem',
  };
}

function toggleListValue(values, value, checked) {
  const next = new Set(Array.isArray(values) ? values : []);
  if (checked) next.add(value);
  else next.delete(value);
  return [...next];
}

function fieldSuggestionsForMethod(method, valuationCase) {
  if (method === VALUATION_METHOD.MARKET_COMPARABLE) {
    const comparables = valuationCase?.marketComparableInput?.comparables;
    if (!Array.isArray(comparables)) return [];
    return comparables
      .map((item) => typeof item?.comparableId === 'string' && item.comparableId.trim() ? `comparable:${item.comparableId.trim()}` : null)
      .filter(Boolean);
  }
  return [...(STATIC_FIELD_SUGGESTIONS[method] || [])];
}

function CheckboxGroup({ values, selected, onChange }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
      {values.map((value) => (
        <label key={value} className="flex items-center gap-2 text-[9px] px-2 py-1.5 rounded-lg" style={{ border: `1px solid ${COLORS.hairline}`, color: COLORS.slate }}>
          <input
            type="checkbox"
            checked={selected.includes(value)}
            onChange={(event) => onChange(toggleListValue(selected, value, event.target.checked))}
          />
          <span className="break-all">{value}</span>
        </label>
      ))}
    </div>
  );
}

export default function CriticalEvidenceRequirementsPanel({
  locale = 'ar-SA',
  valuationCase,
  onChangeValuationCase,
}) {
  const text = copyForLocale(locale);
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState(() => criticalEvidenceRowsFromValuationCase(valuationCase));
  const [message, setMessage] = useState(null);

  useEffect(() => {
    setRows(criticalEvidenceRowsFromValuationCase(valuationCase));
    setMessage(null);
  }, [valuationCase]);

  const methodOptions = useMemo(() => Object.values(VALUATION_METHOD), []);
  const gradeOptions = useMemo(() => Object.values(EVIDENCE_GRADE), []);
  const statusOptions = useMemo(() => Object.values(INPUT_STATUS), []);

  const patchRow = (index, field, value) => {
    setRows((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, [field]: value } : row));
  };

  const addRow = () => setRows((current) => [...current, emptyCriticalEvidenceRow()]);
  const removeRow = (index) => setRows((current) => current.filter((_, rowIndex) => rowIndex !== index));

  const apply = () => {
    try {
      const next = applyCriticalEvidenceRowsToValuationCase(valuationCase, rows);
      onChangeValuationCase(next);
      setMessage({ ok: true, text: text.applied });
    } catch (error) {
      setMessage({
        ok: false,
        text: `${text.error}: ${error?.reasonCode || error?.name || 'INVALID_CONFIGURATION'}${error?.field ? ` — ${error.field}` : ''}`,
      });
    }
  };

  return (
    <div className="mt-4 rounded-xl p-3 md:p-4" style={{ border: `1px solid ${COLORS.hairline}`, background: 'rgba(28,44,74,0.45)' }}>
      <button type="button" onClick={() => setOpen((value) => !value)} className="w-full flex items-start justify-between gap-3 text-start">
        <div>
          <div className="text-xs font-semibold" style={{ color: COLORS.parchment }}>{text.title}</div>
          <div className="text-[9px] leading-relaxed mt-1" style={{ color: COLORS.slateDim }}>{text.subtitle}</div>
          {rows.length > 0 ? <div className="text-[9px] mt-1" style={{ color: COLORS.brass }}>{rows.length}</div> : null}
        </div>
        {open ? <ChevronUp size={15} style={{ color: COLORS.slate }} /> : <ChevronDown size={15} style={{ color: COLORS.slate }} />}
      </button>

      {open ? (
        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="text-[9px]" style={{ color: COLORS.slateDim }}>{rows.length === 0 ? text.none : text.fieldHint}</div>
            <button type="button" onClick={addRow} className="text-[10px] px-2 py-1.5 rounded-lg flex items-center gap-1" style={{ border: `1px solid ${COLORS.hairline}`, color: COLORS.brassSoft }}>
              <Plus size={11} /> {text.add}
            </button>
          </div>

          <div className="space-y-3">
            {rows.map((row, index) => {
              const suggestions = fieldSuggestionsForMethod(row.method, valuationCase);
              const listId = `critical-evidence-fields-${index}`;
              return (
                <div key={`${row.method || 'new'}-${row.field || 'field'}-${index}`} className="rounded-xl p-3" style={{ border: `1px solid ${COLORS.hairline}`, background: COLORS.panelRaised }}>
                  <div className="flex justify-end mb-2">
                    <button type="button" onClick={() => removeRow(index)} className="text-[10px] flex items-center gap-1" style={{ color: COLORS.negative }}>
                      <Trash2 size={11} /> {text.remove}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <label className="block">
                      <div className="text-[10px] mb-1" style={{ color: COLORS.slate }}>{text.method}</div>
                      <select
                        value={row.method}
                        onChange={(event) => patchRow(index, 'method', event.target.value)}
                        className="rf-input w-full px-3 py-2 text-xs"
                        style={inputStyle()}
                      >
                        <option value="" style={{ background: COLORS.panelRaised }}>{text.selectMethod}</option>
                        {methodOptions.map((method) => (
                          <option key={method} value={method} style={{ background: COLORS.panelRaised }}>{getValuationMethodLabel(locale, method)}</option>
                        ))}
                      </select>
                    </label>

                    <label className="block">
                      <div className="text-[10px] mb-1" style={{ color: COLORS.slate }}>{text.field}</div>
                      <input
                        list={listId}
                        value={row.field}
                        onChange={(event) => patchRow(index, 'field', event.target.value)}
                        placeholder={text.fieldPlaceholder}
                        className="rf-input w-full px-3 py-2 text-xs"
                        style={inputStyle()}
                      />
                      <datalist id={listId}>
                        {suggestions.map((field) => <option key={field} value={field} />)}
                      </datalist>
                    </label>
                  </div>

                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 mt-3">
                    <div>
                      <div className="text-[10px] mb-2" style={{ color: COLORS.slate }}>{text.grades}</div>
                      <CheckboxGroup values={gradeOptions} selected={row.allowedGrades} onChange={(value) => patchRow(index, 'allowedGrades', value)} />
                    </div>
                    <div>
                      <div className="text-[10px] mb-2" style={{ color: COLORS.slate }}>{text.statuses}</div>
                      <CheckboxGroup values={statusOptions} selected={row.allowedStatuses} onChange={(value) => patchRow(index, 'allowedStatuses', value)} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {message ? (
            <div className="rounded-lg px-3 py-2 flex items-start gap-2" style={{ border: `1px solid ${message.ok ? COLORS.hairline : COLORS.negative}`, color: message.ok ? COLORS.brassSoft : COLORS.negative }}>
              {!message.ok ? <XCircle size={13} style={{ flexShrink: 0 }} /> : null}
              <div className="text-[10px] leading-relaxed">{message.text}</div>
            </div>
          ) : null}

          <div className="flex justify-end">
            <button type="button" onClick={apply} className="px-4 py-2 rounded-lg text-xs font-semibold" style={{ background: COLORS.brass, color: COLORS.ink }}>
              {text.apply}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
