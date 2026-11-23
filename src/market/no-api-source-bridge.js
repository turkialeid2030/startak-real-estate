'use strict';
// Owner-operated no-API bridge: links/research bookkeeping only.
// Nothing here fetches other websites, crawls, copies pages, accesses login
// cookies, confirms data licenses, or authorizes professional valuations.
const VERSION='STARTAK_NO_API_MANUAL_LINKS_V1';
const MAX_REFERENCES=100;
const MAX_PORTABLE_BYTES=64*1024;
const sources=[
 ['REGA','الهيئة العامة للعقار — المؤشرات','REGA market indicators','https://rei.rega.gov.sa/ar',['rei.rega.gov.sa'],'REFERENCE_ONLY'],
 ['REGA_DEALS','الهيئة العامة للعقار — صفقات البيع','REGA executed-sale research','https://rei.rega.gov.sa/ar/advanced-search/deals',['rei.rega.gov.sa'],'REFERENCE_ONLY'],
 ['REGA_RENTS','الهيئة العامة للعقار — السوق الإيجاري','REGA rental indicators','https://rei.rega.gov.sa/ar/advanced-search/rental-market',['rei.rega.gov.sa'],'REFERENCE_ONLY'],
 ['MOJ_OPEN','وزارة العدل — البيانات المفتوحة','Ministry of Justice open datasets','https://www.moj.gov.sa/ar/OpenData/Pages/OpenDataPolicy.aspx',['moj.gov.sa','www.moj.gov.sa'],'LICENSE_REVIEW_FOR_FILE'],
 ['MOJ_SREM','وزارة العدل — البورصة العقارية','Ministry of Justice real estate exchange','https://srem.moj.gov.sa/',['srem.moj.gov.sa'],'REFERENCE_ONLY'],
 ['EJAR','شبكة إيجار','Ejar network','https://www.ejar.sa/',['ejar.sa','www.ejar.sa'],'AUTHENTICATED_REFERENCE'],
 ['RER','السجل العقاري','Real Estate Registry','https://rer.sa/',['rer.sa','www.rer.sa'],'AUTHENTICATED_REFERENCE'],
 ['UMAPS','الخرائط الحضرية الرسمية','Urban Maps official portal','https://umaps.momah.gov.sa/',['umaps.momah.gov.sa'],'AUTHENTICATED_REFERENCE'],
 ['BALADY','بلدي — الخدمات البلدية','Balady municipal services','https://balady.gov.sa/',['balady.gov.sa','www.balady.gov.sa'],'REFERENCE_ONLY'],
 ['GEOSA','المنصة الجيومكانية الوطنية','National geospatial platform','https://geoportal.geosa.gov.sa/geoportal/',['geoportal.geosa.gov.sa'],'LICENSE_REVIEW_FOR_FILE'],
 ['GASTAT','الهيئة العامة للإحصاء','Saudi national statistics','https://www.stats.gov.sa/',['stats.gov.sa','www.stats.gov.sa'],'LICENSE_REVIEW_FOR_FILE'],
 ['SUHAIL','سهيل — البحث العقاري','Suhail property research','https://www.suhail.ai/',['suhail.ai','www.suhail.ai'],'REFERENCE_ONLY'],
 ['EARTH','أرض — الخرائط العقارية','Earth real estate maps','https://map.earthapp.com.sa/',['map.earthapp.com.sa','www.earthapp.com.sa','earthapp.com.sa'],'REFERENCE_ONLY'],
 ['PASEETAH','بسيطة — المؤشرات العقارية','Paseetah market analytics','https://paseetah.com/ar',['paseetah.com','www.paseetah.com'],'REFERENCE_ONLY'],
 ['GREM','جريم — التقييم الآلي','GREM property model','https://ai.grem.capital/ar',['ai.grem.capital'],'REFERENCE_ONLY'],
 ['BAYUT','بيوت — تقدير القيمة','Bayut price estimation','https://www.bayut.sa/property-market-analysis/tru-value/',['bayut.sa','www.bayut.sa'],'REFERENCE_ONLY'],
 ['TATHMIN','تثمين — التقييم الإلكتروني','Tathmin valuation research','https://tathmin.online/valuation',['tathmin.online'],'REFERENCE_ONLY'],
 ['RAKEZ','راكز — المشاريع العقارية','Rakez projects','https://rakez.sa/ar/project/',['rakez.sa','www.rakez.sa'],'REFERENCE_ONLY'],
 ['JADHAN','جذان — العروض العقارية','Jadhan property listings','https://jadhan.com/',['jadhan.com','www.jadhan.com'],'REFERENCE_ONLY'],
 ['TAQEEM','هيئة المقيمين المعتمدين','Saudi Authority for Accredited Valuers','https://taqeem.gov.sa/',['taqeem.gov.sa','www.taqeem.gov.sa'],'PROFESSIONAL_REFERENCE'],
 ['IVSC','معايير التقييم الدولية','International Valuation Standards Council','https://ivsc.org/standards/',['ivsc.org','www.ivsc.org'],'PROFESSIONAL_REFERENCE'],
 ['BUILDING_RANK','فحص المباني الهندسي','Building inspection research','https://sa.buildingranks.com/',['sa.buildingranks.com'],'PROFESSIONAL_REFERENCE'],
 ['KITE','كايت — بيانات ومصادر العقار','Kite data source documentation','https://platform.kite.sa/ar/sources',['platform.kite.sa'],'REFERENCE_ONLY'],
 ['GEOMED','خرائط أمانة المدينة المنورة','Madinah municipal maps','https://geomed.amana-md.gov.sa/',['geomed.amana-md.gov.sa'],'REFERENCE_ONLY'],
 ['ART_OF_VALUE','فن القيمة للتقييم','Art of Value appraisal','https://artofvalue.sa/',['artofvalue.sa','www.artofvalue.sa'],'PROFESSIONAL_REFERENCE'],
 ['LIBRA','ميزان للاستشارات المالية','Libra financial advisory','https://libra-advisor.com/',['libra-advisor.com','www.libra-advisor.com'],'PROFESSIONAL_REFERENCE'],
 ['EDARAH','إدارة للتقييم','Edarah valuation','https://www.edarah.sa/',['edarah.sa','www.edarah.sa'],'PROFESSIONAL_REFERENCE'],
 ['PROE','المقيم المحترف','Professional Appraiser','https://proe.sa/',['proe.sa','www.proe.sa'],'PROFESSIONAL_REFERENCE'],
 ['MADAA','مدى العربية للتقييم','Madaa valuation','https://www.madaa-sa.com/',['madaa-sa.com','www.madaa-sa.com'],'PROFESSIONAL_REFERENCE'],
 ['MEREVC','الشرق الأوسط للتقييم','Middle East real estate valuation','https://merevc.com.sa/',['merevc.com.sa','www.merevc.com.sa'],'PROFESSIONAL_REFERENCE'],
 ['KHOBARA','خبراء الأصول للتقييم','Asset Experts valuation','https://khobara.sa/',['khobara.sa','www.khobara.sa'],'PROFESSIONAL_REFERENCE'],
 ['MEEYAR','معيار للتقييم','Meeyar valuation','https://meeyar.sa/',['meeyar.sa','www.meeyar.sa'],'PROFESSIONAL_REFERENCE'],
 ['FIN','دورة طرق التقييم العقاري','Real estate valuation methodology course','https://fin.com.sa/ar/courses/real-estate-appraisal-methods/info',['fin.com.sa','www.fin.com.sa'],'PROFESSIONAL_REFERENCE'],
 ['EHSIBHA','احسبها — أدوات حسابية','Ehsibha research','https://ehsibha.sa/ive',['ehsibha.sa','www.ehsibha.sa'],'REFERENCE_ONLY'],
 ['THREE_QAR','ثري عقار — استشارات ذكية','Three Qar research','https://3qar.ai/',['3qar.ai','www.3qar.ai'],'REFERENCE_ONLY'],
 // Sites already tracked by the independent user-operated listing CSV registry.
 ['AQAR','عقار — العروض','Aqar listings','https://sa.aqar.fm/',['sa.aqar.fm'],'REFERENCE_ONLY'],
 ['HARAJ','حراج — العروض','Haraj listings','https://haraj.com.sa/',['haraj.com.sa','www.haraj.com.sa'],'REFERENCE_ONLY'],
 ['PROPERTY_FINDER','بروبرتي فايندر','Property Finder listings','https://www.propertyfinder.sa/',['propertyfinder.sa','www.propertyfinder.sa'],'REFERENCE_ONLY'],
 ['WASALT','وصلت — العقارات','Wasalt listings','https://wasalt.sa/AR',['wasalt.sa','www.wasalt.sa'],'REFERENCE_ONLY'],
 ['SAKANI','سكني — المشاريع','Sakani projects','https://sakani.sa/',['sakani.sa','www.sakani.sa'],'REFERENCE_ONLY'],
 ['DEAL','ديل — الطلبات','Deal listings','https://dealapp.sa/',['dealapp.sa','www.dealapp.sa'],'REFERENCE_ONLY'],
 // Ancillary official and geospatial references from the older project plan;
 // not verified transaction datasets and not machine-readable data adapters.
 ['SBC','المركز السعودي لكود البناء','Saudi Building Code','https://www.sbc.gov.sa/ar/Pages/default.aspx',['sbc.gov.sa','www.sbc.gov.sa'],'PROFESSIONAL_REFERENCE'],
 ['SGS','هيئة المساحة الجيولوجية السعودية','Saudi Geological Survey','https://sgs.gov.sa/',['sgs.gov.sa','www.sgs.gov.sa'],'PROFESSIONAL_REFERENCE'],
 ['INFATH','إنفاذ — المزادات','Infath auctions','https://infath.gov.sa/auctions',['infath.gov.sa','www.infath.gov.sa'],'REFERENCE_ONLY'],
 ['ZATCA','هيئة الزكاة والضريبة والجمارك','ZATCA','https://zatca.gov.sa/',['zatca.gov.sa','www.zatca.gov.sa'],'PROFESSIONAL_REFERENCE'],
 ['SAMA','البنك المركزي السعودي','Saudi Central Bank','https://www.sama.gov.sa/ar-sa/Pages/default.aspx',['sama.gov.sa','www.sama.gov.sa'],'REFERENCE_ONLY'],
 ['CMA','هيئة السوق المالية','Capital Market Authority','https://cma.gov.sa/Pages/default.aspx',['cma.gov.sa','www.cma.gov.sa'],'PROFESSIONAL_REFERENCE'],
 ['SAUDI_EXCHANGE','تداول السعودية','Saudi Exchange','https://www.saudiexchange.sa/',['saudiexchange.sa','www.saudiexchange.sa'],'REFERENCE_ONLY'],
 ['VISION2030','رؤية السعودية 2030','Saudi Vision 2030','https://www.vision2030.gov.sa/ar/',['vision2030.gov.sa','www.vision2030.gov.sa'],'REFERENCE_ONLY'],
 ['GOOGLE_MAPS','خرائط جوجل','Google Maps','https://www.google.com/maps',['www.google.com'],'REFERENCE_ONLY'],
 ['OSM','خريطة أوبن ستريت ماب','OpenStreetMap','https://www.openstreetmap.org/',['openstreetmap.org','www.openstreetmap.org'],'REFERENCE_ONLY'],
 ['MAPBOX','خرائط ماب بوكس','Mapbox maps','https://www.mapbox.com/',['mapbox.com','www.mapbox.com'],'REFERENCE_ONLY'],
 ['GOOGLE_EARTH_ENGINE','جوجل إيرث إنجن','Google Earth Engine','https://earthengine.google.com/',['earthengine.google.com'],'REFERENCE_ONLY'],
];
const SOURCES=Object.freeze(sources.map(([id,nameAr,nameEn,url,hosts,mode])=>
 Object.freeze({id,nameAr,nameEn,url,hosts:Object.freeze(hosts),mode,
  productionAdapterEnabled:false,dataLicenseVerified:false})));
