'use strict';
const crypto=require('node:crypto');
const {createMarketIndicatorPolicyReview}=require('./market-indicator-policy-review-core');
module.exports=createMarketIndicatorPolicyReview(value=>crypto.createHash('sha256').update(value).digest('hex'),require('./market-evidence-governance'));
