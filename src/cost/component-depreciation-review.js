'use strict';
const crypto=require('node:crypto');
const {verifyCostApproachInputPacketIntegrity}=require('./cost-approach-inputs');
const {calculateCostApproachIndication}=require('../engines/valuation/cost-approach');
const {VERSION,STATUS,assessCostDepreciationCore,canonicalAttributionSerialization}=require('./component-depreciation-review-core');
function assessCostDepreciationAttribution(args={}){
 const verified=verifyCostApproachInputPacketIntegrity(args.packet);
 const old=verified?calculateCostApproachIndication(args.packet):null;
 return assessCostDepreciationCore(args,old,verified,value=>crypto.createHash('sha256').update(canonicalAttributionSerialization(value)).digest('hex'));
}
module.exports={VERSION,STATUS,assessCostDepreciationAttribution};
