'use strict';
const assert=require('node:assert/strict');
const {selectTargetedTests,censusWorkflowTexts}=require('../../tools/v7-ci-acceleration');
const {verifyPackage}=require('../verify_package');
assert.equal(typeof verifyPackage,'function'); // import must not build or exit
const files=['tests/architecture/run_a.js','tests/architecture/run_b.js','tests/runtime/run_c.js'];
assert.deepEqual(selectTargetedTests(files,['suite:architecture','tests/architecture/run_a.js']),files.slice(0,2));
assert.deepEqual(selectTargetedTests(files,['tests/runtime/run_c.js']),files.slice(2));
for(const s of [[],['suite:missing'],['../outside.js'],['tests/architecture/*.js'],['tests/architecture/run_missing.js']])assert.throws(()=>selectTargetedTests(files,s));
assert.throws(()=>selectTargetedTests([...files,files[0]],['suite:architecture']));
const census=censusWorkflowTexts([{name:'a.yml',text:'steps:\n  - run: npm run release:verify\n  # npm run verify:package\n  - run: npm run build'},{name:'b.yaml',text:'run: node tools/verify-all-stages.mjs\nrun: npm run verify:package'}]);
assert.equal(census.workflowFiles,2);assert.equal(census.releaseCalls,1);assert.equal(census.packageCalls,1);assert.equal(census.allStagesCalls,1);assert.equal(census.explicitBuildCalls,1);assert.equal(census.productionAuthorized,false);
assert.throws(()=>censusWorkflowTexts([{name:'../x.yml',text:''}]));
console.log('V7_ACCELERATION_CONTRACT=PASS targeted_not_release=true');
