import {test} from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
const read = (name) => readFile(new URL("../"+name, import.meta.url), "utf8");

test("password recovery chat uses the four existing WIB themes without inventing another", async()=>{
  const [clock,themes,login,styles,staff]=await Promise.all([
    read("src/lib/jakartaTheme.js"),read("src/styles/mutabaah-unified-theme.css"),
    read("src/App.jsx"),read("src/pages/ForgotPassword.css"),
    read("src/pages/AdminRecoveryChats.css")]);
  for(const time of ["pagi","siang","sore","malam"]) {
    assert.match(clock,new RegExp('key: "'+time+'"'));
    assert.match(themes,new RegExp('data-time-theme="'+time+'"'));
  }
  assert.match(clock,/hour >= 4 && hour < 11/);
  assert.match(clock,/hour >= 11 && hour < 15/);
  assert.match(clock,/hour >= 15 && hour < 18/);
  assert.match(login,/document\.documentElement\.dataset\.timeTheme/);
  assert.match(styles,/var\(--mut-ui-accent/);
  assert.match(styles,/var\(--mut-scene-mobile/);
  assert.match(staff,/var\(--sa-accent/);
});

test("normal login stays the default; access token persists only in recovery",async()=>{
  const [app,chat,backend]=await Promise.all([
    read("src/App.jsx"),read("src/pages/ForgotPassword.jsx"),
    read("supabase/functions/recovery-chat/index.ts")]);
  assert.match(app,/shouldRestorePasswordRecovery\(\) \? "forgot" : "login"/);
  assert.match(chat,/localStorage\.setItem\(TICKET_KEY, data\.token\)/);
  assert.match(chat,/Lanjutkan ke Chat/);
  assert.match(chat,/Kembali ke Login/);
  assert.match(chat,/Ganti Kata Sandi/);
  assert.match(chat,/my_chat/);
  assert.match(backend,/access_hash/);
  assert.match(backend,/async function ticketByToken/);
  assert.match(backend,/async function authorizedAdmin/);
  assert.match(backend,/return await adminReview\(req,ticket/);
});

test("Admin review and chat UI keep decision controls away from the keyboard",async()=>{
  const [admin,css,server]=await Promise.all([
    read("src/pages/AdminRecoveryChats.jsx"),read("src/pages/AdminRecoveryChats.css"),
    read("supabase/functions/recovery-chat/index.ts")]);
  assert.match(admin,/Chat Pemulihan Kata Sandi/);
  assert.match(admin,/Setujui & Kirim Kode/);
  assert.match(admin,/Tolak/);
  assert.match(admin,/arc-decision-bar/);
  assert.match(admin,/arc-composer/);
  assert.match(css,/\.arc-decision-bar \{position:sticky/);
  assert.match(server,/action:"review"/);
  assert.match(server,/await insertMessage\(ticket.id,"code",await encrypt\(code\)\)/);
  assert.match(server,/admin_reissue/);
});

test("chat RLS isolation, secret protection, and 30-day cleanup are present",async()=>{
  const [sql,server]=await Promise.all([
    read("supabase/migrations/20261024115814_recovery_chat_tickets_four_time_20261024.sql"),
    read("supabase/functions/recovery-chat/index.ts")]);
  assert.match(sql,/ALTER TABLE public\.recovery_chat_tickets ENABLE ROW LEVEL SECURITY/);
  assert.match(sql,/ALTER TABLE public\.recovery_chat_messages ENABLE ROW LEVEL SECURITY/);
  assert.match(sql,/REVOKE ALL ON public\.recovery_chat_tickets/);
  assert.match(sql,/interval '30 days'/);
  assert.match(sql,/cleanup_recovery_chats/);
  assert.match(server,/crypto\.getRandomValues\(new Uint8Array\(32\)\)/);
  assert.match(server,/AES-GCM/);
  assert.match(server,/check_login_rate_limit/);
  assert.match(server,/sendPushToApplicant/);
  assert.match(server,/sendPushToAdmins/);
});

test("six-character minimum is consistent in all password creation/update paths",async()=>{
  const files=[
    "src/pages/ParentActivation.jsx","src/pages/AccountSecurityBase.jsx",
    "src/pages/TeacherAccounts.jsx","src/pages/ForgotPassword.jsx",
    "supabase/functions/activate-parent/index.ts",
    "supabase/functions/create-teacher-account/index.ts",
    "supabase/functions/password-recovery/index.ts",
  ];
  for(const file of files){
    const source=await read(file);
    assert.doesNotMatch(source,/password\.length\s*<\s*10|newPassword\.length\s*<\s*10|form\.password\.length\s*<\s*10|minLength=\{10\}|10–72/);
    assert.match(source,/6–72|length\s*<\s*6|minLength=\{6\}|length\s*>=\s*6/);
  }
  const recovery=await read("supabase/functions/password-recovery/index.ts");
  assert.match(recovery,/14 \* 24 \* 60 \* 60 \* 1000/);
});


test("refreshed guest chat stays separate from ordinary login, and account notices open Admin chat",async()=>{
  const [app,parent,server,notices]=await Promise.all([
    read("src/App.jsx"),
    read("src/pages/ForgotPassword.jsx"),
    read("supabase/functions/recovery-chat/index.ts"),
    read("src/pages/AdminNotificationSections.jsx"),
  ]);
  assert.match(app,/function shouldRestorePasswordRecovery\(\)/);
  assert.match(app,/saved\?\.scope === "login" && saved\.page === "forgot"/);
  assert.match(app,/shouldRestorePasswordRecovery\(\) \? "forgot" : "login"/);
  assert.match(app,/url\.searchParams\.delete\("recovery_chat"\)/);
  assert.match(server,/phone:ownerProfile\?\.phone\|\|""/);
  assert.match(parent,/phone: chat\?\.phone \|\| old\.phone/);
  assert.match(notices,/onOpenRecoveryChats/);
  assert.doesNotMatch(notices,/<AdminNotifications/);
});
