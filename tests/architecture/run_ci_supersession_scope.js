'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const names=["market-conflict-browser.yml","owner-hidden-diagnostics-verification.yml","product-acceptance-control-census.yml","reporting-studio-browser.yml","sector-operating-browser.yml"];
for(const name of names){
 const workflow=fs.readFileSync(path.resolve(__dirname,'../../.github/workflows',name),'utf8');
 const expected='concurrency:\n  group: startak-'+name.replace(/\.yml$/,'')+'-${{ github.event_name }}-${{ github.event.pull_request.number || github.run_id }}\n  cancel-in-progress: ${{ github.event_name == \'pull_request\' }}\n';
 assert.equal(workflow.split(expected).length,2,name+' must isolate supersession by workflow, event and PR');
 assert.match(workflow,/^  pull_request:/m);assert.match(workflow,/^  workflow_dispatch:/m);
 assert.match(workflow,/^  contents: read$/m);
}
console.log('CI_SUPERSESSION_SCOPE=PASS workflows='+names.length+' manual_dispatch_isolated=true');
