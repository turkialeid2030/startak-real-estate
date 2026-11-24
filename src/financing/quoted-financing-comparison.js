'use strict';
const crypto=require('node:crypto');
const {createQuotedFinancingComparison}=require('./quoted-financing-comparison-core');
module.exports=createQuotedFinancingComparison(value=>crypto.createHash('sha256').update(value).digest('hex'));
