import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const read = (name) => readFile(new URL("../" + name, import.meta.url), "utf8");

test("recovery chat recognizes persistent app permission instead of ephemeral false toggle", async () => {
  const [chat, helper] = await Promise.all([
    read("src/pages/ForgotPassword.jsx"),
    read("src/lib/recoveryPush.js"),
  ]);
  assert.match(chat, /useState\(recoveryPushPermission\)/);
  assert.doesNotMatch(chat, /\[notificationsOn, setNotificationsOn\] = useState\(false\)/);
  assert.match(chat, /pushPermission === "default" && !readOnly/);
  assert.match(chat, /pushPermission !== "granted"/);
  assert.match(helper, /return Notification\.permission/);
  assert.match(helper, /recoveryPushPermission\(\) !== "granted"/);
  assert.match(chat, /Notification\.requestPermission\(\)/);
  assert.match(chat, /pushPermission !== "default"/);
});

test("when global push already granted, subscribe existing service worker quietly per ticket", async () => {
  const [chat, helper, server, globalPush] = await Promise.all([
    read("src/pages/ForgotPassword.jsx"),
    read("src/lib/recoveryPush.js"),
    read("supabase/functions/recovery-chat/index.ts"),
    read("src/lib/pushDevice.js"),
  ]);
  assert.match(chat, /connectRecoveryChatPush\(token, invoke\)/);
  assert.match(chat, /\["pending","approved","processing"\]\.includes\(chat\.status\)/);
  assert.match(helper, /navigator\.serviceWorker\.getRegistration\(base\)/);
  assert.match(helper, /parent-push-sw\.js/);
  assert.match(globalPush, /parent-push-sw\.js/);
  assert.match(helper, /worker\.pushManager\.getSubscription\(\)/);
  assert.match(helper, /if \(!subscription\)/);
  assert.match(helper, /action: "my_subscribe"/);
  assert.match(helper, /inFlight\.get\(token\)/);
  assert.match(server, /if\(action==="my_send"\)/);
  assert.match(server, /if\(action==="my_chat"\)/);
  assert.match(server, /return await subscribe\(ticket,body\)/);
  assert.doesNotMatch(helper, /Notification\.requestPermission/);
});

test("chat messages remain responsive and status UI uses four-WIB theme", async () => {
  const [chat,css,app] = await Promise.all([
    read("src/pages/ForgotPassword.jsx"),
    read("src/pages/ForgotPassword.css"),
    read("src/styles/mutabaah-unified-theme.css"),
  ]);
  assert.match(chat, /queueMessage\(outgoing\)/);
  assert.match(chat, /void transmitMessage\(outgoing\)/);
  assert.match(chat, /pushBusy/);
  assert.match(css, /\.fp-push-help/);
  assert.match(css, /var\(--fp-soft\)/);
  for (const phase of ["pagi","siang","sore","malam"]) {
    assert.ok(app.includes(`data-time-theme="${phase}"`), phase);
  }
});
