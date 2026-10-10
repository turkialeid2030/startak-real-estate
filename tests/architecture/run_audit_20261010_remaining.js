'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {createRequire}=require('node:module'),{JSDOM}=require('jsdom');
const {createRentalCalendar,rentalCalendarDisclosure}=require('../../src/app/rental-calendar-disclosure');
const {pdfFixture}=require('../fixtures/bounded-pdf');
const {parseDocument}=require('../../src/document-intelligence/parsers');
const {createManualTranscription}=require('../../src/document-intelligence/manual-transcription');
const {buildParsedEvidenceCandidate}=require('../../src/document-intelligence/parsed-evidence-qualification');
const {createLocalReviewJournal,readLocalReviewJournal}=require('../../src/storage/local-review-journal');
const {ASSET_CLASS}=require('../../src/project-model/project-profile');
const {ASSET_SUPPORT,financialModelScope}=require('../../src/project-model/asset-support');
const {recordInputProvenance,provenanceForInputs}=require('../../src/app/input-provenance');
const {validateSavedDealRecord}=require('../../src/validation/saved-deal-schema');
const {projectDealRecord}=require('../../src/storage/saved-deals-backup');
const actions=require('../../src/decision-actions/local-case-actions');
const {buildCanonicalCommitteePreparation}=require('../../src/runtime/canonical-governance-projections');
const gold=require('../reference/RE-GOLD-baseline.json');
const {buildPersonalFinancialStudy,htmlFinancialStudy,verifyPersonalFinancialStudy}=require('../../src/app/personal-financial-study');
let checks=0;function check(value,message){assert.ok(value,message);checks++;}function throws(fn,pattern){assert.throws(fn,pattern);checks++;}
(async()=>{
 const document={documentId:'TEST-NATIVE',caseId:'CASE-TEST',fileName:'native.pdf',mimeType:'application/pdf'};
 const bytes=pdfFixture();const result=await parseDocument({document,content:bytes});
 check(result.status==='PARSED',`native: ${result.reason}`);
 check(result.atoms.some(a=>a.rawValue.includes('1500.00')),'native numeric text preserved');
 check(result.atoms.some(a=>/[\u0600-\u06ff]/.test(a.rawValue)),'ToUnicode Arabic text extracted');
 check(result.atoms[0].location.page===1&&result.atoms[0].truthSemantics==='PARSED_CONTENT_ONLY_NOT_EVIDENCE','page trace and truth boundary retained');
 check(bytes.slice(0,5).toString()==='%PDF-','source bytes are not transferred/detached');
 for(const[content,options,reason]of [
   [Buffer.from('%PDF-1.7\ncorrupt'),{},'PDF_INVALID_OR_CORRUPT'],
   [require('../fixtures/encrypted-pdf'),{},'PDF_PASSWORD_REQUIRED'],
   [pdfFixture({blank:true}),{},'PDF_NO_EXTRACTABLE_TEXT'],
   [pdfFixture({pages:2}),{maxPages:1},'PDF_LIMIT_EXCEEDED'],
   [bytes,{maxCharacters:1},'PDF_LIMIT_EXCEEDED'],
   [pdfFixture({pages:2}),{maxAtoms:1},'PDF_LIMIT_EXCEEDED'],
   [bytes,{signal:AbortSignal.abort()},'PDF_PARSER_ABORTED'],
   [bytes,{timeoutMs:5,loadPdfLibrary:async()=>({getDocument:()=>({promise:new Promise(()=>{}),destroy:async()=>{}})})},'PDF_PARSER_TIMEOUT'],
   [Buffer.concat([Buffer.from('%PDF-'),Buffer.alloc(40*1024*1024)]),{},'PDF_FILE_TOO_LARGE'],
 ]){const held=await parseDocument({document,content,options});check(held.reason===reason&&held.atoms.length===0,`${reason}: no partial atoms`);}
 const original={fileName:'native.pdf',size:bytes.length,digest:'a'.repeat(64),documentId:document.documentId,caseId:document.caseId,mimeType:'application/pdf',receivedAt:'2026-10-10T00:00:00Z',result};
 const manual=createManualTranscription({intakeRecord:original,text:'1500',page:1,reviewerRef:'transcriber',note:'table, rent column',capturedAt:'2026-10-10T01:00:00Z'});
 check(manual.result.atoms[0].rawValue==='1500'&&manual.originalParserOutcome.status==='PARSED','manual value preserves original parser outcome');
 const candidate=buildParsedEvidenceCandidate({intakeRecord:manual,atomId:manual.result.atoms[0].atomId,semanticKey:'market.rent',valueType:'NUMBER',unit:'SAR/sqm/year',sourceReference:'original page 1',sourceDate:'2026-10-01',reviewerRef:'reviewer',reviewerNote:'compared column',capturedAt:'2026-10-10T02:00:00Z'});
 check(candidate.fact.normalizedValue===1500&&candidate.financialEngineEligible===false&&candidate.verifiedFactEstablished===false,'manual semantic candidate is not verified or adopted');
 throws(()=>createManualTranscription({intakeRecord:original,text:'value',page:0,reviewerRef:'x',note:'n',capturedAt:'2026-10-10'}),/LOCAL_RECORD_INVALID/);
 const scope={caseId:document.caseId,projectId:null,kind:'EVIDENCE'};const journal=createLocalReviewJournal({...scope,payload:{candidate}});
 check(readLocalReviewJournal(JSON.stringify(journal),scope).payload.candidate.fact.normalizedValue===1500,'journal roundtrip retains source value');
 throws(()=>readLocalReviewJournal(JSON.stringify(journal),{...scope,caseId:'OTHER'}),/LOCAL_RECORD_SCOPE_MISMATCH/);
 throws(()=>readLocalReviewJournal(JSON.stringify({...journal,payload:{}}),scope),/LOCAL_RECORD_INVALID/);
 throws(()=>createLocalReviewJournal({...scope,payload:JSON.parse('{"__proto__":{"x":1}}')}),/LOCAL_RECORD_INVALID/);
 check(ASSET_SUPPORT.length===Object.keys(ASSET_CLASS).length,'every declared asset has an explicit support row');
 check(ASSET_SUPPORT.every(row=>!row.specialistEngineQualified&&!row.professionalReleaseAuthorized),'matrix cannot imply professional or specialist qualification');
 check(ASSET_SUPPORT.find(r=>r.assetClass==='HOSPITALITY').status==='INTAKE_ONLY','hospitality remains intake only');
 check(financialModelScope('building').calculationScope==='AGGREGATE_RENTAL_CASHFLOWS','building scope describes actual aggregate model');
 const inputs=gold['RE-GOLD-002_existing_building'].inputs;
 const provenance=recordInputProvenance({mode:'building',inputs,field:'buildingPrice',unit:'SAR',sourceKind:'DOCUMENT_REFERENCE',sourceReference:'synthetic price page 1',sourceDate:'2026-10-01',location:'Riyadh',reviewerRef:'user',documentDigestSha256:'b'.repeat(64)});
 check(provenanceForInputs('building',inputs,provenance).buildingPrice.status==='USER_SUPPLIED_UNVERIFIED','referenced inputs remain unverified');
 check(provenanceForInputs('building',{...inputs,buildingPrice:1},provenance).buildingPrice.status==='VALUE_CHANGED_RECHECK_SOURCE','editing input invalidates its source match');
 check(provenanceForInputs('building',inputs,provenance).rentPerSqm.status==='SOURCE_NOT_RECORDED','unreferenced fields are explicit');
 const deal={id:'test',name:'mixed / العقار',mode:'building',inputs,inputProvenance:provenance};validateSavedDealRecord(deal);checks++;
 check(projectDealRecord(deal).inputProvenance.entries.buildingPrice.documentDigestSha256==='b'.repeat(64),'backup projection retains provenance');
 throws(()=>validateSavedDealRecord({...deal,mode:'land'}),/INVALID_INPUT_PROVENANCE/);
 throws(()=>validateSavedDealRecord({...deal,inputProvenance:{...provenance,entries:{buildingPrice:{...provenance.entries.buildingPrice,authorityVerified:true}}}}),/INVALID_INPUT_PROVENANCE/);
 const report=buildPersonalFinancialStudy({mode:'building',inputs,assumptionModelVersion:'LEGACY',inputProvenance:provenance});
 check(verifyPersonalFinancialStudy(report)&&report.financial.inputProvenance.buildingPrice.status==='USER_SUPPLIED_UNVERIFIED','financial export binds provenance to report digest');
 check(htmlFinancialStudy(report).includes('synthetic price page 1'),'HTML preserves source reference');
 const workspace={workspaceId:'WS-TEST',projectId:'PROJECT-TEST',caseId:'CASE-TEST',executableCase:{inputs},orchestration:{unresolvedLifecycleSections:['documents','inspection'],reasonCodes:['LIFECYCLE_GAP:documents','LIFECYCLE_GAP:inspection']}};
 let entry=actions.createLocalCaseAction({workspace,section:'documents',ownerId:'owner',actorId:'recorder',dueDate:'2026-10-11',occurredAt:'2026-10-10T01:00:00Z'});
 throws(()=>actions.advanceLocalCaseAction({entry,toStatus:'CLOSED',actorId:'reviewer',occurredAt:'2026-10-10T02:00:00Z'}),/HUMAN_CLOSURE_REVIEW_REQUIRED/);
 entry=actions.advanceLocalCaseAction({entry,toStatus:'IN_PROGRESS',actorId:'owner',occurredAt:'2026-10-10T02:00:00Z'});
 throws(()=>actions.advanceLocalCaseAction({entry,toStatus:'SATISFIED_PENDING_REVIEW',actorId:'owner',occurredAt:'2026-10-10T03:00:00Z'}),/REQUIRED_EVIDENCE_NOT_SATISFIED/);
 entry=actions.advanceLocalCaseAction({entry,toStatus:'SATISFIED_PENDING_REVIEW',actorId:'owner',occurredAt:'2026-10-10T03:00:00Z',evidenceRef:'source page 1'});
 throws(()=>actions.advanceLocalCaseAction({entry,toStatus:'CLOSED',actorId:'owner',occurredAt:'2026-10-10T04:00:00Z',evidenceRef:'source page 1',reviewNote:'checked'}),/HUMAN_CLOSURE_REVIEW_REQUIRED/);
 entry=actions.advanceLocalCaseAction({entry,toStatus:'CLOSED',actorId:'reviewer',occurredAt:'2026-10-10T04:00:00Z',evidenceRef:'source page 1',reviewNote:'checked'});
 check(actions.localCaseActionRegister(workspace,[entry]).openCount===0,'local action closes after independent declared human review');
 const exported=actions.exportLocalCaseActions(workspace,[entry]);check(actions.restoreLocalCaseActions(workspace,JSON.stringify(exported))[0].history.events.length===4,'restore replays valid history');
 throws(()=>actions.restoreLocalCaseActions({...workspace,executableCase:{inputs:{buildingPrice:5}}},JSON.stringify(exported)),/LOCAL_RECORD_SCOPE_MISMATCH/);
 check(buildCanonicalCommitteePreparation(workspace,actions.localCaseActionRegister(workspace,[entry])).committeeDossier.status==='HOLD_WORKSPACE','local closure cannot promote committee or case authority');
 const licensed=actions.createLocalCaseAction({workspace,section:'inspection',ownerId:'owner',actorId:'recorder',dueDate:'2026-10-11',occurredAt:'2026-10-10T01:00:00Z'});
 throws(()=>actions.advanceLocalCaseAction({entry:licensed,toStatus:'CLOSED',actorId:'reviewer',occurredAt:'2026-10-10T02:00:00Z',evidenceRef:'x',reviewNote:'checked'}),/LICENSED_PROFESSIONAL_REVIEW_REQUIRED/);
 const guardFile=path.resolve(__dirname,'../../src/components/StrictArabicSurfaceGuard.jsx');
 const source=fs.readFileSync(guardFile,'utf8').replace(/^import React,.*\n/m,'').replace('export default function ','function ').replace(/export \{[^}]+\};/,'');
 const dom=new JSDOM('<div id="root"><p id="reason">LIFECYCLE_GAP:TECHNICAL_INSPECTION</p><p id="unknown">Original English source reason</p><p data-user-content id="user">NAME / اسم ABC</p></div>');
 const context={require:createRequire(guardFile),document:dom.window.document,NodeFilter:dom.window.NodeFilter};
 vm.runInNewContext(source+'\nprocessTree(document.getElementById("root"));',context);
 const first=dom.window.document.body.textContent;
 check(first.includes('LIFECYCLE_GAP:TECHNICAL_INSPECTION')&&first.includes('الفحص الفني'),'compound diagnostic keeps code and meaningful Arabic');
 check(first.includes('Original English source reason'),'fallback does not erase source prose');
 for(let i=0;i<3;i++)vm.runInNewContext('processTree(document.getElementById("root"));',context);
 check(dom.window.document.body.textContent===first,'DOM translation is idempotent');
 check(dom.window.document.getElementById('user').textContent==='NAME / اسم ABC','free user text remains verbatim');dom.window.close();
 const calendar=createRentalCalendar({studyStartDate:'2026-10-10',locationScope:'RIYADH_URBAN',leaseCategory:'COMMERCIAL',contractReference:'synthetic',lastRentReference:'base rent',exceptionReference:''});
 const disclosure=rentalCalendarDisclosure({mode:'building',inputs:{rentGrowthRate:0.05},result:{cashflows:Array(7).fill(0)},context:calendar,asOfDate:'2026-10-10'});
 check(disclosure.periods[0].status==='RENT_GROWTH_REVIEW_REQUIRED'&&disclosure.periods[5].status==='OUTSIDE_CHECKED_RENT_FREEZE_SCOPE_REVIEW_REQUIRED','growth review is limited to calendar overlap; no perpetual freeze');
 check(disclosure.eligibleForRealWorldAdoption===false&&!disclosure.financialFormulaAdjusted,'calendar context cannot certify legal adoption or silently change formulas');
 check(rentalCalendarDisclosure({mode:'land',inputs:{rentGrowthRate:0.03,constructionPeriod:2},result:{cashflows:Array(5).fill(0),constructionYears:2},context:calendar,asOfDate:'2026-10-10'}).periods[0].operating===false,'construction period is separately identified in calendar');
 check(rentalCalendarDisclosure({mode:'building',inputs:{rentGrowthRate:0},result:{cashflows:[0,0]},context:calendar,asOfDate:'2027-02-01'}).status==='REGULATORY_SOURCE_RECHECK_REQUIRED','stale source requires fresh official review');
 throws(()=>createRentalCalendar({...calendar,studyStartDate:'2026-02-30'}),/INVALID_RENTAL_CALENDAR/);
 throws(()=>buildCanonicalCommitteePreparation(workspace,{caseId:'OTHER',projectId:workspace.projectId,actions:[]}),/ACTION_CASE_OR_PROJECT_ISOLATION_VIOLATION/);
 console.log(`AUDIT_REMAINING_IMPLEMENTATION=PASS checks=${checks}`);
})().catch(e=>{console.error(e);process.exit(1);});
