'use strict';
const crypto=require('node:crypto');
const {createComparableEvidenceCore}=require('./comparable-evidence-core');
module.exports=createComparableEvidenceCore(value=>crypto.createHash('sha256').update(value).digest('hex'));
