// STARTAK personal-use research gateway — authenticated owner and Kite data-key.
// Every request is a bounded READ of the documented Kite MOJ quarterly dataset.
// No crawling, account bypass, storage of upstream tokens, decision approval,
// or live property valuation is performed by this endpoint.
const KITE_ENDPOINT='https://api.kite.sa/v1/transactions';
const LAND_USE=new Set(['residential','commercial','agricultural','industrial','mixed_use','other']);
const RESEARCH_VERSION='STARTAK_KITE_MOJ_MONTHLY_RESEARCH_V1';
function json(value,status=200){
 return new Response(JSON.stringify(value),{status,headers:{
  'content-type':'application/json; charset=utf-8',
  'cache-control':'no-store, private',
  'x-content-type-options':'nosniff',
  'referrer-policy':'no-referrer',
  'vary':'Authorization'
 }});
}
function denied(code,status){return json({ok:false,code,liveConnected:false},status)}
const safeString=(v,max=140)=>typeof v==='string'&&v.length<=max?v:null;
const positive=v=>Number.isFinite(v)&&v>0?v:null;
const int=v=>Number.isSafeInteger(v)&&v>=1?v:null;
function parseRequest(url){
 const u=new URL(url);
 const known=new Set(['city','land_use','month_from','month_to','price_per_sqm_min','cursor']);
 if([...u.searchParams.keys()].some(k=>!known.has(k)))return {error:'QUERY_PARAMETER_NOT_ALLOWED'};
 const city=(u.searchParams.get('city')||'').trim().toLowerCase();
 if(!/^[a-z_]{2,40}$/.test(city))return {error:'CITY_SLUG_INVALID'};
 const use=u.searchParams.get('land_use')||'';
 if(use&&!LAND_USE.has(use))return {error:'LAND_USE_INVALID'};
 const mf=u.searchParams.get('month_from')||'',mt=u.searchParams.get('month_to')||'';
 const monthValid=v=>/^20\d\d-(0[1-9]|1[0-2])$/.test(v);
 if((mf&&!monthValid(mf))||(mt&&!monthValid(mt))||(mf&&mt&&mf>mt))
  return {error:'MONTH_RANGE_INVALID'};
 const rawPrice=u.searchParams.get('price_per_sqm_min')||'';
 if(rawPrice&&!/^\d{1,8}(?:\.\d{1,2})?$/.test(rawPrice))
  return {error:'PRICE_PER_SQM_FILTER_INVALID'};
 const cursor=u.searchParams.get('cursor')||'';
 if(cursor&&(cursor.length>500||!/^[\w+\-\/=:.]+$/.test(cursor)))
  return {error:'CURSOR_INVALID'};
 const upstream=new URL(KITE_ENDPOINT);
 upstream.searchParams.set('city',city);
 upstream.searchParams.set('limit','25');
 if(use)upstream.searchParams.set('land_use',use);
 if(mf)upstream.searchParams.set('month_from',mf);
 if(mt)upstream.searchParams.set('month_to',mt);
 if(rawPrice)upstream.searchParams.set('price_per_sqm_min',rawPrice);
 if(cursor)upstream.searchParams.set('cursor',cursor);
 return {city,upstream:upstream.toString()};
}
async function isAuthorized(request,expected){
 if(typeof expected!=='string'||expected.length<32)return false;
 const auth=request.headers.get('authorization')||'';
 const parts=/^Bearer ([\w.\-~+/=]{32,256})$/.exec(auth);
 if(!parts)return false;
 const data=new TextEncoder();
 const [a,b]=await Promise.all([
  crypto.subtle.digest('SHA-256',data.encode(parts[1])),
  crypto.subtle.digest('SHA-256',data.encode(expected))
 ]);
 const left=new Uint8Array(a),right=new Uint8Array(b);let different=0;
 for(let i=0;i<left.length;i++)different|=left[i]^right[i];
 return different===0;
}
function normalizeRow(x){
 if(!x||typeof x!=='object'||Array.isArray(x))return null;
 const month=safeString(x.month,7);
 if(!/^20\d{2}-(0[1-9]|1[0-2])$/.test(month||''))return null;
 const price=positive(x.price_sar);if(price===null)return null;
 // Provider contract requires a stable opaque id and an explicit land-use class.
 // Never turn an unknown/malformed class into 'other': that would mislabel sales.
 const id=safeString(x.id,128);
 if(!id||!LAND_USE.has(x.land_use))return null;
 const area=positive(x.area_sqm);
 return {
  id,month,
  sourceQuarter:safeString(x.source_quarter,18),
  city:safeString(x.city,80),cityNameAr:safeString(x.city_name_ar,100),
  districtNameAr:safeString(x.district_name_ar,140),
  landUse:x.land_use,
  priceSar:price,areaSqm:area,pricePerSqmSar:positive(x.price_per_sqm_sar),
  propertyCount:int(x.property_count),
  coverageFlag:safeString(x.coverage_flag,60),
  classification:'MOJ_NOTARY_QUARTERLY_OPEN_DATA_VIA_KITE',
  dayKnown:false,independentlyTitleVerified:false,
  estimatedBuildingValue:false,professionalAppraisal:false
 };
}
async function fetchUpstream(url,key,fetchImpl){
 const control=new AbortController(),timer=setTimeout(()=>control.abort(),8000);
 try{
  const response=await fetchImpl(url,{method:'GET',redirect:'error',
   headers:{accept:'application/json','authorization':'Bearer '+key},
   signal:control.signal});
  if(!response.ok)return {error:response.status===401||response.status===403
   ?'KITE_DATA_KEY_REJECTED':response.status===429?'KITE_PROVIDER_RATE_LIMIT':'KITE_PROVIDER_UNAVAILABLE'};
  const length=Number(response.headers.get('content-length'));
  if(Number.isFinite(length)&&length>250000)return {error:'KITE_RESPONSE_TOO_LARGE'};
  if(response.body?.getReader){
   let n=0;const chunks=[],reader=response.body.getReader();
   try{
    while(true){const {done,value}=await reader.read();if(done)break;
     n+=value.byteLength;if(n>250000)throw Error('BOUNDED_LIMIT');chunks.push(value);}
   }finally{reader.releaseLock();}
   const bytes=new Uint8Array(n);let off=0;
   for(const chunk of chunks){bytes.set(chunk,off);off+=chunk.byteLength;}
   return {data:JSON.parse(new TextDecoder().decode(bytes))};
  }
  // Browser-like test doubles. Node's real fetch always has a stream.
  const body=await response.text();
  if(new TextEncoder().encode(body).length>250000)return {error:'KITE_RESPONSE_TOO_LARGE'};
  return {data:JSON.parse(body)};
 }catch(e){
  return {error:e?.name==='AbortError'?'KITE_TIMEOUT':
   e?.message==='BOUNDED_LIMIT'?'KITE_RESPONSE_TOO_LARGE':'KITE_FETCH_OR_JSON_FAILED'};
 }finally{clearTimeout(timer);}
}
export async function onRequestGet(context){
 const req=context?.request,env=context?.env||{};
 if(!req)return denied('REQUEST_REQUIRED',400);
 if(req.headers.get('sec-fetch-site')==='cross-site')return denied('CROSS_SITE_DENIED',403);
 const parsed=parseRequest(req.url);
 if(parsed.error)return denied(parsed.error,400);
 const owner=env.STARTAK_PERSONAL_SOURCE_TOKEN,provider=env.KITE_DATA_API_KEY;
 if(typeof owner!=='string'||owner.length<32||typeof provider!=='string'
    ||!/^dk_(live|test)_[a-zA-Z0-9_-]{6,}$/.test(provider))
  return denied('PERSONAL_SOURCE_CONNECTOR_NOT_CONFIGURED',503);
 if(!await isAuthorized(req,owner))return denied('PERSONAL_SOURCE_ACCESS_DENIED',401);
 const output=await fetchUpstream(parsed.upstream,provider,context?.data?.fetchImpl||fetch);
 if(output.error)return denied(output.error,502);
 const source=output.data;
 if(!source||!Array.isArray(source.data)||!source.attribution||
    typeof source.attribution!=='object'||Array.isArray(source.attribution))
  return denied('KITE_SCHEMA_OR_ATTRIBUTION_INVALID',502);
 const originalAttribution=JSON.stringify(source.attribution);
 if(originalAttribution.length>10000)return denied('KITE_ATTRIBUTION_TOO_LARGE',502);
 const records=source.data.slice(0,25).map(normalizeRow).filter(Boolean);
 const pagination=source.pagination||{};
 const next=safeString(pagination.next_cursor||pagination.nextCursor,500);
 return json({
  ok:true,liveConnected:true,provider:'KITE',
  dataset:'MOJ_QUARTERLY_OPEN_NOTARY_SALES',version:RESEARCH_VERSION,
  retrievedAt:new Date().toISOString(),city:parsed.city,records,
  rejectedRecords:Math.min(25,source.data.length)-records.length,
  nextCursor:next&&/^[\w+\-\/=:.]+$/.test(next)?next:null,
  attribution:source.attribution,
  caveats:['NOTARY_ONLY_PARTIAL_RIYADH_COVERAGE_AFTER_2024',
   'RIYADH_CITY_POST_2026_05_18_NOT_COVERED',
   'LAND_USE_NOT_BUILDING_TYPE','MONTH_ONLY_NOT_EXACT_TRANSACTION_DAY',
   'PROPERTY_COUNT_MULTIPLE_REQUIRES_REVIEW',
   'SOURCE_NOT_INDEPENDENTLY_VERIFIED_FOR_TARGET_PROPERTY'],
  professionalValuationAuthorized:false,independentEvidenceVerified:false
 });
}
export async function onRequest(context){
 return context?.request?.method==='GET'?onRequestGet(context):denied('METHOD_NOT_ALLOWED',405);
}
