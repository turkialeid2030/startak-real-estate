'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {createRequire}=require('node:module');
const React=require('react'),{JSDOM}=require('jsdom'),{createRoot}=require('react-dom/client'),{Simulate}=require('react-dom/test-utils');
const {LocaleProvider,useLocale}=require('../../src/i18n/LocaleContext');
const {governanceEvidenceLabel:label}=require('../../src/i18n/governance-evidence-presentation');
const project=require('../../src/project-model/project-profile');
const documents=require('../../src/document-intelligence/contracts');
const verification=require('../../src/document-intelligence/evidence-verification-readiness');
const qualification=require('../../src/document-intelligence/parsed-evidence-qualification');
let checks=0;const ok=(condition,message)=>{assert.ok(condition,message);checks++;};
(async()=>{
 for(const group of [project.ASSET_CLASS,project.LIFECYCLE_STAGE,project.INVESTMENT_STRATEGY,project.INCOME_MODEL,documents.AUTHORITY_CLASS,documents.TRUTH_STATUS,documents.VERIFICATION_STATUS,documents.LOCATOR_KIND,documents.MATERIALITY,qualification.PARSED_EVIDENCE_QUALIFICATION_STATUS,verification.EVIDENCE_VERIFICATION_GATE_STATUS,verification.EVIDENCE_VERIFICATION_OUTCOME,verification.EVIDENCE_VERIFICATION_DECISION_STATUS,require('../../src/document-intelligence/parsers/contracts').PARSER_STATUS,require('../../src/runtime/canonical-case-workspace').WORKSPACE_STATUS,require('../../src/investment-committee/decision-dossier').DOSSIER_STATUS,require('../../src/decision-actions').ACTION_STATUS])for(const code of Object.values(group)){
  ok(label(code,'ar-SA')!==code&&/[\u0600-\u06ff]/.test(label(code,'ar-SA')),'Arabic label '+code);
  ok(label(code,'en')!==code&&!/[\u0600-\u06ff]/.test(label(code,'en')),'English label '+code);
 }
 ok(label('FUTURE_UNKNOWN_CODE','en')==='FUTURE_UNKNOWN_CODE','Unknown code remains inspectable, never treated as approval');
 const dom=new JSDOM('<div id="root"></div>',{url:'https://synthetic.invalid/'});
 global.window=dom.window;global.document=dom.window.document;global.IS_REACT_ACT_ENVIRONMENT=true;
 const {transformWithOxc}=await import('vite'),cache=new Map();
 async function load(name){
  if(cache.has(name))return cache.get(name);
  const file=path.resolve(__dirname,'../../src/components',name+'.jsx');let source=fs.readFileSync(file,'utf8');
  for(const dep of [...source.matchAll(/^import (?:\w+|\{[^}]+\}) from '\.\/(\w+)\.jsx';$/gm)])await load(dep[1]);
  const main=source.match(/export default function (\w+)/)?.[1],named=[...source.matchAll(/export function (\w+)/g)].map(m=>m[1]);
  source=source.replace(/^import React(?:,\s*\{([^}]+)\})? from 'react';$/gm,(_,hooks)=>'const React=require("react");'+(hooks?'const {'+hooks+'}=React;':''));
  source=source.replace(/^import (\w+) from '(\.\/\w+\.jsx)';$/gm,(_,id,from)=>'const '+id+'=require('+JSON.stringify(from)+').default;');
  source=source.replace(/^import \{([^}]+)\} from '(\.\/\w+\.jsx)';$/gm,(_,ids,from)=>'const {'+ids+'}=require('+JSON.stringify(from)+');');
  source=source.replace(/^import \{([^}]+)\} from '([^']+)';$/gm,(_,ids,from)=>'const {'+ids+'}=require('+JSON.stringify(from)+');');
  source=source.replace(/^export \{[^}]+\};$/gm,'').replaceAll('export default function ','function ').replaceAll('export function ','function ');
  const {code}=await transformWithOxc(source,file,{jsx:{runtime:'classic'}}),native=createRequire(file),module={exports:{}};
  new Function('require','module','exports',code+'\nmodule.exports={'+named.join(',')+(main&&named.length?',':'')+(main?'default:'+main:'')+'};')(id=>id.startsWith('./')&&id.endsWith('.jsx')?cache.get(path.basename(id,'.jsx')):native(id),module,module.exports);
  cache.set(name,module.exports);return module.exports;
 }
 const Verify=(await load('LocalEvidenceVerificationPanel')).default,Intake=(await load('LocalDocumentEvidenceIntakePanel')).default,Committee=(await load('InvestmentCommitteeDossierPanel')).default,Post=(await load('PostDecisionGovernancePanel')).default;
 const digest='b'.repeat(64),documentId='local-sha256:'+digest,caseId='SYNTH-LOCAL-CASE';
 const atom={schemaVersion:1,atomId:'SYNTH-CELL',documentId,caseId,adapterId:'XLSX_DETERMINISTIC_V1',kind:'CELL',rawValue:1800,valueType:'NUMBER',location:{kind:'CELL',sheet:'الأصل العربي',cell:'B7'},metadata:{}};
 const intake={fileName:'المصدر الأصلي.xlsx',size:13000,digest,mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',documentId,caseId,receivedAt:'2026-09-01T17:00:00Z',result:{documentId,caseId,adapterId:atom.adapterId,format:'XLSX',status:'PARSED',atoms:[atom],warnings:[],reason:null}};
 const candidate=qualification.buildParsedEvidenceCandidate({intakeRecord:intake,atomId:atom.atomId,semanticKey:'market_rent_per_sqm',valueType:'NUMBER',unit:'SAR/sqm/year',materiality:'MATERIAL',sourceReference:'المصدر الأصلي / HOLD',sourceDate:'2026-08-31',reviewerRef:'SYNTH-REVIEWER',reviewerNote:'Synthetic only',capturedAt:'2026-09-01T17:10:00Z'});
 ok(candidate.status==='CANDIDATE_REQUIRES_VERIFICATION','Valid synthetic candidate');
 const dossier={caseId,projectId:'SYNTH-PROJECT',status:'HOLD_WORKSPACE',executiveSummary:{decisionReliability:'INSUFFICIENT',openActionCount:1},analyticalAttachments:{financial:{}},evidenceAndAssumptions:{evidence:[],assumptions:[]},actionRegister:{actions:[{actionId:'ACTION-SOURCE',description:'EVIDENCE',type:'EVIDENCE',ownerId:'المسؤول الأصلي HOLD',status:'OPEN',requiredEvidenceKeys:['SOURCE_KEY']}]},aiReview:{analyst:{status:'ACCEPTED_FOR_REVIEW_ONLY',narrative:'سرد المصدر الأصلي HOLD',uncertainties:['تحفظ المصدر'],disagreements:['اختلاف المصدر']}}};
 const canonical={caseId,projectId:'SYNTH-PROJECT'};
 const original=JSON.stringify({candidate,dossier,canonical});let setLanguage,published=null,notifications=0;
 function Control(){setLanguage=useLocale().setLocale;return null;}
 const onRecord=value=>{published=value;notifications++;};
 function Harness(){return React.createElement(LocaleProvider,null,React.createElement(Control),React.createElement(Verify,{candidate,onVerificationRecordChange:onRecord}),React.createElement(Intake),React.createElement(Committee,{dossier}),React.createElement(Post,{canonicalWorkspace:canonical}));}
 const root=createRoot(document.getElementById('root'));await React.act(async()=>root.render(React.createElement(Harness)));
 const byId=id=>document.querySelector('[data-testid="'+id+'"]');
 const change=async(id,value)=>React.act(async()=>Simulate.change(byId(id),{target:{value,checked:value}}));
 const click=async(id)=>React.act(async()=>Simulate.click(byId(id)));
 const fields={'verification-attestation-id':'SYNTH-ATT','verification-verifier-ref':'SYNTH-VERIFIER','verification-verifier-role':'SYNTH-ROLE','verification-identity-ref':'SYNTH-IDENTITY','verification-method':'SYNTH-METHOD','verification-reference':'SYNTH-WORKPAPER','verification-authority-class':'CONTRACTUAL','verification-authority-ref':'SYNTH-AUTHORITY','verification-verified-at':'2026-09-02T12:00'};
 for(const [id,value]of Object.entries(fields))await change(id,value);
 for(const id of ['verification-original-check','verification-semantic-check','verification-conflict-check'])await change(id,true);
 await click('assess-verification-packet');ok(byId('verification-gate-result').dataset.status==='READY_FOR_HUMAN_VERIFICATION_DECISION','Packet ready for explicit human decision: '+byId('verification-gate-result').textContent);
 await change('verification-outcome','VERIFY_FACT');
 for(const [id,value]of Object.entries({'verification-decision-id':'SYNTH-DECISION','verification-decided-by':'SYNTH-HUMAN','verification-decision-ref':'SYNTH-DECISION-EVIDENCE','verification-decided-at':'2026-09-03T12:00'}))await change(id,value);
 const acknowledgements=['verification-decision-conflict','verification-ack-source','verification-ack-semantic','verification-ack-authority','verification-ack-method','verification-ack-accountability'];
 for(const id of acknowledgements)await change(id,true);
 await click('record-verification-decision');ok(published?.status==='DECISION_RECORDED','Separate internal decision recorded');
 ok(published?.transactionAuthorized===false&&published?.financialEngineEligible===false&&published?.externalCertificationEstablished===false,'Recorded decision grants no financial or external authority');
 const stored=JSON.stringify(published),calls=notifications;
 const snapshot=()=>[...byId('local-evidence-verification').querySelectorAll('input,select')].map(e=>({id:e.dataset.testid,value:e.value,checked:e.checked,options:e.options?[...e.options].map(o=>o.value):null}));
 const raw=snapshot();await React.act(async()=>setLanguage('en'));
 ok(JSON.stringify(raw)===JSON.stringify(snapshot()),'Language switch retains every packet/decision field, option and acknowledgement');
 ok(JSON.stringify(published)===stored&&notifications===calls,'Language switch does not reissue verification or change evidence');
 function systemText(node){const copy=node.cloneNode(true);copy.querySelectorAll('[data-user-content],[data-diagnostic-content],code,input,textarea').forEach(e=>e.remove());return copy.textContent;}
 for(const id of ['local-evidence-verification','local-document-evidence-intake','investment-committee-dossier','post-decision-governance-panel']){ok(byId(id).dir==='ltr','English direction '+id);ok(!/[\u0600-\u06ff]/.test(systemText(byId(id))),'English system text '+id);}
 ok(byId('investment-committee-dossier').textContent.includes('سرد المصدر الأصلي HOLD'),'Original source narrative retained');
 await change('verification-decision-ref','SYNTH-DECISION-CHANGED');
 ok(published===null&&!byId('verification-decision-result'),'Decision metadata edit revokes displayed/published record');
 ok(acknowledgements.every(id=>!byId(id).checked),'Metadata edit clears prior acknowledgements');
 await change('verification-authority-ref','SYNTH-AUTHORITY-CHANGED');
 ok(!byId('verification-gate-result')&&byId('record-verification-decision').disabled,'Packet edit synchronously revokes gate and disables decision');
 ok(['verification-original-check','verification-semantic-check','verification-conflict-check'].every(id=>!byId(id).checked),'Packet metadata edit clears source attestations');
 for(const id of ['verification-original-check','verification-semantic-check','verification-conflict-check'])await change(id,true);
 await click('assess-verification-packet');ok(byId('verification-gate-result').dataset.status==='READY_FOR_HUMAN_VERIFICATION_DECISION','Reassessment uses new packet');
 await change('verification-decision-conflict',true);
 await click('record-verification-decision');ok(published?.status==='HOLD_ACKNOWLEDGEMENTS','Old acknowledgements cannot verify revised packet');
 ok(published?.transactionAuthorized===false,'Held result grants no transaction authority');
 for(const [id,value] of Object.entries(fields)){
  const alternate=id==='verification-authority-class'?'LICENSED_PROFESSIONAL':id==='verification-verified-at'?'2026-09-02T13:00':value+'-EDIT';
  await change(id,alternate);
  ok(!byId('verification-gate-result')&&!byId('verification-decision-result')&&published===null,'Every packet field revokes previous derived states: '+id);
  ok(['verification-original-check','verification-semantic-check','verification-conflict-check'].every(key=>!byId(key).checked),'Every packet field requires fresh source attestations: '+id);
  await change(id,value);
  ok(!byId('verification-gate-result'),'Restoring old text cannot resurrect a revoked gate: '+id);
  for(const key of ['verification-original-check','verification-semantic-check','verification-conflict-check'])await change(key,true);
  await click('assess-verification-packet');
  ok(byId('verification-gate-result').dataset.status==='READY_FOR_HUMAN_VERIFICATION_DECISION','Reassess current packet: '+id);
 }
 await React.act(async()=>Simulate.change(byId('local-document-file-input'),{target:{files:[{name:'invalid.txt',size:1}]}}));
 ok(byId('local-document-evidence-intake').querySelector('[role=alert]').textContent.includes('Unsupported file type'),'English file failure shown');
 await React.act(async()=>setLanguage('ar-SA'));
 ok(byId('local-document-evidence-intake').querySelector('[role=alert]').textContent.includes('نوع الملف غير مدعوم'),'Prior failure retranslated without file retry');
 ok(byId('investment-committee-dossier').dir==='rtl'&&byId('post-decision-governance-panel').dir==='rtl','Arabic directions restored');
 ok(JSON.stringify({candidate,dossier,canonical})===original,'Source values, identifiers and authority fields are immutable');
 await React.act(async()=>root.unmount());dom.window.close();
 console.log('D04_GOVERNANCE_EVIDENCE_INTEGRITY=PASS checks='+checks);
})().catch(error=>{console.error(error);process.exitCode=1;});
