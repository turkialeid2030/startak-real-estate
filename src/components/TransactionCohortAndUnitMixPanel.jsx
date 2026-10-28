import React,{useMemo} from 'react';
const {reviewAskingVsExecuted,evaluateUnitMixRents,UNIT_KINDS}=
 require('../market/transaction-cohort-unit-mix');
const {number}=require('../market/instant-market-study');
const INPUT='w-full mt-1 min-h-[40px] rounded-lg border border-slate-600 bg-[#101c30] px-3 py-2 text-sm text-slate-100';
const nFormat=new Intl.NumberFormat('ar-SA',{maximumFractionDigits:2});
const sar=x=>Number.isFinite(x)?nFormat.format(x)+' ر.س':'غير قابل للحساب';
const bUnit=()=>({unitType:'',unitCount:'',areaPerUnitSqm:''});
const bLease=()=>({unitType:'',status:'EXECUTED',date:'',annualRent:'',areaSqm:'',
 sourceUrl:'',sourceRecordId:'',city:'',district:'',location:''});
function F({name,value,onChange,type='text',placeholder=''}){return <label className="block min-w-0 text-xs text-slate-300">
 {name}<input className={INPUT} value={value??''} type={type} dir={type==='date'?'ltr':'auto'}
  placeholder={placeholder} onChange={e=>onChange(e.target.value)}/></label>;}
function S({name,value,onChange,options}){return <label className="block min-w-0 text-xs text-slate-300">
 {name}<select className={INPUT} value={value||''} onChange={e=>onChange(e.target.value)}>
  {options.map(([k,label])=><option key={k} value={k}>{label}</option>)}
 </select></label>;}
