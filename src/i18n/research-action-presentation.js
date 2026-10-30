'use strict';
// Store kind/parameters at action time and choose wording at render time.
// exportLanguage describes the file already requested, not the current UI.
const MESSAGES=Object.freeze({
 OPEN_LOADING:['جارٍ البحث في البيانات المنشورة المصرح بإعادة استخدامها…','Searching published data permitted for reuse…'],
 OPEN_FETCHING:['جارٍ قراءة بيانات {{quarter}}…','Reading data for {{quarter}}…'],
 OPEN_IMPORTED:['تمت معالجة {{count}} سجل في {{quarter}}…','Processed {{count}} records for {{quarter}}…'],
 OPEN_QUARTER_FAILED:['تعذرت قراءة {{quarter}}؛ ستظهر فجوة المصدر','Could not read {{quarter}}; a source gap will be shown'],
 OPEN_PARTIAL:['انتهت القراءة جزئيًا؛ بعض الملفات غير متاحة، ولا ينبغي تفسيرها بأنها تغطية كاملة.','Read completed partially; some files are unavailable. Coverage is incomplete.'],
 OPEN_LOADED:['تم تحميل بيانات الفترات المتاحة. هذه إحصاءات تاريخية للحي وليست بيانات بيع لحظية.','Available periods loaded. These are historical district statistics, not live sales data.'],
 OPEN_FAILED:['تعذر البحث المفتوح: {{code}}','Open-data search failed: {{code}}'],
 CSV_IMPORTED:['استوردت {{count}} سجلاً — منها {{skipped}} غير مثبت التنفيذ وفق الحالة المعلنة، وستُستبعد. المصدر غير متحقق منه آليًا.','Imported {{count}} records; {{skipped}} lack declared execution status and will be excluded. The source has not been authenticated automatically.'],
 CSV_FAILED:['تعذر الاستيراد: {{code}}. تحقق من الأعمدة، رابط مجموعة البيانات، وترخيص إعادة استخدامها.','Import failed: {{code}}. Check columns, dataset URL and reuse rights.'],
 CSV_CLEARED:['تم مسح المقارنات المستوردة من جلسة الصفحة.','Imported comparables cleared from this page session.'],
 DEAL_SELECT:['اختر الصفقة يدويًا للربط أو لاستعادة دراستها.','Select the deal explicitly to link or restore its study.'],
 DEAL_NONE:['لا توجد صفقات محفوظة في مساحة STARTAK الرئيسية.','No saved deals are available in the main STARTAK workspace.'],
 DEAL_LIST_FAILED:['تعذر قراءة سجل الصفقات: {{code}}','Could not read saved deals: {{code}}'],
 SIDECAR_BLOCKED:['حُظر حفظ ملحق الصفقة لوجود تدقيق تقييم متعارض أو ربط قديم. أعد المطابقة أولاً.','Sidecar save is blocked by an appraisal conflict or stale link. Reconcile identity first.'],
 SIDECAR_NAME_MISMATCH:['اسم العقار في التقرير المرتبط لا يطابق اسم الصفقة المحفوظة؛ لا يجوز استخدام إقرار المطابقة وحده لتجاوز التعارض.','The linked report property name differs from the saved deal name. An attestation alone cannot override this conflict.'],
 DEAL_REQUIRED:['اختر الصفقة المحفوظة أولًا.','Select a saved deal first.'],
 IDENTITY_CONFIRM_REQUIRED:['أكد أن الدراسة تخص العقار نفسه قبل الحفظ.','Confirm that the study concerns the same property before saving.'],
 SIDECAR_SAVED:['تم حفظ ملحق الدراسة البحثية للصفقة {{dealId}} دون تغيير ملف الصفقة المالي الرئيسي أو منحه اعتمادًا مهنيًا.','Research sidecar saved for {{dealId}}. The canonical financial deal was not modified or professionally certified.'],
 SIDECAR_OVERWRITE_REQUIRED:['هذه الصفقة مرتبطة بدراسة سابقة؛ فعّل موافقة الاستبدال ثم أعد الحفظ.','This deal already has a study. Explicitly confirm replacement before saving.'],
 SIDECAR_SAVE_FAILED:['تعذر الربط: {{code}}','Link failed: {{code}}'],
 SIDECAR_NOT_FOUND:['لا توجد دراسة بحثية مرتبطة بهذه الصفقة.','No research study is linked to this deal.'],
 SIDECAR_RESTORED:['استُعيدت مدخلات الملحق المرتبط بالصفقة {{dealId}}. أعادت المنصة احتساب المؤشرات، ولا يُستعاد أي اعتماد أو سعر معتمد من الملف.','Inputs restored from the sidecar for {{dealId}}. Indicators were recalculated; no approval or certified value is restored from the file.'],
 SIDECAR_RESTORE_FAILED:['تعذرت الاستعادة المرتبطة: {{code}}','Linked restore failed: {{code}}'],
 STUDY_RESTORED:['استُعيدت مدخلات الدراسة الخاصة محليًا؛ أُعيد حساب النتائج دون الثقة في أرقام قديمة أو ادعاءات اعتماد داخل الملف.','Personal study inputs restored locally. Results were recalculated without trusting prior figures or approval claims in the file.'],
 STUDY_RESTORE_FAILED:['فشل استيراد ملف الدراسة: {{code}}','Study import failed: {{code}}'],
 STUDY_EXPORT_BLOCKED:['تم منع تصدير الدراسة بسبب تعارض أو انتهاء صلاحية ربط تدقيق التقرير. راجع المطابقة والتدقيق أولاً.','Study export is blocked by an appraisal conflict or stale link. Reconcile identity and review the audit first.'],
 STUDY_EXPORT_REQUESTED:['تم إعداد ملف الدراسة وإرسال طلب تنزيله إلى المتصفح؛ يرجى التحقق من قائمة التنزيلات.','Study file prepared and download requested. Check the browser download list.'],
 STUDY_EXPORT_FAILED:['تعذر إعداد ملف الدراسة للتنزيل. رمز الخطأ: {{code}}','Study download could not be prepared. Diagnostic code: {{code}}'],
 BRIDGE_FAILED:['لم تُنسخ بيانات الهوية: {{code}}','Property fields not copied: {{code}}'],
 BRIDGE_COPIED:['تم نقل حقول الهوية بتأكيد المستخدم؛ لم تتحقق المنصة من الصك أو السوق أو الموقع.','User-confirmed property fields copied; title, market and location remain unverified.'],
 PERSONAL_EXPORT_REQUESTED:['تم تجهيز نسخة محلية من الدراسة الشخصية وإرسال طلب تنزيلها.','Personal study prepared and local download requested.'],
 PERSONAL_EXPORT_FAILED:['تعذر تصدير المسودة: {{code}}','Draft export failed: {{code}}'],
 RESEARCH_HTML_AR:['تم تصدير تقرير HTML عربي بحثي غير معتمد؛ لا يتضمن توصية شراء أو تقييمًا مرخصًا.','An Arabic research-only HTML report was exported; it is not a purchase recommendation or licensed appraisal.'],
 RESEARCH_HTML_EN:['تم تصدير تقرير HTML إنجليزي بحثي غير معتمد؛ لا يتضمن توصية شراء أو تقييمًا مرخصًا.','An English research-only HTML report was exported; it is not a purchase recommendation or licensed appraisal.'],
 RESEARCH_HTML_FAILED:['تعذر إصدار التقرير البحثي HTML: {{code}}','Could not export research HTML: {{code}}'],
 RESEARCH_JSON_EXPORTED:['تم تصدير تقرير بحثي مع حدود الثقة؛ لا يتضمن قيمة سوقية معتمدة.','Research JSON exported with evidence limitations and no certified market value.'],
 RESEARCH_JSON_FAILED:['تعذر تصدير التقرير البحثي: {{code}}','Could not export research bundle: {{code}}'],
});
function researchActionText(notice,locale='ar-SA'){
 if(!notice)return '';
 const template=MESSAGES[notice.kind]?.[locale==='en'?1:0];
 if(!template)return locale==='en'?'Action notice unavailable. Review the action status.':'تعذر عرض رسالة الإجراء؛ راجع حالته.';
 return template.replace(/\{\{(\w+)\}\}/g,(_,key)=>String(notice.params?.[key]??'—'));
}
module.exports={researchActionText};
