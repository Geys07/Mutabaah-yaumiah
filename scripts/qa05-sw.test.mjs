import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
export async function testWorker(){
 const source=await readFile(new URL('../public/parent-push-sw.js',import.meta.url),'utf8');
 const handlers={},shown=[];
 const scope={registration:{scope:'https://fixture.invalid/',showNotification:async(title,options)=>shown.push({title,options})},location:{origin:'https://fixture.invalid'},clients:{matchAll:async()=>[],openWindow:async()=>{}},addEventListener:(name,fn)=>{handlers[name]=fn}};
 vm.runInNewContext(source,{self:scope,URL,Response,caches:{},fetch:async()=>new Response('fixture')});
 for(const path of ['/src/App.jsx','/node_modules/.vite/deps/react.js?v=2','/@vite/client','/@react-refresh','/@fs/file','/@id/module','/api/private','/auth/user']){
  let handled=false;handlers.fetch({request:{url:'https://fixture.invalid'+path,method:'GET'},respondWith:()=>handled=true});assert.equal(handled,false,path);
 }
 let task;handlers.push({data:{json:()=>({title:'Fixture',body:'Pengingat umum',url:'https://evil.invalid/private'})},waitUntil:p=>{task=p}});await task;
 assert.equal(shown[0].options.icon,'https://fixture.invalid/logo-sekolah-loading.png');
 assert.equal(shown[0].options.badge,'https://fixture.invalid/notification/mutabaah-status.png');
 assert.equal(shown[0].options.data.url,'https://fixture.invalid/');
 return{status:'PASS',developmentModulesBypassed:8,logoPathsPreserved:true,pushURLScopeOnly:true};
}
