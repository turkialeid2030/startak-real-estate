'use strict';
const assert=require('assert');
const {solveDatedXirr,DATED_RETURNS_STATUS,xnpv}=require('../../src/valuation-intelligence/dated-returns');
const cf=[{date:'2026-01-01',amount:-1000000},{date:'2027-01-01',amount:1100000}];
const r=solveDatedXirr({cashflows:cf});assert.strictEqual(r.status,DATED_RETURNS_STATUS.QUALIFIED);assert.ok(Math.abs(r.xirr-.1)<.001);assert.ok(Math.abs(xnpv(r.xirr,cf))<.01);
const irregular=solveDatedXirr({cashflows:[{date:'2026-01-01',amount:-1000000},{date:'2026-07-01',amount:300000},{date:'2027-10-01',amount:900000}]});assert.strictEqual(irregular.status,DATED_RETURNS_STATUS.QUALIFIED);assert.ok(Number.isFinite(irregular.xirr));
assert.strictEqual(solveDatedXirr({cashflows:[{date:'2026-01-01',amount:1},{date:'2027-01-01',amount:2}]}).status,DATED_RETURNS_STATUS.HOLD);
assert.strictEqual(solveDatedXirr({cashflows:[{date:'bad',amount:-1},{date:'2027-01-01',amount:2}]}).status,DATED_RETURNS_STATUS.HOLD);
console.log('financial_integrity_p10_dated_returns: PASS');
