'use strict';
const {buildPersonalResearchReport}=require('../app/personal-investment-research-report');
const {reviewExternalReport}=require('./external-report-review');
const {sha256Hex}=require('../crypto/sha256');
const MODES=Object.freeze(['OWNER','TECHNICAL']);
const h=v=>String(v??'—').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const LABELS={
 IDENTITY_CONFLICT_DECLARED:['تعارض هوية العقار المصرح به','Declared property identity conflict'],
 INCOME_EVIDENCE_MISSING:['أدلة الدخل غير متوفرة','Income evidence missing'],
 FUTURE_COMPARABLE:['مقارنة لاحقة لتاريخ التقييم','Future-dated comparable'],
 STALE_COMPARABLE_REVIEW:['مقارنة قديمة تحتاج مراجعة','Stale comparable requires review'],
 AREA_COMPARABILITY_REVIEW:['تفاوت مساحة المقارنة يحتاج تبريرًا','Area comparability requires justification'],
 NOT_EXECUTED:['الصفقة غير مثبتة كمنفذة','Not declared executed'],
 ADOPTED_RATE_DIFF_DOCUMENTED_UNVERIFIED:['فرق سعر مع مبرر غير متحقق','Adopted rate difference with unverified explanation'],
 ADOPTED_RATE_DIFF_UNEXPLAINED:['فرق سعر غير مبرر','Unexplained adopted rate difference'],
 BUILDING_COST_MISMATCH:['فرق تكلفة المباني','Building cost mismatch'],
 DECLARED_DEPRECIATION_MISMATCH:['فرق الإهلاك المصرح','Declared depreciation mismatch'],
 AGE_LIFE_PRECISION_DIFFERENCE:['فرق دقة نسبة العمر','Age-life precision difference'],
 DEPRECIATION_EXCEEDS_COST:['الإهلاك يتجاوز التكلفة','Depreciation exceeds cost'],
 FINAL_VALUE_MISMATCH:['فرق القيمة الإجمالية','Final value mismatch']
};
function issueLabel(code,locale){return LABELS[code]?.[locale==='en'?1:0]||code;}
function wrap(title,body,locale){
 const ar=locale!=='en',warning=ar?'مسودة بحثية غير معتمدة — لا تصلح لإثبات القيمة أو اتخاذ قرار ملزم':'Uncertified research draft — no appraisal or transaction authority';
 return '<!doctype html><html lang="'+(ar?'ar':'en')+'" dir="'+(ar?'rtl':'ltr')+'"><head><meta charset="UTF-8"><meta http-equiv="Content-Security-Policy" content="default-src &#39;none&#39;; style-src &#39;unsafe-inline&#39;"><title>'+h(title)+'</title><style>@page{size:A4;margin:16mm}*{box-sizing:border-box}body{font-family:Tahoma,Arial,sans-serif;color:#10243a;line-height:1.65;margin:0 auto;max-width:900px;padding:24px}header{border-top:8px solid #245779;padding:24px 0;border-bottom:2px solid #c9a24c}h1{font-size:26px}h2{font-size:18px;color:#245779}table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:12px}td,th{border:1px solid #d9dfe5;padding:8px;overflow-wrap:anywhere;text-align:start;vertical-align:top}th{background:#eef2f5}thead{display:table-header-group}tr{break-inside:avoid}h2{break-after:avoid}.notice{border:1px solid #9a681c;padding:12px}.metric{font-size:26px;font-weight:bold}small{overflow-wrap:anywhere}footer{margin-top:24px;border-top:1px solid #aaa;font-size:11px}@media print{body{padding:0}header{break-inside:avoid}a{color:inherit}}</style></head><body><header><strong>STARTAK REAL ESTATE</strong><h1>'+h(title)+'</h1><p class="notice">'+h(warning)+'</p></header>'+body+'<footer>'+h(warning)+'</footer></body></html>';
}
const table=rows=>'<table><tbody>'+rows.map(([a,b])=>'<tr><th>'+h(a)+'</th><td>'+h(b)+'</td></tr>').join('')+'</tbody></table>';
function renderStudio({runtime=null,valuationCase=null,mode='OWNER',locale='ar-SA',generatedAt=new Date()}={}){
 if(!MODES.includes(mode))throw Error('STUDIO_MODE_INVALID');
 const ar=locale!=='en',r=buildPersonalResearchReport({runtime,valuationCase,generatedAt});
 const label=(a,b)=>ar?a:b,fmt=v=>typeof v==='number'&&Number.isFinite(v)?new Intl.NumberFormat(ar?'ar-SA':'en-US',{maximumFractionDigits:2}).format(v)+' '+(r.currency||''):'—';
 const rows=[[label('مرجع الحالة','Case'),r.caseId],[label('نوع الأصل','Asset class'),r.assetClass],[label('أساس القيمة','Basis'),r.basis],[label('تاريخ التقييم','Valuation date'),r.valuationDate],[label('حالة الدراسة','Study status'),r.reportStatus],[label('تاريخ إنشاء المسودة','Generated'),r.generatedAt]];
 const body='<h2>'+label('الملخص التنفيذي','Executive summary')+'</h2><p class="metric">'+h(fmt(r.preliminaryValue))+'</p>'+table(rows)+'<h2>'+label('نتائج المنهجيات','Method indications')+'</h2>'+table(r.methods.map(m=>[m.method,fmt(m.diagnosticValue)+' | '+m.state+' | '+(m.reasonCode||'—')]))+'<h2>'+label('القيود والملاحظات','Limitations and warnings')+'</h2><ul>'+r.warnings.map(w=>'<li>'+h(w)+'</li>').join('')+'</ul>'+(mode==='TECHNICAL'?'<h2>'+label('الأثر التدقيقي','Audit trace')+'</h2>'+table(r.methods.map(m=>[m.method,m.evidenceGaps.join(', ')||'—'])):'')+'<p><small>SHA-256: '+h(r.reportHashSha256)+'</small></p>';
 return {html:wrap(label('دراسة عقارية بحثية','Real estate research study'),body,locale),report:r};
}
function renderExternalReview(inputs,{locale='ar-SA'}={}){
 const r=reviewExternalReport(inputs),ar=locale!=='en',l=(a,b)=>ar?a:b,fmt=v=>new Intl.NumberFormat(ar?'ar-SA':'en-US',{maximumFractionDigits:2}).format(v);
 const body='<h2>'+l('ملخص مراجعة تقرير خارجي','External report review summary')+'</h2>'+table([[l('مرجع التقرير','Report reference'),r.reportRef],[l('تاريخ التقييم','Valuation date'),r.valuationDate],[l('السعر المرجح قبل التقريب النهائي','Weighted land rate before final rounding'),new Intl.NumberFormat(ar?'ar-SA':'en-US',{maximumFractionDigits:8}).format(r.weightedBeforeFinalRoundingSar)],[l('السعر المرجح حسابيًا','Replayed weighted land rate'),fmt(r.weightedRateSar)],[l('السعر المعتمد خارجيًا','Externally adopted rate'),fmt(r.adoptedRateSar)],[l('أثر فرق السعر قبل تقريب سعر المتر','Land rate impact before rate rounding'),fmt(r.landRateImpactSar)],[l('قاعدة التقريب','Rounding policy'),l('تسويات سعر المتر إلى هللتين عشريتين؛ الأوزان قبل التقريب النهائي؛ الأثر محسوب من السعر المرجح غير المقرب.','Adjusted rates rounded to halalas; weights before final rounding; impact based on unrounded weighted rate.')],[l('تكلفة المكونات','Component cost'),fmt(r.componentCostSar)],[l('الإهلاك بالدقة الكاملة','Full-precision physical depreciation'),fmt(r.fullPrecisionPhysicalDepSar)],[l('القيمة المعلنة','Declared value'),fmt(r.declaredFinalValueSar)],[l('إعادة احتساب القيمة المعلنة','Replayed declared value'),fmt(r.replayedFinalValueSar)]])+'<h2>'+l('التسويات المتتابعة','Sequential adjustments')+'</h2>'+table(r.comparables.map(c=>[c.id+' / p.'+c.page,fmt(c.rawRateSar)+' → '+fmt(c.firstRateSar)+' → '+fmt(c.adjustedRateSar)+' | '+fmt(c.contributionSar)]))+'<h2>'+l('مكونات التكلفة','Cost components')+'</h2>'+table(r.components.map(c=>[c.id+' / p.'+c.page,fmt(c.quantity)+' '+c.unit+' × '+fmt(c.unitCostSar)+' = '+fmt(c.costSar)]))+'<h2>'+l('الملاحظات','Findings')+'</h2>'+table(r.issues.map(i=>[i.severity+' / '+i.ref,issueLabel(i.code,locale)]))+'<p>'+l('المصدر منقول يدويًا وغير متحقق مستقلًا. لا يعتمد أي رقم في المحرك الأساسي.','Manually transcribed inputs; independently unverified. No canonical model adoption.')+'</p><small>SHA-256: '+h(r.reviewHashSha256)+'</small>';
 return {html:wrap(l('مراجعة حسابية لتقرير خارجي','External report arithmetic review'),body,locale),report:r};
}
module.exports={MODES,issueLabel,renderStudio,renderExternalReview};
