async page => {
  if(!page.__qa06SqlStudent)throw Error('Set a fresh local fixture student first.');
  const context=await page.context().browser().newContext({serviceWorkers:'block',viewport:{width:390,height:844}});
  const p=await context.newPage();
  page.__qa06Sql={context,page:p,pending:new Map(),sequence:0,errors:[]};
  p.on('pageerror',e=>page.__qa06Sql.errors.push(e.message));
  await context.route('https://**',r=>r.abort());
  await context.route('**/qa06-sql-activities',route=>{const id=++page.__qa06Sql.sequence;page.__qa06Sql.pending.set(id,{route,payload:{id,kind:'activities'}});});
  await context.route('**/qa06-sql-rpc',route=>{const id=++page.__qa06Sql.sequence;page.__qa06Sql.pending.set(id,{route,payload:{id,...route.request().postDataJSON()}});});
  await context.route('**/src/lib/supabase*',r=>r.fulfill({contentType:'text/javascript',body:`export const supabase={auth:{getSession:async()=>({data:{session:{user:{id:'10000000-0000-4000-8000-000000000001'}}}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},rpc:(name,args)=>fetch('/qa06-sql-rpc',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name,args})}).then(r=>r.json()),from:()=>{const q={select:()=>q,eq:()=>q,neq:()=>q,order:()=>q,then:(ok,bad)=>fetch('/qa06-sql-activities').then(r=>r.json()).then(ok,bad)};return q}};`}));
  await context.route('**/qa06-sql-fixture',r=>r.fulfill({contentType:'text/html',body:`<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><script type="module">import R from '/@react-refresh';R.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>t=>t;window.__vite_plugin_react_preamble_installed__=true;</script></head><body><div id="root"></div></body></html>`}));
  await p.goto('http://localhost:5173/qa06-sql-fixture',{waitUntil:'domcontentloaded'});
  await p.evaluate(async scope=>{const student=scope.student;const R=await import('/node_modules/.vite/deps/react.js'),D=await import('/node_modules/.vite/deps/react-dom_client.js'),C=(await import('/src/pages/ParentDaily.jsx')).default;(D.default||D).createRoot(document.querySelector('#root')).render((R.default||R).createElement(C,{studentId:student,selectedDate:scope.date||new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta'}).format(new Date())}));},{student:page.__qa06SqlStudent,date:page.__qa06SqlDate});
  await p.waitForTimeout(200);
  return {pending:page.__qa06Sql.pending.size,productionBlocked:true};
}