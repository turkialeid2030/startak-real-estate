import React, {useState} from 'react';
import PersonalSectorValuationWorkbench from './PersonalSectorValuationWorkbench.jsx';
import PersonalLimitedInterestDcfPanel from './PersonalLimitedInterestDcfPanel.jsx';
import PersonalPhasedDevelopmentDcfPanel from './PersonalPhasedDevelopmentDcfPanel.jsx';
const {ALL_SECTORS,SOURCE_CHANNELS,researchSectorRoute}=
  require('../governance/personal-asset-universe');

export default function PersonalAssetUniversePanel({locale='ar-SA'}) {
  const ar=locale!=='en';
  const [assetClass,setAssetClass]=useState('RESIDENTIAL');
  const route=researchSectorRoute(assetClass);
  const sector=route.sector;
  return (
    <section data-testid="personal-asset-universe-panel" className="mt-5 rounded-2xl p-4 md:p-5"
      style={{background:'#141F35',border:'1px solid #334056'}} dir={ar?'rtl':'ltr'}>
      <h3 className="text-base font-semibold" style={{color:'#F0EAE0'}}>
        {ar?'دليل جميع الفئات العقارية — بحث شخصي':'All property types — personal research guide'}
      </h3>
      <p className="text-xs leading-relaxed mt-2" style={{color:'#BAC2D2'}}>
        {ar?'يدعم الدليل تصنيف جميع القطاعات، لكن المحركات غير المؤهلة لا تتحول إلى تقييم معتمد تلقائياً. تظل صحة السعر والمصدر وحقوق العقار بحاجة لإثبات.'
           :'All sectors can be classified; an unqualified engine cannot become a certified valuation automatically. Prices, evidence and title require independent verification.'}
      </p>
      <label className="block text-sm font-medium mt-3" htmlFor="personal-asset-universe-class" style={{color:'#EFE7D6'}}>
        {ar?'نوع العقار المطلوب تحليله':'Property type to research'}
      </label>
      <select id="personal-asset-universe-class" data-testid="personal-asset-universe-select"
        className="w-full mt-2 rounded-lg p-2 text-sm" style={{color:'#172033',background:'#F3F3F1'}}
        value={assetClass} onChange={event=>setAssetClass(event.target.value)}>
        {Object.values(ALL_SECTORS).map(s=><option value={s.id} key={s.id}>{ar?s.ar:s.en}</option>)}
      </select>
      <div className="mt-3 text-sm" data-testid="personal-asset-route-status" style={{color:'#E8C78D'}}>
        {route.status==='PRELIMINARY_EXISTING_PROPERTY_RESEARCH'
          ? (ar?'دراسة أولية للمبنى القائم؛ معايير القطاع والبيانات لا تزال تحتاج مراجعة':'Preliminary existing-property study; sector evidence needs review')
          :route.status==='PRELIMINARY_LAND_DEVELOPMENT_RESEARCH'
          ? (ar?'دراسة أولية للأرض أو التطوير؛ راجع التنظيم والبرنامج الزمني والتكاليف':'Preliminary land/development study; check zoning, timing and costs')
          : (ar?'تقييم تخصصي غير مؤهل من البداية للنهاية؛ لا تطبق نموذج المباني العام عليه':'Specialist valuation not qualified end-to-end; do not substitute the general building model')}
      </div>
      <p data-testid="personal-asset-sector-evidence" className="text-xs leading-relaxed mt-2" style={{color:'#E3E7ED'}}>
        <strong>{ar?'أدلة القطاع المطلوبة: ':'Required sector evidence: '}</strong>
        {ar?sector.evidenceAr:sector.evidenceEn}
      </p>
      <PersonalSectorValuationWorkbench key={assetClass} assetClass={assetClass} locale={locale}/>
      <PersonalLimitedInterestDcfPanel key={assetClass+'-rights'} assetClass={assetClass} locale={locale}/>
      {assetClass==='LAND'&&<PersonalPhasedDevelopmentDcfPanel key="land-development" locale={locale}/> }
      <p className="text-xs mt-2" style={{color:'#AFC0D8'}}>
        {ar?'قنوات رسمية للبحث والتحقق (قد يتطلب بعضها النفاذ الوطني):':'Official research channels (some require authentication):'}
      </p>
      <ul className="flex flex-col gap-1 mt-1">
        {SOURCE_CHANNELS.map(src=><li key={src.id}>
          <a href={src.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[32px] items-center py-2 text-xs underline"
             style={{color:'#B9D9F6'}}>{ar?src.ar:src.en}</a>
        </li>)}
      </ul>
      <p className="text-[11px] mt-3" style={{color:'#A4AFC3'}}>
        {ar?'روابط المرجع لا تعني وجود اتصال مباشر أو سحب بيانات حي؛ ولا تعني أن العروض والإحصاءات المجمعة صفقات بيع منفذة.'
          :'Links are references, not live data integrations; asking prices and aggregate statistics are not executed-sale comparables.'}
      </p>
    </section>
  );
}
