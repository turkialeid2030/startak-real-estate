import React,{useState} from 'react';
const {screenRent,screenLeaseVat,RULE}=require('../reporting/rental-compliance-screen');
const empty={asOf:'',location:'UNKNOWN',locationEvidence:'',use:'UNKNOWN',leaseState:'UNKNOWN',leaseEvidence:'',objection:'UNKNOWN',referenceGrossRentSar:'',proposedGrossRentSar:'',samePeriodAndCharges:false,supply:'UNKNOWN',supplier:'UNKNOWN',supplyEvidence:'',registrationEvidence:'',basis:'UNKNOWN',rentSar:''};
export default function RentalComplianceScreen({locale='ar-SA'}){
 const ar=locale!=='en',t=(a,b)=>ar?a:b,[x,setX]=useState(empty),[result,setResult]=useState(null),[error,setError]=useState(false);
 const change=(k,v)=>{setX(old=>({...old,[k]:v}));setResult(null);setError(false);};
 const f=(k,a,b,options=null,type='text')=><label className="block text-xs">{t(a,b)}{options?<select className="block w-full text-slate-900 bg-white border rounded p-2" value={x[k]} onChange={e=>change(k,e.target.value)}>{options.map(([v,aa,bb])=><option key={v} value={v}>{t(aa,bb)}</option>)}</select>:<input className="block w-full text-slate-900 bg-white border rounded p-2" type={type} value={x[k]} maxLength={300} onChange={e=>change(k,e.target.value)}/>}</label>;
 const unknown=['UNKNOWN','غير محدد','Unknown'],money=v=>v.trim()===''?null:Number(v),fmt=v=>v==null?'—':Number(v).toLocaleString(ar?'ar-SA':'en-US',{maximumFractionDigits:2});
 const run=()=>{try{const rent=screenRent({...x,referenceGrossRentSar:money(x.referenceGrossRentSar),proposedGrossRentSar:money(x.proposedGrossRentSar)});const vat=screenLeaseVat({...x,rentSar:money(x.rentSar)});setResult({rent,vat});setError(false);}catch{setResult(null);setError(true);}};
 const labels={REVIEW_REQUIRED:['يحتاج مراجعة','Review required'],POTENTIAL_RENT_INCREASE_CONFLICT:['زيادة محتملة مخالفة','Potential rent increase conflict'],NO_INCREASE_DETECTED_ON_DECLARED_BASIS:['لم تظهر زيادة وفق البيانات المصرح بها','No increase detected on declared basis'],FIRST_LEASE_AGREEMENT_REVIEW:['تأجير لأول مرة بحسب التصريح؛ تراجع الاتفاقية','First lease declared; review agreement'],TAX_REVIEW_REQUIRED:['مراجعة ضريبية لازمة','Tax review required'],DECLARED_RESIDENTIAL_EXEMPTION_SCREEN:['فحص الإعفاء السكني المصرح به','Declared residential exemption screen'],DECLARED_STANDARD_COMMERCIAL_VAT_SCREEN:['فحص الضريبة التجارية وفق التصريح','Declared commercial VAT screen']};
 return <section className="mt-3 border rounded p-3 text-sm" data-testid="rental-compliance-screen"><h4>{t('فحص الأجرة النظامية وضريبة الإيجار','Rent regulation and VAT screen')}</h4><p>{t('فحص مستقل وفق بيانات مصرح بها، لا يعد اعتمادًا قانونيًا أو ضريبيًا. لا تنتقل النتائج إلى المحرك المالي.','Independent screening of declared facts, not legal or tax approval. Results are not passed to financial engines.')}</p><div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
 {f('asOf','تاريخ الفحص','As-of date',null,'date')}
 {f('location','النطاق العمراني','Urban scope',[unknown,['RIYADH_URBAN','داخل النطاق العمراني للرياض','Riyadh urban boundary'],['OTHER','نطاق آخر','Other']])}
 {f('locationEvidence','مرجع التحقق من النطاق','Boundary evidence reference')}
 {f('use','الاستخدام النظامي','Legal use',[unknown,['RESIDENTIAL','سكني','Residential'],['COMMERCIAL','تجاري','Commercial'],['MIXED','مختلط','Mixed'],['OTHER','أخرى','Other']])}
 {f('leaseState','حالة التأجير','Lease status',[unknown,['EXISTING','عقد قائم','Existing'],['PREVIOUSLY_LEASED_VACANT','شاغر سبق تأجيره','Vacant previously leased'],['NEVER_LEASED','لم يسبق تأجيره','Never leased']])}
 {f('leaseEvidence','مرجع العقد أو حالة التأجير','Lease history evidence reference')}
 {f('objection','حالة اعتراض الأجرة','Rent objection',[unknown,['NONE_DECLARED','لا اعتراض مصرح به','None declared'],['PENDING','قيد النظر','Pending'],['DECIDED','قرار صادر','Decision issued']])}
 {f('referenceGrossRentSar','الأجرة الإجمالية المرجعية (ريال)','Reference gross rent (SAR)')}
 {f('proposedGrossRentSar','الأجرة الإجمالية المقترحة (ريال)','Proposed gross rent (SAR)')}
 <label className="text-xs"><input type="checkbox" checked={x.samePeriodAndCharges} onChange={e=>change('samePeriodAndCharges',e.target.checked)}/> {t('الفترة والرسوم التعاقدية متطابقة في أساس المقارنة','Same period and contractual charge basis')}</label>
 {f('supply','نوع التوريد الضريبي','VAT supply type',[unknown,['PERMANENT_RESIDENTIAL','سكن دائم','Permanent residential'],['STANDARD_COMMERCIAL','تجاري اعتيادي','Standard commercial'],['OTHER_OR_MIXED','مختلط أو خاص','Mixed or special']])}
 {f('supplier','حالة تسجيل المورد','Supplier registration',[unknown,['REGISTERED','مسجل','Registered'],['UNREGISTERED','غير مسجل','Unregistered']])}
 {f('supplyEvidence','مرجع نوع التوريد','Supply evidence reference')}
 {f('registrationEvidence','مرجع التسجيل الضريبي','VAT registration reference')}
 {f('basis','أساس مبلغ الإيجار للضريبة','VAT amount basis',[unknown,['EXCLUDED','غير شامل','Excluded'],['INCLUDED','شامل','Included']])}
 {f('rentSar','مبلغ التوريد (ريال)','Supply amount (SAR)')}
 </div><button type="button" className="mt-2 border rounded p-2" onClick={run}>{t('تنفيذ الفحص','Run screen')}</button>{error&&<p role="alert">{t('راجع المدخلات المطلوبة','Review required inputs')}</p>}
 {result&&<div aria-live="polite"><p>{t(...labels[result.rent.status])}</p><p>{t('مرجع المقارنة','Screening reference')}: {fmt(result.rent.screeningReferenceSar)} — {t('الزيادة المحتملة','Potential increase')}: {fmt(result.rent.excessSar)}</p><p>{t(...labels[result.vat.status])}</p><p>{t('الصافي / الضريبة / الإجمالي','Net / VAT / gross')}: {fmt(result.vat.netSar)} / {fmt(result.vat.vatSar)} / {fmt(result.vat.grossSar)}</p></div>}
 <p><a href={RULE.source} target="_blank" rel="noreferrer">{t('الهيئة العامة للعقار — إيجار','REGA — Ejar')}</a> · <a href={RULE.vatSource} target="_blank" rel="noreferrer">{t('هيئة الزكاة والضريبة والجمارك','ZATCA')}</a> · {t('تاريخ مراجعة القاعدة','Rule reviewed')}: {RULE.reviewedThrough}</p></section>;
}
