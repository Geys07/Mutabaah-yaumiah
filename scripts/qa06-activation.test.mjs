import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {randomUUID} from 'node:crypto';
const exec=promisify(execFile);
const conn='host=127.0.0.1 port=55436 user=qa06 dbname=qa06_fixture connect_timeout=5';
async function sql(s){return (await exec('C:/Program Files/PostgreSQL/18/bin/psql.exe',['-X','-qAt','-v','ON_ERROR_STOP=1','-d',conn,'-c',s],{windowsHide:true})).stdout.trim();}
assert.equal(await sql("select current_database()||':'||current_setting('port')"),'qa06_fixture:55436');
test('PostgreSQL activation: one-time code under concurrent claims; no partial losing account',async()=>{
 const users=[randomUUID(),randomUUID()],student='20000000-0000-4000-8000-000000000002';
 // Synthetic phone/code, used only in this local database. No Auth API or messages.
 const phone='080000009999',code='abcd';
 await sql("insert into auth.users values('"+users[0]+"'),('"+users[1]+"');insert into student_family_contacts values('"+student+"','mother','"+phone+"','CODEX-UJI-20261016 fixture');insert into parent_activation_codes values('"+randomUUID()+"','"+student+"','mother','"+phone+"','"+code+"',null,now()+interval '1 hour')");
 const request=id=>"set role service_role;set request.jwt.claim.role='service_role';select complete_parent_activation('"+phone+"','"+code+"','"+id+"','ignored')";
 const results=await Promise.allSettled(users.map(id=>sql(request(id))));assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
 assert.equal(await sql("select count(*) from parent_activation_codes where used_at is not null"),'1');
 assert.equal(await sql("select count(*) from profiles where phone='"+phone+"'"),'1');
 assert.equal(await sql("select count(*) from student_guardians where guardian_id in ('"+users.join("','")+"')"),'1');
 await assert.rejects(sql(request(users[0])),/tidak valid|kedaluwarsa/);
 await assert.rejects(sql("set role authenticated;select complete_parent_activation('"+phone+"','"+code+"','"+users[0]+"','ignored')"),/permission denied/);
});
