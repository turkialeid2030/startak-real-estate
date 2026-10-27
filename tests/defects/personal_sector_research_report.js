'use strict';
const assert=require('node:assert/strict');
const {sha256Hex}=require('../../src/crypto/sha256');
const {ASSET_CLASS}=require('../../src/project-model/project-profile');
const {VALUATION_METHOD}=require('../../src/valuation-intelligence/contracts');
const {VERSION,PURPOSE,calculatePersonalSectorCase,buildPersonalSectorResearchReport,
 verifyPersonalSectorResearchReport,renderPersonalSectorResearchHtml}=
 require('../../src/valuation-intelligence/personal-sector-research-report');
let checks=0;
function eq(a,b,label){assert.deepEqual(a,b,label);checks++;}
const base={
 assetClass:'OFFICE',
 subject:{city:'الرياض',district:'الملقا',subtype:'مكاتب',date:'2026-10-25',
  area:'١٬٠٠٠',right:'FREEHOLD'},
 methods:{income:true,cost:true,market:true},
 inc:{gross:'١٬٠٠٠٬٠٠٠',opex:'٢٠٠٬٠٠٠',cap:'٠٫٠٨',
  expenseTreatment:'ACTUAL_LANDLORD_OPEX',realEstateOnly:false,groundLease:false,sharedCosts:false},
 cost:{land:'٤٬٠٠٠٬٠٠٠',replacement:'٨٬٠٠٠٬٠٠٠',depreciation:'٠٫٢٥',excludesBusiness:false},
 comparables:[1,2,3].map(i=>({id:'SALE-'+i,city:'الرياض',district:'الملقا',
  subtype:'مكاتب',right:'FREEHOLD',date:'2026-09-0'+i,
  unitValue:'١٠٬٠٠٠',source:'MOJ-DOC-'+i,unit:'SQM',saleKind:'EXECUTED_SALE'})),
 marketOptions:{unit:'SQM',quantity:'',businessExcluded:false,mixedAllocated:false},
 policy:{maxDispersion:'٠٫٢',incomeWeight:'٠٫٤',costWeight:'٠٫٣',marketWeight:'٠٫٣'},
};
const time='2026-10-26T12:00:00.000Z';
eq(VERSION,'PERSONAL_SECTOR_RESEARCH_REPORT_V1');
eq(PURPOSE,'PERSONAL_NON_CERTIFIED_SECTOR_RESEARCH');
const computed=calculatePersonalSectorCase(base);
eq(computed.status,'MULTI_METHOD_RESEARCH_ONLY');
eq(computed.methods.length,3);
eq(computed.provisionalReconciledAmountSar,10000000);
const report=buildPersonalSectorResearchReport(base,{generatedAt:time});
eq(verifyPersonalSectorResearchReport(report),true);
eq(report.result.status,computed.status);
eq(report.result.provisionalReconciledAmountSar,10000000);
eq(report.professionalAppraisalClaim,false);
eq(report.transactionAuthorityClaim,false);
eq(report.independentlyVerified,false);
eq(report.studyInputs.comparables[0].saleKind,'EXECUTED_SALE');
eq(report.reportHashSha256.length,64);
eq(report.inputFingerprintSha256.length,64);
const html=renderPersonalSectorResearchHtml(report);
assert.ok(html.includes('lang="ar" dir="rtl"')&&html.includes('غير معتمد'));checks++;
assert.ok(html.includes('MOJ-DOC-1')&&html.includes('EXECUTED_SALE'));checks++;
assert.ok(html.includes('الحق العقاري')&&html.includes('نوع العقار')&&
 html.includes('وحدة المقارنة')&&html.includes('حالة الصفقة')&&
 html.includes('مرجع المصدر المصرح'),'printable comparable audit has all match dimensions');checks++;
assert.ok(html.includes('FREEHOLD')&&html.includes('SQM')&&
 html.includes('الملقا')&&html.includes('مكاتب'),'printable sale includes district/right/unit/subtype');checks++;
assert.ok(html.includes('سياسة تحمل مصروفات العقار')&&
 html.includes('فصل دخل العقار عن النشاط')&&
 html.includes('استبعاد معدات وأعمال النشاط')&&
 html.includes('حد تشتت الطرق')&&html.includes('وزن طريقة الدخل'),
 'printable method declaration must not omit important assumption factors');checks++;
assert.ok(html.includes('الترجيح الحسابي افتراضي')&&
 html.includes('INDEPENDENT_MARKET_AND_SPECIALIST_EVIDENCE_STILL_REQUIRED'),
 'Arabic gate reason and stable evidence code printed together');checks++;
assert.ok(html.includes('غير مثبت')&&html.includes('إقرارات ومدخلات المستخدم'),
 'report must never invent a verified market-value basis or authenticated data source');checks++;
