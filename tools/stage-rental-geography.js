'use strict';
// Stage a public Riyadh boundary source for review only. Never auto-promote.
const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const {validateDistrictGeometry,joinDistrictGeometry}=require('../src/reporting/public-rent-geography');
const {parsePublicRentCsv}=require('../src/reporting/public-rent-reference');
const {buildDistrictRentMatrix}=require('../src/reporting/public-rent-district-matrix');
const SOURCE='https://raw.githubusercontent.com/i1s1i/GIS-rcrc-map/main/data/riyadh_districts.geojson';
const OUT='runtime-evidence/rental-geography-candidate',scope={region:'الرياض',city:'الرياض'};
async function main(){
 const r=await fetch(SOURCE,{redirect:'error',signal:AbortSignal.timeout(30000)});
 if(!r.ok||!r.body)throw Error('GEOMETRY_HTTP_'+r.status);
 let size=0;const chunks=[];for await(const c of r.body){size+=c.length;if(size>4*1024*1024)throw Error('GEOMETRY_SIZE');chunks.push(Buffer.from(c));}
 const raw=Buffer.concat(chunks),original=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(raw));
 if(original.type!=='FeatureCollection'||!Array.isArray(original.features)||!original.features.length||original.features.length>2000)throw Error('GEOMETRY_SOURCE');
 const normalized={type:'FeatureCollection',features:[]},rejected=[];
 for(const f of original.features){
  const feature={type:'Feature',properties:{id:String(f.properties?.id??''),district:f.properties?.name_ar,...scope},geometry:f.geometry};
  try{validateDistrictGeometry({type:'FeatureCollection',features:[feature]},scope);normalized.features.push(feature);}
  catch(e){rejected.push({id:feature.properties.id,district:feature.properties.district??null,error:e.message});}
 }
 const shapes=validateDistrictGeometry(normalized,scope);
 const rows=parsePublicRentCsv(await fs.readFile('public/market-data/rega-riyadh-q1-2026.csv','utf8'));
 const matrix=buildDistrictRentMatrix(rows,{...scope,kind:'شقة',classification:'سكني',year:2026,quarter:1});
 const joined=joinDistrictGeometry(normalized,matrix);
 const manifest={version:1,status:'REVIEW_REQUIRED',sourceUrl:SOURCE,sourceSha256:crypto.createHash('sha256').update(raw).digest('hex'),observedAt:new Date().toISOString(),scope,originalFeatures:original.features.length,features:shapes.length,rejectedFeatures:rejected,matched:joined.matched,unmatchedMetricDistricts:joined.unmatchedMetricDistricts,sourceRightsVerified:false,sourceAuthorityVerified:false,attribution:'OpenStreetMap contributors; community mirror i1s1i/GIS-rcrc-map',licenseReference:'https://www.openstreetmap.org/copyright',approvalRequired:true};
 await fs.mkdir(OUT,{recursive:true});await fs.writeFile(path.join(OUT,'original.geojson'),raw);await fs.writeFile(path.join(OUT,'riyadh-districts.geojson'),JSON.stringify(normalized));await fs.writeFile(path.join(OUT,'manifest.json'),JSON.stringify(manifest,null,2));
 console.log('RENTAL_GEOGRAPHY_CANDIDATE '+JSON.stringify({features:shapes.length,rejected:rejected.length,matched:joined.matched,unmatched:joined.unmatchedMetricDistricts.length,approvalRequired:true}));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
