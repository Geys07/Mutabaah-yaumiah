import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fixtureSql as sql} from './postqa06-pg.mjs';
const {ids}=JSON.parse(await readFile(path.join(os.tmpdir(),'CODEX-PASCA-QA06-20261018','implementation-fixture-manifest.json'),'utf8'));

test('disabled Admin, Principal, assigned Teacher and owning Parent lose their privileged access',async()=>{
 for(const role of ['admin','principal','homeroom_teacher','parent']){
  const user=randomUUID();
  await sql("insert into auth.users values('"+user+"');insert into profiles(user_id,full_name,account_status) values('"+user+"','CODEX-UJI-20261016 disabled role','disabled');insert into user_roles values('"+user+"','"+role+"');insert into student_guardians(student_id,guardian_id,relationship) values('"+ids.child+"','"+user+"','guardian');insert into homeroom_assignments(class_id,teacher_id) values('"+ids.classId+"','"+user+"')");
  const auth="set role authenticated;set request.jwt.claim.sub='"+user+"';";
  assert.equal(await sql(auth+"select has_role('"+role+"') or is_staff() or qa06_account_active()"),'f');
  assert.equal(await sql(auth+"select count(*) from students where id='"+ids.child+"'"),'0');
  assert.equal(await sql(auth+'select count(*) from get_mutabaah_accessible_classes()'),'0');
  assert.equal(await sql(auth+"select count(*) from profiles where user_id='"+user+"'"),'1');
  const day="(now() at time zone 'Asia/Jakarta')::date";
  for(const call of [
   "submit_parent_mutabaah_day('"+ids.child+"',"+day+",false,'[]',false)",
   "save_parent_mutabaah_day('"+ids.child+"',"+day+",false,'[]')",
   "save_mutabaah_day('"+ids.child+"',"+day+",'[]')",
   "set_parent_mutabaah_haid('"+ids.child+"',"+day+",false)"
  ])await assert.rejects(sql(auth+'select '+call),/Akses/);
 }
 assert.equal(await sql("set role authenticated;set request.jwt.claim.sub='"+ids.admin+"';select has_role('admin')"),'t');
});
