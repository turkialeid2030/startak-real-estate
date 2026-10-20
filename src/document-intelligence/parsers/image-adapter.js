'use strict';
const {createParserResult,PARSER_STATUS,PARSER_FORMAT}=require('./contracts');
const supports=({fileName='',mimeType=''}={})=>/\.(png|jpe?g)$/i.test(fileName)||/^image\/(png|jpeg)$/i.test(mimeType);
const ADAPTER_ID='LOCAL_IMAGE_INTAKE_V1';
async function parse({document}){
  return createParserResult({document,adapterId:ADAPTER_ID,format:PARSER_FORMAT.IMAGE,status:PARSER_STATUS.UNSUPPORTED,reason:'IMAGE_OCR_NOT_RUN'});
}
module.exports={supports,parse,ADAPTER_ID};
