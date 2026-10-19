import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('queue: immutable scopes, recovery, ordering and logout isolation',async()=>{
  let user='fixture-A',listener,fail=false,release;
  const writes=[];
  globalThis.__qa06db={auth:{getSession:async()=>({data:{session:{user:{id:user}}}}),onAuthStateChange:fn=>{listener=fn;fn('INITIAL_SESSION',{user:{id:user}});}},rpc:async(_name,p)=>{if(release)await new Promise(r=>{release.resolve=r});if(fail)return {error:Error('offline')};writes.push(structuredClone(p));return {data:{success:true}};}};
  const source=(await readFile(new URL('../src/lib/parentDaySaveQueue.js',import.meta.url),'utf8')).replace('import { supabase } from "./supabase";','const supabase=globalThis.__qa06db;');
  const q=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
  const payload={p_student_id:'child-A',p_date:'2026-10-18',p_answers:[{activity_id:'a',completed:true}],p_finalize:false};
  const binding=await q.captureParentDayOwner();
  fail=true;await assert.rejects(q.enqueueParentDaySave(payload,binding));
  assert.deepEqual(await q.readUnsavedParentDay('child-A',payload.p_date,binding),payload);
  assert.equal(await q.readUnsavedParentDay('child-B',payload.p_date,binding),null);
  fail=false;const a=q.enqueueParentDaySave(payload,binding);payload.p_answers[0].completed=false;const b=q.enqueueParentDaySave(payload,binding);await Promise.all([a,b]);
  assert.deepEqual(writes.map(p=>p.p_answers[0].completed),[true,false]);assert.equal(await q.readUnsavedParentDay('child-A',payload.p_date,binding),null);
  release={};const first=q.enqueueParentDaySave(payload,binding);await new Promise(r=>setTimeout(r,0));const second=q.enqueueParentDaySave(payload,binding);const rejected=assert.rejects(second,/Sesi akun/);
  listener('SIGNED_OUT',null);user='fixture-B';listener('SIGNED_IN',{user:{id:user}});release.resolve();release=null;await first;await rejected;
  assert.equal(writes.length,3);await assert.rejects(q.enqueueParentDaySave(payload,binding),/Sesi akun/);
  const nextBinding=await q.captureParentDayOwner();assert.equal(await q.readUnsavedParentDay('child-A',payload.p_date,nextBinding),null);
  listener('TOKEN_REFRESHED',{user:{id:user}});assert.equal(q.isParentDayOwnerCurrent(nextBinding),true);
  delete globalThis.__qa06db;
});
