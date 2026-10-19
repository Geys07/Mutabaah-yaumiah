import './qa06-notification.test.mjs';
import './qa06-queue.test.mjs';
import { test } from 'node:test';
import { testEndpoint } from './qa05-endpoint.test.mjs';
import { testReminders } from './qa05-reminder.test.mjs';
import { testSubscriptions } from './qa05-subscription.test.mjs';
import { testWorker } from './qa05-sw.test.mjs';
// The older modules export runners; importing them alone does not execute assertions.
for (const [name, run] of Object.entries({endpoint:testEndpoint,reminder:testReminders,subscription:testSubscriptions,worker:testWorker})) {
  test(name, async t => { const results = await run(); t.diagnostic(JSON.stringify(results)); });
}
