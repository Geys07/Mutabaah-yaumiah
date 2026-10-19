async page => {
  const context=await page.context().browser().newContext({serviceWorkers:'block',viewport:{width:390,height:844}});
  const p=await context.newPage();let remote=0;const errors=[];
  p.on('pageerror',e=>errors.push(e.message));
  await context.route('**/*.supabase.co/**',r=>{remote++;return r.abort();});
  await context.route('**/src/lib/supabase*',r=>r.fulfill({contentType:'text/javascript',body:`
    export const supabase={
      rpc(name){if(name==='get_mutabaah_accessible_classes')return query(window.teacherClasses||[]);if(name==='get_mutabaah_class_report')return query([]);if(name==='get_mutabaah_class_day_status')return query([]);return query([])},
      from(name){return query(name==='academic_years'?[{id:'year',start_year:2026}]:name==='classes'?[{id:'c1',name:'VII A',grade:7},{id:'c2',name:'VIII B',grade:8}]:window.enrollments||[],name)}
    };
    export const getSchoolIdentity=async()=>({});
    export const getDataRequestState=()=>({pending:0,revision:0,changedAt:0});
    export const watchDataRequests=()=>()=>{};
    function query(rows,name='rpc'){
      let start=0,end=499,filter='',classId='';const orders=[];
      const q={select:()=>q,is:()=>q,in:()=>q,neq:()=>q,eq:(key,value)=>{if(key==='class_id')classId=value;return q},order:key=>{orders.push(key);return q},range:(a,b)=>{start=a;end=b;return q},abortSignal:()=>q,or:value=>{filter=value;return q},then:(ok,bad)=>new Promise(resolve=>setTimeout(()=>{
        let result=rows;if(classId)result=result.filter(x=>x.class_id===classId);
        if(filter){const search=filter.match(/%([^%]*)%/);if(search)result=result.filter(x=>JSON.stringify(x.students).includes(search[1]));}
        window.queryLog.push({name,start,end,filter,classId,orders});
        resolve(window.failRead?{data:null,count:0,error:{message:'Gangguan fixture'}}:{data:result.slice(start,end+1),count:result.length,error:null});
      },window.delay||0)).then(ok,bad)};return q;
    }
  `}));
  await context.route('**/qa25-ui',r=>r.fulfill({contentType:'text/html',body:`<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><script type="module">import R from '/@react-refresh';R.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>t=>t;window.__vite_plugin_react_preamble_installed__=true;</script></head><body><div id="root"></div></body></html>`}));
  try{
    await p.goto('http://localhost:5173/qa25-ui');
    await p.evaluate(async()=>{
      window.queryLog=[];
      window.enrollments=Array.from({length:1305},(_,i)=>({id:'e'+String(i).padStart(5,'0'),class_id:i<700?'c1':'c2',classes:{id:i<700?'c1':'c2',name:i<700?'VII A':'VIII B',grade:i<700?7:8,academic_year_id:'year'},students:{id:'s'+i,full_name:'CODEX-UJI-20261016 Siswa '+String(i).padStart(4,'0'),nis:String(i),gender:'female',status:'active'}}));
      const R=await import('/node_modules/.vite/deps/react.js'),D=await import('/node_modules/.vite/deps/react-dom_client.js');
      window.qaRoot=(D.default||D).createRoot(document.querySelector('#root'));
      window.qaReact=R.default||R;
      const C=(await import('/src/pages/StudentsBase.jsx')).default;
      window.qaRoot.render(window.qaReact.createElement(C));
    });
    await p.getByText('CODEX-UJI-20261016 Siswa 0000',{exact:true}).waitFor();
    const first=await p.locator('tbody tr').count();if(first!==50)throw Error('First page size '+first);
    await p.getByRole('button',{name:'Berikutnya',exact:true}).click();
    await p.getByText('CODEX-UJI-20261016 Siswa 0050',{exact:true}).waitFor();
    for(let index=2;index<=13;index++){
      await p.getByRole('button',{name:'Berikutnya',exact:true}).click();
      await p.getByText('CODEX-UJI-20261016 Siswa '+String(index*50).padStart(4,'0'),{exact:true}).waitFor();
    }
    await p.getByRole('button',{name:'Terakhir',exact:true}).click();
    await p.getByText('CODEX-UJI-20261016 Siswa 1304',{exact:true}).waitFor();
    if(await p.locator('tbody tr').count()!==5)throw Error('Last page must have 5 rows');
    const search=p.getByPlaceholder('Nama, NIS, atau NISN');await search.fill('Siswa 1299');
    await p.getByText('CODEX-UJI-20261016 Siswa 1299',{exact:true}).waitFor();
    if(await p.locator('tbody tr').count()!==1)throw Error('Search not applied across data');
    await search.fill('');
    const selects=p.locator('select');await selects.nth(1).selectOption('c2');
    await p.getByText('CODEX-UJI-20261016 Siswa 0700',{exact:true}).waitFor();
    const bounded=await p.evaluate(()=>window.queryLog.every(q=>q.end-q.start+1<=500));
    if(!bounded)throw Error('Batch too large');
    // Exercise actual complete-export reader, not a reimplementation.
    const exported=await p.evaluate(async()=>{const {fetchAll}=await import('/src/lib/pagination.js');const {supabase}=await import('/src/lib/supabase.js');const r=await fetchAll(()=>supabase.from('student_enrollments').select('*'),['id']);return {count:r.data?.length,unique:new Set(r.data?.map(x=>x.id)).size,error:r.error?.message};});
    if(exported.count!==1305||exported.unique!==1305)throw Error('Incomplete batch export');
    await p.evaluate(()=>{window.failRead=true;});
    await search.fill('Siswa 0010');
    await p.getByRole('alert').filter({hasText:'Gangguan fixture'}).waitFor();
    await p.evaluate(()=>{window.failRead=false;window.delay=250;});
    await search.fill('Siswa 1298');
    await p.getByText('Memuat data siswa...',{exact:true}).waitFor();
    await search.fill('Siswa 1299');
    await p.getByText('CODEX-UJI-20261016 Siswa 1299',{exact:true}).waitFor();
    if(await p.getByText('CODEX-UJI-20261016 Siswa 1298',{exact:true}).count())throw Error('Stale filter response');
    await p.evaluate(()=>{window.delay=0;});
    await p.evaluate(async()=>{window.teacherClasses=[];const C=(await import('/src/pages/HomeroomTeacherDashboard.jsx')).default;window.qaRoot.render(window.qaReact.createElement(C,{account:{user_id:'fixture',full_name:'CODEX-UJI-20261016 Teacher',roles:['homeroom_teacher']},school:{},onLogout:()=>{}}));});
    await p.getByText('Belum ada kelas yang ditugaskan.',{exact:true}).waitFor();
    await p.screenshot({path:'.playwright-mcp/qa25-teacher-empty.png',fullPage:true});
    await p.evaluate(async()=>{window.teacherClasses=[{class_id:'c1',class_name:'VII A',grade:7,academic_year:2026}];const C=(await import('/src/pages/HomeroomTeacherDashboard.jsx')).default;window.qaRoot.render(window.qaReact.createElement(C,{key:'assigned',account:{user_id:'fixture',full_name:'CODEX-UJI-20261016 Teacher',roles:['homeroom_teacher']},school:{},onLogout:()=>{}}));});
    await p.getByText('Belum ada siswa.',{exact:true}).waitFor();
    if(remote||errors.length)throw Error(JSON.stringify({remote,errors}));
    return {first:50,middle_page:14,last:5,server_search_after_1000:true,class_filter:true,loading_error_recovery:true,rapid_filter:true,exported,teacher_empty_state:true,assigned_teacher_report_loaded:true,remote,errors};
  }finally{await context.close();}
}
