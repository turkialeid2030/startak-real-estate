'use strict';

// Reconcile the immutable historical baseline with an exact fetched remote snapshot.
// A branch added after the original census is a candidate, not an accepted feature.
function validName(name) {
  return typeof name === 'string' && /^[A-Za-z0-9._/-]+$/.test(name)
    && !name.includes('..') && !name.startsWith('/') && !name.endsWith('/')
    && !name.includes('//') && name !== 'HEAD';
}
function uniqueMap(entries) {
  if (!Array.isArray(entries)) throw Error('BRANCH_SCOPE_INVALID');
  const result = new Map();
  for (const entry of entries) {
    if (!entry || !validName(entry.name) || !/^[a-f0-9]{40}$/.test(entry.sha || '')
      || result.has(entry.name)) throw Error('BRANCH_SNAPSHOT_INVALID_OR_DUPLICATE');
    result.set(entry.name, entry.sha);
  }
  if (!result.size) throw Error('BRANCH_SNAPSHOT_EMPTY');
  return result;
}
function parseBranchAdvertisement(text, prefix = 'refs/heads/') {
  if (typeof text !== 'string') throw Error('BRANCH_ADVERTISEMENT_INVALID');
  const entries = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line) continue;
    const match = /^([a-f0-9]{40})\t(.+)$/.exec(line);
    if (!match || !match[2].startsWith(prefix)) throw Error('BRANCH_ADVERTISEMENT_INVALID');
    const name = match[2].slice(prefix.length);
    if (prefix === 'refs/remotes/origin/' && name === 'HEAD') continue;
    entries.push({name, sha:match[1]});
  }
  uniqueMap(entries);
  return entries;
}
function reconcileBranchScope(baseline, advertised, fetched) {
  if (!Array.isArray(baseline) || !baseline.length) throw Error('BASELINE_BRANCH_SCOPE_EMPTY');
  const old = new Set();
  for (const name of baseline) {
    if (!validName(name) || old.has(name)) throw Error('BASELINE_BRANCH_SCOPE_INVALID');
    old.add(name);
  }
  const remote = uniqueMap(advertised), actual = uniqueMap(fetched);
  if (remote.size !== actual.size || [...remote].some(([name,sha]) => actual.get(name) !== sha)) {
    throw Error('BRANCH_SNAPSHOT_CHANGED_OR_INCOMPLETE');
  }
  const names = [...new Set([...old, ...remote.keys()])].sort();
  return Object.freeze({
    names:Object.freeze(names),
    baselineCount:old.size,
    advertisedCount:remote.size,
    newlyDiscoveredCount:[...remote.keys()].filter(name=>!old.has(name)).length,
    missingBaselineCount:[...old].filter(name=>!remote.has(name)).length,
  });
}
module.exports = { parseBranchAdvertisement, reconcileBranchScope };
