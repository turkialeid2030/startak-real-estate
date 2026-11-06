'use strict';
const {ASSET_CLASS}=require('../project-model/project-profile');
const {REQUIRED_SCENARIOS}=require('../pilot/asset-sector-e2e-evidence-matrix');

// Complete classification coverage is not complete professional valuation.
const ALL_SECTORS=Object.freeze({
  LAND:Object.freeze({id:ASSET_CLASS.LAND,ar:"أرض فضاء وتطوير",en:"Vacant land and development",tier:"development",evidenceAr:"صك الملكية، المساحة، الاستعمالات المسموحة، كثافة البناء، صفقات أراضٍ منفذة، جدول التطوير",evidenceEn:"Title, area, allowed zoning and density, executed land sales, dated development budget"}),
  RESIDENTIAL:Object.freeze({id:ASSET_CLASS.RESIDENTIAL,ar:"سكني: فلل وشقق ومجمعات",en:"Residential houses, units and compounds",tier:"income",evidenceAr:"صفقات وحدات مماثلة منفذة، الموقع والعمر والحالة، عقود الإيجار والإشغال عند التأجير",evidenceEn:"Executed like-for-like sales, condition and age, leases and occupancy if rented"}),
  OFFICE:Object.freeze({id:ASSET_CLASS.OFFICE,ar:"مكاتب وأبراج إدارية",en:"Offices and commercial towers",tier:"income",evidenceAr:"سجل الإيجارات الفعلي، المساحات، الإشغال والتحصيل، المصاريف، أسعار رسملة موثقة",evidenceEn:"Rent roll, NLA, occupancy and collections, operating costs, independently sourced cap rates"}),
  RETAIL:Object.freeze({id:ASSET_CLASS.RETAIL,ar:"تجاري: معارض وأسواق ومولات",en:"Retail shops, malls and markets",tier:"income",evidenceAr:"عقود المحلات والمستأجرين، الحوافز والفراغ، مبيعات المستأجر عند مشاركة الإيراد، مصاريف التشغيل",evidenceEn:"Leases, tenants, incentives, vacancies, turnover rent and operating expenses"}),
  INDUSTRIAL_LOGISTICS:Object.freeze({id:ASSET_CLASS.INDUSTRIAL_LOGISTICS,ar:"مستودعات ومصانع ولوجستيات",en:"Warehouses, factories and logistics",tier:"specialist",evidenceAr:"الرخص الصناعية، الارتفاع والتحميل والمناولة، الطاقة والمرافق، السلامة، التلوث، الإيجارات والتجديدات",evidenceEn:"Permits, clear height, loading, power, fire safety, contamination and industrial tenancies"}),
  HOSPITALITY:Object.freeze({id:ASSET_CLASS.HOSPITALITY,ar:"فنادق وشقق مخدومة ومنتجعات",en:"Hotels, serviced apartments and resorts",tier:"specialist",evidenceAr:"الإشغال والغرف المتاحة ومتوسط الأجرة اليومية وإيراد الغرفة المتاحة، مصاريف المشغل وتجديد الأثاث والتركيبات والمعدات، فصل العقار عن السمعة والنشاط",evidenceEn:"Occupancy, ADR, RevPAR, operator fees and FF&E reserves; separate land/building from business"}),
  HEALTHCARE:Object.freeze({id:ASSET_CLASS.HEALTHCARE,ar:"مستشفيات ومراكز طبية",en:"Hospitals and healthcare",tier:"specialist",evidenceAr:"تراخيص صحية، تجهيزات وأجهزة، عقود مشغل، كثافة الاستخدام، الفصل بين العقار والنشاط الطبي",evidenceEn:"Health licenses, equipment, operator agreements; separate real estate from clinical business"}),
  EDUCATION:Object.freeze({id:ASSET_CLASS.EDUCATION,ar:"مدارس وجامعات ومراكز تعليمية",en:"Schools, universities and education",tier:"specialist",evidenceAr:"التراخيص والطاقة الطلابية، عقود الاستخدام، أصول التشغيل والتجهيزات، القيود التخطيطية",evidenceEn:"Licensing, capacity, operator lease, school equipment and zoning restrictions"}),
  MIXED_USE:Object.freeze({id:ASSET_CLASS.MIXED_USE,ar:"مجمع متعدد الاستخدامات",en:"Mixed-use property",tier:"specialist",evidenceAr:"تقسيم مساحات وإيرادات ومصاريف السكن والتجاري والضيافة؛ منع ازدواج قيمة الأجزاء",evidenceEn:"Separate residential, retail, office and hotel flows; reconcile common costs and avoid double count"}),
  PARKING:Object.freeze({id:ASSET_CLASS.PARKING,ar:"مواقف السيارات والأصول المرتبطة",en:"Parking assets",tier:"specialist",evidenceAr:"عدد المواقف المرخصة، إشغال وإيرادات الساعة والاشتراكات، مصاريف الأتمتة والصيانة",evidenceEn:"Licensed spaces, ticket/subscription revenue, utilization, automation and maintenance"}),
  DATA_CENTER:Object.freeze({id:ASSET_CLASS.DATA_CENTER,ar:"مراكز البيانات",en:"Data centers",tier:"specialist",evidenceAr:"القدرة بالميجاوات والطاقة والتبريد والتكرار وعقود الاستخدام؛ فصل المعدات والأعمال عن العقار",evidenceEn:"Power MW, uptime redundancy, cooling, tenant contracts; realty versus IT/operating assets"}),
  SPECIAL_PURPOSE:Object.freeze({id:ASSET_CLASS.SPECIAL_PURPOSE,ar:"أصول خاصة وأوقاف وأصول نوعية",en:"Special-purpose and endowment assets",tier:"specialist",evidenceAr:"طبيعة المنفعة والحقوق والقيود، أفضل استخدام ممكن، بيانات تكلفة الاستبدال والاستهلاك",evidenceEn:"Property rights and restrictions, HBU, replacement cost and obsolescence"}),
  OTHER:Object.freeze({id:ASSET_CLASS.OTHER,ar:"نوع عقاري آخر",en:"Other property type",tier:"specialist",evidenceAr:"تعريف الأصل وحقه ومنفعته والقطاع الأقرب، دليل مستقل لطريقة التقييم المختارة",evidenceEn:"Define use, property interest, closest benchmark type and independently supported method"}),
});
const SOURCE_CHANNELS=Object.freeze([
 {id:'REGA_SALES',ar:'الهيئة العامة للعقار — صفقات البيع',en:'REGA — executed property sales',
  url:'https://rei.rega.gov.sa/ar/advanced-search/deals/details',recordKind:'EXECUTED_SALE_REQUIRES_MANUAL_AUTH'},
 {id:'REGA_RENTS',ar:'الهيئة العامة للعقار — مؤشرات الإيجارات',en:'REGA — rent indicators',
  url:'https://rei.rega.gov.sa/ar/advanced-search',recordKind:'RENT_INDICATOR_NOT_A_SIGNED_LEASE'},
 {id:'MOJ_OPEN',ar:'وزارة العدل — تقارير الصفقات والبيانات المفتوحة',en:'MOJ — transaction reports and open data',
  url:'https://www.moj.gov.sa/ar/OpenData/pages/reports.aspx',recordKind:'OFFICIAL_REPORT_EXPORT_LICENSE_CHECK_REQUIRED'},
]);
function researchSectorRoute(assetClass) {
  if (!Object.prototype.hasOwnProperty.call(ALL_SECTORS,assetClass)) return Object.freeze({
    status:'HOLD_UNKNOWN_ASSET_CLASS',assetClass:null,methodEngineCertified:false,
    marketSourceIndependentlyVerified:false,transactionAuthorized:false,requirements:[],
  });
  const sector=ALL_SECTORS[assetClass];
  const initialScope=sector.tier==='income' ? 'PRELIMINARY_EXISTING_PROPERTY_RESEARCH'
    : sector.tier==='development' ? 'PRELIMINARY_LAND_DEVELOPMENT_RESEARCH'
    : 'SPECIALIST_METHOD_NOT_END_TO_END_QUALIFIED';
  return Object.freeze({
    status:initialScope,assetClass,sector,
    declaredSectorJourneyIds:Object.freeze(REQUIRED_SCENARIOS.filter(x=>x.assetClass===assetClass).map(x=>x.id)),
    availableMarketChannels:SOURCE_CHANNELS,
    priceAutomaticallyFetched:false,realExecutedTransactionImported:false,
    methodEngineCertified:false,marketSourceIndependentlyVerified:false,
    professionalReviewCompleted:false,transactionAuthorized:false,
  });
}
module.exports={ALL_SECTORS,SOURCE_CHANNELS,researchSectorRoute};
