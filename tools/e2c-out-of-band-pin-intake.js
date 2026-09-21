#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const MAX_JSON_BYTES = 1024 * 1024;
const CANDIDATE_STATUS = 'READY_FOR_INDEPENDENT_OUT_OF_BAND_PINNING';
const READY_STATUS = 'STRUCTURALLY_QUALIFIED_OUT_OF_BAND_PIN_RECEIPT';

function usage() {
  return [
    'Usage:',
    '  node tools/e2c-out-of-band-pin-intake.js \\',
    '    --candidate <normalized-e2c-trust-root-candidate.json> \\',
    '    --pin <out-of-band-pin-record.json> \\',
    '    [--out <qualified-pin-receipt.json>]',
    '',
    'Safety:',
    '  This tool checks structural consistency between a normalized E2C registry candidate and a claimed out-of-band pin record.',
    '  It does not authenticate the external channel, invent a pin, sign anything, validate evidence, activate rules, or grant release/merge/deployment/transaction/Go-Live authority.',
  ].join('\n');
}

function parseArgs(argv) {
  if (argv.length === 0 || argv.includes('--help') || argv.includes('-h')) return { help: true };
  const map = { '--candidate': 'candidate', '--pin': 'pin', '--out': 'out' };
  const args = { candidate: null, pin: null, out: null };
  const seen = new Set();
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const key = map[token];
    if (!key) throw new Error(`unknown argument: ${token}`);
    if (seen.has(key)) throw new Error(`duplicate argument: ${token}`);
    seen.add(key);
    args[key] = argv[++index] || null;
    if (!args[key]) throw new Error(`missing value for ${token}`);
  }
  if (!args.candidate) throw new Error('--candidate is required');
  if (!args.pin) throw new Error('--pin is required');
  return args;
}

function readBoundedRegularJson(filePath) {
  const resolved = path.resolve(filePath);
  const stat = fs.lstatSync(resolved);
  if (stat.isSymbolicLink()) throw new Error(`symlink input is not allowed: ${resolved}`);
  if (!stat.isFile()) throw new Error(`input must be a regular file: ${resolved}`);
  if (stat.size > MAX_JSON_BYTES) throw new Error(`input exceeds ${MAX_JSON_BYTES} bytes: ${resolved}`);
  return JSON.parse(fs.readFileSync(resolved, 'utf8'));
}

