import React, { useMemo, useRef, useState } from 'react';

const { parseDocument } = require('../document-intelligence/parsers');
const { useLocale } = require('../i18n/LocaleContext.js');

const MAX_FILE_BYTES = 40 * 1024 * 1024;
const MAX_PREVIEW_ATOMS = 20;
const ACCEPTED_EXTENSIONS = ['.xlsx', '.pptx', '.pdf'];

function extensionOf(name = '') {
  const match = /\.[^.]+$/.exec(String(name).toLowerCase());
  return match ? match[0] : '';
}

function bytesLabel(bytes, locale) {
  const mb = Number(bytes || 0) / (1024 * 1024);
  return `${mb.toLocaleString(locale === 'ar-SA' ? 'ar-SA' : 'en-US', { maximumFractionDigits: 2 })} MB`;
}

function truncate(value, max = 180) {
  const text = value === null || value === undefined ? '' : String(value);
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

function hex(bytes) {
  return [...new Uint8Array(bytes)].map((value) => value.toString(16).padStart(2, '0')).join('');
}

async function sha256(buffer) {
  if (!globalThis.crypto?.subtle) throw new Error('LOCAL_HASH_UNAVAILABLE');
  return hex(await globalThis.crypto.subtle.digest('SHA-256', buffer));
}

function atomLocation(atom, labels) {
  const location = atom?.location || {};
  if (location.kind === 'CELL') return `${labels.sheet}: ${location.sheet || '—'} · ${labels.cell}: ${location.cell || '—'}`;
  if (location.kind === 'SLIDE') return `${labels.slide}: ${location.slide || '—'}`;
  return location.kind || '—';
}

function StatusPill({ status }) {
  const className = status === 'PARSED'
    ? 'border-emerald-700/60 bg-emerald-950/30 text-emerald-200'
    : status === 'REJECTED'
      ? 'border-rose-700/60 bg-rose-950/30 text-rose-200'
      : 'border-amber-700/60 bg-amber-950/30 text-amber-200';
  return <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${className}`}>{status}</span>;
}

export default function LocalDocumentEvidenceIntakePanel() {
  const { locale, dir } = useLocale();
  const isAr = locale === 'ar-SA';
  const fileInputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [record, setRecord] = useState(null);
  const [error, setError] = useState(null);

  const l = useMemo(() => isAr ? {
    eyebrow: 'DOCUMENT INTELLIGENCE · LOCAL INTAKE',
    title: 'فحص المستندات محليًا',
    intro: 'استخراج محتوى أولي من ملفات XLSX وPPTX داخل المتصفح. ملفات PDF تبقى موقوفة احترازيًا حتى اعتماد محلل ثنائي اللغة ومحدود المخاطر.',
    localOnly: 'المعالجة محلية في هذه الواجهة؛ لا تُرسل الملفات إلى جهة خارجية بواسطة هذه الوحدة.',
    choose: 'اختيار ملف',
    clear: 'مسح النتيجة',
    accepted: 'الأنواع المقبولة: XLSX · PPTX · PDF — الحد الأقصى 40 MB',
    parsing: 'جارٍ الفحص…',
    file: 'الملف',
    size: 'الحجم',
    digest: 'بصمة SHA-256',
    adapter: 'المحلل',
    format: 'التنسيق',
    status: 'الحالة',
    atoms: 'العناصر المستخرجة',
    reason: 'سبب التوقف/الرفض',
    warnings: 'تحفظات المحلل',
    preview: 'معاينة العناصر المستخرجة',
    noAtoms: 'لا توجد عناصر مستخرجة قابلة للعرض.',
    sheet: 'الورقة',
    cell: 'الخلية',
    slide: 'الشريحة',
    semanticBoundary: 'حدود الدلالة',
    boundary: 'المحتوى المستخرج ليس دليلاً موثقًا ولا يدخل المحرك المالي تلقائيًا. يلزم ربطه بمصدر ومراجعة بشرية قبل استخدامه كدليل.',
    invalidType: 'نوع الملف غير مدعوم. استخدم XLSX أو PPTX أو PDF.',
    tooLarge: 'حجم الملف يتجاوز الحد المحلي المسموح 40 MB.',
    hashFailed: 'تعذّر إنشاء بصمة محلية للملف؛ تم إيقاف المعالجة احترازيًا.',
    readFailed: 'تعذّر قراءة الملف أو فحصه محليًا.',
  } : {
    eyebrow: 'DOCUMENT INTELLIGENCE · LOCAL INTAKE',
    title: 'Local document intake',
    intro: 'Extract preliminary content from XLSX and PPTX files in the browser. PDF remains fail-closed until a bounded bilingual parser is qualified.',
    localOnly: 'Processing is local in this interface; this module does not send the file to an external service.',
    choose: 'Choose file',
    clear: 'Clear result',
    accepted: 'Accepted: XLSX · PPTX · PDF — maximum 40 MB',
    parsing: 'Inspecting…',
    file: 'File',
    size: 'Size',
    digest: 'SHA-256 digest',
    adapter: 'Adapter',
    format: 'Format',
    status: 'Status',
    atoms: 'Extracted atoms',
    reason: 'Stop/rejection reason',
    warnings: 'Parser caveats',
    preview: 'Extracted atom preview',
    noAtoms: 'No extracted atoms are available to display.',
    sheet: 'Sheet',
    cell: 'Cell',
    slide: 'Slide',
    semanticBoundary: 'Semantic boundary',
    boundary: 'Parsed content is not verified evidence and is never fed into the financial engine automatically. Source linkage and human review are required before analytical evidence use.',
    invalidType: 'Unsupported file type. Use XLSX, PPTX, or PDF.',
    tooLarge: 'The file exceeds the 40 MB local intake limit.',
    hashFailed: 'A local file digest could not be created; processing stopped fail-closed.',
    readFailed: 'The file could not be read or inspected locally.',
  }, [isAr]);

  const reset = () => {
    setRecord(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFile = async (file) => {
    setError(null);
    setRecord(null);
    if (!file) return;
    const extension = extensionOf(file.name);
    if (!ACCEPTED_EXTENSIONS.includes(extension)) {
      setError(l.invalidType);
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setError(l.tooLarge);
      return;
    }

    setBusy(true);
    try {
      const buffer = await file.arrayBuffer();
      let digest;
      try { digest = await sha256(buffer); }
      catch (_) {
        setError(l.hashFailed);
        return;
      }

      const documentId = `local-sha256:${digest}`;
      const caseId = `LOCAL_INTAKE:${digest.slice(0, 16)}`;
      const document = {
        documentId,
        caseId,
        fileName: file.name,
        mimeType: file.type || 'application/octet-stream',
      };
      const result = await parseDocument({ document, content: buffer });
      setRecord(Object.freeze({
        fileName: file.name,
        size: file.size,
        digest,
        result,
      }));
    } catch (_) {
      setError(l.readFailed);
    } finally {
      setBusy(false);
    }
  };

  const previewAtoms = record?.result?.atoms?.slice(0, MAX_PREVIEW_ATOMS) || [];

  return (
    <section data-testid="local-document-evidence-intake" dir={dir} className="mx-auto mt-6 w-full max-w-7xl px-4 pb-8 md:px-8">
      <div className="rounded-2xl border border-slate-700/70 bg-[#101a2d] p-4 shadow-2xl shadow-black/20 md:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <div className="text-[10px] font-semibold tracking-[0.18em] text-amber-300/80">{l.eyebrow}</div>
            <h2 className="mt-1 text-lg font-bold text-slate-100">{l.title}</h2>
            <p className="mt-2 text-xs leading-6 text-slate-300">{l.intro}</p>
            <p className="mt-1 text-[11px] leading-5 text-emerald-200/80">{l.localOnly}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <label className="cursor-pointer rounded-lg border border-amber-600/50 bg-amber-400/10 px-3 py-2 text-xs font-semibold text-amber-200 hover:bg-amber-400/15">
              {busy ? l.parsing : l.choose}
              <input
                ref={fileInputRef}
                data-testid="local-document-file-input"
                aria-label={l.choose}
                type="file"
                accept=".xlsx,.pptx,.pdf,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                className="hidden"
                disabled={busy}
                onChange={(event) => handleFile(event.target.files?.[0] || null)}
              />
            </label>
            {record || error ? (
              <button type="button" onClick={reset} className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300 hover:bg-slate-800/60">
                {l.clear}
              </button>
            ) : null}
          </div>
        </div>

        <div className="mt-3 text-[10px] text-slate-500">{l.accepted}</div>

        {error ? (
          <div role="alert" className="mt-4 rounded-lg border border-rose-800/60 bg-rose-950/20 p-3 text-xs text-rose-200">{error}</div>
        ) : null}

        {record ? (
          <div className="mt-5 space-y-4">
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-lg border border-slate-800 bg-slate-950/30 p-3"><div className="text-[10px] text-slate-500">{l.file}</div><div className="mt-1 break-all text-xs text-slate-200">{record.fileName}</div></div>
              <div className="rounded-lg border border-slate-800 bg-slate-950/30 p-3"><div className="text-[10px] text-slate-500">{l.size}</div><div className="mt-1 text-xs text-slate-200">{bytesLabel(record.size, locale)}</div></div>
              <div className="rounded-lg border border-slate-800 bg-slate-950/30 p-3"><div className="text-[10px] text-slate-500">{l.format}</div><div className="mt-1 text-xs text-slate-200">{record.result.format}</div></div>
              <div className="rounded-lg border border-slate-800 bg-slate-950/30 p-3"><div className="text-[10px] text-slate-500">{l.status}</div><div className="mt-1"><StatusPill status={record.result.status} /></div></div>
            </div>

            <div className="rounded-lg border border-slate-800 bg-slate-950/30 p-3">
              <div className="text-[10px] text-slate-500">{l.digest}</div>
              <div data-testid="local-document-digest" className="mt-1 break-all font-mono text-[11px] text-slate-300">{record.digest}</div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-slate-800 p-3"><div className="text-[10px] text-slate-500">{l.adapter}</div><div className="mt-1 text-xs text-slate-200">{record.result.adapterId}</div></div>
              <div className="rounded-lg border border-slate-800 p-3"><div className="text-[10px] text-slate-500">{l.atoms}</div><div data-testid="local-document-atom-count" className="mt-1 text-xs text-slate-200">{record.result.atoms?.length || 0}</div></div>
              <div className="rounded-lg border border-slate-800 p-3"><div className="text-[10px] text-slate-500">{l.reason}</div><div className="mt-1 text-xs text-slate-200">{record.result.reason || '—'}</div></div>
            </div>

            {record.result.warnings?.length ? (
              <div className="rounded-lg border border-amber-800/50 bg-amber-950/20 p-3">
                <div className="text-xs font-semibold text-amber-200">{l.warnings}</div>
                <ul className="mt-2 space-y-1 text-[11px] leading-5 text-amber-100/80">
                  {record.result.warnings.map((warning) => <li key={warning}>• {warning}</li>)}
                </ul>
              </div>
            ) : null}

            <div className="rounded-xl border border-slate-800 p-3">
              <div className="mb-2 text-xs font-semibold text-slate-200">{l.preview}</div>
              {previewAtoms.length ? (
                <div className="space-y-2">
                  {previewAtoms.map((atom) => (
                    <article key={atom.atomId} className="rounded-lg border border-slate-800 bg-slate-950/20 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-[10px] font-semibold text-slate-400">{atom.kind} · {atom.valueType}</span>
                        <span className="text-[10px] text-slate-500">{atomLocation(atom, l)}</span>
                      </div>
                      <div className="mt-2 whitespace-pre-wrap break-words text-xs leading-5 text-slate-200">{truncate(atom.rawValue)}</div>
                    </article>
                  ))}
                  {(record.result.atoms?.length || 0) > MAX_PREVIEW_ATOMS ? <div className="text-[10px] text-slate-500">+{record.result.atoms.length - MAX_PREVIEW_ATOMS}</div> : null}
                </div>
              ) : <div className="text-xs text-slate-500">{l.noAtoms}</div>}
            </div>

            <div className="rounded-lg border border-sky-800/50 bg-sky-950/20 p-3">
              <div className="text-xs font-semibold text-sky-200">{l.semanticBoundary}</div>
              <p className="mt-1 text-[11px] leading-5 text-sky-100/80">{l.boundary}</p>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

export { ACCEPTED_EXTENSIONS, MAX_FILE_BYTES, MAX_PREVIEW_ATOMS, extensionOf };
