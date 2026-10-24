import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL("../" + path, import.meta.url), "utf8");

test("handled phone/account requests auto-mark only corresponding inbox notice read", async () => {
  const sql = await read("supabase/migrations/20261024101219_admin_notice_resolve_when_handled_20261024.sql");
  assert.match(sql, /related_request_id uuid/);
  assert.match(sql, /NEW\.id/);
  assert.match(sql, /NEW\.status NOT IN \('approved','rejected','revoked','used'\)/);
  assert.match(sql, /n\.related_request_id=NEW\.id/);
  assert.match(sql, /n\.read_at IS NULL/);
  assert.match(sql, /admin_notice_phone_request_resolved/);
  assert.match(sql, /admin_notice_account_request_resolved/);
  assert.match(sql, /NOT EXISTS\(SELECT 1 FROM public\.parent_phone_change_requests/);
  assert.match(sql, /NOT EXISTS\(SELECT 1 FROM public\.password_reset_requests/);
  assert.doesNotMatch(sql, /DELETE FROM public\.admin_notice_inbox/i);
});

test("all client panel counters consume notification refresh signals", async () => {
  const [bus, reader, inbox, admin, teacher, principal, parent] = await Promise.all([
    read("src/lib/notificationUpdates.js"),
    read("src/hooks/useNotificationRead.js"),
    read("src/pages/AdminNoticeInbox.jsx"),
    read("src/pages/AdminDashboard.jsx"),
    read("src/pages/HomeroomTeacherDashboard.jsx"),
    read("src/pages/PrincipalDashboard.jsx"),
    read("src/pages/ParentDashboard.jsx"),
  ]);

  assert.match(bus, /dispatchEvent\(new Event\(NOTIFICATION_CHANGE_EVENT\)\)/);
  assert.match(bus, /BroadcastChannel/);
  assert.match(bus, /postMessage\("refresh"\)/);
  assert.doesNotMatch(bus, /localStorage|sessionStorage|service_role/);
  assert.match(reader, /subscribeNotificationChanges/);
  assert.match(reader, /refresh\(\{ force: true, replace: true \}\)/);
  assert.match(admin, /const notificationChanged = useCallback\(\(\) => \{\s*announceNotificationChange\(\)/);
  assert.match(inbox, /useNotificationPulse\(reload\)/);
  assert.match(teacher, /useNotificationPulse/);
  assert.match(principal, /useNotificationPulse/);
  assert.match(parent, /useNotificationPulse/);
  assert.match(parent, /onSaved=\{\(\) => announceNotificationChange\(\)\}/);
  assert.match(parent, /setNoticeRead\(true\);\s*announceNotificationChange\(\)/);
});

test("staff badges are visible regardless of active menu; polling never runs in hidden tabs", async () => {
  const [pulse, teacher, principal] = await Promise.all([
    read("src/hooks/useNotificationPulse.js"),
    read("src/pages/HomeroomTeacherDashboard.jsx"),
    read("src/pages/PrincipalDashboard.jsx"),
  ]);
  assert.match(pulse, /if \(!document\.hidden\)/);
  assert.match(pulse, /window\.setInterval/);
  assert.match(pulse, /visibilitychange/);
  assert.match(pulse, /subscribeNotificationChanges/);
  assert.doesNotMatch(teacher, /activeTab === "daily" && !loadingReport \? pending : 0/);
  assert.match(teacher, /students\.length > 0 \? pending : 0/);
  assert.doesNotMatch(principal, /tab === "overview" && !loadingSummary/);
  assert.match(principal, /pendingCount=\{\s*total\.unfilled \+ total\.draft\s*\}/);
});
