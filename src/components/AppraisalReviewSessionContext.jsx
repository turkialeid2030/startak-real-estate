import React,{createContext,useContext,useMemo,useState} from 'react';
// In-memory research linkage only. Never store private documents, titles or approvals
// in ambient browser globals or canonical Saved Deal records.
const Context=createContext(null);
export function AppraisalReviewSessionProvider({children}){
 const [subject,setSubject]=useState(null),[link,setLink]=useState(null);
 const value=useMemo(()=>({subject,link,setSubject,setLink,clearLink:()=>setLink(null)}),[subject,link]);
 return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useAppraisalReviewSession(){
 const context=useContext(Context);
 if(!context)throw Error('APPRAISAL_REVIEW_CONTEXT_REQUIRED');
 return context;
}
