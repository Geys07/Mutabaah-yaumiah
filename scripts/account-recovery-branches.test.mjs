import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { randomUUID, webcrypto } from 'node:crypto';
import { stripTypeScriptTypes } from 'node:module';
import { fixtureSql } from './postqa06-pg.mjs';

// Source-only snapshot: never contains production account rows or environment values.
const snapshot = JSON.parse(await readFile(new URL('./fixtures/account-recovery-20261019.json', import.meta.url), 'utf8'));
const schema = 'account_recovery_20261019_' + randomUUID().replaceAll('-', '').slice(0, 8);
const admin = '10000000-0000-4000-8000-000000000001';
const parent = '10000000-0000-4000-8000-000000000002';
const oldHash = 'a'.repeat(64), newHash = 'b'.repeat(64);
const quote = value => value === null ? 'null' : "'" + String(value).replaceAll("'", "''") + "'";
const sql = query => fixtureSql(query);
const service = query => sql("set role service_role; set request.jwt.claim.role='service_role'; " + query);
const fn = name => `${schema}.${name}`;
const claim = (id, hash = oldHash, token = randomUUID()) => service(`select ${fn('claim_password_reset_code')}(${quote(id)},${quote(parent)},${quote(hash)},${quote(token)})`);
async function request(status = 'approved', extra = '') {
  const id = randomUUID();
  await sql(`insert into ${schema}.password_reset_requests(id,user_id,status,code_hash) values(${quote(id)},${quote(parent)},${quote(status)},${quote(oldHash)}); ${extra.replaceAll('$id', quote(id))}`);
  return id;
}
const row = async id => JSON.parse(await sql(`select to_jsonb(r) from ${schema}.password_reset_requests r where id=${quote(id)}`));

before(async () => {
  assert.equal(await sql("select current_database()||':'||current_setting('port')"), 'postqa06_fixture:55436');
  // Dedicated schema is retained as evidence; no old fixture or production rows are reset.
  await sql(`create schema ${schema};
    create table ${schema}.users(id uuid primary key);
    create table ${schema}.profiles(user_id uuid primary key,full_name text,phone text unique,account_status text,updated_at timestamptz default now());
    create table ${schema}.user_roles(user_id uuid,role text,unique(user_id,role));
    create table ${schema}.password_reset_requests(id uuid primary key,user_id uuid,status text check(status in ('pending','approved','processing','rejected','used','revoked')),requested_at timestamptz default now(),reviewed_at timestamptz,reviewed_by uuid,used_at timestamptz,revoked_at timestamptz,code_hash text,code_attempts integer not null default 0 check(code_attempts>=0),lock_reason text,processing_id uuid,processing_started_at timestamptz,check(status<>'approved' or code_hash is not null));
    create table ${schema}.parent_activation_codes(id uuid primary key,student_id uuid,relationship text,phone text,code text,used_at timestamptz,expires_at timestamptz);
    create table ${schema}.student_family_contacts(student_id uuid,relationship text,phone text,full_name text);
    create table ${schema}.student_guardians(student_id uuid,guardian_id uuid,relationship text,unique(student_id,guardian_id));
    create function ${schema}.auth_role() returns text language sql stable as $$select current_setting('request.jwt.claim.role',true)$$;
    create function ${schema}.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    create function ${schema}.has_role(text) returns boolean language sql stable as $$select exists(select 1 from ${schema}.user_roles r join ${schema}.profiles p on p.user_id=r.user_id where r.user_id=${schema}.uid() and r.role=$1 and p.account_status='active')$$;
    insert into ${schema}.users values('${admin}'),('${parent}');
    insert into ${schema}.profiles(user_id,full_name,phone,account_status) values('${admin}','Fixture Admin','080000000001','active'),('${parent}','Fixture Parent','080000000002','active');
    insert into ${schema}.user_roles values('${admin}','admin'),('${parent}','parent');`);
  for (const item of snapshot.functions) {
    const definition = item.definition.replaceAll('public.', schema + '.').replaceAll('auth.users', schema + '.users').replaceAll('auth.role()', schema + '.auth_role()').replaceAll('auth.uid()', schema + '.uid()');
    await sql(definition);
  }
  await sql(`grant usage on schema ${schema} to anon,authenticated,service_role;
    revoke all on all functions in schema ${schema} from public;
    grant execute on all functions in schema ${schema} to service_role;`);

});



