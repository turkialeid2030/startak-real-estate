'use strict';
// Open-licensed public Saudi MOJ quarterly dataset research, run only on user click.
// Source: MOJ datasets mirrored unchanged by civillizard/Saudi-Real-Estate-Data
// Attribution: Saudi Ministry of Justice / Saudi Open Data License.
// These records are NOT reliable property-subtype comparables.
const OPEN_QUARTERS = Object.freeze(['2025-Q3','2025-Q4','2026-Q1']);
const DATA_ROOT = 'https://raw.githubusercontent.com/civillizard/Saudi-Real-Estate-Data/main/moj/sales/';
const SOURCE_REPOSITORY = 'https://github.com/civillizard/Saudi-Real-Estate-Data';
const MAX_DOWNLOAD_BYTES=12_000_000;
const MAX_ROWS=160000;
const qs = s => String(s??'').trim().replace(/[٠-٩]/g,c=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(c)))
  .replace(/[۰-۹]/g,c=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(c)))
  .replace(/[أإآٱ]/g,'ا').replace(/ة/g,'ه').replace(/ى/g,'ي')
  .replace(/\s+/g,' ').toLowerCase();
const clean = s => qs(s).replace(/[\s_\-:/]/g,'');
function splitCsv(line){
  const result=[];let cell='',quote=false;
  for(let i=0;i<line.length;i++){
    const ch=line[i];
    if(ch==='"'){if(quote&&line[i+1]==='"'){cell+='"';i++;}else quote=!quote;}
    else if(ch===','&&!quote){result.push(cell);cell='';}
    else cell+=ch;
  }
  if(quote)throw Error('CSV_UNCLOSED_QUOTE');
  result.push(cell);
  return result.map(v=>v.trim());
}
const ALIASES=Object.freeze({
  city:['المدينة','مدينة','city'],district:['الحي','اسم الحي','neighborhood','district','المدينة / الحي','المدينة/الحي'],
  price:['السعر','قيمة الصفقة','price','saleprice'],area:['المساحة','area','area_m2','المساحة m2'],
  date:['تاريخ الصفقة ميلادي','تاريخ الصفقة الميلادي','تاريخ الصفقة','date','gregoriandate'],
  reference:['الرقم المرجعي للصفقة','الرقم المرجعي','transaction reference','referencenumber'],
  classification:['تصنيف العقار','propertyclassification','classification'],
  propertyType:['نوع العقار','propertytype'],
});
function asNumber(v){
  const s=String(v??'').trim().replace(/[٠-٩]/g,c=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(c)))
    .replace(/[۰-۹]/g,c=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(c)))
    .replace(/[,٬\s]/g,'').replace(/٫/g,'.');
  return /^\d+(\.\d+)?$/.test(s)?Number(s):NaN;
}
function isoDate(s){
  const raw=String(s??'').trim().replace(/[٠-٩]/g,c=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(c)))
   .replace(/[۰-۹]/g,c=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(c)));
  const m=raw.match(/^(\d{4})[\/.-](\d{1,2})[\/.-](\d{1,2})/);
  if(!m)return null;
  const out=m[1]+'-'+m[2].padStart(2,'0')+'-'+m[3].padStart(2,'0');
  const d=new Date(out+'T00:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===out?out:null;
}
function parseQuarter(text,{quarter,asOf=new Date()}={}){
  if(typeof text!=='string'||text.length>MAX_DOWNLOAD_BYTES)throw Error('DATASET_SIZE_LIMIT');
  const lines=text.replace(/^\uFEFF/,'').split(/\r?\n/).filter(s=>s.trim());
  if(lines.length<2||lines.length>MAX_ROWS+1)throw Error('DATASET_ROW_LIMIT');
  const header=splitCsv(lines[0]);
  const column={};
  for(const [canonical,aliases] of Object.entries(ALIASES)){
    const names=new Set(aliases.map(clean)); column[canonical]=header.findIndex(h=>names.has(clean(h)));
  }
  for(const required of ['city','district','price','area','date'])if(column[required]<0)throw Error('DATASET_SCHEMA_MISSING_'+required);
  const asOfDate=asOf instanceof Date?asOf:new Date(asOf);
  const today=asOfDate.toISOString().slice(0,10);
  const records=[];let bad=0;
  for(let i=1;i<lines.length;i++){
    const cells=splitCsv(lines[i]);
    const get=k=>column[k]>=0?(cells[column[k]]??''):'';
    const price=asNumber(get('price')),area=asNumber(get('area')),date=isoDate(get('date'));
    if(!(price>0&&area>0&&date&&date<=today&&price/area>0&&price/area<2_000_000)){bad++;continue;}
    const rawDistrict=get('district');
    const parts=rawDistrict.split('/').map(x=>x.trim()).filter(Boolean);
    const district=parts.length>1?parts[parts.length-1]:rawDistrict;
    const city=get('city')|| (parts.length>1?parts[0]:'');
    const reference=get('reference');
    records.push({
      city,district,date,price,area,priceSqm:price/area,
      classification:get('classification'),propertyType:get('propertyType'),
      reference,quarter,sourceUrl:SOURCE_REPOSITORY+'/blob/main/moj/sales/MOJ-Sales-'+quarter+'.csv',
      subtypeVerified:Boolean(get('propertyType')),
      evidenceLevel:'PUBLIC_GOV_OPEN_DATA_MIRROR_UNVERIFIED',
    });
  }
  return {records,quarter,totalLines:lines.length-1,excludedInvalid:bad};
}
function median(values){
  if(!values.length)return null;
  const a=[...values].sort((x,y)=>x-y),n=a.length;
  return n%2?a[(n-1)/2]:(a[n/2-1]+a[n/2])/2;
}
function deriveDistrictSnapshot(records,{city,district,classification='',asOf=new Date(),maxAgeDays=365}){
  const now=asOf instanceof Date?asOf:new Date(asOf);
  const cityKey=clean(city),districtKey=clean(district),clsKey=clean(classification);
  if(!cityKey||!districtKey)return {status:'LOCATION_REQUIRED',count:0,medianPriceSqm:null};
  const earliest=now.getTime()-maxAgeDays*86400000;
  const matches=records.filter(r=>clean(r.city)===cityKey&&clean(r.district)===districtKey&&
    (!clsKey||clean(r.classification)===clsKey)&&
    Date.parse(r.date+'T00:00:00Z')>=earliest&&Date.parse(r.date+'T00:00:00Z')<=now.getTime());
  const distinct=new Map();
  for(const r of matches){
    const key=r.reference?String(r.reference):[r.date,r.price,r.area,r.district,r.city,r.quarter].join('|');
    if(!distinct.has(key))distinct.set(key,r);
  }
  const unique=[...distinct.values()];
  const prices=unique.map(r=>r.priceSqm);
  return {status:unique.length>=3?'HISTORIC_NEIGHBORHOOD_CONTEXT':'INSUFFICIENT_TRANSACTIONS',
    city,district,classification:classification||'جميع التصنيفات',
    count:unique.length,medianPriceSqm:unique.length>=3?median(prices):null,
    minDate:unique.length?unique.reduce((a,r)=>a<r.date?a:r.date,unique[0].date):null,
    maxDate:unique.length?unique.reduce((a,r)=>a>r.date?a:r.date,unique[0].date):null,
    referenceExamples:unique.slice(0,8).map(r=>({date:r.date,price:r.price,area:r.area,priceSqm:r.priceSqm,reference:r.reference,classification:r.classification,propertyType:r.propertyType,sourceUrl:r.sourceUrl})),
    subtypeSuitableForSubject:false,geolocationVerified:false,
    requiresAssetClassCaution:true,rights:'SAUDI_OPEN_DATA_LICENSE_ATTRIBUTION',
    sourceKind:'MOJ_REGISTERED_SALES_FROM_PUBLIC_OPEN_DATA_QUARTERS',
    marketValueCertified:false,
  };
}
async function readOpenQuarters({fetchImpl=fetch,quarters=OPEN_QUARTERS,onProgress=()=>{},asOf=new Date()}={}){
  const all=[],sources=[],errors=[];
  for(const quarter of quarters){
    if(!/^\d{4}-Q[1-4]$/.test(quarter))throw Error('QUARTER_INVALID');
    const url=DATA_ROOT+'MOJ-Sales-'+quarter+'.csv';
    onProgress({state:'FETCHING',quarter});
    try{
      const response=await fetchImpl(url,{method:'GET',mode:'cors',cache:'no-store',credentials:'omit'});
      if(!response.ok)throw Error('HTTP_'+response.status);
      const size=Number(response.headers?.get?.('content-length')||0);
      if(size>MAX_DOWNLOAD_BYTES)throw Error('DATASET_SIZE_LIMIT');
      const body=await response.text();
      const parsed=parseQuarter(body,{quarter,asOf});
      all.push(...parsed.records);
      sources.push({quarter,url,parsedRecords:parsed.records.length,excludedInvalid:parsed.excludedInvalid});
      onProgress({state:'IMPORTED',quarter,count:parsed.records.length});
    }catch(e){
      errors.push({quarter,code:String(e.message||'NETWORK_FETCH_FAILED').slice(0,100)});
      onProgress({state:'UNAVAILABLE',quarter});
    }
  }
  return {records:all,sources,errors,fetchedAt:new Date().toISOString(),
    incomplete:errors.length>0,source:'MOJ through Saudi Open Data, public GitHub mirror',
    permission:'Saudi Open Data License; attribution mandatory',
    noLicensedRealTimeFeed:true,notParcelComps:true};
}
module.exports={OPEN_QUARTERS,DATA_ROOT,SOURCE_REPOSITORY,MAX_DOWNLOAD_BYTES,
  splitCsv,isoDate,asNumber,parseQuarter,deriveDistrictSnapshot,readOpenQuarters};