const BY_ID=Object.freeze(Object.fromEntries(SOURCES.map(s=>[s.id,s])));
// Specific service links from previously supplied research. They are NOT
// authenticated data feeds or authority to reproduce third-party content.
const SOURCE_ENTRYPOINTS=Object.freeze([
 Object.freeze({"id":"REGA_DAILY","sourceId":"REGA","nameAr":"الصفقات اليومية","nameEn":"Raw daily sales","url":"https://rei.rega.gov.sa/ar/advanced-search/live","kind":"OFFICIAL_RESEARCH","automaticDataExtraction":false,"valuationAuthorized":false}),
 Object.freeze({"id":"REGA_CLEANED","sourceId":"REGA_DEALS","nameAr":"صفقات البيع المنقحة","nameEn":"Cleaned sales research","url":"https://rei.rega.gov.sa/ar/advanced-search/deals","kind":"OFFICIAL_RESEARCH","automaticDataExtraction":false,"valuationAuthorized":false}),
 Object.freeze({"id":"REGA_RENTAL","sourceId":"REGA_RENTS","nameAr":"المؤشرات الإيجارية","nameEn":"Rental indicators","url":"https://rei.rega.gov.sa/ar/advanced-search/rental-market","kind":"AGGREGATE_RESEARCH","automaticDataExtraction":false,"valuationAuthorized":false}),
 Object.freeze({"id":"REGA_ADS","sourceId":"REGA","nameAr":"المعروض المرخص","nameEn":"Licensed advertised supply","url":"https://rei.rega.gov.sa/ar/advanced-search/ads-supply-market","kind":"ASKING_RESEARCH","automaticDataExtraction":false,"valuationAuthorized":false}),
 Object.freeze({"id":"MOJ_REPORTS","sourceId":"MOJ_OPEN","nameAr":"تقارير وزارة العدل","nameEn":"MOJ open reports","url":"https://www.moj.gov.sa/ar/OpenData/Pages/reports.aspx","kind":"LICENSE_REVIEW","automaticDataExtraction":false,"valuationAuthorized":false}),
 Object.freeze({"id":"MOJ_POLICY","sourceId":"MOJ_OPEN","nameAr":"سياسة البيانات المفتوحة","nameEn":"Open data terms","url":"https://www.moj.gov.sa/ar/OpenData/Pages/OpenDataPolicy.aspx","kind":"LICENSE_REVIEW","automaticDataExtraction":false,"valuationAuthorized":false}),
 Object.freeze({"id":"SUHAIL_TRANSACTIONS","sourceId":"SUHAIL","nameAr":"صفقات سهيل — الرياض","nameEn":"Suhail transactions Riyadh","url":"https://www.suhail.ai/Riyadh/transactions","kind":"THIRD_PARTY_RESEARCH","automaticDataExtraction":false,"valuationAuthorized":false}),
 Object.freeze({"id":"SUHAIL_METRICS","sourceId":"SUHAIL","nameAr":"مؤشرات سهيل — الرياض","nameEn":"Suhail metrics Riyadh","url":"https://www.suhail.ai/Riyadh/metrics","kind":"THIRD_PARTY_RESEARCH","automaticDataExtraction":false,"valuationAuthorized":false}),
 Object.freeze({"id":"EARTH_TRANSACTIONS","sourceId":"EARTH","nameAr":"صفقات أرض","nameEn":"Earth transactions","url":"https://earthapp.com.sa/transaction","kind":"THIRD_PARTY_RESEARCH","automaticDataExtraction":false,"valuationAuthorized":false}),
 Object.freeze({"id":"EARTH_MAP_DEALS","sourceId":"EARTH","nameAr":"صفقات أرض على الخريطة","nameEn":"Earth map deals","url":"https://map.earthapp.com.sa/deals","kind":"THIRD_PARTY_RESEARCH","automaticDataExtraction":false,"valuationAuthorized":false}),
 Object.freeze({"id":"EARTH_VALUE","sourceId":"EARTH","nameAr":"قيم أرضك","nameEn":"Earth land estimate","url":"https://map.earthapp.com.sa/value","kind":"EXTERNAL_ESTIMATE_RESEARCH","automaticDataExtraction":false,"valuationAuthorized":false}),
 Object.freeze({"id":"EARTH_OFFERS","sourceId":"EARTH","nameAr":"العروض في أرض","nameEn":"Earth offers","url":"https://map.earthapp.com.sa/offers","kind":"ASKING_RESEARCH","automaticDataExtraction":false,"valuationAuthorized":false}),
 Object.freeze({"id":"EARTH_CHARTS","sourceId":"EARTH","nameAr":"مؤشرات أرض","nameEn":"Earth market charts","url":"https://map.earthapp.com.sa/charts","kind":"AGGREGATE_RESEARCH","automaticDataExtraction":false,"valuationAuthorized":false}),
 Object.freeze({"id":"UMAPS_PORTAL","sourceId":"UMAPS","nameAr":"الخرائط الحضرية الرسمية","nameEn":"Official urban maps","url":"https://umaps.momah.gov.sa/","kind":"MUNICIPAL_RESEARCH","automaticDataExtraction":false,"valuationAuthorized":false}),
 Object.freeze({"id":"TAQEEM_FACILITIES","sourceId":"TAQEEM","nameAr":"دليل منشآت تقييم","nameEn":"Taqeem facilities","url":"https://taqeem.gov.sa/facilities","kind":"PROFESSIONAL_RESEARCH","automaticDataExtraction":false,"valuationAuthorized":false}),
 Object.freeze({"id":"AQAR_OFFERS","sourceId":"AQAR","nameAr":"إعلانات عقار","nameEn":"Aqar listings","url":"https://sa.aqar.fm/","kind":"ASKING_RESEARCH","automaticDataExtraction":false,"valuationAuthorized":false}),
 Object.freeze({"id":"BAYUT_VALUATION","sourceId":"BAYUT","nameAr":"التقييم الاسترشادي — بيوت","nameEn":"Bayut TrueValue","url":"https://www.bayut.sa/property-market-analysis/tru-value/","kind":"EXTERNAL_ESTIMATE_RESEARCH","automaticDataExtraction":false,"valuationAuthorized":false}),
 Object.freeze({"id":"INFATH_AUCTIONS","sourceId":"INFATH","nameAr":"مزادات إنفاذ","nameEn":"Infath auctions","url":"https://infath.gov.sa/auctions","kind":"AUCTION_RESEARCH_NOT_EXECUTED","automaticDataExtraction":false,"valuationAuthorized":false}),
 Object.freeze({"id":"SBC_CODE","sourceId":"SBC","nameAr":"الكود السعودي للبناء","nameEn":"Saudi Building Code portal","url":"https://www.sbc.gov.sa/ar/Pages/default.aspx","kind":"BUILDING_CODE_REFERENCE","automaticDataExtraction":false,"valuationAuthorized":false})
]);
const BY_ENTRYPOINT_ID=Object.freeze(Object.fromEntries(SOURCE_ENTRYPOINTS.map(e=>[e.id,e])));
for(const ep of SOURCE_ENTRYPOINTS){
 const owner=BY_ID[ep.sourceId],u=new URL(ep.url);
 if(!owner||u.protocol!=='https:'||u.username||u.password||u.port||
    !owner.hosts.includes(u.hostname.toLowerCase()))
  throw Error('NOAPI_ENTRYPOINT_UNSAFE:'+ep.id);
}
function cleanText(x,max=100){
 if(typeof x!=='string')throw Error('NOAPI_TEXT_TYPE_INVALID');
 const t=x.trim();
 if(t.length>max||/[\u0000-\u001f\u007f<>]/u.test(t))throw Error('NOAPI_TEXT_INVALID');
 return t;
}
function safeDate(s,today){
 const v=cleanText(s,10);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(v)||!Number.isFinite(Date.parse(v+'T00:00:00Z'))||
  new Date(v+'T00:00:00Z').toISOString().slice(0,10)!==v||v>today)throw Error('NOAPI_DATE_INVALID');
 return v;
}
function safeUrl(url,source){
 if(typeof url!=='string'||url.length>1600)throw Error('NOAPI_URL_INVALID');
 let parsed;
 try{parsed=new URL(url.trim());}catch{throw Error('NOAPI_URL_INVALID');}
 if(parsed.protocol!=='https:'||parsed.username||parsed.password||parsed.port||
  !source.hosts.includes(parsed.hostname.toLowerCase()))
  throw Error('NOAPI_URL_NOT_ALLOWED');
 // Drop the whole query and hash to avoid embedding login, session, personal
 // identifiers or tracking parameters in a portable research file.
 parsed.search='';parsed.hash='';
 return parsed.toString();
}
function captureReference(raw,{asOf=new Date()}={}){
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('NOAPI_INPUT_INVALID');
 const source=Object.prototype.hasOwnProperty.call(BY_ID,raw.sourceId)?
  BY_ID[raw.sourceId]:null;
 if(!source)throw Error('NOAPI_SOURCE_UNKNOWN');
 let today;
 if(asOf instanceof Date){
  if(!Number.isFinite(asOf.getTime()))throw Error('NOAPI_DATE_INVALID');
  const parts=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Riyadh',
   year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(asOf);
  const part=type=>parts.find(x=>x.type===type)?.value;
  today=[part('year'),part('month'),part('day')].join('-');
 }else today=safeDate(asOf,'9999-12-31');
 const observedOn=safeDate(raw.observedOn,today);
 const city=cleanText(raw.city||'',100),district=cleanText(raw.district||'',100);
 // Research may be nationwide, but the city/district must then remain
 // explicitly blank; don't fake a parcel/plan/location.
 const sourceUrl=safeUrl(raw.sourceUrl||source.url,source);
 return Object.freeze({
  sourceId:source.id,sourceUrl,city,district,observedOn,
  mode:source.mode,method:'OWNER_MANUAL_LINK',
  evidenceClass:'RESEARCH_REFERENCE_ONLY',personalResearch:true,
  contentCopied:false,valuationSar:null,annualRentSar:null,
  sourceAuthenticated:false,licenseVerified:false,
  propertyIdentityVerified:false,decisionReady:false,
  professionalReportAuthorized:false,productionConnectorUsed:false,
 });
}
function mergeReferences(current,incoming){
 if(!Array.isArray(current)||!Array.isArray(incoming))throw Error('NOAPI_MERGE_INVALID');
 const result=[],ids=new Set();let duplicates=0;
 for(const r of [...current,...incoming]){
  // Ignore all authority flags supplied from outside; reconstruct canonical
  // non-authorizing records from a strict small allowlist only.
  const item=captureReference(r);
  const id=JSON.stringify([item.sourceId,item.sourceUrl,item.city,
   item.district,item.observedOn]);
  if(ids.has(id)){duplicates++;continue;}
  if(result.length===MAX_REFERENCES)throw Error('NOAPI_MAX_REFERENCES');
  ids.add(id);result.push(item);
 }
 return Object.freeze({references:Object.freeze(result),duplicates,
  certifiedValues:0,authenticatedSales:0,productionIntegration:false});
}
function exportReferences(references){
 const merged=mergeReferences([],references);
 const payload={version:VERSION,references:merged.references.map(r=>({
  sourceId:r.sourceId,sourceUrl:r.sourceUrl,city:r.city,
  district:r.district,observedOn:r.observedOn,
 }))};
 const json=JSON.stringify(payload,null,2);
 if(new TextEncoder().encode(json).length>MAX_PORTABLE_BYTES)throw Error('NOAPI_EXPORT_TOO_LARGE');
 return json;
}
function importReferences(json){
 if(typeof json!=='string'||new TextEncoder().encode(json).length>MAX_PORTABLE_BYTES)
  throw Error('NOAPI_IMPORT_TOO_LARGE');
 let payload;
 try{payload=JSON.parse(json);}catch{throw Error('NOAPI_IMPORT_JSON_INVALID');}
 if(!payload||typeof payload!=='object'||Array.isArray(payload)||
  Object.keys(payload).sort().join(',')!=='references,version'||
  payload.version!==VERSION||!Array.isArray(payload.references)||
  payload.references.length>MAX_REFERENCES)
  throw Error('NOAPI_IMPORT_SCHEMA_INVALID');
 const allowed=['city','district','observedOn','sourceId','sourceUrl'].sort().join(',');
 for(const r of payload.references){
  if(!r||typeof r!=='object'||Array.isArray(r)||
   Object.keys(r).sort().join(',')!==allowed)
   throw Error('NOAPI_IMPORT_AUTHORITY_FIELD_FORBIDDEN');
 }
 return mergeReferences([],payload.references);
}
module.exports={VERSION,SOURCES,BY_ID,SOURCE_ENTRYPOINTS,BY_ENTRYPOINT_ID,MAX_REFERENCES,MAX_PORTABLE_BYTES,
 captureReference,mergeReferences,exportReferences,importReferences};
