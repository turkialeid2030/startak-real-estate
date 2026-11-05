import React,{useRef} from 'react';
const {researchSourceLabel}=require('../i18n/research-source-presentation');

// The browser-native file picker is never rendered as a 16px touch target.
// Keep the original input/test id and change event, while exposing a 44px,
// keyboard-operable localized button for all research CSV import surfaces.
export default function ResearchCsvUpload({testId,locale='ar-SA',onChange,disabled=false}){
 const ref=useRef(null);
 const choose=researchSourceLabel('اختيار ملف CSV',locale);
 return <div className="mt-2">
  <button type="button" data-testid={testId+'-choose'} aria-label={choose}
   disabled={disabled}
   className="inline-flex min-h-[44px] min-w-[140px] max-w-full items-center justify-center rounded-lg border border-amber-400/70 bg-slate-800 px-4 py-2 text-sm font-semibold text-amber-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 disabled:cursor-not-allowed disabled:opacity-60"
   onClick={()=>ref.current?.click()}>{choose}</button>
  <input ref={ref} data-testid={testId} type="file" accept=".csv,text/csv"
   hidden tabIndex={-1} aria-hidden="true" disabled={disabled} onChange={onChange}/>
 </div>;
}
