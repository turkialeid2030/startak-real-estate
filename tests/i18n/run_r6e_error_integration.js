const fs = require('fs'), path = require('path');
const { PersistenceUnavailableError } = require('../../src/storage/create-storage-provider.js');
const results = []; function check(id,c,d){console.log(`${id} ${c?'PASS':'FAIL'} -- ${d}`);results.push(c);}
const appSrc = fs.readFileSync(path.join(__dirname,'../..','src/app/App.jsx'),'utf8');
const CODES = ['DEAL_NOT_FOUND','DEAL_LOAD_FAILED','DEAL_SAVE_FAILED','DEAL_UPDATE_FAILED','DEAL_DELETE_FAILED'];
check('5-DEALSERROR-CODES', CODES.every(c=>appSrc.includes(`code: "${c}"`)), 'all 5 present');
const e = new PersistenceUnavailableError();
check('6TH-CODE-PERSISTENCE', e.code==='PERSISTENCE_UNAVAILABLE', e.code);
check('CODES-LOCALE-NEUTRAL', !CODES.some(c=>/[\u0600-\u06FF]/.test(c)) && !/[\u0600-\u06FF]/.test(e.code), 'all 6 codes are plain ASCII identifiers');
check('LOCALE-SELECTS-AT-RENDER', appSrc.includes('locale === "en" ? dealsError.message_en : dealsError.message_ar'), 'single presentation-boundary selection point');
const allPass = results.every(Boolean);
console.log('\nRUN_R6E_ERROR_INTEGRATION=' + (allPass?'PASS':'FAIL'));
process.exit(allPass?0:1);
