// src/engines/recommendation/index.js -- EXTRACTED VERBATIM from platform-source.jsx lines 140-145.
// No formula changes. Extraction only. See REBASE_CHANGE_MANIFEST.csv.
function tierVerdict(criteria) {
  const total = criteria.length;
  const met = criteria.filter(Boolean).length;
  const verdict = met === total ? "يوصى بالشراء" : met >= total - 1 ? "يوصى بالشراء بشروط" : "لا يوصى بالشراء";
  return { met, total, verdict };
}

module.exports = { tierVerdict };
