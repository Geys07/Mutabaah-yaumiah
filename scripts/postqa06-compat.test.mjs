import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {fixtureSql as sql} from './postqa06-pg.mjs';

const evidence=path.join(os.tmpdir(),'CODEX-PASCA-QA06-20261018');
const {ids}=JSON.parse(await readFile(path.join(evidence,'implementation-fixture-manifest.json'),'utf8'));
const asParent="set role authenticated;set request.jwt.claim.sub='"+ids.parent+"';";
const today="(now() at time zone 'Asia/Jakarta')::date";

test('both daily RPCs retain audit and same-value writes do not duplicate history',async()=>{
 const student=randomUUID();
 await sql("insert into students(id,full_name,gender) values('"+student+"','CODEX-UJI-20261016 compatibility','female');insert into student_guardians(student_id,guardian_id,relationship) values('"+student+"','"+ids.parent+"','guardian');insert into student_enrollments(student_id,class_id,starts_on) values('"+student+"','"+ids.classId+"',"+today+"-10)");
 const answers=value=>JSON.stringify([{activity_id:ids.activity,completed:value}]);
 await sql(asParent+"select submit_parent_mutabaah_day('"+student+"',"+today+",false,'"+answers(true)+"',false)");
 await sql(asParent+"select save_parent_mutabaah_day('"+student+"',"+today+",false,'"+answers(false)+"')");
 await sql(asParent+"select save_parent_mutabaah_day('"+student+"',"+today+",false,'"+answers(false)+"')");
 assert.equal(await sql("select count(*) from mutabaah_entry_history where student_id='"+student+"'"),'2');
});

test('active parent activation remains one-use and service activation stays private',async()=>{
 const activationStudent=randomUUID();
 await sql("insert into students(id,full_name,gender) values('"+activationStudent+"','CODEX-UJI-20261016 activation','female')");
 const phone='0800000'+String(Math.floor(Math.random()*100000)).padStart(5,'0');
 const code='q'+randomUUID().replace(/[^a-f]/g,'').slice(0,3);
 await sql("update profiles set phone='"+phone+"' where user_id='"+ids.parent+"';insert into student_family_contacts(student_id,relationship,full_name,phone) values('"+activationStudent+"','guardian','CODEX-UJI-20261016 contact','"+phone+"') on conflict(student_id,relationship) do update set phone=excluded.phone;insert into parent_activation_codes(phone,student_id,code,relationship,expires_at) values('"+phone+"','"+activationStudent+"','"+code+"','guardian',now()+interval '10 minutes')");
 assert.equal(await sql(asParent+"select claim_parent_activation('"+code+"')"),activationStudent);
 await assert.rejects(sql(asParent+"select claim_parent_activation('"+code+"')"),/Kode tidak valid/);
 assert.equal(await sql("select has_function_privilege('authenticated','complete_parent_activation(text,text,uuid,text)','execute')"),'f');
 assert.equal(await sql(asParent+"select has_role('parent')"),'t');
});
