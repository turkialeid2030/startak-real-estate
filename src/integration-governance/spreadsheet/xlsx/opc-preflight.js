'use strict';

const XLSX_OPC_PREFLIGHT_VERSION = '1.0.0';

const XLSX_OPC_LIMITS = Object.freeze({
  maxSourceBytes: 10 * 1024 * 1024,
  maxAggregateUncompressedBytes: 100 * 1024 * 1024,
  maxEntryUncompressedBytes: 25 * 1024 * 1024,
  maxCompressionRatio: 100,
  maxEntries: 5000,
  maxEntryNameBytes: 4096,
});

const REQUIRED_PARTS = Object.freeze([
  '[Content_Types].xml',
  '_rels/.rels',
  'xl/workbook.xml',
]);

const FORBIDDEN_EXACT_PARTS = Object.freeze(new Set([
  'xl/vbaProject.bin',
  'xl/vbaProjectSignature.bin',
]));

const FORBIDDEN_PREFIXES = Object.freeze([
  'xl/externalLinks/',
  'xl/embeddings/',
]);

function fail(code, message, detail = null) {
  const error = new Error(message);
  error.code = code;
  if (detail !== null) error.detail = detail;
  throw error;
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function toBytes(content) {
  if (content instanceof ArrayBuffer) return new Uint8Array(content);
  if (ArrayBuffer.isView(content)) return new Uint8Array(content.buffer, content.byteOffset, content.byteLength);
  throw new TypeError('content must be an ArrayBuffer or typed-array view');
}

function decodeUtf8(bytes) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch (error) {
    fail('XLSX_ENTRY_NAME_INVALID_UTF8', 'ZIP entry name is not valid UTF-8');
  }
}

function u16(view, offset) {
  if (offset < 0 || offset + 2 > view.byteLength) fail('XLSX_ZIP_TRUNCATED', 'ZIP structure is truncated');
  return view.getUint16(offset, true);
}

function u32(view, offset) {
  if (offset < 0 || offset + 4 > view.byteLength) fail('XLSX_ZIP_TRUNCATED', 'ZIP structure is truncated');
  return view.getUint32(offset, true);
}

function findEocd(bytes) {
  // EOCD minimum size is 22 bytes. ZIP comments are limited to 65535 bytes.
  const minOffset = Math.max(0, bytes.byteLength - 22 - 65535);
  for (let offset = bytes.byteLength - 22; offset >= minOffset; offset -= 1) {
    if (
      bytes[offset] === 0x50 && bytes[offset + 1] === 0x4b &&
      bytes[offset + 2] === 0x05 && bytes[offset + 3] === 0x06
    ) return offset;
  }
  fail('XLSX_ZIP_EOCD_MISSING', 'ZIP end-of-central-directory record was not found');
}

function normalizeEntryName(name) {
  if (!name || name.includes('\\') || name.startsWith('/') || /^[A-Za-z]:/.test(name)) {
    fail('XLSX_ENTRY_PATH_INVALID', `Invalid ZIP entry path: ${name || '<empty>'}`);
  }
  const segments = name.split('/');
  if (segments.some((segment) => segment === '..' || segment === '.')) {
    fail('XLSX_ENTRY_PATH_INVALID', `Path traversal is not allowed: ${name}`);
  }
  return name;
}

function classifyForbiddenPart(name) {
  if (FORBIDDEN_EXACT_PARTS.has(name)) return 'VBA_OR_MACRO';
  const prefix = FORBIDDEN_PREFIXES.find((candidate) => name.startsWith(candidate));
  if (prefix === 'xl/externalLinks/') return 'EXTERNAL_WORKBOOK_LINK';
  if (prefix === 'xl/embeddings/') return 'EMBEDDED_OBJECT';
  return null;
}

