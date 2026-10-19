import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const exec=promisify(execFile);
const conn='host=127.0.0.1 port=55436 user=qa06 dbname=qa06_fixture connect_timeout=5';
async function sql(s){return (await exec('C:/Program Files/PostgreSQL/18/bin/psql.exe',['-X','-qAt','-v','ON_ERROR_STOP=1','-d',conn,'-c',s],{windowsHide:true})).stdout.trim();}
test('PostgreSQL keyset >1000: 1305 generated targets, no accounts inserted',async()=>{
 assert.equal(await sql("select current_database()||':'||current_setting('port')"),'qa06_fixture:55436');
 const before=await sql("select md5(prosrc) from pg_proc where oid='public.list_parent_reminder_targets(date)'::regprocedure");
 // Replace only the target feed INSIDE a transaction, then roll back the definition.
 // The QA05 wrapper, ordering, keyset predicate and hard cap are the actual proposal.
 const request="begin;create or replace function public.list_parent_reminder_targets(p_date date) returns table(guardian_id uuid,pending_children integer) language sql stable security definer set search_path='' as $$select ('90000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,1 from generate_series(1,1305)i$$;with a as materialized(select * from list_parent_reminder_targets_page('2026-10-18',null,500)),b as materialized(select * from list_parent_reminder_targets_page('2026-10-18',(select guardian_id from a order by guardian_id desc limit 1),500)),c as materialized(select * from list_parent_reminder_targets_page('2026-10-18',(select guardian_id from b order by guardian_id desc limit 1),500)),d as materialized(select * from list_parent_reminder_targets_page('2026-10-18',(select guardian_id from c order by guardian_id desc limit 1),500)) select jsonb_build_object('pages',jsonb_build_array((select count(*) from a),(select count(*) from b),(select count(*) from c),(select count(*) from d)),'distinct_total',(select count(distinct guardian_id) from (select guardian_id from a union all select guardian_id from b union all select guardian_id from c)x),'oversize_cap',(select count(*) from list_parent_reminder_targets_page('2026-10-18',null,9999)));rollback";
 const result=JSON.parse(await sql(request));assert.deepEqual(result.pages,[500,500,305,0]);assert.equal(result.distinct_total,1305);assert.equal(result.oversize_cap,500);
 assert.equal(await sql("select md5(prosrc) from pg_proc where oid='public.list_parent_reminder_targets(date)'::regprocedure"),before);
});
