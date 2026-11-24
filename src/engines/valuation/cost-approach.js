'use strict';
const crypto=require('crypto');
const {verifyCostApproachInputPacketIntegrity}=require('../../cost/cost-approach-inputs');
const {COST_APPROACH_MODEL_VERSION,COST_APPROACH_RESULT_STATUS,calculateCostApproachCore,canonicalCostSerialization}=require('./cost-approach-core');
function calculateCostApproachIndication(packet){
 return calculateCostApproachCore(packet,verifyCostApproachInputPacketIntegrity(packet),value=>crypto.createHash('sha256').update(canonicalCostSerialization(value)).digest('hex'));
}
module.exports={COST_APPROACH_MODEL_VERSION,COST_APPROACH_RESULT_STATUS,calculateCostApproachIndication};
