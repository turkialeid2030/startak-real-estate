'use strict';
const fs=require('node:fs/promises');
async function localTlsPreview(base){
 const upstream=new URL(base);if(upstream.protocol==='https:')return {url:base,local:false,close:async()=>{}};
 if(upstream.protocol!=='http:'||!['127.0.0.1','localhost'].includes(upstream.hostname))throw Error('Browser acceptance requires HTTPS or a loopback preview');
 const dir=await fs.mkdtemp(require('node:path').join(require('node:os').tmpdir(),'startak-test-tls-'));let server;
 try{
  const key=dir+'/key.pem',cert=dir+'/cert.pem';
  require('node:child_process').execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',key,'-out',cert,'-days','1','-subj','/CN=localhost','-addext','subjectAltName=IP:127.0.0.1,DNS:localhost'],{stdio:'ignore'});
  server=require('node:https').createServer({key:await fs.readFile(key),cert:await fs.readFile(cert)},(req,res)=>{
   const request=require('node:http').request({hostname:upstream.hostname,port:upstream.port||80,path:req.url,method:req.method,headers:{...req.headers,host:upstream.host}},response=>{res.writeHead(response.statusCode,response.headers);response.pipe(res);});
   request.setTimeout(20000,()=>request.destroy(Error('Loopback preview timeout')));
   request.on('error',()=>{if(!res.headersSent){res.writeHead(502);res.end('Loopback preview failed');}else res.destroy();});req.pipe(request);
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  return {url:'https://127.0.0.1:'+server.address().port,local:true,close:async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await fs.rm(dir,{recursive:true,force:true});}};
 }catch(error){server?.closeAllConnections();server?.close();await fs.rm(dir,{recursive:true,force:true});throw error;}
}
module.exports={localTlsPreview};
