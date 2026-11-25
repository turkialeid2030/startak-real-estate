'use strict';
// Scoped geographic overlay. No geocoding, inferred polygons or fuzzy matches.
const norm=s=>String(s??'').trim().replace(/[أإآٱ]/g,'ا').replace(/\s+/g,' ').toLowerCase();
const LIMIT=250000;
function validateDistrictGeometry(doc,scope){
 if(!scope||!scope.region?.trim()||!scope.city?.trim()||doc?.type!=='FeatureCollection'||!Array.isArray(doc.features)||!doc.features.length||doc.features.length>2000)throw Error('GEO_SCOPE');
 let points=0;const ids=new Set();
 const ring=r=>{
  if(!Array.isArray(r)||r.length<4)throw Error('GEO_RING');
  for(const p of r){if(!Array.isArray(p)||p.length!==2||!p.every(Number.isFinite)||p[0]<34||p[0]>56||p[1]<15||p[1]>33||++points>LIMIT)throw Error('GEO_COORDINATE');}
  if(r[0][0]!==r.at(-1)[0]||r[0][1]!==r.at(-1)[1])throw Error('GEO_RING_OPEN');
  let area=0;for(let i=1;i<r.length;i++)area+=r[i-1][0]*r[i][1]-r[i][0]*r[i-1][1];
  if(Math.abs(area)<1e-12)throw Error('GEO_RING_DEGENERATE');
  return r;
 };
 const features=doc.features.map(f=>{
  const p=f?.properties,g=f?.geometry;
  if(f?.type!=='Feature'||!p||typeof p.id!=='string'||!p.id.trim()||ids.has(p.id)||typeof p.district!=='string'||!p.district.trim()||norm(p.region)!==norm(scope.region)||norm(p.city)!==norm(scope.city)||!['Polygon','MultiPolygon'].includes(g?.type))throw Error('GEO_FEATURE');
  ids.add(p.id);const polys=g.type==='Polygon'?[g.coordinates]:g.coordinates;
  if(!Array.isArray(polys)||!polys.length)throw Error('GEO_POLYGON');
  for(const poly of polys){if(!Array.isArray(poly)||!poly.length)throw Error('GEO_POLYGON');poly.forEach(ring);}
  return {id:p.id,district:p.district,polys};
 });
 return features;
}
function joinDistrictGeometry(doc,matrix){
 const shapes=validateDistrictGeometry(doc,matrix.scope);
 const byName=new Map(),metrics=new Map();
 for(const s of shapes){const k=norm(s.district);if(!byName.has(k))byName.set(k,[]);byName.get(k).push(s);}
 for(const d of matrix.districts){const k=norm(d.district);if(!metrics.has(k))metrics.set(k,[]);metrics.get(k).push(d);}
 const items=shapes.map(s=>{const k=norm(s.district),m=metrics.get(k)||[],exact=byName.get(k).length===1&&m.length===1;return {...s,metric:exact?m[0]:null,status:!exact?(m.length?'AMBIGUOUS':'NO_MATCH'):'EXACT_NAME_MATCH'};});
 const matched=items.filter(x=>x.metric).length;
 return {items,matched,unmatchedMetricDistricts:matrix.districts.filter(d=>!items.some(x=>x.metric===d)).map(d=>d.district),geometryAvailable:true,valuationEligible:false};
}
function svgDistrictPaths(items,width=640,height=400){
 let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;
 for(const i of items)for(const p of i.polys)for(const r of p)for(const [x,y] of r){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);}
 if(!Number.isFinite(x0)||x1<=x0||y1<=y0)throw Error('GEO_EXTENT');
 // Local equirectangular display, not surveying-grade geometry.
 const cos=Math.cos((y0+y1)/2*Math.PI/180),s=Math.min((width-20)/((x1-x0)*cos),(height-20)/(y1-y0));
 const ox=(width-(x1-x0)*cos*s)/2,oy=(height-(y1-y0)*s)/2;
 return items.map(i=>({...i,path:i.polys.flatMap(p=>p.map(r=>r.map(([x,y],j)=>(j?'L':'M')+((x-x0)*cos*s+ox).toFixed(2)+' '+((y1-y)*s+oy).toFixed(2)).join(' ')+' Z')).join(' ')}));
}
module.exports={validateDistrictGeometry,joinDistrictGeometry,svgDistrictPaths};
