import React,{useEffect,useState} from 'react';
const {ASSET_CLASS}=require('../project-model/project-profile');
const {
 EVIDENCE_TYPES,HOTEL_TYPES,INDUSTRIAL_TYPES,
 emptySpecialistReferenceIntake,normalizeSpecialistReferenceIntake,
}=require('../app/specialist-reference-intake');

const LABELS=Object.freeze({
 'ar-SA':{
  heading:'تسجيل مراجع أدلة العقار المتخصص — غير متحقق منها',
  notice:'سجّل معرفات ملفات مرجعية فقط، دون أسماء أفراد أو مستندات أو روابط شخصية. تسجيل المرجع لا يثبت صحة المستند أو حقوق استخدامه ولا يعد اعتمادًا من مقيم مرخص.',
  type:'نوع العقار المتخصص',property:'مرجع العقار',asOf:'تاريخ حصر المراجع',
  choose:'حدد نوع العقار',save:'حفظ قائمة المراجع غير المتحقق منها',
  count:'المراجع المسجلة',error:'لم تُحفظ المراجع: تحقق من نوع الأصل وصحة مرجع الملف والتاريخ. لا تُدخل روابط أو بيانات أشخاص.',
  invalid:'بيانات المراجع المحفوظة غير صالحة أو لا تطابق فئة العقار. يلزم تصحيحها قبل حفظ إصدار جديد.',
  c61:'نتيجة فحص متطلبات الأدلة الداخلي: معلّق. المرجع النصي لا يثبت التفتيش أو اعتماد المقيم.',
 },
 en:{
  heading:'Specialist property evidence reference intake — unverified',
  notice:'Record reference IDs only, not personal names, document files or personal URLs. A reference ID does not authenticate a document, its data rights or a licensed appraiser.',
  type:'Specialist property subtype',property:'Property reference',asOf:'Reference inventory date',
  choose:'Select subtype',save:'Save unverified evidence reference list',
  count:'References recorded',error:'References not saved: validate subtype, reference identifiers and date. Do not enter URLs or personal information.',
  invalid:'Stored reference intake is invalid or does not match this asset classification. Correct it before saving a new version.',
  c61:'Internal C61 evidence checks: ON HOLD. A textual reference is not inspection, provenance authentication or a licensed appraisal.',
 }
});
const NAMES=Object.freeze({
 zoning:['التخطيط والاستخدام المسموح','Zoning and permitted use'],
 titleInterest:['الصك والحقوق العقارية','Title and property interests'],
 inspection:['المعاينة الفنية','Physical inspection'],
 utilityService:['المرافق والخدمات','Utilities and services'],
 fireLifeSafety:['الحريق والسلامة','Fire and life safety'],
 environmentalContamination:['السلامة البيئية والتلوث','Environment and contamination'],
 deferredCapex:['الإصلاحات وتكاليف الإحلال','Deferred capital repairs'],
 leaseRights:['عقود الإيجار والانتفاع','Lease and occupation rights'],
 professionalSpecialistReview:['مراجعة المقيم المتخصص','Specialist professional review'],
});
const SUBTYPES=Object.freeze({
 HOTEL_FULL_SERVICE:['فندق شامل الخدمات','Full-service hotel'],
 HOTEL_LIMITED_SERVICE:['فندق محدود الخدمات','Limited-service hotel'],
 SERVICED_APARTMENTS:['شقق فندقية','Serviced apartments'],
 RESORT:['منتجع','Resort'],
 WAREHOUSE:['مستودع','Warehouse'],
 DISTRIBUTION_CENTER:['مركز توزيع','Distribution center'],
 COLD_STORAGE:['مستودع تبريد','Cold storage'],
 LIGHT_INDUSTRIAL:['صناعي خفيف','Light industrial'],
 FACTORY:['مصنع','Factory'],
 WORKSHOP:['ورشة','Workshop'],
 YARD:['ساحة صناعية','Industrial yard'],
 OTHER:['صناعي آخر','Other industrial'],
});
const STYLE={width:'100%',padding:'8px',borderRadius:7,border:'1px solid #506080',
 color:'#F1E9D7',background:'#152239',fontSize:12};

