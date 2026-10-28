import React,{createContext,useContext,useEffect,useMemo,useState} from 'react';
const {evaluateBoundReview}=require('../market/appraisal-study-binding');
// In-memory research linkage only. Never store private documents, titles or approvals
// in ambient browser globals or canonical Saved Deal records.
const Context=createContext(null);
export function AppraisalReviewSessionProvider({children}){
 const [subject,setSubject]=useState(null),[link,setLink]=useState(null);
 useEffect(()=>{
  if(link&&subject&&!link.invalidated&&evaluateBoundReview({subject,link}).status==='STALE_OR_UNMATCHED_LINK')
    setLink({...link,invalidated:true}); // sticky; reverting fields never silently revalidates
 },[subject,link]);
 const value=useMemo(()=>({subject,link,setSubject,setLink,clearLink:()=>setLink(null),
  invalidateLink:()=>setLink(current=>current?{...current,invalidated:true}:null)}),[subject,link]);
 return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useAppraisalReviewSession(){
 const context=useContext(Context);
 if(!context)throw Error('APPRAISAL_REVIEW_CONTEXT_REQUIRED');
 return context;
}
