'use strict';
const { PARSER_FORMAT, PARSER_STATUS, PARSED_ATOM_KIND, createParsedAtom, createParserResult } = require('./contracts');
const ADAPTER_ID = 'PDF_BOUNDED_TEXT_V1';
function supports({ fileName = '', mimeType = '' } = {}) {
  return /\.pdf$/i.test(fileName) || /^application\/pdf$/i.test(mimeType);
}
function hasPdfHeader(content) {
  const bytes = content instanceof ArrayBuffer ? new Uint8Array(content)
    : ArrayBuffer.isView(content) ? new Uint8Array(content.buffer,content.byteOffset,content.byteLength) : null;
  return bytes?.length >= 5 && [0x25,0x50,0x44,0x46,0x2d].every((v,i)=>bytes[i]===v);
}
async function parse({ document, content, ...options }) {
  const result = data => createParserResult({ document, adapterId:ADAPTER_ID,format:PARSER_FORMAT.PDF,...data });
  if (!document || !supports(document)) return result({ status:PARSER_STATUS.UNSUPPORTED,reason:'DOCUMENT_NOT_PDF' });
  if (!hasPdfHeader(content)) return result({ status:PARSER_STATUS.REJECTED,reason:'INVALID_PDF_HEADER' });
  try {
    const { readPdfText } = await import('./pdf-text-reader.mjs');
    const extracted = await readPdfText(content,options);
    if (!extracted.lines.length) return result({ status:PARSER_STATUS.UNSUPPORTED,reason:'PDF_NO_EXTRACTABLE_TEXT' });
    const atoms = extracted.lines.map(line=>createParsedAtom({
      atomId:`${document.documentId}:page:${line.page}:line:${line.line}`, document,adapterId:ADAPTER_ID,
      kind:PARSED_ATOM_KIND.TEXT,rawValue:line.text,valueType:'STRING',
      location:{ kind:'PAGE',page:line.page,line:line.line },
      metadata:{ extraction:'NATIVE_TEXT_ONLY',pageCount:extracted.pageCount,libraryVersion:extracted.libraryVersion },
    }));
    const warnings = ['PDF_TEXT_ONLY_NOT_VISUAL_READING_ORDER'];
    if (extracted.textlessPages.length) warnings.push('PDF_PARTIALLY_TEXTLESS');
    return result({ status:PARSER_STATUS.PARSED,atoms,warnings });
  } catch (error) {
    return result({ status:PARSER_STATUS.REJECTED,reason:error.code || 'PDF_READER_UNAVAILABLE' });
  }
}
module.exports = { ADAPTER_ID,supports,hasPdfHeader,parse };
