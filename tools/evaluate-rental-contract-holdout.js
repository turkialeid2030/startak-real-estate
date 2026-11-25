'use strict';
// Run on an authorized local machine with an independently collected holdout;
// never commit contract records to GitHub.
const fs=require('node:fs');
const {evaluateContractHoldout}=require('../src/reporting/rental-contract-holdout');
try{
 if(process.argv.length!==3)throw Error('USAGE: node tools/evaluate-rental-contract-holdout.js <authorized-local-json>');
 const p=process.argv[2];if(fs.statSync(p).size>16*1024*1024)throw Error('HOLDOUT_FILE_SIZE');
 const result=evaluateContractHoldout(JSON.parse(fs.readFileSync(p,'utf8')));
 console.log(JSON.stringify(result,null,2));
}catch(e){console.error(e.message);process.exitCode=1;}