assert.ok(html.includes('Content-Security-Policy')&&!html.includes('<script'));checks++;
const english=renderPersonalSectorResearchHtml(report,{locale:'en'});
assert.ok(english.includes('lang="en" dir="ltr"')&&english.includes('unverified'));checks++;
assert.ok(english.includes('District')&&english.includes('Declared status')&&
 english.includes('Operating expense treatment')&&english.includes('Calculation model version')&&
 english.includes('NOT_ESTABLISHED'),'English printable audit must retain all source and valuation-basis qualifiers');checks++;
const duplicate=buildPersonalSectorResearchReport(base,{generatedAt:time});
eq(duplicate.reportHashSha256,report.reportHashSha256);
const alternate=structuredClone(base);alternate.inc.gross='١٬١٠٠٬٠٠٠';
eq(buildPersonalSectorResearchReport(alternate,{generatedAt:time}).reportHashSha256===report.reportHashSha256,false);
const tampered=structuredClone(report);
tampered.result.provisionalReconciledAmountSar=9999999999;
eq(verifyPersonalSectorResearchReport(tampered),false);
const forged=structuredClone(report);
forged.result.provisionalReconciledAmountSar=9999999999;
const {reportHashSha256:discard,...core}=forged;
forged.reportHashSha256=sha256Hex(JSON.stringify(core));
eq(verifyPersonalSectorResearchReport(forged),false,'recomputed model must reject forged numeric result even with new digest');
assert.throws(()=>renderPersonalSectorResearchHtml(tampered),/REPORT_DIGEST_OR_RECOMPUTATION_INVALID/);checks++;
const asking=structuredClone(base);
asking.comparables[2].saleKind='ASKING_SALE';
const askingReport=buildPersonalSectorResearchReport(asking,{generatedAt:time});
eq(askingReport.result.status,'HOLD_INPUT_OR_SECTOR_POLICY');
eq(askingReport.result.methods.length,0);
eq(askingReport.result.provisionalReconciledAmountSar,null);
eq(verifyPersonalSectorResearchReport(askingReport),true);
assert.ok(renderPersonalSectorResearchHtml(askingReport).includes('ASKING_SALE'));checks++;
assert.ok(renderPersonalSectorResearchHtml(askingReport).includes('الصفقات غير متطابقة')&&
 renderPersonalSectorResearchHtml(askingReport).includes('MARKET_COMPARABLE_IDENTITY_DATE_OR_STATUS_INVALID'),
 'Fail-closed asking sale report displays a readable Arabic reason AND the audit code');checks++;
const undefinedSale=structuredClone(base);undefinedSale.comparables[1].saleKind='';
eq(buildPersonalSectorResearchReport(undefinedSale,{generatedAt:time}).result.status,'HOLD_INPUT_OR_SECTOR_POLICY');
const xss=structuredClone(base);xss.subject.subtype='<svg onload=alert(1)>';
const safe=renderPersonalSectorResearchHtml(buildPersonalSectorResearchReport(xss,{generatedAt:time}));
const sourceMarkup=structuredClone(base);
sourceMarkup.comparables[0].source='<img src=x onerror=alert(2)>';
const safeComparable=renderPersonalSectorResearchHtml(buildPersonalSectorResearchReport(sourceMarkup,{generatedAt:time}));
assert.ok(!safeComparable.includes('<img')&&safeComparable.includes('&lt;img src=x onerror=alert(2)&gt;'),
 'Expanded printable comparison table must preserve HTML escaping for user-supplied source');checks++;
assert.ok(!safe.includes('<svg')&&safe.includes('&lt;svg onload=alert(1)&gt;'));checks++;
assert.throws(()=>buildPersonalSectorResearchReport(base,{generatedAt:'not a date'}),/REPORT_DATE_INVALID/);checks++;
const classes=Object.values(ASSET_CLASS);eq(classes.length,13);
for(const c of classes){
 const sample=structuredClone(base);
 sample.assetClass=c;
 sample.subject.subtype='موقع تجريبي';
 sample.methods={income:c==='LAND',cost:c!=='LAND',market:false};
 sample.inc.groundLease=c==='LAND';
 sample.cost.excludesBusiness=true;
 // Other subtype and no comparables intentionally: evaluate only one method.
 const r=buildPersonalSectorResearchReport(sample,{generatedAt:time});
 eq(r.result.status,'INDIVIDUAL_METHOD_SCENARIOS_ONLY',c);
 eq(r.result.methods.length,1,c);
 eq(r.result.provisionalReconciledAmountSar,null,c);
 eq(verifyPersonalSectorResearchReport(r),true,c);
 assert.ok(renderPersonalSectorResearchHtml(r).includes('غير معتمد'));checks++;
}
console.log('C57_SECTOR_PERSONAL_RESEARCH_REPORT=PASS checks='+checks);
console.log('INDEPENDENT_MARKET_OR_PROFESSIONAL_AUTHORITY=FALSE');