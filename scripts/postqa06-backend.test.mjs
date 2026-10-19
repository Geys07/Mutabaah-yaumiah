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
const ids=Array.from({length:11},()=>randomUUID());
const [admin,parent,teacher,other,principal,disabled,child,unplaced,exited,returned,wrongYear]=ids;
const year=randomUUID(),futureYear=randomUUID(),classId=randomUUID(),futureClass=randomUUID(),activity=randomUUID();
const asUser=id=>"set role authenticated;set request.jwt.claim.sub='"+id+"';";
const today="(now() at time zone 'Asia/Jakarta')::date";
await sql(ids.slice(0,6).map(id=>"insert into auth.users values('"+id+"');insert into profiles(user_id,full_name,account_status) values('"+id+"','CODEX-UJI-20261016 fixture','"+(id===disabled?'disabled':'active')+"');").join('')+
 [[admin,'admin'],[parent,'parent'],[teacher,'homeroom_teacher'],[other,'parent'],[principal,'principal'],[disabled,'homeroom_teacher']].map(([id,r])=>"insert into user_roles values('"+id+"','"+r+"');").join('')+
 "insert into academic_years(id,start_year,starts_on,ends_on) values('"+year+"',2026,"+today+"-60,"+today+"+300),('"+futureYear+"',2027,"+today+"+301,"+today+"+665);insert into classes(id,academic_year_id,grade,name) values('"+classId+"','"+year+"',8,'CODEX-UJI VIII'),('"+futureClass+"','"+futureYear+"',9,'CODEX-UJI IX');"+
 ids.slice(6).map(id=>"insert into students(id,full_name,gender,status) values('"+id+"','CODEX-UJI-20261016 fixture','female','"+(id===exited?'exited':'active')+"');insert into student_guardians(student_id,guardian_id,relationship) values('"+id+"','"+parent+"','guardian');").join('')+
 "insert into student_enrollments(student_id,class_id,starts_on,ends_on) values('"+child+"','"+classId+"',"+today+"-10,null),('"+exited+"','"+classId+"',"+today+"-20,"+today+"-2),('"+returned+"','"+classId+"',"+today+"-20,"+today+"-5),('"+returned+"','"+classId+"',"+today+"-1,null),('"+wrongYear+"','"+futureClass+"',"+today+"-1,null);insert into homeroom_assignments(class_id,teacher_id) values('"+classId+"','"+teacher+"'),('"+classId+"','"+disabled+"');insert into mutabaah_activities(id,code,title,report_group,category) values('"+activity+"','CODEX-UJI-ordinary','CODEX-UJI ordinary','Akhlak','akhlak');insert into mutabaah_report_grading(id) values(true);insert into app_settings(key,value) values('daily_reminder','{\"enabled\":false}');");
await writeFile(path.join(evidence,'implementation-fixture-manifest.json'),JSON.stringify({run:'CODEX-UJI-20261016',database:'postqa06_fixture',local_only:true,ids:{admin,parent,teacher,other,principal,disabled,child,unplaced,exited,returned,wrongYear,year,futureYear,classId,futureClass,activity}},null,2));

test('baseline reproduced; install active-account gate and deny every patched RPC',async()=>{
 assert.equal(await sql(asUser(disabled)+"select count(*) from get_mutabaah_accessible_classes()"),'0');
 assert.equal(JSON.parse(await sql(asUser(disabled)+'select get_mutabaah_report_grading()')).kkm,70);
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
