import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {randomUUID} from 'node:crypto';
import {writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
const exec=promisify(execFile);
const conn='host=127.0.0.1 port=55436 user=qa06 dbname=qa06_fixture connect_timeout=5';
async function sql(s){return (await exec('C:/Program Files/PostgreSQL/18/bin/psql.exe',['-X','-qAt','-v','ON_ERROR_STOP=1','-d',conn,'-c',s],{windowsHide:true})).stdout.trim();}
assert.equal(await sql("select current_database()||':'||current_setting('port')"),'qa06_fixture:55436');
const parent='10000000-0000-4000-8000-000000000001';
const child=randomUUID(),second=randomUUID();
await sql("insert into students(id,status,gender) values('"+child+"','active','female'),('"+second+"','active','male');insert into student_guardians values('"+child+"','"+parent+"'),('"+second+"','"+parent+"'),('"+second+"','10000000-0000-4000-8000-000000000006')");
await writeFile(path.join(os.tmpdir(),'CODEX-QA06-20261018','mutabaah-fixture-ids.json'),JSON.stringify({local_only:true,children:[child,second]}));
const prayer='50000000-0000-4000-8000-000000000001';
const date=n=>"((now() at time zone 'Asia/Jakarta')::date-("+n+"))";
const answer=(id,value)=>({activity_id:id,completed:value});
function call(student,answers,haid=false,final=false,day=date(2),user=parent){return "set role authenticated;set request.jwt.claim.sub='"+user+"';select submit_parent_mutabaah_day('"+student+"',"+day+","+haid+",'"+JSON.stringify(answers).replaceAll("'","''")+"'::jsonb,"+final+")";}
const where=(student,n)=>"student_id='"+student+"' and entry_date="+date(n);

test('PostgreSQL Mutabaah: created/updated/deleted audit; no same-value duplicate',async()=>{
 await sql(call(child,[answer(prayer,true)]));
 assert.equal(await sql('select count(*) from mutabaah_entry_history where '+where(child,2)),'1');
 await sql(call(child,[answer(prayer,true)]));
 assert.equal(await sql('select count(*) from mutabaah_entry_history where '+where(child,2)),'1');
 await sql(call(child,[answer(prayer,false)]));await sql(call(child,[]));
 assert.equal(await sql("select string_agg(change_type,',' order by id) from mutabaah_entry_history where "+where(child,2)),'created,updated,deleted');
 assert.equal(await sql('select count(*) from mutabaah_entries where '+where(child,2)),'0');
});
test('PostgreSQL Mutabaah: finalization autofills ordinary requirements; correction returns draft',async()=>{
 const result=JSON.parse(await sql(call(child,[],false,true,date(3))));assert.equal(result.auto_filled,7);
 assert.equal(await sql('select status from mutabaah_day_submissions where '+where(child,3)),'finalized');
 assert.equal(await sql("select count(*) from mutabaah_entries e join mutabaah_activities a on a.id=e.activity_id where e.student_id='"+child+"' and e.entry_date="+date(3)+" and a.category='shalat' and e.completed=false"),'5');
 await sql(call(child,[answer(prayer,true)],false,false,date(3)));
 assert.equal(await sql('select status from mutabaah_day_submissions where '+where(child,3)),'draft');
});
test('PostgreSQL Mutabaah: haid exempts five prayers and configured Quran, ordinary remains',async()=>{
 const answers=Array.from({length:7},(_,i)=>answer('50000000-0000-4000-8000-'+String(i+1).padStart(12,'0'),true));
 await sql(call(child,answers,false,false,date(4)));
 await sql(call(child,[answer('50000000-0000-4000-8000-000000000007',true)],true,false,date(4)));
 assert.equal(await sql('select count(*) from mutabaah_entries where '+where(child,4)),'1');
 assert.equal(await sql("select count(*) from mutabaah_entry_history where "+where(child,4)+" and change_type='deleted'"),'6');
 await assert.rejects(sql(call(second,[],true,false,date(4))));
});
test('PostgreSQL Mutabaah: cross-parent/inactive/anonymous denied and invalid batch rolls back',async()=>{
 await assert.rejects(sql(call('20000000-0000-4000-8000-000000000003',[],false,false,date(5))));
 await assert.rejects(sql(call(second,[],false,false,date(5),'10000000-0000-4000-8000-000000000006')));
 await assert.rejects(sql("set role anon;select submit_parent_mutabaah_day('"+child+"',"+date(5)+",false,'[]',false)"));
 await assert.rejects(sql(call(child,[answer(prayer,true),answer('59999999-0000-4000-8000-000000000001',true)],false,false,date(5))));
 assert.equal(await sql('select count(*) from mutabaah_entries where '+where(child,5)),'0');
 assert.equal(await sql('select count(*) from mutabaah_entry_history where '+where(child,5)),'0');
 assert.equal(await sql('select count(*) from mutabaah_day_submissions where '+where(child,5)),'0');
});
test('PostgreSQL Mutabaah: inclusive 30-day WIB limit and midnight/year boundary',async()=>{
 await sql(call(child,[],false,false,date(29)));
 await assert.rejects(sql(call(child,[],false,false,date(30))),/Tanggal hanya/);
 await assert.rejects(sql(call(child,[],false,false,date(-1))),/Tanggal hanya/);
 assert.equal(await sql("select (timestamptz '2026-12-31 17:00:00+00' at time zone 'Asia/Jakarta')::date"),'2027-01-01');
});
test('PostgreSQL Mutabaah: concurrent children retain separate answers',async()=>{
 await Promise.all([sql(call(child,[answer(prayer,true)],false,false,date(8))),sql(call(second,[answer(prayer,false)],false,false,date(8)))]);
 assert.equal(await sql('select completed from mutabaah_entries where '+where(child,8)),'t');
 assert.equal(await sql('select completed from mutabaah_entries where '+where(second,8)),'f');
});
test('PostgreSQL Mutabaah: Ramadan date/enabled gate preserves ordinary activities',async()=>{
 const activity='50000000-0000-4000-8000-000000000008';
 assert.equal(await sql("select mutabaah_ramadan_date_allowed('"+activity+"','"+child+"',"+date(0)+")"),'f');
 const output=await sql("begin;update mutabaah_ramadan_periods set is_enabled=true;"+call(child,[answer(activity,true),answer('50000000-0000-4000-8000-000000000007',true)],false,false,date(0))+";reset role;select count(*) from mutabaah_entries where "+where(child,0)+";rollback");
 assert.equal(output.split(/\r?\n/).at(-1),'2');
 assert.equal(await sql("select mutabaah_ramadan_date_allowed('"+activity+"','"+child+"',"+date(-3)+")"),'f');
});
