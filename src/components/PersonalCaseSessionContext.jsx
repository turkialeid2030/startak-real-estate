import React,{createContext,useCallback,useContext,useMemo,useState} from 'react';

// Deliberately local React state: no global variable, URL query, server upload,
// background sync or evidence authorization. Case linking only scopes drafts.
const CaseContext=createContext(null);
export function PersonalCaseSessionProvider({children}){
 const [linkedCase,setCase]=useState(null);
 const setLinkedCase=useCallback((value)=>{
  const next=value&&typeof value.caseId==='string'&&value.caseId.trim()
   ?{caseId:value.caseId.trim().slice(0,160),name:String(value.name||'').slice(0,200),
      mode:value.mode==='land'?'land':'building'}
   :null;
  setCase(previous=>previous?.caseId===next?.caseId &&
    previous?.name===next?.name && previous?.mode===next?.mode?previous:next);
 },[]);
 const v=useMemo(()=>({linkedCase,setLinkedCase}),[linkedCase,setLinkedCase]);
 return <CaseContext.Provider value={v}>{children}</CaseContext.Provider>;
}
export function usePersonalCaseSession(){
 const context=useContext(CaseContext);
 if(!context)throw Error('PERSONAL_CASE_SESSION_PROVIDER_REQUIRED');
 return context;
}
