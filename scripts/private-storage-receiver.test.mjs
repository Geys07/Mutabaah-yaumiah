import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {startPrivateStorageReceiver} from './private-storage-receiver.mjs';

test('private receiver rejects other origins, incomplete/duplicate objects; restores exact bytes',async()=>{
  const receiver=await startPrivateStorageReceiver({expectedObjects:1,maxBytes:100});
  const headers={Origin:'http://localhost:5173','Content-Type':'application/octet-stream','X-Backup-Path':'fixture-only.txt','X-Backup-Bucket':'school-assets','X-Backup-Bytes':'7'};
  try{
    assert.equal((await fetch(receiver.url+'/object/0',{method:'POST',headers:{...headers,Origin:'https://untrusted.invalid'},body:'fixture'})).status,403);
    assert.equal((await fetch(receiver.url+'/finish',{method:'POST',headers:{Origin:headers.Origin}})).status,409);
    assert.equal((await fetch(receiver.url+'/object/0',{method:'POST',headers,body:'fixture'})).status,200);
    assert.equal((await fetch(receiver.url+'/object/0',{method:'POST',headers,body:'fixture'})).status,409);
    const finished=await fetch(receiver.url+'/finish',{method:'POST',headers:{Origin:headers.Origin}});
    assert.equal(finished.status,200);const result=await finished.json();
    assert.equal(result.object_count,1);assert.equal(result.bytes,7);
    assert.equal(await readFile(path.join(result.private_directory,'restore-check','object-0001.bin'),'utf8'),'fixture');
    assert.equal(result.database_auth_backup,false);
  }finally{await receiver.close();}
});
