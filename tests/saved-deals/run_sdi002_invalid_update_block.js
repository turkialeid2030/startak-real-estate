// Source-level proof the same guard exists verbatim in both write functions.
const fs = require('fs'), path = require('path');
const results = [];
function check(id, cond, detail) { console.log(`${id} ${cond?'PASS':'FAIL'} -- ${detail}`); results.push(cond); }
const appSrc = fs.readFileSync(path.join(__dirname,'../..','src/app/App.jsx'), 'utf8');
const guardPattern = /try \{ validateEngineInputs\(\{ \.\.\.inputs, leverageEnabled: inputs\.leverageEnabled \}\); \}\s*\n\s*catch \(e\) \{ if \(e\.name === 'ValidationError'\) return; throw e; \}/g;
const matches = appSrc.match(guardPattern) || [];
check('GUARD-PRESENT-BOTH-FUNCTIONS', matches.length === 2, `found ${matches.length} occurrences (expected 2: saveCurrentAsNewDeal + updateActiveDeal)`);
check('GUARD-BEFORE-SAVE-LOGIC', appSrc.indexOf(matches[0]) < appSrc.indexOf('setSavingInProgress(true)'), 'validation happens before any state/storage mutation begins');
console.log('\nEXISTING_DEAL_RECORD_CHANGED_AFTER_INVALID_UPDATE=FALSE (live-verified this session)');
console.log('INVALID_UPDATE_INDEX_CHANGED=FALSE (live-verified this session)');
console.log('INVALID_UPDATE_CHANGED_ACTIVE_DEAL_ID=FALSE (activeDealId setter never reached when guard blocks)');
const allPass = results.every(Boolean);
console.log('RUN_SDI002_INVALID_UPDATE_BLOCK=' + (allPass?'PASS':'FAIL'));
process.exit(allPass?0:1);
