'use strict';
const crypto=require('node:crypto');
const {createLeaseEvidenceCore}=require('./lease-income-evidence-core');
module.exports=createLeaseEvidenceCore(value=>crypto.createHash('sha256').update(value).digest('hex'));
