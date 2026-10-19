async page => {
  const context = await page.context().browser().newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 844 } });
  page.__qa06 = context;
  const p = await context.newPage();
  page.__qa06page = p;
  const errors = [];
  p.on('pageerror', e => errors.push(e.message));
  let blocked = 0;
  await context.route('**/*.supabase.co/**', r => { blocked++; return r.abort(); });
  await context.route('**/src/lib/supabase*', r => r.fulfill({ contentType: 'text/javascript', body: `
    const activity={id:'prayer',code:'subuh',title:'Salat Subuh',category:'shalat',haid_rule:'exempt',allowed_weekdays:[1,2,3,4,5,6,7],scoring_mode:'required'};
    export const supabase={
      rpc:async(name,args={})=>{
        window.calls.push({name,args:structuredClone(args)});
        if(name==='get_parent_mutabaah_day_state'){
          if(window.delayRead)await new Promise(r=>setTimeout(r,window.delayRead));
          return {data:window.days[args.p_student_id+':'+args.p_date]||{is_female:true,is_haid:false,status:'draft',answers:[]}};
        }
        if(name==='submit_parent_mutabaah_day'){
          if(window.delaySave)await new Promise(r=>setTimeout(r,window.delaySave));
          if(window.failSave)return {error:{message:'fixture offline'}};
          const answers=args.p_answers;
          window.days[args.p_student_id+':'+args.p_date]={is_female:true,is_haid:args.p_is_haid,status:args.p_finalize?'finalized':'draft',answers};
          window.writes.push(structuredClone(args));return {data:{success:true,auto_filled:0}};
        }
        return {data:[]};
      },
      from:()=>{const q={select:()=>q,eq:()=>q,neq:()=>q,order:()=>q,range:()=>q,in:()=>q,limit:()=>q,abortSignal:()=>q,maybeSingle:async()=>({data:null}),single:async()=>({data:null}),then:fn=>Promise.resolve({data:[activity],count:1}).then(fn)};return q},
      auth:{getSession:async()=>({data:{session:{user:{id:window.fixtureAccount}}}}),getUser:async()=>({data:{user:{id:window.fixtureAccount}}}),onAuthStateChange:fn=>{window.fixtureAuthListeners.push(fn);return {data:{subscription:{unsubscribe(){}}}}}},
      functions:{invoke:async()=>({error:{message:'fixture only'}})}
    };
    export const getSchoolIdentity=async()=>({});
  ` }));
  await context.route('**/qa06-fixture', r => r.fulfill({ contentType: 'text/html', body: `<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><script type="module">import R from '/@react-refresh';R.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>t=>t;window.__vite_plugin_react_preamble_installed__=true;</script></head><body><div id="root"></div></body></html>` }));
  await p.addInitScript(() => { window.calls=[];window.writes=[];window.days={};window.fixtureAccount="CODEX-UJI-20261016-parent";window.fixtureAuthListeners=[]; });
  await p.goto('http://127.0.0.1:5174/qa06-fixture');
  await p.evaluate(async()=>{
    const R=await import('/node_modules/.vite/deps/react.js');window.R=R.default||R;
    const D=await import('/node_modules/.vite/deps/react-dom_client.js');window.root=(D.default||D).createRoot(document.querySelector('#root'));
    window.Daily=(await import('/src/pages/ParentDaily.jsx')).default;
    window.today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta'}).format(new Date());
    window.show=(student='CODEX-UJI-20261016-A',date=window.today)=>window.root.render(window.R.createElement(window.Daily,{studentId:student,selectedDate:date}));
    window.show();
  });
  const prayer=p.getByRole('group',{name:'Salat Subuh'});
  await prayer.getByRole('button',{name:'Ya',exact:true}).click();
  await p.waitForFunction(()=>window.writes.length===1);
  await prayer.getByRole('button',{name:'Tidak',exact:true}).click();
  await p.waitForFunction(()=>window.writes.length===2);
  await p.getByRole('group',{name:'Kondisi haid'}).getByRole('button',{name:'Ya',exact:true}).click();
  await p.waitForFunction(()=>window.writes.length===3);
  const haid=await p.evaluate(()=>window.writes.at(-1));
  if(!haid.p_is_haid||haid.p_answers.length)throw Error('haid payload');
  await p.getByRole('group',{name:'Kondisi haid'}).getByRole('button',{name:'Tidak',exact:true}).click();
  await prayer.getByRole('button',{name:'Ya',exact:true}).click();
  await p.evaluate(()=>{window.delaySave=300;window.show('CODEX-UJI-20261016-B')});
  await prayer.getByRole('button',{name:'Tidak',exact:true}).click();
  await p.waitForFunction(()=>window.writes.some(w=>w.p_student_id.endsWith('-B')));
  const scopes=await p.evaluate(()=>window.writes.filter(w=>w.p_student_id.endsWith('-B')));
  if(scopes.some(w=>w.p_answers[0]?.completed!==false))throw Error('cross-child write');
  await p.evaluate(()=>{window.failSave=true});
  await prayer.getByRole('button',{name:'Ya',exact:true}).click();
  await p.getByRole('alert').filter({hasText:'Draf belum tersimpan'}).waitFor();
  await p.evaluate(()=>{window.failSave=false;window.dispatchEvent(new Event('online'))});
  await p.getByRole('status').filter({hasText:'Draf tersimpan otomatis'}).waitFor();
  await p.getByRole('button',{name:'Selesaikan Pengisian',exact:true}).click();
  await p.getByRole('button',{name:'Ya, Finalisasi',exact:true}).click();
  await p.getByText('Sudah Difinalisasi',{exact:true}).waitFor();
  await p.evaluate(()=>window.show('CODEX-UJI-20261016-C','2020-01-01'));
  await p.getByText(/Tanggal ini di luar batas/).waitFor();
  if(await prayer.getByRole('button',{name:'Ya',exact:true}).isEnabled())throw Error('old date editable');
  await p.evaluate(()=>{window.failSave=false;window.delaySave=0;window.show('CODEX-UJI-20261016-OFF')});
  await prayer.getByRole('button',{name:'Ya',exact:true}).waitFor();
  await p.evaluate(()=>window.failSave=true);
  await prayer.getByRole('button',{name:'Ya',exact:true}).click();
  await p.getByRole('alert').filter({hasText:'Draf belum tersimpan'}).waitFor();
  await p.evaluate(()=>window.show('CODEX-UJI-20261016-OTHER'));
  await prayer.waitFor();
  await p.evaluate(()=>{window.failSave=false;window.show('CODEX-UJI-20261016-OFF')});
  await p.getByRole('status').filter({hasText:'Draf sebelumnya belum tersimpan'}).waitFor();
  if(await prayer.getByRole('button',{name:'Ya',exact:true}).getAttribute('aria-pressed')!=='true')throw Error('recovery');
  await p.getByRole('button',{name:'Simpan Draf',exact:true}).click();
  await p.getByRole('status').filter({hasText:'Draf tersimpan otomatis'}).waitFor();

  await p.clock.install();
  await p.evaluate(()=>{window.delayRead=20000;window.show('CODEX-UJI-20261016-SLOW')});
  await p.getByText('Memuat kegiatan...',{exact:true}).waitFor();
  await p.clock.fastForward(16000);
  await p.getByRole('alert').filter({hasText:'Pemuatan kegiatan terlalu lama'}).waitFor();
  await p.evaluate(()=>window.delayRead=0);
  await p.getByRole('button',{name:'Muat Ulang',exact:true}).click();
  await prayer.waitFor();
  await prayer.getByRole('button',{name:'Ya',exact:true}).click();
  await p.clock.fastForward(1000);
  await p.getByRole('status').filter({hasText:'Draf tersimpan otomatis'}).waitFor();
  await p.clock.fastForward(5000);
  if(await prayer.getByRole('button',{name:'Ya',exact:true}).getAttribute('aria-pressed')!=='true')throw Error('late read replaced answer');
  await p.evaluate(()=>{window.delaySave=20000;window.show('CODEX-UJI-20261016-PENDING')});
  await prayer.waitFor();
  await prayer.getByRole('button',{name:'Ya',exact:true}).click();
  await p.clock.fastForward(1000);
  await p.clock.fastForward(16000);
  await p.getByRole('alert').filter({hasText:'Draf masih menunggu konfirmasi server'}).waitFor();
  await p.clock.fastForward(5000);
  await p.getByRole('status').filter({hasText:'Draf tersimpan otomatis'}).waitFor();
  await p.evaluate(()=>{window.delaySave=0;window.show('CODEX-UJI-20261016-SESSION')});
  await prayer.waitFor();
  await prayer.getByRole('button',{name:'Ya',exact:true}).click();
  await p.evaluate(()=>window.fixtureAuthListeners.forEach(fn=>fn('TOKEN_REFRESHED',{user:{id:window.fixtureAccount}})));
  if(await prayer.getByRole('button',{name:'Ya',exact:true}).getAttribute('aria-pressed')!=='true')throw Error('token refresh reset draft');
  const beforeSwitch=await p.evaluate(()=>window.calls.filter(c=>c.name==='submit_parent_mutabaah_day').length);
  await p.evaluate(()=>{window.fixtureAccount='CODEX-UJI-20261016-parent-B';window.fixtureAuthListeners.forEach(fn=>fn('SIGNED_IN',{user:{id:window.fixtureAccount}}))});
  await p.getByRole('alert').filter({hasText:'Sesi akun berubah'}).waitFor();
  await p.clock.fastForward(2000);
  if(await p.evaluate(()=>window.calls.filter(c=>c.name==='submit_parent_mutabaah_day').length)!==beforeSwitch)throw Error('old draft submitted after account switch');
  const result={status:'PASS',scenarios:['new answer','yes/no correction','haid removal','switch child during save','offline-online retry','finalization','30-day UI restriction','failed draft survives child navigation','read timeout and retry','late response ignored','pending write notice and recovery','token refresh preserves form','account switch blocks old draft'],errors,blocked,fixtureWrites:await p.evaluate(()=>window.writes.length),width:await p.evaluate(()=>({viewport:innerWidth,document:document.documentElement.scrollWidth}))};
  if(errors.length)throw Error(JSON.stringify(errors));
  return result;
}
