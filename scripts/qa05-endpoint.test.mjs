import { stripTypeScriptTypes } from 'node:module';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
export async function testEndpoint(sourceRoot='../supabase-proposals/qa05/') {
  const { inWindow, runReminders, jakartaTime }=await import(new URL(sourceRoot+'parent-reminder-send/core.mjs',import.meta.url));
  let source=await readFile(new URL(sourceRoot+'parent-reminder-send/index.ts',import.meta.url),'utf8');
  source=source.replace(/^import .*;$/gm,'').replace('const { jakartaTime } = await import("./core.mjs");','');
  // This tests guards only. Deno typecheck/integration remains a remote prerequisite.
  source=stripTypeScriptTypes(source,{mode:'strip'});
  const secret='fixture-only-secret-not-production-'.repeat(2);
  let settingValue=false, settingError=false;
  let handler, creates=0, now='2026-10-18T13:00:00Z';
  const env={PARENT_REMINDER_SECRET:secret,SUPABASE_URL:'https://fixture.invalid',SUPABASE_SERVICE_ROLE_KEY:'fixture-only'};
  class Clock extends Date { constructor(...args){ super(...(args.length?args:[now])); } }
  const createClient=()=>{creates++;return {rpc:async name=>{assert.equal(name,'list_parent_reminder_targets_page','dry-run must only read targets');return {data:[],error:null}},from(){const q={select:()=>q,eq:()=>q,maybeSingle:async()=>({data:{value:{enabled:settingValue}},error:settingError?{message:'fixture'}:null})};return q;}};};
  new Function('Deno','createClient','webpush','inWindow','runReminders','jakartaTime','Date',source)(
    {env:{get:k=>env[k]},serve:fn=>{handler=fn}},createClient,{},inWindow,runReminders,(d=new Clock())=>jakartaTime(d),Clock);
  const request=(method='POST',valid=false,body={})=>new Request('https://fixture.invalid',{method,headers:valid?{'x-reminder-secret':secret}:{},...(method==='POST'?{body:JSON.stringify(body)}:{})});
  assert.equal((await handler(request('GET'))).status,405);
  assert.equal((await handler(request())).status,401);assert.equal(creates,0);
  assert.equal((await handler(request('POST',true,{dry_run:false,confirm_send:true}))).status,409);assert.equal(creates,0);
  now='2026-10-18T13:16:00Z';assert.equal((await handler(request('POST',true))).status,409);assert.equal(creates,0);
  now='2026-10-18T13:00:00Z';const dry=await handler(request('POST',true));assert.equal(dry.status,200);assert.deepEqual(await dry.json(),{dry_run:true,reminder_date:'2026-10-18',eligible:0,sent:0});
  env.PARENT_REMINDER_ENABLED='true';
  assert.equal((await handler(request('POST',true,{dry_run:false}))).status,409);
  for(const state of [false,null,'true']) {settingValue=state;assert.equal((await handler(request('POST',true,{dry_run:false,confirm_send:true}))).status,409);}
  settingValue=true;settingError=true;assert.equal((await handler(request('POST',true,{dry_run:false,confirm_send:true}))).status,409);
  settingError=false;assert.equal((await handler(request('POST',true,{dry_run:false,confirm_send:true}))).status,503); // No VAPID setup: still no push.
  return {status:'PASS',checks:['method405','anonymous401','production-disabled409','after20:15-409','dry-run-read-only','explicit-confirmation-required','persisted-switch-fail-closed','read-failure-fail-closed','missing-push-config503'],secretExposed:false};
}