// Retain a manifest for every dedicated schema, including failed earlier harness runs.
after(async () => {
  const names=JSON.parse(await sql("select coalesce(jsonb_agg(nspname),'[]'::jsonb) from pg_namespace where nspname ~ '^account_recovery_20261019_[0-9a-f]{8}$'"));
  const runs=[];
  for(const name of names){
    const ids=JSON.parse(await sql(`select jsonb_build_object('request_ids',(select jsonb_agg(id) from ${name}.password_reset_requests),'activation_ids',(select jsonb_agg(id) from ${name}.parent_activation_codes),'user_ids',(select jsonb_agg(id) from ${name}.users),'guardian_relations',(select jsonb_agg(to_jsonb(g)) from ${name}.student_guardians g))`));
    runs.push({schema:name,...ids});
  }
  await writeFile(new URL('./fixtures/account-recovery-local-run.json',import.meta.url),JSON.stringify({run:'CODEX-UJI-20261016',date:'2026-10-19',environment:'local PostgreSQL only',database:'postqa06_fixture',port:55436,sourceSnapshot:'account-recovery-20261019.json',remoteWrites:0,authApiCalls:0,retained:true,runs},null,2)+'\n');
});

test('SQL: concurrent claims have one winner; token ownership and used replay', async () => {
  const id = await request(), tokens = [randomUUID(), randomUUID()];
  const results = await Promise.all(tokens.map(token => claim(id, oldHash, token)));
  assert.deepEqual([...results].sort(), ['claimed','invalid']);
  const winner = tokens[results.indexOf('claimed')];
  assert.equal(await service(`select ${fn('finish_password_reset_code')}('${id}','${randomUUID()}',true)`),'f');
  assert.equal((await row(id)).status,'processing');
  assert.equal(await service(`select ${fn('finish_password_reset_code')}('${id}','${winner}',true)`),'t');
  assert.equal((await row(id)).status,'used');
  assert.equal(await claim(id),'invalid');
});

test('SQL: five concurrent wrong codes revoke once without losing attempt increments', async () => {
  const id = await request();
  const results = await Promise.all(Array.from({length:5}, () => claim(id,newHash)));
  assert.equal(results.filter(x=>x==='revoked').length,1);
  assert.equal(results.filter(x=>x==='invalid').length,4);
  const record=await row(id);
  assert.equal(record.code_attempts,5); assert.equal(record.status,'revoked');
  assert.equal(await claim(id),'invalid');
});

test('SQL: Auth failure finalization restores approved state for a later retry', async () => {
  const id=await request(), token=randomUUID();
  assert.equal(await claim(id,oldHash,token),'claimed');
  assert.equal(await service(`select ${fn('finish_password_reset_code')}('${id}','${token}',false)`),'t');
  const record=await row(id);
  assert.equal(record.status,'approved'); assert.equal(record.used_at,null); assert.equal(record.processing_id,null);
  assert.equal(await claim(id),'claimed');
});

test('SQL: reissue invalidates old hash and resets attempts; inactive targets/Admin denied', async () => {
  const id=await request('approved',`update ${schema}.password_reset_requests set code_attempts=4 where id=$id;`);
  const rotate=()=>service(`select ${fn('rotate_approved_password_reset_code')}('${id}','${admin}','${newHash}')`);
  assert.equal(await rotate(),'t'); assert.equal((await row(id)).code_attempts,0);
  assert.equal(await claim(id),'invalid'); assert.equal(await claim(id,newHash),'claimed');
  const guarded=await request();
  // Each negative gate runs in its own rolled-back transaction.
  for(const [mutation,who] of [[`update ${schema}.profiles set account_status='inactive' where user_id='${parent}'`,admin],[`update ${schema}.profiles set account_status='inactive' where user_id='${admin}'`,admin],[`insert into ${schema}.user_roles values('${parent}','admin')`,admin],['select 1',parent]]) {
    assert.equal(await sql(`begin;${mutation};set role service_role;set request.jwt.claim.role='service_role';select ${fn('rotate_approved_password_reset_code')}('${guarded}','${who}','${newHash}');rollback;`).then(x=>x.split('\n').at(-1)),'f');
  }
});

test('SQL: reissue racing old-code claim cannot both succeed', async () => {
  const id=await request();
  const [rotated,claimed]=await Promise.all([service(`select ${fn('rotate_approved_password_reset_code')}('${id}','${admin}','${newHash}')`),claim(id)]);
  assert.ok((rotated==='t'&&claimed==='invalid')||(rotated==='f'&&claimed==='claimed'));
});

