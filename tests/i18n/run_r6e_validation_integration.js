const { validateEngineInputs, ValidationError } = require('../../src/validation/numeric-safety.js');
const results = []; function check(id,c,d){console.log(`${id} ${c?'PASS':'FAIL'} -- ${d}`);results.push(c);}
const boundaries = [['occupancyRate',0,true],['occupancyRate',1,true],['occupancyRate',-0.0001,false],['occupancyRate',1.0001,false],
  ['maxPaybackThreshold',0.0001,true],['maxPaybackThreshold',0,false],['maxPaybackThreshold',-5,false],
  ['buildingPrice',Infinity,false],['buildingPrice',-Infinity,false],['buildingPrice',NaN,false]];
let pass=0;
for (const [f,v,should] of boundaries){let threw=false;try{validateEngineInputs({[f]:v});}catch(e){threw=true;}if(threw!==should)pass++;}
check('10-BOUNDARY-CASES', pass===10, `${pass}/10`);
try { validateEngineInputs({occupancyRate:2}); } catch(e) {
  check('BILINGUAL-PAYLOAD', !!e.message_ar && !!e.message_en, 'both present');
  check('MESSAGES-DISTINCT', e.message_ar !== e.message_en, 'different text per locale');
}
const allPass = results.every(Boolean);
console.log('\nRUN_R6E_VALIDATION_INTEGRATION=' + (allPass?'PASS':'FAIL'));
process.exit(allPass?0:1);
