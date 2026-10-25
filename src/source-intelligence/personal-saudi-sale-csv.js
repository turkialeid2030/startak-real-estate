'use strict';

// Offline market-data exploration only: local file rows and user-declared
// source DO NOT establish official authenticity, data rights or valuation.
const {sourceUrlMatchesProvider}=require('./source-provider-registry');
const MAX_CSV_BYTES=2*1024*1024;
const MAX_ROWS=10000;
const MAX_COLUMNS=64;
const MAX_CELL_CHARS=12000;
const PROVIDERS=Object.freeze({
 REGA_REAL_ESTATE_INDICATORS:'https://rei.rega.gov.sa/ar/advanced-search/deals/details',
 MINISTRY_OF_JUSTICE_REAL_ESTATE_TRANSACTIONS:'https://www.moj.gov.sa/ar/OpenData/pages/reports.aspx',
});
const ALIASES=Object.freeze({
 date:['date','transaction_date','تاريخ الصفقة','تاريخ الإفراغ','التاريخ'],
 price:['price_sar','transaction_price','price','قيمة الصفقة','قيمة الصفقة (ر.س)','السعر','الثمن'],
 area:['area_sqm','area','المساحة','المساحة (م2)','المساحة بالمتر المربع'],
 city:['city_ar','city','اسم المدينة','المدينة'],
 subtype:['property_type','property_type_ar','نوع العقار','نوع الوحدة العقارية'],
 ref:['ref_no','reference_no','transaction_reference','رقم الصفقة','الرقم المرجعي','رقم الإفراغ'],
 count:['properties_count','عدد العقارات','عدد العقارات في الصفقة','الوحدات في الصفقة'],
 unitPrice:['price_per_sqm','سعر المتر','سعر المتر المربع'],
 district:['district_ar','district','الحي','اسم الحي'],
 classification:['classification','تصنيف العقار'],
});
const REQUIRED=Object.freeze(['date','price','area','city','subtype','ref','count']);
function digits(v){return String(v||'').replace(/[\u0660-\u0669\u06F0-\u06F9]/g,ch=>{
 const code=ch.charCodeAt(0);return String(code>=0x06f0?code-0x06f0:code-0x0660);
 });}
