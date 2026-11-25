import React,{useState} from 'react';
import {useAppraisalReviewSession} from './AppraisalReviewSessionContext.jsx';
const {evaluatePersonalReportExport,assertPersonalReportExportAllowed}=require('../market/appraisal-report-export-gate');
const {KINDS,ADJUSTMENTS}=require('../reporting/saudi-rental-intelligence');
const {buildRentalWorkspaceInput,parseLocalRentalJson}=require('../reporting/rental-workspace-input');
const {SOURCES,reviewRentIndicator}=require('../reporting/saudi-rent-indicator-snapshot');
const {emptyHistory,appendIndicator,importHistory,reviewHistory,MAX_BYTES}=require('../reporting/saudi-rent-indicator-history');
const {renderExternalReview,issueLabel}=require('../reporting/reporting-studio');
const kindNames={APARTMENT:'شقة',VILLA:'فيلا',RESIDENTIAL_BUILDING:'عمارة سكنية',RESIDENTIAL_COMPOUND:'مجمع سكني',OFFICE:'مكتب',RETAIL_SHOP:'محل تجاري',SHOWROOM:'معرض',MALL_UNIT:'وحدة مول',MALL_WHOLE:'مول كامل',WAREHOUSE:'مستودع',LOGISTICS:'مجمع لوجستي',FACTORY:'مصنع',LAND:'أرض',HOTEL_PROPERTY:'عقار فندقي',FUEL_STATION_PROPERTY:'عقار محطة وقود',SCHOOL_PROPERTY:'عقار مدرسة',HEALTHCARE_PROPERTY:'عقار صحي',DATA_CENTER_PROPERTY:'عقار مركز بيانات',PARKING_PROPERTY:'مواقف',OTHER_PROPERTY:'عقار آخر'};
const segment=()=>({id:'',kind:'',subtype:'',areaBasis:'',areaPerUnitSqm:'',unitCount:'',occupancy:'',collection:'',contractAnnualExVatSar:'',contractRef:''});
const comparable=()=>({sourceUrl:'',sourceRecordId:'',contractRef:'',status:'UNKNOWN',kind:'',subtype:'',city:'',district:'',lat:'',lng:'',areaBasis:'',areaSqm:'',date:'',observedDate:'',rentAmountSar:'',periodMonths:'',vatBasis:'UNKNOWN',declaredVatRate:'',vatRef:'',rentOnly:false,usageRightsDeclared:false,adjustments:[]});
const blank=()=>({propertyRef:'',valuationDate:'',city:'',district:'',lat:'',lng:'',segmentsNonOverlapping:false,segments:[segment()],comparables:[]});
const className='block w-full min-w-0 rounded border border-slate-400 bg-white text-slate-900 p-2 text-sm';
const button='rounded border border-slate-400 bg-slate-100 text-slate-900 px-3 py-2 text-sm disabled:opacity-50';
function Field({label,value,onChange,options,type='text',id}){
 return <label className="block min-w-0 text-xs">{label}{options?<select className={className} data-testid={id} value={value} onChange={e=>onChange(e.target.value)}>{options.map(([v,name])=><option key={v} value={v}>{name}</option>)}</select>:<input className={className} type={type} data-testid={id} value={value} onChange={e=>onChange(e.target.value)} maxLength={500}/>}</label>;
}
function Check({label,value,onChange,id}){return <label className="flex gap-2 items-start text-xs"><input type="checkbox" data-testid={id} checked={value} onChange={e=>onChange(e.target.checked)}/>{label}</label>;}
export default function RentalIntelligenceWorkspace({locale='ar-SA'}){
 const ar=locale!=='en',t=(a,b)=>ar?a:b,[state,setState]=useState(blank),[prepared,setPrepared]=useState(null),[error,setError]=useState(false),[indicatorRaw,setIndicatorRaw]=useState(''),[indicator,setIndicator]=useState(null),[indicatorError,setIndicatorError]=useState(false),[segmentIndex,setSegmentIndex]=useState('0');
 const [history,setHistory]=useState(emptyHistory),[historyRaw,setHistoryRaw]=useState(''),[historyView,setHistoryView]=useState(null),[historyError,setHistoryError]=useState(false);
 const {subject,link}=useAppraisalReviewSession(),gate=evaluatePersonalReportExport({subject,link});
 const clear=()=>{setPrepared(null);setError(false);setIndicator(null);setIndicatorError(false);setHistoryView(null);setHistoryError(false);};
 const change=(fn)=>{clear();setState(fn);};
 const top=(k,v)=>change(s=>({...s,[k]:v}));
 const row=(key,i,k,v)=>change(s=>({...s,[key]:s[key].map((a,j)=>i===j?{...a,[k]:v}:a)}));
 const add=(key,newRow)=>change(s=>({...s,[key]:[...s[key],newRow]}));
 const remove=(key,i)=>{change(s=>({...s,[key]:s[key].filter((_,j)=>j!==i)}));setSegmentIndex('0');};
 const choose=[[ '',t('حدد','Select')],...KINDS.map(k=>[k,ar?kindNames[k]:k.replaceAll('_',' ')])];
 const bases=[['',t('حدد أساس المساحة','Select area basis')],['NLA',t('صافي المساحة التأجيرية','Net lettable area')],['LAND_AREA',t('مساحة الأرض','Land area')],['WHOLE_LEASE_AREA',t('مساحة التأجير الكلي المصرح بها','Declared whole lease area')]];
 const f=(obj,k,a,b,changeField,id,options,type)=><Field key={k} label={t(a,b)} value={obj[k]} onChange={v=>changeField(k,v)} id={id} options={options} type={type}/>;
 const amount=v=>v===null||v===undefined?'—':Number(v).toLocaleString(ar?'ar-SA':'en-US',{maximumFractionDigits:2});
 const calculate=()=>{setPrepared(null);setError(false);try{const input=buildRentalWorkspaceInput(state),out=renderExternalReview(input,{locale});setPrepared({input,hash:out.report.reviewHashSha256,report:out.report});}catch{setError(true);}};
 const exportReport=()=>{try{assertPersonalReportExportAllowed({subject,link});if(!prepared)throw Error('REQUIRED');const input=buildRentalWorkspaceInput(state),out=renderExternalReview(input,{locale});if(out.report.reviewHashSha256!==prepared.hash)throw Error('STALE');const url=URL.createObjectURL(new Blob([out.html],{type:'text/html;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='startak-rental-research.html';try{document.body.appendChild(a);a.click();}finally{a.remove();URL.revokeObjectURL(url);}}catch{setError(true);}};
 const reviewIndicator=()=>{setIndicator(null);setIndicatorError(false);try{const s=state.segments[Number(segmentIndex)];if(!s)throw Error('SEGMENT');setIndicator(reviewRentIndicator(parseLocalRentalJson(indicatorRaw),{city:state.city,district:state.district,kind:s.kind,subtype:s.subtype,areaBasis:s.areaBasis,asOf:state.valuationDate}));}catch{setIndicatorError(true);}};
 const archiveContext=()=>{const s=state.segments[Number(segmentIndex)];if(!s)throw Error('SEGMENT');return {city:state.city,district:state.district,kind:s.kind,subtype:s.subtype,areaBasis:s.areaBasis,asOf:state.valuationDate};};
 const historyAction=fn=>{setHistoryError(false);setHistoryView(null);try{fn();}catch{setHistoryError(true);}};
 const sampleIndicator={version:'SAUDI_RENT_INDICATOR_SNAPSHOT_V1',sourceId:'REGA',sourceUrl:SOURCES.REGA.url,sourceRef:'SYNTH-REFERENCE',attribution:'SYNTHETIC EXAMPLE ONLY',city:'SYNTH-CITY',district:'SYNTH-DISTRICT',kind:'OFFICE',subtype:'SYNTH-GRADE',areaBasis:'NLA',periodStart:'2025-10-01',periodEnd:'2025-12-31',publishedDate:'2026-01-02',observedDate:'2026-01-03',priceSource:'REGISTERED',metric:'MEAN_ANNUAL_SAR_PER_SQM',valueSar:100,sampleCount:10,vatBasis:'EXCLUDED',declaredVatRate:null,vatRef:null};
 return <section dir={ar?'rtl':'ltr'} data-testid="rental-workspace" className="mt-4 rounded-xl border border-slate-600 p-4">
 <h3 className="font-semibold">{t('محرك القيمة الإيجارية — مساحة عمل مستقلة','Rental Intelligence — independent workspace')}</h3>
 <p className="text-xs mt-2">{t('بحث محلي لعقار مملوك ملكية كاملة ومؤجر كعقار فقط. لا يوجد اتصال حي بالمصادر أو اعتماد للقيمة أو الأجرة النظامية. لا تستخدم بيانات شخصية للمستأجرين.','Local research for freehold property-only leases. No live data connection, certified value or legal rent determination. Do not enter tenant personal data.')}</p>
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
 {f(state,'propertyRef','مرجع العقار','Property reference',top,'rental-property')}
 {f(state,'valuationDate','تاريخ التقدير','As-of date',top,'rental-date',null,'date')}
 {f(state,'city','المدينة','City',top,'rental-city')}
 {f(state,'district','الحي','District',top,'rental-district')}
 {f(state,'lat','خط العرض (اختياري)','Latitude (optional)',top,'rental-lat')}
 {f(state,'lng','خط الطول (اختياري)','Longitude (optional)',top,'rental-lng')}
 </div>
 <div className="mt-3"><Check id="rental-disjoint" label={t('أصرح بأن جميع المساحات والوحدات منفصلة دون تداخل، وأن المقارنة لحقوق تأجير العقار المملوك بالكامل.','I declare disjoint areas/units and freehold property lease rights.')} value={state.segmentsNonOverlapping} onChange={v=>top('segmentsNonOverlapping',v)}/></div>
 <h4 className="mt-4 font-medium">{t('مكونات العقار والاستخدامات','Property segments and uses')}</h4>
 {state.segments.map((s,i)=>{const changeField=(k,v)=>row('segments',i,k,v),id=k=>'rental-seg-'+i+'-'+k;return <fieldset key={i} className="border rounded p-3 mt-2 min-w-0"><legend className="text-xs">{t('مكون','Segment')} {i+1}</legend><div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
 {f(s,'id','معرف المكون','Segment ID',changeField,id('id'))}
 {f(s,'kind','نوع العقار','Property type',changeField,id('kind'),choose)}
 {f(s,'subtype','التصنيف التفصيلي','Subtype',changeField,id('subtype'))}
 {f(s,'areaBasis','أساس المساحة','Area basis',changeField,id('areaBasis'),bases)}
 {f(s,'areaPerUnitSqm','مساحة الوحدة م²','Area per unit sqm',changeField,id('areaPerUnitSqm'))}
 {f(s,'unitCount','عدد الوحدات','Unit count',changeField,id('unitCount'))}
 {f(s,'occupancy','الإشغال المتوقع %','Expected occupancy %',changeField,id('occupancy'))}
 {f(s,'collection','التحصيل المتوقع %','Expected collection %',changeField,id('collection'))}
 {f(s,'contractAnnualExVatSar','الإيجار السنوي التعاقدي دون الضريبة (اختياري)','Current annual rent ex VAT (optional)',changeField,id('contractAnnualExVatSar'))}
 {f(s,'contractRef','مرجع العقد الحالي (اختياري)','Current contract reference (optional)',changeField,id('contractRef'))}
 </div><button type="button" className={button+' mt-2'} disabled={state.segments.length===1} onClick={()=>remove('segments',i)}>{t('حذف المكون','Remove segment')}</button></fieldset>;})}
 <button type="button" className={button+' mt-2'} data-testid="rental-add-segment" disabled={state.segments.length>=20} onClick={()=>add('segments',segment())}>{t('إضافة مكون','Add segment')}</button>
 <h4 className="mt-4 font-medium">{t('المقارنات الإيجارية الفردية','Individual lease comparables')}</h4>
 <p className="text-xs">{t('أدخل ثلاث مقارنات منفذة مستقلة على الأقل لكل استخدام؛ العروض لا تُعامل كعقود منفذة. التواريخ والأسعار ومصادرها يجب أن تكون مدخلة صراحة.','Enter at least three distinct declared executed comparables per use; asking offers are not executed leases. Dates, amounts and sources must be explicit.')}</p>
 {state.comparables.map((c,i)=>{const changeField=(k,v)=>row('comparables',i,k,v),id=k=>'rental-comp-'+i+'-'+k;return <fieldset key={i} className="border rounded p-3 mt-2 min-w-0"><legend className="text-xs">{t('مقارنة','Comparable')} {i+1}</legend><div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
 {f(c,'sourceUrl','رابط المصدر HTTPS دون معلمات','Source HTTPS URL without query',changeField,id('sourceUrl'))}
 {f(c,'sourceRecordId','رقم سجل المصدر','Source record ID',changeField,id('sourceRecordId'))}
 {f(c,'contractRef','معرف المقارنة المستقل','Independent comparison reference',changeField,id('contractRef'))}
 {f(c,'status','حالة السجل','Record status',changeField,id('status'),[['UNKNOWN',t('غير معلوم','Unknown')],['EXECUTED',t('منفذ وفق التصريح','Declared executed')],['ASKING',t('عرض','Asking')]])}
 {f(c,'kind','نوع العقار','Property type',changeField,id('kind'),choose)}
 {f(c,'subtype','التصنيف التفصيلي','Subtype',changeField,id('subtype'))}
 {f(c,'city','المدينة','City',changeField,id('city'))}
 {f(c,'district','الحي','District',changeField,id('district'))}
 {f(c,'lat','خط العرض (اختياري)','Latitude (optional)',changeField,id('lat'))}
 {f(c,'lng','خط الطول (اختياري)','Longitude (optional)',changeField,id('lng'))}
 {f(c,'areaBasis','أساس المساحة','Area basis',changeField,id('areaBasis'),bases)}
 {f(c,'areaSqm','مساحة المقارنة م²','Comparable area sqm',changeField,id('areaSqm'))}
 {f(c,'date','تاريخ العقد أو العرض','Lease or offer date',changeField,id('date'),null,'date')}
 {f(c,'observedDate','تاريخ الرصد','Observation date',changeField,id('observedDate'),null,'date')}
 {f(c,'rentAmountSar','الأجرة المعلنة بالريال','Declared rent SAR',changeField,id('rentAmountSar'))}
 {f(c,'periodMonths','مدة مبلغ الأجرة بالأشهر','Rent amount period months',changeField,id('periodMonths'),[['',t('حدد','Select')],...['1','3','6','12'].map(v=>[v,v])])}
 {f(c,'vatBasis','حالة الضريبة','VAT basis',changeField,id('vatBasis'),[['UNKNOWN',t('غير معلوم','Unknown')],['EXCLUDED',t('غير شامل','Excluded')],['INCLUDED',t('شامل','Included')]])}
 {c.vatBasis==='INCLUDED'&&<>{f(c,'declaredVatRate','نسبة الضريبة المصرح بها %','Declared VAT %',changeField,id('declaredVatRate'))}{f(c,'vatRef','مرجع الضريبة','VAT reference',changeField,id('vatRef'))}</>}
 </div><div className="grid gap-2 mt-2"><Check id={id('rentOnly')} label={t('أجرة العقار فقط دون إيرادات النشاط أو الخدمات','Property rent only; excludes business and service revenue')} value={c.rentOnly} onChange={v=>changeField('rentOnly',v)}/><Check id={id('usageRightsDeclared')} label={t('حقوق الاستخدام والتأجير مماثلة وفق التصريح','Comparable use and lease rights declared')} value={c.usageRightsDeclared} onChange={v=>changeField('usageRightsDeclared',v)}/></div>
 <details className="mt-2 text-xs"><summary>{t('التسويات المدعومة بدليل','Evidence-backed adjustments')}</summary>{c.adjustments.map((a,j)=>{const set=(k,v)=>changeField('adjustments',c.adjustments.map((old,n)=>n===j?{...old,[k]:v}:old));return <div key={j} className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2">{f(a,'category','فئة التسوية','Adjustment category',set,id('adjust-'+j+'-category'),[['',t('حدد','Select')],...ADJUSTMENTS.map(k=>[k,k])])}{f(a,'percent','نسبة التسوية %','Adjustment %',set,id('adjust-'+j+'-percent'))}{f(a,'evidenceRef','مرجع الدليل','Evidence reference',set,id('adjust-'+j+'-ref'))}<button type="button" className={button} onClick={()=>changeField('adjustments',c.adjustments.filter((_,n)=>n!==j))}>{t('حذف التسوية','Remove adjustment')}</button></div>;})}<button type="button" className={button+' mt-2'} disabled={c.adjustments.length>=12} onClick={()=>changeField('adjustments',[...c.adjustments,{category:'',percent:'',evidenceRef:''}])}>{t('إضافة تسوية','Add adjustment')}</button></details>
 <button type="button" className={button+' mt-2'} onClick={()=>remove('comparables',i)}>{t('حذف المقارنة','Remove comparable')}</button></fieldset>;})}
 <div className="flex flex-wrap gap-2 mt-3"><button type="button" data-testid="rental-add-comparable" className={button} disabled={state.comparables.length>=100} onClick={()=>add('comparables',comparable())}>{t('إضافة مقارنة','Add comparable')}</button><button type="button" data-testid="rental-calculate" className={button} onClick={calculate}>{t('احتساب المؤشر الإيجاري','Calculate rental indication')}</button><button type="button" data-testid="rental-export" className={button} disabled={!prepared||gate.blocked} onClick={exportReport}>{t('تصدير التقرير البحثي','Export research report')}</button><button type="button" className={button} onClick={()=>{clear();setState(blank());setIndicatorRaw('');setSegmentIndex('0');}}>{t('مسح الدراسة','Clear study')}</button></div>
 {error&&<p role="alert" className="mt-2 text-xs" data-testid="rental-error">{t('المدخلات ناقصة أو غير صالحة. راجع الحقول والتواريخ والمقارنات.','Incomplete or invalid input. Review fields, dates and comparable records.')}</p>}
 {gate.blocked&&<p role="alert" className="mt-2 text-xs">{t('التصدير معلق وفق بوابة التقرير المرتبط','Export held by linked appraisal gate')}</p>}
 {prepared&&<div data-testid="rental-result" className="mt-3 border rounded p-3 text-sm"><p>{prepared.report.total?t('مؤشر بحثي غير متحقق مستقلًا','Independently unverified research indication'):t('معلق: أدلة غير كافية أو متعارضة','Held: insufficient or conflicting evidence')}</p><p>{t('الإيجار السنوي دون الضريبة','Annual rent ex VAT')}: {amount(prepared.report.total?.annualRentExVatSar)}</p><p>{t('ريال/م²/سنة','SAR/sqm/year')}: {amount(prepared.report.total?.rateSarPerSqmYear)}</p><p>{t('التحصيل المتوقع','Expected collections')}: {amount(prepared.report.total?.expectedCollectionsSar)}</p>{prepared.report.segments.map(s=><p key={s.id}>{s.id} — {amount(s.result?.annualRentExVatSar)} — {t('العقود','Leases')}: {s.executedCount} / {t('العروض','Offers')}: {s.askingCount}</p>)}<ul>{prepared.report.issues.map((a,i)=><li key={i}>{issueLabel(a.code,locale)} — {a.ref}</li>)}</ul></div>}
 <h4 className="mt-4 font-medium">{t('مؤشرات الحي الرسمية والتجارية — مرجع منفصل','Official and commercial neighborhood indicators — separate reference')}</h4>
 <p className="text-xs">{t('روابط مرجعية فقط. لا تُحوّل المؤشرات المجمعة إلى عقود فردية ولا تُستخدم لإنتاج قيمة عقار تلقائيًا.','Reference links only. Aggregate indicators never become individual leases or automatically estimate property rent.')}</p>
 <div className="flex flex-wrap gap-3 text-sm mt-2">{Object.entries(SOURCES).map(([k,v])=><a key={k} href={v.url} target="_blank" rel="noreferrer noopener" className="underline">{k}</a>)}</div>
 <Field label={t('المكون المراد مقارنة المؤشر به','Segment for indicator scope')} value={segmentIndex} onChange={v=>{setSegmentIndex(v);setIndicator(null);setIndicatorError(false);setHistoryView(null);setHistoryError(false);}} options={state.segments.map((s,i)=>[String(i),s.id||String(i+1)])}/>
 <details className="mt-2 text-xs"><summary>{t('مخطط إدخال مؤشر مجمع (مثال اصطناعي)','Aggregate input schema (synthetic example)')}</summary><pre className="whitespace-pre-wrap break-all">{JSON.stringify(sampleIndicator,null,2)}</pre></details>
 <label className="block mt-2 text-xs">{t('ألصق سجل المؤشر المجمع مع الإسناد للمصدر','Paste aggregate indicator record with attribution')}<textarea className={className} data-testid="rental-indicator-input" rows={5} maxLength={65536} value={indicatorRaw} onChange={e=>{setIndicatorRaw(e.target.value);setIndicator(null);setIndicatorError(false);}}/></label>
 <button type="button" className={button+' mt-2'} data-testid="rental-indicator-review" onClick={reviewIndicator}>{t('مراجعة المؤشر المرجعي','Review reference indicator')}</button>
 {indicatorError&&<p role="alert" data-testid="rental-indicator-error">{t('تعذر التحقق من بنية المؤشر أو نطاقه','Invalid indicator schema or scope')}</p>}
 {indicator&&<div data-testid="rental-indicator-result" className="mt-2 text-xs"><p>{t('المؤشر المرجعي دون الضريبة','Reference metric ex VAT')}: {amount(indicator.referenceMetricExVatSar)} — {indicator.input.metric}</p><p>{t('العينة','Sample')}: {indicator.input.sampleCount} — {indicator.input.periodStart} / {indicator.input.periodEnd}</p><p>{t('القيمة المعلنة (دون اعتماد)','Declared value (unverified)')}: {amount(indicator.input.valueSar)} — {indicator.input.priceSource==='ASKING'?t('عرض إيجاري','Asking rent'):indicator.input.priceSource==='REGISTERED'?t('مسجل وفق التصريح','Declared registered'):t('غير معلوم','Unknown')} — {indicator.input.vatBasis}</p><p>{indicator.input.attribution}</p><p>{indicator.flags.join(' / ')||t('لا ملاحظات على البنية؛ المصدر غير متحقق مستقلًا','No schema flags; source independently unverified')}</p><p>{t('لا يمثل هذا المؤشر قيمة إيجارية للعقار','Not a property rental estimate')}</p></div>}
 <h4 className="mt-4 font-medium">{t('أرشيف المؤشرات التاريخية — محلي','Historical indicator archive — local')}</h4>
 <p className="text-xs">{t('السجلات المصرح بها غير مصادق عليها. الأرشيف في ذاكرة الجلسة فقط؛ انسخ النص لحفظه خارج المنصة. لا تدخل بيانات شخصية أو سرية. بصمة الملف تكشف التغيير ولا تثبت أصالة المصدر.','Declared, unauthenticated records. Session memory only; copy the archive text for external retention. Do not enter personal or confidential data. A hash detects changes, not source authenticity.')}</p>
 <p data-testid="rental-history-count" className="text-sm">{t('السجلات','Records')}: {history.records.length}</p>
 <div className="flex flex-wrap gap-2 mt-2">
 <button type="button" data-testid="rental-history-add" className={button} disabled={!indicator} onClick={()=>historyAction(()=>{setHistory(appendIndicator(history,indicator.input));setHistoryRaw('');})}>{t('حفظ المؤشر في الأرشيف','Archive reviewed indicator')}</button>
 <button type="button" data-testid="rental-history-review" className={button} onClick={()=>historyAction(()=>setHistoryView(reviewHistory(history,archiveContext())))}>{t('عرض تاريخ النطاق الحالي','Review current scope history')}</button>
 <button type="button" className={button} onClick={()=>historyAction(()=>setHistoryRaw(JSON.stringify(history)))}>{t('إعداد نص الأرشيف للنسخ','Prepare archive text for copying')}</button>
 <button type="button" className={button} disabled={!historyRaw} onClick={()=>historyAction(()=>{if(history.records.length)throw Error('CLEAR_FIRST');setHistory(importHistory(historyRaw));setHistoryRaw('');})}>{t('استعادة إلى أرشيف فارغ','Restore into empty archive')}</button>
 <button type="button" className={button} onClick={()=>{setHistory(emptyHistory());setHistoryRaw('');setHistoryView(null);setHistoryError(false);}}>{t('مسح الأرشيف المحلي','Clear local archive')}</button>
 </div>
 <label className="block mt-2 text-xs">{t('نص الأرشيف المحلي','Local archive text')}<textarea className={className} rows={4} maxLength={MAX_BYTES} value={historyRaw} onChange={e=>setHistoryRaw(e.target.value)}/></label>
 {historyError&&<p role="alert" data-testid="rental-history-error">{t('تعذر إكمال العملية: تحقق من السجل والنطاق والبصمة، أو امسح الأرشيف قبل الاستعادة.','Operation failed: check record, scope and hash, or clear archive before restoring.')}</p>}
 {historyView&&<div data-testid="rental-history-result" className="mt-2 text-xs"><p>{t('عدد الرصدات ضمن النطاق','Observations in scope')}: {historyView.observations.length}</p><ul>{historyView.observations.map((r,i)=><li key={i}>{r.input.sourceId} — {r.input.periodStart} / {r.input.periodEnd} — {r.input.observedDate} — {r.input.metric} — {t('معلن','Declared')}: {amount(r.input.valueSar)} ({r.input.priceSource==='ASKING'?t('عرض','Asking'):r.input.priceSource==='REGISTERED'?t('مسجل وفق التصريح','Declared registered'):t('غير معلوم','Unknown')}) — {t('مرجع دون الضريبة','Ex-VAT reference')}: {amount(r.referenceMetricExVatSar)} — {r.flags.join(' / ')||t('غير مصادق عليه','Unauthenticated')}</li>)}</ul></div>}
 </section>;
}
