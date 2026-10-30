import React,{useState,useRef,useEffect} from 'react';
const {MAX_CSV_BYTES,PROVIDERS,reviewLocalSaudiSaleCsv}=
 require('../source-intelligence/personal-saudi-sale-csv');

export default function PersonalSaudiSaleCsvPanel({locale='ar-SA'}) {
 const ar=locale!=='en';
 const [provider,setProvider]=useState('MINISTRY_OF_JUSTICE_REAL_ESTATE_TRANSACTIONS');
 const [asOf,setAsOf]=useState(()=>new Date().toISOString().slice(0,10));
 const [result,setResult]=useState(null);
 const [fileHash,setFileHash]=useState(null);
 const [status,setStatus]=useState('');
 const request=useRef(0);
 useEffect(()=>()=>{request.current++;},[]);
 const invalidate=()=>{request.current++;setResult(null);setFileHash(null);setStatus('');};
 const messages={
  READING:ar?'جارٍ فحص الملف محليًا…':'Checking the file locally…',
  INVALID:ar?'الملف غير مدعوم أو حجمه يتجاوز ٢ ميغابايت.':'Invalid CSV file or file exceeds 2 MiB.',
  COMPLETE:ar?'فحص الملف محليًا. مصدر الصفقة وتراخيص استخدام البيانات لم يُتحقَّق منهما بشكل مستقل.':'Local file checks completed. Transaction authenticity and use rights remain independently unverified.',
  FAILED:ar?'تعذر قراءة الملف أو بصمته بصورة آمنة. لم تُعتمد أي نتائج.':'Unable to read or hash the file safely. No results were accepted.',
 };
 const dateFormat=(n)=>Number.isFinite(n)?new Intl.NumberFormat(locale,{maximumFractionDigits:1}).format(n):'—';
 async function readFile(event){
  const input=event.target,file=input.files?.[0],id=++request.current;setResult(null);setFileHash(null);setStatus('');
  if(!file)return;
  if(file.size<1||file.size>MAX_CSV_BYTES||!/\.csv$/i.test(file.name)){
   setStatus('INVALID');
   event.target.value='';return;
  }
  setStatus('READING');
  try{
   const buffer=await file.arrayBuffer();
   if(id!==request.current)return;
   if(buffer.byteLength<1||buffer.byteLength>MAX_CSV_BYTES)throw Error('CSV_INVALID_SIZE');
   // SHA-256 is calculated from the original exact bytes, not a normalized
   // text reconstruction; the file is NOT uploaded or persisted.
   if(!globalThis.crypto?.subtle)throw Error('LOCAL_SHA256_UNAVAILABLE');
   const digest=await globalThis.crypto.subtle.digest('SHA-256',buffer);
   if(id!==request.current)return;
   const hex=[...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('');
   const csvText=new TextDecoder('utf-8',{fatal:true}).decode(buffer);
   const reviewed=reviewLocalSaudiSaleCsv({
    csvText,sourceProvider:provider,sourceUrl:PROVIDERS[provider],asOf,
   });
   setResult(reviewed);setFileHash(hex);
   setStatus('COMPLETE');
  }catch(e){
   if(id===request.current)setStatus('FAILED');
  }finally{if(id===request.current)input.value='';}
 }
 return <section data-testid="personal-saudi-csv-panel" aria-busy={status==='READING'} dir={ar?'rtl':'ltr'}
   className="mt-4 rounded-2xl p-4 md:p-5" style={{background:'#141F35',border:'1px solid #334056'}}>
   <h3 className="font-semibold text-base" style={{color:'#EFE8DE'}}>
    {ar?'فحص ملف صفقات سعودي محليًا — دون رفعه للخادم':'Saudi sale-file check — processed locally'}
   </h3>
   <p className="text-xs mt-2 leading-relaxed" style={{color:'#BAC2D2'}}>
    {ar?'هذه الأداة تراجع بنية ملف CSV الذي تصدّره بنفسك من جهة رسمية، ولا تسحب صفقات مباشرة. النتائج وصفية، وليست سعرًا عادلًا أو تقرير تقييم أو إثباتًا لأصالة الصفقة.'
       :'This tool reviews CSV exports you obtain yourself from an official provider. No live data connection. Descriptive outputs are not fair values, appraisals or proof of an authentic transaction.'}
   </p>
   <label htmlFor="personal-saudi-csv-provider" className="block text-xs mt-3" style={{color:'#E4E8EF'}}>
    {ar?'الجهة التي تؤكد أنك صدّرت الملف منها':'Source you declare you exported from'}
   </label>
   <select id="personal-saudi-csv-provider" data-testid="personal-saudi-csv-provider"
     className="mt-1 p-2 min-h-[36px] rounded-lg w-full" style={{background:'#F2F2F0',color:'#142236'}}
     value={provider} onChange={e=>{invalidate();setProvider(e.target.value);}}>
     <option value="MINISTRY_OF_JUSTICE_REAL_ESTATE_TRANSACTIONS">{ar?'وزارة العدل':'Ministry of Justice'}</option>
     <option value="REGA_REAL_ESTATE_INDICATORS">{ar?'الهيئة العامة للعقار':'Real Estate General Authority'}</option>
   </select>
   <label htmlFor="personal-saudi-csv-asof" className="block text-xs mt-3" style={{color:'#E4E8EF'}}>
    {ar?'تاريخ حدّ الصفقات (لا تدخل صفقات بعده)':'Transactions cutoff date'}
   </label>
   <input id="personal-saudi-csv-asof" data-testid="personal-saudi-csv-asof" type="date" value={asOf} max={new Date().toISOString().slice(0,10)}
     className="w-full min-h-[36px] rounded-lg p-2 mt-1" style={{background:'#F2F2F0',color:'#142236'}}
     onChange={e=>{invalidate();setAsOf(e.target.value);}}/>
   <label htmlFor="personal-saudi-csv-file" className="block text-xs mt-3" style={{color:'#E4E8EF'}}>
    {ar?'ملف CSV — بحد أقصى ٢ ميغابايت، وينبغي وجود سعر ومساحة وتاريخ ومدينة ونوع ورقم وعدد العقارات':'CSV file (max 2 MiB): price, area, date, city, type, reference and count'}
   </label>
   <input id="personal-saudi-csv-file" data-testid="personal-saudi-csv-file" type="file" accept=".csv,text/csv"
     className="block w-full text-xs mt-2 py-2" onChange={readFile} style={{color:'#E5EBF6'}}/>
   {status&&<p role="status" className="text-xs mt-2" style={{color:'#E8BD81'}}>{messages[status]}</p>}
   {result&&<div data-testid="personal-saudi-csv-results" className="mt-3 space-y-2" style={{color:'#E5EBF6'}}>
     <p className="text-xs">{ar?'الصفوف المقبولة للفحص الوصفي':'Rows accepted for descriptive research'}: {dateFormat(result.rowsAccepted)}
       {' — '}{ar?'الصفوف المستبعدة':'Rows excluded'}: {dateFormat(result.rowsExcluded||0)}
     </p>
     <p className="text-xs" style={{color:'#E8BD81'}}>{ar?'الحالة: دليل تصدير مُصرح به من المستخدم — لم تثبت أصالة المصدر أو اكتمال السوق':'Status: user-declared export; provider authenticity and market coverage not verified'}</p>
     {result.reason!=='RESEARCH_ONLY_UNVERIFIED_EXPORT'&&
       <p className="text-xs">{ar?'مانع الفحص: ':'Review blocker: '}{result.reason}</p>}
     {result.reasons&&Object.keys(result.reasons).length>0&&
       <p className="text-xs">{ar?'أسباب الاستبعاد':'Exclusions'}: {Object.entries(result.reasons).map(([k,v])=>k+': '+v).join(' | ')}</p>}
     {fileHash&&<p className="text-[11px] break-all">
       {ar?'بصمة الملف المحلي SHA-256':'Local file SHA-256'}: <span dir="ltr">{fileHash}</span>
     </p>}
     {result.groups?.length>0&&
       <div className="overflow-x-auto"><table className="w-full text-xs text-start">
        <thead><tr>{(ar?['المدينة','الحي','التصنيف','نوع العقار','عدد السجلات','الوسيط الوصفي (ر.س/م²)']:['City','District','Class','Property type','Records','Descriptive median (SAR/m²)'])
         .map(x=><th className="p-2 text-start" key={x}>{x}</th>)}</tr></thead>
        <tbody>{result.groups.slice(0,12).map((g,i)=><tr key={i}>
         <td data-user-content translate="no" className="p-2">{g.city}</td><td data-user-content translate="no" className="p-2">{g.district||'—'}</td>
         <td data-user-content translate="no" className="p-2">{g.classification||'—'}</td><td data-user-content translate="no" className="p-2">{g.subtype}</td>
         <td className="p-2">{dateFormat(g.recordCount)}</td>
         <td className="p-2">{g.medianPricePerSqm===null
          ? (ar?'عينة غير كافية':'Insufficient sample'):dateFormat(g.medianPricePerSqm)}</td>
        </tr>)}</tbody>
       </table></div>}
     <p className="text-xs" style={{color:'#BAC2D2'}}>{ar?
      'الأرقام تعكس الصفوف المسموح بها في الملف فقط. لا تدمج أنواعًا عقارية مختلفة ولا تستخدم الوسيط لتقييم عقار منفرد دون توثيق الصفقة والمماثلة والمراجعة البشرية.':
      'Values describe eligible uploaded rows only. Do not value an individual asset without verifying its transactions, comparability and context.'}</p>
   </div>}
 </section>;
}
