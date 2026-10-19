import http from 'node:http';
import {mkdir,writeFile,readFile,copyFile} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import os from 'node:os';
import path from 'node:path';

// Temporary loopback receiver; never connects to Supabase or accepts credentials.
export async function startPrivateStorageReceiver({expectedObjects=5,maxBytes=5000000}={}){
  const root=path.join(os.tmpdir(),'CODEX-PRIVATE-STORAGE-BACKUP-20261019',randomUUID());
  await mkdir(path.join(root,'backup'),{recursive:true});
  await mkdir(path.join(root,'restore-check'),{recursive:true});
  const capability='/'+randomUUID(),records=new Map();let total=0,result;
  const hash=b=>createHash('sha256').update(b).digest('hex');
  const server=http.createServer(async(req,res)=>{
    const reply=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
    if(req.headers.origin!=='http://localhost:5173')return reply(403,{error:'Origin rejected'});
    res.setHeader('Access-Control-Allow-Origin','http://localhost:5173');
    res.setHeader('Access-Control-Allow-Methods','POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers','content-type,x-backup-path,x-backup-bucket,x-backup-bytes');
    if(!req.url?.startsWith(capability+'/'))return reply(404,{error:'Unknown receiver'});
    if(req.method==='OPTIONS'){res.writeHead(204);return res.end();}
    if(req.method!=='POST')return reply(405,{error:'Method rejected'});
    try{
      if(req.url===capability+'/finish'){
        if(records.size!==expectedObjects)return reply(409,{error:'Incomplete inventory'});
        await writeFile(path.join(root,'private-inventory.json'),JSON.stringify({project:'vxfpwzevatwucvmeszen',created_at:new Date().toISOString(),objects:[...records.values()]},null,2));
        result={storage_backup:true,object_count:records.size,bytes:total,all_restore_hashes_match:true,private_directory:root,remote_writes:0,database_auth_backup:false,storage_service_restore:false};
        reply(200,result);server.close();return;
      }
      const number=req.url.slice((capability+'/object/').length);
      if(req.url!==capability+'/object/'+number||!/^\d+$/.test(number)||Number(number)>=expectedObjects)return reply(400,{error:'Invalid object index'});
      if(records.has(number))return reply(409,{error:'Object already backed up'});
      const bucket=req.headers['x-backup-bucket'],expected=Number(req.headers['x-backup-bytes']);
      if(!['school-assets','mutabaah-report-archives'].includes(bucket)||!Number.isSafeInteger(expected)||expected<1||total+expected>maxBytes)return reply(400,{error:'Inventory limit'});
      const chunks=[];let size=0;
      for await(const chunk of req){size+=chunk.length;if(size>expected||size>maxBytes)throw Error('Size limit');chunks.push(chunk);}
      if(size!==expected)return reply(400,{error:'Size mismatch'});
      const bytes=Buffer.concat(chunks),sha256=hash(bytes),file='object-'+String(Number(number)+1).padStart(4,'0')+'.bin';
      await writeFile(path.join(root,'backup',file),bytes,{flag:'wx'});
      await copyFile(path.join(root,'backup',file),path.join(root,'restore-check',file));
      if(hash(await readFile(path.join(root,'restore-check',file)))!==sha256)throw Error('Restore mismatch');
      records.set(number,{bucket,name:decodeURIComponent(req.headers['x-backup-path']||''),file,bytes:size,sha256,restored:true});total+=size;
      reply(200,{saved:true,bytes:size,restore_matches:true});
    }catch{reply(500,{error:'Private backup failed; partial files retained'});}
  });
  server.requestTimeout=20000;
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  return {url:'http://127.0.0.1:'+server.address().port+capability,get result(){return result;},close:()=>new Promise(resolve=>server.close(resolve))};
}
