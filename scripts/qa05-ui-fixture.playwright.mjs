async page => {
  const context = await page.context().browser().newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 844 } });
  page.__qa5Context = context;
  const fixture = await context.newPage();
  page.__qa5Page = fixture;
  fixture.__errors = [];
  fixture.on('pageerror', error => fixture.__errors.push(error.message));
  await context.route('https://vxfpwzevatwucvmeszen.supabase.co/**', r => r.abort());
  await context.route('**/src/lib/supabase*', r => r.fulfill({ contentType: 'text/javascript', body: `
    export const supabase={};
    supabase.auth={getUser:async()=>({data:{user:window.fixtureUser?{id:window.fixtureUser}:null}}),onAuthStateChange(cb){window.fixtureListeners.push(cb);return {data:{subscription:{unsubscribe(){window.fixtureListeners=window.fixtureListeners.filter(x=>x!==cb)}}}}}};
    supabase.functions={invoke:async(name,{body})=>{window.fixtureCalls.push({name,action:body.action});if(window.fixtureFail)return {error:{message:'fixture network'}};return {data:body.action==='config'?{public_key:'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'}:{success:true}}}};
    supabase.from=()=>{const q={select:()=>q,eq:()=>q,order:()=>q,range:()=>q,limit:()=>q,abortSignal:()=>q,maybeSingle:async()=>({data:{role:'parent',account_status:'active'}}),then:r=>Promise.resolve({data:[],count:0}).then(r)};return q};
  ` }));
  await context.route('**/qa05-fixture', r => r.fulfill({ contentType: 'text/html', body: `<html><head><meta name="viewport" content="width=device-width, initial-scale=1"><script type="module">import RefreshRuntime from '/@react-refresh';RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>t=>t;window.__vite_plugin_react_preamble_installed__=true;</script></head><body><div id="root"></div><script type="module" src="/@vite/client"></script></body></html>` }));
  await fixture.addInitScript(() => {
    window.fixtureUser = 'CODEX-UJI-20261016-A'; window.fixtureListeners = []; window.fixtureCalls = [];
    window.fixturePermission = 'default'; window.fixturePermissionCalls = 0; window.fixtureSub = null; window.fixtureUnsub = 0; window.fixtureSubscribeCalls = 0;
    function subscription() { return { endpoint: 'https://fixture.invalid/device', toJSON: () => ({ endpoint: 'https://fixture.invalid/device', keys: { p256dh: 'FIXTUREONLY', auth: 'FIXTUREONLY' } }), unsubscribe: async () => { window.fixtureUnsub++; window.fixtureSub = null; return true; } }; }
    Object.defineProperty(window, 'Notification', { configurable: true, value: { get permission() { return window.fixturePermission; }, requestPermission: async () => { window.fixturePermissionCalls++; window.fixturePermission = window.fixtureDeny ? 'denied' : 'granted'; return window.fixturePermission; } } });
    window.fixtureReg = { active: { state: 'activated', scriptURL: location.origin + '/parent-push-sw.js' }, pushManager: { getSubscription: async () => window.fixtureSub, subscribe: async () => { window.fixtureSubscribeCalls++; return window.fixtureSub = subscription(); } } };
    Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: { getRegistration: async () => window.fixtureReg, register: async () => window.fixtureReg } });
    window.fixtureLogin = id => { window.fixtureUser=id; window.fixtureListeners.forEach(cb=>cb(id?'SIGNED_IN':'SIGNED_OUT',id?{user:{id}}:null)); };
  });
  await fixture.goto('http://localhost:5173/qa05-fixture');
  await fixture.evaluate(async () => {
    const r = await import('/node_modules/.vite/deps/react.js'); window.fixtureReact=r.default||r;
    const d = await import('/node_modules/.vite/deps/react-dom_client.js'); window.fixtureDOM=d.default||d;
    window.fixtureComponents = await import('/src/components/ParentNotificationControls.jsx');
    window.fixtureDevice = await import('/src/lib/pushDevice.js');
    window.fixtureRoot=window.fixtureDOM.createRoot(document.querySelector('#root'));
    window.fixtureRoot.render(window.fixtureReact.createElement(window.fixtureComponents.ParentPushSettings));
  });
  // Start with missing scope deliberately: preparation must fail clearly, without an activation prompt.
  await fixture.getByRole('button', {name:'Coba Lagi Persiapan',exact:true}).waitFor();
  if(await fixture.evaluate(()=>window.fixturePermissionCalls)!==0)throw Error('permission requested during preparation');
  await fixture.evaluate(()=>{window.fixtureReg.scope=location.origin+'/';});
  await fixture.getByRole('button',{name:'Coba Lagi Persiapan',exact:true}).click();
  await fixture.getByRole('button',{name:'Aktifkan notifikasi',exact:true}).waitFor();
  await fixture.getByRole('button',{name:'Aktifkan notifikasi',exact:true}).click();
  await fixture.getByText('Aktif',{exact:true}).waitFor();
  const active=await fixture.evaluate(()=>({permissionCalls:window.fixturePermissionCalls,subscribeCalls:window.fixtureSubscribeCalls}));
  if(active.permissionCalls!==1||active.subscribeCalls!==1)throw Error('activation must complete with one permission/subscription');
  await fixture.getByRole('button',{name:'Nonaktifkan',exact:true}).click();
  await fixture.getByText('Tidak aktif',{exact:true}).waitFor();
  if(fixture.__errors.length)throw Error(JSON.stringify(fixture.__errors));
  return {status:'PASS',preparationErrorHandled:true,retryPrepared:true,oneClickActivation:active,disabledAgain:true,realPushSent:false,errors:fixture.__errors};
}
