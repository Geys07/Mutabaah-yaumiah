async page => {
  const context = await page.context().browser().newContext({serviceWorkers:'block',viewport:{width:390,height:844}});
  const p = await context.newPage();
  const errors = [];
  let remoteRequests = 0;
  p.on('pageerror', error => errors.push(error.message));
  await context.route('**/*.supabase.co/**', route => { remoteRequests++; return route.abort(); });
  await context.route('**/src/lib/supabase*', route => route.fulfill({contentType:'text/javascript',body:`
    function query(result) {
      const q = {order:()=>q,range:()=>q,abortSignal:()=>q,select:()=>q,eq:(key,value)=>{if(Array.isArray(result.data))result={...result,data:result.data.filter(x=>x[key]===value)};return q;},then:(ok,fail)=>Promise.resolve(result).then(ok,fail)};
      return q;
    }
    export const supabase = {
      rpc(name,args={}) {
        if(name==='get_mutabaah_accessible_classes')return query({data:window.qaClasses});
        if(name==='get_mutabaah_report_periods')return query({data:window.qaPeriods});
        if(name==='mutabaah_can_write_report_class') {
          const allow=window.qaAllow;
          return new Promise(resolve=>setTimeout(()=>resolve({data:allow}),window.qaPermissionDelay||0));
        }
        if(name==='get_mutabaah_report_details')return query(args.p_semester_id==='future'?{error:{message:'Semester belum dimulai'}}:{data:[window.qaStudent]});
        if(name==='get_mutabaah_report_bonus')return query({data:[{id:window.qaStudent.id,bonuses:window.qaBonuses}]});
        if(name==='get_mutabaah_report_signatures')return query({data:{teacher_name:'CODEX-UJI-20261016 Wali Kelas'}});
        if(name==='get_mutabaah_report_grading')return query({data:{grade_a_min:90,grade_b_min:80,grade_c_min:70,kkm:70}});
        if(name==='get_mutabaah_report_archives_v3')return query({data:window.qaArchives,count:window.qaArchives.length});
        if(name==='register_mutabaah_report_archive_v2'){
          window.qaArchives.push({id:args.p_archive_id,content_fingerprint:args.p_content_fingerprint,storage_path:'fixture/'+args.p_archive_id+'.docx',file_name:args.p_file_name,student_count:1,issued_on:args.p_issued_on,created_at:new Date().toISOString(),creator_name:'Fixture',can_delete:false});
          return query({data:{created:true}});
        }
        throw Error('Unexpected RPC '+name);
      },
      storage:{from:()=>({upload:async(path,file)=>{window.qaUploadedBlob=file;window.qaUploads++;return {data:{path}};},download:async()=>({data:window.qaUploadedBlob}),remove:async()=>{throw Error('Unexpected fixture cleanup');}})}
    };
  `}));
  await context.route('**/qa-rapor-ramadan-fixture', route => route.fulfill({contentType:'text/html',body:'<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><script type="module">import R from "/@react-refresh";R.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>t=>t;window.__vite_plugin_react_preamble_installed__=true;</script></head><body><div id="root"></div></body></html>'}));
  await p.addInitScript(() => {
    window.print=()=>{window.__qaPrintCalled=true;};
    window.qaAllow=true;window.qaUploads=0;window.qaArchives=[];
    window.qaClasses=[{class_id:'class-a',class_name:'CODEX-UJI-20261016 VII A',academic_year:'2026/2027',grade:7},{class_id:'class-b',class_name:'CODEX-UJI-20261016 VIII B',academic_year:'2026/2027',grade:8}];
    window.qaPeriods=[{id:'active',label:'Semester 1 fixture',starts_on:'2026-01-01',ends_on:'2026-12-31'},{id:'future',label:'Semester 2 fixture',starts_on:'2027-01-01',ends_on:'2027-06-30'}];
    window.qaStudent={id:'CODEX-UJI-20261016-student',name:'CODEX-UJI-20261016 Ramadan',nis:'UJI-RAMADAN',percentage:100,grade:'A',kkm:70,note:'CODEX-UJI-20261016 Catatan Ramadan',activities:[{id:'salat',code:'subuh',title:'Salat Subuh',group:'Ibadah',possible:2,achieved:2,target:80,percentage:100}]};
    window.qaBonuses=['Salat Duha','Rawatib','Tahajud','Puasa Sunah','Puasa Ramadan','Sahur','Salat Tarawih','Salat Witir','Tadarus Al-Qur’an','Sedekah Ramadan','Doa dan Zikir Ramadan'].map((title,i)=>({title,achieved:i+1,possible:30}));
  });
  try {
    await p.goto('http://localhost:5173/qa-rapor-ramadan-fixture');
    await p.evaluate(async()=>{
      const R=await import('/node_modules/.vite/deps/react.js');
      const D=await import('/node_modules/.vite/deps/react-dom_client.js');
      const Report=(await import('/src/pages/ReportCards.jsx')).default;
      window.qaRoot=(D.default||D).createRoot(document.querySelector('#root'));
      window.qaRoot.render((R.default||R).createElement(Report,{school:{name:'MTs Al-Khairiyah',address:'CODEX-UJI-20261016 fixture',logoUrl:'/logo-sekolah-loading.png'}}));
    });
    await p.getByRole('button',{name:'Tampilkan Data Rapor',exact:true}).click();
    await p.getByRole('button',{name:'Unduh DOCX Satu Kelas',exact:true}).waitFor();
    await p.getByRole('combobox',{name:'Semester',exact:true}).selectOption('future');
    await p.getByRole('button',{name:'Tampilkan Data Rapor',exact:true}).click();
    await p.getByText('Semester belum dimulai',{exact:true}).waitFor();
    await p.getByRole('combobox',{name:'Semester',exact:true}).selectOption('active');
    await p.getByRole('button',{name:'Tampilkan Data Rapor',exact:true}).click();
    await p.getByRole('button',{name:'Unduh DOCX Satu Kelas',exact:true}).waitFor();
    const downloadPromise=p.waitForEvent('download');
    await p.getByRole('button',{name:'Unduh DOCX Satu Kelas',exact:true}).click();
    const download=await downloadPromise;
    await download.saveAs('F:/mutabaah-yaumiah/.playwright-mcp/implementasi-qa-20261019/Ramadan-fixture.docx');
    const docx=await p.evaluate(async()=>{
      const Zip=(await import('/node_modules/.vite/deps/jszip.js')).default;
      const z=await Zip.loadAsync(await window.qaUploadedBlob.arrayBuffer());
      const xml=await z.file('word/document.xml').async('string');
      return {titles:window.qaBonuses.every(x=>xml.includes(x.title)),uploads:window.qaUploads};
    });
    if(!docx.titles||docx.uploads!==1)throw Error('Ramadan DOCX incomplete');
    await p.getByRole('button',{name:'Cetak Langsung Satu Kelas',exact:true}).click();
    await p.waitForFunction(()=>document.querySelector('iframe[title="Dokumen cetak rapor satu kelas"]')?.contentWindow?.__qaPrintCalled===true);
    const frame=p.locator('iframe[title="Dokumen cetak rapor satu kelas"]');
    const html=await frame.getAttribute('srcdoc');
    const preview=await context.newPage();
    await preview.setContent(html,{waitUntil:'networkidle'});
    for(const title of ['Puasa Ramadan','Sahur','Salat Tarawih','Salat Witir','Tadarus Al-Qur’an','Sedekah Ramadan','Doa dan Zikir Ramadan']){
      if(!(await preview.locator('body').innerText()).includes(title))throw Error('Ramadan missing from print '+title);
    }
    await preview.pdf({path:'F:/mutabaah-yaumiah/.playwright-mcp/implementasi-qa-20261019/Ramadan-fixture-A4.pdf',format:'A4',printBackground:true,preferCSSPageSize:true});
    const afterPrint=await p.evaluate(()=>({uploads:window.qaUploads,archives:window.qaArchives.length,viewport:innerWidth,document:document.documentElement.scrollWidth}));
    if(afterPrint.uploads!==1||afterPrint.archives!==1)throw Error('Duplicate fixture archive');
    await p.evaluate(()=>{window.qaAllow=false;window.qaPermissionDelay=200;});
    await p.getByRole('combobox',{name:'Kelas',exact:true}).selectOption('class-b');
    await p.getByRole('button',{name:'Tampilkan Data Rapor',exact:true}).click();
    await p.waitForTimeout(300);
    if(await p.getByRole('button',{name:'Unduh DOCX Satu Kelas',exact:true}).count())throw Error('Denied role still offers creation');
    if(errors.length||remoteRequests)throw Error(JSON.stringify({errors,remoteRequests}));
    return {status:'PASS',semesterSwitchFixed:true,ramadanTitlesInDocxAndPrint:7,ordinaryBonusesPreserved:4,dedupe:afterPrint,deniedClassHasNoCreateButtons:true,remoteRequests,errors};
  } finally { await context.close(); }
}
