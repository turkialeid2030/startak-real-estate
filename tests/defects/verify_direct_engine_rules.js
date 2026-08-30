const { calculateInvestmentCase, STUDY_TYPE } = require('../../src/engines');
const { ValidationError } = require('../../src/validation/numeric-safety');
const gold = require(require('../config/paths').getGoldBaselinePath());
const B = gold['RE-GOLD-002_existing_building'].inputs;
let allPass = true;
function check(id, cond, detail) { console.log(`${id} ${cond?'PASS':'FAIL'} -- ${detail}`); if(!cond) allPass=false; }

for (const [id, field, val] of [['DIRECT-01','occupancyRate',1.5],['DIRECT-02','rentPerSqm',Infinity],['DIRECT-03','buildingPrice',NaN],['DIRECT-04','occupancyRate',-0.5]]) {
  let threw=false, isVE=false, msg='';
  try { calculateInvestmentCase({studyType:STUDY_TYPE.EXISTING_BUILDING, inputs:{...B,[field]:val}, leverageEnabled:false}); }
  catch(e){ threw=true; isVE = e instanceof ValidationError; msg=e.message; }
  check(id, threw && isVE, `field=${field} val=${val} threw=${threw} isValidationError=${isVE} msg="${msg}"`);
}
console.log('');
console.log('DIRECT_ENGINE_REJECTION=' + (allPass?'PASS':'FAIL'));
process.exit(allPass?0:1);
