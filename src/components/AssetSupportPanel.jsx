import React from 'react';
const { ASSET_SUPPORT,assetSupport }=require('../project-model/asset-support');
const {useLocale}=require('../i18n/LocaleContext');
export default function AssetSupportPanel({assetClass=null}) {
 const {locale,dir}=useLocale();const ar=locale==='ar-SA';
 const selected=assetClass?assetSupport(assetClass):null;
 return <section data-testid="asset-support-matrix" dir={dir} className="mx-auto my-4 max-w-7xl rounded-xl border border-sky-800/60 bg-[#101a2d] p-4 text-xs text-slate-200">
  <h2 className="font-bold">{ar?'حدود دعم فئات العقار':'Asset support boundaries'}</h2>
  <p className="mt-2 leading-6">{ar?'الحساب الحالي نموذج إيجار مجمع للمبنى، أو نموذج تطوير عام للأرض. اسم الفئة لا يثبت وجود محرك متخصص أو بيانات سوق موثقة.':'Current calculations use aggregate building rent or general land development. Classification does not qualify a specialist engine or verify market data.'}</p>
  {selected?<p data-testid="selected-asset-support" className="mt-2 text-amber-200">{ar?selected.ar:selected.en}: {ar?selected.noteAr:selected.noteEn}</p>:null}
  <details className="mt-3"><summary className="cursor-pointer rounded p-2 font-semibold">{ar?'عرض مصفوفة الدعم لجميع الفئات':'Show the support matrix for all asset classes'}</summary>
   <div className="overflow-x-auto"><table className="mt-2 w-full border-collapse text-start"><caption className="sr-only">{ar?'مصفوفة دعم فئات الأصل':'Asset class support matrix'}</caption><thead><tr>{(ar?['الفئة','الحالة','حد الحساب']:['Asset','Status','Calculation boundary']).map(h=><th key={h} scope="col" className="border border-slate-700 p-2 text-start">{h}</th>)}</tr></thead><tbody>{ASSET_SUPPORT.map(row=><tr key={row.assetClass}><th scope="row" className="border border-slate-700 p-2 text-start">{ar?row.ar:row.en}</th><td className="border border-slate-700 p-2">{row.status==='GENERAL_MODEL'?(ar?'نموذج عام':'General model'):(ar?'مدخلات فقط':'Intake only')}</td><td className="border border-slate-700 p-2">{ar?row.noteAr:row.noteEn}</td></tr>)}</tbody></table></div>
  </details>
 </section>;
}
