'use strict';
const crypto=require('node:crypto');
const {createContractualIncomeReviewCore}=require('./contractual-income-asset-review-core');
const leaseEvidenceCore=require('../market/lease-income-evidence');
module.exports=createContractualIncomeReviewCore(value=>crypto.createHash('sha256').update(value).digest('hex'),leaseEvidenceCore);
