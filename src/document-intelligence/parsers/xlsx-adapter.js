'use strict';

const { readZipEntries } = require('./zip-reader');
const { PARSER_FORMAT, PARSER_STATUS, PARSED_ATOM_KIND, createParsedAtom, createParserResult } = require('./contracts');
const { extractElements, extractLocalTagTexts, attributeValue, textOfFirstLocalTag, decodeXmlEntities } = require('./xml-utils');

const ADAPTER_ID = 'XLSX_DETERMINISTIC_V1';
const decoder = new TextDecoder('utf-8', { fatal: false });

function supports({ fileName = '', mimeType = '' } = {}) {
  return /\.xlsx$/i.test(fileName) || /spreadsheetml\.sheet/i.test(mimeType);
}

function xml(entries, path) {
  const bytes = entries.get(path);
  return bytes ? decoder.decode(bytes) : null;
}

function resolveOfficeTarget(baseDir, target) {
  const raw = String(target || '').replace(/\\/g, '/');
  if (!raw) return null;
  if (raw.startsWith('/')) return raw.slice(1);
  const stack = baseDir.split('/').filter(Boolean);
  for (const part of raw.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') { if (!stack.length) return null; stack.pop(); }
    else stack.push(part);
  }
  return stack.join('/');
}

function workbookSheetMap(entries) {
  const workbook = xml(entries, 'xl/workbook.xml');
  const rels = xml(entries, 'xl/_rels/workbook.xml.rels');
  const byRid = new Map();
  if (rels) {
    const relRegex = /<Relationship\b([^>]*?)(?:\/?>)/gi;
    let m;
    while ((m = relRegex.exec(rels))) {
      const id = attributeValue(m[1], 'Id');
      const target = attributeValue(m[1], 'Target');
      const type = attributeValue(m[1], 'Type') || '';
      if (id && target && /worksheet/i.test(type)) byRid.set(id, resolveOfficeTarget('xl', target));
    }
  }

  const result = [];
  if (workbook) {
    const sheetRegex = /<sheet\b([^>]*?)(?:\/?>)/gi;
    let m;
    while ((m = sheetRegex.exec(workbook))) {
      const name = attributeValue(m[1], 'name');
      const rid = attributeValue(m[1], 'r:id');
      const sheetId = attributeValue(m[1], 'sheetId');
      const path = rid ? byRid.get(rid) : null;
      if (path && entries.has(path)) result.push({ name: name || `Sheet ${sheetId || result.length + 1}`, path });
    }
  }

  if (!result.length) {
    const fallback = [...entries.keys()]
      .filter((name) => /^xl\/worksheets\/sheet\d+\.xml$/i.test(name))
      .sort((a, b) => Number((a.match(/sheet(\d+)/i) || [0, 0])[1]) - Number((b.match(/sheet(\d+)/i) || [0, 0])[1]));
    fallback.forEach((path, i) => result.push({ name: `Sheet ${i + 1}`, path }));
  }
  return result;
}

function sharedStrings(entries) {
  const source = xml(entries, 'xl/sharedStrings.xml');
  if (!source) return [];
  return extractElements(source, 'si').map((si) => extractLocalTagTexts(si.innerXml, 't').join(''));
}

function parseCellValue(cell, shared) {
  const type = attributeValue(cell.attributes, 't');
  const formula = textOfFirstLocalTag(cell.innerXml, 'f');
  const v = textOfFirstLocalTag(cell.innerXml, 'v');
  let rawValue;
  let valueType = 'STRING';

  if (type === 'inlineStr') {
    rawValue = extractLocalTagTexts(cell.innerXml, 't').join('');
  } else if (type === 's') {
    const index = Number(v);
    rawValue = Number.isInteger(index) && index >= 0 && index < shared.length ? shared[index] : v;
  } else if (type === 'b') {
    rawValue = v === '1';
    valueType = 'BOOLEAN';
  } else if (type === 'str' || type === 'e') {
    rawValue = v;
  } else if (v !== null && v !== '') {
    const numeric = Number(v);
    if (Number.isFinite(numeric)) { rawValue = numeric; valueType = 'NUMBER'; }
    else rawValue = decodeXmlEntities(v);
  } else {
    rawValue = null;
  }

  return { rawValue, valueType, formula };
}

async function parse({ document, content, maxAtoms = 20000 }) {
  if (!document || !supports(document)) {
    return createParserResult({ document, adapterId: ADAPTER_ID, format: PARSER_FORMAT.XLSX, status: PARSER_STATUS.UNSUPPORTED, reason: 'DOCUMENT_NOT_XLSX' });
  }
  if (!Number.isInteger(maxAtoms) || maxAtoms < 1 || maxAtoms > 100000) throw new TypeError('maxAtoms must be an integer from 1 to 100000');

  try {
    const entries = await readZipEntries(content);
    if (!entries.has('[Content_Types].xml') || !entries.has('xl/workbook.xml')) {
      return createParserResult({ document, adapterId: ADAPTER_ID, format: PARSER_FORMAT.XLSX, status: PARSER_STATUS.REJECTED, reason: 'INVALID_XLSX_PACKAGE' });
    }

    const shared = sharedStrings(entries);
    const sheets = workbookSheetMap(entries);
    const warnings = ['XLSX_FORMATTING_MERGES_TABLES_DEFINED_NAMES_NOT_SEMANTICALLY_INTERPRETED'];
    const atoms = [];
    let formulasSeen = 0;

    if (entries.has('xl/styles.xml')) warnings.push('XLSX_STYLE_BASED_DATE_INTERPRETATION_NOT_IMPLEMENTED');

    for (const sheet of sheets) {
      const source = xml(entries, sheet.path);
      if (!source) continue;
      for (const cell of extractElements(source, 'c')) {
        if (atoms.length >= maxAtoms) throw new Error('XLSX_ATOM_LIMIT_EXCEEDED');
        const cellRef = attributeValue(cell.attributes, 'r');
        if (!cellRef) continue;
        const parsed = parseCellValue(cell, shared);
        if (parsed.rawValue === null || parsed.rawValue === undefined || parsed.rawValue === '') continue;
        if (parsed.formula !== null) formulasSeen++;
        atoms.push(createParsedAtom({
          atomId: `${document.documentId}:cell:${sheet.path}:${cellRef}`,
          document,
          adapterId: ADAPTER_ID,
          kind: PARSED_ATOM_KIND.CELL,
          rawValue: parsed.rawValue,
          valueType: parsed.valueType,
          location: { kind: 'CELL', sheet: sheet.name, cell: cellRef, packagePath: sheet.path },
          metadata: parsed.formula !== null ? { formula: parsed.formula, valueSemantics: 'CACHED_FORMULA_RESULT_NOT_RECALCULATED' } : {},
        }));
      }
    }

    if (formulasSeen) warnings.push('XLSX_FORMULAS_NOT_RECALCULATED_CACHED_VALUES_ONLY');
    if (!sheets.length) warnings.push('XLSX_NO_WORKSHEETS_DISCOVERED');

    return createParserResult({ document, adapterId: ADAPTER_ID, format: PARSER_FORMAT.XLSX, status: PARSER_STATUS.PARSED, atoms, warnings });
  } catch (error) {
    return createParserResult({ document, adapterId: ADAPTER_ID, format: PARSER_FORMAT.XLSX, status: PARSER_STATUS.REJECTED, reason: error && error.message ? error.message : 'XLSX_PARSE_FAILED' });
  }
}

module.exports = { ADAPTER_ID, supports, parse, workbookSheetMap, parseCellValue };
