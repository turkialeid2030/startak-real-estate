import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
// Pinned package bytes only. No runtime CDN/model download or private content.
export function localOcrAssets() {
  const root=name=>path.dirname(require.resolve(name+'/package.json'));
  for(const [name,version]of [['tesseract.js','7.0.0'],['tesseract.js-core','7.0.0'],['@tesseract.js-data/ara','1.0.0'],['@tesseract.js-data/eng','1.0.0']])
    if(JSON.parse(fs.readFileSync(path.join(root(name),'package.json'),'utf8')).version!==version)throw Error('OCR dependency requires protocol/accuracy review: '+name);
  const tesseract=root('tesseract.js'), core=root('tesseract.js-core');
  const files=[{name:'worker.min.js',source:path.join(tesseract,'dist/worker.min.js')}];
  // The owned worker fixes lstmOnly=true/OEM=1. Ship every supported LSTM
  // platform variant, including non-SIMD; legacy/OSD is never requested.
  for(const variant of ['-lstm','-simd-lstm','-relaxedsimd-lstm'])
    for(const suffix of ['.wasm.js','.wasm'])files.push({name:'tesseract-core'+variant+suffix,source:path.join(core,'tesseract-core'+variant+suffix)});
  for(const language of ['ara','eng'])files.push({name:language+'.traineddata.gz',source:path.join(root('@tesseract.js-data/'+language),'4.0.0_best_int',language+'.traineddata.gz')});
  files.push({name:'LICENSE.txt',source:path.join(tesseract,'LICENSE.md')});
  files.push({name:'CORE-LICENSE.txt',source:path.join(core,'LICENSE')});
  files.push({name:'ARA-PACKAGE-NOTICE.json',source:path.join(root('@tesseract.js-data/ara'),'package.json')});
  files.push({name:'ENG-PACKAGE-NOTICE.json',source:path.join(root('@tesseract.js-data/eng'),'package.json')});
  const hash=createHash('sha256');
  for(const file of files){file.bytes=fs.readFileSync(file.source);hash.update(file.name);hash.update(file.bytes);}
  const base='/assets/ocr/'+hash.digest('hex').slice(0,20);
  return {base,files};
}
export function localOcrAssetsPlugin(assets) {
  return {name:'startak-local-ocr-assets',
    generateBundle(){for(const file of assets.files)this.emitFile({type:'asset',fileName:assets.base.slice(1)+'/'+file.name,source:file.bytes});},
    configureServer(server){server.middlewares.use((req,res,next)=>{
      const file=assets.files.find(file=>assets.base+'/'+file.name===req.url?.split('?')[0]);
      if(!file)return next();
      res.setHeader('Content-Type',file.name.endsWith('.js')?'application/javascript':file.name.endsWith('.wasm')?'application/wasm':file.name.endsWith('.gz')?'application/gzip':'text/plain');
      res.end(file.bytes);
    });},
  };
}
