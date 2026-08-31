'use strict';

const { deepFreeze } = require('../contracts');

const PARSER_FORMAT = Object.freeze({
  XLSX: 'XLSX',
  PPTX: 'PPTX',
  PDF: 'PDF',
  UNKNOWN: 'UNKNOWN',
});

const PARSER_STATUS = Object.freeze({
  PARSED: 'PARSED',
  UNSUPPORTED: 'UNSUPPORTED',
  REJECTED: 'REJECTED',
});

const PARSED_ATOM_KIND = Object.freeze({
  CELL: 'CELL',
  TEXT: 'TEXT',
});

function nonEmpty(value, field) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${field} must be a non-empty string`);
}

function createParsedAtom({ atomId, document, adapterId, kind, rawValue, valueType = 'STRING', location, metadata = {} }) {
  nonEmpty(atomId, 'atomId');
  nonEmpty(adapterId, 'adapterId');
  if (!document || typeof document !== 'object') throw new TypeError('document is required');
  nonEmpty(document.documentId, 'document.documentId');
  nonEmpty(document.caseId, 'document.caseId');
  if (!Object.values(PARSED_ATOM_KIND).includes(kind)) throw new TypeError('kind is invalid');
  if (!location || typeof location !== 'object') throw new TypeError('location is required');

  return deepFreeze({
    schemaVersion: 1,
    atomId,
    documentId: document.documentId,
    caseId: document.caseId,
    adapterId,
    kind,
    rawValue,
    valueType,
    location: { ...location },
    metadata: { ...metadata },
    truthSemantics: 'PARSED_CONTENT_ONLY_NOT_EVIDENCE',
  });
}

function createParserResult({ document, adapterId, format, status, atoms = [], warnings = [], reason = null }) {
  if (!document || typeof document !== 'object') throw new TypeError('document is required');
  nonEmpty(document.documentId, 'document.documentId');
  nonEmpty(document.caseId, 'document.caseId');
  nonEmpty(adapterId, 'adapterId');
  if (!Object.values(PARSER_FORMAT).includes(format)) throw new TypeError('format is invalid');
  if (!Object.values(PARSER_STATUS).includes(status)) throw new TypeError('status is invalid');
  if (!Array.isArray(atoms) || !Array.isArray(warnings)) throw new TypeError('atoms and warnings must be arrays');

  for (const atom of atoms) {
    if (!atom || atom.documentId !== document.documentId || atom.caseId !== document.caseId) {
      throw new TypeError('CASE_OR_DOCUMENT_ISOLATION_VIOLATION in parser atoms');
    }
  }

  return deepFreeze({
    schemaVersion: 1,
    documentId: document.documentId,
    caseId: document.caseId,
    adapterId,
    format,
    status,
    atoms,
    warnings,
    reason,
    truthSemantics: 'Parser output is not Evidence and is never a financial-engine input by itself.',
  });
}

module.exports = {
  PARSER_FORMAT,
  PARSER_STATUS,
  PARSED_ATOM_KIND,
  createParsedAtom,
  createParserResult,
};
