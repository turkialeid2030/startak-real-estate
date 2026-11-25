'use strict';
const fs=require('node:fs');
const {evaluateCityRolling}=require('../src/reporting/public-city-rent-rolling');
const p='runtime-evidence/public-city-rent/observations.json';
try{
 if(fs.statSync(p).size>32*1024*1024)throw Error('CITY_ROLLING_SIZE');
 const rows=JSON.parse(fs.readFileSync(p,'utf8'));if(rows.length!==19954)throw Error('CITY_ROLLING_BASELINE_COUNT');
 const r=evaluateCityRolling(rows);if(r.development.n<100||r.holdout.n<100)throw Error('CITY_ROLLING_COHORT');
 fs.writeFileSync('runtime-evidence/public-city-rent/rolling-backtest.json',JSON.stringify(r,null,2)+'\n');
 console.log('PUBLIC_CITY_ROLLING '+JSON.stringify({rows:r.rows,development:r.development,holdout:r.holdout,developmentMapeCandidate:r.developmentMapeCandidate,productionModelSelected:false}));
}catch(e){console.error(e.message);process.exitCode=1;}
