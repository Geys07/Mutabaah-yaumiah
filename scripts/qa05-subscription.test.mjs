import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
export async function testSubscriptions(sourceRoot='../supabase-proposals/qa05/') {
  const results=[];
  for(const kind of ['parent','admin']) {
    let source=await readFile(new URL(sourceRoot+kind+'-push/index.ts',import.meta.url),'utf8');
    source=stripTypeScriptTypes(source.replace(/^import .*;$/gm,''),{mode:'strip'});
    const rows=new Map();let handler, active=true, allowed=true, authenticated=true, triggerConflict=false;
    const owner=kind==='parent'?'guardian_id':'user_id';
    const db={auth:{getUser:async id=>({data:{user:authenticated?{id}:null}})},from(table){
      let op='read',value,filters=[];
      function apply(){
        if(table==='user_roles')return {data:allowed?{role:kind}:null};
        if(table==='profiles')return {data:{account_status:active?'active':'inactive'}};
        if(op==='insert'){if(triggerConflict)return {error:{code:'23505'}};if(!rows.has(value.endpoint))rows.set(value.endpoint,{id:'fixture-row',...value});return {};}
        const row=[...rows.values()].find(r=>filters.every(([k,v])=>r[k]===v));
        if(op==='update'&&row)Object.assign(row,value);
        if(op==='delete'&&row)rows.delete(row.endpoint);
        return {data:row||null};
      }
      const q={select:()=>q,eq:(k,v)=>{filters.push([k,v]);return q;},upsert:v=>{op='insert';value=v;return q;},update:v=>{op='update';value=v;return q;},delete:()=>{op='delete';return q;},maybeSingle:async()=>apply(),then:(ok,bad)=>Promise.resolve(apply()).then(ok,bad)};return q;
    }};
    const env={SUPABASE_URL:'https://fixture.invalid',SUPABASE_SERVICE_ROLE_KEY:'fixture-only',VAPID_PUBLIC_KEY:'fixture-public'};
    new Function('Deno','createClient',source)({env:{get:k=>env[k]},serve:fn=>{handler=fn}},()=>db);
    const request=(id,body={action:'subscribe',subscription:{endpoint:'https://fixture.invalid/device-long-enough',keys:{p256dh:'A'.repeat(40),auth:'B'.repeat(20)}}})=>new Request('https://fixture.invalid',{method:'POST',headers:{authorization:'Bearer '+id,'content-type':'application/json'},body:JSON.stringify(body)});
    const outcomes=await Promise.all([handler(request('CODEX-UJI-20261016-A')),handler(request('CODEX-UJI-20261016-B'))]);
    assert.deepEqual(outcomes.map(r=>r.status).sort(),[200,409]);
    assert.equal(rows.size,1);const id=[...rows.values()][0][owner];
    assert.equal((await handler(request(id))).status,200);
    const repeated=await Promise.all([handler(request(id)),handler(request(id))]);
    assert.deepEqual(repeated.map(r=>r.status),[200,200]);assert.equal(rows.size,1);
    const stranger=id.endsWith('-A')?'CODEX-UJI-20261016-B':'CODEX-UJI-20261016-A';
    assert.equal((await handler(request(stranger,{action:'unsubscribe',endpoint:'https://fixture.invalid/device-long-enough'}))).status,200);
    assert.equal(rows.size,1,'foreign unsubscribe must preserve owner');
    assert.equal((await handler(request(id,{action:'subscribe',subscription:{endpoint:'https://user:pass@fixture.invalid/device-long-enough',keys:{p256dh:'A'.repeat(40),auth:'B'.repeat(20)}}}))).status,400);
    triggerConflict=true;assert.equal((await handler(request(id))).status,409);triggerConflict=false;assert.equal(rows.size,1);
    const denied=[];
    for(const mode of ['inactive','wrong-role','unauthenticated']) {
      active=mode!=='inactive';allowed=mode!=='wrong-role';authenticated=mode!=='unauthenticated';
      const status=(await handler(request(id))).status;assert.ok([401,403].includes(status));denied.push({mode,status});assert.equal(rows.size,1);
    }
    results.push({denied,kind,status:'PASS',concurrentStatuses:outcomes.map(r=>r.status),rows:rows.size,ownerPreserved:true});
  }
  return results;
}
