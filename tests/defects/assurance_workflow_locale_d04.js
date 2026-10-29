'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {createRequire}=require('node:module');
const React=require('react');
const {JSDOM}=require('jsdom');
const {createRoot}=require('react-dom/client');
const {Simulate}=require('react-dom/test-utils');
const {LocaleProvider,useLocale}=require('../../src/i18n/LocaleContext');
const {assuranceLabel,assuranceMoney,EN}=require('../../src/i18n/assurance-workflow-presentation');
const {auditValuationReadiness,reasonText,ASSET_METHODS}=require('../../src/market/valuation-decision-gate');
const {evaluateAppraisalReportQuality}=require('../../src/market/property-report-quality');
const {buildLearningChangeControlRegistry}=require('../../src/decision-quality/learning-change-control');
let checks=0;
const ok=(condition,message)=>{assert.ok(condition,message);checks++;};

(async()=>{
 for(const [arabic,english] of Object.entries(EN)){
  ok(english.trim()&&!/[\u0600-\u06ff]/.test(english),'English system label: '+arabic);
  ok(assuranceLabel(arabic,'ar-SA')===arabic,'Arabic system label remains unchanged');
 }
 for(const value of Object.values(reasonText))ok(assuranceLabel(value,'en')!==value,'Every quality-gate reason is translated');
 const subject={name:'اسم المصدر العربي HOLD',assetType:'RESIDENTIAL_COMPOUND',landArea:'1200.5',valuationDate:'2026-01-01'};
 const readiness=auditValuationReadiness({subject,report:{},asOf:'2026-01-01T12:00:00Z'});
 const quality=evaluateAppraisalReportQuality({subject,readiness,asOf:'2026-01-01T12:00:00Z'});
 for(const row of quality.items){ok(assuranceLabel(row.label,'en')!==row.label,'Checklist label '+row.id);ok(assuranceLabel(row.criterion,'en')!==row.criterion,'Checklist criterion '+row.id);}
 ok(assuranceMoney(1234.5,'en')==='1,234.5 SAR','Localized currency');
 ok(assuranceLabel('arbitrary source text','en')==='arbitrary source text','Unknown source text passes through');
 const dom=new JSDOM('<div id="root"></div>',{url:'https://synthetic.invalid/'});
 global.window=dom.window;global.document=dom.window.document;global.IS_REACT_ACT_ENVIRONMENT=true;
 const {transformWithOxc}=await import('vite');
 const modules=new Map();
 async function load(name){
  if(modules.has(name))return modules.get(name);
  const file=path.resolve(__dirname,'../../src/components',name+'.jsx');
  let source=fs.readFileSync(file,'utf8');
  const dependencies=[...source.matchAll(/^import (\w+) from '\.\/(\w+)\.jsx';$/gm)];
  for(const dep of dependencies)await load(dep[2]);
  if(name==='AppraisalAssuranceWorkbench')await load('AppraisalReviewSessionContext');
  const exported=[...source.matchAll(/export function (\w+)/g)].map(m=>m[1]);
  const main=source.match(/export default function (\w+)/)?.[1];
  source=source.replace(/^import React(?:,\s*\{([^}]+)\})? from 'react';$/gm,(_,hooks)=>'const React=require("react");'+(hooks?'const {'+hooks+'}=React;':''));
  source=source.replace(/^import (\w+) from '(\.\/\w+\.jsx)';$/gm,(_,id,from)=>'const '+id+'=require('+JSON.stringify(from)+').default;');
  source=source.replace(/^import \{([^}]+)\} from '(\.\/\w+\.jsx)';$/gm,(_,ids,from)=>'const {'+ids+'}=require('+JSON.stringify(from)+');');
  source=source.replaceAll('export default function ','function ').replaceAll('export function ','function ');
  const {code}=await transformWithOxc(source,file,{jsx:{runtime:'classic'}});
  const native=createRequire(file),module={exports:{}};
  const localRequire=id=>id.startsWith('./')&&id.endsWith('.jsx')?modules.get(path.basename(id,'.jsx')):native(id);
  new Function('require','module','exports',code+'\nmodule.exports={'+exported.join(',')+(exported.length&&main?',':'')+(main?'default:'+main:'')+'};')(localRequire,module,module.exports);
  modules.set(name,module.exports);return module.exports;
 }
 const Work=(await load('AppraisalAssuranceWorkbench')).default;
 const Quality=(await load('ValuationQualityPanel')).default;
 const Outcome=(await load('OutcomeMonitoringPanel')).default;
 const Learning=(await load('LearningChangeControlPanel')).default;
 const {AppraisalReviewSessionProvider,useAppraisalReviewSession}=modules.get('AppraisalReviewSessionContext');
 let setLocale;
 function Seed(){const {setSubject}=useAppraisalReviewSession();React.useEffect(()=>setSubject(subject),[]);return null;}
 function Control(){setLocale=useLocale().setLocale;return null;}
 const projectId='SYNTH-PROJECT',caseId='SYNTH-CASE',proposalRef='SYNTH-CHANGE';
 const learningReview={schemaVersion:1,projectId,caseId,status:'READY_FOR_LEARNING_REVIEW',learningCandidateCount:1,learningCandidates:[{id:'NOI',label:'مصدر عربي',plannedValue:100,actualValue:80,materialVariance:true,evidenceRef:'SYNTH-REF',requiresHumanInterpretation:true}],mayUpdatePolicyAutomatically:false,mayUpdateModelAutomatically:false,mayRewritePriorDecision:false,transactionAuthorized:false};
 const governance={projectId,caseId,learningReview,
  humanDispositions:[{candidateId:'NOI',disposition:'ACCEPT_AS_CHANGE_CANDIDATE',reviewerRef:'SYNTH-REVIEWER',decidedAt:'2026-01-01T12:00:00Z',rationale:'Synthetic test only',humanDecisionConfirmed:true,proposalRef,changeKind:'MODEL_LOGIC',targetRef:'MODEL:NOI',changeSummary:'مقترح المصدر الأصلي HOLD'}],
  impactAssessmentsByProposalRef:{[proposalRef]:{assessedBy:'SYNTH-RISK',assessedAt:'2026-01-01T12:00:00Z',impactSummary:'Synthetic test only',riskLevel:'HIGH',affectedDomains:['FINANCE'],testPlanRef:'SYNTH-TEST',rollbackPlanRef:'SYNTH-ROLLBACK',independentReviewRequired:true}},
  changeApprovalsByProposalRef:{[proposalRef]:{decision:'APPROVE_FOR_ENGINEERING',approverRef:'SYNTH-APPROVER',decidedAt:'2026-01-01T12:00:00Z',rationale:'Synthetic test only',humanDecisionConfirmed:true}}};
 const outcome={caseId,projectId,status:'REANALYSIS_REQUIRED',comparisons:[{id:'NOI',label:'بيان المصدر العربي',evidenceRef:'https://source.invalid/NOI',plannedValue:100,actualValue:80,materialVariance:true,explanation:'ملاحظة أصلية HOLD'}],requiredActions:{humanReviewRequired:true},reanalysisRequired:true};
 const original=JSON.stringify({readiness,quality,learningReview,governance,outcome});
 const registry=buildLearningChangeControlRegistry(governance);
 ok(registry.transactionAuthorized===false&&registry.authority.productionChangeAuthorized===false,'Synthetic engineering approval grants no production authority');
 function Harness(){return React.createElement(LocaleProvider,null,React.createElement(Control),React.createElement(AppraisalReviewSessionProvider,null,React.createElement(Seed),React.createElement(Work,{intakeRecord:{digest:'a'.repeat(64)}})),React.createElement(Quality,{readiness,quality,studyAsOf:{date:'2026-01-01',origin:'USER_VALUATION_DATE'}}),React.createElement(Outcome,{outcomeFeedback:outcome,learningReview}),React.createElement(Learning,governance));}
 const root=createRoot(document.getElementById('root'));
 await React.act(async()=>root.render(React.createElement(Harness)));
 const byId=id=>document.querySelector('[data-testid="'+id+'"]');
 const click=id=>React.act(async()=>Simulate.click(byId(id)));
 const change=(id,value)=>React.act(async()=>Simulate.change(byId(id),{target:{value,checked:value}}));
 await click('appraisal-assurance-toggle');
 for(const [field,value] of Object.entries({'reportId':'تقرير أصلي HOLD','property-name':subject.name,'property-assetType':subject.assetType,'property-areaSqm':'١٬٢٠٠٫٥','valuationDate':'2026-01-01','income-annualNoiSar':'٢٬١٠٠٬٠٠٠','income-capitalizationRatePct':'7','income-indicatedValueSar':'55000000'}))await change('current-'+field,value);
 await change('appraisal-confirm-identity',true);
 await click('appraisal-link-to-study');
 ok(byId('appraisal-audit-status').dataset.status==='HOLD','Arithmetic mismatch holds the report');
 ok(byId('appraisal-link-message').textContent.includes('تم الربط'),'Arabic action result');
 const snapshot=()=>[...byId('appraisal-assurance-workbench').querySelectorAll('input,select')].map(x=>({id:x.dataset.testid||x.getAttribute('aria-label'),value:x.value,checked:x.checked,options:x.tagName==='SELECT'?[...x.options].map(o=>o.value):null}));
 const before=snapshot().map(x=>({...x,id:x.id?.includes('مصدر')?'rent-source':x.id}));
 await React.act(async()=>setLocale('en'));
 ok(byId('appraisal-assurance-workbench').dir==='ltr','Audit direction follows locale');
 ok(byId('appraisal-link-message').textContent.includes('Linked, with value and export held'),'Existing action message changes language without repeating the action');
 ok(byId('appraisal-calculated-value').textContent==='30,000,000 SAR','Numeric result localized without recalculation changes');
 ok(byId('appraisal-audit-status').dataset.status==='HOLD','Language switch cannot authorize the report');
 const englishSnapshot=snapshot().map(x=>({...x,id:x.id==='Rent source'?'rent-source':x.id}));
 ok(JSON.stringify(before)===JSON.stringify(englishSnapshot),'All raw fields, options and declarations preserved');
 const noArabicSystemText=node=>{const copy=node.cloneNode(true);copy.querySelectorAll('[data-user-content],input,textarea,code,script,style').forEach(x=>x.remove());return !/[\u0600-\u06ff]/.test(copy.textContent);};
 for(const id of ['appraisal-assurance-workbench','valuation-quality-gates','outcome-monitoring-panel','learning-change-control-panel','engineering-change-qualification-panel']){
  ok(byId(id)?.dir==='ltr','Panel direction '+id);
  ok(noArabicSystemText(byId(id)),'No untranslated system text in '+id);
 }
 ok(document.body.textContent.includes('مقترح المصدر الأصلي HOLD')&&document.body.textContent.includes('ملاحظة أصلية HOLD'),'Original source narratives are preserved');
 ok(document.body.textContent.includes('All production and transaction authority remains locked'),'English authority boundary');
 for(const kind of ['HOTEL','COMMERCIAL_MALL','WAREHOUSE','LOGISTICS_PARK','FUEL_STATION']){
  await change('current-property-assetType',kind);
  ok(noArabicSystemText(byId('appraisal-specialist-fields')),'All specialist field labels translated: '+kind);
  const numeric=byId('appraisal-specialist-fields').querySelector('input[inputmode=decimal]');
  await React.act(async()=>Simulate.change(numeric,{target:{value:'١٢٣٫٥'}}));
  const value=numeric.value;
  await React.act(async()=>setLocale('ar-SA'));
  ok(numeric.value===value&&byId('appraisal-assurance-workbench').dir==='rtl','Specialist input survives Arabic switch '+kind);
  await React.act(async()=>setLocale('en'));
  ok(numeric.value===value,'Specialist input survives English switch '+kind);
 }
 await React.act(async()=>setLocale('ar-SA'));
 ok(document.body.textContent.includes('جميع صلاحيات الإنتاج والمعاملات تظل مقفلة'),'Arabic authority boundary');
 ok(JSON.stringify({readiness,quality,learningReview,governance,outcome})===original,'No domain records or authority fields mutated');
 for(const type of Object.keys(ASSET_METHODS))ok(ASSET_METHODS[type].primary,'Every asset method remains present');
 await React.act(async()=>root.unmount());dom.window.close();
 console.log('D04_ASSURANCE_WORKFLOW_LOCALE=PASS checks='+checks);
})().catch(error=>{console.error(error);process.exitCode=1;});
