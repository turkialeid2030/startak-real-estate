'use strict';
// Display labels only; these functions never change an evidence record,
// select an option, or establish source authenticity.
const LABELS=Object.freeze({
 A_VERIFIED_OFFICIAL:['A — مصدر رسمي مصنف موثقًا','A — Official source classified as verified'],
 B_VERIFIED_TRANSACTION:['B — صفقة مصنفة موثقة','B — Transaction classified as verified'],
 C_CONTRACTUAL:['C — دليل تعاقدي','C — Contractual evidence'],
 D_OPERATING_ACTUAL:['D — بيانات تشغيل فعلية','D — Actual operating data'],
 E_MARKET_OBSERVATION:['E — رصد سوقي','E — Market observation'],
 F_THIRD_PARTY_APPRAISAL:['F — تقييم طرف ثالث','F — Third-party appraisal'],
 G_EXPERT_ASSUMPTION:['G — افتراض خبير','G — Expert assumption'],
 H_CLIENT_SUPPLIED_UNVERIFIED:['H — بيانات عميل غير متحقق منها','H — Unverified client-supplied data'],
 VERIFIED:['مصنف متحققًا منه','Classified as verified'],
 OBSERVED:['مرصود','Observed'],ASSUMED:['مفترض','Assumed'],
 UNVERIFIED:['غير متحقق منه','Unverified'],CONFLICT:['متعارض','Conflicting'],
 MARKET_VALUE:['القيمة السوقية','Market value'],FAIR_VALUE:['القيمة العادلة','Fair value'],
 MARKET_RENT:['الأجرة السوقية','Market rent'],INVESTMENT_VALUE:['القيمة الاستثمارية','Investment value'],
 RESIDUAL_LAND_VALUE:['قيمة الأرض المتبقية','Residual land value'],OTHER:['أساس آخر','Other basis'],
 EXECUTED_SALE:['صفقة بيع مصنفة منفذة','Sale classified as executed'],
 ASKING_SALE:['عرض بيع غير منفذ','Unexecuted sale offer'],
 EXECUTED_LEASE:['عقد إيجار مصنف منفذًا','Lease classified as executed'],
 ASKING_LEASE:['عرض إيجار غير منفذ','Unexecuted rental offer'],
 EXPLICIT:['أوزان صريحة','Explicit weights'],EQUAL:['أوزان متساوية','Equal weights'],
});
function valuationEvidenceLabel(value,locale='ar-SA'){
 return Object.hasOwn(LABELS,value)?LABELS[value][locale==='en'?1:0]:value;
}
module.exports={valuationEvidenceLabel};
