import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import DataFreshnessPanel from '../../../src/components/DataFreshnessPanel.jsx';
function App(){
 const [scenario,setScenario]=useState('current');
 const [locale,setLocale]=useState('ar-SA');
 const dates={current:'2026-11-11T00:00:00.000Z',stale:'2024-01-01T00:00:00.000Z',future:'2036-01-01T00:00:00.000Z',missing:null};
 const current={schemaVersion:1,projectId:'SYNTHETIC-NO-REAL-PROPERTY',evidence:{source:{
  sourceType:'SYNTHETIC_COMPLETED_SALE',sourceRef:'TEST-SOURCE-NOT_VERIFIED',
  observedAt:dates[scenario],grade:'B',status:'VERIFIED'
 }}};
 return <section>
  <nav>
   <button data-testid="test-current" onClick={()=>setScenario('current')}>Current</button>
   <button data-testid="test-stale" onClick={()=>setScenario('stale')}>Stale</button>
   <button data-testid="test-future" onClick={()=>setScenario('future')}>Future</button>
   <button data-testid="test-missing" onClick={()=>setScenario('missing')}>Missing</button>
   <button data-testid="test-english" onClick={()=>setLocale('en')}>English</button>
   <button data-testid="test-arabic" onClick={()=>setLocale('ar-SA')}>العربية</button>
  </nav>
  <DataFreshnessPanel locale={locale} valuationCase={current}/>
 </section>;
}
createRoot(document.getElementById('root')).render(<App/>);
