'use strict';
const assert=require('node:assert/strict');
const {validateDistrictGeometry,joinDistrictGeometry,svgDistrictPaths}=require('../../src/reporting/public-rent-geography');
const scope={region:'الرياض',city:'الرياض'};
const f=(id,district,offset=0)=>({type:'Feature',properties:{id,district,...scope},geometry:{type:'Polygon',coordinates:[[[46+offset,24],[46.01+offset,24],[46.01+offset,24.01],[46+offset,24.01],[46+offset,24]]]}});
const doc=features=>({type:'FeatureCollection',features});
const matrix={scope,districts:[{district:'ألف',relativeBand:2,reportedRentPerSqmSar:100},{district:'باء',relativeBand:4,reportedRentPerSqmSar:200}]};
let n=0;function test(name,fn){fn();n++;console.log('PASS '+name);}
test('exact normalized match with no fuzzy guesses',()=>{const r=joinDistrictGeometry(doc([f('1','الف'),f('2','باء',.02),f('3','جيم',.04)]),matrix);assert.equal(r.matched,2);assert.equal(r.items[2].metric,null);assert.equal(r.valuationEligible,false);});
test('missing polygon reported',()=>assert.deepEqual(joinDistrictGeometry(doc([f('1','الف')]),matrix).unmatchedMetricDistricts,['باء']));
test('duplicate names remain ambiguous',()=>assert.equal(joinDistrictGeometry(doc([f('1','الف'),f('2','ألف',.02)]),matrix).matched,0));
test('duplicate IDs rejected',()=>assert.throws(()=>validateDistrictGeometry(doc([f('1','الف'),f('1','باء')]),scope),/GEO_FEATURE/));
test('wrong city rejected',()=>{const a=f('1','الف');a.properties.city='جدة';assert.throws(()=>validateDistrictGeometry(doc([a]),scope),/GEO_FEATURE/);});
test('open ring rejected',()=>{const a=f('1','الف');a.geometry.coordinates[0].pop();assert.throws(()=>validateDistrictGeometry(doc([a]),scope),/GEO_RING_OPEN/);});
test('invalid coordinates rejected',()=>{const a=f('1','الف');a.geometry.coordinates[0][0]=[0,0];assert.throws(()=>validateDistrictGeometry(doc([a]),scope),/GEO_COORDINATE/);});
test('multipolygon supported',()=>{const a=f('1','الف');a.geometry={type:'MultiPolygon',coordinates:[a.geometry.coordinates,f('2','باء',.02).geometry.coordinates]};assert.equal(validateDistrictGeometry(doc([a]),scope)[0].polys.length,2);});
test('paths are finite and closed',()=>{const r=joinDistrictGeometry(doc([f('1','الف')]),matrix);const p=svgDistrictPaths(r.items)[0].path;assert.ok(p.startsWith('M')&&p.endsWith(' Z')&&!/NaN|Infinity/.test(p));});
test('degenerate polygon rejected',()=>{const a=f('1','الف');a.geometry.coordinates=[[[46,24],[46.01,24],[46.02,24],[46,24]]];assert.throws(()=>validateDistrictGeometry(doc([a]),scope),/DEGENERATE/);});
console.log('PUBLIC_RENT_GEOGRAPHY_RULES=PASS cases='+n);
