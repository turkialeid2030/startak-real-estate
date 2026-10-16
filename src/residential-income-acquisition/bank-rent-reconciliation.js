'use strict';
const {calculateReceivablesLedger,parseLedgerAmount}=require('./receivables-ledger');
const {normalizeNumericText}=require('../validation/numeric-text');
const fail=code=>{throw new TypeError(code);};
const text=v=>{if(typeof v!=='string'||!v.trim()||v.length>500)fail('BANK_REFERENCE_REQUIRED');return v.trim();};
const date=v=>{if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v)||!Number.isFinite(Date.parse(v))||new Date(v).toISOString().slice(0,10)!==v)fail('BANK_DATE_INVALID');return v;};
function parseStatementBalance(value){
  if(typeof value!=='string'&&typeof value!=='number')fail('BANK_BALANCE_INVALID');
  const normalized=normalizeNumericText(value);if(!normalized.ok)fail('BANK_BALANCE_INVALID');const s=normalized.normalized;
  if(/^-?0+(?:\.0{1,2})?$/.test(s))return 0;
  return s.startsWith('-')?-parseLedgerAmount(s.slice(1)):parseLedgerAmount(s);
}
function validateBankRentStatement(input,c){
  if(!input||input.schemaVersion!==1||input.caseId!==c.caseId||input.currency!=='SAR'||!Array.isArray(input.entries)||input.entries.length>5000)fail('BANK_STATEMENT_INVALID');
  const accountRef=text(input.accountRef),sourceRef=text(input.sourceRef),reviewRef=text(input.reviewRef);
  if(sourceRef===reviewRef)fail('BANK_DISTINCT_REVIEW_REQUIRED');
  const periodStart=date(input.periodStart),periodEndExclusive=date(input.periodEndExclusive);
  const next=new Date(Date.parse(c.asOfDate.slice(0,10))+86400000).toISOString().slice(0,10);
  if(periodStart>=periodEndExclusive||periodEndExclusive>next)fail('BANK_PERIOD_INVALID');
  const ids=new Set(),refs=new Set(),links=new Set();
  const entries=input.entries.map(e=>{
    if(!e||typeof e!=='object')fail('BANK_STATEMENT_INVALID');
    const id=text(e.id),reference=text(e.reference),when=date(e.date);
    if(ids.has(id)||refs.has(reference))fail('BANK_DUPLICATE_ENTRY');ids.add(id);refs.add(reference);
    if(!['CREDIT','DEBIT'].includes(e.direction))fail('BANK_DIRECTION_INVALID');
    if(when<periodStart||when>=periodEndExclusive)fail('BANK_ENTRY_OUTSIDE_PERIOD');
    if(!Number.isSafeInteger(e.amountMinor)||e.amountMinor<=0)fail('BANK_AMOUNT_INVALID');
    const ledgerEventId=e.ledgerEventId==null||e.ledgerEventId===''?null:text(e.ledgerEventId);
    if(ledgerEventId&&links.has(ledgerEventId))fail('BANK_DUPLICATE_LEDGER_LINK');if(ledgerEventId)links.add(ledgerEventId);
    return {id,reference,date:when,direction:e.direction,amountMinor:e.amountMinor,ledgerEventId};
  });
  let balances;
  if(input.balances!==undefined&&input.balances!==null){
    if(!Number.isSafeInteger(input.balances.openingMinor)||!Number.isSafeInteger(input.balances.closingMinor))fail('BANK_BALANCE_INVALID');
    balances={openingMinor:input.balances.openingMinor,closingMinor:input.balances.closingMinor};
  }
  return {schemaVersion:1,caseId:c.caseId,currency:'SAR',accountRef,sourceRef,reviewRef,periodStart,periodEndExclusive,entries,...(balances?{balances}:{})};
}
function calculateBankRentReconciliation(c){
  const empty={status:'NOT_AVAILABLE',rows:[],unmatchedLedgerIds:[],issues:[],totalsMinor:null,balanceReconciliation:{status:'NOT_PROVIDED'},actualBankBalance:false,coverageComplete:false};
  if(!c.bankRentStatement)return empty;
  const p=validateBankRentStatement(c.bankRentStatement,c),ledger=calculateReceivablesLedger(c);
  const movements=[...ledger.receiptRows.map(x=>({...x,direction:'CREDIT'})),...ledger.refundRows.map(x=>({...x,direction:'DEBIT'}))].filter(x=>x.date>=p.periodStart&&x.date<p.periodEndExclusive);
  const byId=new Map(movements.map(x=>[x.id,x])),matched=new Set(),issues=[];
  let bankCredits=0n,bankDebits=0n,ledgerCredits=0n,ledgerDebits=0n;
  const rows=p.entries.map(e=>{
    if(e.direction==='CREDIT')bankCredits+=BigInt(e.amountMinor);else bankDebits+=BigInt(e.amountMinor);
    const target=byId.get(e.ledgerEventId);let status='MATCHED';
    if(!target)status='UNMATCHED_BANK_ENTRY';
    else if(target.direction!==e.direction)status='DIRECTION_MISMATCH';
    else if(target.amountMinor!==e.amountMinor)status='AMOUNT_MISMATCH';
    else if(target.date!==e.date)status='DATE_MISMATCH';
    if(status==='MATCHED')matched.add(target.id);else issues.push({code:status,bankEntryId:e.id,ledgerEventId:e.ledgerEventId});
    return {...e,status,ledgerDate:target?.date||null,ledgerAmountMinor:target?.amountMinor??null};
  });
  for(const e of movements){if(e.direction==='CREDIT')ledgerCredits+=BigInt(e.amountMinor);else ledgerDebits+=BigInt(e.amountMinor);}
  const unmatchedLedgerIds=movements.filter(e=>!matched.has(e.id)).map(e=>e.id);
  const safe=n=>{if(n>BigInt(Number.MAX_SAFE_INTEGER)||n< -BigInt(Number.MAX_SAFE_INTEGER))fail('BANK_TOTAL_OUT_OF_RANGE');return Number(n);};
  let totalsMinor,balanceReconciliation={status:'NOT_PROVIDED'};
  try{
    totalsMinor={bankCredits:safe(bankCredits),bankDebits:safe(bankDebits),ledgerCredits:safe(ledgerCredits),ledgerDebits:safe(ledgerDebits),creditDifference:safe(bankCredits-ledgerCredits),debitDifference:safe(bankDebits-ledgerDebits)};
    if(p.balances){
      const calculatedClosing=BigInt(p.balances.openingMinor)+bankCredits-bankDebits;
      const difference=BigInt(p.balances.closingMinor)-calculatedClosing;
      balanceReconciliation={status:difference===0n?'MATCHED_ENTERED_BALANCES':'BALANCE_MISMATCH',...p.balances,calculatedClosingMinor:safe(calculatedClosing),differenceMinor:safe(difference),coverageComplete:false,actualBankBalance:false};
      if(difference!==0n)issues.push({code:'BANK_BALANCE_MISMATCH'});
    }
  }
  catch(e){return {...empty,status:'NEEDS_REVIEW',issues:[{code:e.message}]};}
  return {...empty,status:issues.length||unmatchedLedgerIds.length?'NEEDS_REVIEW':'MATCHED_ENTERED_RENT_MOVEMENTS',rows,unmatchedLedgerIds,issues,totalsMinor,balanceReconciliation,
    periodStart:p.periodStart,periodEndExclusive:p.periodEndExclusive,accountRef:p.accountRef,sourceRef:p.sourceRef,reviewRef:p.reviewRef,
    semantics:'One-to-one matching of entered statement rent credits/refund debits against active local rent movements in the declared period. Exact date, direction and amount only. Optional opening plus entered credits less entered debits is compared with entered closing balance; arithmetic equality does not authenticate the statement, bank balance, completeness or reviewer. Missing balances are NOT_PROVIDED, never zero. Non-rent movements require separate accounting review. Recomputed after ledger changes.'};
}
function replaceBankRentStatement(c,draft){
  if(draft?.confirmed!==true)fail('EXPLICIT_VERIFICATION_CONFIRMATION_REQUIRED');
  if(!Array.isArray(draft.entries))fail('BANK_STATEMENT_INVALID');
  const {balances:ignored,...fields}=draft;
  const balances=draft.balanceControl===true?{openingMinor:parseStatementBalance(draft.openingAmount),closingMinor:parseStatementBalance(draft.closingAmount)}:undefined;
  const bankRentStatement=validateBankRentStatement({...fields,balances,schemaVersion:1,caseId:c.caseId,currency:'SAR',entries:draft.entries.map(e=>({...e,amountMinor:parseLedgerAmount(e.amount)}))},c);
  return require('./contracts').createResidentialIncomeOperatingCase({...c,bankRentStatement});
}
module.exports={validateBankRentStatement,calculateBankRentReconciliation,replaceBankRentStatement};