function writePrivateJson(filePath, value) {
  const resolved = path.resolve(filePath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  if (fs.existsSync(resolved) && fs.lstatSync(resolved).isSymbolicLink()) throw new Error(`symlink output is not allowed: ${resolved}`);
  fs.writeFileSync(resolved, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
  fs.chmodSync(resolved, 0o600);
}

function containsPlaceholder(value) {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return /^<[^>]+>$/.test(trimmed) || /^(REPLACE_|PLACEHOLDER_|TEMPLATE_)/.test(trimmed);
  }
  if (Array.isArray(value)) return value.some(containsPlaceholder);
  if (value && typeof value === 'object') return Object.values(value).some(containsPlaceholder);
  return false;
}

function nonEmpty(value, field) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${field} must be a non-empty string`);
  return value.trim();
}

function digest(value, field) {
  const text = nonEmpty(value, field).toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(text)) throw new Error(`${field} must be a SHA-256 hex digest`);
  return text;
}

function iso(value, field) {
  const text = nonEmpty(value, field);
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) throw new Error(`${field} must be a valid date/time`);
  return date.toISOString();
}

function preparePinReceipt({ candidate, pin } = {}) {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) throw new Error('candidate must be an object');
  if (!pin || typeof pin !== 'object' || Array.isArray(pin)) throw new Error('pin must be an object');
  if (containsPlaceholder(candidate) || containsPlaceholder(pin)) throw new Error('input contains unresolved template placeholders');
  if (pin.templateOnly === true) throw new Error('templateOnly pin cannot be qualified');
  if (candidate.status !== CANDIDATE_STATUS) throw new Error(`candidate.status must be ${CANDIDATE_STATUS}`);

  const candidateRegistryId = nonEmpty(candidate.registry?.registryId, 'candidate.registry.registryId');
  const candidateHash = digest(candidate.registryHashSha256, 'candidate.registryHashSha256');
  const pinRegistryId = nonEmpty(pin.registryId, 'pin.registryId');
  const pinHash = digest(pin.registryHashSha256, 'pin.registryHashSha256');
  const pinnedBySubjectRef = nonEmpty(pin.pinnedBySubjectRef, 'pin.pinnedBySubjectRef');
  const pinChannelRef = nonEmpty(pin.pinChannelRef, 'pin.pinChannelRef');
  const pinEvidenceRef = nonEmpty(pin.pinEvidenceRef, 'pin.pinEvidenceRef');
  const pinnedAt = iso(pin.pinnedAt, 'pin.pinnedAt');

  if (pin.attestedOutOfBand !== true) throw new Error('pin.attestedOutOfBand must be true');
  if (pin.independentFromGovernanceOwner !== true) throw new Error('pin.independentFromGovernanceOwner must be true');
  if (pinRegistryId !== candidateRegistryId) throw new Error('E2C_PIN_REGISTRY_ID_MISMATCH');
  if (pinHash !== candidateHash) throw new Error('E2C_PIN_REGISTRY_HASH_MISMATCH');

  const governanceOwnerRef = typeof candidate.registry?.governanceOwnerRef === 'string'
    ? candidate.registry.governanceOwnerRef.trim()
    : null;
  if (governanceOwnerRef && pinnedBySubjectRef === governanceOwnerRef) {
    throw new Error('E2C_PINNER_MUST_BE_DISTINCT_FROM_GOVERNANCE_OWNER');
  }

  const verifierSubjects = Array.isArray(candidate.registry?.verifiers)
    ? candidate.registry.verifiers.map((item) => item?.verifierSubjectRef).filter((item) => typeof item === 'string' && item.trim()).map((item) => item.trim())
    : [];

  return Object.freeze({
    schemaVersion: 1,
    status: READY_STATUS,
    registryId: candidateRegistryId,
    registryHashSha256: candidateHash,
    pinnedBySubjectRef,
    pinnedAt,
    pinChannelRef,
    pinEvidenceRef,
    attestedOutOfBand: true,
    independentFromGovernanceOwner: true,
    pinnerMatchesVerifierSubject: verifierSubjects.includes(pinnedBySubjectRef),
    externalChannelAuthenticatedByTool: false,
    pinSubstanceCreatedByTool: false,
    signatureCreatedByTool: false,
    validationAuthorityGranted: false,
    deploymentAuthorized: false,
    mergeAuthorized: false,
    transactionAuthorized: false,
    commercialGoLiveAuthorized: false,
    authorityEffect: 'NONE',
    semantics: 'This result establishes only structural consistency between the repository-normalized E2C registry hash and a supplied out-of-band pin record. The external pin channel and evidence remain human/external-governance facts and are not authenticated by this tool.',
  });
}

function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    console.error(usage());
    process.exit(64);
  }
  if (args.help) {
    console.log(usage());
    return;
  }

  try {
    const result = preparePinReceipt({
      candidate: readBoundedRegularJson(args.candidate),
      pin: readBoundedRegularJson(args.pin),
    });
    if (args.out) writePrivateJson(args.out, result);
    else process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    if (result.status !== READY_STATUS) process.exit(2);
  } catch (error) {
    console.error(`E2C_OUT_OF_BAND_PIN_INTAKE_ERROR: ${error.message}`);
    process.exit(65);
  }
}

if (require.main === module) main();

module.exports = {
  MAX_JSON_BYTES,
  CANDIDATE_STATUS,
  READY_STATUS,
  usage,
  parseArgs,
  readBoundedRegularJson,
  writePrivateJson,
  containsPlaceholder,
  preparePinReceipt,
  main,
};
