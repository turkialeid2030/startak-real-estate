#!/usr/bin/env node
'use strict';
// Read-only qualification status; never exports or accepts commercial authority.
const fs=require('node:fs');
const path=require('node:path');
const {assessQualificationProgram}=require('../src/production-readiness/qualification-program-gate');
const root=path.join(__dirname,'..');
const program=JSON.parse(fs.readFileSync(path.join(root,'governance/qualification-90-day-program-20261027.json'),'utf8'));
const MAX_EVIDENCE_INDEX_BYTES=65536;
let evidence={};
if(process.argv.length>3||process.argv[2]&&!process.argv[2].startsWith('--evidence=')){
 console.error('Usage: node tools/qualification-program-report.js [--evidence=/private/path/metadata.json]');
 process.exit(2);
}
if(process.argv[2]){
 const evidencePath=process.argv[2].slice('--evidence='.length);
 if(!path.isAbsolute(evidencePath)||!fs.existsSync(evidencePath)){console.error('Private metadata file must exist at an absolute path.');process.exit(2);}
 const stat=fs.statSync(evidencePath);
 if(!stat.isFile()||stat.size>MAX_EVIDENCE_INDEX_BYTES){
   console.error('Evidence metadata index invalid or exceeds 64 KiB; provide a sanitized index only.');
   process.exit(2);
 }
 evidence=JSON.parse(fs.readFileSync(evidencePath,'utf8'));
}
const status=assessQualificationProgram(program,evidence);
console.log(JSON.stringify(status,null,2));
// HOLD due to genuine outstanding external evidence is a correct program
// state, not a software-test failure. Invalid policy must fail.
if(status.status==='INVALID_PROGRAM'||status.status==='INVALID_EVIDENCE_INDEX')process.exitCode=2;
