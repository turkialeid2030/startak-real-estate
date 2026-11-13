'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {normalizeKiteResearch,dateMonth}=require('../../src/market/kite-personal-market-research');
const {mergeNationalResearch}=require('../../src/market/saudi-national-intelligence-sources');
const handlerSource=fs.readFileSync(path.join(__dirname,'../../functions/api/personal-data/kite-transactions.js'),'utf8');
const TOKEN='startak-owner-test-'+('A'.repeat(48));
const API_KEY='dk_test_'+('b'.repeat(35));
let checks=0;
function eq(a,b,label){assert.deepStrictEqual(a,b,label);checks++;}
function yes(a,label){assert.ok(a,label);checks++;}
function request(query='',token=TOKEN,method='GET',extraHeaders={}){
 return new Request('https://example.com/api/personal-data/kite-transactions?city=riyadh'+query,{
  method,headers:token?{authorization:'Bearer '+token,...extraHeaders}:extraHeaders,
 });
}
async function run(){
 const m=await import('data:text/javascript;base64,'+Buffer.from(handlerSource).toString('base64'));
 const source={
  data:[{id:'opaque-quarterly-1',month:'2026-04',source_quarter:'2026-Q2',
    city:'riyadh',city_name_ar:'الرياض',district_name_ar:'حي الملقا',
    land_use:'residential',price_sar:1550000,area_sqm:500,
    price_per_sqm_sar:3100,property_count:1,coverage_flag:'notary_only'},
    {id:'opaque-quarterly-2',month:'2026-04',source_quarter:'2026-Q2',
    city:'riyadh',city_name_ar:'الرياض',district_name_ar:null,
    land_use:'commercial',price_sar:5000000,area_sqm:1000,
    price_per_sqm_sar:5000,property_count:2}],
  pagination:{next_cursor:'example_cursor_123'},
  attribution:{source:'Ministry of Justice quarterly open data',license:'ODC Attribution'},
 };
 let called=0,observedUrl=null,observedAuth=null;
 const fetchImpl=async(url,init)=>{called++;observedUrl=url;observedAuth=init.headers.authorization;
  eq(init.redirect,'error','no follow redirects');return new Response(JSON.stringify(source),{
   status:200,headers:{'content-type':'application/json'}});};
 const context=(req,env={STARTAK_PERSONAL_SOURCE_TOKEN:TOKEN,KITE_DATA_API_KEY:API_KEY})=>
  ({request:req,env,data:{fetchImpl}});
 let r=await m.onRequestGet(context(request('',TOKEN),{}));
 eq(r.status,503,'missing server keys fail closed');
 eq((await r.json()).code,'PERSONAL_SOURCE_CONNECTOR_NOT_CONFIGURED','missing keys explained');
 eq(called,0,'no remote fetch before connector configured');
 r=await m.onRequestGet(context(request('','a'.repeat(45))));
 eq(r.status,401,'unauthorized owner denied');eq(called,0,'invalid owner never triggers provider');
 r=await m.onRequestGet(context(request('&override=https://evil.test')));
 eq(r.status,400,'unspecified query params denied');
 r=await m.onRequestGet(context(request('&land_use=forged')));
 eq((await r.json()).code,'LAND_USE_INVALID','land class whitelist');
 r=await m.onRequestGet(context(request('&city=jeddah')));
 eq(r.status,400,'duplicate city is ambiguous and denied');
 eq((await r.json()).code,'QUERY_PARAMETER_DUPLICATED','duplicate query reason');
 r=await m.onRequestGet(context(request('&month_from=2026-01&month_from=2026-02')));
 eq((await r.json()).code,'QUERY_PARAMETER_DUPLICATED','duplicate month cannot bypass scope');
 r=await m.onRequestGet(context(request('&month_from=2026-12&month_to=2025-10')));
 eq(r.status,400,'reversed month period denied');
 r=await m.onRequest(context(request('','', 'POST')));
 eq(r.status,405,'read only endpoint');
 r=await m.onRequestGet(context(request('',TOKEN,'GET',{'sec-fetch-site':'cross-site'})));
 eq(r.status,403,'cross-site call denied');
 eq(called,0,'all denied requests prevent outbound call');
 r=await m.onRequestGet(context(request('&month_from=2026-01&price_per_sqm_min=100')));
 eq(r.status,200,'authorized request with valid filters');
 const body=await r.json();
 eq(body.ok,true,'gateway confirmed provider response');eq(body.liveConnected,true,'connected only on live provider response');
 eq(body.dataset,'MOJ_QUARTERLY_OPEN_NOTARY_SALES','correct dataset classification');
 eq(body.records.length,2,'bounded normalizable rows retained');
 eq(body.records[0].month,'2026-04','month precision preserved');
 eq(body.records[0].dayKnown,false,'no fabricated day');
 eq(body.records[1].propertyCount,2,'multi-property count preserved');
 eq(body.records[0].professionalAppraisal,false,'not accredited valuation');
 eq(body.independentEvidenceVerified,false,'no invented independent verification');
 eq(body.nextCursor,'example_cursor_123','provider page cursor retained');
 eq(body.attribution.license,'ODC Attribution','original attribution retained');
 yes(observedUrl.startsWith('https://api.kite.sa/v1/transactions?'),'fixed host only');
 yes(observedUrl.includes('price_per_sqm_min=100'),'valid filter forwarded');
 eq(observedAuth,'Bearer '+API_KEY,'upstream gets data key, not owner key');
 yes(!JSON.stringify(body).includes(API_KEY),'provider API secret not in response');
 yes(!JSON.stringify(body).includes(TOKEN),'owner secret not in response');
 eq(dateMonth('2026-02').end,'2026-02-28','month end correct');
 eq(dateMonth('2024-02').end,'2024-02-29','leap year correct');
 const normalized=normalizeKiteResearch(body);
 eq(normalized.rows.length,2,'research adapter records');
 eq(normalized.rows[0].evidenceClass,'THIRD_PARTY_REPORTED_SALE',
   'intermediated open MOJ data distinct from direct authenticated sales');
 eq(normalized.rows[0].eventDate,null,'no daily sale date invented');
 eq(normalized.rows[0].marketValuationEligible,false,'not a comparable automatically');
 eq(normalized.rows[0].executedTransactionRecord,false,'not independently confirmed transaction');
 eq(normalized.rows[1].districtKnown,false,'unknown district disclosed');
 const merged=mergeNationalResearch([],normalized.rows);
 eq(merged.added,2,'records flow into personal research quarantine');
 eq(merged.verifiedSales,0,'nothing certified');
 const dup=mergeNationalResearch(merged.records,normalized.rows);
 eq(dup.duplicates,2,'deduplicate repeated source results');
 const invalid=structuredClone(body);invalid.records[0].month='2099-06';
 eq(normalizeKiteResearch(invalid).skipped.length,1,'future monthly records rejected');
 // Never silently translate unknown land-use classes into 'other', or accept
 // missing upstream IDs, even when their other price fields look plausible.
 const poisoned=structuredClone(source);
 poisoned.data=[{...source.data[0],land_use:'apartment'},
                {...source.data[0],id:''}];
 r=await m.onRequestGet({request:request(),env:{STARTAK_PERSONAL_SOURCE_TOKEN:TOKEN,KITE_DATA_API_KEY:API_KEY},
  data:{fetchImpl:async()=>new Response(JSON.stringify(poisoned),{status:200})}});
 eq(r.status,200,'malformed source rows do not fail the whole research page');
 const quarantine=await r.json();
 eq(quarantine.records.length,0,'unknown land-use and missing id cannot be imported');
 eq(quarantine.rejectedRecords,2,'rejected provenance records counted');
 // The provider may return rows violating requested city, period, land use,
 // minimum price and present date. Such observations must never be imported.
 const outOfScope=structuredClone(source);
 outOfScope.data=[
   {...source.data[0],city:'jeddah'},
   {...source.data[0],land_use:'commercial'},
   {...source.data[0],month:'2026-07'},
   {...source.data[0],price_per_sqm_sar:50},
   {...source.data[0],month:'2099-06'},
   source.data[0],
 ];
 r=await m.onRequestGet({request:request('&land_use=residential&month_from=2026-01&month_to=2026-06&price_per_sqm_min=100'),
  env:{STARTAK_PERSONAL_SOURCE_TOKEN:TOKEN,KITE_DATA_API_KEY:API_KEY},
  data:{fetchImpl:async()=>new Response(JSON.stringify(outOfScope),{status:200})}});
 eq(r.status,200,'bounded mixed-scope provider page remains processable');
 const scoped=await r.json();
 eq(scoped.records.length,1,'only exact requested city, period, class and price retained');
 eq(scoped.records[0].id,'opaque-quarterly-1','legitimate scoped observation preserved');
 eq(scoped.rejectedRecords,5,'all out-of-scope and future observations counted');
 const noAttribution=structuredClone(source);delete noAttribution.attribution;
 r=await m.onRequestGet({request:request(),env:{STARTAK_PERSONAL_SOURCE_TOKEN:TOKEN,KITE_DATA_API_KEY:API_KEY},
  data:{fetchImpl:async()=>new Response(JSON.stringify(noAttribution),{status:200})}});
 eq(r.status,502,'source attribution mandatory');
 r=await m.onRequestGet({request:request(),env:{STARTAK_PERSONAL_SOURCE_TOKEN:TOKEN,KITE_DATA_API_KEY:API_KEY},
  data:{fetchImpl:async()=>new Response('rate limit',{status:429})}});
 eq((await r.json()).code,'KITE_PROVIDER_RATE_LIMIT','provider throttle transparent');
 console.log('PERSONAL_KITE_SOURCE_GATE=PASS assertions='+checks+
 ' external_live_api_key_configured=false real_transactions_downloaded=false');
}
run().catch(e=>{console.error('PERSONAL_KITE_SOURCE_GATE=FAIL',e);process.exitCode=1});
