import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { fixtureSql } from './postqa06-pg.mjs';

// Actual read-only production definitions; every table/function below lives
// in a disposable transaction on the fixed loopback fixture, never remote.
const snapshot = JSON.parse(await readFile(new URL('./fixtures/report-ramadan-20261019.json', import.meta.url), 'utf8'));
const schema = 'report_ramadan_' + randomUUID().replaceAll('-', '');
const q = value => "'" + String(value).replaceAll("'", "''") + "'";
const sid = '10000000-0000-4000-8000-000000000001';
const cid = '20000000-0000-4000-8000-000000000001';
const year = '30000000-0000-4000-8000-000000000001';
const term = '40000000-0000-4000-8000-000000000001';
const period = '50000000-0000-4000-8000-000000000001';
const titles = ['Puasa Ramadan', 'Sahur', 'Salat Tarawih', 'Salat Witir', 'Tadarus Al-Qur’an', 'Sedekah Ramadan', 'Doa dan Zikir Ramadan'];

test('actual Ramadan report RPC: semester, finalization, haid, history and role gates', async () => {
  const definitions = ['mutabaah_ramadan_date_allowed', 'mutabaah_is_exempt', 'get_mutabaah_report_bonus']
    .map(name => snapshot.definitions[name].replaceAll('public.', schema + '.').replaceAll('auth.', schema + '.').trim() + ';').join('\n');
  const activities = titles.map((title, i) => {
    const id = `60000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`;
    const rule = [0, 2, 3].includes(i) ? 'exempt' : i === 4 ? 'configurable' : 'normal';
    return `insert into ${schema}.mutabaah_activities values(${q(id)},${q('ramadan_' + i)},${q(title)},${i},'bonus','ramadan',true,ARRAY[1,2,3,4,5,6,7],${q(rule)});`;
  }).join('\n');
  const sql = `begin;
    create schema ${schema};
    set local search_path=${schema};
    select set_config('qa.report.role','admin',true),set_config('qa.report.active','true',true);
    create function ${schema}.uid() returns uuid language sql as $$select ${q(sid)}::uuid$$;
    create function ${schema}.qa06_account_active() returns boolean language sql as $$select current_setting('qa.report.active')='true'$$;
    create function ${schema}.has_role(r text) returns boolean language sql as $$select r=current_setting('qa.report.role')$$;
    create table students(id uuid,gender text);
    create table classes(id uuid,academic_year_id uuid);
    create table semesters(id uuid,academic_year_id uuid,starts_on date,ends_on date);
    create table student_enrollments(student_id uuid,class_id uuid,starts_on date,ends_on date);
    create table homeroom_assignments(class_id uuid,teacher_id uuid);
    create table mutabaah_activities(id uuid,code text,title text,sort_order integer,scoring_mode text,category text,is_active boolean,allowed_weekdays integer[],haid_rule text);
    create table mutabaah_day_conditions(student_id uuid,entry_date date,is_haid boolean);
    create table mutabaah_day_submissions(student_id uuid,entry_date date,status text);
    create table mutabaah_entries(student_id uuid,activity_id uuid,entry_date date,completed boolean);
    create table app_settings(key text,value jsonb);
    create table mutabaah_ramadan_periods(id uuid,starts_on date,ends_on date,is_enabled boolean);
    create table mutabaah_ramadan_activity_links(period_id uuid,activity_id uuid);
    insert into students values(${q(sid)},'female');
    insert into classes values(${q(cid)},${q(year)});
    insert into semesters values(${q(term)},${q(year)},current_date-10,current_date+10);
    insert into student_enrollments values(${q(sid)},${q(cid)},current_date-2,null);
    insert into mutabaah_ramadan_periods values(${q(period)},current_date-1,current_date,true);
    insert into app_settings values('mutabaah_haid_quran_exempt','true');
    ${activities}
    insert into mutabaah_ramadan_activity_links select ${q(period)},id from mutabaah_activities;
    insert into mutabaah_activities values('60000000-0000-4000-8000-000000000099','dhuha','Salat Duha',99,'bonus','normal',true,ARRAY[1,2,3,4,5,6,7],'exempt');
    insert into mutabaah_day_conditions values(${q(sid)},current_date,true);
    insert into mutabaah_day_submissions select ${q(sid)},current_date-n,'finalized' from generate_series(0,2)n;
    insert into mutabaah_entries select ${q(sid)},a.id,current_date-n,true from mutabaah_activities a cross join generate_series(0,2)n where a.category<>'ramadan' or n<=1;
    ${definitions}
    do $qa$ declare r jsonb; b jsonb; begin
      r:=${schema}.get_mutabaah_report_bonus(${q(cid)},${q(term)});
      if jsonb_array_length(r->0->'bonuses')<>8 then raise exception 'Missing Ramadan/normal activities'; end if;
      for b in select value from jsonb_array_elements(r->0->'bonuses') loop
        if b->>'title' in ('Puasa Ramadan','Salat Tarawih','Salat Witir','Tadarus Al-Qur’an') then
          if (b->>'achieved')::int<>1 or (b->>'possible')::int<>1 then raise exception 'Haid exemption incorrect: %',b;end if;
        elsif b->>'title'='Salat Duha' then
          if (b->>'achieved')::int<>2 then raise exception 'Normal activity lost';end if;
        elsif (b->>'achieved')::int<>2 or (b->>'possible')::int<>2 then raise exception 'Period boundary incorrect: %',b;end if;
      end loop;
      update ${schema}.mutabaah_day_submissions set status='draft' where entry_date=current_date-1;
      r:=${schema}.get_mutabaah_report_bonus(${q(cid)},${q(term)});
      if (select (value->>'achieved')::int from jsonb_array_elements(r->0->'bonuses') where value->>'title'='Puasa Ramadan')<>0 then raise exception 'Draft counted';end if;
      update ${schema}.mutabaah_day_submissions set status='finalized';
      update ${schema}.mutabaah_activities set is_active=false where category='ramadan';
      update ${schema}.mutabaah_ramadan_periods set is_enabled=false;
      r:=${schema}.get_mutabaah_report_bonus(${q(cid)},${q(term)});
      if jsonb_array_length(r->0->'bonuses')<>8 then raise exception 'Historical Ramadan removed';end if;
      update ${schema}.mutabaah_entries set entry_date=entry_date-interval '1 year' where activity_id<>'60000000-0000-4000-8000-000000000099';
      update ${schema}.mutabaah_ramadan_periods set starts_on=starts_on-interval '1 year',ends_on=ends_on-interval '1 year';
      r:=${schema}.get_mutabaah_report_bonus(${q(cid)},${q(term)});
      if jsonb_array_length(r->0->'bonuses')<>1 then raise exception 'Outside-semester Ramadan leaked';end if;
      perform set_config('qa.report.role','parent',true);
      begin perform ${schema}.get_mutabaah_report_bonus(${q(cid)},${q(term)});raise exception 'PARENT_WAS_ALLOWED';
      exception when others then if sqlerrm='PARENT_WAS_ALLOWED' then raise;end if;end;
      perform set_config('qa.report.role','admin',true);perform set_config('qa.report.active','false',true);
      begin perform ${schema}.get_mutabaah_report_bonus(${q(cid)},${q(term)});raise exception 'INACTIVE_WAS_ALLOWED';
      exception when others then if sqlerrm='INACTIVE_WAS_ALLOWED' then raise;end if;end;
    end $qa$;
    select 'RAMADAN_REPORT_PASS';
    rollback;`;
  assert.match(await fixtureSql(sql), /RAMADAN_REPORT_PASS/);
});
