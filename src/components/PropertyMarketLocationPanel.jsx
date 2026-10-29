import React, { useEffect, useMemo, useState } from 'react';
import {useAppraisalReviewSession} from './AppraisalReviewSessionContext.jsx';
const {researchActionText}=require('../i18n/research-action-presentation');
const {evaluateBoundReview}=require('../market/appraisal-study-binding');
const {useLocale}=require('../i18n/LocaleContext.js');
const {coreMarketLabel,coreMarketAssetOptions,formatBridgeFields,marketOptionLabel}=
  require('../i18n/market-study-core-labels');
const {proposeFinancialToMarketIdentity,applyFinancialToMarketIdentity}=
  require('../market/financial-to-market-identity');
const { ASSET_TYPES, extractCoordinates, evaluateMarketStudy } = require('../market/instant-market-study');
const { prepareImportCsv,MAX_CSV_BYTES } = require('../market/public-dataset-import');
const {readOpenQuarters,deriveDistrictSnapshot,OPEN_QUARTERS}=require('../market/saudi-open-data-research');
import ProfessionalComparableReviewPanel from './ProfessionalComparableReviewPanel.jsx';
import CrossMethodEvidencePanel from './CrossMethodEvidencePanel.jsx';
import MarketOfferResearchPanel from './MarketOfferResearchPanel.jsx';
import TransactionCohortAndUnitMixPanel from './TransactionCohortAndUnitMixPanel.jsx';
const {reviewAskingVsExecuted,evaluateUnitMixRents}=require('../market/transaction-cohort-unit-mix');
const {MAX_BYTES:MAX_STUDY_BYTES,parsePersonalMarketStudy}=require('../market/market-study-state');
const {createStorageProvider}=require('../storage/create-storage-provider');
const {listCanonicalDeals,saveResearchSidecar,loadResearchSidecar}=require('../market/saved-deal-study-sidecar');
const {resolveStudyAsOf}=require('../market/study-asof');
const {auditValuationReadiness}=require('../market/valuation-decision-gate');
const {evaluateAppraisalReportQuality}=require('../market/property-report-quality');
import ValuationQualityPanel from './ValuationQualityPanel.jsx';
import SuhailNationalResearchPanel from './SuhailNationalResearchPanel.jsx';
import SaudiListingSourcesResearchPanel from './SaudiListingSourcesResearchPanel.jsx';
import EarthNationalResearchPanel from './EarthNationalResearchPanel.jsx';
import SaudiNationalIntelligenceSourcesPanel from './SaudiNationalIntelligenceSourcesPanel.jsx';
import ResearchEvidenceFusionPanel from './ResearchEvidenceFusionPanel.jsx';
import ChallengerBenchmarkResearchPanel from './ChallengerBenchmarkResearchPanel.jsx';
const {toPublicSample}=require('../market/suhail-national-neighborhood-research');

const INPUT = 'w-full rounded-lg border border-slate-600 bg-[#101c30] px-3 py-2 text-sm text-slate-100';
const createRow = () => ({ assetType:'',landSubtype:'',sourceRecordId:'', status:'ASKING', price:'', annualRent:'', builtArea:'', landArea:'',
  rentableArea:'', date:'', location:'', sourceUrl:'' });
