'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  WIRING_MARKER,
  transformAppSource,
} = require('../../tools/wave2-app-wiring-transform');

const appPath = path.join(__dirname, '..', '..', 'src', 'app', 'App.jsx');
const committedSource = fs.readFileSync(appPath, 'utf8');

function run() {
  assert.ok(committedSource.includes(WIRING_MARKER), 'production App must carry the Wave 2 wiring marker');

  const transformed = transformAppSource(committedSource);
  assert.strictEqual(transformed.changed, false, 'transform must be idempotent after production App wiring');
  assert.strictEqual(transformed.alreadyApplied, true, 'transform must recognize the committed wiring marker');
  assert.strictEqual(transformed.source, committedSource, 'idempotence must preserve committed App bytes');

  console.log('WAVE2_APP_WIRING_TRANSFORM_COMMITTED_STATE=PASS');
  console.log('WAVE2_APP_WIRING_TRANSFORM_IDEMPOTENT=PASS');
}

run();