function parseAmount(v){
 let s=digits(v).trim().replace(/\u00a0/g,'').replace(/\u066c/g,',').replace(/\u066b/g,'.');
 if(!/^(?:\d+(?:\.\d+)?|\d{1,3}(?:,\d{3})+(?:\.\d+)?)$/.test(s))return null;
 s=s.replace(/,/g,'');
 const num=Number(s);return Number.isFinite(num)?num:null;
}
function validDate(value,asOf){
 let date=digits(value).trim().replace(/\//g,'-');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return null;
 const day=new Date(date+'T00:00:00.000Z');
 if(!Number.isFinite(day.getTime())||day.toISOString().slice(0,10)!==date||date>asOf)return null;
 return date;
}
function normalizeHeader(s){return digits(s).trim().toLowerCase().replace(/\ufeff/g,'').replace(/[\u200e\u200f\u061c]/g,'').replace(/\s+/g,' ');}
function parseDelimited(source){
 if(typeof source!=='string'||new TextEncoder().encode(source).length>MAX_CSV_BYTES)
   throw Error('CSV_INVALID_SIZE');
 if(/[\u0000]/.test(source))throw Error('CSV_BINARY_CONTENT');
 const input=source.replace(/^\ufeff/,'');
 // Choose separator using the first logical line, ignoring delimiters in quotes.
 let quoted=false,commas=0,semis=0;
 for(let i=0;i<input.length;i++){
   const c=input[i];if(c==='"'){if(quoted&&input[i+1]==='"'){i++;continue;}quoted=!quoted;}
   else if(!quoted&&(c==='\r'||c==='\n'))break;
   else if(!quoted&&c===',')commas++;
   else if(!quoted&&c===';')semis++;
 }
 const sep=semis>commas?';':',';
 const rows=[];let row=[],cell='',inQuote=false,afterQuote=false;
 function field(){if(cell.length>MAX_CELL_CHARS)throw Error('CSV_FIELD_TOO_LONG');row.push(cell.trim());cell='';afterQuote=false;if(row.length>MAX_COLUMNS)throw Error('CSV_TOO_MANY_COLUMNS');}
 function record(){field();if(row.some(x=>x!==''))rows.push(row);row=[];if(rows.length>MAX_ROWS+1)throw Error('CSV_TOO_MANY_ROWS');}
 for(let i=0;i<input.length;i++){
   const ch=input[i];
   if(inQuote){if(ch==='"'){if(input[i+1]==='"'){cell+='"';i++;}else{inQuote=false;afterQuote=true;}}else cell+=ch;}
   else if(ch==='"'){if(cell.trim()!==''||afterQuote)throw Error('CSV_INVALID_QUOTE');inQuote=true;}
   else if(ch===sep){field();}
   else if(ch==='\r'||ch==='\n'){record();if(ch==='\r'&&input[i+1]==='\n')i++;}
   else{if(afterQuote&&!/\s/.test(ch))throw Error('CSV_INVALID_QUOTE_SUFFIX');cell+=ch;}
   if(cell.length>MAX_CELL_CHARS)throw Error('CSV_FIELD_TOO_LONG');
 }
 if(inQuote)throw Error('CSV_UNTERMINATED_QUOTE');
 if(cell!==''||row.length>0)record();
 if(rows.length<2)throw Error('CSV_EMPTY_OR_NO_DATA');
 return rows;
}
function median(values){
 const a=[...values].sort((x,y)=>x-y),i=Math.floor(a.length/2);
 return a.length%2?a[i]:(a[i-1]+a[i])/2;
}
function freeze(v){if(v&&typeof v==='object'&&!Object.isFrozen(v)){Object.values(v).forEach(freeze);Object.freeze(v);}return v;}
function reviewLocalSaudiSaleCsv({csvText,sourceProvider,sourceUrl,asOf}={}){
 const base={
  status:'HOLD_NOT_AUTHENTICATED_MARKET_SOURCE',sourceProvider:sourceProvider||null,
  sourceUrl:sourceUrl||null,fileSha256:null,sourceLicenseIndependentlyVerified:false,
  sourceTransactionAuthenticityVerified:false,independentMarketAccuracyVerified:false,
  transactionAuthorized:false,certifiedValuation:false,
 };
 const fail=(code,additional={})=>freeze({...base,reason:code,rowsAccepted:0,rowsExcluded:0,
  reasons:Object.freeze({}),groups:[],...additional});
 if(!Object.prototype.hasOwnProperty.call(PROVIDERS,sourceProvider)||
    typeof sourceUrl!=='string'||!sourceUrlMatchesProvider(sourceProvider,sourceUrl))
   return fail('SOURCE_PROVIDER_URL_NOT_ALLOWLISTED');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(asOf||'')||validDate(asOf,asOf)!==asOf)
   return fail('VALID_AS_OF_DATE_REQUIRED');
 let raw;
 try{raw=parseDelimited(csvText);}catch(e){return fail(e.message||'INVALID_CSV');}
 const headers=raw[0].map(normalizeHeader);
 if(new Set(headers).size!==headers.length)return fail('DUPLICATE_HEADER');
 const indexes={};
 for(const [key,names] of Object.entries(ALIASES)){
  const matches=headers.map((h,i)=>names.includes(h)?i:-1).filter(i=>i>=0);
  if(matches.length>1)return fail('AMBIGUOUS_COLUMN_'+key.toUpperCase());
  indexes[key]=matches.length===1?matches[0]:-1;
 }
 const missing=REQUIRED.filter(key=>indexes[key]<0);
 if(missing.length)return fail('REQUIRED_COLUMNS_MISSING', {missingColumns:missing});
 const excluded={};const seen=new Set(),valid=[];
 const exclude=(code)=>{excluded[code]=(excluded[code]||0)+1;};
 for(let i=1;i<raw.length;i++){
  const row=raw[i];
  if(row.length!==headers.length){exclude('COLUMN_COUNT_MISMATCH');continue;}
  const get=k=>indexes[k]<0?'':row[indexes[k]];
  const price=parseAmount(get('price')),area=parseAmount(get('area')),count=parseAmount(get('count'));
  if(!price||!area||price<=0||area<=0||price>1e13||area>1e9){exclude('PRICE_OR_AREA_INVALID');continue;}
  if(!Number.isSafeInteger(count)||count!==1){exclude('MULTI_PROPERTY_OR_UNDECLARED_COUNT');continue;}
  const date=validDate(get('date'),asOf);
  if(!date){exclude('DATE_MISSING_INVALID_OR_AFTER_AS_OF');continue;}
  const city=get('city').trim(),subtype=get('subtype').trim(),ref=get('ref').trim();
  if(!city||!subtype||!ref||city.length>120||subtype.length>120||ref.length>120){exclude('PROPERTY_IDENTITY_INCOMPLETE');continue;}
  // Duplicate references are held from the research cohort rather than
  // counted twice, including duplicates that change price or subtype.
  if(seen.has(ref)){exclude('DUPLICATE_REFERENCE');continue;}seen.add(ref);
  const ppm=price/area;
  if(indexes.unitPrice>=0&&get('unitPrice').trim()!==''){
   const published=parseAmount(get('unitPrice'));
   if(published===null||Math.abs(ppm-published)>Math.max(1,ppm*0.001)){exclude('REPORTED_PRICE_PER_SQM_CONFLICT');continue;}
  }
  const district=get('district').trim(),classification=get('classification').trim();
  if(district.length>120||classification.length>120){exclude('LOCATION_OR_CLASSIFICATION_TOO_LONG');continue;}
  valid.push({date,city,subtype,classification,district,pricePerSqm:ppm,price,area});
 }
 const groups=new Map();
 for(const row of valid){
  // Never blend residential/commercial/agricultural classifications or
  // districts into a single comparable price distribution.
  const key=JSON.stringify([row.city,row.district,row.classification,row.subtype]);
  if(!groups.has(key))groups.set(key,{city:row.city,district:row.district,
    classification:row.classification,subtype:row.subtype,values:[],dates:[]});
  const g=groups.get(key);g.values.push(row.pricePerSqm);g.dates.push(row.date);
 }
 const grouped=[...groups.values()].map(g=>({
  city:g.city,district:g.district,classification:g.classification,
  subtype:g.subtype,recordCount:g.values.length,
  medianPricePerSqm:g.values.length>=3?median(g.values):null,
  earliestDate:g.dates.slice().sort()[0],latestDate:g.dates.slice().sort().at(-1),
  disclosure:'DESCRIPTIVE_USER_FILE_ONLY_NOT_ASSET_VALUATION',
 })).sort((a,b)=>b.recordCount-a.recordCount).slice(0,40);
 return freeze({...base,reason:'RESEARCH_ONLY_UNVERIFIED_EXPORT',rowsTotal:raw.length-1,
  rowsAccepted:valid.length,rowsExcluded:(raw.length-1)-valid.length,
  reasons:excluded,groups:grouped,headerNames:headers,
  userProvidedRowsOnly:true,allEligibleGroupsRequireIndependentReview:true,
  sourceRightsNotInferredFromUrl:true});
}
module.exports={MAX_CSV_BYTES,MAX_ROWS,PROVIDERS,reviewLocalSaudiSaleCsv,parseDelimited,parseAmount,validDate};
