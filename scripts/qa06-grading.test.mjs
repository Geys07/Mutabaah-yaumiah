import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {randomUUID} from 'node:crypto';
const exec=promisify(execFile);
const conn='host=127.0.0.1 port=55436 user=qa06 dbname=qa06_fixture connect_timeout=5';
async function sql(s){return (await exec('C:/Program Files/PostgreSQL/18/bin/psql.exe',['-X','-qAt','-v','ON_ERROR_STOP=1','-d',conn,'-c',s],{windowsHide:true})).stdout.trim();}
assert.equal(await sql("select current_database()||':'||current_setting('port')"),'qa06_fixture:55436');
const classId=randomUUID(),semester='70000000-0000-4000-8000-000000000001',parent='10000000-0000-4000-8000-000000000001';
const asUser=id=>"set role authenticated;set request.jwt.claim.sub='"+id+"';";
const students=Array.from({length:4},()=>randomUUID());
await sql("insert into classes values('"+classId+"','40000000-0000-4000-8000-000000000001',7,'CODEX-SCORE-"+classId+"')");
for(const [i,id] of students.entries()){
 await sql("insert into students(id,status,gender,full_name,nis) values('"+id+"','active','male','CODEX-UJI score "+i+"','FIXTURE-"+i+"');insert into student_guardians(student_id,guardian_id) values('"+id+"','"+parent+"');insert into student_enrollments(student_id,class_id,starts_on,ends_on) values('"+id+"','"+classId+"',(now() at time zone 'Asia/Jakarta')::date,(now() at time zone 'Asia/Jakarta')::date)");
 const answers=Array.from({length:7},(_,a)=>({activity_id:'50000000-0000-4000-8000-'+String(a+1).padStart(12,'0'),completed:a<7-i}));
 await sql(asUser(parent)+"select submit_parent_mutabaah_day('"+id+"',(now() at time zone 'Asia/Jakarta')::date,false,'"+JSON.stringify(answers)+"',true)");
}
const report=id=>sql(asUser(id)+"select get_mutabaah_semester_report('"+classId+"','"+semester+"')");
test('PostgreSQL grading: actual semester RPC counts, percentages, grades and KKM',async()=>{
 const rows=JSON.parse(await report('10000000-0000-4000-8000-000000000005'));
 const expected=[[100,'A',true],[85.71,'B',true],[71.43,'C',false],[57.14,'D',false]];
 for(const [i,id]of students.entries()) {const row=rows.find(r=>r.id===id);assert.equal(row.expected_count,7);assert.equal(row.yes_count,7-i);assert.equal(row.percentage,expected[i][0]);assert.equal(row.grade,expected[i][1]);assert.equal(row.meets_kkm,expected[i][2]);assert.equal(row.is_complete,true);}
});
test('PostgreSQL grading: principal reads, unassigned teacher and parent denied',async()=>{
 assert.equal(JSON.parse(await report('10000000-0000-4000-8000-000000000004')).length,4);
 await assert.rejects(report(parent),/Akses kelas ditolak/);
 await assert.rejects(report('10000000-0000-4000-8000-000000000003'),/Akses kelas ditolak/);
});
