'use strict';
// Compare reported figures only. Identity and source declarations are not legal verification.
const P=require('../engines/financial/precision');
const {sha256Hex}=require('../crypto/sha256');
const VERSION='PROPERTY_LIFECYCLE_REVIEW_V1';
const exact=(v,ks)=>v!==null&&typeof v==='object'&&Object.getPrototypeOf(v)===Object.prototype&&Object.keys(v).length===ks.length&&ks.every(k=>Object.hasOwn(v,k));
const text=v=>typeof v==='string'&&v.trim().length>0&&v.length<=200;
const day=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
const money=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=1e12&&P.money(v)===v;
const STATES=['IMPROVED','VACANT_LAND','UNDER_DEVELOPMENT','PARTIALLY_DEMOLISHED','UNKNOWN'];
function compareReportedHistory(x){
 if(!exact(x,['version','propertyRef','identityEvidenceRef','identityMatchDeclared','before','after','transitionEvidenceRef'])||x.version!==VERSION||!text(x.propertyRef)||!text(x.identityEvidenceRef)||typeof x.identityMatchDeclared!=='boolean'||!text(x.transitionEvidenceRef))throw Error('HISTORY_INPUT_INVALID');
 const keys=['reportRef','propertyRef','valuationDate','issueDate','landAreaSqm','state','basis','purpose','propertyRight','method','reportedValueSar','landValueSar','improvementValueSar','sourcePage'];
 for(const s of [x.before,x.after]){
  if(!exact(s,keys)||!['reportRef','propertyRef','basis','purpose','propertyRight','method'].every(k=>text(s[k]))||!day(s.valuationDate)||!day(s.issueDate)||s.issueDate<s.valuationDate||typeof s.landAreaSqm!=='number'||!Number.isFinite(s.landAreaSqm)||s.landAreaSqm<=0||s.landAreaSqm>1e9||P.fromRate(P.toRate(s.landAreaSqm))!==s.landAreaSqm||!STATES.includes(s.state)||!money(s.reportedValueSar)||!['landValueSar','improvementValueSar'].every(k=>s[k]===null||money(s[k]))||!Number.isInteger(s.sourcePage)||s.sourcePage<1||s.sourcePage>10000)throw Error('HISTORY_SNAPSHOT_INVALID');
 }
 const a=x.before,b=x.after;
 if(a.valuationDate>=b.valuationDate||a.reportRef===b.reportRef)throw Error('HISTORY_CHRONOLOGY_INVALID');
 const issues=[],add=(code,severity,ref)=>issues.push({code,severity,ref});
 const identityOk=x.identityMatchDeclared&&a.propertyRef===x.propertyRef&&b.propertyRef===x.propertyRef&&a.landAreaSqm===b.landAreaSqm;
 if(!identityOk)add('HISTORY_IDENTITY_UNRESOLVED','CRITICAL','identity');
 const changed=['state','basis','purpose','propertyRight','method'].filter(k=>a[k]!==b[k]);
 if(changed.length)add('HISTORY_NONCOMPARABLE_BASES','WARNING','history');
 for(const s of [a,b])if(s.landValueSar!==null&&s.improvementValueSar!==null&&P.moneyAdd(s.landValueSar,s.improvementValueSar)!==s.reportedValueSar)add('HISTORY_COMPONENT_SUM_MISMATCH','WARNING',s.reportRef);
 const delta=identityOk?P.moneySub(b.reportedValueSar,a.reportedValueSar):null;
 const out={version:VERSION,scope:'DECLARED_REPORT_HISTORY_ONLY',propertyRef:x.propertyRef,identityEvidenceRef:x.identityEvidenceRef,transitionEvidenceRef:x.transitionEvidenceRef,before:{...a},after:{...b},changedFields:changed,reportedDeltaSar:delta,reportedDeltaFraction:delta!==null&&a.reportedValueSar>0?delta/a.reportedValueSar:null,attributedMarketChangeSar:null,marketGrowthEstablished:false,identityAuthenticated:false,transitionAuthenticated:false,sourceAuthenticated:false,professionalValuationCertified:false,transactionAuthorized:false,canonicalModelUpdated:false,issues};
 return {...out,reviewHashSha256:sha256Hex(JSON.stringify(out))};
}
module.exports={VERSION,compareReportedHistory};
