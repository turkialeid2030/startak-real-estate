'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const boundary = fs.readFileSync(path.join(process.cwd(), 'REGULATORY_CLOSURE_BOUNDARY.md'), 'utf8');

for (const phrase of [
  'does **not**',
  'provide legal advice',
  'issue or verify a government license independently',
  'establish legal approval',
  'requires human production-readiness review',
]) {
  assert.ok(boundary.includes(phrase), `missing boundary phrase: ${phrase}`);
}

console.log('REGULATORY_CLOSURE_CLAIM_BOUNDARY_V1=PASS checks=5');
