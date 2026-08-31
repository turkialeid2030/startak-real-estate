'use strict';

const { createEvidenceFact, deepFreeze } = require('../contracts');
const { normalizeExtractedValue } = require('../pipeline');
const { PARSER_FORMAT, PARSER_STATUS } = require('../parsers/contracts');
const { NORMALIZATION, SEMANTIC_RULES, numericToleranceByKey } = require('./registry');
const { reconcileEvidenceFacts } = require('../reconciliation');

const SEMANTIC_MAPPING_STATUS = Object.freeze({
  MAPPED: 'MAPPED',
  NO_MATCHES: 'NO_MATCHES',
  REJECTED: 'REJECTED',
});

function normalizeText(value) {
  return String(value ?? '')
    .toLocaleLowerCase('en')
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[()\[\]{}:：،,؛;\-–—_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function colNumber(letters) {
  let value = 0;
  for (const char of String(letters).toUpperCase()) value = value * 26 + (char.charCodeAt(0) - 64);
  return value;
}

function parseCellRef(cell) {
  const match = /^([A-Za-z]+)(\d+)$/.exec(String(cell || ''));
  if (!match) return null;
  return { column: colNumber(match[1]), row: Number(match[2]) };
}

function semanticNormalize(rawValue, rule, { sourceUnitText = null } = {}) {
  if (rule.normalization === NORMALIZATION.STRING) return normalizeExtractedValue(rawValue, 'STRING');
  const numeric = normalizeExtractedValue(rawValue, 'NUMBER');
  if (rule.normalization === NORMALIZATION.NUMBER) return numeric;
  if (rule.normalization === NORMALIZATION.PERCENT_RATIO) {
    const rawText = String(rawValue ?? '');
    if (/%/.test(rawText)) return numeric / 100;
    if (sourceUnitText && /%/.test(String(sourceUnitText))) return numeric;
    throw new TypeError(`PERCENT_SEMANTICS_AMBIGUOUS:${rule.id}`);
  }
  throw new TypeError(`UNSUPPORTED_SEMANTIC_NORMALIZATION:${rule.normalization}`);
}

function aliasMap() {
  const map = new Map();
  for (const rule of SEMANTIC_RULES) {
    for (const alias of rule.aliases) {
      const normalized = normalizeText(alias);
      if (!map.has(normalized)) map.set(normalized, []);
      map.get(normalized).push(rule);
    }
  }
  return map;
}

const RULES_BY_ALIAS = aliasMap();

function buildCellIndex(atoms) {
  const bySheetRow = new Map();
  for (const atom of atoms) {
    if (!atom || atom.kind !== 'CELL' || !atom.location || !atom.location.sheet || !atom.location.cell) continue;
    const ref = parseCellRef(atom.location.cell);
    if (!ref) continue;
    const key = `${atom.location.sheet}\u0000${ref.row}`;
    if (!bySheetRow.has(key)) bySheetRow.set(key, []);
    bySheetRow.get(key).push({ atom, ...ref });
  }
  for (const row of bySheetRow.values()) row.sort((a, b) => a.column - b.column);
  return bySheetRow;
}

function isNumericLike(raw) {
  if (typeof raw === 'number' || typeof raw === 'boolean') return true;
  const text = String(raw ?? '').trim();
  return /^[-+]?\s*[\d٠-٩۰-۹][\d٠-٩۰-۹,٬٫.\s]*(?:%|٪)?$/.test(text);
}

function valueCompatibleWithRule(raw, rule) {
  if (raw === null || raw === undefined || raw === '') return false;
  if (rule.normalization === NORMALIZATION.STRING) return true;
  return isNumericLike(raw);
}

function chooseValueToRight(rowCells, labelColumn, rule, maxColumnDistance = 4) {
  return rowCells.find((entry) =>
    entry.column > labelColumn
    && entry.column - labelColumn <= maxColumnDistance
    && valueCompatibleWithRule(entry.atom.rawValue, rule)
  ) || null;
}

function sourceUnitToRight(rowCells, valueColumn, maxColumnDistance = 2) {
  const unit = rowCells.find((entry) => entry.column > valueColumn && entry.column - valueColumn <= maxColumnDistance && typeof entry.atom.rawValue === 'string');
  return unit ? String(unit.atom.rawValue) : null;
}

function makeEvidenceFact({ document, rule, rawValue, normalizedValue, sourceLocator, extractionMethod, extractionConfidence, capturedAt }) {
  const locatorKey = sourceLocator.cell || sourceLocator.slide || sourceLocator.section || 'source';
  return createEvidenceFact({
    factId: `SEM:${rule.id}:${document.documentId}:${locatorKey}`,
    caseId: document.caseId,
    document,
    key: rule.key,
    rawValue,
    normalizedValue,
    valueType: rule.valueType,
    unit: rule.unit,
    sourceLocator,
    extractionMethod,
    extractionConfidence,
    materiality: rule.materiality,
    capturedAt,
  });
}

function mapXlsxSemantics({ document, parserResult, capturedAt }) {
  const rowIndex = buildCellIndex(parserResult.atoms);
  const facts = [];
  const warnings = [];

  for (const [rowKey, rowCells] of rowIndex.entries()) {
    for (const labelEntry of rowCells) {
      if (typeof labelEntry.atom.rawValue !== 'string') continue;
      const rules = RULES_BY_ALIAS.get(normalizeText(labelEntry.atom.rawValue));
      if (!rules || !rules.length) continue;

      for (const rule of rules) {
        const valueEntry = chooseValueToRight(rowCells, labelEntry.column, rule);
        if (!valueEntry) {
          warnings.push(`SEMANTIC_VALUE_NOT_FOUND_TO_RIGHT:${rule.id}:${labelEntry.atom.location.sheet}:${labelEntry.atom.location.cell}`);
          continue;
        }
        const sourceUnitText = rule.normalization === NORMALIZATION.STRING
          ? null
          : sourceUnitToRight(rowCells, valueEntry.column);
        try {
          const normalizedValue = semanticNormalize(valueEntry.atom.rawValue, rule, { sourceUnitText });
          facts.push(makeEvidenceFact({
            document,
            rule,
            rawValue: valueEntry.atom.rawValue,
            normalizedValue,
            sourceLocator: {
              ...valueEntry.atom.location,
              labelCell: labelEntry.atom.location.cell,
              labelText: labelEntry.atom.rawValue,
              sourceUnitText,
              semanticRuleId: rule.id,
            },
            extractionMethod: `${valueEntry.atom.adapterId}|SEMANTIC_EXACT_LABEL:${rule.id}`,
            extractionConfidence: 1,
            capturedAt,
          }));
        } catch (error) {
          warnings.push(`${error.message}:${rowKey}:${labelEntry.atom.location.cell}`);
        }
      }
    }
  }

  return { facts, warnings };
}

function escapeRegExp(value) { return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

function captureNumberAfterAlias(text, alias) {
  const pattern = new RegExp(`${escapeRegExp(alias)}\\s*(?:[:：=\-–—]?\\s*)?([-+]?\\s*[\\d٠-٩۰-۹][\\d٠-٩۰-۹,٬٫.\\s]*(?:%|٪)?)`, 'iu');
  const match = pattern.exec(text);
  return match ? match[1].trim() : null;
}

const PPTX_ALIAS_BLOCKLIST = new Set(['قيمة الأرض']);

function mapPptxSemantics({ document, parserResult, capturedAt }) {
  const facts = [];
  const warnings = [];

  for (const atom of parserResult.atoms) {
    if (!atom || atom.kind !== 'TEXT' || typeof atom.rawValue !== 'string') continue;
    const slideText = atom.rawValue;
    for (const rule of SEMANTIC_RULES) {
      // Free-form PPTX text does not retain dependable label/value boundaries for strings.
      // String-valued semantic facts therefore remain fail-closed unless a future layout-aware parser qualifies them.
      if (rule.normalization === NORMALIZATION.STRING) continue;
      let mapped = false;
      const aliases = [...rule.aliases].sort((a, b) => b.length - a.length);
      for (const alias of aliases) {
        if (PPTX_ALIAS_BLOCKLIST.has(alias)) continue;
        const captured = captureNumberAfterAlias(slideText, alias);
        if (!captured) continue;
        try {
          const normalizedValue = semanticNormalize(captured, rule);
          facts.push(makeEvidenceFact({
            document,
            rule,
            rawValue: captured,
            normalizedValue,
            sourceLocator: { ...atom.location, matchedLabel: alias, semanticRuleId: rule.id },
            extractionMethod: `${atom.adapterId}|SEMANTIC_EXACT_INLINE_LABEL:${rule.id}`,
            extractionConfidence: 0.98,
            capturedAt,
          }));
          mapped = true;
          break;
        } catch (error) {
          warnings.push(`${error.message}:slide:${atom.location.slide}:rule:${rule.id}`);
        }
      }
      if (mapped) continue;
    }
  }

  return { facts, warnings };
}

function mapSemanticEvidence({ document, parserResult, capturedAt }) {
  if (!document || !parserResult) throw new TypeError('document and parserResult are required');
  if (document.documentId !== parserResult.documentId || document.caseId !== parserResult.caseId) {
    throw new TypeError('CASE_OR_DOCUMENT_ISOLATION_VIOLATION in semantic mapper');
  }
  if (parserResult.status !== PARSER_STATUS.PARSED) {
    return deepFreeze({ status: SEMANTIC_MAPPING_STATUS.REJECTED, documentId: document.documentId, caseId: document.caseId, facts: [], warnings: [`PARSER_RESULT_NOT_PARSED:${parserResult.status}`] });
  }

  let mapped;
  if (parserResult.format === PARSER_FORMAT.XLSX) mapped = mapXlsxSemantics({ document, parserResult, capturedAt });
  else if (parserResult.format === PARSER_FORMAT.PPTX) mapped = mapPptxSemantics({ document, parserResult, capturedAt });
  else mapped = { facts: [], warnings: [`SEMANTIC_FORMAT_UNSUPPORTED:${parserResult.format}`] };

  return deepFreeze({
    status: mapped.facts.length ? SEMANTIC_MAPPING_STATUS.MAPPED : SEMANTIC_MAPPING_STATUS.NO_MATCHES,
    documentId: document.documentId,
    caseId: document.caseId,
    facts: mapped.facts,
    warnings: [...new Set(mapped.warnings)],
    mappedFactCount: mapped.facts.length,
    note: 'Semantic mapping creates EXTRACTED_EVIDENCE only. It does not verify facts or write financial-engine inputs.',
  });
}

function reconcileSemanticEvidence(facts, { caseId = null, keys = null } = {}) {
  return reconcileEvidenceFacts(facts, {
    caseId,
    keys,
    numericToleranceByKey: numericToleranceByKey(),
  });
}

module.exports = {
  SEMANTIC_MAPPING_STATUS,
  normalizeText,
  parseCellRef,
  semanticNormalize,
  captureNumberAfterAlias,
  mapSemanticEvidence,
  reconcileSemanticEvidence,
};
