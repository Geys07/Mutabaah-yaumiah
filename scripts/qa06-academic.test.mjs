import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {randomUUID} from 'node:crypto';
const exec=promisify(execFile);
const conn='host=127.0.0.1 port=55436 user=qa06 dbname=qa06_fixture connect_timeout=5';
async function sql(s){return (await exec('C:/Program Files/PostgreSQL/18/bin/psql.exe',['-X','-qAt','-v','ON_ERROR_STOP=1','-d',conn,'-c',s],{windowsHide:true})).stdout.trim();}
assert.equal(await sql("select current_database()||':'||current_setting('port')"),'qa06_fixture:55436');
const admin='10000000-0000-4000-8000-000000000005',parent='10000000-0000-4000-8000-000000000001';
const student='20000000-0000-4000-8000-000000000001',classId='30000000-0000-4000-8000-000000000001',semester='70000000-0000-4000-8000-000000000001';
const asUser=(id=admin)=>"set role authenticated;set request.jwt.claim.sub='"+id+"';";
const clock=d=>"set qa06.clock='"+d+"T12:00:00Z';";

test('PostgreSQL academic: exit/return uses same identity and retains historical entries',async()=>{
 const before=await sql("select count(*) from mutabaah_entries where student_id='"+student+"'");
 await assert.rejects(sql(asUser(parent)+clock('2026-10-18')+"select admin_change_student_lifecycle('"+student+"','exit',null)"),/Hanya admin/);
 await sql(asUser()+clock('2026-10-18')+"select admin_change_student_lifecycle('"+student+"','exit',null)");
 assert.equal(await sql("select status from students where id='"+student+"'"),'exited');
 await assert.rejects(sql(asUser()+clock('2026-10-18')+"select admin_change_student_lifecycle('"+student+"','return','"+classId+"')"),/bert[a-z]+|masih aktif/);
 await sql(asUser()+clock('2026-10-19')+"select admin_change_student_lifecycle('"+student+"','return','"+classId+"')");
 assert.equal(await sql("select status from students where id='"+student+"'"),'active');
 assert.equal(await sql("select count(*) from student_enrollments where student_id='"+student+"'"),'2');
 assert.equal(await sql("select count(*) from mutabaah_entries where student_id='"+student+"'"),before);
});
test('PostgreSQL academic: overlapping/out-of-year semester edits rejected',async()=>{
 await assert.rejects(sql("update semesters set ends_on='2027-01-02' where id='"+semester+"'"),/tumpang tindih/);
 await assert.rejects(sql("update semesters set starts_on='2026-06-30' where id='"+semester+"'"),/dalam tahun ajaran/);
});
test('PostgreSQL archive: authorized metadata, dedupe and semester lock',async()=>{
 const id=randomUUID(),file=classId+'/'+semester+'/'+id+'.docx';
 await sql("insert into storage.objects values('mutabaah-report-archives','"+file+"','"+admin+"')");
 const call=(user=admin,c=classId)=>asUser(user)+"select register_mutabaah_report_archive_v2('"+id+"','"+c+"','"+semester+"','CODEX-UJI-20261016.docx',2,least((now() at time zone 'Asia/Jakarta')::date,'2026-12-31'::date),'"+'a'.repeat(64)+"')";
 assert.equal(JSON.parse(await sql(call())).created,true);assert.equal(JSON.parse(await sql(call())).created,false);
 await assert.rejects(sql(call(parent)),/Tidak diizinkan/);
 await assert.rejects(sql(call('10000000-0000-4000-8000-000000000004')),/Tidak diizinkan/);
 assert.equal(JSON.parse(await sql(call('10000000-0000-4000-8000-000000000003'))).created,false);
 await assert.rejects(sql(call('10000000-0000-4000-8000-000000000003','30000000-0000-4000-8000-000000000002')),/Tidak diizinkan/);
 assert.equal(await sql('select count(*) from mutabaah_report_archives'),'1');
 await assert.rejects(sql("update semesters set ends_on='2026-12-30' where id='"+semester+"'"),/setelah ada rapor/);
});
test('PostgreSQL promotion: VII split A/B, VIII to IX, IX graduate, concurrent confirmation once',async()=>{
 const before=await sql('select count(*) from mutabaah_entry_history');
 const assignments=JSON.parse(await sql("select json_agg(json_build_object('enrollment_id',e.id,'destination',case c.grade when 9 then 'LULUS' when 8 then 'IX A' else case when s.id='"+student+"' then 'VIII A' else 'VIII B' end end)) from student_enrollments e join classes c on c.id=e.class_id join students s on s.id=e.student_id where c.academic_year_id='40000000-0000-4000-8000-000000000001' and e.ends_on is null and s.status='active'"));
 assert.equal(assignments.length,4);
 const request=asUser()+clock('2027-07-01')+"select confirm_mutabaah_promotion(2026,'"+JSON.stringify(assignments)+"'::jsonb,4)";
 const results=await Promise.allSettled([sql(request),sql(request)]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
 const result=JSON.parse(results.find(r=>r.status==='fulfilled').value);assert.equal(result.moved,3);assert.equal(result.graduated,1);
 assert.equal(await sql('select count(*) from mutabaah_promotion_runs'),'1');
 assert.equal(await sql("select status from students where id='20000000-0000-4000-8000-000000000003'"),'graduated');
 assert.equal(await sql("select string_agg(name,',' order by name) from classes where academic_year_id='40000000-0000-4000-8000-000000000002'"),'IX A,VIII A,VIII B');
 assert.equal(await sql('select count(*) from mutabaah_entry_history'),before);
 assert.equal(await sql("select count(*) from student_enrollments a join student_enrollments b on a.student_id=b.student_id and a.id<b.id and daterange(a.starts_on,coalesce(a.ends_on,'infinity'::date),'[]') && daterange(b.starts_on,coalesce(b.ends_on,'infinity'::date),'[]')"),'0');
});
