import React,{createContext,useCallback,useContext,useMemo,useState} from 'react';

// Deliberately local React state: no global variable, URL query, server upload,
// background sync or evidence authorization. Case linking only scopes drafts.
const CaseContext=createContext(null);
export function PersonalCaseSessionProvider({children}){
 const [linkedCase,setCase]=useState(null);
 const [researchScope,setResearchScope]=useState(null);
 const setLinkedCase=useCallback((value)=>{
  const next=value&&typeof value.caseId==='string'&&value.caseId.trim()
   ?{caseId:value.caseId.trim().slice(0,160),name:String(value.name||'').slice(0,200),
      mode:value.mode==='land'?'land':'building'}
   :null;
  setResearchScope(null);
  setCase(previous=>previous?.caseId===next?.caseId &&
    previous?.name===next?.name && previous?.mode===next?.mode?previous:next);
 },[]);
 // Only an explicitly linked case may share common research metadata. No computed outputs,
 // property identity, approval or evidence claims are propagated between tools.
 const publishResearchScope=useCallback(({caseId,marketScopeRef,asOfDate}={})=>{
  if(!linkedCase||caseId!==linkedCase.caseId||typeof marketScopeRef!=='string'||!marketScopeRef.trim()||marketScopeRef.length>160||typeof asOfDate!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(asOfDate)||!Number.isFinite(Date.parse(asOfDate))||new Date(asOfDate+'T00:00:00Z').toISOString().slice(0,10)!==asOfDate)return false;
  setResearchScope({caseId,marketScopeRef:marketScopeRef.trim(),asOfDate});
  return true;
 },[linkedCase]);
 const currentResearchScope=researchScope?.caseId===linkedCase?.caseId?researchScope:null;
 const v=useMemo(()=>({linkedCase,setLinkedCase,researchScope:currentResearchScope,publishResearchScope}),[linkedCase,setLinkedCase,currentResearchScope,publishResearchScope]);
 return <CaseContext.Provider value={v}>{children}</CaseContext.Provider>;
}
export function usePersonalCaseSession(){
 const context=useContext(CaseContext);
 if(!context)throw Error('PERSONAL_CASE_SESSION_PROVIDER_REQUIRED');
 return context;
}
