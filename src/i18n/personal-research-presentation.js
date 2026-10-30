'use strict';
// Presentation only: never change canonical inputs, results, evidence or hashes.
const {REASONS:AR_SECTOR}=require('../valuation-intelligence/personal-sector-reason-labels');
const {ARABIC_VALUE_LABELS}=require('./strict-arabic-presentation');
const SECTOR_EN=Object.freeze({
 UNKNOWN_ASSET_CLASS:'Select a supported asset class',
 CITY_REQUIRED:'Enter the city',
 PROPERTY_SUBTYPE_REQUIRED:'Enter the exact property subtype',
 VALUATION_DATE_INVALID:'Enter a valid valuation date',
 SUBJECT_AREA_REQUIRED:'Enter the subject area',
 PROPERTY_RIGHT_UNDEFINED:'Select the property right being studied',
 RESTRICTED_PROPERTY_INTEREST_REQUIRES_SPECIFIC_CASHFLOW_MODEL:'Leasehold, usufruct and restricted waqf interests require a separate cashflow model for the term and obligations; they are not freehold',
 AT_LEAST_ONE_METHOD_REQUIRED:'Select at least one valuation method',
 GROUND_RENT_INSTEAD_OF_BUILDING_NOI_REQUIRED:'Land income must represent documented ground rent rather than building income',
 OPERATING_BUSINESS_NOI_NOT_SEPARATED:'Separate property income from operating business, equipment and goodwill',
 MIXED_USE_SHARED_COSTS_UNALLOCATED:'Allocate shared costs across mixed-use components',
 PROPERTY_NOI_INPUTS_INVALID:'Property income or expenses are invalid',
 CAP_RATE_MISSING_OR_OUT_OF_BOUNDS:'The capitalization rate must be positive and below 50%',
 OPERATING_EXPENSE_POLICY_REQUIRED:'Select who bears property operating expenses',
 ZERO_OPEX_NO_TENANT_POLICY:'Zero owner expenses require an explicit tenant-borne expense policy',
 REPLACEMENT_COST_INPUTS_INVALID:'Replacement cost or depreciation is invalid',
 LAND_ONLY_REQUIRES_LAND_METHOD_NOT_BUILDING_REPLACEMENT:'Vacant land cannot be valued as a building that does not exist',
 NON_REAL_ESTATE_COMPONENTS_NOT_EXCLUDED_FROM_COST:'Exclude equipment and business value from property replacement cost',
 AT_LEAST_THREE_EXECUTED_COMPARABLES_REQUIRED:'Supply at least three comparable executed sales',
 MARKET_COMPARABLE_IDENTITY_DATE_OR_STATUS_INVALID:'Comparable district, city, subtype, right, unit, date, source or declared execution status does not match',
 MARKET_UNIT_NOT_APPROPRIATE_FOR_SECTOR:'The comparison unit is not appropriate for this asset class',
 SUBJECT_DISTRICT_REQUIRED_FOR_SALES:'Enter the district for comparable sales',
 SUBJECT_MARKET_COMPARISON_QUANTITY_REQUIRED:'Enter the number of sector comparison units',
 MARKET_PRICE_INCLUDES_UNSEPARATED_OPERATING_BUSINESS:'Comparable values include operating business or non-property equipment that has not been separated',
 MIXED_USE_COMPARABLE_ALLOCATION_UNCLEAR:'Mixed-use comparable component values have not been reconciled',
 SECOND_INDEPENDENT_METHOD_NOT_PROVIDED:'Only one method indication is available; no final reconciliation is established',
 RECONCILIATION_POLICY_REQUIRED:'Enter explicit method weights and a dispersion threshold',
 RECONCILIATION_POLICY_INVALID:'Each method weight must be positive and all weights must sum to 1',
 HOLD_DISPERSION:'Method dispersion exceeds the threshold; the blended amount is withheld',
 HOLD_DATE_MISMATCH:'Valuation dates differ between methods',
 HOLD_BASIS_MISMATCH:'Valuation bases differ between methods',
 INDEPENDENT_MARKET_AND_SPECIALIST_EVIDENCE_STILL_REQUIRED:'Arithmetic reconciliation is a research scenario; independent market and sector evidence is still required',
 INVALID_SCENARIO_VALUES:'Scenario inputs are invalid; no value is established',
});
const READINESS=Object.freeze({
 INPUT_OR_CALCULATION_NOT_AVAILABLE:['المدخلات الحالية غير صالحة أو الحساب غير متاح','Current inputs are invalid or the calculation is unavailable'],
 STUDY_MODE_UNSUPPORTED:['نوع الدراسة غير مؤهل لهذا الفحص','This study type is not supported by this check'],
 MODEL_INCOMPLETE_OR_INVALID:['النموذج غير مكتمل أو نتائجه الاقتصادية غير مؤهلة','The model is incomplete or its economic results are not eligible'],
 ACQUISITION_COST_ROLLUP:['مجموع تكلفة الاستحواذ غير متطابق','Acquisition costs do not reconcile'],
 NOI_RECONCILIATION:['صافي الدخل التشغيلي غير متطابق مع الإيرادات والمصروفات','Property NOI does not reconcile with income and expenses'],
 PROJECT_COST_ROLLUP:['مجموع تكاليف المشروع غير متطابق','Project costs do not reconcile'],
 STABILIZED_NOI_RECONCILIATION:['صافي الدخل التشغيلي المستقر غير متطابق','Stabilized NOI does not reconcile'],
 CASHFLOW_VALUES_FINITE:['يوجد تدفق نقدي غير صالح حسابياً','A cashflow contains an invalid numeric value'],
 OPENING_INVESTMENT_CASHFLOW:['التدفق النقدي الأول لا يطابق تكلفة الاستحواذ','The opening cashflow does not match acquisition cost'],
 NPV_CASHFLOW_RECONCILIATION:['صافي القيمة الحالية لا يطابق التدفقات ومعدل الخصم','NPV does not reconcile with the cashflows and discount rate'],
 FINANCIAL_CRITERIA_COMPLETE:['معايير التقييم المالي غير مكتملة','Financial assessment criteria are incomplete'],
 FINANCIAL_HARD_GATES_NOT_MET:['لم تتحقق بعض القيود المالية الإلزامية','Some mandatory financial gates have not been met'],
 NPV_NOT_ESTABLISHED:['صافي القيمة الحالية غير متحقق','NPV has not been established'],
 IRR_NOT_ESTABLISHED:['معدل العائد الداخلي غير متحقق','IRR has not been established'],
 IRR_REQUIRES_MANUAL_REVIEW:['يتطلب معدل العائد الداخلي مراجعة مستقلة','IRR requires independent review'],
 EXIT_ANALYSIS_NOT_READY:['تحليل قيمة التخارج غير مكتمل','Exit-value analysis is incomplete'],
});
const ENUMS=Object.freeze({
 LAND:['أرض','Land'],RESIDENTIAL:['سكني','Residential'],OFFICE:['مكاتب','Office'],RETAIL:['تجزئة','Retail'],
 INDUSTRIAL_LOGISTICS:['صناعي ولوجستي','Industrial and logistics'],HOSPITALITY:['ضيافة','Hospitality'],HEALTHCARE:['رعاية صحية','Healthcare'],EDUCATION:['تعليمي','Education'],MIXED_USE:['استخدام مختلط','Mixed use'],PARKING:['مواقف سيارات','Parking'],DATA_CENTER:['مركز بيانات','Data center'],SPECIAL_PURPOSE:['استخدام خاص','Special purpose'],OTHER:['أخرى','Other'],
 FREEHOLD:['ملكية كاملة بحسب المدخلات','Freehold as entered'],LEASEHOLD:['حق إيجار بحسب المدخلات','Leasehold as entered'],USUFRUCT:['حق انتفاع بحسب المدخلات','Usufruct as entered'],WAQF_RESTRICTED:['حق وقفي مقيد بحسب المدخلات','Restricted waqf interest as entered'],
 SQM:['ريال لكل متر مربع','SAR per sqm'],UNIT:['ريال لكل وحدة سكنية','SAR per home'],ROOM_KEY:['ريال لكل غرفة فندقية','SAR per hotel key'],BED:['ريال لكل سرير','SAR per bed'],SEAT:['ريال لكل مقعد','SAR per seat'],SPACE:['ريال لكل موقف','SAR per parking space'],MW_IT:['ريال لكل ميجاوات تقنية','SAR per IT MW'],
 MARKET_COMPARABLE:['المقارنة السوقية','Market comparison'],INCOME_DIRECT_CAPITALIZATION:['رسملة الدخل المباشرة','Direct income capitalization'],COST_DEPRECIATED_REPLACEMENT:['تكلفة الاستبدال بعد الاستهلاك','Depreciated replacement cost'],
 HOLD_INPUT_OR_SECTOR_POLICY:['محجوب لقصور المدخلات أو سياسة القطاع','Withheld for input or sector-policy gaps'],INDIVIDUAL_METHOD_SCENARIOS_ONLY:['مؤشرات طرق منفصلة دون قيمة نهائية','Individual method scenarios; no final value'],MULTI_METHOD_RESEARCH_ONLY:['ترجيح بحثي غير معتمد سوقيًا','Research reconciliation; market unverified'],USER_ASSUMPTION_SCENARIO_NOT_A_CERTIFIED_VALUE:['سيناريو افتراضات المستخدم؛ ليس قيمة معتمدة','User-assumption scenario; not a certified value'],
 EXECUTED_SALE:['بيع منفذ بحسب إقرار المستخدم','User-declared executed sale'],ASKING_SALE:['عرض بيع أو سوم؛ مستبعد','Listing or asking price; excluded'],UNSPECIFIED:['غير محدد؛ لا يثبت التنفيذ','Unspecified; execution not established'],
 ACTUAL_LANDLORD_OPEX:['مصروفات المالك الفعلية بحسب المدخلات','Entered actual owner expenses'],MARKET_ESTIMATE:['مصروفات تقديرية','Estimated expenses'],TENANT_BORNE_CONFIRMED:['يتحملها المستأجر؛ إقرار يحتاج مراجعة العقد','Tenant-borne declaration; contract review required'],TENANT_BORNE_ASSUMED:['يُفترض تحمل المستأجر','Assumed tenant-borne'],
 PERSONAL_NON_CERTIFIED_SECTOR_RESEARCH:['دراسة قطاعية شخصية غير معتمدة','Personal non-certified sector research'],
});
const DCF_REASONS=Object.freeze({
 "WAQF_RESTRICTED_INTEREST_REQUIRES_INDEPENDENT_LEGAL_REVIEW": [
  "حق الوقف مقيد ويحتاج مراجعة مستقلة للصك وصلاحية التصرف، ولا ينتج عنه تقييم رقمي تلقائي.",
  "Restricted waqf interests require independent title and authority review; no automatic numeric valuation is provided"
 ],
 "ASSIGNABILITY_CONSENT_NOT_ESTABLISHED": [
  "تنازل الحق يستلزم موافقة؛ ولم تثبت الموافقة المستقلة.",
  "Transfer requires consent that has not been independently established"
 ],
 "CONTRACTUAL_TERM_AND_OBLIGATIONS_NOT_DECLARED_REVIEWED": [
  "يجب مراجعة مدة الحق والأجرة والالتزامات في العقد.",
  "Review the contractual term, rent and obligations"
 ],
 "PROPERTY_REVENUE_EXCLUDING_OPERATING_BUSINESS_NOT_CONFIRMED": [
  "افصل دخل العقار عن أرباح المشغل أو المعدات والسمعة.",
  "Separate property income from business profit, equipment and goodwill"
 ],
 "IMPROVEMENT_REVERSION_REQUIRES_SEPARATE_VERIFIED_MODEL": [
  "التعويض أو ملكية التحسينات عند نهاية الحق تتطلب نموذجًا مستقلًا موثقًا.",
  "Improvement ownership or compensation at expiry requires a separate verified model"
 ],
 "REMAINING_RIGHT_TERM_1_TO_80_YEARS_REQUIRED": [
  "أدخل مدة صحيحة من سنة إلى 80 سنة.",
  "Enter an integer remaining term from 1 to 80 years"
 ],
 "INVALID_NOMINAL_DISCOUNT_RATE": [
  "معدل الخصم يجب أن يكون بين 0% و75%.",
  "The nominal discount rate must be between 0% and 75%"
 ],
 "PROPERTY_REVENUE_REQUIRED": [
  "أدخل دخلًا عقاريًا سنويًا موجبًا.",
  "Enter positive annual property income"
 ],
 "LIMITED_PROPERTY_RIGHT_REQUIRED": [
  "حدد نوع حق الانتفاع أو حق الإيجار محل الدراسة.",
  "Select a leasehold or usufruct right"
 ],
 "VALUATION_DATE_REQUIRED": [
  "أدخل تاريخ تقييم صحيحًا.",
  "Enter a valid valuation date"
 ],
 "NON_FINITE_RIGHTS_CASHFLOW": [
  "تجاوزت التدفقات الحدود الحسابية الآمنة؛ راجع الأرقام والنمو.",
  "Cashflows exceed safe numeric bounds; review amounts and escalation"
 ],
 "NON_FINITE_RIGHTS_NPV": [
  "تعذّر حساب صافي القيمة الحالية دون تجاوز الحدود الآمنة.",
  "NPV cannot be calculated within safe numeric bounds"
 ],
 "UNSUPPORTED_RIGHTS_SCENARIO": [
  "تعذّر حساب السيناريو من المدخلات الحالية؛ تحقق من الحقول.",
  "The current inputs cannot produce a supported rights scenario"
 ],
 "LAND_DEVELOPMENT_ONLY": [
  "النموذج مخصص لتطوير الأرض فقط",
  "This model is limited to land development"
 ],
 "LEGAL_PROPERTY_RIGHT_REQUIRES_SEPARATE_MODEL": [
  "الحق العقاري ليس ملكية كاملة؛ يلزم نموذج مستقل",
  "This property right is not freehold and requires a separate model"
 ],
 "VALUATION_DATE_INVALID": [
  "تاريخ التقييم غير صحيح",
  "Enter a valid valuation date"
 ],
 "LAND_AREA_REQUIRED": [
  "أدخل مساحة الأرض بالمتر المربع",
  "Enter land area in square metres"
 ],
 "DISCOUNT_RATE_INVALID": [
  "معدل الخصم يجب أن يكون بين 0% و75%",
  "The discount rate must be between 0% and 75%"
 ],
 "RISK_AND_DEVELOPER_RETURN_TREATMENT_REQUIRED": [
  "يجب بيان احتساب مخاطر التطوير وعائد المطور ضمن الخصم",
  "State how development risk and developer return are included in the discount rate"
 ],
 "DEVELOPER_RETURN_DOUBLE_COUNT_RISK": [
  "احتمال احتساب ربح المطور أو علاوة المخاطر مرتين",
  "Developer profit or the risk premium may have been counted twice"
 ],
 "FINANCING_AND_DISCOUNT_DOUBLE_COUNT_RISK": [
  "لا تكرر فوائد التمويل وخدمة الدين في هذا التدفق غير الممول",
  "Exclude financing interest and debt service from this unlevered cashflow"
 ],
 "NON_REALTY_GDV_NOT_EXCLUDED": [
  "استبعد قيمة النشاط التجاري والمعدات غير العقارية",
  "Exclude operating business and non-property equipment value"
 ],
 "DATED_PHASES_NOT_REVIEWED": [
  "راجع تواريخ وتوزيع الصرف والتحصيل",
  "Review dates and the timing of payments and receipts"
 ],
 "PHASES_2_TO_24_REQUIRED": [
  "أدخل من فترتين إلى 24 فترة",
  "Supply between 2 and 24 periods"
 ],
 "PHASE_ROW_INVALID": [
  "توجد فترة غير صالحة",
  "A period row is invalid"
 ],
 "PHASE_MONTH_INVALID": [
  "تاريخ شهر الفترة غير صحيح (من 0 إلى 120)",
  "Enter an integer period month from 0 to 120"
 ],
 "DUPLICATE_MONTH": [
  "لا يجوز تكرار نفس الشهر؛ اجمع المبالغ في فترة واحدة",
  "A month is repeated; combine its amounts into one period"
 ],
 "PHASE_AMOUNT_INVALID": [
  "المبالغ غير صالحة؛ اكتب صفرًا صريحًا عند عدم وجود مبلغ",
  "Enter valid amounts, including explicit zero where no amount applies"
 ],
 "EMPTY_PHASE": [
  "لا يجوز أن تكون كل بنود الفترة صفرًا",
  "A period cannot contain only zero amounts"
 ],
 "FUTURE_PERIOD_REQUIRED": [
  "يجب وجود فترة مستقبلية واحدة على الأقل",
  "Supply at least one future period"
 ],
 "DATED_GDV_REQUIRED": [
  "أدخل إيرادات مبيعات مستقبلية للمشروع",
  "Enter future project sale receipts"
 ],
 "DATED_CONSTRUCTION_COST_REQUIRED": [
  "أدخل تكلفة تطوير واحدة على الأقل",
  "Enter at least one development cost"
 ],
 "ZERO_RATE_WITH_FUTURE_DEVELOPMENT_HOLD": [
  "معدل صفر لمشروع ممتد لا يجتاز بوابة العائد والمخاطر",
  "A zero discount rate for future development does not satisfy the risk and return gate"
 ],
 "NON_POSITIVE_RESIDUAL_LAND_VALUE": [
  "القيمة المتبقية للأرض صفرية أو سالبة؛ المشروع لا يبرر شراء الأرض وفق المدخلات",
  "Residual land value is zero or negative; the entered project does not justify land purchase"
 ],
 "OVERFLOW": [
  "تجاوزت الأرقام الحدود الحسابية الآمنة",
  "Amounts exceed safe numeric bounds"
 ],
 "ASSUMPTIONS_USER_SUPPLIED_NOT_INDEPENDENTLY_VERIFIED": [
  "الافتراضات من المستخدم ولم تُتحقق مستقلاً",
  "Assumptions are user-supplied and not independently verified"
 ],
 "TERMINAL_REVERSION_NOT_ASSUMED": [
  "لا تُفترض قيمة متبقية أو تعويض عند انتهاء الحق",
  "No terminal reversion value or compensation is assumed"
 ],
 "CONTRACTUAL_AND_LEGAL_RISK_REVIEW_REQUIRED": [
  "تلزم مراجعة مستقلة للعقد والمخاطر القانونية",
  "Independent contractual and legal risk review is required"
 ],
 "USER_DECLARED_SCHEDULE_NOT_INDEPENDENTLY_VERIFIED": [
  "الجدول بإقرار المستخدم ولم تُتحقق تواريخه مستقلاً",
  "The schedule is user-declared; dates have not been independently verified"
 ],
 "SAUDI_LAND_RIGHTS_PLANNING_AND_PERMITS_UNVERIFIED": [
  "حقوق الأرض والتخطيط والتراخيص السعودية غير متحقق منها",
  "Saudi land rights, planning and permits have not been verified"
 ],
 "PROFESSIONAL_REVIEW_REQUIRED": [
  "تلزم مراجعة مهنية مستقلة",
  "Independent professional review is required"
 ]
});
const DCF_FIELDS=Object.freeze({
 "termYears": [
  "المدة المتبقية للحق (بالسنوات الصحيحة)",
  "Remaining right term in whole years"
 ],
 "valuationDate": [
  "تاريخ التقييم",
  "Valuation date"
 ],
 "annualPropertyIncomeSar": [
  "الإيراد العقاري السنوي قبل مصروفات التشغيل وأجرة الحق والصيانة (دون دخل النشاط التجاري)",
  "Annual property income before OPEX, ground rent and maintenance (SAR; excludes business income)"
 ],
 "annualPropertyOperatingExpenseSar": [
  "مصروفات تشغيل العقار السنوية",
  "Annual property operating expenses (SAR)"
 ],
 "annualGroundRentSar": [
  "الأجرة السنوية المدفوعة لمالك أصل العقار",
  "Annual rent paid to the underlying property owner (SAR)"
 ],
 "annualSustainingCapexSar": [
  "الإنفاق الرأسمالي السنوي اللازم لصيانة الحق",
  "Annual sustaining capital expenditure for the right (SAR)"
 ],
 "incomeEscalationRate": [
  "نمو الدخل السنوي (-0.02 = نقص 2%)",
  "Annual income escalation (-0.02 = a 2% decrease)"
 ],
 "operatingExpenseEscalationRate": [
  "نمو المصروفات السنوي",
  "Annual operating expense escalation"
 ],
 "groundRentEscalationRate": [
  "نمو أجرة حق الأصل السنوي",
  "Annual ground-rent escalation"
 ],
 "nominalDiscountRate": [
  "معدل الخصم السنوي الاسمي (0.10 = 10%)",
  "Nominal annual discount rate (0.10 = 10%)"
 ],
 "upfrontRightConsiderationSar": [
  "المقابل المقدم للحصول على الحق (ريال)",
  "Upfront consideration for the right (SAR)"
 ]
});
const own=(table,key)=>Object.hasOwn(table,key)?table[key]:null;
function researchReason(code,locale='ar-SA'){
 const key=String(code??''),en=locale==='en';
 const dynamic=/^(INVALID_AMOUNT_|INVALID_ESCALATION_)(.+)$/.exec(key);
 if(dynamic){const field=own(DCF_FIELDS,dynamic[2])?.[en?1:0]||(en?'field identified by the code':'الحقل المحدد بالرمز');return Object.freeze({code:key,message:(dynamic[1]==='INVALID_AMOUNT_'?(en?'Enter a valid amount for: ':'أدخل مبلغًا صالحًا للحقل: '):(en?'Escalation must be between -50% and 50% for: ':'يجب أن يكون النمو بين -50% و50% للحقل: '))+field});}
 const message=(!en&&own(AR_SECTOR,key))||own(DCF_REASONS,key)?.[en?1:0]||own(READINESS,key)?.[en?1:0]||(en?own(SECTOR_EN,key):own(AR_SECTOR,key))||(!en&&key==='INVALID_SCENARIO_VALUES'?'مدخلات السيناريو غير صالحة؛ لم تثبت قيمة':null);
 return Object.freeze({code:key,message:message||(en?'Review the condition identified by the attached code':'راجع الحالة المحددة بالرمز المرفق')});
}
function researchEnumLabel(code,locale='ar-SA'){
 const key=String(code??'');if(!key)return '—';
 return own(ENUMS,key)?.[locale==='en'?1:0]||(locale!=='en'?own(ARABIC_VALUE_LABELS,key):null)||(locale==='en'?'Unrecognized value; review the attached code':'قيمة غير معرّفة؛ راجع الرمز المرفق');
}
function researchFieldLabel(key,locale='ar-SA'){return own(DCF_FIELDS,key)?.[locale==='en'?1:0]||(locale==='en'?'Field identified by the code':'الحقل المحدد بالرمز');}
module.exports={SECTOR_EN,READINESS,ENUMS,DCF_REASONS,DCF_FIELDS,researchReason,researchEnumLabel,researchFieldLabel};
