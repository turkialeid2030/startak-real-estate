'use strict';
// SERVER-ONLY optional adapter. The personal browser UI must never import this
// file: existing time-forward holdout uses node:crypto for protocol hashing.
const {evaluateTimeForwardHoldout}=require('./time-forward-valuation-holdout');
const {evaluateExternalQualification}=require('../governance/external-three-gates-readiness');
function evaluateServerExternalQualification(args={}){
 return evaluateExternalQualification({...args,evaluateHoldout:evaluateTimeForwardHoldout});
}
module.exports={evaluateServerExternalQualification};