function initialize(value,assetClass){
 try{return {draft:normalizeSpecialistReferenceIntake(value,assetClass),invalid:false};}
 catch{return {draft:emptySpecialistReferenceIntake(assetClass),invalid:true};}
}
export default function SpecialistEvidenceIntakePanel({
 locale='ar-SA',valuationCase=null,onChangeValuationCase,runtime=null
}){
 const assetClass=valuationCase?.classification?.assetClass;
 const enabled=[ASSET_CLASS.HOSPITALITY,ASSET_CLASS.INDUSTRIAL_LOGISTICS].includes(assetClass);
 const [state,setState]=useState(()=>enabled?initialize(valuationCase?.institutionalEvidence?.specialistIntake,assetClass):null);
 const [error,setError]=useState(false);
 useEffect(()=>{
  setState(enabled?initialize(valuationCase?.institutionalEvidence?.specialistIntake,assetClass):null);
  setError(false);
 },[valuationCase,assetClass,enabled]);
 if(!enabled||!state)return null;
 const rtl=locale!=='en',text=LABELS[rtl?'ar-SA':'en'],cols=rtl?0:1;
 const draft=state.draft;
 const assessment=runtime?.specialistRoute?.referenceIntake||null;
 const savedCount=assessment?.submittedReferenceCount||0;
 const setField=(key,value)=>setState(cur=>({...cur,draft:{...cur.draft,[key]:value},invalid:false}));
 const setRef=(key,value)=>setState(cur=>({...cur,draft:{
   ...cur.draft,evidenceRefs:{...cur.draft.evidenceRefs,[key]:value},
 },invalid:false}));
 const submit=()=>{
  try{
   const valid=normalizeSpecialistReferenceIntake(draft,assetClass);
   onChangeValuationCase({
    ...valuationCase,
    institutionalEvidence:{...(valuationCase.institutionalEvidence||{}),specialistIntake:valid},
   });
   setError(false);
  }catch{setError(true);}
 };
 const typeList=assetClass===ASSET_CLASS.HOSPITALITY?HOTEL_TYPES:INDUSTRIAL_TYPES;
 return <section data-testid="specialist-intake-panel" dir={rtl?'rtl':'ltr'}
    className="mt-3 rounded-xl p-4" style={{background:'#17253D',border:'1px solid #53607A',color:'#EDE6D6'}}>
  <h3 className="mb-1 text-sm font-semibold">{text.heading}</h3>
  <p className="mb-3 text-xs leading-6">{text.notice}</p>
  {state.invalid||runtime?.specialistRoute?.referenceIntakeInvalid?
   <p data-testid="specialist-intake-invalid" className="mb-2 text-xs" style={{color:'#F3B070'}}>{text.invalid}</p>:null}
  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
   <label className="text-xs">{text.type}
    <select data-testid="specialist-intake-subtype" aria-label={text.type} value={draft.assetSubtype}
      onChange={e=>setField('assetSubtype',e.target.value)} style={STYLE}>
     <option value="">{text.choose}</option>
     {typeList.map(type=><option key={type} value={type}>{SUBTYPES[type][cols]}</option>)}
    </select>
   </label>
   <label className="text-xs">{text.property}
    <input data-testid="specialist-intake-property-ref" aria-label={text.property}
      value={draft.propertyRef} onChange={e=>setField('propertyRef',e.target.value)}
      type="text" maxLength={80} style={STYLE} placeholder={rtl?'مثال: عقار-١':'Example: Property-1'}/>
   </label>
   <label className="text-xs">{text.asOf}
    <input data-testid="specialist-intake-as-of" aria-label={text.asOf}
      value={draft.asOf} onChange={e=>setField('asOf',e.target.value)}
      type="date" style={STYLE}/>
   </label>
  </div>
  <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
   {EVIDENCE_TYPES.map(type=><label className="text-xs" key={type}>
    {NAMES[type][cols]}
    <input data-testid={`specialist-intake-evidence-${type}`} aria-label={NAMES[type][cols]}
      value={draft.evidenceRefs[type]} type="text" maxLength={80}
      onChange={e=>setRef(type,e.target.value)} style={STYLE}
      placeholder={rtl?'معرّف ملف فقط':'Reference ID only'}/>
   </label>)}
  </div>
  {error?<p role="alert" data-testid="specialist-intake-error" className="mt-2 text-xs" style={{color:'#F1A679'}}>{text.error}</p>:null}
  <div className="mt-3 flex flex-wrap items-center gap-3">
   <button type="button" data-testid="specialist-intake-save" onClick={submit}
      className="rounded-lg px-3 py-2 text-xs" style={{background:'#B79448',color:'#142035'}}>{text.save}</button>
   <span data-testid="specialist-intake-count" className="text-xs">{text.count}: {savedCount} / {EVIDENCE_TYPES.length}</span>
  </div>
  <p className="mt-2 text-xs" data-testid="specialist-intake-c61-status"
    data-c61-status={assessment?.c61Status||'HOLD'}>{text.c61}</p>
 </section>;
}
