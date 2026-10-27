import React, { useMemo, useState } from 'react';
const { ASSET_TYPES, extractCoordinates, evaluateMarketStudy } = require('../market/instant-market-study');

const INPUT = 'w-full rounded-lg border border-slate-600 bg-[#101c30] px-3 py-2 text-sm text-slate-100';
const createRow = () => ({ assetType:'', status:'ASKING', price:'', annualRent:'', builtArea:'', landArea:'',
  rentableArea:'', date:'', location:'', sourceUrl:'' });
const blankProject = () => ({ name:'', status:'PLANNED', location:'', sourceUrl:'', impactPct:'' });
const MONEY = new Intl.NumberFormat('ar-SA', { maximumFractionDigits: 0 });
const money = n => Number.isFinite(n) ? MONEY.format(n) + ' ر.س' : 'غير قابل للحساب';
const fixed = n => Number.isFinite(n) ? n.toFixed(2) : '—';
const labelMap = {
  ASSET_TYPE_REQUIRED:'نوع العقار غير محدد', COORDINATES_REQUIRED:'أدخل رابط خرائط يتضمن إحداثيات أو ألصق خط العرض والطول',
  COMPARISON_AREA_REQUIRED:'المساحة المبنية الإجمالية أو مساحة الأرض غير مكتملة',
  RENTABLE_AREA_REQUIRED:'المساحة التأجيرية غير مكتملة',
  BUILDING_COUNT_REQUIRED:'عدد المباني غير مكتمل',
  UNIT_COUNT_REQUIRED:'عدد الوحدات غير مكتمل',
  OCCUPANCY_INVALID:'نسبة الإشغال يجب أن تكون بين 0 و1',
  EXPENSE_RATIO_INVALID:'نسبة المصروفات يجب أن تكون بين 0 و1',
  CAP_RATE_INVALID:'معدل الرسملة يجب أن يكون أكبر من صفر وأقل من 1',
};
function Field({ title, value, onChange, type='text', placeholder='' }) {
  return <label className="block min-w-0 text-xs text-slate-300">{title}
    <input className={INPUT+' mt-1'} type={type} value={value} placeholder={placeholder}
      onChange={e => onChange(e.target.value)} dir={type==='date'?'ltr':'auto'}/>
  </label>;
}
function Select({ title, value, onChange, options }) {
  return <label className="block min-w-0 text-xs text-slate-300">{title}
    <select className={INPUT+' mt-1'} value={value} onChange={e=>onChange(e.target.value)}>
      {options.map(([v,t])=><option key={v} value={v}>{t}</option>)}
    </select>
  </label>;
}
const assetOptions = [['','اختر نوع العقار'],...Object.entries(ASSET_TYPES).map(([id,ar])=>[id,ar])];
const statusOptions = [['ASKING','عرض/طلب غير منفّذ — مستبعد'],['EXECUTED','صفقة أو عقد منفّذ — إقرار المستخدم']];
function ComparisonTable({ title, kind, rows, setRows, assetType }) {
  const isSale = kind==='sale';
  const update=(i,key,value)=>setRows(old=>old.map((r,j)=>j===i?{...r,[key]:value}:r));
  return <section className="rounded-xl border border-slate-700 p-3">
    <h4 className="font-semibold text-sm text-amber-200">{title}</h4>
    <p className="text-xs text-slate-400 mt-1">يلزم ثلاث مقارنات منفّذة على الأقل من نفس النوع ضمن 5 كم وبحد أقصى 365 يومًا، مع تاريخ ورابط مصدر وموقع كل مقارنة. العروض لا تدخل في الحساب.</p>
    {rows.map((row,i)=><div key={i} className="border-b border-slate-700 py-3">
      <div className="flex items-center justify-between mb-2">
        <strong className="text-xs text-slate-200">المقارنة {i+1}</strong>
        {rows.length>3&&<button type="button" className="text-xs text-rose-300" onClick={()=>setRows(old=>old.filter((_,j)=>j!==i))}>حذف</button>}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        <Select title="نوع العقار المقارن" value={row.assetType} onChange={v=>update(i,'assetType',v)} options={assetOptions}/>
        <Select title="طبيعة السعر" value={row.status} onChange={v=>update(i,'status',v)} options={statusOptions}/>
        <Field title={isSale?'قيمة البيع الفعلية (ر.س)':'الإيجار السنوي المتعاقد عليه (ر.س)'}
          value={isSale?row.price:row.annualRent} onChange={v=>update(i,isSale?'price':'annualRent',v)}/>
        <Field title={isSale?(assetType==='LAND'?'مساحة أرض المقارنة م²':'مساحة البناء الإجمالية للمقارنة م²'):'المساحة التأجيرية للمقارنة م²'}
          value={isSale?(assetType==='LAND'?row.landArea:row.builtArea):row.rentableArea}
          onChange={v=>update(i,isSale?(assetType==='LAND'?'landArea':'builtArea'):'rentableArea',v)}/>
        <Field title="تاريخ الصفقة/العقد" type="date" value={row.date} onChange={v=>update(i,'date',v)}/>
        <Field title="موقع المقارنة (رابط أو إحداثيات)" value={row.location} onChange={v=>update(i,'location',v)} placeholder="24.7,46.7"/>
        <div className="sm:col-span-2 lg:col-span-3">
          <Field title="رابط مصدر الصفقة أو العقد (HTTPS)" value={row.sourceUrl} onChange={v=>update(i,'sourceUrl',v)} placeholder="https://..."/>
        </div>
      </div>
    </div>)}
    <button type="button" className="mt-3 rounded-lg border border-amber-600 px-3 py-2 text-xs text-amber-100" onClick={()=>setRows(old=>old.length>=15?old:[...old,createRow()])}>+ إضافة مقارنة</button>
  </section>;
}
export default function PropertyMarketLocationPanel() {
  const [subject,setSubject]=useState({
    name:'',assetType:'RESIDENTIAL_COMPOUND',city:'الرياض',district:'',location:'',
    landArea:'',builtArea:'',rentableArea:'',buildingCount:'',unitCount:'',floorCount:'',
    historicalAnnualRent:'',leaseHistory:'UNKNOWN',urbanBoundary:'UNKNOWN',
  });
  const [assumptions,setAssumptions]=useState({occupancy:'0.9',expenseRatio:'0.20',capRate:'0.075'});
  const [sales,setSales]=useState(Array.from({length:3},createRow));
  const [rentals,setRentals]=useState(Array.from({length:3},createRow));
  const [projects,setProjects]=useState([blankProject()]);
  const [message,setMessage]=useState('');
  const updateSubject=(key,value)=>setSubject(current=>({...current,[key]:value}));
  const updateAssumption=(key,value)=>setAssumptions(current=>({...current,[key]:value}));
  const report=useMemo(()=>evaluateMarketStudy({subject,sales,rentals,projects,assumptions}),[subject,sales,rentals,projects,assumptions]);
  const coords=extractCoordinates(subject.location);
  const updateProject=(i,key,v)=>setProjects(old=>old.map((r,j)=>j===i?{...r,[key]:v}:r));
  const exportJson=()=>{
    try {
      const blob=new Blob([JSON.stringify({kind:'STARTAK_PERSONAL_MARKET_STUDY',subject,assumptions,
        sales,rentals,projects,report,exportedAt:new Date().toISOString()},null,2)],{type:'application/json'});
      const url=URL.createObjectURL(blob),a=document.createElement('a');
      a.href=url;a.download='startak-location-market-personal-study.json';
      document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
      setMessage('صُدّرت نسخة شخصية تتضمن المدخلات والافتراضات ومصادرها، دون اعتماد مهني.');
    } catch { setMessage('تعذر تصدير الدراسة.'); }
  };
  const latestWindow='آخر 365 يومًا من تاريخ الحساب، وليست بالضرورة معاملات نُفذت اليوم';
  return <section dir="rtl" data-testid="location-market-study" className="mt-6 rounded-2xl border border-[#4B607A] bg-[#141F35] p-4 md:p-6 text-slate-100">
    <h2 className="text-lg font-bold text-amber-100">موقع العقار والقيمة السوقية والإيجار المستهدف — دراسة شخصية</h2>
    <p className="text-xs text-slate-300 leading-6 mt-2">
      أدخل رابط Google Maps غير المختصر المتضمن إحداثيات العقار أو الإحداثيات مباشرة.
      هذه الحاسبة لا تجلب معاملات حية تلقائيًا؛ تعالج فقط مقارنات مثبتة المصدر يضيفها المستخدم وتُظهر نتائج سيناريو غير معتمدة.
    </p>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
      <Field title="اسم العقار" value={subject.name} onChange={v=>updateSubject('name',v)} />
      <Select title="نوع العقار" value={subject.assetType} onChange={v=>updateSubject('assetType',v)} options={assetOptions}/>
      <Field title="المدينة" value={subject.city} onChange={v=>updateSubject('city',v)}/>
      <Field title="الحي" value={subject.district} onChange={v=>updateSubject('district',v)}/>
      <div className="md:col-span-2"><Field title="رابط اللوكيشن من Google Maps أو الإحداثيات" value={subject.location}
        onChange={v=>updateSubject('location',v)} placeholder="https://www.google.com/maps/@24.7,46.7,17z"/></div>
      <Field title="مساحة الأرض (م²)" value={subject.landArea} onChange={v=>updateSubject('landArea',v)}/>
      <Field title="إجمالي المساحات المبنية لكل المباني (م²)" value={subject.builtArea} onChange={v=>updateSubject('builtArea',v)}/>
      <Field title="إجمالي المساحة القابلة للتأجير (م²)" value={subject.rentableArea} onChange={v=>updateSubject('rentableArea',v)}/>
      <Field title="عدد العمائر/المباني" value={subject.buildingCount} onChange={v=>updateSubject('buildingCount',v)}/>
      <Field title="عدد الوحدات (شقق/مكاتب/معارض)" value={subject.unitCount} onChange={v=>updateSubject('unitCount',v)}/>
      <Field title="عدد الأدوار (للتوثيق)" value={subject.floorCount} onChange={v=>updateSubject('floorCount',v)}/>
      <Field title="الإيجار السنوي السابق (مرجع نظامي فقط)" value={subject.historicalAnnualRent} onChange={v=>updateSubject('historicalAnnualRent',v)}/>
      <Select title="تاريخ إشغال/تأجير الوحدة" value={subject.leaseHistory} onChange={v=>updateSubject('leaseHistory',v)}
        options={ [['UNKNOWN','غير معروف'],['PREVIOUSLY_LEASED','سبق تأجيرها'],['FIRST_LEASE','أول تأجير']] }/>
      <Select title="داخل النطاق العمراني للرياض؟" value={subject.urbanBoundary} onChange={v=>updateSubject('urbanBoundary',v)}
        options={ [['UNKNOWN','لم يتم التحقق'],['YES','نعم — بحاجة لإثبات'],['NO','لا']] }/>
    </div>
    <p className="text-xs text-slate-300 mt-3" role="status">
      {coords ? <>الإحداثيات المستخرجة: {fixed(coords.lat)}، {fixed(coords.lng)} — <a target="_blank" rel="noopener noreferrer" className="underline text-sky-300"
        href={`https://www.google.com/maps/search/?api=1&query=${coords.lat}%2C${coords.lng}`}>عرض النقطة على الخريطة</a></>
        : 'لم تُستخرج إحداثيات بعد. روابط maps.app.goo.gl المختصرة لا تكفي؛ افتح الرابط وانسخ الإحداثيات.'}
    </p>
    <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
      <Field title="الإشغال المتوقع ككسر (0.9 = 90%)" value={assumptions.occupancy} onChange={v=>updateAssumption('occupancy',v)} />
      <Field title="مصروفات المالك من الإيراد ككسر" value={assumptions.expenseRatio} onChange={v=>updateAssumption('expenseRatio',v)}/>
      <Field title="معدل الرسملة ككسر" value={assumptions.capRate} onChange={v=>updateAssumption('capRate',v)}/>
    </div>
    <p className="text-xs text-amber-200 mt-2">النسب الموضوعة مبدئيًا أمثلة قابلة للتعديل وليست تقديرات سوقية للحي أو العقار.</p>
    <div className="mt-5 space-y-4">
      <ComparisonTable title="مقارنات البيع — لإنشاء مؤشر القيمة" kind="sale" rows={sales} setRows={setSales} assetType={subject.assetType}/>
      <ComparisonTable title="مقارنات الإيجار الجديد — مستقل عن الإيجار السابق" kind="rent" rows={rentals} setRows={setRentals} assetType={subject.assetType}/>
    </div>
    <section className="mt-5 rounded-xl border border-slate-700 p-3">
      <h4 className="text-sm font-semibold text-amber-100">المشروعات المحيطة ومحفزات القيمة</h4>
      <p className="text-xs text-slate-300 mt-1">أدخل مشروعات موثقة على مسافة 10 كم. لا يطبق أي أثر سعري تلقائي؛ نسبة الأثر افتراض منفصل قد يؤدي إلى احتساب مزدوج إذا انعكس سابقًا في المقارنات.</p>
      {projects.map((row,i)=><div key={i} className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 border-b border-slate-700 pb-3">
        <Field title="اسم المشروع/المرفق" value={row.name} onChange={v=>updateProject(i,'name',v)}/>
        <Select title="مرحلة المشروع" value={row.status} onChange={v=>updateProject(i,'status',v)}
          options={ [['PLANNED','معلن/مخطط'],['UNDER_CONSTRUCTION','تحت الإنشاء'],['OPERATING','تشغيل فعلي'],['UNKNOWN','غير متحقق']] }/>
        <Field title="رابط موقعه أو إحداثياته" value={row.location} onChange={v=>updateProject(i,'location',v)}/>
        <Field title="رابط مصدر المشروع الرسمي" value={row.sourceUrl} onChange={v=>updateProject(i,'sourceUrl',v)}/>
        <Field title="أثر افتراضي موثق (0.03 = 3%)" value={row.impactPct} onChange={v=>updateProject(i,'impactPct',v)}/>
        {projects.length>1&&<button type="button" onClick={()=>setProjects(old=>old.filter((_,j)=>j!==i))} className="text-xs text-rose-300">حذف المشروع</button>}
      </div>)}
      <button type="button" className="mt-3 rounded-lg border border-amber-600 px-3 py-2 text-xs text-amber-100"
        onClick={()=>setProjects(old=>old.length>=10?old:[...old,blankProject()])}>+ إضافة مشروع محيط</button>
    </section>
    <div className="mt-5 rounded-xl border border-amber-700/60 bg-[#1B2B43] p-4">
      <h3 className="font-bold text-amber-100">نتيجة الحساب وقت الطلب — ليست تثمينًا مهنيًا</h3>
      <p className="text-xs text-slate-300 mt-1">{latestWindow}. وقت الحساب: {report.asOf.slice(0,19).replace('T',' ')} UTC</p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
        <div><span className="text-xs text-slate-400">القيمة التقديرية الحسابية اليوم</span><strong className="block text-lg">{money(report.todayValueScenarioSar)}</strong></div>
        <div><span className="text-xs text-slate-400">الإيجار السوقي السنوي المحتمل</span><strong className="block text-lg">{money(report.marketAnnualRentPotentialSar)}</strong></div>
        <div><span className="text-xs text-slate-400">الإيجار السنوي المتوقع تحصيله بعد الإشغال</span><strong className="block text-lg">{money(report.expectedCollectedAnnualRentSar)}</strong></div>
        <div><span className="text-xs text-slate-400">مؤشر البيع بالمقارنات</span><strong className="block">{money(report.saleIndicationSar)}</strong></div>
        <div><span className="text-xs text-slate-400">مؤشر الدخل بالرسملة</span><strong className="block">{money(report.incomeIndicationSar)}</strong></div>
        <div><span className="text-xs text-slate-400">متوسط الإيجار السوقي لكل وحدة (تقريبي)</span><strong className="block">{money(report.averageMarketAnnualRentPerUnitSar)}</strong></div>
      </div>
      <p className="text-xs text-slate-300 mt-3">مقارنات البيع المقبولة: {report.eligibleSalesCount} من {sales.length} | الإيجار المقبولة: {report.eligibleRentalsCount} من {rentals.length} | المشروعات ذات مصدر: {report.nearbyProjects.length}</p>
      <p className="text-xs text-amber-200 mt-2">الأثر الافتراضي للمشروعات على القيمة، منفصل عن الأساس: {money(report.projectScenarioSar)}. يتطلب إثباتًا مستقلًا لعلاقة التأثير وليس مجرد قرب المشروع.</p>
      <p className="text-xs text-rose-200 mt-2">
        الإيجار المسموح نظاميًا: غير محسوب آليًا. {report.rentRegulation==='EXISTING_RENT_FREEZE_REQUIRES_EJAR_REVIEW'
          ? 'راجع قيمة آخر عقد إيجار والضوابط الخاصة بالرياض قبل التسعير التعاقدي.'
          : 'يلزم التحقق من النطاق العمراني وتاريخ التأجير وضوابط العلاقة الإيجارية.'}
      </p>
      {!!report.issues.length&&<p className="mt-2 text-xs text-amber-300">بيانات بحاجة لاستكمال: {report.issues.map(x=>labelMap[x]||x).join('؛ ')}.</p>}
      <p className="mt-2 text-xs text-slate-400">بيانات مقارنة يُقر بها المستخدم ولم يُتحقق منها مستقلاً. لا توجد تغذية لحظية مرخّصة متصلة. لا تستعمل هذه النتيجة كتقييم رسمي أو أساس قرار شراء ملزم.</p>
    </div>
    <div className="flex flex-wrap gap-3 mt-4">
      <button type="button" onClick={exportJson} className="rounded-lg bg-[#C9A24C] px-4 py-2 text-xs font-semibold text-[#141F35]">تصدير الدراسة الأولية JSON</button>
      <a className="rounded-lg border border-slate-600 px-4 py-2 text-xs text-sky-300" target="_blank" rel="noopener noreferrer" href="https://rei.rega.gov.sa/">المؤشرات العقارية الرسمية</a>
      <a className="rounded-lg border border-slate-600 px-4 py-2 text-xs text-sky-300" target="_blank" rel="noopener noreferrer" href="https://srem.moj.gov.sa/">الصفقات المسجلة — وزارة العدل</a>
      <a className="rounded-lg border border-slate-600 px-4 py-2 text-xs text-sky-300" target="_blank" rel="noopener noreferrer" href="https://opendata.rcrc.gov.sa/">بيانات ومشاريع مدينة الرياض المكانية</a>
    </div>
    {message&&<p role="status" className="text-xs text-slate-200 mt-2">{message}</p>}
  </section>;
}
