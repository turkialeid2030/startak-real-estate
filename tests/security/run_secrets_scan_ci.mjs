#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const ROOT = path.resolve(import.meta.dirname, '../..');
const MANIFEST_PATH = path.join(ROOT, 'governance', 'release-path-manifest.json');
const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));

const TEXT_EXTENSIONS = new Set([
  '.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx', '.json', '.html', '.css', '.scss',
  '.yml', '.yaml', '.toml', '.txt', '.md', '.env', '.properties', '.sh', '.ps1',
]);
const SKIP_DIRS = new Set(['.git', 'node_modules', 'dist', 'coverage', '.wrangler']);
const ALWAYS_SCAN_EXACT = new Set(Object.keys(manifest.deploymentExactPaths || {}));
const RUNTIME_PREFIXES = (manifest.deploymentRules || []).map((rule) => rule.prefix);

const SECRET_PATTERNS = Object.freeze([
  { id: 'PRIVATE_KEY', regex: /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/g },
  { id: 'AWS_ACCESS_KEY', regex: /\bAKIA[0-9A-Z]{16}\b/g },
  { id: 'GITHUB_PAT', regex: /\bgh(?:p|o|u|s|r)_[A-Za-z0-9]{30,}\b/g },
  { id: 'OPENAI_SECRET_KEY', regex: /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/g },
  { id: 'SLACK_TOKEN', regex: /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/g },
  { id: 'STRIPE_LIVE_SECRET', regex: /\bsk_live_[A-Za-z0-9]{20,}\b/g },
  { id: 'BASIC_AUTH_URL', regex: /https?:\/\/[^\s/:@]+:[^\s/@]{8,}@[^\s/]+/g },
]);

function normalize(relativePath) {
  return relativePath.split(path.sep).join('/');
}

function isRuntimePath(relativePath) {
  const rel = normalize(relativePath);
  if (ALWAYS_SCAN_EXACT.has(rel)) return true;
  return RUNTIME_PREFIXES.some((prefix) => rel.startsWith(prefix));
}

function shouldScanFile(relativePath) {
  if (!isRuntimePath(relativePath)) return false;
  const ext = path.extname(relativePath).toLowerCase();
  return TEXT_EXTENSIONS.has(ext) || ALWAYS_SCAN_EXACT.has(normalize(relativePath));
}

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory() && SKIP_DIRS.has(entry.name)) continue;
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(absolute, files);
    else if (entry.isFile()) files.push(absolute);
  }
  return files;
}

function redactMatch(value) {
  if (value.length <= 8) return '[REDACTED]';
  return `${value.slice(0, 3)}…${value.slice(-3)}`;
}

const findings = [];
const scanned = [];
for (const absolute of walk(ROOT)) {
  const relative = normalize(path.relative(ROOT, absolute));
  if (!shouldScanFile(relative)) continue;
  let text;
  try { text = fs.readFileSync(absolute, 'utf8'); }
  catch (_) { continue; }
  scanned.push(relative);

  for (const pattern of SECRET_PATTERNS) {
    pattern.regex.lastIndex = 0;
    for (const match of text.matchAll(pattern.regex)) {
      const before = text.slice(0, match.index);
      const line = before.split(/\r?\n/).length;
      findings.push({ path: relative, line, rule: pattern.id, sample: redactMatch(match[0]) });
    }
  }
}

console.log(`SECRETS_SCAN_FILES=${scanned.length}`);
console.log(`SECRETS_SCAN_RUNTIME_PREFIXES=${RUNTIME_PREFIXES.join(',')}`);
if (findings.length > 0) {
  for (const finding of findings) {
    console.error(`SECRET_FINDING rule=${finding.rule} path=${finding.path}:${finding.line} sample=${finding.sample}`);
  }
  console.error(`SECRETS_SCAN_RESULT=FAIL findings=${findings.length}`);
  process.exit(1);
}

console.log('SECRETS_SCAN_RESULT=PASS findings=0');
console.log('TRANSACTION_AUTHORIZED=false');
