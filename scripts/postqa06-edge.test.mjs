import {test} from 'node:test';
import {testEndpoint} from './qa05-endpoint.test.mjs';
import {testSubscriptions} from './qa05-subscription.test.mjs';
import {testReminders} from './qa05-reminder.test.mjs';

// Executes the integrated source, not the proposal directory. All IO is fixture IO.
for(const [name,run] of Object.entries({endpoint:testEndpoint,subscriptions:testSubscriptions,reminder:testReminders})){
  test('integrated backend: '+name,async t=>{
    const result=await run('../supabase/functions/');
    t.diagnostic(JSON.stringify(result));
  });
}