const blankProject = () => ({ name:'', status:'PLANNED', location:'', sourceUrl:'', impactPct:'' });
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
  LAND_AREA_REQUIRED:'مساحة الأرض مطلوبة',BUILT_AREA_REQUIRED:'المساحة المبنية مطلوبة',
  HOTEL_ROOM_COUNT_REQUIRED:'عدد غرف الفندق مطلوب',
  SPECIALIST_ASSET_REQUIRES_SECTOR_UNDERWRITING:'الأصل متخصص: يلزم منهج دخل قطاعي مستقل ولا يمكن اعتماد نموذج الإيجار العام',
  MATERIAL_MARKET_INCOME_GAP_REQUIRES_RECONCILIATION:'فارق جوهري بين السوق والدخل (20% أو أكثر): أوقفت القيمة الموحدة حتى تسوية الافتراضات والمقارنات',
};
function Field({ title, value, onChange, type='text', placeholder='' }) {
  const {locale}=useLocale();
  return <label className="block min-w-0 text-xs text-slate-300">{coreMarketLabel(title,locale)}
    <input className={INPUT+' mt-1'} type={type} value={value} placeholder={placeholder}
      onChange={e => onChange(e.target.value)} dir={type==='date'?'ltr':'auto'}/>
  </label>;
}
function Select({ title, value, onChange, options, testId }) {
  const {locale}=useLocale();
  return <label className="block min-w-0 text-xs text-slate-300">{coreMarketLabel(title,locale)}
    <select data-testid={testId} className={INPUT+' mt-1'} value={value} onChange={e=>onChange(e.target.value)}>
      {options.map(([v,t])=><option key={v} value={v}>{marketOptionLabel(v,t,locale)}</option>)}
    </select>
  </label>;
}
const assetOptions = [['','اختر نوع العقار'],...Object.entries(ASSET_TYPES).map(([id,ar])=>[id,ar])];
const statusOptions = [['ASKING','عرض/طلب غير منفّذ — مستبعد'],['EXECUTED','صفقة أو عقد منفّذ — إقرار المستخدم']];
function ComparisonTable({ title, kind, rows, setRows, assetType }) {
  const {locale}=useLocale();
  const en=locale==='en';
  const L=v=>coreMarketLabel(v,locale);
  const isSale = kind==='sale';
  const update=(i,key,value)=>setRows(old=>old.map((r,j)=>j===i?{...r,[key]:value}:r));
  return <section className="rounded-xl border border-slate-700 p-3">
    <h4 className="font-semibold text-sm text-amber-200">{L(title)}</h4>
    <p className="text-xs text-slate-400 mt-1">{en
      ? 'At least three user-declared executed comparables of the same asset type within 365 days, within 5 km or explicitly matching the district. The comparable area must be 50%–200% of the subject on the same area basis. Duplicate source transaction IDs and asking listings are excluded. Matching type and location does not independently verify title or source.'
      : 'يلزم ثلاث مقارنات منفّذة على الأقل من نفس نوع العقار، خلال آخر 365 يومًا، بموقع يبعد 5 كم كحد أقصى أو تطابق معلن على مستوى الحي فقط. يشترط أن تكون مساحة المقارنة بين 50% و200% من مساحة الأصل على أساس المساحة نفسه. تُستبعد الصفقة المكررة بمعرّفها لدى المصدر نفسه، ولا تدخل عروض الأسعار في الحساب. تطابق النوع والموقع لا يُثبت الصك أو صحة المصدر مستقلاً.'}</p>
    {rows.map((row,i)=><div key={i} className="border-b border-slate-700 py-3">
      <div className="flex items-center justify-between mb-2">
        <strong className="text-xs text-slate-200">{en?'Comparable ':'المقارنة '}{i+1}</strong>
        {rows.length>3&&<button type="button" className="text-xs text-rose-300" onClick={()=>setRows(old=>old.filter((_,j)=>j!==i))}>{en?'Remove':'حذف'}</button>}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        <Select title="نوع العقار المقارن" value={row.assetType} onChange={v=>update(i,'assetType',v)} options={assetOptions}/>
        <Select title="طبيعة السعر" value={row.status} onChange={v=>update(i,'status',v)} options={statusOptions}/>
        {isSale&&assetType==='LAND'&&<Select title="تصنيف الأرض المقارنة"
          value={row.landSubtype||''} onChange={v=>update(i,'landSubtype',v)}
          options={[['','غير محدد — لا يعتمد عند تحديد تصنيف للأرض'],
            ['RAW','أرض خام غير مخدومة'],['SERVICED','أرض مخدومة ومخططة'],
            ['RESIDENTIAL','قطعة أرض سكنية'],['COMMERCIAL','قطعة أرض تجارية'],
            ['AGRICULTURAL','أرض زراعية']]}/>}
        <Field title="معرّف الصفقة/العقد لدى المصدر (إن توفر)" value={row.sourceRecordId||''}
          onChange={v=>update(i,'sourceRecordId',v)}/>

        <Field title={isSale?'قيمة البيع الفعلية (ر.س)':'الإيجار السنوي المتعاقد عليه (ر.س)'}
          value={isSale?row.price:row.annualRent} onChange={v=>update(i,isSale?'price':'annualRent',v)}/>
        <Field title={isSale?(assetType==='LAND'?'مساحة أرض المقارنة م²':'مساحة البناء الإجمالية للمقارنة م²'):'المساحة التأجيرية للمقارنة م²'}
          value={isSale?(assetType==='LAND'?row.landArea:row.builtArea):row.rentableArea}
          onChange={v=>update(i,isSale?(assetType==='LAND'?'landArea':'builtArea'):'rentableArea',v)}/>
        <Field title="تاريخ الصفقة/العقد" type="date" value={row.date} onChange={v=>update(i,'date',v)}/>
        <Field title="موقع المقارنة (رابط أو إحداثيات)" value={row.location} onChange={v=>update(i,'location',v)} placeholder="24.7,46.7"/>
        <div className="sm:col-span-2 lg:col-span-3">
          <Field title="رابط مصدر الصفقة أو العقد (رابط آمن)" value={row.sourceUrl} onChange={v=>update(i,'sourceUrl',v)} placeholder="https://..."/>
        </div>
      </div>
    </div>)}
    <button type="button" className="mt-3 rounded-lg border border-amber-600 px-3 py-2 text-xs text-amber-100" onClick={()=>setRows(old=>old.length>=15?old:[...old,createRow()])}>{en?'+ Add comparable':'+ إضافة مقارنة'}</button>
  </section>;
}
export default function PropertyMarketLocationPanel({financialStudy=null}) {
  const {locale}=useLocale();
  const english=locale==='en';
  const L=value=>coreMarketLabel(value,locale);
  const money=n=>Number.isFinite(n)?new Intl.NumberFormat(english?'en-US':'ar-SA',{maximumFractionDigits:0}).format(n)+(english?' SAR':' ر.س'):(english?'Not calculable':'غير قابل للحساب');
  const {setSubject:setSessionSubject,link:appraisalLink,invalidateLink}=useAppraisalReviewSession();
  const [subject,setSubject]=useState({
    name:'',assetType:'RESIDENTIAL_COMPOUND',landSubtype:'',city:'الرياض',district:'',location:'',
    landArea:'',builtArea:'',rentableArea:'',buildingCount:'',unitCount:'',floorCount:'',
    roomCount:'',shopCount:'',parkingCount:'',warehouseCount:'',clearHeight:'',loadingDocks:'',
    historicalAnnualRent:'',leaseHistory:'UNKNOWN',urbanBoundary:'UNKNOWN',
    valuationPurpose:'',valuationDate:'',propertyRight:'UNKNOWN',
    zoningClassification:'',inspectionStatus:'NOT_INSPECTED',inspectionDate:'',
  });
  const [assumptions,setAssumptions]=useState({occupancy:'0.9',expenseRatio:'0.20',capRate:'0.075'});
  const [sales,setSales]=useState(Array.from({length:3},createRow));
  const [rentals,setRentals]=useState(Array.from({length:3},createRow));
  const [projects,setProjects]=useState([blankProject()]);
  const [marketOffers,setMarketOffers]=useState([]);
  const [unitMix,setUnitMix]=useState([]);
  const [leaseComparables,setLeaseComparables]=useState([]);
  const [rentAssumptions,setRentAssumptions]=useState({expenseRatio:'0.20',stabilizedOccupancy:'0.90'});
  const [importedSales,setImportedSales]=useState([]);
  const [importedRentals,setImportedRentals]=useState([]);
  const [importSource,setImportSource]=useState('');
  const [rightsConfirmed,setRightsConfirmed]=useState(false);
  const [importStatus,setImportStatus]=useState('');
  const [publicRecords,setPublicRecords]=useState([]);
  const [publicLoadStatus,setPublicLoadStatus]=useState('');
  const [publicLoadMeta,setPublicLoadMeta]=useState(null);
  const [publicLoading,setPublicLoading]=useState(false);
  const [researchFeeds,setResearchFeeds]=useState(()=>({suhail:toPublicSample(),listings:[],earth:[],national:[]}));
  const [researchSessionEpoch,setResearchSessionEpoch]=useState(0);


  const [bridgeConfirmed,setBridgeConfirmed]=useState(false);
  const [bridgeAssetType,setBridgeAssetType]=useState('');
  const bridgeProposal=useMemo(()=>proposeFinancialToMarketIdentity(financialStudy||{}),[financialStudy]);
  const [message,setMessage]=useState('');
  const [savedDeals,setSavedDeals]=useState([]);
  const [selectedSavedDealId,setSelectedSavedDealId]=useState('');
  const [savedDealStudyStatus,setSavedDealStudyStatus]=useState('');
  const [replaceLinkedStudy,setReplaceLinkedStudy]=useState(false);
  const [linkedStudyBusy,setLinkedStudyBusy]=useState(false);
  const [linkedDealIdentityAcknowledged,setLinkedDealIdentityAcknowledged]=useState(false);
  useEffect(()=>{setSessionSubject(subject);},[subject,setSessionSubject]);
  const appraisalBinding=useMemo(()=>evaluateBoundReview({subject,link:appraisalLink}),[subject,appraisalLink]);
  const selectedDeal=useMemo(()=>savedDeals.find(deal=>deal.id===selectedSavedDealId)||null,[savedDeals,selectedSavedDealId]);
  const linkedDealNameConflict=Boolean(appraisalLink&&selectedDeal&&
    String(selectedDeal.name).trim().replace(/\s+/g,' ').toLocaleLowerCase('ar')!==
    String(subject.name).trim().replace(/\s+/g,' ').toLocaleLowerCase('ar'));
  const updateSubject=(key,value)=>setSubject(current=>({...current,[key]:value}));
  const updateAssumption=(key,value)=>setAssumptions(current=>({...current,[key]:value}));
  const studyAsOf=resolveStudyAsOf(subject.valuationDate);
  const asOfMs=studyAsOf.asOf.getTime();
  const allSales=useMemo(()=>[...sales,...importedSales],[sales,importedSales]);
  const allRentals=useMemo(()=>[...rentals,...importedRentals],[rentals,importedRentals]);
  const report=useMemo(()=>evaluateMarketStudy({subject,sales:allSales,rentals:allRentals,projects,assumptions,asOf:new Date(asOfMs)}),
    [subject,allSales,allRentals,projects,assumptions,asOfMs]);
  const askingVsExecutedCohorts=useMemo(()=>reviewAskingVsExecuted({
    subject,askingOffers:marketOffers,executedSales:allSales,asOf:new Date(asOfMs),
  }),[subject,marketOffers,allSales,asOfMs]);
  const segmentedMarketRents=useMemo(()=>evaluateUnitMixRents({
    subject,unitMix,leaseComparables,...rentAssumptions,asOf:new Date(asOfMs),
  }),[subject,unitMix,leaseComparables,rentAssumptions,asOfMs]);
  const valuationReadiness=useMemo(()=>auditValuationReadiness({
    subject,report,segmentedRent:segmentedMarketRents,sales:allSales,rentals:allRentals,appraisalReview:appraisalBinding.appraisalReview,asOf:new Date(asOfMs),
  }),[subject,report,segmentedMarketRents,allSales,allRentals,appraisalBinding,asOfMs]);
  const appraisalQuality=useMemo(()=>evaluateAppraisalReportQuality({
    subject,marketReport:report,readiness:valuationReadiness,asOf:new Date(asOfMs),
  }),[subject,report,valuationReadiness,asOfMs]);
  const coords=extractCoordinates(subject.location);
  const publicNeighborhood=useMemo(()=>deriveDistrictSnapshot(publicRecords,{
    city:subject.city,district:subject.district,
    classification:subject.assetType==='OFFICE_TOWER'||subject.assetType==='COMMERCIAL_COMPLEX'?'تجاري':
      subject.assetType==='WAREHOUSE'?'صناعي':
      subject.assetType==='LAND'?'':'سكني',
    asOf:new Date(asOfMs),
  }),[publicRecords,subject.city,subject.district,subject.assetType,asOfMs]);
  const quarterLabel=value=>{const m=String(value).match(/^([0-9]{4})-Q([1-4])$/);return english?(m?'Q'+m[2]+' '+m[1]:'Historical quarter'):(m?'الربع '+['الأول','الثاني','الثالث','الرابع'][Number(m[2])-1]+L(' من ')+m[1]:'فصل تاريخي');};
  const fetchOpenData=async()=>{
    if(publicLoading)return;
    setPublicLoading(true);setPublicLoadStatus({kind:'OPEN_LOADING'});
    try{
      const data=await readOpenQuarters({asOf:new Date(asOfMs),onProgress:p=>setPublicLoadStatus({
        kind:p.state==='FETCHING'?'OPEN_FETCHING':p.state==='IMPORTED'?'OPEN_IMPORTED':'OPEN_QUARTER_FAILED',
        params:{quarter:p.quarter,count:p.count},
      })});
      setPublicRecords(data.records);
      setPublicLoadMeta(data);
      setPublicLoadStatus({kind:data.incomplete?'OPEN_PARTIAL':'OPEN_LOADED'});
    }catch(error){
      setPublicLoadStatus({kind:'OPEN_FAILED',params:{code:String(error.message||'NETWORK_FAILED')}});
    }finally{setPublicLoading(false);}
  };

  const updateProject=(i,key,v)=>setProjects(old=>old.map((r,j)=>j===i?{...r,[key]:v}:r));
  const importLocalCsv=async (file,kind)=>{
    if(!file)return;
    try {
      if(file.size>MAX_CSV_BYTES)throw new Error('CSV_SIZE_LIMIT');
      const data=prepareImportCsv(await file.text(),{kind,datasetUrl:importSource,rightsConfirmed});
      if(kind==='sale')setImportedSales(data.rows);
      else setImportedRentals(data.rows);
      setImportStatus({kind:'CSV_IMPORTED',params:{count:data.rows.length,skipped:data.skipped}});
    }catch(error){setImportStatus({kind:'CSV_FAILED',params:{code:error.message||'CSV_INVALID'}});}

  };
  const makeResearchInputJson=()=>JSON.stringify({
    kind:'STARTAK_PERSONAL_MARKET_STUDY',subject,assumptions,
    sales:allSales,rentals:allRentals,projects,marketOffers,unitMix,leaseComparables,rentAssumptions,
  });
  const applyResearchStudy=restored=>{
    // Loading/importing a study is a new review event, even when the identity fields match.
    invalidateLink();
    setSubject(restored.subject);
    setAssumptions(restored.assumptions);
    setSales(restored.sales);
    setRentals(restored.rentals);
    setImportedSales([]);
    setImportedRentals([]);
    setProjects(restored.projects);
    setMarketOffers(restored.marketOffers);
    setUnitMix(restored.unitMix);
    setLeaseComparables(restored.leaseComparables);
    setRentAssumptions(restored.rentAssumptions);
    setPublicRecords([]);setPublicLoadMeta(null);setPublicLoadStatus('');
    // Restored study is a new case context. Quarantine old source imports:
    // the UI must not implicitly carry previous case-specific research across deals.
    setResearchFeeds({suhail:toPublicSample(),listings:[],earth:[],national:[]});
    setResearchSessionEpoch(n=>n+1);
    setImportSource('');setRightsConfirmed(false);setImportStatus('');
  };
  const refreshCanonicalDeals=async()=>{
    setSavedDealStudyStatus('');
    try{
      const deals=await listCanonicalDeals(createStorageProvider());
      setSavedDeals(deals);
      setSelectedSavedDealId(current=>deals.some(x=>x.id===current)?current:'');
      setSavedDealStudyStatus({kind:deals.length?'DEAL_SELECT':'DEAL_NONE'});
    }catch(error){setSavedDealStudyStatus({kind:'DEAL_LIST_FAILED',params:{code:String(error.code||error.message)}});}
  };

  const saveLinkedStudy=async()=>{
    if(appraisalBinding.blockExport){setSavedDealStudyStatus({kind:'SIDECAR_BLOCKED'});return;}
    if(linkedDealNameConflict){setSavedDealStudyStatus({kind:'SIDECAR_NAME_MISMATCH'});return;}
    if(!selectedSavedDealId){setSavedDealStudyStatus({kind:'DEAL_REQUIRED'});return;}
    if(!linkedDealIdentityAcknowledged){setSavedDealStudyStatus({kind:'IDENTITY_CONFIRM_REQUIRED'});return;}
    setLinkedStudyBusy(true);
    try{
      const saved=await saveResearchSidecar({
        storage:createStorageProvider(),dealId:selectedSavedDealId,
        studyJson:makeResearchInputJson(),identityConfirmed:linkedDealIdentityAcknowledged,
        overwrite:replaceLinkedStudy,appraisalLink,
      });
      setSavedDealStudyStatus({kind:'SIDECAR_SAVED',params:{dealId:saved.dealId}});
      setReplaceLinkedStudy(false);
    }catch(error){
      const reason=String(error.code||error.message);
      setSavedDealStudyStatus({kind:reason==='SIDECAR_EXISTS_CONFIRM_OVERWRITE'?'SIDECAR_OVERWRITE_REQUIRED':'SIDECAR_SAVE_FAILED',params:{code:reason}});
    }finally{setLinkedStudyBusy(false);}
  };
  const loadLinkedStudy=async()=>{
    if(!selectedSavedDealId){setSavedDealStudyStatus({kind:'DEAL_REQUIRED'});return;}
    setLinkedStudyBusy(true);
    try{
      const result=await loadResearchSidecar({storage:createStorageProvider(),dealId:selectedSavedDealId});
      if(!result.found){setSavedDealStudyStatus({kind:'SIDECAR_NOT_FOUND'});return;}
      applyResearchStudy(result.study);
      setSavedDealStudyStatus({kind:'SIDECAR_RESTORED',params:{dealId:result.dealId}});
      setReplaceLinkedStudy(false);
    }catch(error){setSavedDealStudyStatus({kind:'SIDECAR_RESTORE_FAILED',params:{code:String(error.code||error.message)}});}
    finally{setLinkedStudyBusy(false);}
  };
  const restoreJson=async file=>{
    if(!file)return;
    try{
      if(file.size>MAX_STUDY_BYTES)throw Error('STUDY_SIZE_LIMIT');
      const restored=parsePersonalMarketStudy(await file.text()).study;
      applyResearchStudy(restored);
      setMessage({kind:'STUDY_RESTORED'});
    }catch(error){setMessage({kind:'STUDY_RESTORE_FAILED',params:{code:String(error.message||'STUDY_INVALID')}});}
  };
  const exportJson=()=>{
    if(appraisalBinding.blockExport){
      setMessage({kind:'STUDY_EXPORT_BLOCKED'});
      return;
    }
    try {
      const blob=new Blob([JSON.stringify({kind:'STARTAK_PERSONAL_MARKET_STUDY',subject,assumptions,
        sales:allSales,rentals:allRentals,projects,marketOffers,unitMix,leaseComparables,rentAssumptions,
        askingVsExecutedCohorts,segmentedMarketRents,valuationReadiness,appraisalQuality,
        studyAsOf:{date:studyAsOf.date,origin:studyAsOf.origin,issues:studyAsOf.issues},report,
        exportedAt:new Date().toISOString()},null,2)],{type:'application/json'});
      const url=URL.createObjectURL(blob),a=document.createElement('a');
      a.href=url;a.download='startak-location-market-personal-study.json';
      a.style.display='none';
      document.body.appendChild(a);
      a.click();
      // Do not revoke a blob immediately: asynchronous Chromium downloads
      // may be delayed by other CI tasks or operating-system scheduling.
      setTimeout(()=>{a.remove();URL.revokeObjectURL(url);},60000);
      setMessage({kind:'STUDY_EXPORT_REQUESTED'});
    } catch(error) {
      console.error('STARTAK_PERSONAL_STUDY_EXPORT_ERROR',error);
      setMessage({kind:'STUDY_EXPORT_FAILED',params:{code:String(error?.name||'UNKNOWN')}});
    }
  };
  const latestWindow=L('آخر 365 يومًا من تاريخ الحساب، وليست بالضرورة معاملات نُفذت اليوم');
  return <section dir={english?'ltr':'rtl'} data-testid="location-market-study" className="mt-6 rounded-2xl border border-[#4B607A] bg-[#141F35] p-4 md:p-6 text-slate-100">
    <h2 className="text-lg font-bold text-amber-100">{L('موقع العقار والقيمة السوقية والإيجار المستهدف — دراسة شخصية')}</h2>
    <p className="text-xs text-slate-300 leading-6 mt-2">
      {english
        ? 'Enter an unshortened Google Maps coordinate link or coordinates. This tool does not fetch live executed transactions and uses only manually supplied comparables; outputs are unverified research scenarios.'
        : 'أدخل رابط خرائط جوجل غير المختصر المتضمن إحداثيات العقار أو الإحداثيات مباشرة. هذه الحاسبة لا تجلب معاملات حية تلقائيًا؛ تعالج فقط مقارنات مثبتة المصدر يضيفها المستخدم وتُظهر نتائج سيناريو غير معتمدة.'}
    </p>
    <div data-testid="market-financial-identity-bridge" className="mt-4 rounded-xl border border-amber-800 p-3 text-xs">
      <h3 className="font-semibold text-amber-100">{L('D06 — ربط اختياري لهوية العقار من الدراسة المالية')}</h3>
      <p className="mt-2 text-slate-300">
        {english
          ? 'Copying requires your explicit consent and does not authenticate ownership, property type or location. City, district, title and comparables are not copied; all fields remain editable.'
          : 'النقل عند إقرارك فقط، ولا يثبت ملكية العقار أو صحة نوعه أو موقعه. لا تُنقل المدينة أو الحي أو الصك ولا المقارنات؛ وتبقى قابلة للمراجعة والتحرير.'}
      </p>
      <p className="mt-2" data-testid="market-financial-bridge-status">
        {L('حالة النقل:')} {bridgeProposal.status}
      </p>
      {bridgeProposal.status==='USER_CONFIRMATION_REQUIRED'&&<>
        <p className="mt-2 text-slate-300">
          {L('الحقول المقترحة:')} {formatBridgeFields(bridgeProposal.subjectPatch,locale)}
        </p>
        {bridgeProposal.assetTypeMustBeSelectedByUser&&<Select
          title="اختر نوع العقار صراحةً؛ لا نستخدم النوع الافتراضي أو اسم المشروع"
          value={bridgeAssetType} onChange={v=>setBridgeAssetType(v)}
          options={assetOptions.filter(x=>x[0]!=='LAND')}/>}
        <label className="mt-2 flex items-center gap-2">
          <input type="checkbox" checked={bridgeConfirmed}
            onChange={e=>setBridgeConfirmed(e.target.checked)} />
          {L('أوافق على نسخ الحقول المقترحة واستبدال قيم هذه الحقول فقط بعد مراجعتها')}
        </label>
        <button type="button" data-testid="market-financial-bridge-apply"
          disabled={!bridgeConfirmed||bridgeProposal.assetTypeMustBeSelectedByUser&&!bridgeAssetType}
          className="mt-2 rounded border border-amber-600 px-3 py-2 disabled:opacity-50"
          onClick={()=>{
            const updated=applyFinancialToMarketIdentity({
              proposal:bridgeProposal,subject,confirmed:bridgeConfirmed,
              selectedAssetType:bridgeAssetType,
            });
            if(updated.status!=='COPIED_USER_CONFIRMED_NOT_VERIFIED'){
              setMessage({kind:'BRIDGE_FAILED',params:{code:updated.status}});return;
            }
            invalidateLink();
            setSubject(updated.subject);
            setBridgeConfirmed(false);
            setMessage({kind:'BRIDGE_COPIED'});
          }}>
          {L('اعتماد نسخ بيانات العقار إلى البحث السوقي')}
        </button>
      </>}
    </div>
    {english&&<p data-testid="market-partial-locale-notice" role="note" className="mt-2 text-xs text-amber-200">
      Identity, selected research panels, appraisal review and evidence quality are translated. Other analytical sections are not fully localized. Original source content retains its original language.
    </p>}
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
      <Field title="اسم العقار" value={subject.name} onChange={v=>updateSubject('name',v)} />
      <Select title="غرض دراسة التقييم" value={subject.valuationPurpose}
        onChange={v=>updateSubject('valuationPurpose',v)}
        options={ [['','اختر الغرض'],['ACQUISITION','دراسة شراء أو استحواذ'],
         ['PORTFOLIO_REVIEW','مراجعة محفظة أصول'],['RENT_STUDY','دراسة أجرة سوقية'],
         ['FINANCING_REVIEW','مراجعة تمويلية غير رسمية'],['OTHER','دراسة شخصية أخرى']] }/>
      <Field title="تاريخ القيمة المطلوب دراستها" type="date" value={subject.valuationDate}
        onChange={v=>updateSubject('valuationDate',v)}/>
      <Select title="نوع الحق العقاري (يحتاج تحقق)" value={subject.propertyRight}
        onChange={v=>updateSubject('propertyRight',v)}
        options={ [['UNKNOWN','غير متحقق'],['FULL_OWNERSHIP','ملكية كاملة'],['USUFRUCT','حق انتفاع'],
         ['LONG_LEASE','حق تأجير طويل المدة'],['OTHER','حق آخر']] }/>
      <Field title="التصنيف التنظيمي أو الاستعمال المسموح (حسب الدليل)" value={subject.zoningClassification}
        onChange={v=>updateSubject('zoningClassification',v)}/>
      <Select title="حالة المعاينة الفعلية" value={subject.inspectionStatus}
        onChange={v=>updateSubject('inspectionStatus',v)}
        options={ [['NOT_INSPECTED','لم تتم المعاينة'],['REMOTE_ONLY','مراجعة صور أو موقع فقط'],['ON_SITE','تمت معاينة ميدانية — إقرار المستخدم']] }/>
      <Field title="تاريخ المعاينة الميدانية" type="date" value={subject.inspectionDate}
        onChange={v=>updateSubject('inspectionDate',v)}/>
      <Select title="نوع العقار" value={subject.assetType} onChange={v=>updateSubject('assetType',v)} options={assetOptions} testId="market-subject-asset-type"/>
      {subject.assetType==='LAND'&&<Select title="تصنيف الأرض للمقارنات"
        value={subject.landSubtype} onChange={v=>updateSubject('landSubtype',v)}
        options={ [['','اختر حالة الأرض'],['RAW','أرض خام غير مخدومة'],['SERVICED','أرض مخدومة ومخططة'],
         ['RESIDENTIAL','قطعة أرض سكنية'],['COMMERCIAL','قطعة أرض تجارية'],
         ['AGRICULTURAL','أرض زراعية']] }/>}
      <Field title="المدينة" value={subject.city} onChange={v=>updateSubject('city',v)}/>
      <Field title="الحي" value={subject.district} onChange={v=>updateSubject('district',v)}/>
      <div className="md:col-span-2"><Field title="رابط موقع العقار من خرائط جوجل أو الإحداثيات" value={subject.location}
        onChange={v=>updateSubject('location',v)} placeholder="https://www.google.com/maps/@24.7,46.7,17z"/></div>
      <Field title="مساحة الأرض (م²)" value={subject.landArea} onChange={v=>updateSubject('landArea',v)}/>
      <Field title="إجمالي المساحات المبنية لكل المباني (م²)" value={subject.builtArea} onChange={v=>updateSubject('builtArea',v)}/>
      <Field title="إجمالي المساحة القابلة للتأجير (م²)" value={subject.rentableArea} onChange={v=>updateSubject('rentableArea',v)}/>
      <Field title="عدد العمائر/المباني" value={subject.buildingCount} onChange={v=>updateSubject('buildingCount',v)}/>
      <Field title="عدد الوحدات (شقق/مكاتب/معارض)" value={subject.unitCount} onChange={v=>updateSubject('unitCount',v)}/>
      <Field title="عدد الأدوار (للتوثيق)" value={subject.floorCount} onChange={v=>updateSubject('floorCount',v)}/>
      {(subject.assetType==='HOTEL')&&<Field title="عدد الغرف والمفاتيح الفندقية" value={subject.roomCount} onChange={v=>updateSubject('roomCount',v)}/>}
      {(['COMMERCIAL_MALL','COMMERCIAL_COMPLEX','MIXED_USE'].includes(subject.assetType))&&<Field title="عدد المحلات والمعارض التجارية" value={subject.shopCount} onChange={v=>updateSubject('shopCount',v)}/>}
      {(['WAREHOUSE','LOGISTICS_PARK','INDUSTRIAL_PROPERTY'].includes(subject.assetType))&&<>
        <Field title="عدد المستودعات أو الوحدات اللوجستية" value={subject.warehouseCount} onChange={v=>updateSubject('warehouseCount',v)}/>
        <Field title="الارتفاع الصافي الداخلي بالمتر" value={subject.clearHeight} onChange={v=>updateSubject('clearHeight',v)}/>
        <Field title="عدد بوابات التحميل والتفريغ" value={subject.loadingDocks} onChange={v=>updateSubject('loadingDocks',v)}/>
      </>}
      <Field title="مواقف السيارات" value={subject.parkingCount} onChange={v=>updateSubject('parkingCount',v)}/>
      <Field title="الإيجار السنوي السابق (مرجع نظامي فقط)" value={subject.historicalAnnualRent} onChange={v=>updateSubject('historicalAnnualRent',v)}/>
      <Select title="تاريخ إشغال/تأجير الوحدة" value={subject.leaseHistory} onChange={v=>updateSubject('leaseHistory',v)}
        options={ [['UNKNOWN','غير معروف'],['PREVIOUSLY_LEASED','سبق تأجيرها'],['FIRST_LEASE','أول تأجير']] }/>
      <Select title="داخل النطاق العمراني للرياض؟" value={subject.urbanBoundary} onChange={v=>updateSubject('urbanBoundary',v)}
        options={ [['UNKNOWN','لم يتم التحقق'],['YES','نعم — بحاجة لإثبات'],['NO','لا']] }/>
    </div>
    <p className="text-xs text-slate-300 mt-3" role="status">
      {coords ? <>{L("الإحداثيات المستخرجة:")} {fixed(coords.lat)}{english?', ':'، '}{fixed(coords.lng)} — <a target="_blank" rel="noopener noreferrer" className="underline text-sky-300"
        href={`https://www.google.com/maps/search/?api=1&query=${coords.lat}%2C${coords.lng}`}>{L("عرض النقطة على الخريطة")}</a></>
        : english?'No coordinates extracted. Short map links are insufficient; open the link and copy the coordinates.':'لم تُستخرج إحداثيات بعد. روابط خرائط جوجل المختصرة لا تكفي؛ افتح الرابط وانسخ الإحداثيات.'}
    </p>
    <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
      <Field title="الإشغال المتوقع ككسر (0.9 = 90%)" value={assumptions.occupancy} onChange={v=>updateAssumption('occupancy',v)} />
      <Field title="مصروفات المالك من الإيراد ككسر" value={assumptions.expenseRatio} onChange={v=>updateAssumption('expenseRatio',v)}/>
      <Field title="معدل الرسملة ككسر" value={assumptions.capRate} onChange={v=>updateAssumption('capRate',v)}/>
    </div>
    <p className="text-xs text-amber-200 mt-2">{L("النسب الموضوعة مبدئيًا أمثلة قابلة للتعديل وليست تقديرات سوقية للحي أو العقار.")}</p>
    <section className="mt-5 rounded-xl border border-slate-600 bg-[#1A2942] p-3" data-testid="public-moJ-research">
      <h3 className="text-sm font-semibold text-amber-100">{L("البحث التلقائي التجريبي في صفقات وزارة العدل المنشورة كبيانات مفتوحة")}</h3>
      <p className="mt-2 text-xs leading-6 text-slate-300">{L("دون اتصال رسمي مباشر أو تسجيل دخول: عند الضغط، تقرأ المنصة ملفات الفصول التاريخية المتاحة")} {OPEN_QUARTERS.map(quarterLabel).join(english?', ':'، ')} {L("من مستودع عام ينسب البيانات الأصلية لوزارة العدل ورخصة البيانات المفتوحة السعودية. البحث يغطي جميع مدن المملكة التي تظهر في الملفات، وليس الرياض وحدها. وبيانات الأحياء والأسعار هنا")} <strong>{L("مؤشر تاريخي للحي")}</strong> {L("وليست صفقات مؤكدة لمجمعات أو فنادق أو أبراج.")}</p>
      <div className="flex flex-wrap items-center gap-3 mt-3">
        <button type="button" disabled={publicLoading} onClick={fetchOpenData}
          className="min-h-[40px] rounded-lg bg-[#C9A24C] px-4 py-2 text-xs font-semibold text-[#141F35] disabled:opacity-50">
          {publicLoading?L('جارٍ جلب البيانات المفتوحة…'):L('جلب الصفقات المفتوحة الآن وتحليل الحي')}
        </button>
        <a href="https://github.com/civillizard/Saudi-Real-Estate-Data" target="_blank" rel="noopener noreferrer"
          className="min-h-[40px] inline-flex items-center text-xs underline text-sky-200">{L("بيانات وزارة العدل المعاد نشرها — ومعلومات الترخيص")}</a>
      </div>
      <p data-testid="open-data-action-notice" data-diagnostic-content translate="no" className="mt-2 text-xs text-slate-300" role="status">{researchActionText(publicLoadStatus,locale)}</p>
      {publicLoadMeta&&<div className="mt-3 rounded-lg border border-slate-600 p-3 text-xs text-slate-200">
        <p>{L("إجمالي السجلات التي اجتازت سلامة الملف:")} {publicLoadMeta.records.length.toLocaleString(english?'en-US':'ar-SA')}{L("، الفصول المكتملة:")} {publicLoadMeta.sources.map(s=>s.quarter).join(english?', ':'، ')||L('لا شيء')}.
          {publicLoadMeta.incomplete?L(' يوجد نقص في بعض الفصول.'):''}
        </p>
        <p className="mt-2">{L("المدينة:")} <span data-user-content translate="no">{subject.city||L('غير مدخلة')}</span> {L("— الحي:")} <span data-user-content translate="no">{subject.district||L('غير مدخل')}</span></p>
        <p className="mt-2">{L("صفقات الحي المؤهلة حسب التصنيف العام:")} {publicNeighborhood.count}{L("، الوسيط التاريخي المسجل للمتر:")} {money(publicNeighborhood.medianPriceSqm)} {L("/م²")}
          {publicNeighborhood.count<3?L(' — لا توجد مقارنات كافية'):''}.
        </p>
        <p className="mt-2 text-amber-200">{L("لا تُحوَّل مؤشرات الحي تلقائيًا إلى قيمة مجمع سكني أو برج أو فندق؛ قد تتضمن السجلات صفقات أراضٍ مختلفة تمامًا. ولا تعد البيانات أحدث من الفصول المنشورة.")}</p>
        {!!publicNeighborhood.referenceExamples?.length&&<details className="mt-2">
          <summary className="min-h-[28px] cursor-pointer text-sky-200">{L("عرض أمثلة الصفقات المنشورة مع المصادر")}</summary>
          <div className="mt-2 max-h-64 overflow-auto">
            <table className="w-full text-xs text-slate-200">
              <thead><tr><th>{L("التاريخ")}</th><th>{L("السعر")}</th><th>{L("المساحة")}</th><th>{L("السعر/م²")}</th><th>{L("المصدر")}</th></tr></thead>
              <tbody>{publicNeighborhood.referenceExamples.map((x,i)=><tr key={i}>
                <td className="px-2 py-2">{x.date}</td><td className="px-2 py-2">{money(x.price)}</td>
                <td className="px-2 py-2">{x.area}</td><td className="px-2 py-2">{money(x.priceSqm)}</td>
                <td className="px-2 py-2"><a className="underline text-sky-200" href={x.sourceUrl} target="_blank" rel="noopener noreferrer">CSV</a></td>
              </tr>)}</tbody>
            </table>
          </div>
        </details>}
        {publicLoadMeta.errors.length>0&&<p className="mt-2 text-rose-200">{L("تعذر جلب:")} {publicLoadMeta.errors.map(e=>e.quarter).join(english?', ':'، ')}{L(". المخرجات لا تمثل تغطية كاملة.")}</p>}
      </div>}
    </section>
    <section className="mt-5 rounded-xl border border-slate-600 bg-[#1A2942] p-3" data-testid="public-csv-import">
      <h3 className="text-sm font-semibold text-amber-100">{L("استيراد مقارنات من ملفات بيانات مصرح بها — بدون API")}</h3>
      <p className="mt-2 text-xs leading-6 text-slate-300">{L("يمكن فتح مواقع البيانات العامة، ثم تنزيل ملف CSV مرخص وإدخاله محليًا. لا تسحب المنصة محتوى سهيل أو المؤشرات العقارية آليًا ولا تتجاوز تسجيل الدخول. تُعرض الصفقة كمقارنة منفذة فقط إذا صرّح عمود الحالة بذلك. يُشترط تاريخ، نوع عقار، سعر، مساحة، مصدر، وموقع أو مدينة وحي متطابقان.")}</p>
      <p className="mt-1 text-xs text-amber-200">{L("رؤوس أعمدة CSV المدعومة: نوع العقار، حالة الصفقة، تاريخ الصفقة، قيمة الصفقة أو الإيجار السنوي، المساحة المبنية أو التأجيرية، المدينة، الحي، الإحداثيات، رابط المصدر، رقم الصفقة. يدعم المستورد كذلك أسماء أعمدة إنجليزية مكافئة. لا تُعد إحصاءات متوسط الحي ثلاث صفقات منفذة مستقلة.")}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
        <Field title={L("رابط مجموعة البيانات المفتوحة أو المصدر المرخّص (رابط آمن)")} value={importSource}
          onChange={v=>{setImportSource(v);setRightsConfirmed(false);}} placeholder="https://..."/>
        <label className="flex items-center gap-2 text-xs text-slate-200 min-h-[44px]">
          <input className="w-7 h-7 flex-shrink-0" type="checkbox" checked={rightsConfirmed} onChange={e=>setRightsConfirmed(e.target.checked)}/>
          {L("أؤكد أن لي حق استخدام هذه البيانات وإعادة تحليلها")}
        </label>
        <label className="block text-xs text-slate-200">{L("تحميل CSV لصفقات بيع منفّذة")}
          <input className={INPUT+' mt-1'} type="file" accept=".csv,text/csv,text/plain"
            onChange={async e=>{const file=e.target.files?.[0];e.target.value='';await importLocalCsv(file,'sale');}}/>
        </label>
        <label className="block text-xs text-slate-200">{L("تحميل CSV لعقود الإيجار المنفّذة")}
          <input className={INPUT+' mt-1'} type="file" accept=".csv,text/csv,text/plain"
            onChange={async e=>{const file=e.target.files?.[0];e.target.value='';await importLocalCsv(file,'rent');}}/>
        </label>
      </div>
      <p data-testid="market-import-action-notice" data-diagnostic-content translate="no" role="status" className="mt-2 text-xs text-amber-200">{researchActionText(importStatus,locale)}</p>
      <p className="mt-2 text-xs text-slate-300">{L("سجلات البيع المستوردة:")} {importedSales.length} {L("| سجلات الإيجار المستوردة:")} {importedRentals.length}</p>
      <div className="flex gap-3 mt-2">
        <button type="button" className="text-xs text-rose-200 underline min-h-[36px] py-2 px-2"
          onClick={()=>{setImportedSales([]);setImportedRentals([]);setImportStatus({kind:'CSV_CLEARED'});}}>
          {L("مسح المقارنات المستوردة")}
        </button>
        <a className="text-xs text-sky-200 underline min-h-[36px] inline-flex items-center py-2 px-2" target="_blank" rel="noopener noreferrer"
          href="https://www.moj.gov.sa/ar/opendata/Pages/reports.aspx">{L("تقارير الصفقات العقارية — وزارة العدل")}</a>
      </div>
    </section>
    <div className="mt-5 space-y-4">
      <ComparisonTable title="مقارنات البيع — لإنشاء مؤشر القيمة" kind="sale" rows={sales} setRows={setSales} assetType={subject.assetType}/>
      <ComparisonTable title="مقارنات الإيجار الجديد — مستقل عن الإيجار السابق" kind="rent" rows={rentals} setRows={setRentals} assetType={subject.assetType}/>
    </div>
    <section className="mt-5 rounded-xl border border-slate-700 p-3">
      <h4 className="text-sm font-semibold text-amber-100">{L("المشروعات المحيطة ومحفزات القيمة")}</h4>
      <p className="text-xs text-slate-300 mt-1">{L("أدخل مشروعات موثقة على مسافة 10 كم. لا يطبق أي أثر سعري تلقائي؛ نسبة الأثر افتراض منفصل قد يؤدي إلى احتساب مزدوج إذا انعكس سابقًا في المقارنات.")}</p>
      {projects.map((row,i)=><div key={i} className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 border-b border-slate-700 pb-3">
        <Field title="اسم المشروع/المرفق" value={row.name} onChange={v=>updateProject(i,'name',v)}/>
        <Select title="مرحلة المشروع" value={row.status} onChange={v=>updateProject(i,'status',v)}
          options={ [['PLANNED','معلن/مخطط'],['UNDER_CONSTRUCTION','تحت الإنشاء'],['OPERATING','تشغيل فعلي'],['UNKNOWN','غير متحقق']] }/>
        <Field title="رابط موقعه أو إحداثياته" value={row.location} onChange={v=>updateProject(i,'location',v)}/>
        <Field title="رابط مصدر المشروع الرسمي" value={row.sourceUrl} onChange={v=>updateProject(i,'sourceUrl',v)}/>
        <Field title="أثر افتراضي موثق (0.03 = 3%)" value={row.impactPct} onChange={v=>updateProject(i,'impactPct',v)}/>
        {projects.length>1&&<button type="button" onClick={()=>setProjects(old=>old.filter((_,j)=>j!==i))} className="text-xs text-rose-300">{L("حذف المشروع")}</button>}
      </div>)}
      <button type="button" className="mt-3 rounded-lg border border-amber-600 px-3 py-2 text-xs text-amber-100"
        onClick={()=>setProjects(old=>old.length>=10?old:[...old,blankProject()])}>{L("+ إضافة مشروع محيط")}</button>
    </section>
    <div className="mt-5 rounded-xl border border-amber-700/60 bg-[#1B2B43] p-4">
      <h3 className="font-bold text-amber-100">{L("نتيجة الحساب وقت الطلب — ليست تثمينًا مهنيًا")}</h3>
      <p className="text-xs text-slate-300 mt-1">{latestWindow}{L(". وقت الحساب:")} {report.asOf.slice(0,19).replace('T',' ')} {L("بالتوقيت العالمي")}</p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
        <div><span className="text-xs text-slate-400">{L("القيمة التقديرية الحسابية اليوم")}</span><strong className="block text-lg">{money(valuationReadiness.preliminaryValueSar)}</strong></div>
        <div><span className="text-xs text-slate-400">{L("الإيجار السوقي السنوي المحتمل")}</span><strong className="block text-lg">{money(valuationReadiness.newAnnualMarketRentSar)}</strong></div>
        <div><span className="text-xs text-slate-400">{L("الإيجار السنوي المتوقع تحصيله بعد الإشغال")}</span><strong className="block text-lg">{money(report.expectedCollectedAnnualRentSar)}</strong></div>
        <div><span className="text-xs text-slate-400">{L("مؤشر البيع بالمقارنات")}</span><strong className="block">{money(report.saleIndicationSar)}</strong></div>
        <div><span className="text-xs text-slate-400">{L("مؤشر الدخل بالرسملة")}</span><strong className="block">{money(report.incomeIndicationSar)}</strong></div>
        <div><span className="text-xs text-slate-400">{L("متوسط الإيجار السوقي لكل وحدة (تقريبي)")}</span><strong className="block">{money(report.averageMarketAnnualRentPerUnitSar)}</strong></div>
      </div>
      <p className="mt-2 text-xs text-amber-200">{L("مستوى الثقة:")} {report.confidence==='NO_SUPPORTED_PRIMARY_VALUE'?
        L('لا توجد قيمة أولية مؤهلة') :report.confidence==='UNRECONCILED_METHODS_NO_PRIMARY_VALUE'?
        L('إيقاف النتيجة الموحدة بسبب اختلاف جوهري بين المنهجيات') : L('مؤشر أولي غير متحقق مهنيًا')}.
        {report.specialistReason?L(' يلزم نموذج قطاعي متكامل للأصل المتخصص قبل إنتاج سعر رئيسي.'):''}
      </p>
      {report.methodGapPct!==null&&<p className="mt-2 text-xs text-slate-300">
        {L("فارق مؤشري السوق والدخل:")} {report.methodGapPct.toFixed(1)}{L("% من الأكبر؛")}
        {report.materialMethodGap?L(' لا يُسمح باحتساب المتوسط كقيمة واحدة حتى تفسير الفرق ومراجعته.'):L(' للتوثيق والتحقق من ملاءمة المنهجين.')}
      </p>}
      {report.saleDispersion&&<p className="mt-1 text-xs text-slate-300">
        {L("مدى أسعار بيع المتر المقبولة:")} {money(report.saleDispersion.min)} {L("إلى")} {money(report.saleDispersion.max)}{L(". الاتساع النسبي للمدى:")} {(report.saleDispersion.spreadToMedian*100).toFixed(1)}{L("% — لا يمثل حد ثقة إحصائيًا.")}
      </p>}
      <p className="text-xs text-slate-300 mt-3">{L("مقارنات البيع المقبولة:")} {report.eligibleSalesCount} {L("من")} {allSales.length} {L("(مستبعد")} {report.excludedSalesCount}{L(") | عقود الإيجار المقبولة:")} {report.eligibleRentalsCount} {L("من")} {allRentals.length} {L("(مستبعد")} {report.excludedRentalsCount}{L(") | مشروعات قريبة بمصدر معلن:")} {report.nearbyProjects.length}</p>
      <p className="text-xs text-slate-300 mt-2">{L("مقارنات بلا إحداثيات للقطعة، قُبلت فقط على أساس تطابق الحي والمدينة: بيع")} {report.districtOnlySalesCount}{L("، إيجار")} {report.districtOnlyRentalsCount}{L(". تقريبي ولا يثبت البعد الحقيقي عن العقار.")}</p>
      <p className="text-xs text-amber-200 mt-2">{L("الأثر الافتراضي للمشروعات على القيمة، منفصل عن الأساس:")} {money(report.projectScenarioSar)}{L(". يتطلب إثباتًا مستقلًا لعلاقة التأثير وليس مجرد قرب المشروع.")}</p>
      <p className="text-xs text-rose-200 mt-2">
        {L("الإيجار المسموح نظاميًا: غير محسوب آليًا.")} {report.rentRegulation==='EXISTING_RENT_FREEZE_REQUIRES_EJAR_REVIEW'
          ? L('راجع قيمة آخر عقد إيجار والضوابط الخاصة بالرياض قبل التسعير التعاقدي.')
          : L('يلزم التحقق من النطاق العمراني وتاريخ التأجير وضوابط العلاقة الإيجارية.')}
      </p>
      {!!report.issues.length&&<p className="mt-2 text-xs text-amber-300">{L("بيانات بحاجة لاستكمال:")} {report.issues.map(x=>L(labelMap[x]||x)).join(english?'; ':'؛ ')}.</p>}
      <p className="mt-2 text-xs text-slate-400">{L("بيانات مقارنة يُقر بها المستخدم ولم يُتحقق منها مستقلاً. لا توجد تغذية لحظية مرخّصة متصلة. لا تستعمل هذه النتيجة كتقييم رسمي أو أساس قرار شراء ملزم.")}</p>
    </div>
    <div data-testid="appraisal-market-link-status" data-status={appraisalBinding.status} role="status" className="mt-3 rounded border border-slate-600 p-3 text-xs text-slate-200">
      {L("ربط تدقيق تقرير التقييم بدراسة السوق:")} {appraisalBinding.status==='NOT_LINKED'?L('غير مرتبط — لا يجوز افتراض اعتماد التقرير'):
      appraisalBinding.status==='LINKED_REVIEW_REQUIRED'?L('تم الربط بإقرار المستخدم — مراجعة غير معتمدة'):
      L('HOLD — تعارض تدقيق أو تغيير بيانات الهوية؛ تمنع القيمة الموحدة والتصدير البحثي حتى التسوية')}.
    </div>
    <ValuationQualityPanel readiness={valuationReadiness} quality={appraisalQuality} studyAsOf={studyAsOf}/>
    <MarketOfferResearchPanel subject={subject} offers={marketOffers} setOffers={setMarketOffers} asOf={studyAsOf.asOf}/>
    <TransactionCohortAndUnitMixPanel subject={subject} sales={allSales} askingOffers={marketOffers} asOf={studyAsOf.asOf}
       unitMix={unitMix} setUnitMix={setUnitMix} leaseComparables={leaseComparables}
       setLeaseComparables={setLeaseComparables} rentAssumptions={rentAssumptions}
       setRentAssumptions={setRentAssumptions}/>
    <ProfessionalComparableReviewPanel subject={subject} sales={allSales}/>
    <CrossMethodEvidencePanel subject={subject} report={report}/>
    <section data-testid="saved-deal-market-study-link"
      className="mt-5 rounded-xl border border-slate-600 bg-[#14263C] p-4">
      <h3 className="text-sm font-semibold text-amber-100">{L("ربط الدراسة البحثية بصفقة محفوظة في STARTAK")}</h3>
      <p className="mt-2 text-xs leading-6 text-slate-300">
        {L("يحفظ هذا المسار نسخة من مدخلات الدراسة كملحق مستقل للصفقة التي تحددها، ولا يعدل أرقام المدخلات المالية الأساسية أو السجل المعياري أو الموافقات. حفظ محلي حسب موفر التخزين المتاح، وقد لا تتاح النسخة من جهاز آخر؛ احتفظ أيضًا بنسخة JSON خاصة.")}
      </p>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <button type="button" disabled={linkedStudyBusy} onClick={refreshCanonicalDeals}
          className="min-h-[40px] rounded-lg border border-amber-600 px-3 py-2 text-xs text-amber-100">
          {L("تحديث قائمة الصفقات المحفوظة")}
        </button>
        <label className="text-xs text-slate-300 flex-1 min-w-[220px]">
          {L("اختر الصفقة المراد ربط الدراسة بها (اختيار صريح)")}
          <select className="mt-1 w-full min-h-[40px] rounded-lg border border-slate-600 bg-[#101c30] px-3 py-2"
            aria-label={L("اختيار الصفقة لربط دراسة السوق")}
            value={selectedSavedDealId}
            onChange={e=>{setSelectedSavedDealId(e.target.value);setReplaceLinkedStudy(false);setLinkedDealIdentityAcknowledged(false);}}>
            <option value="">{L("— اختر صفقة محفوظة —")}</option>
            {savedDeals.map(deal=><option data-user-content translate="no" key={deal.id} value={deal.id}>{deal.name} ({deal.id})</option>)}
          </select>
        </label>
      </div>
      {linkedDealNameConflict&&<p data-testid="appraisal-sidecar-name-mismatch" role="alert" className="mt-2 text-xs text-rose-200">{L("تعذر ربط تقرير التقييم بهذه الصفقة: اسم الصفقة المحفوظة مختلف عن اسم العقار الجاري دراسته. يلزم تصحيح الربط بعد التحقق من هوية الأصل.")}</p>}
      <label className="mt-3 min-h-[40px] inline-flex items-center gap-2 text-xs text-slate-300">
        <input type="checkbox" className="h-6 w-6" checked={linkedDealIdentityAcknowledged}
          onChange={e=>setLinkedDealIdentityAcknowledged(e.target.checked)}/>
        {L("أؤكد أن الدراسة تخص العقار نفسه في الصفقة المختارة (إقرار مستخدم وليس تحققًا من الصك).")}
      </label>
      <label className="mt-3 min-h-[40px] inline-flex items-center gap-2 text-xs text-slate-300">
        <input type="checkbox" className="h-6 w-6" checked={replaceLinkedStudy}
          onChange={e=>setReplaceLinkedStudy(e.target.checked)}/>
        {L("أوافق على استبدال ملحق دراسة محفوظ سابقًا لهذه الصفقة")}
      </label>
      <div className="flex flex-wrap gap-2 mt-3">
        <button type="button" disabled={linkedStudyBusy||!selectedSavedDealId||!linkedDealIdentityAcknowledged||appraisalBinding.blockExport||linkedDealNameConflict}
          onClick={saveLinkedStudy} className="min-h-[40px] rounded-lg bg-[#C9A24C] px-4 py-2 text-xs font-semibold text-[#141F35] disabled:opacity-50">
          {L("حفظ ملحق الدراسة للصفقة المختارة")}
        </button>
        <button type="button" disabled={linkedStudyBusy||!selectedSavedDealId}
          onClick={loadLinkedStudy} className="min-h-[40px] rounded-lg border border-slate-600 px-4 py-2 text-xs text-slate-100 disabled:opacity-50">
          {L("استعادة ملحق الدراسة المرتبط")}
        </button>
      </div>
      <p data-testid="market-sidecar-action-notice" data-diagnostic-content translate="no" role="status" className="mt-3 text-xs text-amber-200">{researchActionText(savedDealStudyStatus,locale)}</p>
    </section>
    <div className="flex flex-wrap gap-3 mt-4">
      <button type="button" data-testid="personal-market-study-export" onClick={exportJson} className="rounded-lg bg-[#C9A24C] px-4 py-2 text-xs font-semibold text-[#141F35]">{L("تصدير الدراسة الأولية JSON")}</button>
      <label className="inline-flex flex-wrap items-center gap-2 rounded-lg border border-slate-600 px-3 py-2 text-xs text-slate-100">
        {L("استعادة دراسة محفوظة JSON")}
        <input data-testid="personal-market-study-import" aria-label={L("استيراد دراسة STARTAK الشخصية JSON")} className="min-h-[40px] max-w-[220px] text-xs"
          type="file" accept=".json,application/json"
          onChange={async e=>{const f=e.target.files?.[0];e.target.value='';await restoreJson(f);}}/>
      </label>
      <a className="rounded-lg border border-slate-600 px-4 py-2 text-xs text-sky-300" target="_blank" rel="noopener noreferrer" href="https://rei.rega.gov.sa/">{L("المؤشرات العقارية الرسمية")}</a>
      <a className="rounded-lg border border-slate-600 px-4 py-2 text-xs text-sky-300" target="_blank" rel="noopener noreferrer" href="https://www.suhail.ai/">{L("منصة سهيل — جميع مناطق المملكة")}</a>
      <a className="rounded-lg border border-slate-600 px-4 py-2 text-xs text-sky-300" target="_blank" rel="noopener noreferrer" href="https://srem.moj.gov.sa/">{L("الصفقات المسجلة — وزارة العدل")}</a>
      <a className="rounded-lg border border-slate-600 px-4 py-2 text-xs text-sky-300" target="_blank" rel="noopener noreferrer" href="https://opendata.rcrc.gov.sa/">{L("بيانات ومشاريع مدينة الرياض المكانية")}</a>
    </div>
    <ResearchEvidenceFusionPanel subject={subject} feeds={researchFeeds}
      asOf={studyAsOf.asOf.toISOString().slice(0,10)}
      marketReport={report} readiness={valuationReadiness}
      publicNeighborhood={publicNeighborhood} publicLoadMeta={publicLoadMeta}
      readinessStatus={valuationReadiness.status}/>
    <ChallengerBenchmarkResearchPanel/>
    <SuhailNationalResearchPanel key={'suhail-'+researchSessionEpoch} onResearchChange={rows=>setResearchFeeds(f=>({...f,suhail:rows}))}/>
    <SaudiListingSourcesResearchPanel key={'listings-'+researchSessionEpoch} onResearchChange={rows=>setResearchFeeds(f=>({...f,listings:rows}))}/>
    <EarthNationalResearchPanel key={'earth-'+researchSessionEpoch} onResearchChange={rows=>setResearchFeeds(f=>({...f,earth:rows}))}/>
    <SaudiNationalIntelligenceSourcesPanel key={'national-'+researchSessionEpoch} onResearchChange={rows=>setResearchFeeds(f=>({...f,national:rows}))}/>
    {message&&<p data-testid="market-study-action-notice" data-diagnostic-content translate="no" role="status" className="text-xs text-slate-200 mt-2">{researchActionText(message,locale)}</p>}
  </section>;
}
