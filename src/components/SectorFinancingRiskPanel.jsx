import React,{useState,useRef,useLayoutEffect} from 'react';
const {STATUS}=require('../specialized-assets/sector-financing-risk-research');
const {MAX_BYTES,calculateOverlay,createRiskInputArchive,createRiskReport,restoreRiskFile}=require('../specialized-assets/sector-financing-risk-archive');
const F=(key,ar,en,kind='number')=>({key,ar,en,kind});
const finance=[F('financingAssumptionRef','مرجع شروط التمويل أو عدمه','Financing assumption reference','text'),F('principalSar','مبلغ التمويل','Debt principal SAR'),F('annualRate','معدل التمويل السنوي الاسمي ككسر','Nominal annual financing rate'),F('tenorYears','مدة التمويل بالسنوات','Debt tenor years'),F('upfrontFinanceFeeSar','رسوم التمويل الأولية الإضافية','Additional upfront finance fees SAR'),F('equityDiscountRate','معدل خصم حقوق الملكية ككسر','Equity discount rate'),F('taxCashflowAssumptionRef','مرجع افتراضات التدفقات الضريبية','Tax cashflow assumption reference','text'),F('annualAdditionalTaxSar','المدفوعات الضريبية السنوية الإضافية','Additional annual tax cash outflow SAR'),F('exitAdditionalTaxSar','المدفوعات الضريبية الإضافية عند البيع','Additional exit tax cash outflow SAR'),F('additionalTaxCashflowsConfirmed','المبالغ المدخلة افتراضات نقدية وليست احتسابًا نظاميًا','Amounts are explicit cashflow assumptions, not statutory tax calculations','check'),F('noDuplicateCostsConfirmed','لم أكرر التكاليف المدرجة في نموذج العقار','No duplicate costs from base property model','check')];
const risk=[F('assumptionRef','مرجع افتراضات المخاطر','Risk assumption reference','text'),F('seed','بذرة المحاكاة (عدد صحيح موجب)','Simulation seed (positive integer)'),F('samples','عدد العينات 64–512','Samples 64–512'),F('rentVariation','نطاق تغير الإيجار 0–1','Rent variation 0–1'),F('expenseVariation','نطاق تغير المصروفات 0–1','Expense variation 0–1'),F('saleVariation','نطاق تغير صافي البيع 0–1','Net sale variation 0–1')];
const errors={BASE_DCF_REQUIRED:['أعد احتساب الدراسة العقارية أولًا','Recalculate base property study first'],FINANCING_TAX_INPUTS_INVALID:['راجع شروط التمويل والمبالغ والمعدلات والإقرارات','Check financing terms, amounts, rates and declarations'],UNFINANCED_FIELDS_MUST_BE_ZERO:['أدخل صفرًا في حقول الدين والرسوم عند عدم التمويل','Debt fields and fees must be zero if unfinanced'],DEBT_OR_EXIT_INVALID:['راجع الدين والمدة ومصدر السداد عند التخارج','Check debt, tenor and exit payoff'],EXIT_TAX_REQUIRES_SALE:['مدفوعات التخارج تتطلب بيعًا مفترضًا','Exit tax cashflow requires assumed sale'],SIMULATION_INPUTS_INVALID:['راجع نطاقات المحاكاة وعدد العينات والبذرة','Check simulation bounds, samples and seed'],EQUITY_INVALID:['حقوق الملكية غير صالحة','Invalid equity'],CALCULATION_RANGE_INVALID:['الحساب خارج النطاق','Calculation outside bounds']};
export default function SectorFinancingRiskPanel({study,locale='ar-SA'}){
 const ar=locale!=='en',[raw,setRaw]=useState({}),[out,setOut]=useState(null),[notice,setNotice]=useState('');
 const epoch=useRef(0),fileRef=useRef(null),mounted=useRef(true);
 useLayoutEffect(()=>{mounted.current=true;return()=>{mounted.current=false;epoch.current++;};},[]);
 const change=(key,value)=>{epoch.current++;setNotice('');setRaw(s=>({...s,[key]:value}));setOut(null);};
 const style={background:'#F4F5F5',color:'#192336'};
 const calculate=()=>{epoch.current++;setNotice('');try{setOut(calculateOverlay(study,raw));}catch{setOut({status:STATUS.HOLD,issues:['FINANCING_TAX_INPUTS_INVALID']});}};
 const notices={SAVED:['حُفظت المدخلات مع مرجع الدراسة الأساسية.','Inputs saved with their base study binding.'],REPORT:['صُدّر التقرير بعد إعادة الحساب.','Report exported after recomputation.'],RESTORED:['استُعيدت مدخلات التمويل والمخاطر فقط؛ أعد الحساب.','Overlay inputs only restored; recalculate.'],REJECTED:['رُفض الملف أو لم يطابق الدراسة الأساسية؛ لم تتغير المدخلات.','File rejected or base study mismatch; inputs unchanged.'],FAILED:['تعذر التصدير؛ راجع المدخلات والنتائج.','Export failed; check inputs and results.']};
 const download=report=>{
  epoch.current++;setNotice('');
  try{const file=report?createRiskReport(study,raw):createRiskInputArchive(study,raw);
   if(report&&(!out||JSON.stringify(out)!==JSON.stringify(file.result)))throw Error('STALE_RESULT');
   const url=URL.createObjectURL(new Blob([JSON.stringify(file,null,2)],{type:'application/json;charset=utf-8'}));
   const a=document.createElement('a');a.href=url;a.download='startak-sector-risk-'+study.assetClass.toLowerCase()+(report?'-report.json':'-inputs.json');
   try{document.body.appendChild(a);a.click();}finally{a.remove();URL.revokeObjectURL(url);}
   setNotice(report?'REPORT':'SAVED');
  }catch{setNotice('FAILED');}
 };
 const restore=async e=>{
  const file=e.target.files?.[0];if(fileRef.current)fileRef.current.value='';if(!file)return;
  const op=++epoch.current;setNotice('');const current=()=>mounted.current&&epoch.current===op;
  try{if(file.size<=0||file.size>MAX_BYTES)throw Error('SIZE');
   const bytes=await file.arrayBuffer();if(!current())return;
   const result=restoreRiskFile(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)),study);
   if(!current())return;setRaw(result.overlayInputs);setOut(null);setNotice('RESTORED');
  }catch{if(current())setNotice('REJECTED');}
 };
 const fmt=(v,percent=false)=>v===null?'—':new Intl.NumberFormat(ar?'ar-SA':'en-SA',percent?{style:'percent',maximumFractionDigits:2}:{maximumFractionDigits:2}).format(v);
 const field=(f,prefix)=>{const id=prefix+f.key;return <label key={id} className="text-xs">{ar?f.ar:f.en}{f.kind==='check'?<input type="checkbox" className="ms-2" data-testid={'sector-risk-'+id} checked={raw[id]===true} onChange={e=>change(id,e.target.checked)}/>:<input className="block w-full p-2 mt-1 rounded" style={style} data-testid={'sector-risk-'+id} inputMode={f.kind==='number'?'decimal':'text'} value={raw[id]??''} onChange={e=>change(id,e.target.value)}/>}</label>;};
 return <section data-testid="sector-financing-risk" className="mt-4 border border-slate-600 rounded-xl p-3">
 <h4 className="text-sm font-semibold text-amber-200">{ar?'التمويل والعوائد على حقوق الملكية ومحاكاة المخاطر':'Financing, equity returns and risk simulation'}</h4>
 <p className="text-xs mt-2">{ar?'نموذج بحثي مستقل. أقساط شهرية بمعدل ثابت مجمعة سنويًا؛ ليس عرض تمويل أو نموذج عقد إسلامي معتمد. المدفوعات الضريبية مبالغ افتراضية إضافية فقط، لا رأي ضريبي.':'Separate research overlay. Monthly fixed-rate amortization aggregated annually; not a financing offer or certified Islamic contract model. Tax cashflows are explicit additional assumptions, not tax advice.'}</p>
 <label className="block mt-2 text-xs">{ar?'نوع التمويل':'Financing mode'}<select data-testid="sector-risk-mode" style={style} className="block w-full p-2 rounded" value={raw.mode??''} onChange={e=>change('mode',e.target.value)}><option value="">{ar?'اختر':'Select'}</option><option value="UNFINANCED">{ar?'دون تمويل':'Unfinanced'}</option><option value="FIXED_RATE_AMORTIZING_PROXY">{ar?'تمويل بمعدل ثابت (تقريبي)':'Fixed-rate amortizing proxy'}</option></select></label>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-3">{finance.map(f=>field(f,'f-'))}</div>
 <p className="text-xs mt-3">{ar?'المحاكاة تستخدم توزيعات منتظمة مستقلة وصدمات ثابتة لكل مسار على مدى الاستثمار؛ ليست احتمالات سوقية معايرة.':'Simulation uses independent uniform level shocks, fixed over the horizon; not calibrated market probabilities.'}</p>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">{risk.map(f=>field(f,'r-'))}</div>
 <button type="button" data-testid="sector-risk-calculate" className="mt-3 p-2 rounded bg-slate-100 text-slate-900" onClick={calculate}>{ar?'احسب التمويل والمخاطر':'Calculate financing and risk'}</button>
 {out&&<div data-testid="sector-risk-result" data-status={out.status} role="status" className="mt-3 text-xs">{out.status===STATUS.HOLD?<ul>{out.issues.map(x=><li key={x}>{errors[x]?.[ar?0:1]||x}</li>)}</ul>:<>
 <dl className="grid grid-cols-2 gap-2">{[['equity',ar?'حقوق الملكية الأولية':'Initial equity',out.initialEquitySar,false],['npv',ar?'NPV حقوق الملكية':'Equity NPV',out.equityNpvSar,false],['irr',ar?'IRR حقوق الملكية':'Equity IRR',out.equityIrr,true],['dscr',ar?'أدنى تغطية خدمة الدين السنوية (دون سداد التخارج)':'Minimum annual DSCR (excludes exit payoff)',out.minAnnualNoiDscr,false],['p10','NPV P10',out.simulation.p10NpvSar,false],['p50','NPV P50',out.simulation.p50NpvSar,false],['p90','NPV P90',out.simulation.p90NpvSar,false],['loss',ar?'نسبة العينات ذات NPV سالب':'Share of simulated negative NPV',out.simulation.negativeNpvShare,true]].map(([id,label,v,pct])=><div key={id} className="border rounded p-2"><dt>{label}</dt><dd data-testid={'sector-risk-metric-'+id}>{fmt(v,pct)}</dd></div>)}</dl>
 <div className="overflow-x-auto mt-2"><table className="w-full"><thead><tr>{(ar?['السنة','خدمة الدين','سداد التخارج','ضريبة إضافية','ضريبة التخارج','تدفق حقوق الملكية']:['Year','Debt service','Exit payoff','Additional tax','Exit tax','Equity flow']).map(x=><th key={x}>{x}</th>)}</tr></thead><tbody>{out.periods.map(p=><tr key={p.year}>{[p.year,p.debtServiceSar,p.exitDebtPayoffSar,p.additionalTaxSar,p.exitAdditionalTaxSar,p.equityCashflowSar].map((v,i)=><td key={i}>{fmt(v)}</td>)}</tr>)}</tbody></table></div></>}</div>}
 <div className="mt-3 border-t border-slate-600 pt-3 space-y-2">
 <p className="text-xs">{ar?'ملفات محلية غير مشفرة تتضمن مدخلات الدراسة الأساسية. الاستعادة تشترط تطابق الدراسة الحالية بالكامل؛ البصمة للتحقق من الاتساق وليست توقيعًا.':'Unencrypted local files include base study inputs. Restoration requires an exact current base study match; the digest checks consistency, not identity.'}</p>
 <div className="flex flex-wrap gap-2">
 <button type="button" data-testid="sector-risk-export-inputs" className="border rounded p-2 text-xs" onClick={()=>download(false)}>{ar?'حفظ مدخلات التمويل والمخاطر':'Save financing and risk inputs'}</button>
 <button type="button" data-testid="sector-risk-export-report" className="border rounded p-2 text-xs disabled:opacity-50" disabled={out?.status!==STATUS.READY} onClick={()=>download(true)}>{ar?'تصدير تقرير التمويل والمخاطر':'Export financing and risk report'}</button>
 <button type="button" data-testid="sector-risk-import-button" className="border rounded p-2 text-xs" onClick={()=>fileRef.current?.click()}>{ar?'استعادة المدخلات':'Restore inputs'}</button>
 <input type="file" ref={fileRef} data-testid="sector-risk-import-file" accept=".json,application/json" className="hidden" onChange={restore}/>
 </div>
 {notice&&<p role="status" data-testid="sector-risk-file-notice" className="text-xs">{notices[notice]?.[ar?0:1]}</p>}
 </div>
 <p className="text-xs mt-2 text-amber-200">{ar?'لا اعتماد للتمويل أو الضرائب أو الاستثمار؛ التقرير الإضافي منفصل ولا يغير تقرير DCF الأساسي.':'No financing, tax or investment approval; the separate overlay report does not modify the base DCF report.'}</p>
 </section>;
}
