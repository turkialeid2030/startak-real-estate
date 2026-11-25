import React,{useState,useRef,useLayoutEffect} from 'react';
import SectorFinancingRiskPanel from './SectorFinancingRiskPanel.jsx';
const {UNITS,STATUS}=require('../specialized-assets/sector-property-dcf');
const {MAX_BYTES,calculateDcfStudy,createDcfInputArchive,createDcfResearchReport,restoreDcfStudy}=require('../specialized-assets/sector-property-dcf-archive');
const F=(key,ar,en,kind='number')=>({key,ar,en,kind});
const fields=[
 F('propertyRef','مرجع العقار','Property reference','text'),F('leaseAssumptionRef','مرجع عقد أو افتراض الإيجار','Lease or rental assumption reference','text'),
 F('valuationDate','تاريخ الدراسة','Study date','date'),F('years','مدة الاستثمار بالسنوات (1–30)','Holding years (1–30)'),
 F('quantity','كمية وحدات الإيجار العقاري','Property rental unit quantity'),F('annualRentPerUnitSar','الإيجار العقاري السنوي لكل وحدة (وليس مبيعات النشاط)','Annual property rent per unit (not business sales)'),
 F('leasedFraction','نسبة تأجير العقار 0–1','Leased fraction 0–1'),F('collectionFraction','نسبة التحصيل من الإيجار المؤجر 0–1','Collection fraction of leased rent 0–1'),
 F('annualOwnerExpensesSar','مصروفات المالك السنوية','Annual owner OPEX SAR'),F('annualSustainingCapexSar','رأسمال الصيانة السنوي','Annual sustaining CAPEX SAR'),
 F('rentGrowth','نمو الإيجار السنوي ككسر','Annual rent growth as decimal'),F('expenseGrowth','نمو المصروفات السنوي ككسر','Annual expense growth as decimal'),
 F('purchasePriceSar','ثمن الشراء','Purchase price SAR'),F('acquisitionCostsSar','تكاليف الاستحواذ الإضافية','Additional acquisition costs SAR'),
 F('discountRate','معدل الخصم السنوي ككسر','Annual discount rate as decimal'),F('terminalNetSaleSar','صافي بيع العقار في نهاية المدة (صفر عند عدم افتراض بيع)','Net sale proceeds at end (zero if no sale)'),
 F('terminalEvidenceRef','مرجع افتراض صافي البيع (مطلوب عند البيع)','Net sale assumption reference (required for sale)','text'),
 F('stressRevenueReduction','خفض الإيجار وصافي البيع في الحساسية 0–1','Rent and net sale reduction 0–1'),
 F('stressExpenseIncrease','زيادة مصروفات المالك في الحساسية 0–1','Owner expense increase 0–1'),
 F('stressDiscountIncrease','زيادة معدل الخصم ككسر','Discount rate increase as decimal'),
 F('propertyIncomeOnly','الدخل من إيجار العقار فقط، لا من أرباح النشاط','Property lease income only, not operating profit','check'),
 F('businessAssetsExcluded','استبعدت المعدات والسمعة التجارية وأصول النشاط','Excluded equipment, goodwill and operating assets','check'),
 F('mixedAllocationConfirmed','راجعت توزيع دخل ومصاريف الشرائح دون تكرار','Mixed-use allocation reconciled without duplication','check'),
 F('environmentalObligationsReviewed','راجعت الالتزامات البيئية لمحطة الوقود وأدرجت تكاليف المالك','Fuel environmental obligations and owner costs reviewed as declared','check')];
