async page => {
  const context=await page.context().browser().newContext();
  const p=await context.newPage();
  let navigations=0;
  try {
    await context.request.post('http://127.0.0.1:5188/__qa/release-a');
    await p.goto('http://127.0.0.1:5188/');
    await p.getByRole('heading',{name:'Rilis A',exact:true}).waitFor();
    await p.evaluate(()=>navigator.serviceWorker.ready);
    await p.waitForFunction(()=>navigator.serviceWorker.controller!==null);
    await p.getByLabel('Draf uji').fill('CODEX-UJI-20261016 draf belum tersimpan');
    p.on('framenavigated',frame=>{if(frame===p.mainFrame())navigations++;});
    await p.evaluate(async()=>{
      await fetch('/__qa/release-b',{method:'POST'});
      const registration=await navigator.serviceWorker.getRegistration();
      await registration.update();
    });
    await p.evaluate(async()=>{
      for(let i=0;i<200;i++){
        if((await navigator.serviceWorker.getRegistration())?.waiting)return;
        await new Promise(resolve=>setTimeout(resolve,50));
      }
      throw Error('New worker did not enter waiting');
    });
    const during=await p.evaluate(async()=>({
      draft:document.querySelector('#draft').value,
      heading:document.querySelector('h1').textContent,
      waiting:(await navigator.serviceWorker.getRegistration()).waiting.state,
    }));
    if(navigations||during.heading!=='Rilis A'||!during.draft.includes('belum tersimpan'))throw Error('Update interrupted an open draft');
    await p.screenshot({path:'F:/mutabaah-yaumiah/.playwright-mcp/implementasi-qa-20261019/pwa-waiting-draft.png'});
    // Represent an explicit user decision after saving. Do not claim the
    // synthetic text field is the application's offline sync mechanism.
    await p.getByLabel('Draf uji').fill('CODEX-UJI-20261016 sudah dicatat oleh harness');
    await p.close();
    const next=await context.newPage();
    await next.goto('http://127.0.0.1:5188/');
    await next.evaluate(async()=>{
      for(let i=0;i<200;i++){
        const r=await navigator.serviceWorker.getRegistration();
        if(r?.active&&!r.waiting&&navigator.serviceWorker.controller)return;
        await new Promise(resolve=>setTimeout(resolve,50));
      }
      throw Error('New worker did not activate after client close');
    });
    await context.setOffline(true);
    await next.reload();
    await next.getByRole('heading',{name:'Rilis B',exact:true}).waitFor();
    const cached=await next.evaluate(async()=>{
      const names=await caches.keys();const cache=await caches.open(names.find(x=>x.startsWith('mutabaah-pwa-')));
      return {names,urls:(await cache.keys()).map(r=>r.url)};
    });
    if(cached.names.filter(x=>x.startsWith('mutabaah-pwa-')).length!==1)throw Error('Old worker cache retained');
    if(cached.urls.some(x=>x.includes('supabase')||x.includes('/auth/')))throw Error('Private cache URL');
    return {status:'PASS',workerAWaitedForClientClose:true,openDraftRetained:true,automaticNavigations:navigations,offlineShellB:true,cacheEntries:cached.urls.length,physicalDevice:false};
  } finally {await context.close();}
}
