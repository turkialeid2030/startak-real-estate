'use strict';
// Runs against rendered DOM. No data values, storage, network or engine state
// are read or changed. Source content and diagnostic codes retain their language.
function collectLocaleSurface({locale,domDocument}={}){
 const doc=domDocument||document,view=doc.defaultView;
 const issues=[],samples=new Set();let checkedTextNodes=0,checkedControls=0;
 const boundary='[data-user-content],code,pre,script,style,[data-testid="locale-switch"]';
 const protectedNode=el=>Boolean(el.closest(boundary));
 const visible=el=>{if(el.closest('[hidden],[aria-hidden="true"]'))return false;const style=view.getComputedStyle(el);return style.visibility!=='hidden'&&style.display!=='none'&&el.getClientRects().length>0;};
 const inspect=(value,el,kind)=>{
  const text=String(value||'').replace(/\s+/g,' ').trim();if(!text)return;
  const mismatch=locale==='en'?/[\u0600-\u06ff\u0750-\u077f]/.test(text):text.includes('نص يحتاج استكمال التعريب؛ الأصل:');
  if(!mismatch)return;
  const surface=el.closest('[data-testid]')?.getAttribute('data-testid')||el.tagName.toLowerCase();
  const key=kind+'|'+surface+'|'+text;if(samples.has(key))return;samples.add(key);
  issues.push({kind,surface,text:text.slice(0,500)});
 };
 const walker=doc.createTreeWalker(doc.body,view.NodeFilter.SHOW_TEXT);let node;
 while((node=walker.nextNode())){const el=node.parentElement;if(!el||protectedNode(el))continue;
  const option=el.closest('option');if(option){const select=option.closest('select');if(select&&visible(select)){checkedTextNodes++;inspect(node.nodeValue,el,'option');}continue;}
  if(!visible(el))continue;checkedTextNodes++;inspect(node.nodeValue,el,'text');
 }
 for(const el of doc.body.querySelectorAll('[aria-label],[title],[placeholder]')){
  if(protectedNode(el)||!visible(el))continue;checkedControls++;
  for(const key of ['aria-label','title','placeholder'])if(el.hasAttribute(key))inspect(el.getAttribute(key),el,key);
 }
 return {locale,checkedTextNodes,checkedControls,issues};
}
module.exports={collectLocaleSurface};