test('SQL: guarded revoke racing claim has a single winning transition', async () => {
  const id=await request();
  const [revoked,claimed]=await Promise.all([sql(`with changed as(update ${schema}.password_reset_requests set status='revoked',revoked_at=now(),lock_reason='Fixture revoke' where id='${id}' and status='approved' returning id)select count(*) from changed`),claim(id)]);
  assert.ok((revoked==='1'&&claimed==='invalid')||(revoked==='0'&&claimed==='claimed'));
});

test('SQL: cancel stuck requires active Admin and more than five minutes', async () => {
  const recent=await request('processing',`update ${schema}.password_reset_requests set processing_id=gen_random_uuid(),processing_started_at=now() where id=$id;`);
  const stale=await request('processing',`update ${schema}.password_reset_requests set processing_id=gen_random_uuid(),processing_started_at=now()-interval '6 minutes' where id=$id;`);
  const cancel=(id,who=admin)=>service(`select ${fn('cancel_stuck_password_reset')}('${id}','${who}')`);
  assert.equal(await cancel(recent),'f'); assert.equal(await cancel(stale,parent),'f');
  assert.equal(await cancel(stale),'t'); assert.equal(await cancel(stale),'f');
  assert.equal((await row(stale)).processing_id,null);
});

test('SQL: recovery currently has no time expiry (historical code remains claimable)', async () => {
  const id=await request('approved',`update ${schema}.password_reset_requests set requested_at=now()-interval '365 days',reviewed_at=now()-interval '365 days' where id=$id;`);
  assert.equal(await claim(id),'claimed');
});

test('SQL: expired activation is rejected with no profile/guardian/code consumption', async () => {
  const id=randomUUID(), student=randomUUID(), user=randomUUID(), phone='080000009991';
  await sql(`insert into ${schema}.users values('${user}');insert into ${schema}.student_family_contacts values('${student}','mother','${phone}','Fixture Expired');insert into ${schema}.parent_activation_codes values('${id}','${student}','mother','${phone}','abcd',null,now()-interval '1 second');`);
  await assert.rejects(service(`select ${fn('complete_parent_activation')}('${phone}','abcd','${user}','ignored')`),/kedaluwarsa/);
  assert.equal(await sql(`select (select count(*) from ${schema}.profiles where user_id='${user}')+(select count(*) from ${schema}.student_guardians where guardian_id='${user}')+(select count(*) from ${schema}.parent_activation_codes where id='${id}' and used_at is not null)`),'0');
});

test('SQL: concurrent activation has one winning profile/guardian and consumes code once', async () => {
  const id=randomUUID(), student=randomUUID(), users=[randomUUID(),randomUUID()], phone='080000009992';
  await sql(`insert into ${schema}.users values('${users[0]}'),('${users[1]}');insert into ${schema}.student_family_contacts values('${student}','mother','${phone}','Fixture Concurrent');insert into ${schema}.parent_activation_codes values('${id}','${student}','mother','${phone}','abcd',null,now()+interval '1 hour');`);
  const activate=user=>service(`select ${fn('complete_parent_activation')}('${phone}','abcd','${user}','ignored')`);
  const results=await Promise.allSettled(users.map(activate));
  assert.equal(results.filter(x=>x.status==='fulfilled').length,1);
  assert.equal(await sql(`select count(*) from ${schema}.profiles where phone='${phone}'`),'1');
  assert.equal(await sql(`select count(*) from ${schema}.student_guardians where student_id='${student}'`),'1');
  assert.equal(await sql(`select count(*) from ${schema}.parent_activation_codes where id='${id}' and used_at is not null`),'1');
  await assert.rejects(activate(users[0]),/kedaluwarsa/);
});

test('SQL: internal RPCs reject authenticated client role', async () => {
  await assert.rejects(sql(`set role authenticated;select ${fn('claim_password_reset_code')}('${randomUUID()}','${parent}','${oldHash}','${randomUUID()}')`),/permission denied/);
});

