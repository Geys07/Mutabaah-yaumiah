import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canRetryNotification, readNotification, notificationGroup } from '../src/lib/notificationRead.js';

test('notifications: bounded retry and authorization/cancellation exclusion',async()=>{
  globalThis.window={setTimeout,clearTimeout};
  for(const status of [401,403,400,422])assert.equal(canRetryNotification({status}),false);
  for(const status of [408,429,500,502,503,504])assert.equal(canRetryNotification({status}),true);
  assert.equal(canRetryNotification({name:'AbortError'}),false);
  let calls=0;
  const request=()=>({retry:async()=>{calls++;if(calls<3)throw Error('Failed to fetch');return {data:7};}});
  assert.equal((await readNotification(request,new AbortController().signal)).data,7);assert.equal(calls,3);
  calls=0;await assert.rejects(readNotification(()=>({retry:async()=>{calls++;throw Object.assign(Error('unauthorized'),{status:401});}}),new AbortController().signal));assert.equal(calls,1);
  calls=0;await assert.rejects(readNotification(()=>({retry:async()=>{calls++;throw Error('Failed to fetch');}}),new AbortController().signal));assert.equal(calls,3);
  const controller=new AbortController();controller.abort();calls=0;await assert.rejects(readNotification(request,controller.signal),{name:'AbortError'});assert.equal(calls,0);
  await assert.rejects(notificationGroup([Promise.resolve({data:4}),Promise.reject(Error('offline'))]));
  assert.deepEqual(await notificationGroup([Promise.resolve(4),Promise.resolve(2)]),[4,2]);
  delete globalThis.window;
});
