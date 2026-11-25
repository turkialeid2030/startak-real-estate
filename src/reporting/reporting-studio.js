'use strict';
const {buildPersonalResearchReport}=require('../app/personal-investment-research-report');
const {reviewExternalReport}=require('./external-report-review');
const {VERSION:LAND_VERSION,reviewVacantLand}=require('./vacant-land-report-review');
const {VERSION:HISTORY_VERSION,compareReportedHistory}=require('./property-lifecycle-review');
const {VERSION:REDEVELOPMENT_VERSION,evaluateRedevelopment}=require('./owner-redevelopment-research');
const {sha256Hex}=require('../crypto/sha256');
const {VERSION:ESG_VERSION,screenEsg}=require('./property-esg-screening');
const {VERSION:RENT_VERSION,evaluateRentalIntelligence}=require('./saudi-rental-intelligence');
const MODES=Object.freeze(['OWNER','TECHNICAL']);
const h=v=>String(v??'—').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const LABELS={
 RENT_SOURCE_CONFLICT:['تعارض سجلات المقارنات الإيجارية','Conflicting rental source records'],
 RENT_INSUFFICIENT_EXECUTED_EVIDENCE:['أدلة العقود المنفذة غير كافية أو متعارضة','Insufficient or conflicting executed lease evidence'],
 RENT_LOCAL_DECLARED_EVIDENCE_ONLY:['بيانات محلية مصرح بها وغير متحققة مستقلًا','Local declared inputs; not independently verified'],
 RENT_LEGAL_LIMIT_NOT_DETERMINED:['الأجرة النظامية لم تحدد','Legal rent limit not determined'],
 ESG_FUTURE_SOURCE:['مصدر لاحق لتاريخ التقييم','Source after valuation date'],
 ESG_STALE_SOURCE_REVIEW:['مصدر قديم يحتاج مراجعة','Stale source needs review'],
 ESG_EXPIRED_SOURCE:['انتهاء صلاحية المصدر','Expired source'],
 ESG_ASSUMED_SOURCE:['مصدر افتراضي','Assumed source'],
 ESG_UNKNOWN_FACTOR:['عامل غير محسوم','Unknown factor'],
 ESG_MISSING_FACTOR:['عامل لم يدخل','Missing factor'],
 ESG_MATERIALITY_REVIEW_REQUIRED:['الأهمية تحتاج مراجعة مستقلة','Materiality requires independent review'],
 REDEVELOPMENT_ASSUMPTIONS_UNVERIFIED:['افتراضات التطوير غير متحققة مستقلًا','Redevelopment assumptions independently unverified'],
 REPORT_CHRONOLOGY_CONFLICT:['تعارض تسلسل تواريخ التقرير','Report chronology conflict'],
 VALUATION_DATE_CONFLICT:['اختلاف تاريخ التقييم بين الأقسام','Conflicting valuation dates'],
 BUILDING_RIGHTS_UNVERIFIED:['حقوق البناء غير متحققة','Building rights unverified'],
 ADJUSTMENT_BASIS_MISSING:['مبرر التسوية غير متوفر','Adjustment evidence missing'],
 EXECUTED_NEGOTIATION_REVIEW:['راجع خصم التفاوض لصفقة منفذة','Review negotiation on executed transaction'],
 OBSERVATION_DATE_UNKNOWN:['تاريخ الرصد غير معروف','Observation date unknown'],
 POST_VALUATION_OBSERVATION:['رصد لاحق لتاريخ التقييم','Post-valuation observation'],
 OBSERVATION_BEFORE_RECORD_DATE:['تاريخ الرصد يسبق تاريخ السجل','Observation before record date'],
 NO_EXECUTED_COMPARABLES:['لا توجد صفقات مصرح بأنها منفذة','No declared executed comparables'],
 HISTORY_IDENTITY_UNRESOLVED:['هوية الأصل غير محسومة','Property identity unresolved'],
 HISTORY_NONCOMPARABLE_BASES:['اختلاف حالة الأصل أو أسس التقييم','Different property state or valuation bases'],
 HISTORY_COMPONENT_SUM_MISMATCH:['فرق مجموع مكونات القيمة','Reported component sum mismatch'],
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
 if(inputs?.version===RENT_VERSION)return renderRentalIntelligence(inputs,{locale});
 if(inputs?.version===ESG_VERSION)return renderEsgScreening(inputs,{locale});
 if(inputs?.version===REDEVELOPMENT_VERSION)return renderRedevelopment(inputs,{locale});
 if(inputs?.version===LAND_VERSION||inputs?.version===HISTORY_VERSION)return renderExtendedReview(inputs,{locale});
 const r=reviewExternalReport(inputs),ar=locale!=='en',l=(a,b)=>ar?a:b,fmt=v=>new Intl.NumberFormat(ar?'ar-SA':'en-US',{maximumFractionDigits:2}).format(v);
 const body='<h2>'+l('ملخص مراجعة تقرير خارجي','External report review summary')+'</h2>'+table([[l('مرجع التقرير','Report reference'),r.reportRef],[l('تاريخ التقييم','Valuation date'),r.valuationDate],[l('السعر المرجح قبل التقريب النهائي','Weighted land rate before final rounding'),new Intl.NumberFormat(ar?'ar-SA':'en-US',{maximumFractionDigits:8}).format(r.weightedBeforeFinalRoundingSar)],[l('السعر المرجح حسابيًا','Replayed weighted land rate'),fmt(r.weightedRateSar)],[l('السعر المعتمد خارجيًا','Externally adopted rate'),fmt(r.adoptedRateSar)],[l('أثر فرق السعر قبل تقريب سعر المتر','Land rate impact before rate rounding'),fmt(r.landRateImpactSar)],[l('قاعدة التقريب','Rounding policy'),l('تسويات سعر المتر إلى هللتين عشريتين؛ الأوزان قبل التقريب النهائي؛ الأثر محسوب من السعر المرجح غير المقرب.','Adjusted rates rounded to halalas; weights before final rounding; impact based on unrounded weighted rate.')],[l('تكلفة المكونات','Component cost'),fmt(r.componentCostSar)],[l('الإهلاك بالدقة الكاملة','Full-precision physical depreciation'),fmt(r.fullPrecisionPhysicalDepSar)],[l('القيمة المعلنة','Declared value'),fmt(r.declaredFinalValueSar)],[l('إعادة احتساب القيمة المعلنة','Replayed declared value'),fmt(r.replayedFinalValueSar)]])+'<h2>'+l('التسويات المتتابعة','Sequential adjustments')+'</h2>'+table(r.comparables.map(c=>[c.id+' / p.'+c.page,fmt(c.rawRateSar)+' → '+fmt(c.firstRateSar)+' → '+fmt(c.adjustedRateSar)+' | '+fmt(c.contributionSar)]))+'<h2>'+l('مكونات التكلفة','Cost components')+'</h2>'+table(r.components.map(c=>[c.id+' / p.'+c.page,fmt(c.quantity)+' '+c.unit+' × '+fmt(c.unitCostSar)+' = '+fmt(c.costSar)]))+'<h2>'+l('الملاحظات','Findings')+'</h2>'+table(r.issues.map(i=>[i.severity+' / '+i.ref,issueLabel(i.code,locale)]))+'<p>'+l('المصدر منقول يدويًا وغير متحقق مستقلًا. لا يعتمد أي رقم في المحرك الأساسي.','Manually transcribed inputs; independently unverified. No canonical model adoption.')+'</p><small>SHA-256: '+h(r.reviewHashSha256)+'</small>';
 return {html:wrap(l('مراجعة حسابية لتقرير خارجي','External report arithmetic review'),body,locale),report:r};
}
function renderExtendedReview(inputs,{locale='ar-SA'}={}){
 const ar=locale!=='en',l=(a,b)=>ar?a:b,fmt=v=>v===null?'—':new Intl.NumberFormat(ar?'ar-SA':'en-US',{maximumFractionDigits:8}).format(v);
 const land=inputs.version===LAND_VERSION,r=land?reviewVacantLand(inputs):compareReportedHistory(inputs);
 const title=land?l('مراجعة تقرير أرض فضاء','Vacant land report review'):l('مقارنة تقارير الأصل عبر الزمن','Property report history comparison');
 let body;
 if(land){
 body=table([[l('مرجع التقرير','Report reference'),r.reportRef],[l('تاريخ المعاينة','Inspection date'),r.inspectionDate],[l('تاريخ التقييم','Valuation date'),r.valuationDate],[l('تاريخ الإصدار','Issue date'),r.issueDate],[l('تاريخ جدول التسويات','Worksheet date'),r.worksheetDate],[l('تاريخ القيود','Limitations date'),r.limitationsDate],[l('السعر المرجح قبل التقريب','Weighted rate before rounding'),fmt(r.weightedBeforeFinalRoundingSar)],[l('القيمة قبل اعتماد السعر المقرب','Weighted land value'),fmt(r.weightedLandValueSar)],[l('السعر المعتمد','Adopted rate'),fmt(r.adoptedRateSar)],[l('أثر فرق السعر','Land rate impact'),fmt(r.landRateImpactSar)],[l('القيمة المعلنة','Declared value'),fmt(r.declaredFinalValueSar)],[l('القيمة المعاد احتسابها','Replayed declared value'),fmt(r.replayedFinalValueSar)],[l('أساس حقوق البناء','Planning evidence'),r.planningEvidence+' / '+r.planningRef],[l('الأدوار المفترضة','Assumed floors'),fmt(r.assumedFloors)]])
 +'<h2>'+l('المقارنات والتسويات','Comparables and adjustments')+'</h2>'+table(r.comparables.map(c=>[c.id+' / '+c.transactionStatus+' / p.'+c.page,fmt(c.rawRateSar)+' → '+fmt(c.firstRateSar)+' → '+fmt(c.adjustedRateSar)+' | '+c.date+' | '+c.sourceRef+' | '+c.adjustments.map(a=>a.category+': '+fmt(a.fraction*100)+'% / '+a.evidenceRef).join(' ; ')]))
 +'<h2>'+l('الحساسية المصرح بها — ليست فترة ثقة إحصائية','Declared sensitivity — not a confidence interval')+'</h2>'+table([[l('الحد الأدنى','Low'),fmt(r.uncertainty.lowSar)],[l('الحد الأعلى','High'),fmt(r.uncertainty.highSar)],[l('مرجع الافتراض','Assumption reference'),r.uncertainty.sourceRef]]);
 }else{
 body=table([[l('مرجع الأصل','Property reference'),r.propertyRef],[l('مرجع الهوية','Identity reference'),r.identityEvidenceRef],[l('مرجع التحول','Transition reference'),r.transitionEvidenceRef],[l('التقييم السابق','Before'),r.before.valuationDate+' / '+r.before.state+' / '+r.before.basis+' / '+r.before.purpose+' / '+r.before.propertyRight+' / '+r.before.method+' / '+fmt(r.before.reportedValueSar)],[l('التقييم اللاحق','After'),r.after.valuationDate+' / '+r.after.state+' / '+r.after.basis+' / '+r.after.purpose+' / '+r.after.propertyRight+' / '+r.after.method+' / '+fmt(r.after.reportedValueSar)],[l('فرق القيم المعلنة','Reported value difference'),fmt(r.reportedDeltaSar)],[l('نسبة الفرق المعلن','Reported difference percentage'),r.reportedDeltaFraction===null?'—':fmt(r.reportedDeltaFraction*100)+'%'],[l('الحقول المتغيرة','Changed fields'),r.changedFields.join(', ')]])
 +'<p>'+l('فرق القيم لا يمثل نمو السوق أو عائد الاستثمار، ولم يتم إثبات الهوية أو التحول مستقلًا.','Reported difference is not market growth or investment return; identity and transition not independently verified.')+'</p>';
 }
 body+='<h2>'+l('الملاحظات','Findings')+'</h2>'+table(r.issues.map(i=>[i.severity+' / '+i.ref,issueLabel(i.code,locale)]))+'<p>'+l('مراجعة تشخيصية لبيانات منقولة؛ لا اعتماد للقيمة أو الحقوق أو الصفقات.','Diagnostic review of transcribed inputs; no certification of value, rights or transactions.')+'</p><small>SHA-256: '+h(r.reviewHashSha256)+'</small>';
 return {html:wrap(title,body,locale),report:r};
}
function renderRedevelopment(inputs,{locale='ar-SA'}={}){
 const r=evaluateRedevelopment(inputs),ar=locale!=='en',l=(a,b)=>ar?a:b,fmt=v=>v===null?'—':new Intl.NumberFormat(ar?'ar-SA':'en-US',{maximumFractionDigits:2}).format(v);
 const title=l('جدوى الاحتفاظ والبيع وإعادة التطوير','Hold, sell and redevelopment feasibility');
 let body=table([[l('مرجع العقار','Property reference'),r.propertyRef],[l('تاريخ الدراسة','Study date'),r.valuationDate],[l('الحالة الحالية','Current state'),r.currentState],[l('مدة المقارنة','Common horizon'),r.years],[l('معدل الخصم','Discount rate'),fmt(r.discountRate*100)+'%'],[l('سنة الهدم أو بدء المشروع','Demolition or start year'),r.demolitionYear],[l('سنة اكتمال الإنشاء','Completion year'),r.completionYear],[l('حالة دليل التخطيط','Planning evidence'),r.planningStatus]])
 +'<h2>'+l('مقارنة البدائل بالقيمة الحالية','Present value comparison')+'</h2>'+table([[l('البيع الآن — صافي المتحصل','Sell now — net proceeds'),fmt(r.sell.presentValueSar)],[l('الاحتفاظ — القيمة الحالية','Retain — present value'),fmt(r.retain.presentValueSar)],[l('إعادة التطوير — القيمة الحالية','Redevelop — present value'),fmt(r.redevelop.presentValueSar)],[l('فرق التطوير مقابل الاحتفاظ','Redevelopment vs retain'),fmt(r.redevelopmentIncrementVsRetainSar)]]);
 for(const [name,m] of [[l('الاحتفاظ','Retain'),r.retain],[l('إعادة التطوير','Redevelop'),r.redevelop]]){
 body+='<h2>'+h(name)+'</h2>'+table([[l('صافي القيمة الحالية مقابل البيع الآن','Incremental NPV vs sell now'),fmt(m.incrementalNpvSar)],[l('صافي القيمة الحالية تحت الضغط مقابل البيع','Stress incremental NPV vs sell now'),fmt(m.stressIncrementalNpvSar)],[l('العائد على تكلفة الفرصة','Opportunity-cost IRR'),m.opportunityCostIrr===null?'—':fmt(m.opportunityCostIrr*100)+'%'],[l('موثوقية العائد','IRR reliability'),m.irrReliability]])
 +'<table><thead><tr>'+[l('السنة','Year'),l('الإيجار','Rent'),l('التشغيل','OPEX'),l('الصيانة الرأسمالية','CAPEX'),l('الهدم','Demolition'),l('الإنشاء','Construction'),l('تكاليف أخرى','Other cost'),l('صافي البيع','Net exit'),l('التدفق','Cashflow'),l('تدفق الضغط','Stress cashflow')].map(v=>'<th>'+h(v)+'</th>').join('')+'</tr></thead><tbody>'+m.periods.map(p=>'<tr>'+[p.year,p.propertyRentSar,p.ownerOpexSar,p.sustainingCapexSar,p.demolitionSar,p.constructionSar,p.otherDevelopmentSar,p.netExitSar,p.cashflowSar,p.stressCashflowSar].map(v=>'<td>'+h(fmt(v))+'</td>').join('')+'</tr>').join('')+'</tbody></table>';
 }
 body+='<h2>'+l('المصادر والافتراضات','Sources and assumptions')+'</h2>'+table(Object.entries(r.references))+'<h2>'+l('نطاق الضغط','Stress assumptions')+'</h2>'+table([[l('انخفاض الإيجار','Rent reduction'),fmt(r.stress.incomeReduction*100)+'%'],[l('ارتفاع التكلفة','Cost increase'),fmt(r.stress.costIncrease*100)+'%'],[l('انخفاض صافي التخارج','Exit reduction'),fmt(r.stress.exitReduction*100)+'%']])+'<h2>'+l('الملاحظات','Findings')+'</h2>'+table(r.issues.map(i=>[i.severity,issueLabel(i.code,locale)]))+'<p>'+l('نموذج للمالك الحالي قبل التمويل والضرائب. البيع الآن تكلفة فرصة بديلة، وليس استحواذًا جديدًا. لا يثبت جدوى نظامية أو إذن هدم أو قرار تطوير.','Existing-owner model before financing and tax. Sell-now proceeds are an opportunity cost, not a new acquisition. No legal feasibility, demolition permit or development decision established.')+'</p><small>SHA-256: '+h(r.reviewHashSha256)+'</small>';
 return {html:wrap(title,body,locale),report:r};
}
const ESG_LABELS={
 ENVIRONMENTAL:['البيئة','Environmental'],SOCIAL:['الاجتماعية','Social'],GOVERNANCE:['الحوكمة','Governance'],
 ENERGY_PERFORMANCE:['أداء الطاقة','Energy performance'],WATER_EFFICIENCY:['كفاءة المياه','Water efficiency'],GHG_EMISSIONS:['انبعاثات غازات الدفيئة','Greenhouse gas emissions'],CLIMATE_PHYSICAL_RISK:['المخاطر المناخية المادية','Physical climate risk'],RESILIENCE_ADAPTATION:['المرونة والتكيف','Resilience and adaptation'],INDOOR_ENVIRONMENT_QUALITY:['جودة البيئة الداخلية','Indoor environmental quality'],ACCESSIBILITY_INCLUSION:['الوصول والشمول','Accessibility and inclusion'],HEALTH_SAFETY:['الصحة والسلامة','Health and safety'],COMMUNITY_IMPACT:['الأثر المجتمعي','Community impact'],GOVERNANCE_COMPLIANCE:['الحوكمة والامتثال','Governance and compliance'],CERTIFICATION_RATING:['الشهادات والتصنيفات','Certifications and ratings'],OTHER:['أخرى','Other'],
 UNKNOWN:['غير معلوم','Unknown'],NOT_APPLICABLE:['غير منطبق وفق التصريح','Declared not applicable'],NOT_MATERIAL:['غير جوهري وفق التصريح','Declared not material'],POTENTIALLY_MATERIAL:['محتمل الأهمية','Potentially material'],MATERIAL:['جوهري وفق التصريح','Declared material'],
 RENT:['الإيجار','Rent'],OCCUPANCY:['الإشغال','Occupancy'],OWNER_OPEX:['مصروفات المالك','Owner OPEX'],CAPEX:['النفقات الرأسمالية','CAPEX'],MARKETABILITY:['قابلية التسويق','Marketability'],LEGAL_OR_SAFETY_RISK:['المخاطر النظامية أو السلامة','Legal or safety risk']
};
function esgLabel(code,locale){return ESG_LABELS[code]?.[locale==='en'?1:0]||code;}
function renderEsgScreening(inputs,{locale='ar-SA'}={}){
 const r=screenEsg(inputs),ar=locale!=='en',l=(a,b)=>ar?a:b,lab=k=>esgLabel(k,locale);
 const body=table([[l('مرجع الأصل','Property reference'),r.propertyRef],[l('تاريخ التقييم','Valuation date'),r.valuationDate],[l('عوامل غير مدخلة','Missing factors'),r.missingFactorCount],[l('عوامل تحتاج متابعة في الفحص','Factors flagged for screening follow-up'),r.reviewRequiredCount],...Object.entries(r.counts).map(([k,v])=>[lab(k),v])])
 +'<p class="notice">'+l('جميع النتائج تصريحات غير متحققة مستقلًا، ولا تمثل درجة استدامة أو شهادة امتثال أو أثرًا ماليًا معتمدًا. حد مراجعة قدم المصدر في هذا الفحص 365 يومًا وليس متطلبًا مهنيًا عامًا.','All outcomes are independently unverified declarations, not a sustainability score, compliance certificate or established value effect. The 365-day screening age flag is not a universal professional requirement.')+'</p>'
 +'<h2>'+l('العوامل والأدلة المصرح بها','Declared factors and evidence')+'</h2><table><thead><tr>'+[l('العامل','Factor'),l('الحالة','Outcome'),l('المبرر','Rationale'),l('المصدر والتاريخ والصلاحية','Source, date, validity'),l('قنوات التأثير المحتملة','Potential impact channels')].map(v=>'<th>'+h(v)+'</th>').join('')+'</tr></thead><tbody>'+r.factors.map(f=>'<tr>'+[lab(f.pillar)+' / '+lab(f.factor),lab(f.outcome),f.rationale,[f.sourceClass,f.sourceRef,f.sourceDate,f.validTo].map(v=>v??'—').join(' / '),f.impactChannels.map(lab).join(' / ')||'—'].map(v=>'<td>'+h(v)+'</td>').join('')+'</tr>').join('')+'</tbody></table>'
 +'<h2>'+l('الملاحظات','Findings')+'</h2>'+table(r.issues.map(i=>[lab(i.ref)+' / '+i.severity,issueLabel(i.code,locale)]))+'<p>'+l('لا يُعدل هذا الفحص قيمة الأصل ولا مدخلات المحرك المالي. المسار المهني للتحقق من الأدلة والأهمية وربطها بالسوق مستقل.','This screening does not adjust property value or financial model inputs. Professional evidence, materiality and market linkage are separate.')+'</p><small>SHA-256: '+h(r.reviewHashSha256)+'</small>';
 return {html:wrap(l('الفحص البحثي للعوامل البيئية والاجتماعية والحوكمة','Property ESG research screening'),body,locale),report:r};
}
function renderRentalIntelligence(inputs,{locale='ar-SA'}={}){
 const r=evaluateRentalIntelligence(inputs),ar=locale!=='en',l=(a,b)=>ar?a:b,fmt=v=>v===null||v===undefined?'—':new Intl.NumberFormat(ar?'ar-SA':'en-US',{maximumFractionDigits:2}).format(v);
 const metrics=m=>[[l('الإيجار السنوي دون الضريبة','Annual rent ex VAT'),fmt(m?.annualRentExVatSar)],[l('الإيجار الشهري دون الضريبة','Monthly rent ex VAT'),fmt(m?.monthlyRentExVatSar)],[l('ريال للمتر سنويًا','SAR per sqm per year'),fmt(m?.rateSarPerSqmYear)],[l('أدنى مؤشر من المقارنات المعدلة','Observed adjusted low'),fmt(m?.observedAdjustedMinAnnualSar)],[l('أعلى مؤشر من المقارنات المعدلة','Observed adjusted high'),fmt(m?.observedAdjustedMaxAnnualSar)],[l('الإيجار بعد الشغور المفترض','Occupied rent'),fmt(m?.occupiedRentSar)],[l('التحصيل المتوقع قبل المصروفات','Expected collections before expenses'),fmt(m?.expectedCollectionsSar)],[l('الفرق عن الإيجار التعاقدي المدخل','Gap vs entered contract rent'),fmt(m?.contractGapSar)]];
 let body=table([[l('مرجع الأصل','Property reference'),r.propertyRef],[l('المدينة','City'),r.city],[l('الحي','District'),r.district],[l('تاريخ التقدير','As-of date'),r.valuationDate],[l('حالة التقدير','Research status'),r.total?l('مؤشر بحثي غير متحقق','Unverified research indication'):l('معلق لعدم كفاية الأدلة أو تعارضها','Held for insufficient or conflicting evidence')],...metrics(r.total)])
 +'<p class="notice">'+l('الإيجار سنوي اسمي وفق بيانات الأجرة فقط، وليس الإيجار الفعلي بعد جميع الحوافز. لا يوجد اتصال حي بالمصادر. جميع العقود والمقارنات مصرح بها من المدخلات ولم تتحقق المنصة منها. نطاق القيم هو أدنى وأعلى المقارنات المعدلة وليس نطاق ثقة إحصائيًا. لا يتم تحديد الأجرة النظامية أو الضريبة المطبقة على الأصل.','Nominal annualized rent-only amount, not effective lease rent after all incentives. No live source connection. All lease and comparable records are user-declared, not authenticated. Range is observed adjusted min/max, not a statistical confidence interval. No legal rent or applicable property VAT rate is established.')+'</p>';
 for(const s of r.segments){
 body+='<h2>'+h(s.id+' / '+s.kind)+'</h2>'+table([[l('التصنيف الفرعي','Subtype'),s.subtype],[l('أساس المساحة','Area basis'),s.areaBasis],[l('المساحة الإجمالية','Total area'),fmt(s.totalAreaSqm)],[l('عدد الوحدات','Unit count'),s.unitCount],[l('عدد العقود المصرح بتنفيذها','Declared executed leases'),s.executedCount],[l('عدد العروض','Asking offers'),s.askingCount],[l('وسيط سعر العرض دون تسوية','Unadjusted asking median'),fmt(s.offerMedianRateSar)],...metrics(s.result),[l('إيجار الوحدة السنوي','Annual rent per unit'),fmt(s.result?.annualRentPerUnitSar)],[l('سعر المتر الشهري','SAR per sqm per month'),fmt(s.result?.rateSarPerSqmMonth)]])
 +'<h3>'+l('أدلة المقارنة والتسويات','Comparable evidence and adjustments')+'</h3><table><thead><tr>'+[l('مرجع العقد والمصدر','Contract and source'),l('التاريخ والرصد','Date and observed'),l('الإيجار السنوي دون الضريبة والمساحة','Annual rent ex VAT and area'),l('سعر المتر قبل وبعد التسوية','Raw and adjusted rate'),l('حالة الضريبة والتسويات','VAT declaration and adjustments')].map(v=>'<th>'+h(v)+'</th>').join('')+'</tr></thead><tbody>'+[...s.executed,...s.offers].map(c=>'<tr>'+[c.contractRef+' / '+c.status+' / '+c.sourceUrl+' / '+c.sourceRecordId,c.date+' / '+c.observedDate,fmt(c.annualRentExVatSar)+' / '+fmt(c.areaSqm),fmt(c.rawRateSar)+' → '+fmt(c.adjustedRateSar),c.vatBasis+' / '+(c.vatRef??'—')+' / '+c.adjustments.map(a=>a.category+': '+fmt(a.fraction*100)+'% / '+a.evidenceRef).join('; ')].map(v=>'<td>'+h(v)+'</td>').join('')+'</tr>').join('')+'</tbody></table><h3>'+l('أسباب الاستبعاد','Exclusions')+'</h3>'+table(Object.entries(s.excluded));
 }
 body+='<h2>'+l('الملاحظات','Findings')+'</h2>'+table(r.issues.map(i=>[i.ref+' / '+i.severity,issueLabel(i.code,locale)]))+'<small>SHA-256: '+h(r.reviewHashSha256)+'</small>';
 return {html:wrap(l('تقدير بحثي مستقل للقيمة الإيجارية','Independent rental research indication'),body,locale),report:r};
}
module.exports={MODES,issueLabel,esgLabel,renderStudio,renderExternalReview};
