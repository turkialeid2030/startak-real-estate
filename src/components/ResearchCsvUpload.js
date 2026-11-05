'use strict';
const React=require('react');
const {researchSourceLabel}=require('../i18n/research-source-presentation');

// The native input remains available to assistive technology and test-id selectors,
// but is not rendered as a low-height browser-controlled Choose File button.
function ResearchCsvUpload({testId,locale='ar-SA',onChange,disabled=false}){
 const ref=React.useRef(null);
 const choose=researchSourceLabel('اختيار ملف CSV',locale);
 return React.createElement('div',{className:'mt-2'},
  React.createElement('button',{
   type:'button','data-testid':testId+'-choose','aria-label':choose,disabled,
   className:'inline-flex min-h-[44px] min-w-[140px] max-w-full items-center justify-center rounded-lg border border-amber-400/70 bg-slate-800 px-4 py-2 text-sm font-semibold text-amber-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 disabled:cursor-not-allowed disabled:opacity-60',
   onClick:()=>ref.current?.click(),
  },choose),
  React.createElement('input',{ref,'data-testid':testId,type:'file',accept:'.csv,text/csv',
   hidden:true,tabIndex:-1,'aria-hidden':'true',disabled,onChange}));
}
module.exports=ResearchCsvUpload;
