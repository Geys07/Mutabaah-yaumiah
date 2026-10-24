import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("reminder controls are fail-closed; sample never sends to guardians", async () => {
  const [migration, component, core, adminPush] = await Promise.all([
    read("supabase/migrations/20261021162313_admin_reminder_controls_inbox.sql"),
    read("src/pages/AdminReminderSettings.jsx"),
    read("supabase/functions/parent-reminder-send/core.mjs"),
    read("supabase/functions/admin-push/index.ts"),
  ]);
  assert.match(migration, /transport_ready boolean not null default false/);
  assert.match(migration, /'can_enable', \(v_transport and v_schedule\)/);
  assert.match(migration, /if p_enabled and coalesce/);
  assert.match(migration, /auth\.uid\(\) is null or not public\.has_role\('admin'\)/);
  assert.match(migration, /grant update \(read_at\) on public\.admin_notice_inbox to authenticated/);
  assert.match(migration, /v_admin,'sample'/);
  assert.match(migration, /Pengisian Mutabaah ananda hari ini belum selesai\. Silakan lengkapi dan finalisasi\./);
  assert.match(core, /Pengisian Mutabaah ananda hari ini belum selesai\. Silakan lengkapi dan finalisasi\./);
  assert.match(component, /supabase\.rpc\("admin_reminder_preview"\)/);
  assert.match(component, /invokePush\("admin", "test_reminder_push"/);
  assert.match(component, /checkPushDevice\("admin", auth\.user\.id\)/);
  assert.match(adminPush, /if \(action === "test_reminder_push"\)/);
  assert.match(adminPush, /\.from\("admin_push_subscriptions"\)/);
  assert.match(adminPush, /\.eq\("user_id", adminId\)/);
  assert.match(adminPush, /\.eq\("endpoint", endpoint\)/);
  assert.match(adminPush, /webpush\.sendNotification/);
  assert.doesNotMatch(adminPush, /from\("parent_push_subscriptions"\)/);
  assert.match(component, /supabase\.rpc\("admin_reminder_set_enabled"/);
  assert.doesNotMatch(component, /functions\.invoke\("parent-reminder-send"/);
  assert.doesNotMatch(migration, /cron\.schedule\s*\(/);
});

test("admin inbox retains original request records and provides safe actions", async () => {
  const [inbox, tabs, dashboard, migration] = await Promise.all([
    read("src/pages/AdminNoticeInbox.jsx"),
    read("src/pages/AdminNotificationSections.jsx"),
    read("src/pages/AdminDashboard.jsx"),
    read("supabase/migrations/20261021162313_admin_reminder_controls_inbox.sql"),
  ]);
  assert.match(tabs, /AdminNoticeInbox/);
  assert.match(tabs, /AdminReminderSettings/);
  assert.match(inbox, /Tandai (Dibaca )?Semua/);
  assert.match(inbox, /Hapus yang Dibaca/);
  assert.match(inbox, /"mark-all"/);
  assert.match(inbox, /"delete-read"/);
  assert.match(inbox, /"delete-one"/);
  assert.doesNotMatch(inbox, /\.from\("password_reset_requests"\)\.delete/);
  assert.doesNotMatch(inbox, /\.from\("parent_phone_change_requests"\)\.delete/);
  assert.match(migration, /user_id = \(select auth\.uid\(\)\)/);
  assert.match(dashboard, /\.from\("admin_notice_inbox"\)/);
});
