'use strict';
const { readZipEntries } = require('./zip-reader');
const { extractElements,extractLocalTagTexts } = require('./xml-utils');
const { PARSER_FORMAT,PARSER_STATUS,PARSED_ATOM_KIND,createParsedAtom,createParserResult } = require('./contracts');
const ADAPTER_ID='DOCX_PASSIVE_TEXT_V1';
function supports({fileName='',mimeType=''}={}) {return /\.docx$/i.test(fileName)||/wordprocessingml\.document/i.test(mimeType);}
async function parse({document,content,maxAtoms=5000}) {
  const result=data=>createParserResult({document,adapterId:ADAPTER_ID,format:PARSER_FORMAT.DOCX,...data});
  if (!Number.isInteger(maxAtoms)||maxAtoms<1||maxAtoms>5000) throw new TypeError('maxAtoms invalid');
  if (!supports(document)) return result({status:PARSER_STATUS.UNSUPPORTED,reason:'DOCUMENT_NOT_DOCX'});
  try {
    const entries=await readZipEntries(content);
    if (!entries.has('[Content_Types].xml')||!entries.has('word/document.xml')) return result({status:PARSER_STATUS.REJECTED,reason:'INVALID_DOCX_PACKAGE'});
    const xml=new TextDecoder().decode(entries.get('word/document.xml'));
    const atoms=[];let paragraph=0,characters=0;
    for(const p of extractElements(xml,'p')) {
      paragraph++; const text=extractLocalTagTexts(p.innerXml,'t').join('');
      if(!text.trim())continue;
      characters+=text.length;
      if(atoms.length>=maxAtoms||characters>1000000) return result({status:PARSER_STATUS.REJECTED,reason:'DOCX_LIMIT_EXCEEDED'});
      atoms.push(createParsedAtom({atomId:`${document.documentId}:paragraph:${paragraph}`,document,adapterId:ADAPTER_ID,
        kind:PARSED_ATOM_KIND.TEXT,rawValue:text,valueType:'STRING',location:{kind:'SECTION',section:`PARAGRAPH:${paragraph}`,paragraph},metadata:{extraction:'PASSIVE_MAIN_DOCUMENT_TEXT'}}));
    }
    return result({status:PARSER_STATUS.PARSED,atoms,warnings:['DOCX_MAIN_TEXT_ONLY_NO_PAGE_LAYOUT_IMAGES_OR_LINK_FETCH']});
  } catch(e) {return result({status:PARSER_STATUS.REJECTED,reason:'INVALID_DOCX_PACKAGE'});}
}
module.exports={ADAPTER_ID,supports,parse};
