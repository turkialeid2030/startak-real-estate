'use strict';

// The inventory captures exact historic GitHub blob IDs from selected branches.
// It is a discrepancy/triage gate, NOT a claim of functional parity, production
// availability, lawful source access or certified valuation.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const p = require('node:path');
const root = p.resolve(__dirname, '../..');
const register = p.join(root, 'docs/recovery/STARTAK_RE_HISTORIC_SOURCE_CANDIDATES_20261114.csv');

function csvRow(line) {
  const fields=[];let value='';let quoted=false;
  for(let i=0;i<line.length;i++) {
    const c=line[i];
    if(c==='"') {
      if(quoted && line[i+1]==='"') {value+='"';i++;}
      else quoted=!quoted;
    } else if(c===',' && !quoted) {fields.push(value);value='';}
    else value+=c;
  }
  if(quoted)throw Error('UNCLOSED_CSV_QUOTE');
  fields.push(value);
  return fields;
}
const lines=fs.readFileSync(register,'utf8').trim().split(/\r?\n/);
const header=csvRow(lines.shift());
const expected=['id','old','source_blob','versions','domain','modern_anchor','status','inspection','priority','acceptance'];
assert.deepEqual(header,expected,'Historic register schema drift');
const entries=lines.map((line,index)=>{
  const values=csvRow(line);
  assert.equal(values.length,expected.length,'Bad CSV fields for row '+(index+1));
  return Object.fromEntries(header.map((k,i)=>[k,values[i]]));
});
assert.equal(entries.length,57,'10 historical family samples documented 57 unique missing exact paths on this snapshot');
const seen=new Set(),statuses={},priorities={};
for(const [index,entry] of entries.entries()) {
  assert.match(entry.id,/^LEG-\d{3}$/);
  assert.equal(entry.id,'LEG-'+String(index+1).padStart(3,'0'));
  assert.match(entry.old,/^src\/[A-Za-z0-9_.\/-]+$/);
  assert.match(entry.source_blob,/^[a-f0-9]{40}$/);
  assert.ok(!seen.has(entry.old),'Duplicate historic source path');
  seen.add(entry.old);
  assert.ok(!fs.existsSync(p.join(root,entry.old)),'Historic path appeared: REQUALIFY AND UPDATE, do not auto-report parity: '+entry.old);
  assert.ok(entry.versions.length>0 && entry.acceptance.length>20);
  assert.ok(['P0','P1','P2'].includes(entry.priority));
  assert.ok(['LEGACY_API_INSPECTED','PATH_ONLY'].includes(entry.inspection));
  assert.ok(['MODERN_ANCHOR_EXISTS_PARITY_UNVERIFIED','OLD_STAGING_CONTRACT_NOT_PRODUCTION_VAULT','SAFE_RETIREMENT_REVIEW'].includes(entry.status));
  if(entry.status==='SAFE_RETIREMENT_REVIEW'){
    assert.equal(entry.old,'src/runtime/browser-crypto-shim.js');
    assert.equal(entry.modern_anchor,'');
  } else {
    assert.match(entry.modern_anchor,/^src\/[A-Za-z0-9_.\/-]+$/);
    assert.ok(fs.existsSync(p.join(root,entry.modern_anchor)),
      'Modern candidate disappeared: REQUALIFY, do not auto-mark missing functionality: '+entry.modern_anchor);
  }
  statuses[entry.status]=(statuses[entry.status]||0)+1;
  priorities[entry.priority]=(priorities[entry.priority]||0)+1;
}
assert.deepEqual(statuses,{
  MODERN_ANCHOR_EXISTS_PARITY_UNVERIFIED:46,
  OLD_STAGING_CONTRACT_NOT_PRODUCTION_VAULT:10,
  SAFE_RETIREMENT_REVIEW:1,
});
assert.deepEqual(priorities,{P2:6,P1:28,P0:23});
assert.equal(entries.filter(x=>x.inspection==='LEGACY_API_INSPECTED').length,20);
console.log('STARTAK_RE_HISTORIC_SOURCE_REGISTER=PASS rows=57 legacy_api_inspected=20 path_only=37;');
console.log('SOURCE_PATH_PARITY_CLAIM=FALSE FUNCTIONAL_PARITY_CLAIM=FALSE PRODUCTION_AUTHORITY=FALSE');
