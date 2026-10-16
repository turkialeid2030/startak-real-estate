'use strict';

// Normalize only recognized numeric symbols. Never delete arbitrary text: 1e3
// and 1800٫5 must not be silently reinterpreted as 13 and 18005.
function normalizeNumericText(input) {
  if(typeof input!=='string'&&typeof input!=='number')return {ok:false,code:'NUMERIC_TEXT_INVALID'};
  if(typeof input==='number'&&!Number.isFinite(input))return {ok:false,code:'NUMERIC_TEXT_INVALID'};
  const raw=String(input);
  if(raw.length>128)return {ok:false,code:'NUMERIC_TEXT_TOO_LONG'};
  const text=raw.trim().replace(/[٠-٩]/g,d=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[۰-۹]/g,d=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/[−﹣－]/g,'-');
  if(!text)return {ok:false,code:'NUMERIC_TEXT_REQUIRED'};
  if((text.includes('.')&&text.includes('٫'))||(text.includes(',')&&text.includes('٬')))return {ok:false,code:'NUMERIC_SEPARATORS_AMBIGUOUS'};
  const normalized=text.replace(/٫/g,'.').replace(/٬/g,',');
  // A comma is a thousands separator only, with exactly three digits per group.
  if(!/^-?(?:(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d*)?|\.\d+)$/.test(normalized))return {ok:false,code:'NUMERIC_TEXT_INVALID'};
  return {ok:true,normalized:normalized.replace(/,/g,''),raw};
}
function parseNumericText(input) {
  const parsed=normalizeNumericText(input);if(!parsed.ok)return parsed;
  const value=Number(parsed.normalized);
  if(!Number.isFinite(value)||Math.abs(value)>Number.MAX_SAFE_INTEGER)return {ok:false,code:'NUMERIC_TEXT_OUT_OF_RANGE'};
  return {...parsed,value};
}
module.exports={normalizeNumericText,parseNumericText};
