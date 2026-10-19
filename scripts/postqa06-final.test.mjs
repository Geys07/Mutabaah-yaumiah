import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import os from 'node:os';
import path from 'node:path';

// Only a new, synthetic database. Never change these guards to a remote URL.
const evidence=path.join(os.tmpdir(),'CODEX-PASCA-QA06-20261018');
const {fixtureSql:sql}=await import('./postqa06-pg.mjs');
async function file(p){return sql(await readFile(path.resolve(p),'utf8'));}
assert.equal(await sql("select current_database()||':'||current_setting('port')"),'postqa06_fixture:55436');
const {ids:fixture}=JSON.parse(await readFile(path.join(evidence,'implementation-fixture-manifest.json'),'utf8'));
const {admin,parent,teacher,other,principal,disabled,child,unplaced,exited,returned,wrongYear,year,futureYear,classId,futureClass,activity}=fixture;
const asUser=id=>"set role authenticated;set request.jwt.claim.sub='"+id+"';";
const today="(now() at time zone 'Asia/Jakarta')::date";
test('rebased implementation denies all 43 audited RPC paths',async()=>{
 assert.equal(await sql(asUser(disabled)+"select count(*) from get_mutabaah_accessible_classes()"),'0');
 await file('supabase-proposals/qa06/security-review.sql');
 assert.equal(await sql(asUser(disabled)+"select count(*) from get_mutabaah_accessible_classes()"),'0');
 const review=JSON.parse(await readFile(new URL('../supabase/RPC-AUTHORIZATION-REVIEW.json',import.meta.url),'utf8'));
 const patched=review.filter(r=>r.test_inactive);
 for(const f of patched){
  const types=f.signature.slice(f.signature.indexOf('(')+1,-1).split(',').filter(Boolean);
  const expression=f.signature.split('(')[0]+'('+types.map(t=>'NULL::'+t).join(',')+')';
  try{
   const result=await sql(asUser(disabled)+'select to_jsonb(x) from public.'+expression+' x');
   assert.ok(!result||result==='null'||result==='false',f.signature+' exposed data: '+result);
  }catch(e){assert.match(e.stderr||e.message,/Akun tidak aktif/,f.signature);}
 }
 assert.equal(patched.length,43);
});

test('active role/ownership boundaries and bootstrap remain available',async()=>{
 assert.equal(await sql(asUser(admin)+"select has_role('admin') and is_staff() and qa06_account_active()"),'t');
 assert.equal(await sql(asUser(principal)+"select has_role('principal') and is_staff()"),'t');
 assert.equal(await sql(asUser(teacher)+"select count(*) from get_mutabaah_accessible_classes()"),'1');
 assert.equal(await sql(asUser(parent)+"select count(*) from get_mutabaah_accessible_classes()"),'0');
 assert.equal(await sql(asUser(teacher)+"select mutabaah_can_read_report_class('"+classId+"')"),'t');
 assert.equal(await sql(asUser(teacher)+"select mutabaah_can_read_report_class('"+futureClass+"')"),'f');
 assert.equal(await sql(asUser(parent)+"select mutabaah_can_read_report_class('"+classId+"')"),'f');
 assert.equal(await sql(asUser(disabled)+"select count(*) from profiles where user_id='"+disabled+"'"),'1');
 assert.equal(await sql(asUser(disabled)+"select count(*) from classes"),'0');
 assert.equal(await sql(asUser(parent)+"select count(*) from students where id='"+child+"'"),'1');
 assert.equal(await sql(asUser(other)+"select count(*) from students where id='"+child+"'"),'0');
});

test('four write paths enforce historical placement without losing past/returned data',async()=>{
 await file('supabase-proposals/qa06/mutabaah-enrollment-review.sql');
 const answers=JSON.stringify([{activity_id:activity,completed:true}]);
 const calls=(id,offset=0)=>[
  "submit_parent_mutabaah_day('"+id+"',"+today+'-('+offset+"),false,'"+answers+"',false)",
  "save_parent_mutabaah_day('"+id+"',"+today+'-('+offset+"),false,'"+answers+"')",
  "save_mutabaah_day('"+id+"',"+today+'-('+offset+"),'"+answers+"')",
  "set_parent_mutabaah_haid('"+id+"',"+today+'-('+offset+"),false)"
 ];
 for(const id of [unplaced,exited,wrongYear])for(const c of calls(id))await assert.rejects(sql(asUser(parent)+'select '+c),/penempatan/);
 for(const c of calls(returned,3))await assert.rejects(sql(asUser(parent)+'select '+c),/penempatan/);
 for(const c of calls(child,11))await assert.rejects(sql(asUser(parent)+'select '+c),/penempatan/);
 for(const [id,offset] of [[child,0],[exited,2],[returned,6],[returned,0]])for(const c of calls(id,offset))await sql(asUser(parent)+'select '+c);
 assert.equal(await sql("select count(*) from mutabaah_entries where student_id='"+returned+"'"),'2');
 for(const c of calls(child))await assert.rejects(sql(asUser(other)+'select '+c),/Akses/);
 for(const c of calls(child))await assert.rejects(sql(asUser(disabled)+'select '+c),/Akses/);
});

test('ledger internal RPCs remain service-only and migration stays OFF',async()=>{
 await file('supabase-proposals/qa05/review-and-apply.sql');
 for(const signature of ['list_parent_reminder_targets_page(date,uuid,integer)','parent_reminder_pending_qa05(uuid,date)','claim_parent_reminder_qa05(uuid,date)','begin_parent_reminder_qa05(uuid,date,uuid)','finish_parent_reminder_qa05(uuid,date,uuid,text,boolean,text)']){
  assert.equal(await sql("select has_function_privilege('anon','"+signature+"','execute') or has_function_privilege('authenticated','"+signature+"','execute')"),'f');
  assert.equal(await sql("select has_function_privilege('service_role','"+signature+"','execute')"),'t');
 }
 assert.equal(await sql("select value->>'enabled' from app_settings where key='daily_reminder'"),'false');
 assert.equal(await sql('select count(*) from parent_reminder_deliveries'),'0');
});
