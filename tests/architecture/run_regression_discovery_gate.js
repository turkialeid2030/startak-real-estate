'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {SUITES, discoverRegressionTests} = require('../../tools/regression-test-discovery');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'startak-test-discovery-'));
let checks = 0;
try {
  for (const [name, prefixed] of SUITES) {
    const dir = path.join(root,'tests',name);
    fs.mkdirSync(dir,{recursive:true});
    fs.writeFileSync(path.join(dir,'run_b.js'),'');
    fs.writeFileSync(path.join(dir,'run_a.js'),'');
    fs.writeFileSync(path.join(dir,'helper.js'),'');
    fs.writeFileSync(path.join(dir,'readme.md'),'');
  }
  const expected = SUITES.flatMap(([name,prefixed]) =>
    (prefixed?['run_a.js','run_b.js']:['helper.js','run_a.js','run_b.js']).map(file=>path.join('tests',name,file)));
  assert.deepEqual(discoverRegressionTests(root),expected); checks++;
  assert.equal(Object.isFrozen(discoverRegressionTests(root)),true); checks++;
  for(const [name] of SUITES){
    const dir=path.join(root,'tests',name), backup=dir+'-backup';
    fs.renameSync(dir,backup);
    try{
      assert.throws(()=>discoverRegressionTests(root),new RegExp('REGRESSION_SUITE_UNAVAILABLE: '+name));checks++;
      fs.mkdirSync(dir);
      assert.throws(()=>discoverRegressionTests(root),new RegExp('REGRESSION_SUITE_EMPTY: '+name));checks++;
      fs.mkdirSync(path.join(dir,'run_invalid.js'));
      assert.throws(()=>discoverRegressionTests(root),new RegExp('REGRESSION_SUITE_NONREGULAR_ENTRY: '+name));checks++;
    }finally{fs.rmSync(dir,{recursive:true,force:true});fs.renameSync(backup,dir);}
  }
  assert.deepEqual(discoverRegressionTests(root),expected);checks++;
  console.log('REGRESSION_DISCOVERY_GATE=PASS checks='+checks);
} finally {fs.rmSync(root,{recursive:true,force:true});}
