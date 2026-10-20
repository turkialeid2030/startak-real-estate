'use strict';
const MAX_BACKUP_BYTES=10*1024*1024,MAX_DEALS=200;
const fail=code=>{throw Object.assign(new Error(code),{name:'BackupError',reasonCode:code});};
function checkText(text){
 if(typeof text!=='string'||text.length>MAX_BACKUP_BYTES||new TextEncoder().encode(text).byteLength>MAX_BACKUP_BYTES)fail('BACKUP_SIZE_LIMIT');
 return text;
}
function checkJson(value){
 let nodes=0;
 function visit(item,depth){
  if(++nodes>350000||depth>32)fail('BACKUP_STRUCTURE_LIMIT');
  if(item===null||typeof item==='boolean')return;
  if(typeof item==='string'){if(item.length>MAX_BACKUP_BYTES)fail('BACKUP_SIZE_LIMIT');return;}
  if(typeof item==='number'){if(!Number.isFinite(item))fail('BACKUP_VALUE_INVALID');return;}
  if(typeof item!=='object')fail('BACKUP_VALUE_INVALID');
  for(const[key,child]of Object.entries(item)){
   if(['__proto__','constructor','prototype'].includes(key))fail('BACKUP_KEY_INVALID');
   visit(child,depth+1);
  }
 }
 visit(value,0);checkText(JSON.stringify(value));return value;
}
function validId(id){return typeof id==='string'&&id.trim().length>0&&id.length<=160&&!/[\u0000-\u001f]/.test(id)&&!['__proto__','constructor','prototype'].includes(id);}
function checkIndex(entries){
 if(!Array.isArray(entries)||entries.length>MAX_DEALS)fail('BACKUP_DEAL_LIMIT');
 checkJson(entries);const ids=new Set();
 for(const entry of entries){if(!entry||!validId(entry.id)||ids.has(entry.id))fail('BACKUP_INDEX_INVALID');ids.add(entry.id);}
 return entries;
}
function parseBackupText(text){checkText(text);let value;try{value=JSON.parse(text);}catch{fail('BACKUP_JSON_INVALID');}return checkJson(value);}
function serializeBackup(value){checkJson(value);return checkText(JSON.stringify(value,null,2));}
module.exports={MAX_BACKUP_BYTES,MAX_DEALS,checkText,checkJson,validId,checkIndex,parseBackupText,serializeBackup};
