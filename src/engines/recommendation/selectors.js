// src/engines/recommendation/selectors.js -- SELECTOR FACADE for recommendation/criteria view.
function selectRecommendationResult(engineResult) {
  return {
    c1: engineResult.c1, c2: engineResult.c2, c3: engineResult.c3, c4: engineResult.c4, c5: engineResult.c5,
    metCount: engineResult.metCount,
    totalCriteria: engineResult.totalCriteria,
    verdict: engineResult.verdict,
  };
}
module.exports = { selectRecommendationResult };
