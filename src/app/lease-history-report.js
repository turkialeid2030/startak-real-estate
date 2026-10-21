'use strict';
const h=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
function leaseHistoryHtml(c,locale){
 const events=c?.leases?.flatMap(lease=>(lease.changeLog||[]).map(event=>({...event,leaseId:lease.leaseId})))||[];
 if(!events.length)return '';
 const t=(ar,en)=>locale==='en'?en:ar;
 const types={TERMS_REPLACED:t('تصحيح الشروط','Terms replacement'),SCHEDULE_REPLACED:t('استبدال جدول الإيجار','Rent schedule replacement'),EARLY_END_RECORDED:t('نهاية مبكرة مسجلة','Recorded early end'),FUTURE_CANCELLED:t('إلغاء عقد مستقبلي مسجل','Recorded future cancellation'),STATE_REVIEWED:t('مراجعة في تاريخ الدراسة','Case-date review'),PREVIOUS_TERMS_RESTORED:t('استرجاع شروط سابقة كتعديل جديد','Previous terms restored as new revision')};
 const states={ACTIVE:t('نشط مسجل','Declared active'),FUTURE:t('مستقبلي مسجل','Declared future'),EXPIRED:t('منتهٍ مسجل','Declared expired'),TERMINATED:t('إنهاء مسجل','Declared terminated'),UNKNOWN:t('غير محدد','Unknown')};
 const headings=[t('العقد / المراجعة','Lease / revision'),t('نوع التسجيل','Change'),t('السريان / التسجيل','Effective / recorded'),t('الحالة السابقة والجديدة','Previous and new state'),t('النهاية السابقة والجديدة','Previous and new end'),t('المصدر / المراجعة / السبب','Source / review / reason')];
 return '<section data-section="lease-change-history"><h2>'+t('سجل تغييرات العقود المحلي','Local lease change history')+'</h2><p>'+t('الشروط السابقة والجديدة محفوظة في لقطة المصدر وتصدير JSON. تسجيل محلي لا يثبت صحة المستند أو هوية المراجع، ولا ينفذ إنهاءً أو تجديدًا أو إشعارًا لدى جهة خارجية. تغيير تاريخ الدراسة لا يعيد كتابة التحصيلات أو الموازنة أو الخطط النقدية.','Previous/new terms are retained in the source snapshot and JSON export. This local record does not authenticate documents/reviewers or execute external termination, renewal or notices. Case-date changes do not rewrite collections, budgets or cash plans.')+'</p><table><thead><tr>'+headings.map(x=>'<th scope="col">'+h(x)+'</th>').join('')+'</tr></thead><tbody>'+events.map(e=>'<tr>'+[
 e.leaseId+' / '+e.revision,types[e.kind]||e.kind,e.effectiveDate+' / '+e.recordedAt,
 (states[e.before.lifecycleStatus]||e.before.lifecycleStatus)+' → '+(states[e.after.lifecycleStatus]||e.after.lifecycleStatus),(e.before.endDate||'—')+' → '+(e.after.endDate||'—'),
 e.sourceRef+' / '+e.adoptionDecisionRef+' / '+e.reason,
 ].map(value=>'<td>'+h(value)+'</td>').join('')+'</tr>').join('')+'</tbody></table></section>';
}
module.exports={leaseHistoryHtml};