const errors={
 SUBJECT_COMPARABLE_AREA_REQUIRED:'مساحة المقارنة للأصل غير مكتملة',
 DECLARED_UNIT_COUNT_REQUIRED:'إجمالي عدد وحدات العقار غير مكتمل',
 DECLARED_RENTABLE_AREA_REQUIRED:'إجمالي المساحة القابلة للتأجير للعقار غير مكتمل',
 UNIT_MIX_REQUIRED:'يجب إدخال فئات الوحدات ومساحاتها وعددها',
 UNIT_COUNT_DOES_NOT_RECONCILE:'عدد الوحدات في النموذج لا يطابق إجمالي وحدات العقار',
 MIX_AREA_EXCEEDS_DECLARED_RENTABLE:'مساحة الوحدات المدخلة أكبر من المساحة التأجيرية الإجمالية',
 INCOMPLETE_UNIT_CLASS_EVIDENCE:'فئة واحدة على الأقل بلا ثلاث عقود تأجير منفذة مناسبة أو بيانات كافية',
 THREE_EXECUTED_LEASES_REQUIRED:'يلزم ثلاث عقود إيجار منفذة مناسبة لهذه الفئة',
 ASSET_NEEDS_SPECIALIST_RENT_MODEL:'هذا الأصل يتطلب نموذج تأجير أو تشغيل قطاعي متخصص',
};
export default function TransactionCohortAndUnitMixPanel({subject,sales,askingOffers,asOf,
 unitMix,setUnitMix,leaseComparables,setLeaseComparables,rentAssumptions,setRentAssumptions}) {
 const expenseRatio=rentAssumptions.expenseRatio;
 const stabilizedOccupancy=rentAssumptions.stabilizedOccupancy;
 const setExpenseRatio=v=>setRentAssumptions(p=>({...p,expenseRatio:v}));
 const setStabilizedOccupancy=v=>setRentAssumptions(p=>({...p,stabilizedOccupancy:v}));
 const asOfMs=asOf instanceof Date?asOf.getTime():Date.now();
 const cohort=useMemo(()=>reviewAskingVsExecuted({
  subject,askingOffers,executedSales:sales,asOf:new Date(asOfMs),
 }),[subject,askingOffers,sales,asOfMs]);
 const rental=useMemo(()=>evaluateUnitMixRents({subject,unitMix,leaseComparables,
  expenseRatio,stabilizedOccupancy,asOf:new Date(asOfMs)}),[subject,unitMix,leaseComparables,expenseRatio,stabilizedOccupancy,asOfMs]);
 const changeMix=(i,k,v)=>setUnitMix(a=>a.map((x,j)=>i===j?{...x,[k]:v}:x));
 const changeLease=(i,k,v)=>setLeaseComparables(a=>a.map((x,j)=>i===j?{...x,[k]:v}:x));
 const isSpecialist=['HOTEL','HEALTHCARE_PROPERTY','INDUSTRIAL_PROPERTY','LAND'].includes(subject.assetType);
 return <details data-testid="cohort-unit-mix" dir="rtl"
 className="mt-5 rounded-xl border border-slate-600 bg-[#192A41] p-3 md:p-4 text-slate-100">
 <summary className="min-h-[44px] cursor-pointer text-sm font-bold text-amber-100">
  مطابقة مجموعات عروض البيع بالصفقات المنفذة + الإيجار حسب فئات الوحدات
 </summary>
 <p className="mt-2 text-xs leading-6 text-slate-300">
  هذه مقارنة بين <strong>مجموعتين مستقلتين</strong> من الأدلة، وليست إثباتًا أن الإعلان المعيّن أُفرغ بالسعر المسجل.
  لا تُحسب مقارنة إلا عند توافق فئة الأصل والمدينة أو القرب المكاني ومساحة الأصل والفترة؛
  ولا تستخدم أسعار الإعلانات لتعديل القيمة الرئيسية تلقائيًا.
 </p>
 <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
  <div className="rounded-lg border border-slate-600 p-3">
   <p className="text-xs text-slate-300">وسيط المتر المعروض للبيع</p>
   <strong className="mt-1 block text-lg">{sar(cohort.medianAskingSarPerSqm)}</strong>
   <p className="text-xs text-slate-400">عروض ملائمة: {cohort.askingCount}</p>
  </div>
  <div className="rounded-lg border border-slate-600 p-3">
   <p className="text-xs text-slate-300">وسيط المتر المنفذ للبيع</p>
   <strong className="mt-1 block text-lg">{sar(cohort.medianExecutedSarPerSqm)}</strong>
   <p className="text-xs text-slate-400">صفقات منفذة مناسبة: {cohort.executedCount}</p>
  </div>
 </div>
 <div className="mt-3 rounded-lg border border-slate-600 p-3 text-xs leading-7">
  <p>الفارق بين وسيطي مجموعتي السوق: <strong>{sar(cohort.askingMinusExecutedSarPerSqm)}</strong>
  {Number.isFinite(cohort.askingMinusExecutedPct)?' ('+cohort.askingMinusExecutedPct+'% من وسيط المنفذ)':''}</p>
  <p>حالات تطابق الحي فقط: {cohort.districtOnlyEvidence}. الحالة: {cohort.status==='COHORT_GAP_REVIEW_ONLY'?'دليل سياقي للمراجعة':'لا توجد مجموعتان مؤهلتان (3 عروض و3 صفقات على الأقل)'}</p>
  <p className="text-amber-200">الفارق ليس خصم تفاوض محققًا، ولا يثبت بيع إعلان محدد.</p>
 </div>
 {!isSpecialist&&<>
 <h4 className="mt-5 font-semibold text-sm text-amber-100">المزيج التأجيري للمجمع أو العقار</h4>
 <p className="mt-2 text-xs text-slate-300">أدخل عدد ومساحة كل فئة، ثم ثلاثة عقود إيجار فعلية مؤرخة على الأقل لكل فئة. تُحسب الأجرة السنوية الجديدة من هذه العقود، وليس من الإيجار السابق للعقار.</p>
 {unitMix.map((r,i)=><div key={'u'+i} className="mt-3 grid grid-cols-1 sm:grid-cols-4 gap-2 rounded-lg border border-slate-700 p-3">
  <S name="فئة الوحدة" value={r.unitType} onChange={v=>changeMix(i,'unitType',v)}
    options={[['','اختر فئة'],...Object.entries(UNIT_KINDS)]}/>
  <F name="عدد وحدات الفئة" value={r.unitCount} onChange={v=>changeMix(i,'unitCount',v)}/>
  <F name="متوسط المساحة لكل وحدة (م²)" value={r.areaPerUnitSqm} onChange={v=>changeMix(i,'areaPerUnitSqm',v)}/>
  <button type="button" className="min-h-[40px] rounded-lg border border-rose-700 px-3 text-xs text-rose-200"
    onClick={()=>setUnitMix(a=>a.filter((_,j)=>i!==j))}>حذف الفئة</button>
 </div>)}
 <button type="button" aria-label="إضافة فئة وحدات" className="mt-3 min-h-[40px] rounded-lg border border-amber-600 px-3 py-2 text-xs"
  onClick={()=>setUnitMix(a=>a.length<30?[...a,bUnit()]:a)}>+ إضافة فئة وحدات</button>
 <h4 className="mt-5 font-semibold text-sm text-amber-100">عقود الإيجار المقارنة بحسب نوع الوحدة</h4>
 {leaseComparables.map((r,i)=><div key={'l'+i} className="mt-3 rounded-lg border border-slate-700 p-3">
  <div className="flex items-center justify-between">
   <strong className="text-xs">عقد مقارن {i+1}</strong>
   <button type="button" className="min-h-[36px] px-3 text-xs text-rose-200"
    onClick={()=>setLeaseComparables(a=>a.filter((_,j)=>i!==j))}>حذف</button>
  </div>
  <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
   <S name="نوع الوحدة المطابق" value={r.unitType} onChange={v=>changeLease(i,'unitType',v)}
    options={[['','اختر فئة'],...Object.entries(UNIT_KINDS)]}/>
   <S name="صفة الدليل" value={r.status} onChange={v=>changeLease(i,'status',v)}
    options={[['EXECUTED','عقد منفذ/موثق'],['ASKING','إعلان فقط — يستبعد']]}/>
   <F name="تاريخ العقد" type="date" value={r.date} onChange={v=>changeLease(i,'date',v)}/>
   <F name="الإيجار السنوي للعقد (ريال)" value={r.annualRent} onChange={v=>changeLease(i,'annualRent',v)}/>
   <F name="المساحة التأجيرية للعقد (م²)" value={r.areaSqm} onChange={v=>changeLease(i,'areaSqm',v)}/>
   <F name="معرّف غير شخصي للعقد" value={r.sourceRecordId} onChange={v=>changeLease(i,'sourceRecordId',v)}/>
   <F name="المدينة" value={r.city} onChange={v=>changeLease(i,'city',v)}/>
   <F name="الحي" value={r.district} onChange={v=>changeLease(i,'district',v)}/>
   <F name="الموقع أو الإحداثيات (اختياري مع مطابقة الحي)" value={r.location} onChange={v=>changeLease(i,'location',v)}/>
   <div className="sm:col-span-2 lg:col-span-3">
    <F name="رابط الدليل الأصلي HTTPS" value={r.sourceUrl} onChange={v=>changeLease(i,'sourceUrl',v)} placeholder="https://..."/>
   </div>
  </div>
 </div>)}
 <button type="button" aria-label="إضافة عقد إيجار مقارن" className="mt-3 min-h-[40px] rounded-lg border border-amber-600 px-3 py-2 text-xs"
  onClick={()=>setLeaseComparables(a=>a.length<250?[...a,{...bLease(),city:subject.city,district:subject.district}]:a)}>
  + إضافة عقد إيجار مقارن
 </button>
 <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
  <F name="نسبة الإشغال المستقرة (0–1)" value={stabilizedOccupancy} onChange={setStabilizedOccupancy}/>
  <F name="نسبة مصروفات التشغيل من الدخل (0–1)" value={expenseRatio} onChange={setExpenseRatio}/>
 </div>
 <div className="mt-4 rounded-lg border border-slate-600 p-3 text-xs leading-7">
  <p>الوحدات المدخلة: {rental.totalModelUnits} من {rental.totalDeclaredUnits??'غير محدد'}،
   المساحة الإجمالية للمزيج: {nFormat.format(rental.totalModelRentableSqm)} م²</p>
  {rental.segments.map((x,i)=><p key={i}>
   {UNIT_KINDS[x.unitType]||'فئة غير محددة'}: {x.comparableLeaseCount} عقود مؤهلة،
   الإيجار السنوي السوقي للفئة: {sar(x.annualGrossMarketRentSar)}
  </p>)}
  <p className="mt-2">الإيجار السوقي السنوي الإجمالي المحتمل: <strong>{sar(rental.grossPotentialNewAnnualRentSar)}</strong></p>
  <p>الإيجار بعد نسبة الإشغال: <strong>{sar(rental.stabilizedAnnualRentSar)}</strong></p>
  <p>صافي الدخل التشغيلي المبدئي: <strong>{sar(rental.stabilizedNoiSar)}</strong></p>
  <p>الإيجار السابق (للمقارنة فقط، لا يدخل في التسعير): {sar(rental.historicAnnualRentSar)}</p>
  {rental.errors.length>0&&<p className="text-amber-200 mt-2">
   أسباب وقف التقدير: {rental.errors.map(x=>errors[x]||x).join('؛ ')}
  </p>}
  {rental.warnings.length>0&&<p className="text-amber-200">
   تنبيهات: {rental.warnings.join('؛ ')}
  </p>}
  <p className="text-slate-400 mt-2">العقود بيانات أدخلها المستخدم ولم يتحقق النظام منها مستقلاً.
   هذا ليس اختبارًا للحد الأعلى القانوني للأجرة، ولا تقرير تثمين معتمدًا.</p>
 </div>
 </>}
 {isSpecialist&&<p className="mt-3 text-xs text-amber-200">
  هذا الأصل يحتاج نموذجًا متخصصًا: الفنادق بالغرف والإشغال وADR/RevPAR، والأنشطة الصحية والصناعية
  بعقودها وتجهيزاتها، والأرض بمنهج المبيعات/التطوير أو عقد انتفاع ملائم. نموذج الشقق والمعارض لا ينطبق عليه تلقائيًا.
 </p>}
 </details>;
}
