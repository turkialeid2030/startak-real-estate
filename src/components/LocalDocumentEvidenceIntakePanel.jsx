const {governanceEvidenceLabel}=require('../i18n/governance-evidence-presentation');
import DiagnosticText from './DiagnosticText.jsx';
import LocalDocumentTablePanel from './LocalDocumentTablePanel.jsx';
import React, { useEffect, useId, useMemo, useRef, useState } from 'react';

const { createManualTranscription } = require('../document-intelligence/manual-transcription');
const { parseDocument } = require('../document-intelligence/parsers');
const {runLocalOcr}=require('../document-intelligence/parsers/local-ocr');
const {recognizeBrowserRaster}=require('../document-intelligence/parsers/ocr-worker-client');
const {parseNumericText}=require('../validation/numeric-text');
const { useLocale } = require('../i18n/LocaleContext.js');

const MAX_FILE_BYTES = 40 * 1024 * 1024;
const MAX_PREVIEW_ATOMS = 20;
const ACCEPTED_EXTENSIONS = ['.xlsx', '.pptx', '.pdf', '.docx','.png','.jpg','.jpeg'];
const emptyManual=()=>({text:'',page:'1',reviewerRef:'',note:''});

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
  if (location.kind === 'PAGE') return `${labels.page}: ${location.page} · ${labels.line}: ${location.line || '—'}`;
  if (location.kind === 'SECTION' && location.paragraph) return `${labels.paragraph}: ${location.paragraph}`;
  return location.kind || '—';
}

