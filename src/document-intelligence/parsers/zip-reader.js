'use strict';

const ZIP_LIMITS = Object.freeze({
  maxEntries: 512,
  maxCompressedBytes: 50 * 1024 * 1024,
  maxEntryUncompressedBytes: 32 * 1024 * 1024,
  maxTotalUncompressedBytes: 96 * 1024 * 1024,
  maxCompressionRatio: 250,
});

function toBytes(content) {
  if (content instanceof Uint8Array) return content;
  if (content instanceof ArrayBuffer) return new Uint8Array(content);
  if (ArrayBuffer.isView(content)) return new Uint8Array(content.buffer, content.byteOffset, content.byteLength);
  throw new TypeError('ZIP content must be ArrayBuffer or typed-array view');
}

function u16(view, offset) { return view.getUint16(offset, true); }
function u32(view, offset) { return view.getUint32(offset, true); }

function safeEntryName(name) {
  if (!name || name.includes('\0')) return false;
  const normalized = name.replace(/\\/g, '/');
  if (normalized.startsWith('/') || /^[A-Za-z]:\//.test(normalized)) return false;
  return !normalized.split('/').some((part) => part === '..');
}

function findEndOfCentralDirectory(bytes) {
  const min = Math.max(0, bytes.length - 65557);
  for (let i = bytes.length - 22; i >= min; i--) {
    if (bytes[i] === 0x50 && bytes[i + 1] === 0x4b && bytes[i + 2] === 0x05 && bytes[i + 3] === 0x06) return i;
  }
  throw new Error('ZIP_EOCD_NOT_FOUND');
}

async function inflateRaw(bytes) {
  if (typeof DecompressionStream !== 'function') throw new Error('DEFLATE_UNAVAILABLE');
  let stream;
  try { stream = new DecompressionStream('deflate-raw'); }
  catch (_) { throw new Error('DEFLATE_RAW_UNSUPPORTED'); }
  const input = new Blob([bytes]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(input).arrayBuffer());
}

function parseCentralDirectory(bytes, limits = ZIP_LIMITS) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const eocd = findEndOfCentralDirectory(bytes);
  const disk = u16(view, eocd + 4);
  const cdDisk = u16(view, eocd + 6);
  const entryCount = u16(view, eocd + 10);
  const centralSize = u32(view, eocd + 12);
  const centralOffset = u32(view, eocd + 16);
  if (disk !== 0 || cdDisk !== 0) throw new Error('MULTI_DISK_ZIP_UNSUPPORTED');
  if (entryCount === 0xffff || centralOffset === 0xffffffff || centralSize === 0xffffffff) throw new Error('ZIP64_UNSUPPORTED');
  if (entryCount > limits.maxEntries) throw new Error('ZIP_ENTRY_LIMIT_EXCEEDED');
  if (centralOffset + centralSize > bytes.length) throw new Error('ZIP_CENTRAL_DIRECTORY_OUT_OF_BOUNDS');

  const decoder = new TextDecoder('utf-8', { fatal: false });
  const entries = [];
  let offset = centralOffset;
  let totalCompressed = 0;
  let totalUncompressed = 0;

  for (let i = 0; i < entryCount; i++) {
    if (offset + 46 > bytes.length || u32(view, offset) !== 0x02014b50) throw new Error('ZIP_CENTRAL_ENTRY_INVALID');
    const flags = u16(view, offset + 8);
    const method = u16(view, offset + 10);
    const compressedSize = u32(view, offset + 20);
    const uncompressedSize = u32(view, offset + 24);
    const nameLen = u16(view, offset + 28);
    const extraLen = u16(view, offset + 30);
    const commentLen = u16(view, offset + 32);
    const localOffset = u32(view, offset + 42);
    const end = offset + 46 + nameLen + extraLen + commentLen;
    if (end > bytes.length) throw new Error('ZIP_CENTRAL_ENTRY_OUT_OF_BOUNDS');
    const name = decoder.decode(bytes.subarray(offset + 46, offset + 46 + nameLen));
    if (!safeEntryName(name)) throw new Error(`ZIP_UNSAFE_PATH:${name}`);
    if ((flags & 0x0001) !== 0) throw new Error('ZIP_ENCRYPTED_ENTRY_UNSUPPORTED');
    if (![0, 8].includes(method)) throw new Error(`ZIP_COMPRESSION_METHOD_UNSUPPORTED:${method}`);
    if (uncompressedSize > limits.maxEntryUncompressedBytes) throw new Error('ZIP_ENTRY_UNCOMPRESSED_LIMIT_EXCEEDED');
    if (compressedSize > 0 && uncompressedSize / compressedSize > limits.maxCompressionRatio) throw new Error('ZIP_COMPRESSION_RATIO_LIMIT_EXCEEDED');

    totalCompressed += compressedSize;
    totalUncompressed += uncompressedSize;
    if (totalCompressed > limits.maxCompressedBytes) throw new Error('ZIP_COMPRESSED_LIMIT_EXCEEDED');
    if (totalUncompressed > limits.maxTotalUncompressedBytes) throw new Error('ZIP_TOTAL_UNCOMPRESSED_LIMIT_EXCEEDED');

    entries.push({ name, flags, method, compressedSize, uncompressedSize, localOffset });
    offset = end;
  }
  return entries;
}

async function readZipEntries(content, options = {}) {
  const bytes = toBytes(content);
  const limits = { ...ZIP_LIMITS, ...(options.limits || {}) };
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const entries = parseCentralDirectory(bytes, limits);
  const result = new Map();

  for (const entry of entries) {
    if (entry.localOffset + 30 > bytes.length || u32(view, entry.localOffset) !== 0x04034b50) throw new Error('ZIP_LOCAL_HEADER_INVALID');
    const nameLen = u16(view, entry.localOffset + 26);
    const extraLen = u16(view, entry.localOffset + 28);
    const dataStart = entry.localOffset + 30 + nameLen + extraLen;
    const dataEnd = dataStart + entry.compressedSize;
    if (dataEnd > bytes.length) throw new Error('ZIP_ENTRY_DATA_OUT_OF_BOUNDS');
    const compressed = bytes.subarray(dataStart, dataEnd);
    const output = entry.method === 0 ? new Uint8Array(compressed) : await inflateRaw(compressed);
    if (output.byteLength !== entry.uncompressedSize) throw new Error(`ZIP_SIZE_MISMATCH:${entry.name}`);
    result.set(entry.name, output);
  }

  return result;
}

module.exports = { ZIP_LIMITS, safeEntryName, parseCentralDirectory, readZipEntries };
