'use strict';
// D04 phase 1: non-authoritative UI-only translations. Field values, saved JSON,
// asset identifiers and appraisal decisions retain exactly the same semantics.
const {ASSET_TYPES}=require('../market/instant-market-study');
const EN=Object.freeze({
 'موقع العقار والقيمة السوقية والإيجار المستهدف — دراسة شخصية':'Property location, market evidence and target rent — personal study',
 'D06 — ربط اختياري لهوية العقار من الدراسة المالية':'D06 — Optional property identity link from financial study',
 'حالة النقل:':'Transfer status:',
 'الحقول المقترحة:':'Proposed fields:',
 'اختر نوع العقار صراحةً؛ لا نستخدم النوع الافتراضي أو اسم المشروع':'Explicitly select an asset type. The default and project name are not evidence.',
 'أوافق على نسخ الحقول المقترحة واستبدال قيم هذه الحقول فقط بعد مراجعتها':'I reviewed the proposed fields and explicitly agree to replace only those fields',
 'اعتماد نسخ بيانات العقار إلى البحث السوقي':'Copy confirmed property fields into market research',
 'اسم العقار':'Property name',
 'غرض دراسة التقييم':'Purpose of study',
 'تاريخ القيمة المطلوب دراستها':'Study valuation date',
 'نوع الحق العقاري (يحتاج تحقق)':'Property right (unverified)',
 'التصنيف التنظيمي أو الاستعمال المسموح (حسب الدليل)':'Zoning or permitted use (as documented)',
 'حالة المعاينة الفعلية':'Property inspection status',
 'تاريخ المعاينة الميدانية':'On-site inspection date',
 'نوع العقار':'Asset type',
 'تصنيف الأرض للمقارنات':'Land subtype for comparables',
 'المدينة':'City',
 'الحي':'District',
 'رابط موقع العقار من خرائط جوجل أو الإحداثيات':'Google Maps property URL or coordinates',
 'مساحة الأرض (م²)':'Land area (sqm)',
 'إجمالي المساحات المبنية لكل المباني (م²)':'Total built area of all buildings (sqm)',
 'إجمالي المساحة القابلة للتأجير (م²)':'Total rentable area (sqm)',
 'عدد العمائر/المباني':'Number of buildings',
 'عدد الوحدات (شقق/مكاتب/معارض)':'Number of units (homes/offices/shops)',
 'عدد الأدوار (للتوثيق)':'Number of floors (for reference)',
 'عدد الغرف والمفاتيح الفندقية':'Number of hotel rooms/keys',
 'عدد المحلات والمعارض التجارية':'Number of shops and retail units',
 'اختر نوع العقار':'Select asset type',
 'اختر الغرض':'Select purpose',
 'دراسة شراء أو استحواذ':'Acquisition research',
 'مراجعة محفظة أصول':'Portfolio review',
 'دراسة أجرة سوقية':'Market rent research',
 'مراجعة تمويلية غير رسمية':'Informal financing research',
 'دراسة شخصية أخرى':'Other personal study',
 'غير متحقق':'Not verified',
 'ملكية كاملة':'Full ownership (claimed)',
 'حق انتفاع':'Usufruct right',
 'حق تأجير طويل المدة':'Long leasehold',
 'حق آخر':'Other right',
 'لم تتم المعاينة':'Not inspected',
 'مراجعة صور أو موقع فقط':'Remote images/site review only',
 'تمت معاينة ميدانية — إقرار المستخدم':'On-site inspection — user attestation only',
 'اختر حالة الأرض':'Select land subtype',
 'أرض خام غير مخدومة':'Unserviced raw land',
 'أرض مخدومة ومخططة':'Serviced/platted land',
 'قطعة أرض سكنية':'Residential land parcel',
 'قطعة أرض تجارية':'Commercial land parcel',
 'أرض زراعية':'Agricultural land',
 'مقارنات البيع — لإنشاء مؤشر القيمة':'Executed-sale comparables — value indication',
 'مقارنات الإيجار الجديد — مستقل عن الإيجار السابق':'New rent comparables — separate from previous rent',
 'نوع العقار المقارن':'Comparable asset class',
 'طبيعة السعر':'Price evidence status',
 'تصنيف الأرض المقارنة':'Comparable land subtype',
 'معرّف الصفقة/العقد لدى المصدر (إن توفر)':'Source transaction / contract ID, if available',
 'قيمة البيع الفعلية (ر.س)':'Executed sale amount (SAR)',
 'الإيجار السنوي المتعاقد عليه (ر.س)':'Contracted annual rent (SAR)',
 'مساحة أرض المقارنة م²':'Comparable land area (sqm)',
 'مساحة البناء الإجمالية للمقارنة م²':'Comparable total built area (sqm)',
 'المساحة التأجيرية للمقارنة م²':'Comparable rentable area (sqm)',
 'تاريخ الصفقة/العقد':'Transaction / contract date',
 'موقع المقارنة (رابط أو إحداثيات)':'Comparable location (URL or coordinates)',
 'رابط مصدر الصفقة أو العقد (رابط آمن)':'Transaction or contract source URL (secure)',
 'عرض/طلب غير منفّذ — مستبعد':'Asking listing, not executed — excluded',
 'صفقة أو عقد منفّذ — إقرار المستخدم':'Executed transaction / contract — user attestation only',
 'غير محدد — لا يعتمد عند تحديد تصنيف للأرض':'Not specified — excluded when land subtype is required',
 'الإشغال المتوقع ككسر (0.9 = 90%)':'Expected occupancy ratio (0.9 = 90%)',
 'مصروفات المالك من الإيراد ككسر':'Owner expenses as fraction of revenue',
 'معدل الرسملة ككسر':'Capitalization rate as decimal',
 'عدد المستودعات أو الوحدات اللوجستية':'Number of warehouses / logistics units',
 'الارتفاع الصافي الداخلي بالمتر':'Clear internal height (m)',
 'عدد بوابات التحميل والتفريغ':'Loading / unloading bays',
 'مواقف السيارات':'Parking spaces',
 'الإيجار السنوي السابق (مرجع نظامي فقط)':'Previous annual rent (regulatory context only)',
 'تاريخ إشغال/تأجير الوحدة':'History of unit leasing',
 'داخل النطاق العمراني للرياض؟':'Inside Riyadh urban boundary?',
 'غير معروف':'Unknown',
 'سبق تأجيرها':'Previously leased',
 'أول تأجير':'First tenancy',
 'لم يتم التحقق':'Not verified',
 'نعم — بحاجة لإثبات':'Yes — evidence needed',
 'لا':'No',
 'اسم المشروع/المرفق':'Surrounding project / facility',
 'مرحلة المشروع':'Project phase',
 'رابط موقعه أو إحداثياته':'Project URL or coordinates',
 'رابط مصدر المشروع الرسمي':'Official project source URL',
 'أثر افتراضي موثق (0.03 = 3%)':'Documented hypothetical impact (0.03 = 3%)',
 'معلن/مخطط':'Announced/planned',
 'تحت الإنشاء':'Under construction',
 'تشغيل فعلي':'Operating'
});
const EN_ASSET=Object.freeze({
 RESIDENTIAL_COMPOUND:'Residential compound',
 RESIDENTIAL_BUILDING:'Residential building',
 COMMERCIAL_COMPLEX:'Commercial complex',
 OFFICE_TOWER:'Office tower',
 MIXED_USE:'Mixed use',
 WAREHOUSE:'Warehouses',
 HOTEL:'Hotel / serviced apartments',
 FUEL_STATION:'Fuel station (specialist property/operations)',
 COMMERCIAL_MALL:'Shopping mall',
 RESIDENTIAL_VILLA:'Residential villas',
 LOGISTICS_PARK:'Logistics park',
 INDUSTRIAL_PROPERTY:'Industrial property',
 HEALTHCARE_PROPERTY:'Healthcare property / hospital',
 LAND:'Land'
});
const EN_BRIDGE_FIELDS=Object.freeze({
 name:'Property name',landArea:'Land area (sqm)',
 builtArea:'Built area (sqm)',rentableArea:'Rentable area (sqm)',assetType:'Asset type'
});
function coreMarketLabel(arabic,locale='ar-SA'){
 if(typeof arabic!=='string')throw TypeError('D04_LABEL_MUST_BE_STRING');
 return locale==='en'?(Object.prototype.hasOwnProperty.call(EN,arabic)?EN[arabic]:arabic):arabic;
}
function marketOptionLabel(code,arabic,locale='ar-SA'){
 if(locale==='en'&&Object.prototype.hasOwnProperty.call(EN_ASSET,code)&&
    ASSET_TYPES[code]===arabic)return EN_ASSET[code];
 return coreMarketLabel(arabic,locale);
}
function coreMarketAssetOptions(locale='ar-SA'){
 return Object.freeze([
  Object.freeze(['',coreMarketLabel('اختر نوع العقار',locale)]),
  ...Object.entries(ASSET_TYPES).map(([code,label])=>
   Object.freeze([code,locale==='en'?EN_ASSET[code]:label]))
 ]);
}
function formatBridgeFields(patch={},locale='ar-SA'){
 if(!patch||typeof patch!=='object'||Array.isArray(patch))return '';
 return Object.entries(patch).filter(([k,v])=>Object.hasOwn(EN_BRIDGE_FIELDS,k)&&
  (typeof v==='string'||typeof v==='number'))
 .map(([key,value])=>(locale==='en'?EN_BRIDGE_FIELDS[key]:key)+' = '+String(value)).join(' | ');
}
module.exports={coreMarketLabel,marketOptionLabel,coreMarketAssetOptions,formatBridgeFields};