function StatusPill({ status, locale }) {
  const className = status === 'PARSED'
    ? 'border-emerald-700/60 bg-emerald-950/30 text-emerald-200'
    : status === 'REJECTED'
      ? 'border-rose-700/60 bg-rose-950/30 text-rose-200'
      : 'border-amber-700/60 bg-amber-950/30 text-amber-200';
  return (
    <span
      data-testid="local-document-parser-status"
      data-parser-status={status || ''}
      className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${className}`}
    >
      {governanceEvidenceLabel(status,locale)}
    </span>
  );
}

export default function LocalDocumentEvidenceIntakePanel({ onRecordChange = null, caseId: suppliedCaseId = null }) {
  const { locale, dir } = useLocale();
  const isAr = locale === 'ar-SA';
  const ocrLayoutGroup=useId();
  const fileInputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [record, setRecord] = useState(null);
  const [error, setError] = useState(null);
  const [manual, setManual] = useState(emptyManual);
  const [ocrSource,setOcrSource]=useState(null),[ocrPage,setOcrPage]=useState('1'),[ocrPreview,setOcrPreview]=useState(null),[ocrLayout,setOcrLayout]=useState('AUTO');
  const requestRef = useRef({id:0,controller:null,ocrActive:false});
  useEffect(() => { requestRef.current.id++; requestRef.current.controller?.abort();requestRef.current.ocrActive=false; setBusy(false); setRecord(null); setError(null);setOcrSource(null);setOcrPage('1');setOcrLayout('AUTO');setOcrPreview(null);setManual(emptyManual()); publishRecord(null); return () => {requestRef.current.id++;requestRef.current.controller?.abort();}; }, [suppliedCaseId]);

  const publishRecord = (nextRecord, selectedAtomId = null) => {
    if (typeof onRecordChange === 'function') onRecordChange(nextRecord, selectedAtomId);
  };

  const l = useMemo(() => isAr ? {
    eyebrow: 'ذكاء المستندات · الإدخال المحلي',
    title: 'فحص المستندات محليًا',
    intro: 'استخراج نصوص PDF وWord ومحتوى XLSX وPPTX محليًا، مع قراءة ضوئية عربية وإنجليزية لصفحة PDF مختارة أو صورة PNG/JPEG. راجع النص والأرقام أمام الأصل.',
    localOnly: 'المعالجة محلية في هذه الواجهة؛ لا تُرسل الملفات إلى جهة خارجية بواسطة هذه الوحدة.',
    choose: 'اختيار ملف',
    clear: 'مسح النتيجة',
    accepted: 'الأنواع المقبولة: XLSX · PPTX · PDF · DOCX · PNG · JPEG — الحد الأقصى 40 MB',
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
    slide: 'الشريحة', page: 'الصفحة',line:'السطر',paragraph:'الفقرة',cancel:'إلغاء المعالجة',
    semanticBoundary: 'حدود الدلالة',
    boundary: 'المحتوى المستخرج ليس دليلاً موثقًا ولا يدخل المحرك المالي تلقائيًا. يلزم ربطه بمصدر ومراجعة بشرية قبل استخدامه كدليل.',
    invalidType: 'نوع الملف غير مدعوم. استخدم XLSX أو PPTX أو PDF أو DOCX أو PNG أو JPEG.',
    tooLarge: 'حجم الملف يتجاوز الحد المحلي المسموح 40 MB.',
    hashFailed: 'تعذّر إنشاء بصمة محلية للملف؛ تم إيقاف المعالجة احترازيًا.',
    readFailed: 'تعذّر قراءة الملف أو فحصه محليًا.',
  } : {
    eyebrow: 'DOCUMENT INTELLIGENCE · LOCAL INTAKE',
    title: 'Local document intake',
    intro: 'Extract native PDF/Word text, XLSX cells and PPTX text locally, with Arabic/English OCR of one selected PDF page or PNG/JPEG image. Compare text and numbers with the original.',
    localOnly: 'Processing is local in this interface; this module does not send the file to an external service.',
    choose: 'Choose file',
    clear: 'Clear result',
    accepted: 'Accepted: XLSX · PPTX · PDF · DOCX · PNG · JPEG — maximum 40 MB',
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
    slide: 'Slide', page: 'Page',line:'Line',paragraph:'Paragraph',cancel:'Cancel processing',
    semanticBoundary: 'Semantic boundary',
    boundary: 'Parsed content is not verified evidence and is never fed into the financial engine automatically. Source linkage and human review are required before analytical evidence use.',
    invalidType: 'Unsupported file type. Use XLSX, PPTX, PDF, DOCX, PNG or JPEG.',
    tooLarge: 'The file exceeds the 40 MB local intake limit.',
    hashFailed: 'A local file digest could not be created; processing stopped fail-closed.',
    readFailed: 'The file could not be read or inspected locally.',
  }, [isAr]);

  const reset = () => {
    requestRef.current.id++; requestRef.current.controller?.abort();requestRef.current.ocrActive=false; setBusy(false);
    setRecord(null);
    setError(null);
    setOcrSource(null);setOcrPreview(null);setOcrPage('1');setOcrLayout('AUTO');setManual(emptyManual());
    publishRecord(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFile = async (file) => {
    requestRef.current.id++;requestRef.current.controller?.abort();requestRef.current.ocrActive=false;setBusy(false);
    setOcrSource(null);setOcrPreview(null);setOcrPage('1');setOcrLayout('AUTO');setManual(emptyManual());
    setError(null);
    setRecord(null);
    publishRecord(null);
    if (!file) return;
    const extension = extensionOf(file.name);
    if (!ACCEPTED_EXTENSIONS.includes(extension)) {
      setError({labelKey:'invalidType'});
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setError({labelKey:'tooLarge'});
      return;
    }

    const requestId=++requestRef.current.id;
    const controller=new AbortController(); requestRef.current.controller=controller;
    setBusy(true);
    try {
      const buffer = await file.arrayBuffer();
      if(requestId!==requestRef.current.id || controller.signal.aborted) return;
      let digest;
      try { digest = await sha256(buffer); }
      catch (_) {
        if(requestId!==requestRef.current.id||controller.signal.aborted)return;
        setError({labelKey:'hashFailed'});
        return;
      }
      if(requestId!==requestRef.current.id||controller.signal.aborted)return;

      const documentId = `local-sha256:${digest}`;
      const caseId = suppliedCaseId || `LOCAL_INTAKE:${digest.slice(0, 16)}`;
      const mimeType = file.type || 'application/octet-stream';
      const receivedAt = new Date().toISOString();
      const document = {
        documentId,
        caseId,
        fileName: file.name,
        mimeType,
      };
      const options={signal:controller.signal};
      if(extension==='.pdf') options.loadPdfLibrary=(await import('../document-intelligence/parsers/pdf-browser-library.mjs')).loadPdfLibrary;
      const result = await parseDocument({ document, content: buffer,options });
      if(requestId!==requestRef.current.id || controller.signal.aborted) return;
      const nextRecord = Object.freeze({
        fileName: file.name,
        size: file.size,
        digest,
        mimeType,
        documentId,
        caseId,
        receivedAt,
        result,
      });
      setRecord(nextRecord);
      if(['PDF','IMAGE'].includes(result.format)&&result.status!=='REJECTED')setOcrSource({record:nextRecord,buffer});
      publishRecord(nextRecord);
    } catch (error) {
      if(requestId!==requestRef.current.id) return;
      setError(error.code || {labelKey:'readFailed'});
      publishRecord(null);
    } finally {
      if(requestId===requestRef.current.id) setBusy(false);
    }
  };

  const startOcr=async()=>{
    if(busy||requestRef.current.ocrActive||!ocrSource)return;
    const parsedPage=parseNumericText(ocrPage);
    if(!parsedPage.ok||!Number.isInteger(parsedPage.value)){setError('OCR_PAGE_INVALID');return;}
    requestRef.current.ocrActive=true;
    requestRef.current.controller?.abort();const id=++requestRef.current.id,controller=new AbortController();requestRef.current.controller=controller;
    setBusy(true);setRecord(null);setOcrPreview(null);setError(null);publishRecord(null);
    try{
      const output=await runLocalOcr({record:ocrSource.record,content:ocrSource.buffer,page:parsedPage.value,layout:ocrLayout,signal:controller.signal,
        render:async(bytes,options)=>{
          const [{renderOcrPage},{loadPdfLibrary}]=await Promise.all([import('../document-intelligence/parsers/ocr-page-renderer.mjs'),import('../document-intelligence/parsers/pdf-browser-library.mjs')]);
          return renderOcrPage(bytes,{...options,loadPdfLibrary});
        },recognize:(image,options)=>recognizeBrowserRaster(image,{...options,assetBase:__STARTAK_OCR_ASSET_BASE__})});
      if(id!==requestRef.current.id||controller.signal.aborted)return;
      setRecord(output.record);setOcrPreview(output.previewUrl);publishRecord(output.record);
    }catch(error){if(id===requestRef.current.id&&!controller.signal.aborted)setError(error.code||'OCR_ENGINE_FAILED');}
    finally{if(id===requestRef.current.id){requestRef.current.ocrActive=false;setBusy(false);}}
  };

  const previewAtoms = record?.result?.atoms?.slice(0, MAX_PREVIEW_ATOMS) || [];
  const exportOcr=()=>{
    if(record?.result?.adapterId!=='LOCAL_OCR_PAGE_V1'||record.result.status!=='PARSED')return;
    const url=URL.createObjectURL(new Blob([JSON.stringify({format:'STARTAK_LOCAL_OCR_EXTRACT',version:1,
      intakeRecord:record,sourceImageIncluded:false,independentlyVerified:false,financialInputEligible:false},null,2)],{type:'application/json'}));
    const anchor=document.createElement('a');anchor.href=url;anchor.download='local-ocr-extract.json';anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  };

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
            <button type="button" onClick={()=>fileInputRef.current?.click()} disabled={busy} className="cursor-pointer rounded-lg border border-amber-600/50 bg-amber-400/10 px-3 py-2 text-xs font-semibold text-amber-200 hover:bg-amber-400/15">
              {busy ? l.parsing : l.choose}
            </button>
              <input
                ref={fileInputRef}
                data-testid="local-document-file-input"
                aria-label={l.choose}
                type="file"
                hidden
                tabIndex={-1}
                aria-hidden="true"
                accept=".xlsx,.pptx,.pdf,.docx,.png,.jpg,.jpeg,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.openxmlformats-officedocument.presentationml.presentation,image/png,image/jpeg"
                className="sr-only"
                disabled={busy}
                onChange={(event) => handleFile(event.target.files?.[0] || null)}
              />
            {busy ? <button type="button" onClick={reset} className="rounded-lg border border-slate-600 px-3 py-2 text-xs text-slate-200">{l.cancel}</button> : null}
            {record || error ? (
              <button type="button" onClick={reset} className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300 hover:bg-slate-800/60">
                {l.clear}
              </button>
            ) : null}
          </div>
        </div>

        <div className="mt-3 text-[10px] text-slate-500">{l.accepted}</div>
        {busy&&<p role="status" aria-live="polite" data-testid="local-ocr-busy" className="mt-3 text-xs text-amber-200">{l.parsing}</p>}
        {ocrSource&&<div data-testid="local-ocr-controls" className="mt-4 space-y-3 rounded border border-slate-600 p-3 text-xs text-slate-200">
          <p>{isAr?'قراءة ضوئية محلية لصفحة واحدة. تُحمّل ملفات المحرك واللغتين من الموقع نفسه عند الطلب، ولا يُرسل المستند إلى مزود خارجي. الحد: صورة معالجة من 6 ملايين بكسل و60 ثانية؛ قد تفشل الصور الكبيرة أو الرديئة.':'Local single-page OCR. Engine and language assets load from this site on demand; the document is not uploaded to a provider. Limit: 6 million processed pixels and 60 seconds; large or poor images may fail.'}</p>
          <label className="block">{isAr?'رقم صفحة PDF للقراءة الضوئية':'PDF page number for OCR'}<input data-testid="local-ocr-page" className="ms-2 w-24 rounded bg-slate-950 p-2" inputMode="numeric" value={ocrPage} disabled={busy||ocrSource.record.result.format==='IMAGE'} onChange={e=>{setOcrPage(e.target.value);setOcrPreview(null);setRecord(null);publishRecord(null);}}/></label>
          <fieldset data-testid="local-ocr-layout" disabled={busy}>
            <legend className="mb-2">{isAr?'تنسيق النص في الصورة':'Text layout in the image'}</legend>
            <div className="flex flex-wrap gap-2">{[['AUTO',isAr?'تلقائي':'Automatic'],['SINGLE_BLOCK',isAr?'كتلة نص واحدة':'Single text block']].map(([value,label])=><label key={value} className={`inline-flex items-center gap-2 rounded border px-3 py-2 ${ocrLayout===value?'border-amber-500 text-amber-200':'border-slate-600 text-slate-200'}`}><input type="radio" name={ocrLayoutGroup} value={value} checked={ocrLayout===value} className="accent-amber-400" onChange={()=>{setOcrLayout(value);setOcrPreview(null);setRecord(null);setError(null);publishRecord(null);}}/>{label}</label>)}</div>
          </fieldset>
          <p>{isAr?'قد يغفل الوضع التلقائي سطورًا حتى مع ثقة مرتفعة. للنص المرتب في كتلة واحدة، جرّب وضع كتلة نص واحدة وقارن النتيجة بالأصل؛ لا يناسب الأعمدة المتعددة.':'Automatic layout may omit lines even with high confidence. For one text block, try Single text block and compare against the source; it is unsuitable for multiple columns.'}</p>
          <button data-testid="local-ocr-start" type="button" disabled={busy} onClick={startOcr} className="rounded border border-amber-500 px-3 py-2">{isAr?'قراءة الصفحة ضوئيًا':'Read page with local OCR'}</button>
          <p>{isAr?'النص والمواضع تقديرات آلية غير متحققة. درجة ثقة المحرك ليست نسبة دقة؛ يلزم فحص الأرقام والفواصل وترتيب الجداول أمام الأصل. لا يشمل هذا باقي صفحات الملف.':'Text and locations are unverified estimates. Engine confidence is not an accuracy rate. Check numbers, decimal separators and table order against the original. Other pages are not covered.'}</p>
        </div>}
        {ocrPreview&&<figure data-testid="local-ocr-source-preview" className="mt-4 rounded border border-slate-600 p-3"><figcaption className="mb-2 text-xs text-slate-200">{isAr?'الصفحة المستخدمة في القراءة الضوئية — للمقارنة':'Page used for OCR — compare against this source'}</figcaption><img src={ocrPreview} alt={isAr?'معاينة صفحة المصدر المختارة':'Selected source page preview'} className="mx-auto max-h-[36rem] max-w-full object-contain"/></figure>}
        {record?.result?.adapterId==='LOCAL_OCR_PAGE_V1'&&record.result.status==='PARSED'&&<button data-testid="local-ocr-export" type="button" onClick={exportOcr} className="mt-3 rounded border border-sky-600 px-3 py-2 text-xs text-sky-200">{isAr?'تصدير كل النص المستخرج ومواضعه ومراجعه':'Export all extracted text, positions and source references'}</button>}

        {error ? (
          <div role="alert" className="mt-4 rounded-lg border border-rose-800/60 bg-rose-950/20 p-3 text-xs text-rose-200">{error.labelKey?l[error.labelKey]:<DiagnosticText code={error} locale={locale} />}</div>
        ) : null}

        {record ? (
          <div className="mt-5 space-y-4">
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-lg border border-slate-800 bg-slate-950/30 p-3"><div className="text-[10px] text-slate-500">{l.file}</div><div className="mt-1 break-all text-xs text-slate-200"><span data-user-content translate="no">{record.fileName}</span></div></div>
              <div className="rounded-lg border border-slate-800 bg-slate-950/30 p-3"><div className="text-[10px] text-slate-500">{l.size}</div><div className="mt-1 text-xs text-slate-200">{bytesLabel(record.size, locale)}</div></div>
              <div className="rounded-lg border border-slate-800 bg-slate-950/30 p-3"><div className="text-[10px] text-slate-500">{l.format}</div><div className="mt-1 text-xs text-slate-200">{isAr&&record.result.format==='IMAGE'?'صورة':record.result.format}</div></div>
              <div className="rounded-lg border border-slate-800 bg-slate-950/30 p-3"><div className="text-[10px] text-slate-500">{l.status}</div><div className="mt-1"><StatusPill status={record.result.status} locale={locale} /></div></div>
            </div>

            <div className="rounded-lg border border-slate-800 bg-slate-950/30 p-3">
              <div className="text-[10px] text-slate-500">{l.digest}</div>
              <div data-testid="local-document-digest" className="mt-1 break-all font-mono text-[11px] text-slate-300">{record.digest}</div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-slate-800 p-3"><div className="text-[10px] text-slate-500">{l.adapter}</div><div className="mt-1 text-xs text-slate-200"><span data-diagnostic-content translate="no">{record.result.adapterId}</span></div></div>
              <div className="rounded-lg border border-slate-800 p-3"><div className="text-[10px] text-slate-500">{l.atoms}</div><div data-testid="local-document-atom-count" className="mt-1 text-xs text-slate-200">{record.result.atoms?.length || 0}</div></div>
              <div className="rounded-lg border border-slate-800 p-3">
                <div className="text-[10px] text-slate-500">{l.reason}</div>
                <div
                  data-testid="local-document-parser-reason"
                  data-parser-reason={record.result.reason || ''}
                  className="mt-1 text-xs text-slate-200"
                >
                  {record.result.reason ? <DiagnosticText code={record.result.reason} locale={locale} /> : '—'}
                </div>
              </div>
            </div>

            {record.result.warnings?.length ? (
              <div className="rounded-lg border border-amber-800/50 bg-amber-950/20 p-3">
                <div className="text-xs font-semibold text-amber-200">{l.warnings}</div>
                <ul className="mt-2 space-y-1 text-[11px] leading-5 text-amber-100/80">
                  {record.result.warnings.map((warning) => <li key={warning}>• <DiagnosticText code={warning} locale={locale} /></li>)}
                </ul>
              </div>
            ) : null}

            {record.result.status==='PARSED'&&['PDF','IMAGE'].includes(record.result.format)&&<LocalDocumentTablePanel
              record={record} sourceBuffer={ocrSource?.buffer} sourcePreviewUrl={ocrPreview}
              onSelectionChange={(next,atomId)=>publishRecord(next||record,atomId)}/>}
            <div className="rounded-xl border border-slate-800 p-3">
              <div className="mb-2 text-xs font-semibold text-slate-200">{l.preview}</div>
              {previewAtoms.length ? (
                <div className="space-y-2">
                  {previewAtoms.map((atom) => (
                    <article key={atom.atomId} className="rounded-lg border border-slate-800 bg-slate-950/20 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-[10px] font-semibold text-slate-400">{governanceEvidenceLabel(atom.kind,locale)} · {governanceEvidenceLabel(atom.valueType,locale)}</span>
                        <span className="text-[10px] text-slate-500"><span data-user-content translate="no">{atomLocation(atom, l)}</span></span>
                      </div>
                      <div className="mt-2 whitespace-pre-wrap break-words text-xs leading-5 text-slate-200"><span data-user-content translate="no">{truncate(atom.rawValue)}</span></div>
                      {atom.metadata?.extraction==='LOCAL_OCR_UNVERIFIED'&&<p className="mt-2 text-[11px] text-amber-200">{isAr?'ثقة المحرك — ليست نسبة دقة':'Engine confidence — not accuracy'}: <span dir="ltr">{atom.metadata.engineConfidence.toFixed(1)} / 100</span></p>}
                    </article>
                  ))}
                  {(record.result.atoms?.length || 0) > MAX_PREVIEW_ATOMS ? <div className="text-[10px] text-slate-500">+{record.result.atoms.length - MAX_PREVIEW_ATOMS}</div> : null}
                </div>
              ) : <div className="text-xs text-slate-500">{l.noAtoms}</div>}
            </div>

            <details data-testid="manual-transcription" className="rounded-lg border border-slate-600 p-3">
              <summary className="cursor-pointer p-2 text-sm text-slate-100">{isAr?'نقل محتوى يدويًا مع مرجع الصفحة':'Transcribe content with a source-page reference'}</summary>
              <p className="my-2 text-xs text-slate-300">{isAr?'أدخل قيمة أو فقرة كما تظهر في الأصل. تُربط ببصمة الملف والصفحة؛ يلزم تحقق منفصل من المطابقة.':'Enter a value or paragraph exactly as in the original. It is linked to the file digest and page and requires separate verification.'}</p>
              <div className="grid gap-2 md:grid-cols-2">
                {[["page",isAr?'رقم الصفحة أو الورقة':'Page or sheet number'],["reviewerRef",isAr?'اسم ناقل المحتوى':'Transcriber reference'],["note",isAr?'وصف موضع القيمة في المصدر':'Location description in the source']].map(([key,label])=><label key={key} className="text-xs text-slate-300">{label}<input data-testid={`manual-${key}`} type={key==='page'?'number':'text'} min="1" max="200" maxLength={key==='note'?2000:160} className="mt-1 w-full rounded bg-slate-950 p-2" value={manual[key]} onChange={e=>setManual({...manual,[key]:e.target.value})}/></label>)}
                <label className="text-xs text-slate-300">{isAr?'النص أو القيمة المنقولة':'Transcribed text or value'}<textarea data-testid="manual-text" maxLength="32000" className="mt-1 w-full rounded bg-slate-950 p-2" value={manual.text} onChange={e=>setManual({...manual,text:e.target.value})}/></label>
              </div>
              <button data-testid="apply-manual-transcription" type="button" className="mt-3 rounded border border-sky-600 px-3 py-2 text-xs text-sky-200" onClick={()=>{try{const next=createManualTranscription({intakeRecord:record,...manual,page:Number(manual.page),capturedAt:new Date().toISOString()});setRecord(next);publishRecord(next);setError(null);}catch(e){setError(e.code);}}}>{isAr?'إضافة محتوى غير متحقق للتأهيل':'Add unverified content for qualification'}</button>
            </details>
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
