'use strict';

function selectRecommendationResult(engineResult) {
  return {
    c0: engineResult.c0,
    c1: engineResult.c1,
    c2: engineResult.c2,
    c3: engineResult.c3,
    c4: engineResult.c4,
    c5: engineResult.c5,
    c6: engineResult.c6,
    c7: engineResult.c7,
    metCount: engineResult.metCount,
    totalCriteria: engineResult.totalCriteria,
    verdict: engineResult.verdict,
    decisionStatus: engineResult.decisionStatus,
    criteriaDetail: engineResult.criteriaDetail,
    failedHardGates: engineResult.failedHardGates,
    failedSoftCriteria: engineResult.failedSoftCriteria,
    financialModelStatus: engineResult.financialModelStatus,
  };
}
module.exports = { selectRecommendationResult };
