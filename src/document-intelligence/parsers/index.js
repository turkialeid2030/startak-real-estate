'use strict';

const contracts = require('./contracts');
const xlsx = require('./xlsx-adapter');
const pptx = require('./pptx-adapter');
const pdf = require('./pdf-adapter');
const { mapParsedAtomToEvidenceFact } = require('./evidence-mapper');

const ADAPTERS = Object.freeze([xlsx, pptx, pdf]);

async function parseDocument({ document, content, options = {} }) {
  if (!document || typeof document !== 'object') throw new TypeError('document is required');
  const matches = ADAPTERS.filter((adapter) => adapter.supports(document));
  if (matches.length === 0) {
    return contracts.createParserResult({
      document,
      adapterId: 'PARSER_REGISTRY_V1',
      format: contracts.PARSER_FORMAT.UNKNOWN,
      status: contracts.PARSER_STATUS.UNSUPPORTED,
      reason: 'NO_REGISTERED_ADAPTER_FOR_DOCUMENT_METADATA',
    });
  }
  if (matches.length > 1) {
    return contracts.createParserResult({
      document,
      adapterId: 'PARSER_REGISTRY_V1',
      format: contracts.PARSER_FORMAT.UNKNOWN,
      status: contracts.PARSER_STATUS.REJECTED,
      reason: `AMBIGUOUS_FORMAT_METADATA:${matches.map((a) => a.ADAPTER_ID).join(',')}`,
    });
  }
  return matches[0].parse({ document, content, ...(options || {}) });
}

module.exports = {
  ...contracts,
  ADAPTERS,
  parseDocument,
  mapParsedAtomToEvidenceFact,
  xlsx,
  pptx,
  pdf,
};
