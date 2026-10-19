import assert from 'node:assert/strict';

export async function testReminders(sourceRoot='../supabase-proposals/qa05/') {
  const {runReminders,inWindow,jakartaTime}=await import(new URL(sourceRoot+'parent-reminder-send/core.mjs',import.meta.url));
  const results = [];
  const check = async (name, fn) => { await fn(); results.push({ name, status: 'PASS' }); };
  function fixture(count = 1) {
    let now = new Date('2026-10-18T13:00:00Z');
    const targets = Array.from({ length: count }, (_, i) => ({ guardian_id: String(i + 1).padStart(6, '0'), pending_children: i % 3 + 1 }));
    const claims = new Map(), sends = [], pages = [], devices = new Map();
    let token = 0;
    const io = {
      targets: async (_d, after, size) => { pages.push({ after, size }); return targets.filter(t => !after || t.guardian_id > after).slice(0, size); },
      claim: async g => {
        const old = claims.get(g);
        const reclaim = old && old.attempts < 3 && ((old.status === 'failed' && old.safe && now - old.at >= 120000) || (old.status === 'claimed' && old.phase === 'prepared' && now - old.at > 60000));
        if (old && !reclaim) return null;
        const claim = { token: ++token, status: 'claimed', phase: 'prepared', attempts: (old?.attempts || 0) + 1, at: new Date(now) };
        claims.set(g, claim); return claim.token;
      },
      devices: async g => devices.has(g) ? devices.get(g) : [{ id: g }],
      pending: async g => targets.find(t => t.guardian_id === g)?.pending_children || 0,
      begin: async (g, _d, tok) => { const c = claims.get(g); if(c.token !== tok || c.phase !== 'prepared')return false; c.phase = 'sending'; return true; },
      finish: async (g, _d, tok, status, safe, code) => { const c = claims.get(g); if(c.token !== tok)throw Error('stale'); c.safe = safe && c.phase === 'prepared'; Object.assign(c, { status, code, phase: 'complete' }); return true; },
      send: async (d, payload) => { sends.push({ id: d.id, payload: JSON.parse(payload) }); },
      expire: async d => { devices.set(d.id, []); },
    };
    return { io, claims, sends, targets, pages, devices, clock: () => now, advance: ms => { now = new Date(+now + ms); } };
  }
  await check('1305 guardians, multi-child count, keyset >1000, repeated invocation', async () => {
    const f = fixture(1305); const r = await runReminders(f.io, { clock: f.clock });
    assert.equal(r.sent, 1305); assert.equal(f.sends.length, 1305);
    assert.equal(new Set(f.sends.map(s => s.id)).size, 1305);
    assert.deepEqual(f.pages.map(p => p.size), [500,500,500]);
    assert.match(f.sends[1].payload.body, /2 anak/);
    assert.match(f.sends[2].payload.body, /3 anak/);
    assert.equal((await runReminders(f.io, { clock: f.clock })).sent, 0);
    assert.equal(f.sends.length, 1305);
  });
  await check('concurrent invocations claim once per guardian', async () => {
    const f = fixture(50); await Promise.all([runReminders(f.io, { clock:f.clock }),runReminders(f.io,{clock:f.clock})]);
    assert.equal(f.sends.length,50);
  });
  await check('no subscription skipped; expired 404/410 removed through adapter', async () => {
    const f=fixture(3);f.devices.set('000001',[]);const removed=[];
    f.io.send=async d=>{throw {statusCode:d.id==='000002'?404:410};};f.io.expire=async d=>removed.push(d.id);
    const r=await runReminders(f.io,{clock:f.clock});assert.equal(r.skipped,1);assert.equal(r.failed,2);assert.equal(removed.length,2);
  });
  await check('one device read fails; others continue; safe bounded retry',async()=>{
    const f=fixture(3);const original=f.io.devices;f.io.devices=async g=>{if(g==='000001')throw Error('private endpoint must never escape');return original(g);};
    const r=await runReminders(f.io,{clock:f.clock});assert.equal(r.failed,1);assert.equal(r.sent,2);assert.equal(f.claims.get('000001').safe,true);
    assert.equal((await runReminders(f.io,{clock:f.clock})).failed,0);
    f.advance(120001);await runReminders(f.io,{clock:f.clock});f.advance(120001);await runReminders(f.io,{clock:f.clock});f.advance(120001);await runReminders(f.io,{clock:f.clock});
    assert.equal(f.claims.get('000001').attempts,3);
  });
  await check('network uncertainty is never retried; accepted before result-write failure',async()=>{
    const f=fixture(2);const finish=f.io.finish;f.io.send=async d=>{f.sends.push({id:d.id});if(d.id==='000001')throw Error('network');};
    f.io.finish=async(g,...args)=>{if(g==='000002')throw Error('write failed');return finish(g,...args);};
    const r=await runReminders(f.io,{clock:f.clock});assert.equal(r.uncertain,2);
    f.advance(120001);await runReminders(f.io,{clock:f.clock});assert.equal(f.sends.length,2);
    assert.equal(f.claims.get('000002').phase,'sending');
  });
  await check('crash prepared lease reclaimed; crash sending and sent never reclaimed; legacy unsafe failed retained',async()=>{
    const f=fixture(4);for(const [i,phase,status]of [[1,'prepared','claimed'],[2,'sending','claimed'],[3,'complete','sent'],[4,'uncertain','failed']])f.claims.set(String(i).padStart(6,'0'),{token:99,status,phase,attempts:1,at:f.clock(),safe:false});
    f.advance(61000);const r=await runReminders(f.io,{clock:f.clock});assert.equal(r.sent,1);assert.equal(r.skipped,3);
  });
  await check('all children final skips; partial uses fresh count; finalization during traversal cannot cause offset skip',async()=>{
    const f=fixture(1305);const original=f.io.targets;let calls=0;f.io.targets=async(...args)=>{calls++;if(calls===2)f.targets.splice(0,100);return original(...args);};
    const pending=f.io.pending;f.io.pending=async g=>g==='000001'?0:g==='000002'?1:pending(g);
    const r=await runReminders(f.io,{clock:f.clock});assert.equal(r.sent,1304);assert.equal(r.skipped,1);assert.match(f.sends[0].payload.body,/ananda/);
  });
  await check('WIB date and time window incl after 20:15; bounded runtime resumes next call',async()=>{
    assert.equal(jakartaTime(new Date('2026-10-18T17:01:00Z')).date,'2026-10-19');
    for(const t of ['12:59','13:16','14:00'])assert.equal(inWindow(new Date('2026-10-18T'+t+':00Z')),false);
    assert.equal(inWindow(new Date('2026-10-18T13:15:59Z')),true);
    const f=fixture(10);const send=f.io.send;f.io.send=async(...args)=>{await send(...args);f.advance(1000);};
    const r=await runReminders(f.io,{clock:f.clock,budgetMs:2500});assert.equal(r.sent,3);assert.equal(r.deferred,true);
    const next=await runReminders(f.io,{clock:f.clock});assert.equal(next.sent,7);assert.equal(f.sends.length,10);
  });
  return results;
}
