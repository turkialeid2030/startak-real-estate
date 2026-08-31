'use strict';

const {
  DOCUMENT_TYPE,
  AUTHORITY_CLASS,
  INGEST_STATUS,
  createDocumentRecord,
} = require('./contracts');

const VALUE_TYPE = Object.freeze({
  NUMBER: 'NUMBER',
  STRING: 'STRING',
  BOOLEAN: 'BOOLEAN',
  DATE: 'DATE',
});

function toBytes(content) {
  if (typeof content === 'string') return new TextEncoder().encode(content);
  if (content instanceof ArrayBuffer) return new Uint8Array(content);
  if (ArrayBuffer.isView(content)) {
    return new Uint8Array(content.buffer, content.byteOffset, content.byteLength);
  }
  throw new TypeError('content must be a string, ArrayBuffer, or typed-array view');
}

async function sha256Hex(content) {
  const bytes = toBytes(content);
  const subtle = globalThis.crypto && globalThis.crypto.subtle;
  if (!subtle) throw new Error('Web Crypto SubtleCrypto is unavailable; SHA-256 intake cannot proceed');
  const digest = await subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

function normalizeSearchText(value) {
  return String(value || '')
    .toLocaleLowerCase('en')
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[_\-.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function includesAny(text, terms) {
  return terms.some((term) => text.includes(term));
}

function classifyDocument({ fileName = '', mimeType = '' }) {
  const name = normalizeSearchText(fileName);
  const mime = normalizeSearchText(mimeType);

  // Classification is metadata-only. It does not establish authority or truth.
  if (includesAny(name, ['صك', 'title deed', 'titledeed', 'ownership deed', 'deed'])) return DOCUMENT_TYPE.TITLE_DEED;
  if (includesAny(name, ['رفع مساحي', 'مخطط مساحي', 'survey', 'cadastral', 'plot plan'])) return DOCUMENT_TYPE.SURVEY;
  if (includesAny(name, ['تقييم', 'valuation', 'appraisal'])) return DOCUMENT_TYPE.VALUATION;
  if (includesAny(name, ['عقد ايجار', 'ايجار', 'lease', 'rent roll', 'rentroll'])) return DOCUMENT_TYPE.LEASE;
  if (includesAny(name, ['رخصة بناء', 'رخصه بناء', 'building permit', 'building license', 'permit'])) return DOCUMENT_TYPE.BUILDING_PERMIT;
  if (includesAny(name, ['كود عمراني', 'اشتراطات', 'zoning', 'urban code', 'planning controls'])) return DOCUMENT_TYPE.ZONING;
  if (includesAny(name, ['فحص نافي', 'العناية الواجبة', 'due diligence', 'duediligence'])) return DOCUMENT_TYPE.DUE_DILIGENCE;
  if (includesAny(name, ['عرض تقديمي', 'مذكرة استثمار', 'presentation', 'investment memo', 'investment memorandum'])) return DOCUMENT_TYPE.PRESENTATION;
  if (includesAny(name, ['نموذج مالي', 'دراسة جدوى', 'financial model', 'feasibility model', 'underwriting model'])) return DOCUMENT_TYPE.FINANCIAL_MODEL;

  if (mime.includes('spreadsheet') || mime.includes('excel') || /\.(xlsx|xls|xlsm|csv)$/i.test(fileName)) {
    return DOCUMENT_TYPE.FINANCIAL_MODEL;
  }
  if (mime.includes('presentation') || mime.includes('powerpoint') || /\.(ppt|pptx)$/i.test(fileName)) {
    return DOCUMENT_TYPE.PRESENTATION;
  }

  return DOCUMENT_TYPE.UNKNOWN;
}

function replaceArabicDigits(value) {
  const arabicIndic = '٠١٢٣٤٥٦٧٨٩';
  const easternArabic = '۰۱۲۳۴۵۶۷۸۹';
  return String(value)
    .replace(/[٠-٩]/g, (d) => String(arabicIndic.indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String(easternArabic.indexOf(d)))
    .replace(/\u066B/g, '.')
    .replace(/\u066C/g, ',');
}

function normalizeNumber(rawValue) {
  if (typeof rawValue === 'number') {
    if (!Number.isFinite(rawValue)) throw new TypeError('NUMBER value must be finite');
    return rawValue;
  }
  const cleaned = replaceArabicDigits(rawValue)
    .replace(/,/g, '')
    .replace(/[^0-9eE+\-.]/g, '');
  if (!cleaned || cleaned === '-' || cleaned === '.' || cleaned === '+') {
    throw new TypeError(`Unable to normalize NUMBER from value: ${rawValue}`);
  }
  const value = Number(cleaned);
  if (!Number.isFinite(value)) throw new TypeError(`Unable to normalize finite NUMBER from value: ${rawValue}`);
  return value;
}

function normalizeBoolean(rawValue) {
  if (typeof rawValue === 'boolean') return rawValue;
  const value = normalizeSearchText(replaceArabicDigits(rawValue));
  if (['true', 'yes', '1', 'نعم', 'موافق'].includes(value)) return true;
  if (['false', 'no', '0', 'لا', 'غير موافق'].includes(value)) return false;
  throw new TypeError(`Unable to normalize BOOLEAN from value: ${rawValue}`);
}

function normalizeDate(rawValue) {
  const date = rawValue instanceof Date ? rawValue : new Date(rawValue);
  if (Number.isNaN(date.getTime())) throw new TypeError(`Unable to normalize DATE from value: ${rawValue}`);
  return date.toISOString();
}

function normalizeExtractedValue(rawValue, valueType) {
  switch (valueType) {
    case VALUE_TYPE.NUMBER:
      return normalizeNumber(rawValue);
    case VALUE_TYPE.BOOLEAN:
      return normalizeBoolean(rawValue);
    case VALUE_TYPE.DATE:
      return normalizeDate(rawValue);
    case VALUE_TYPE.STRING:
      return String(rawValue ?? '').replace(/\s+/g, ' ').trim();
    default:
      throw new TypeError(`Unsupported valueType: ${valueType}`);
  }
}

async function ingestDocument({
  documentId,
  caseId,
  fileName,
  mimeType = 'application/octet-stream',
  content,
  authorityClass = AUTHORITY_CLASS.UNKNOWN,
  existingDocuments = [],
  receivedAt,
}) {
  const bytes = toBytes(content);
  const hash = await sha256Hex(bytes);
  const duplicate = existingDocuments.find((doc) => doc && doc.contentHashSha256 === hash) || null;

  return createDocumentRecord({
    documentId,
    caseId,
    fileName,
    mimeType,
    sizeBytes: bytes.byteLength,
    contentHashSha256: hash,
    documentType: classifyDocument({ fileName, mimeType }),
    authorityClass,
    receivedAt,
    ingestStatus: duplicate ? INGEST_STATUS.DUPLICATE_CONTENT : INGEST_STATUS.ACCEPTED,
    duplicateOfDocumentId: duplicate ? duplicate.documentId : null,
  });
}

module.exports = {
  VALUE_TYPE,
  toBytes,
  sha256Hex,
  classifyDocument,
  normalizeExtractedValue,
  ingestDocument,
};
