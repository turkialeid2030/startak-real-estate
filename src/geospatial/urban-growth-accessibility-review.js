'use strict';
const crypto=require('node:crypto');
const {createUrbanGrowthAccessibilityCore}=require('./urban-growth-accessibility-review-core');
module.exports=createUrbanGrowthAccessibilityCore(value=>crypto.createHash('sha256').update(value).digest('hex'));
