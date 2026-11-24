'use strict';
const crypto=require('node:crypto');
const {createPolicyShockScenarioCore}=require('./policy-shock-scenario-review-core');
module.exports=createPolicyShockScenarioCore(value=>crypto.createHash('sha256').update(value).digest('hex'),require('./comparable-evidence'));
