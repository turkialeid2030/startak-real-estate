'use strict';
// Structural triage only. Identical bytes at another path do not establish
// equivalent imports, runtime reachability, authorization, or business behavior.
const HASH=/^[a-f0-9]{40}$/;
const safeHash=h=>typeof h==='string'&&HASH.test(h);
function csvRow(line){
  const fields=[];let value='',quoted=false;
  for(let i=0;i<line.length;i++){
    const ch=line[i];
    if(ch==='"'){
      if(quoted&&line[i+1]==='"'){value+='"';i++;}
      else quoted=!quoted;
    }else if(ch===','&&!quoted){fields.push(value);value='';}
    else value+=ch;
  }
  if(quoted)throw Error('HISTORIC_REGISTER_INVALID');
  return [...fields,value];
}
function readHistoricRegister(csv){
  if(typeof csv!=='string')throw Error('HISTORIC_REGISTER_INVALID');
  const lines=csv.trim().split(/\r?\n/);
  const header=['id','old','source_blob','versions','domain','modern_anchor','status','inspection','priority','acceptance'];
  if(JSON.stringify(csvRow(lines.shift()||''))!==JSON.stringify(header))throw Error('HISTORIC_REGISTER_INVALID');
  const rows=new Map(),ids=new Set();
  for(const line of lines){
    const cells=csvRow(line);
    if(cells.length!==header.length||!/^LEG-\d{3}$/.test(cells[0])||!cells[1]||!safeHash(cells[2])||ids.has(cells[0])||rows.has(cells[1]))throw Error('HISTORIC_REGISTER_INVALID');
    ids.add(cells[0]);rows.set(cells[1],{id:cells[0],blob:cells[2]});
  }
  if(!rows.size)throw Error('HISTORIC_REGISTER_EMPTY');
  return rows;
}
function triageLegacyPaths(current,candidates,register){
  if(!(current instanceof Map)||!(register instanceof Map)||!Array.isArray(candidates))throw Error('LEGACY_TRIAGE_INPUT_INVALID');
  const currentBlobs=new Set();
  for(const [p,h] of current){if(!p||!safeHash(h))throw Error('LEGACY_CURRENT_TREE_INVALID');currentBlobs.add(h);}
  const seen=new Set(),historicalBlobs=new Set();
  const classes={ALL_VARIANTS_PRESENT_ELSEWHERE:0,SOME_VARIANTS_PRESENT_ELSEWHERE:0,NO_VARIANT_PRESENT:0};
  const details=[];
  let variants=0,matched=0,registeredPaths=0,registeredExactVariants=0;
  for(const c of candidates){
    if(!c||typeof c.path!=='string'||!c.path||seen.has(c.path)||current.has(c.path)||!Array.isArray(c.blobVariations)||!c.blobVariations.length||
       c.blobVariations.some(h=>!safeHash(h))||new Set(c.blobVariations).size!==c.blobVariations.length)throw Error('LEGACY_CANDIDATE_INVALID');
    seen.add(c.path);
    const count=c.blobVariations.filter(h=>currentBlobs.has(h)).length;
    const state=count===c.blobVariations.length?'ALL_VARIANTS_PRESENT_ELSEWHERE':count?'SOME_VARIANTS_PRESENT_ELSEWHERE':'NO_VARIANT_PRESENT';
    classes[state]++;variants+=c.blobVariations.length;matched+=count;
    c.blobVariations.forEach(h=>historicalBlobs.add(h));
    const registered=register.get(c.path);
    const exactRegistered=!!registered&&c.blobVariations.includes(registered.blob);
    if(registered)registeredPaths++;
    if(exactRegistered)registeredExactVariants++;
    details.push({...c,structuralState:state,variantCount:c.blobVariations.length,matchedVariantCount:count,registerId:registered?.id||null,registerBlobPresent:exactRegistered,functionalParity:'NOT_PROVEN'});
  }
  return {details,summary:{candidatePaths:candidates.length,classes,pathVariantPairs:variants,matchedPathVariantPairs:matched,unmatchedPathVariantPairs:variants-matched,uniqueHistoricalBlobs:historicalBlobs.size,registeredPaths,registeredExactVariants,unregisteredCandidatePaths:candidates.length-registeredPaths,registeredRows:register.size,functionalParity:'NOT_PROVEN'}};
}
module.exports={readHistoricRegister,triageLegacyPaths};
