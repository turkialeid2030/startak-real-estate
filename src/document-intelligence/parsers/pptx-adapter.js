'use strict';

const { readZipEntries } = require('./zip-reader');
const { PARSER_FORMAT, PARSER_STATUS, PARSED_ATOM_KIND, createParsedAtom, createParserResult } = require('./contracts');
const { extractLocalTagTexts } = require('./xml-utils');

const ADAPTER_ID = 'PPTX_DETERMINISTIC_V1';
const decoder = new TextDecoder('utf-8', { fatal: false });

function supports({ fileName = '', mimeType = '' } = {}) {
  return /\.pptx$/i.test(fileName) || /presentationml\.presentation/i.test(mimeType);
}

function slideNumber(path) {
  const match = /ppt\/slides\/slide(\d+)\.xml$/i.exec(path);
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
}

async function parse({ document, content, maxAtoms = 10000 }) {
  if (!document || !supports(document)) {
    return createParserResult({ document, adapterId: ADAPTER_ID, format: PARSER_FORMAT.PPTX, status: PARSER_STATUS.UNSUPPORTED, reason: 'DOCUMENT_NOT_PPTX' });
  }
  if (!Number.isInteger(maxAtoms) || maxAtoms < 1 || maxAtoms > 50000) throw new TypeError('maxAtoms must be an integer from 1 to 50000');

  try {
    const entries = await readZipEntries(content);
    if (!entries.has('[Content_Types].xml') || !entries.has('ppt/presentation.xml')) {
      return createParserResult({ document, adapterId: ADAPTER_ID, format: PARSER_FORMAT.PPTX, status: PARSER_STATUS.REJECTED, reason: 'INVALID_PPTX_PACKAGE' });
    }

    const slidePaths = [...entries.keys()]
      .filter((name) => /^ppt\/slides\/slide\d+\.xml$/i.test(name))
      .sort((a, b) => slideNumber(a) - slideNumber(b));
    const atoms = [];
    const warnings = ['PPTX_TEXT_ONLY_SHAPES_TABLES_CHARTS_AND_IMAGES_NOT_SEMANTICALLY_INTERPRETED'];

    for (const path of slidePaths) {
      const slide = slideNumber(path);
      const source = decoder.decode(entries.get(path));
      const runs = extractLocalTagTexts(source, 't').map((text) => text.replace(/\s+/g, ' ').trim()).filter(Boolean);
      if (!runs.length) continue;
      const combined = runs.join(' ');
      if (atoms.length >= maxAtoms) throw new Error('PPTX_ATOM_LIMIT_EXCEEDED');
      atoms.push(createParsedAtom({
        atomId: `${document.documentId}:slide:${slide}`,
        document,
        adapterId: ADAPTER_ID,
        kind: PARSED_ATOM_KIND.TEXT,
        rawValue: combined,
        valueType: 'STRING',
        location: { kind: 'SLIDE', slide, packagePath: path },
        metadata: { textRunCount: runs.length },
      }));
    }

    if (!slidePaths.length) warnings.push('PPTX_NO_SLIDES_DISCOVERED');
    return createParserResult({ document, adapterId: ADAPTER_ID, format: PARSER_FORMAT.PPTX, status: PARSER_STATUS.PARSED, atoms, warnings });
  } catch (error) {
    return createParserResult({ document, adapterId: ADAPTER_ID, format: PARSER_FORMAT.PPTX, status: PARSER_STATUS.REJECTED, reason: error && error.message ? error.message : 'PPTX_PARSE_FAILED' });
  }
}

module.exports = { ADAPTER_ID, supports, parse };
