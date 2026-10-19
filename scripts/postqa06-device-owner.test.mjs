import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fixtureSql as sql} from './postqa06-pg.mjs';
const {ids}=JSON.parse(await readFile(path.join(os.tmpdir(),'CODEX-PASCA-QA06-20261018','implementation-fixture-manifest.json'),'utf8'));
await sql(await readFile(new URL('../supabase-proposals/qa06/subscription-owner.sql',import.meta.url),'utf8'));
const insert=(kind,id,endpoint)=>"insert into "+kind+"_push_subscriptions("+(kind==='parent'?'guardian_id':'user_id')+",endpoint,p256dh,auth_key) values('"+id+"','"+endpoint+"','"+'A'.repeat(40)+"','"+'B'.repeat(20)+"') on conflict(endpoint) do nothing";

test('concurrent parent/admin registrations have one owner across both tables',async()=>{
 const endpoint='https://fixture.invalid/device-'+randomUUID();
 const results=await Promise.allSettled([sql(insert('parent',ids.parent,endpoint)),sql(insert('admin',ids.admin,endpoint))]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
 const failure=results.find(r=>r.status==='rejected');assert.equal(failure.reason.code,'23505');
 assert.equal(await sql("select (select count(*) from parent_push_subscriptions where endpoint='"+endpoint+"')+(select count(*) from admin_push_subscriptions where endpoint='"+endpoint+"')"),'1');
});

test('same owner is idempotent; another role/account cannot claim its device',async()=>{
 const endpoint='https://fixture.invalid/device-'+randomUUID();
 await sql(insert('parent',ids.parent,endpoint));await sql(insert('parent',ids.parent,endpoint));
 await assert.rejects(sql(insert('admin',ids.admin,endpoint)),e=>e.code==='23505');
 await assert.rejects(sql(insert('parent',ids.other,endpoint)),e=>e.code==='23505');
 assert.equal(await sql("select guardian_id from parent_push_subscriptions where endpoint='"+endpoint+"'"),ids.parent);
});

test('database rejects inactive or mismatched subscription role and exposes no helper RPC',async()=>{
 await assert.rejects(sql(insert('parent',ids.disabled,'https://fixture.invalid/device-'+randomUUID())),e=>e.code==='42501');
 await assert.rejects(sql(insert('admin',ids.parent,'https://fixture.invalid/device-'+randomUUID())),e=>e.code==='42501');
 assert.equal(await sql("select has_function_privilege('anon','enforce_push_subscription_owner_qa06()','execute') or has_function_privilege('authenticated','enforce_push_subscription_owner_qa06()','execute')"),'f');
});

test('calendar answer-existence helper is internal; nested daily save still works',async()=>{
 assert.equal(await sql("select has_function_privilege('anon','mutabaah_ramadan_date_allowed(uuid,uuid,date)','execute') or has_function_privilege('authenticated','mutabaah_ramadan_date_allowed(uuid,uuid,date)','execute')"),'f');
 const auth="set role authenticated;set request.jwt.claim.sub='"+ids.parent+"';";
 await assert.rejects(sql(auth+"select mutabaah_ramadan_date_allowed('"+ids.activity+"','"+ids.child+"',current_date)"),e=>e.code==='42501');
 const answer=JSON.stringify([{activity_id:ids.activity,completed:true}]);
 const result=await sql(auth+"select submit_parent_mutabaah_day('"+ids.child+"',(now() at time zone 'Asia/Jakarta')::date,false,'"+answer+"',false)");
 assert.equal(JSON.parse(result).success,true);
});