const labels={SECTOR_UNSUPPORTED:['القطاع غير مدعوم','Unsupported sector'],PROPERTY_SCOPE_OR_EVIDENCE_REQUIRED:['أكمل مرجع العقار والإيجار والتاريخ وأكد الملكية الكاملة وفصل النشاط','Complete property and lease references, date, freehold and income separation'],HORIZON_OR_CAPACITY_INVALID:['راجع مدة الاستثمار ووحدات الإيجار','Check holding period and rental units'],MONEY_INVALID:['راجع المبالغ بالريال والهللة وسقف المبالغ','Check SAR/halala amounts and bounds'],RATE_INVALID:['راجع المعدلات ونطاقاتها','Check rates and bounds'],TERMINAL_ASSUMPTION_INVALID:['حدد البيع الصافي ومرجعه أو اختر عدم البيع وأدخل صفرًا','Choose supported net sale with reference, or no sale and zero'],MIXED_USE_ALLOCATION_REQUIRED:['توزيع الاستخدامات مطلوب','Mixed-use allocation required'],FUEL_ENVIRONMENTAL_REVIEW_REQUIRED:['مراجعة الالتزامات البيئية مطلوبة','Environmental review required'],CALCULATION_RANGE_INVALID:['النتيجة خارج نطاق الحساب المدعوم','Calculation outside supported range']};
const unitAr={UNIT:'وحدة',SQM:'متر مربع',ROOM_KEY:'غرفة فندقية',BED:'سرير',SEAT:'مقعد',SPACE:'موقف',MW_IT:'ميجاوات تقنية',WHOLE_PROPERTY:'العقار كاملًا (الكمية 1)'};
export default function LocalSectorPropertyDcfPanel({assetClass,locale='ar-SA'}){
 const ar=locale!=='en',[raw,setRaw]=useState({}),[out,setOut]=useState(null),[notice,setNotice]=useState('');
 const epoch=useRef(0),fileRef=useRef(null),mounted=useRef(true);
 useLayoutEffect(()=>{mounted.current=true;return()=>{mounted.current=false;epoch.current++;};},[]);
 if(!Object.hasOwn(UNITS,assetClass))return null;
 const change=(key,v)=>{epoch.current++;setNotice('');setRaw(s=>({...s,[key]:v}));setOut(null);};
 const applicable=fields.filter(f=>(f.key!=='mixedAllocationConfirmed'||assetClass==='MIXED_USE')&&(f.key!=='environmentalObligationsReviewed'||assetClass==='FUEL_STATION'));
 const state=()=>({assetClass,raw});
 const calculate=()=>{epoch.current++;setNotice('');try{setOut(calculateDcfStudy(state()));}catch{setOut({status:STATUS.HOLD,issues:['PROPERTY_SCOPE_OR_EVIDENCE_REQUIRED']});}};
 const notices={SAVED:['حُفظت المدخلات فقط.','Inputs only saved.'],REPORT:['صُدّر التقرير البحثي بعد إعادة الحساب.','Research report exported after recomputation.'],RESTORED:['استُعيدت المدخلات فقط؛ أعد الحساب.','Inputs restored only; recalculate.'],REJECTED:['رُفض الملف؛ لم تتغير المدخلات.','File rejected; inputs unchanged.'],FAILED:['تعذر التصدير؛ راجع المدخلات والنتائج.','Export failed; check inputs and results.']};
 const download=report=>{
  epoch.current++;setNotice('');
  try{const file=report?createDcfResearchReport(state()):createDcfInputArchive(state());
   if(report&&(!out||JSON.stringify(out)!==JSON.stringify(file.result)))throw Error('STALE_RESULT');
   const url=URL.createObjectURL(new Blob([JSON.stringify(file,null,2)],{type:'application/json;charset=utf-8'}));
   const a=document.createElement('a');a.href=url;a.download='startak-sector-dcf-'+assetClass.toLowerCase()+(report?'-report.json':'-inputs.json');
   try{document.body.appendChild(a);a.click();}finally{a.remove();URL.revokeObjectURL(url);}
   setNotice(report?'REPORT':'SAVED');
  }catch{setNotice('FAILED');}
 };
 const restore=async e=>{
  const file=e.target.files?.[0];if(fileRef.current)fileRef.current.value='';if(!file)return;
  const op=++epoch.current;setNotice('');const current=()=>mounted.current&&epoch.current===op;
  try{if(file.size<=0||file.size>MAX_BYTES)throw Error('SIZE');
   const bytes=await file.arrayBuffer();if(!current())return;
   const restored=restoreDcfStudy(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)),{expectedAssetClass:assetClass});
   if(!current())return;setRaw(restored.studyInputs.raw);setOut(null);setNotice('RESTORED');
  }catch{if(current())setNotice('REJECTED');}
 };
 const fmt=(v,kind='money')=>v===null?'—':new Intl.NumberFormat(ar?'ar-SA':'en-SA',kind==='rate'?{style:'percent',maximumFractionDigits:2}:{maximumFractionDigits:2}).format(v);
 const style={background:'#F4F5F5',color:'#192336'};
 return <section data-testid="sector-property-dcf" className="mt-4 rounded-xl border border-slate-600 p-3" dir={ar?'rtl':'ltr'}>
 <h4 className="text-sm font-semibold text-amber-200">{ar?'التدفقات النقدية العقارية التخصصية — شراء واحتفاظ':'Sector property DCF — acquire and hold'}</h4>
 <p className="text-xs mt-2 text-slate-300">{ar?'نموذج سنوي اسمي غير ممول، نهاية كل سنة، قبل الضرائب. وحدة الإيجار العقاري: ':'Nominal annual unlevered, end-year, pre-tax model. Property rental unit: '}{ar?unitAr[UNITS[assetClass]]:UNITS[assetClass]}{ar?'؛ لا يُستخدم إشغال النشاط أو فائض تشغيله تلقائيًا. الحقوق المقيدة والتطوير لها نماذج منفصلة.':'; operating occupancy and profit are not adopted. Limited interests and development have separate models.'}</p>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-3">
 <label className="text-xs">{ar?'الحق العقاري':'Property right'}<select data-testid="sector-dcf-propertyRight" style={style} className="block w-full p-2 rounded mt-1" value={raw.propertyRight??''} onChange={e=>change('propertyRight',e.target.value)}><option value="">{ar?'اختر':'Select'}</option><option value="FREEHOLD">{ar?'ملكية كاملة':'Freehold'}</option></select></label>
 <label className="text-xs">{ar?'افتراض الخروج':'Exit assumption'}<select data-testid="sector-dcf-terminalMode" style={style} className="block w-full p-2 rounded mt-1" value={raw.terminalMode??''} onChange={e=>change('terminalMode',e.target.value)}><option value="">{ar?'اختر':'Select'}</option><option value="NONE">{ar?'لا بيع مفترض':'No assumed sale'}</option><option value="EXPLICIT_NET_SALE">{ar?'صافي بيع محدد صراحة':'Explicit net sale proceeds'}</option></select></label>
 {applicable.map(f=><label key={f.key} className="text-xs">{ar?f.ar:f.en}{f.kind==='check'?<input data-testid={'sector-dcf-'+f.key} className="ms-2" type="checkbox" checked={raw[f.key]===true} onChange={e=>change(f.key,e.target.checked)}/>:<input data-testid={'sector-dcf-'+f.key} className="block w-full p-2 rounded mt-1" style={style} type={f.kind==='date'?'date':'text'} inputMode={f.kind==='number'?'decimal':'text'} value={raw[f.key]??''} onChange={e=>change(f.key,e.target.value)}/>}</label>)}
 </div>
 <button type="button" data-testid="sector-dcf-calculate" className="mt-3 p-2 rounded bg-slate-100 text-slate-900" onClick={calculate}>{ar?'احسب التدفقات والعوائد والحساسية':'Calculate cash flows, returns and sensitivity'}</button>
 {out&&<div data-testid="sector-dcf-result" data-status={out.status} role="status" className="mt-3 text-xs">
 {out.status===STATUS.HOLD?<ul className="text-amber-200 list-disc ps-4">{out.issues.map(code=><li key={code}>{labels[code]?.[ar?0:1]||code}</li>)}</ul>:<>
 <dl className="grid grid-cols-2 gap-2">
 {[[ar?'صافي القيمة الحالية للاستثمار':'Investment NPV','npv',out.investmentNpvSar],[ar?'معدل العائد الداخلي':'IRR','irr',out.irr],[ar?'NPV سيناريو الضغط':'Stress NPV','stress',out.scenarios.downside.npvSar]].map(([label,id,v])=><div key={id} className="border rounded p-2"><dt>{label}</dt><dd data-testid={'sector-dcf-metric-'+id}>{fmt(v,id==='irr'?'rate':'money')}</dd></div>)}
 </dl>{out.irr===null&&<p>{ar?'لا يوجد عائد داخلي وحيد مؤهل ضمن حدود الحل.':'No qualified unique IRR within solver bounds.'}</p>}
 <div className="overflow-x-auto mt-3"><table className="w-full text-xs"><thead><tr>{(ar?['السنة','الإيجار المحصل','مصروفات المالك','NOI','CAPEX','صافي البيع','التدفق','الضغط']:['Year','Collected rent','Owner OPEX','NOI','CAPEX','Net sale','Cash flow','Stress']).map(x=><th className="p-1" key={x}>{x}</th>)}</tr></thead><tbody>{out.periods.map(p=><tr key={p.year}>{[p.year,p.collectedPropertyRentSar,p.ownerExpensesSar,p.propertyNoiSar,p.sustainingCapexSar,p.terminalNetSaleSar,p.cashflowSar,p.stressCashflowSar].map((v,i)=><td key={i} className="p-1">{fmt(v)}</td>)}</tr>)}</tbody></table></div></>}
 </div>}
 {out?.status===STATUS.READY&&<SectorFinancingRiskPanel key={JSON.stringify(state())} study={state()} locale={locale}/>}
 <div className="mt-3 pt-3 border-t border-slate-600 space-y-2">
 <p className="text-xs text-slate-300">{ar?'الملفات محلية غير مشفرة؛ البصمة للتحقق من الاتساق وليست توقيعًا أو اعتمادًا.':'Local files are unencrypted; the digest verifies consistency, not identity or certification.'}</p>
 <div className="flex flex-wrap gap-2">
 <button type="button" data-testid="sector-dcf-export-inputs" className="border rounded p-2 text-xs" onClick={()=>download(false)}>{ar?'حفظ مدخلات DCF':'Save DCF inputs'}</button>
 <button type="button" data-testid="sector-dcf-export-report" disabled={out?.status!==STATUS.READY} className="border rounded p-2 text-xs disabled:opacity-50" onClick={()=>download(true)}>{ar?'تصدير تقرير DCF البحثي':'Export DCF research report'}</button>
 <button type="button" data-testid="sector-dcf-import-button" className="border rounded p-2 text-xs" onClick={()=>fileRef.current?.click()}>{ar?'استعادة المدخلات':'Restore inputs'}</button>
 <input type="file" ref={fileRef} data-testid="sector-dcf-import-file" accept=".json,application/json" className="hidden" onChange={restore}/>
 </div>
 {notice&&<p role="status" data-testid="sector-dcf-file-notice" className="text-xs">{notices[notice]?.[ar?0:1]}</p>}
 </div>
 <p className="text-amber-200 text-xs mt-3">{ar?'لا اعتماد مهني أو قرار شراء؛ الافتراضات ومصادرها غير متحققة مستقلًا.':'No appraisal or purchase authority; assumptions and sources are not independently verified.'}</p>
 </section>;
}
