import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
const exec=promisify(execFile);
const bin='C:/Program Files/PostgreSQL/18/bin';
const evidence=path.join(os.tmpdir(),'CODEX-QA06-20261018');
const connection='host=127.0.0.1 port=55436 user=qa06 dbname=qa06_fixture connect_timeout=5';
async function sql(query){const r=await exec(path.join(bin,'psql.exe'),['-X','-qAt','-v','ON_ERROR_STOP=1','-d',connection,'-c',query],{windowsHide:true});return r.stdout.trim();}
async function file(filename){await exec(path.join(bin,'psql.exe'),['-X','-q','-v','ON_ERROR_STOP=1','-d',connection,'-f',filename],{windowsHide:true});}
const guardian='10000000-0000-4000-8000-000000000001';
const day='2026-10-18';
await assert.equal(await sql("select current_database()||':'||current_setting('port')"),'qa06_fixture:55436');
await sql('REVOKE ALL ON FUNCTION public.list_parent_reminder_targets(date) FROM PUBLIC,anon,authenticated; GRANT EXECUTE ON FUNCTION public.list_parent_reminder_targets(date) TO service_role;');

test('PostgreSQL: selected baseline RLS predicates isolate parent and teacher',async()=>{
  for(const [suffix,expected] of [['1',2],['2',1],['3',2],['4',3],['5',3]]){
    assert.equal(await sql("set role authenticated;set request.jwt.claim.sub='10000000-0000-4000-8000-00000000000"+suffix+"';select count(*) from students"),String(expected));
  }
  assert.equal(await sql("set role authenticated;set request.jwt.claim.sub='"+guardian+"';select count(*) from students where id='20000000-0000-4000-8000-000000000003'"),'0');
  assert.equal(await sql('set role anon;select count(*) from students'),'0');
  // Known baseline gap: inactive parent still passes the ownership-only policy.
  assert.equal(await sql("set role authenticated;set request.jwt.claim.sub='10000000-0000-4000-8000-000000000006';select count(*) from students"),'1');
});
test('PostgreSQL: target eligibility counts DISTINCT children, excludes inactive and finalized',async()=>{
  assert.equal(await sql("select count(*)||':'||sum(pending_children) from list_parent_reminder_targets('"+day+"')"),'1:2');
  assert.equal(await sql("begin;insert into mutabaah_day_submissions values('20000000-0000-4000-8000-000000000001','"+day+"','finalized');select sum(pending_children) from list_parent_reminder_targets('"+day+"');rollback"),'1');
  assert.equal(await sql("begin;update student_enrollments set ends_on='2026-10-17';select count(*) from list_parent_reminder_targets('"+day+"');rollback"),'0');
});
test('PostgreSQL: original migration columns and restricted grants',async()=>{
  assert.equal(await sql("select count(*) from information_schema.columns where table_schema='public' and table_name='parent_reminder_deliveries'"),'11');
  for(const role of ['anon','authenticated'])assert.equal(await sql("select has_function_privilege('"+role+"','public.claim_parent_reminder_qa05(uuid,date)','EXECUTE')"),'f');
  assert.equal(await sql("select has_function_privilege('service_role','public.claim_parent_reminder_qa05(uuid,date)','EXECUTE')"),'t');
});
test('PostgreSQL: real unique/locking semantics prevent two claims; test clock only injected',async()=>{
  const migration=await readFile(new URL('../supabase-proposals/qa05/review-and-apply.sql',import.meta.url),'utf8');
  // Original migration already applied without changes. This COPY alters only now()
  // for deterministic 20:00 WIB tests; never overwrite the production proposal.
  const clockFile=path.join(evidence,'clock-only-fixture.sql');
  await writeFile(clockFile,migration.replaceAll('pg_catalog.now()',"(timestamptz '2026-10-18 13:00:00+00')"));await file(clockFile);
  const request="set role service_role;select public.claim_parent_reminder_qa05('"+guardian+"','"+day+"')";
  const claims=await Promise.all([sql(request),sql(request)]);assert.equal(claims.filter(Boolean).length,1);
  assert.equal(await sql('select count(*) from parent_reminder_deliveries'),'1');
});
test('PostgreSQL: uncertain sending not reclaimed; safe pre-send retries capped at three',async()=>{
  const token=await sql('select claim_token from parent_reminder_deliveries');
  assert.equal(await sql("select begin_parent_reminder_qa05('"+guardian+"','"+day+"','"+token+"')"),'t');
  assert.equal(await sql("select finish_parent_reminder_qa05('"+guardian+"','"+day+"','"+token+"','failed',false,'delivery_uncertain')"),'t');
  assert.equal(await sql("select claim_parent_reminder_qa05('"+guardian+"','"+day+"')"),'');
  await sql("do $$ declare i integer; t uuid; begin for i in 2..3 loop update parent_reminder_deliveries set status='failed',phase='complete',retry_safe=true,error='read_failed',attempted_at=timestamptz '2026-10-18 12:57+00'; t:=claim_parent_reminder_qa05('"+guardian+"','"+day+"');if t is null then raise exception 'safe retry failed';end if;end loop;update parent_reminder_deliveries set status='failed',phase='complete',retry_safe=true,attempted_at=timestamptz '2026-10-18 12:57+00';if claim_parent_reminder_qa05('"+guardian+"','"+day+"') is not null then raise exception 'unbounded retry';end if;end $$");
  assert.equal(await sql('select attempts from parent_reminder_deliveries'),'3');
});
test('PostgreSQL: selective proposal active gate blocks inactive table reads',async()=>{
  // Signature-only stubs permit grant review; they do not test report/Ramadan RPC bodies.
  await sql("create function get_mutabaah_bonus_counts(uuid,date,date) returns jsonb language sql as $$select '{}'::jsonb$$;create function get_mutabaah_monthly_required_report(uuid,date) returns jsonb language sql as $$select '{}'::jsonb$$;create function get_mutabaah_ramadan_settings() returns jsonb language sql as $$select '{}'::jsonb$$;create function get_parent_ramadan_day_activities(date) returns jsonb language sql as $$select '{}'::jsonb$$;");
  await file(path.resolve('supabase-proposals/qa06/security-review.sql'));
  assert.equal(await sql("set role authenticated;set request.jwt.claim.sub='10000000-0000-4000-8000-000000000006';select count(*) from students"),'0');
  assert.equal(await sql("set role authenticated;set request.jwt.claim.sub='"+guardian+"';select count(*) from students"),'2');
});
