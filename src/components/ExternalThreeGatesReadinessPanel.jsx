import React from 'react';
const {evaluateExternalQualification}=require('../governance/external-three-gates-readiness');

const LINKS=Object.freeze({
 market:'https://rei.rega.gov.sa/ar/advanced-search/deals',
 ai:'https://startak-real-estate.pages.dev/api/riai/public-config',
 compliance:'https://taqeem.gov.sa/service-guide/1355',
});
const LABELS={
 market:'الصفقات المنفذة ودقة التقييم',
 ai:'مزود الذكاء الاصطناعي وتشغيله',
 compliance:'الأمن والخصوصية والمراجعة المهنية',
};
export default function ExternalThreeGatesReadinessPanel({locale='ar-SA'}){
 const data=evaluateExternalQualification();
 const ar=locale!=='en';
 const names=ar?LABELS:{
  market:'Verified executed sales / valuation accuracy',
  ai:'Production AI provider qualification',
  compliance:'Security, privacy, licensed review',
 };
 return <section data-testid="external-three-gates-readiness" dir={ar?'rtl':'ltr'}
  className="mt-4 rounded-xl border border-amber-900/60 p-4"
  style={{background:'#111C31',color:'#E4EAF3'}}>
  <h4 className="text-sm font-semibold">
   {ar?'ثلاث بوابات خارجية لا تُغلق بالمحاكاة':'Three external gates — synthetic CI cannot close them'}
  </h4>
  <p className="mt-2 text-xs leading-relaxed">
   {ar?
    'نجاح الحساب والمتصفح لا يعني صحة الأسعار السعودية أو تشغيل نموذج ذكاء اصطناعي فعلي أو السماح بإصدار تقرير مهني. الأدلة الخارجية غير مرفوعة أو موثقة في هذه الدراسة الشخصية.':
    'Passing arithmetic and browser CI does not establish Saudi market accuracy, real provider AI operation or licensed report issuance. Independent external evidence is not verified here.'}
  </p>
  <div className="mt-3 grid gap-2 md:grid-cols-3">
   {['market','ai','compliance'].map(k=><div key={k} data-testid={'external-gate-'+k}
    className="p-3 rounded-lg border border-slate-600/60">
    <strong className="text-xs">{names[k]}</strong>
    <p className="mt-2 text-xs" style={{color:'#EAC58B'}}>
     {ar?'معلّق — يلزم تحقق مستقل':'HOLD — independent verification required'}
    </p>
    <p className="mt-2 text-xs" style={{color:'#C1CAD9'}}>
     {ar?'متطلبات إثبات ناقصة: ':'Missing evidence requirements: '}
     {data.gates[k].reasonCodes.length}
    </p>
    <a href={LINKS[k]} target="_blank" rel="noopener noreferrer"
     className="mt-2 inline-block text-xs underline" style={{color:'#B4D8F9'}}>
     {ar?'مرجع للتحقق — ليس اتصالًا حيًا':'Reference — not an integrated feed'}
    </a>
   </div>)}
  </div>
  <p data-testid="external-three-gates-authority" className="mt-3 text-xs" style={{color:'#EAC58B'}}>
   {ar?
    'لا اعتماد لسعر سوقي أو للتشغيل التجاري أو للشراء أو لتخزين بيانات عملاء فعلية.':
    'No verified market value, commercial go-live, purchase authorization or real-client vault approval.'}
  </p>
 </section>;
}
