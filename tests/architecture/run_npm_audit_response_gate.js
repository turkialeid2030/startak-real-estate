'use strict';
const assert = require('node:assert/strict');
const {requireAuditCounts} = require('../../tools/npm-audit-response-gate');
const clean = () => ({metadata:{vulnerabilities:{info:0,low:0,moderate:0,high:0,critical:0,total:0}},vulnerabilities:{}});
let checks=0;
function rejects(data,code){assert.throws(()=>requireAuditCounts(data),new RegExp(code));checks++;}
assert.equal(requireAuditCounts(clean()).total,0);checks++;
for (const value of [null,[],{error:{code:'E503'}},{metadata:{}}]) rejects(value,'NPM_AUDIT_');
for (const value of [-1,NaN,1.5,'0',undefined]) {
 const fixture=clean();fixture.metadata.vulnerabilities.high=value;rejects(fixture,'NPM_AUDIT_COUNTS_INVALID');
}
const inconsistent=clean();inconsistent.metadata.vulnerabilities.high=1;inconsistent.metadata.vulnerabilities.total=1;
rejects(inconsistent,'NPM_AUDIT_COUNTS_INCONSISTENT');
const invalid=clean();invalid.vulnerabilities.fixture={severity:'unknown'};
rejects(invalid,'NPM_AUDIT_RECORD_INVALID');
const valid=clean();valid.metadata.vulnerabilities.high=1;valid.metadata.vulnerabilities.total=1;valid.vulnerabilities.fixture={severity:'high'};
assert.equal(requireAuditCounts(valid).high,1);checks++;
const moderate=clean();moderate.metadata.vulnerabilities.moderate=2;moderate.metadata.vulnerabilities.total=2;moderate.vulnerabilities={a:{severity:'moderate'},b:{severity:'moderate'}};
assert.equal(requireAuditCounts(moderate).moderate,2);checks++;
console.log('NPM_AUDIT_RESPONSE_GATE=PASS checks='+checks);
