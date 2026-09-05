'use strict';

const assert = require('assert');
const {
  XLSX_OPC_LIMITS,
  XLSX_OPC_PREFLIGHT_VERSION,
  inspectXlsxOpcContainer,
} = require('../../src/integration-governance/spreadsheet/xlsx/opc-preflight');

function writeU16(buffer, offset, value) {
  buffer.writeUInt16LE(value >>> 0, offset);
}

function writeU32(buffer, offset, value) {
  buffer.writeUInt32LE(value >>> 0, offset);
}

function buildZip(entries, { comment = '' } = {}) {
  const localParts = [];
  const centralParts = [];
  let localOffset = 0;

  for (const entry of entries) {
    const nameBytes = Buffer.from(entry.name, 'utf8');
    const data = Buffer.from(entry.data || 'x', 'utf8');
    const flags = entry.flags || 0;
    const method = entry.method === undefined ? 0 : entry.method;
    const declaredCompressed = entry.compressedSize === undefined ? data.length : entry.compressedSize;
    const declaredUncompressed = entry.uncompressedSize === undefined ? data.length : entry.uncompressedSize;

    const local = Buffer.alloc(30 + nameBytes.length + data.length);
    writeU32(local, 0, 0x04034b50);
    writeU16(local, 4, 20);
    writeU16(local, 6, flags);
    writeU16(local, 8, method);
    writeU32(local, 18, declaredCompressed);
    writeU32(local, 22, declaredUncompressed);
    writeU16(local, 26, nameBytes.length);
    writeU16(local, 28, 0);
    nameBytes.copy(local, 30);
    data.copy(local, 30 + nameBytes.length);
    localParts.push(local);

    const central = Buffer.alloc(46 + nameBytes.length);
    writeU32(central, 0, 0x02014b50);
    writeU16(central, 4, 20);
    writeU16(central, 6, 20);
    writeU16(central, 8, flags);
    writeU16(central, 10, method);
    writeU32(central, 20, declaredCompressed);
    writeU32(central, 24, declaredUncompressed);
    writeU16(central, 28, nameBytes.length);
    writeU16(central, 30, 0);
    writeU16(central, 32, 0);
    writeU16(central, 34, 0);
    writeU16(central, 36, 0);
    writeU32(central, 38, 0);
    writeU32(central, 42, localOffset);
    nameBytes.copy(central, 46);
    centralParts.push(central);

    localOffset += local.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const commentBytes = Buffer.from(comment, 'utf8');
  const eocd = Buffer.alloc(22 + commentBytes.length);
  writeU32(eocd, 0, 0x06054b50);
  writeU16(eocd, 4, 0);
  writeU16(eocd, 6, 0);
  writeU16(eocd, 8, entries.length);
  writeU16(eocd, 10, entries.length);
  writeU32(eocd, 12, centralDirectory.length);
  writeU32(eocd, 16, localOffset);
  writeU16(eocd, 20, commentBytes.length);
  commentBytes.copy(eocd, 22);

  return Buffer.concat([...localParts, centralDirectory, eocd]);
}

function validEntries(extra = []) {
  return [
    { name: '[Content_Types].xml', data: '<Types/>' },
    { name: '_rels/.rels', data: '<Relationships/>' },
    { name: 'xl/workbook.xml', data: '<workbook/>' },
    { name: 'xl/worksheets/sheet1.xml', data: '<worksheet/>' },
    ...extra,
  ];
}

function expectCode(fn, code) {
  assert.throws(fn, (error) => error && error.code === code, `expected error code ${code}`);
}

function run() {
  const validBytes = buildZip(validEntries());
  const first = inspectXlsxOpcContainer(validBytes);
  const second = inspectXlsxOpcContainer(validBytes);

  assert.strictEqual(first.preflightVersion, XLSX_OPC_PREFLIGHT_VERSION);
  assert.strictEqual(first.status, 'READY_FOR_PASSIVE_PARSER');
  assert.strictEqual(first.entryCount, 4);
  assert.strictEqual(first.requiredPartsPresent, true);
  assert.strictEqual(first.parserInvocationAuthorized, true);
  assert.strictEqual(first.sourceAuthorityPromoted, false);
  assert.strictEqual(first.evidenceVerified, false);
  assert.strictEqual(first.canonicalMutationPerformed, false);
  assert.strictEqual(first.transactionAuthorized, false);
  assert.strictEqual(Object.isFrozen(first), true);
  assert.deepStrictEqual(first, second);

  expectCode(
    () => inspectXlsxOpcContainer(buildZip(validEntries([{ name: 'xl/vbaProject.bin', data: 'macro' }]))),
    'XLSX_ACTIVE_CONTENT_NOT_ALLOWED',
  );

  expectCode(
    () => inspectXlsxOpcContainer(buildZip(validEntries([{ name: 'xl/externalLinks/externalLink1.xml', data: '<externalLink/>' }]))),
    'XLSX_ACTIVE_CONTENT_NOT_ALLOWED',
  );

  expectCode(
    () => inspectXlsxOpcContainer(buildZip(validEntries([{ name: 'xl/embeddings/oleObject1.bin', data: 'ole' }]))),
    'XLSX_ACTIVE_CONTENT_NOT_ALLOWED',
  );

  expectCode(
    () => inspectXlsxOpcContainer(buildZip(validEntries([{ name: '../escape.xml', data: 'x' }]))),
    'XLSX_ENTRY_PATH_INVALID',
  );

  expectCode(
    () => inspectXlsxOpcContainer(buildZip([
      ...validEntries(),
      { name: 'xl/workbook.xml', data: 'duplicate' },
    ])),
    'XLSX_DUPLICATE_ENTRY_NOT_ALLOWED',
  );

  expectCode(
    () => inspectXlsxOpcContainer(buildZip(validEntries([{ name: 'xl/media/image1.png', data: 'x', flags: 1 }]))),
    'XLSX_ENCRYPTED_ENTRY_NOT_ALLOWED',
  );

  expectCode(
    () => inspectXlsxOpcContainer(buildZip(validEntries([{ name: 'xl/media/bomb.bin', data: 'x', compressedSize: 1, uncompressedSize: XLSX_OPC_LIMITS.maxEntryUncompressedBytes + 1 }]))),
    'XLSX_ENTRY_SIZE_LIMIT_EXCEEDED',
  );

  expectCode(
    () => inspectXlsxOpcContainer(buildZip(validEntries([{ name: 'xl/media/ratio.bin', data: 'x', compressedSize: 1, uncompressedSize: XLSX_OPC_LIMITS.maxCompressionRatio + 1 }]))),
    'XLSX_COMPRESSION_RATIO_LIMIT_EXCEEDED',
  );

  expectCode(
    () => inspectXlsxOpcContainer(buildZip([
      { name: '[Content_Types].xml', data: '<Types/>' },
      { name: '_rels/.rels', data: '<Relationships/>' },
    ])),
    'XLSX_REQUIRED_PART_MISSING',
  );

  const withTrailingByte = Buffer.concat([validBytes, Buffer.from([0])]);
  expectCode(() => inspectXlsxOpcContainer(withTrailingByte), 'XLSX_ZIP_EOCD_MISSING');

  console.log('run_xlsx_opc_preflight_v1: PASS');
}

try {
  run();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
