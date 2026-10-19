import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fixtureSql } from './postqa06-pg.mjs';

const migration = await readFile(new URL('../supabase/migrations/20261019072131_password_reset_requests_pagination.sql', import.meta.url), 'utf8');
const baseline = migration.replace('r.requested_at desc, r.id', 'r.requested_at desc\n limit 300');
// Rewrite only schema references and auth.uid for a disposable SQL fixture.
// Auth/has_role here are stubs, not Supabase cloud authorization evidence.
const isolated = sql => sql.replaceAll('public.', 'pagination_fixture.').replaceAll('auth.uid()', 'pagination_fixture.uid()');
const setup = `
 create schema pagination_fixture;
 create function pagination_fixture.uid() returns uuid language sql stable as $$select '10000000-0000-4000-8000-000000000001'::uuid$$;
 create function pagination_fixture.has_role(text) returns boolean language sql stable as $$select current_setting('pagination_fixture.role')=$1$$;
 create table pagination_fixture.profiles(user_id uuid primary key, full_name text, phone text, account_status text);
 create table pagination_fixture.user_roles(user_id uuid, role text);
 create table pagination_fixture.password_reset_requests(id uuid primary key, user_id uuid, status text, requested_at timestamptz, reviewed_at timestamptz, used_at timestamptz, code_attempts integer);
 insert into pagination_fixture.profiles values ('10000000-0000-4000-8000-000000000001','Fixture Admin','080000000001','active'),('10000000-0000-4000-8000-000000000002','Fixture Parent','080000000002','active');
 insert into pagination_fixture.user_roles values ('10000000-0000-4000-8000-000000000002','parent');
 insert into pagination_fixture.password_reset_requests
 select ('20000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'10000000-0000-4000-8000-000000000002',
 case when i<=350 then 'pending' when i<=400 then 'processing' else 'used' end,
 '2026-10-19 00:00:00+00'::timestamptz + (i/3)*interval '1 second',null,null,0
 from generate_series(1,1305)i;
 set local pagination_fixture.role='admin';
`;
const summary = `select jsonb_build_object(
 'total',(select count(*) from pagination_fixture.list_password_reset_requests()),
 'pending',(select count(*) from pagination_fixture.list_password_reset_requests() where status='pending'),
 'processing',(select count(*) from pagination_fixture.list_password_reset_requests() where status='processing'),
 'after300',(select count(*) from (select * from pagination_fixture.list_password_reset_requests() order by requested_at desc,id offset 300 limit 50)t),
 'lastPage',(select count(*) from (select * from pagination_fixture.list_password_reset_requests() order by requested_at desc,id offset 1300 limit 50)t),
 'distinctIds',(select count(distinct id) from pagination_fixture.list_password_reset_requests()),
 'masked',(select bool_and(phone_masked='0800******02') from pagination_fixture.list_password_reset_requests())
 );`;

test('1305 SQL fixture: reproduce cap, verify full counts/pages, masking and active-Admin gate', async () => {
 const output = await fixtureSql('begin;'+setup+isolated(baseline)+summary+isolated(migration)+summary+`
 select jsonb_build_object('pagedTotal',sum(n),'pagedDistinct',count(distinct id)) from (
 select p.id,1 as n from generate_series(0,26) g
 cross join lateral (select r.id from pagination_fixture.list_password_reset_requests() r order by requested_at desc,id offset g*50 limit 50)p)t;
 set local pagination_fixture.role='parent';
 select count(*) from pagination_fixture.list_password_reset_requests();
 set local pagination_fixture.role='admin';
 update pagination_fixture.profiles set account_status='inactive' where user_id=pagination_fixture.uid();
 select count(*) from pagination_fixture.list_password_reset_requests();
 rollback;
 `);
 const lines=output.split('\n');
 const before=JSON.parse(lines[0]), after=JSON.parse(lines[1]);
 assert.equal(before.total,300);
 assert.equal(before.pending,300);
 assert.equal(before.processing,0);
 assert.equal(before.after300,0);
 assert.deepEqual(after,{total:1305,pending:350,processing:50,after300:50,lastPage:5,distinctIds:1305,masked:true});
 assert.deepEqual(JSON.parse(lines[2]),{pagedTotal:1305,pagedDistinct:1305});
 assert.deepEqual(lines.slice(3),['0','0']);
 assert.equal(await fixtureSql("select count(*) from pg_namespace where nspname='pagination_fixture'"),'0');
 console.log('Baseline: 300 total / 0 processing. Fixed: 1305 total / 50 processing; 27 pages without duplicate IDs; rollback verified.');
});
