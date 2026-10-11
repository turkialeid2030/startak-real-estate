'use strict';
const BASES = Object.freeze(['BEFORE_RESERVE', 'AFTER_RESERVE']);
function capitalizationBasis(inputs, economics) {
  const selected = inputs.marketCapNoiBasis;
  if (selected !== undefined && !BASES.includes(selected)) throw new TypeError('INVALID_MARKET_CAP_NOI_BASIS');
  const basis = selected || 'AFTER_RESERVE';
  return Object.freeze({
    basis, explicitlySelected: selected !== undefined,
    selectedNoi: economics ? (basis === 'BEFORE_RESERVE' ? economics.noiBeforeReserve : economics.noiAfterReserve) : null,
    status: selected === undefined ? 'LEGACY_BASIS_NOT_DOCUMENTED' : 'USER_SELECTED_NOT_INDEPENDENTLY_VERIFIED',
    professionalReleaseAuthorized: false,
    exitNoiBasis: 'AFTER_RESERVE',
  });
}
function geometryReview(mode, inputs) {
  const area = inputs.landLength * inputs.landWidth;
  return mode === 'building' && Number.isFinite(area) && area > 0
    && inputs.basementCount > 0 && inputs.basementAreaEach > area
    ? 'BASEMENT_FOOTPRINT_REQUIRES_RIGHTS_AND_PERMIT_REVIEW' : 'NO_BASEMENT_FOOTPRINT_EXCEPTION_DETECTED';
}
module.exports = { BASES, capitalizationBasis, geometryReview };
