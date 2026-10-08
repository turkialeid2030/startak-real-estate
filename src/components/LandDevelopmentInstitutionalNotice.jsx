import React from 'react';
const {assessLandDevelopmentInstitutionalBoundary}=require('../app/land-development-institutional-boundary');

const labels=Object.freeze({
 'ar-SA':{
  status:'التقييم المؤسسي للأرض والتطوير: معلّق.',
  disclaimer:'جميع النتائج المعروضة تقديرات مالية أولية وليست قيمة عقارية معتمدة أو موافقة استثمارية. لا يتوافر في المسار الحالي تحقق مستقل من الصفقات، وحقوق المصادر، وتنظيم البناء، والتدفقات النقدية التطويرية المؤرخة، أو اعتماد المقيم المختص.',
  count:'متطلبات الاستكمال: ٤',
  reasons:[
    'التحقق المستقل من صفقات بيع أراضٍ سعودية منفذة ومتماثلة.',
    'ربط التدفقات النقدية التطويرية المؤرخة بالمنهج المتبقي بعد المراجعة.',
    'التحقق من الصك والحقوق التنظيمية والتخطيطية والتراخيص.',
    'اعتماد التقييم والتقرير الرسمي لدى جهة مهنية مخولة.',
  ],
 },
 en:{
  status:'Land and development institutional valuation: ON HOLD.',
  disclaimer:'Displayed calculations are preliminary and are not a licensed appraisal or investment approval. Independent executed land sales, source rights, title/planning, dated development cash flows and professional review are not established here.',
  count:'Outstanding evidence requirements: 4',
  reasons:[
    'Independent authentication of executed Saudi land transactions.',
    'Independently reviewed dated development residual cash-flow integration.',
    'Legal title, planning and permitted development rights verification.',
    'Authorized professional appraisal and official report issuance.',
  ],
 },
});
export default function LandDevelopmentInstitutionalNotice({mode,locale='ar-SA'}){
 const boundary=assessLandDevelopmentInstitutionalBoundary({mode});
 if(!boundary)return null;
 const txt=labels[locale==='en'?'en':'ar-SA'];
 return <section data-testid="land-development-institutional-hold"
   data-c64-status={boundary.status} dir={locale==='en'?'ltr':'rtl'}
   role="status" aria-live="polite"
   className="mx-auto mt-4 w-full max-w-7xl rounded-xl border border-amber-600/60 bg-amber-950/20 px-4 py-3 text-sm text-amber-200">
   <div className="font-semibold">{txt.status}</div>
   <p className="mt-1 text-xs leading-6">{txt.disclaimer}</p>
   <div className="mt-2 text-xs font-medium">{txt.count}</div>
   <ul className="mt-2 list-disc ps-4 space-y-1 text-xs">
     {txt.reasons.map((reason,index)=><li key={boundary.blockers[index]}>{reason}</li>)}
   </ul>
 </section>;
}
