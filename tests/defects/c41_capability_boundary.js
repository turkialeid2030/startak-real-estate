'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const app = fs.readFileSync(path.join(__dirname, '../../src/app/App.jsx'), 'utf8');

// C41 qualifies every capability exposed by the current SPA. It does not claim
// an RBAC/authorization matrix that the current application does not expose.
const exposesAuthRoleSurface = /role\s*[:=]\s*["'](?:admin|analyst|reviewer|approver)|permissions?|rbac|access-control/i.test(app);
assert.strictEqual(exposesAuthRoleSurface, false, 'A role/privilege surface appeared in App.jsx without an explicit C41 authorization test matrix');

console.log('C41_EXPOSED_CAPABILITY_BOUNDARY=PASS');
console.log('C41_RBAC_SURFACE_PRESENT=false');
console.log('C41_PRIVILEGE_MATRIX_STATUS=NOT_APPLICABLE_TO_CURRENT_SPA');