// Edge handler tests execute captured TypeScript with mocked Supabase/Auth IO.
// These are not cloud sessions, HTTP deployment tests or evidence of real Auth writes.
function edgeHarness(name, state={}) {
  const record={id:randomUUID(),user_id:parent,status:'pending',code_hash:oldHash,...state.record};
  const calls=[];
  const db={
    auth:{getUser:async()=>({data:{user:{id:admin}},error:null}),admin:{updateUserById:async()=>{calls.push('auth-update');return {error:null};}}},
    from(table){
      let fields=null; const filters=[];
      const query={
        select:()=>query,eq:(key,value)=>{filters.push([key,value]);return query;},
        update:value=>{fields=value;return query;},
        maybeSingle:async()=>{
          if(table==='profiles')return {data:{account_status:state.active===false?'inactive':'active'},error:null};
          if(table==='user_roles')return {data:state.isAdmin===false?null:{role:'admin'},error:null};
          assert.equal(table,'password_reset_requests');
          if(!filters.every(([k,v])=>record[k]===v))return {data:null,error:null};
          if(fields){Object.assign(record,fields);calls.push('update');}
          return {data:structuredClone(record),error:null};
        },
      };return query;
    },
    rpc:async(name,args)=>{calls.push({name,args});return {data:state.rpcResult??true,error:null};},
  };
  let handler;
  const env={SUPABASE_URL:'https://fixture.invalid',SUPABASE_SERVICE_ROLE_KEY:'fixture-only',PASSWORD_RESET_PEPPER:'fixture-only-pepper-'.repeat(3)};
  let source=snapshot.edges.find(x=>x.name===name).files.find(x=>x.name==='index.ts').content;
  source=stripTypeScriptTypes(source.replace(/^import .*;\s*$/gm,''),{mode:'strip'});
  new Function('Deno','createClient','crypto',source)({env:{get:k=>env[k]},serve:fn=>{handler=fn;}},()=>db,webcrypto);
  const invoke=body=>handler(new Request('https://fixture.invalid',{method:'POST',headers:{authorization:'Bearer fixture-only', 'content-type':'application/json'},body:JSON.stringify({request_id:record.id,...body})}));
  return {invoke,record,calls};
}

test('Edge mock: reject succeeds once and repeat returns conflict',async()=>{
  const h=edgeHarness('password-recovery');
  assert.equal((await h.invoke({action:'review',decision:'reject'})).status,200);
  assert.equal(h.record.status,'rejected');
  assert.equal((await h.invoke({action:'review',decision:'reject'})).status,409);
  assert.equal(h.calls.length,1);
});

test('Edge mock: revoke approved succeeds; pending/processing/used are conflicts',async()=>{
  for(const status of ['approved','pending','processing','used']){
    const h=edgeHarness('password-recovery',{record:{status}});
    assert.equal((await h.invoke({action:'review',decision:'revoke'})).status,status==='approved'?200:409);
    assert.equal(h.calls.length,status==='approved'?1:0);
  }
});

test('Edge mock: concurrent approvals return one code and one conflict',async()=>{
  const h=edgeHarness('password-recovery');
  const responses=await Promise.all([h.invoke({action:'review',decision:'approve'}),h.invoke({action:'review',decision:'approve'})]);
  assert.deepEqual(responses.map(r=>r.status).sort(),[200,409]);
  const success=responses.find(r=>r.status===200);
  assert.match((await success.json()).code,/^[a-z]{4}$/);
  assert.equal(h.calls.length,1);
});

test('Edge mock: reissue routes to atomic rotation and handles stale status',async()=>{
  for(const rpcResult of [true,false]){
    const h=edgeHarness('recovery-admin',{record:{status:'approved'},rpcResult});
    const response=await h.invoke({action:'reissue'});
    assert.equal(response.status,rpcResult?200:409);
    assert.equal(h.calls[0].name,'rotate_approved_password_reset_code');
    assert.notEqual(h.calls[0].args.p_code_hash,oldHash);
    if(rpcResult)assert.match((await response.json()).code,/^[a-z]{4}$/);
  }
});

test('Edge mock: non-Admin and inactive Admin cannot review or reissue',async()=>{
  for(const name of ['password-recovery','recovery-admin'])for(const gate of [{isAdmin:false},{active:false}]){
    const h=edgeHarness(name,{...gate,record:{status:'approved'}});
    assert.equal((await h.invoke(name==='password-recovery'?{action:'review',decision:'revoke'}:{action:'reissue'})).status,403);
    assert.equal(h.calls.length,0);
  }
});

test('Edge mock: cancel-stuck requires elapsed interval; only old processing invokes RPC',async()=>{
  for(const age of [0,360000]){
    const h=edgeHarness('recovery-admin',{record:{status:'processing',processing_started_at:new Date(Date.now()-age).toISOString()}});
    assert.equal((await h.invoke({action:'cancel_stuck'})).status,age?200:409);
    assert.equal(h.calls.length,age?1:0);
  }
});
