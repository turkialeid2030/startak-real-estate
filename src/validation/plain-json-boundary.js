'use strict';
// Validate ordinary JSON records without reading accessors. Reject values that
// JSON serialization would erase or normalize ambiguously. Shared references
// are allowed; cycles are not. Limits protect qualification boundaries.
function assertPlainJson(value,{maxDepth=32,maxNodes=100000}={}){
 let nodes=0;const active=new Set();
 function visit(v,depth){
  if(++nodes>maxNodes||depth>maxDepth)throw Error('JSON_LIMIT');
  if(v===null||typeof v==='string'||typeof v==='boolean')return;
  if(typeof v==='number'&&Number.isFinite(v)&&(!Number.isInteger(v)||Number.isSafeInteger(v)))return;
  if(!v||typeof v!=='object'||active.has(v))throw Error('JSON_VALUE');
  const array=Array.isArray(v),proto=Object.getPrototypeOf(v);
  if(array?proto!==Array.prototype:![Object.prototype,null].includes(proto))throw Error('JSON_PROTOTYPE');
  const keys=Reflect.ownKeys(v);
  if(array&&(v.length>maxNodes||keys.length!==v.length+1))throw Error('JSON_ARRAY_SHAPE');
  active.add(v);
  for(const k of keys){
   if(array&&k==='length')continue;
   if(typeof k!=='string'||['__proto__','prototype','constructor','toJSON'].includes(k))throw Error('JSON_KEY');
   if(array&&(!/^(0|[1-9][0-9]*)$/.test(k)||Number(k)>=v.length))throw Error('JSON_ARRAY_SHAPE');
   const descriptor=Object.getOwnPropertyDescriptor(v,k);
   if(!descriptor||!descriptor.enumerable||!Object.hasOwn(descriptor,'value'))throw Error('JSON_DESCRIPTOR');
   visit(descriptor.value,depth+1);
  }
  active.delete(v);
 }
 visit(value,0);return value;
}
function isPlainJson(value){try{assertPlainJson(value);return true;}catch{return false;}}
module.exports={assertPlainJson,isPlainJson};
