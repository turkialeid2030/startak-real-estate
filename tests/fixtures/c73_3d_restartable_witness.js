'use strict';
// Child-process-only CI fixture. Private witness signing key is generated in
// private TEST folder and reused across restart. Not a WORM or production signer.
const {createDurableWitnessServer}=require('../../src/security/c73-restart-durable-witness-server');
let server;
process.on('message',async msg=>{
 if(msg?.type==='stop'){
  if(server)server.close(()=>process.exit(0));else process.exit(0);
  return;
 }
 if(msg?.type!=='start'||server)return;
 try{
  const created=await createDurableWitnessServer({rootPath:msg.rootPath,
   clientId:msg.clientId,clientPublicKey:msg.clientPublicKey});
  server=created.server;
  server.listen(0,'127.0.0.1',()=>{
   process.send?.({type:'ready',port:server.address().port,publicKey:created.publicKey});
  });
 }catch(e){process.send?.({type:'error',error:String(e.code||e.message)});process.exitCode=1;}
});
