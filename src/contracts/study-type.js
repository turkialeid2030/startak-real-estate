// src/contracts/study-type.js -- canonical StudyType contract.
const STUDY_TYPE = Object.freeze({
  EXISTING_BUILDING: 'EXISTING_BUILDING',
  LAND_DEVELOPMENT: 'LAND_DEVELOPMENT',
});
const STUDY_TYPE_TO_LEGACY_MODE = Object.freeze({
  [STUDY_TYPE.EXISTING_BUILDING]: 'building',
  [STUDY_TYPE.LAND_DEVELOPMENT]: 'land',
});
function isValidStudyType(value) {
  return value === STUDY_TYPE.EXISTING_BUILDING || value === STUDY_TYPE.LAND_DEVELOPMENT;
}
module.exports = { STUDY_TYPE, STUDY_TYPE_TO_LEGACY_MODE, isValidStudyType };
