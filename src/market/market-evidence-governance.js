'use strict';
const crypto=require('node:crypto');
const {createMarketEvidenceGovernance}=require('./market-evidence-governance-core');
module.exports=createMarketEvidenceGovernance(value=>crypto.createHash('sha256').update(value).digest('hex'));
