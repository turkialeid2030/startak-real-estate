'use strict';

const { PARSER_FORMAT, PARSER_STATUS, createParserResult } = require('./contracts');

const ADAPTER_ID = 'PDF_FAIL_CLOSED_V1';

function supports({ fileName = '', mimeType = '' } = {}) {
  return /\.pdf$/i.test(fileName) || /^application\/pdf$/i.test(mimeType);
}

function hasPdfHeader(content) {
  let bytes;
  if (content instanceof Uint8Array) bytes = content;
  else if (content instanceof ArrayBuffer) bytes = new Uint8Array(content);
  else if (ArrayBuffer.isView(content)) bytes = new Uint8Array(content.buffer, content.byteOffset, content.byteLength);
  else return false;
  if (bytes.byteLength < 5) return false;
  return bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 && bytes[4] === 0x2d;
}

async function parse({ document, content }) {
  if (!document || !supports(document)) {
    return createParserResult({ document, adapterId: ADAPTER_ID, format: PARSER_FORMAT.PDF, status: PARSER_STATUS.UNSUPPORTED, reason: 'DOCUMENT_NOT_PDF' });
  }
  if (!hasPdfHeader(content)) {
    return createParserResult({ document, adapterId: ADAPTER_ID, format: PARSER_FORMAT.PDF, status: PARSER_STATUS.REJECTED, reason: 'INVALID_PDF_HEADER' });
  }

  return createParserResult({
    document,
    adapterId: ADAPTER_ID,
    format: PARSER_FORMAT.PDF,
    status: PARSER_STATUS.UNSUPPORTED,
    reason: 'PDF_BINARY_PARSER_NOT_YET_VETTED',
    warnings: ['PDF remains fail-closed until a bounded parser is qualified against real Arabic/English and scanned/native fixtures.'],
  });
}

module.exports = { ADAPTER_ID, supports, hasPdfHeader, parse };
