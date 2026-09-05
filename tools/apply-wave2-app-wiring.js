'use strict';

const fs = require('fs');
const path = require('path');
const { transformAppSource } = require('./wave2-app-wiring-transform');

const appPath = path.join(__dirname, '..', 'src', 'app', 'App.jsx');
const original = fs.readFileSync(appPath, 'utf8');
const result = transformAppSource(original);

if (result.changed) {
  fs.writeFileSync(appPath, result.source, 'utf8');
}

console.log(result.changed ? 'WAVE2_APP_WIRING_APPLIED=YES' : 'WAVE2_APP_WIRING_APPLIED=NO');
console.log(result.alreadyApplied ? 'WAVE2_APP_WIRING_ALREADY_APPLIED=YES' : 'WAVE2_APP_WIRING_ALREADY_APPLIED=NO');
