import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {randomUUID} from 'node:crypto';
import path from 'node:path';
const exec=promisify(execFile),bin='C:/Program Files/PostgreSQL/18/bin/psql.exe';
const conn='host=127.0.0.1 port=55436 user=qa06 dbname=qa06_fixture connect_timeout=5';
async function sql(s){return (await exec(bin,['-X','-qAt','-v','ON_ERROR_STOP=1','-d',conn,'-c',s],{windowsHide:true})).stdout.trim();}
const parent='10000000-0000-4000-8000-000000000001';
const call=(id,offset=0,answers=[])=>"set role authenticated;set request.jwt.claim.sub='"+parent+"';select submit_parent_mutabaah_day('"+id+"',((now() at time zone 'Asia/Jakarta')::date-("+offset+")),false,'"+JSON.stringify(answers)+"',false)";
test('candidate placement guard: rejects no placement/post-exit/future year; preserves past correction',async()=>{
 assert.equal(await sql("select current_database()||':'||current_setting('port')"),'qa06_fixture:55436');
 const unplaced=randomUUID(),exited=randomUUID(),future=randomUUID();
 await sql("insert into students(id,status,gender,full_name,nis) values('"+unplaced+"','active','female','CODEX-UJI-20261016 no-placement','FIXTURE'),('"+exited+"','exited','female','CODEX-UJI-20261016 exited','FIXTURE'),('"+future+"','active','female','CODEX-UJI-20261016 future','FIXTURE');insert into student_guardians(student_id,guardian_id) values('"+unplaced+"','"+parent+"'),('"+exited+"','"+parent+"'),('"+future+"','"+parent+"');insert into student_enrollments(student_id,class_id,starts_on,ends_on) values('"+exited+"','30000000-0000-4000-8000-000000000001',(now() at time zone 'Asia/Jakarta')::date-10,(now() at time zone 'Asia/Jakarta')::date-1);insert into student_enrollments(student_id,class_id,starts_on) select '"+future+"',id,(now() at time zone 'Asia/Jakarta')::date-1 from classes where academic_year_id='40000000-0000-4000-8000-000000000002' order by name limit 1");
 // Observe the baseline behavior before applying the local candidate.
 assert.equal(JSON.parse(await sql(call(unplaced))).success,true);
 await exec(bin,['-X','-q','-v','ON_ERROR_STOP=1','-d',conn,'-f',path.resolve('supabase-proposals/qa06/mutabaah-enrollment-review.sql')],{windowsHide:true});
 for(const id of [unplaced,exited,future])await assert.rejects(sql(call(id)),/di luar penempatan/);
 const answers=[{activity_id:'50000000-0000-4000-8000-000000000001',completed:true}];
 assert.equal(JSON.parse(await sql(call(exited,1,answers))).success,true);
 assert.equal(await sql("select count(*) from mutabaah_day_submissions where student_id='"+unplaced+"'"),'1'); // Existing test row retained.
 assert.equal(await sql("select has_function_privilege('anon','submit_parent_mutabaah_day(uuid,date,boolean,jsonb,boolean)','execute')"),'f');
});