function inspectXlsxOpcContainer(content, limits = XLSX_OPC_LIMITS) {
  const bytes = toBytes(content);
  if (bytes.byteLength > limits.maxSourceBytes) {
    fail('XLSX_SOURCE_SIZE_LIMIT_EXCEEDED', 'XLSX source bytes exceed the preflight limit');
  }
  if (bytes.byteLength < 22) fail('XLSX_ZIP_TOO_SMALL', 'XLSX input is too small to be a valid ZIP container');

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const eocdOffset = findEocd(bytes);
  const diskNumber = u16(view, eocdOffset + 4);
  const centralDisk = u16(view, eocdOffset + 6);
  const entriesOnDisk = u16(view, eocdOffset + 8);
  const totalEntries = u16(view, eocdOffset + 10);
  const centralDirectorySize = u32(view, eocdOffset + 12);
  const centralDirectoryOffset = u32(view, eocdOffset + 16);
  const commentLength = u16(view, eocdOffset + 20);

  if (diskNumber !== 0 || centralDisk !== 0 || entriesOnDisk !== totalEntries) {
    fail('XLSX_SPANNED_ARCHIVE_NOT_ALLOWED', 'Spanned or multi-disk ZIP archives are not allowed');
  }
  if (totalEntries === 0xffff || centralDirectorySize === 0xffffffff || centralDirectoryOffset === 0xffffffff) {
    fail('XLSX_ZIP64_NOT_SUPPORTED', 'ZIP64 containers are not supported by the v1 XLSX preflight');
  }
  if (totalEntries > limits.maxEntries) fail('XLSX_ENTRY_COUNT_LIMIT_EXCEEDED', 'ZIP entry count exceeds the preflight limit');
  if (eocdOffset + 22 + commentLength !== bytes.byteLength) {
    fail('XLSX_ZIP_TRAILING_DATA_NOT_ALLOWED', 'Unexpected trailing bytes after ZIP EOCD');
  }
  if (centralDirectoryOffset + centralDirectorySize > eocdOffset) {
    fail('XLSX_CENTRAL_DIRECTORY_INVALID', 'ZIP central directory bounds are invalid');
  }

  const seenNames = new Set();
  const entries = [];
  let cursor = centralDirectoryOffset;
  let aggregateUncompressedBytes = 0;

  for (let index = 0; index < totalEntries; index += 1) {
    if (u32(view, cursor) !== 0x02014b50) {
      fail('XLSX_CENTRAL_DIRECTORY_INVALID', `Central directory entry ${index} has an invalid signature`);
    }

    const flags = u16(view, cursor + 8);
    const compressionMethod = u16(view, cursor + 10);
    const compressedSize = u32(view, cursor + 20);
    const uncompressedSize = u32(view, cursor + 24);
    const fileNameLength = u16(view, cursor + 28);
    const extraLength = u16(view, cursor + 30);
    const fileCommentLength = u16(view, cursor + 32);
    const diskStart = u16(view, cursor + 34);
    const localHeaderOffset = u32(view, cursor + 42);

    if (diskStart !== 0) fail('XLSX_SPANNED_ARCHIVE_NOT_ALLOWED', 'Central directory references another disk');
    if ((flags & 0x0001) !== 0) fail('XLSX_ENCRYPTED_ENTRY_NOT_ALLOWED', 'Encrypted ZIP entries are not supported');
    if (compressionMethod !== 0 && compressionMethod !== 8) {
      fail('XLSX_COMPRESSION_METHOD_NOT_ALLOWED', `Unsupported ZIP compression method: ${compressionMethod}`);
    }
    if (fileNameLength === 0 || fileNameLength > limits.maxEntryNameBytes) {
      fail('XLSX_ENTRY_NAME_LIMIT_EXCEEDED', 'ZIP entry name length is invalid or exceeds the preflight limit');
    }

    const variableStart = cursor + 46;
    const nextCursor = variableStart + fileNameLength + extraLength + fileCommentLength;
    if (nextCursor > eocdOffset) fail('XLSX_CENTRAL_DIRECTORY_INVALID', 'ZIP central directory entry exceeds container bounds');

    const name = normalizeEntryName(decodeUtf8(bytes.subarray(variableStart, variableStart + fileNameLength)));
    if (seenNames.has(name)) fail('XLSX_DUPLICATE_ENTRY_NOT_ALLOWED', `Duplicate ZIP entry is not allowed: ${name}`);
    seenNames.add(name);

    if (localHeaderOffset >= centralDirectoryOffset) {
      fail('XLSX_LOCAL_HEADER_OFFSET_INVALID', `ZIP entry local header offset is invalid: ${name}`);
    }
    if (uncompressedSize > limits.maxEntryUncompressedBytes) {
      fail('XLSX_ENTRY_SIZE_LIMIT_EXCEEDED', `ZIP entry exceeds uncompressed size limit: ${name}`);
    }

    aggregateUncompressedBytes += uncompressedSize;
    if (aggregateUncompressedBytes > limits.maxAggregateUncompressedBytes) {
      fail('XLSX_AGGREGATE_SIZE_LIMIT_EXCEEDED', 'ZIP aggregate uncompressed size exceeds the preflight limit');
    }

    if (uncompressedSize > 0) {
      if (compressedSize === 0) fail('XLSX_COMPRESSION_RATIO_LIMIT_EXCEEDED', `ZIP entry has an infinite compression ratio: ${name}`);
      const ratio = uncompressedSize / compressedSize;
      if (ratio > limits.maxCompressionRatio) {
        fail('XLSX_COMPRESSION_RATIO_LIMIT_EXCEEDED', `ZIP entry compression ratio exceeds the preflight limit: ${name}`);
      }
    }

    const activeContentType = classifyForbiddenPart(name);
    if (activeContentType) {
      fail('XLSX_ACTIVE_CONTENT_NOT_ALLOWED', `Active or external workbook content is not allowed: ${name}`, {
        entryName: name,
        activeContentType,
      });
    }

    entries.push({
      name,
      compressedSize,
      uncompressedSize,
      compressionMethod,
    });
    cursor = nextCursor;
  }

  if (cursor !== centralDirectoryOffset + centralDirectorySize) {
    fail('XLSX_CENTRAL_DIRECTORY_INVALID', 'Parsed central directory size does not match EOCD metadata');
  }

  const missingRequiredParts = REQUIRED_PARTS.filter((part) => !seenNames.has(part));
  if (missingRequiredParts.length > 0) {
    fail('XLSX_REQUIRED_PART_MISSING', `Required XLSX OPC part is missing: ${missingRequiredParts.join(', ')}`);
  }

  return deepFreeze({
    schemaVersion: 1,
    preflightVersion: XLSX_OPC_PREFLIGHT_VERSION,
    status: 'READY_FOR_PASSIVE_PARSER',
    sourceBytes: bytes.byteLength,
    entryCount: totalEntries,
    aggregateUncompressedBytes,
    requiredPartsPresent: true,
    activeContentDetected: false,
    externalLinkDetected: false,
    encryptedContentDetected: false,
    zip64Used: false,
    entries,
    parserInvocationAuthorized: true,
    sourceAuthorityPromoted: false,
    evidenceVerified: false,
    canonicalMutationPerformed: false,
    transactionAuthorized: false,
  });
}

module.exports = {
  XLSX_OPC_PREFLIGHT_VERSION,
  XLSX_OPC_LIMITS,
  REQUIRED_PARTS,
  inspectXlsxOpcContainer,
};
