import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL("../" + path, import.meta.url), "utf8");

test("handled phone/account requests auto-mark only matching Admin inbox notice", async () => {
  const sql = await read("supabase/migrations/20261024101219_admin_notice_resolve_when_handled_20261024.sql");
  assert.match(sql, /related_request_id uuid/);
  assert.match(sql, /NEW\.status NOT IN \('approved','rejected','revoked','used'\)/);
  assert.match(sql, /n\.related_request_id=NEW\.id/);
  assert.match(sql, /n\.read_at IS NULL/);
  assert.match(sql, /admin_notice_phone_request_resolved/);
  assert.match(sql, /admin_notice_account_request_resolved/);
  assert.doesNotMatch(sql, /DELETE FROM public\.admin_notice_inbox/i);
});

test("Admin counters and inbox still receive change signals", async () => {
  const [bus, reader, inbox, admin] = await Promise.all([
    read("src/lib/notificationUpdates.js"),
    read("src/hooks/useNotificationRead.js"),
    read("src/pages/AdminNoticeInbox.jsx"),
    read("src/pages/AdminDashboard.jsx"),
  ]);
  assert.match(bus, /BroadcastChannel/);
  assert.match(bus, /postMessage\("refresh"\)/);
  assert.doesNotMatch(bus, /localStorage|sessionStorage|service_role/);
  assert.match(reader, /subscribeNotificationChanges/);
  assert.match(reader, /refresh\(\{ force: true, replace: true \}\)/);
  assert.match(admin, /announceNotificationChange\(\)/);
  assert.match(inbox, /useNotificationPulse\(reload\)/);
});

test("parent daily status remains in calendar but not any notification view", async () => {
  const source = await read("src/pages/ParentDashboard.jsx");
  assert.match(source, /get_parent_mutabaah_month_status/);
  assert.match(source, /<ParentDaily/);
  assert.match(source, /<ParentCalendar/);
  assert.match(source, /onSaved=\{\(\) => announceNotificationChange\(\)\}/);
  assert.doesNotMatch(source, /id: "notifications"|navigate\("notifications"\)/);
  assert.doesNotMatch(source, /get_parent_daily_notice_read|mark_parent_daily_notice_read/);
  assert.doesNotMatch(source, /<ViewportPopover|className="pd-bell"|className="pd-notification-item"/);
});

test("teachers and principal retain report data without reminder bells", async () => {
  const [teacher, principal, staff] = await Promise.all([
    read("src/pages/HomeroomTeacherDashboard.jsx"),
    read("src/pages/PrincipalDashboard.jsx"),
    read("src/components/StaffWorkspace.jsx"),
  ]);
  assert.match(teacher, /get_mutabaah_class_day_status/);
  assert.match(principal, /get_mutabaah_class_day_status/);
  assert.match(teacher, /showNoticeBell=\{false\}/);
  assert.match(principal, /showNoticeBell=\{false\}/);
  assert.doesNotMatch(teacher, /noticeItems=|pendingCount=/);
  assert.doesNotMatch(principal, /noticeItems=|pendingCount=/);
  assert.match(staff, /showNoticeBell = true/);
  assert.match(staff, /\{showNoticeBell && <div className="staff-notice-anchor"/);
});

test("password reset sends private-data-free push only on a newly inserted request", async () => {
  const [recover, phone] = await Promise.all([
    read("supabase/functions/password-recovery/index.ts"),
    read("src/pages/ForgotPassword.jsx"),
  ]);
  assert.match(recover, /import webpush from "npm:web-push@3\.6\.7"/);
  assert.match(recover, /async function notifyAdminsOfResetRequest\(/);
  assert.match(recover, /\.eq\("role", "admin"\)/);
  assert.match(recover, /\.eq\("account_status", "active"\)/);
  assert.match(recover, /\.from\("admin_push_subscriptions"\)/);
  assert.match(recover, /await webpush\.sendNotification/);
  assert.match(recover, /if \(!insertError\) \{\s*await notifyAdminsOfResetRequest\(\)/);
  assert.match(recover, /insertError\.code !== "23505"/);
  const pushPayload = recover.slice(recover.indexOf('const message = JSON.stringify({'), recover.indexOf('await Promise.allSettled(devices'));
  assert.doesNotMatch(pushPayload, /phone|code|user_id|full_name|password/i);
  assert.match(recover, /const genericResult = \{/);
  assert.match(phone, /action: "request"/);
  assert.match(phone, /action: "redeem"/);
});
