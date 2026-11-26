'use strict';
const fs = require('node:fs');
const path = require('node:path');

// Keep both release and package verification on the same mandatory suite.
const SUITES = Object.freeze([
  ['characterization', true], ['architecture', true], ['i18n', true],
  ['saved-deals', true], ['ai', true], ['defects', false], ['runtime', false], ['valuation', false],
].map(Object.freeze));

function discoverRegressionTests(root) {
  const files = [];
  for (const [name, prefixed] of SUITES) {
    const directory = path.join(root, 'tests', name);
    let entries;
    try { entries = fs.readdirSync(directory, { withFileTypes: true }); }
    catch (_) { throw new Error('REGRESSION_SUITE_UNAVAILABLE: ' + name); }
    const candidates = entries.filter(entry => entry.name.endsWith('.js')
      && (!prefixed || entry.name.startsWith('run_')));
    if (!candidates.length) throw new Error('REGRESSION_SUITE_EMPTY: ' + name);
    if (candidates.some(entry => !entry.isFile())) {
      throw new Error('REGRESSION_SUITE_NONREGULAR_ENTRY: ' + name);
    }
    for (const entry of candidates.map(entry => entry.name).sort()) {
      files.push(path.join('tests', name, entry));
    }
  }
  return Object.freeze(files);
}
module.exports = { SUITES, discoverRegressionTests };
