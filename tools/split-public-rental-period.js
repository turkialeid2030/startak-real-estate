'use strict';
// Known upstream mixed-period files; retain raw bytes, extract only their declared period.
const crypto=require('node:crypto');
const {parsePublicRentCsv}=require('../src/reporting/public-rent-reference');
const KNOWN=new Set(['aseer','jazan','madinah','najran']);
const blob=b=>crypto.createHash('sha1').update('blob '+b.length+'\0').update(b).digest('hex');
function splitKnownMixed(raw,reference,region,year,quarter){
 if(!KNOWN.has(region)||year!==2025||quarter!==1)throw Error('PERIOD_MISMATCH');
 const decode=b=>new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(b);
 const text=decode(raw),ref=decode(reference);
 const rows=parsePublicRentCsv(text),refRows=parsePublicRentCsv(ref);
 if(!refRows.every(r=>r.year===2026&&r.quarter===1))throw Error('MIXED_REFERENCE_PERIOD');
 // The four audited upstream files are simple physical CSV records. Reject
 // multiline records rather than silently splitting them.
 const lines=text.split(/\r?\n/).filter(Boolean),refLines=ref.split(/\r?\n/).filter(Boolean);
 if(lines.length!==rows.length+1||refLines.length!==refRows.length+1)throw Error('MIXED_MULTILINE');
 const selected=[],overlap=[];
 for(let i=0;i<rows.length;i++){
  const r=rows[i];
  if(r.year===year&&r.quarter===quarter)selected.push(lines[i+1]);
  else if(r.year===2026&&r.quarter===1)overlap.push(lines[i+1]);
  else throw Error('MIXED_UNEXPECTED_PERIOD');
 }
 if(!selected.length||!overlap.length||JSON.stringify(overlap.sort())!==JSON.stringify(refLines.slice(1).sort()))throw Error('MIXED_OVERLAP_CONFLICT');
 const derived=Buffer.from([lines[0],...selected].join('\r\n')+'\r\n','utf8');
 const parsed=parsePublicRentCsv(decode(derived));
 if(parsed.length!==selected.length||!parsed.every(r=>r.year===year&&r.quarter===quarter))throw Error('MIXED_DERIVED_INVALID');
 return {derived,provenance:{method:'EXACT_PERIOD_ROW_FILTER_V1',sourceGitBlobSha:blob(raw),overlapReferenceGitBlobSha:blob(reference),sourceRows:rows.length,excludedDuplicateRows:overlap.length,retainedRows:parsed.length}};
}
module.exports={splitKnownMixed};
