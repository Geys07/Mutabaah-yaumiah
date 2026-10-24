import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import { spawnSync } from "node:child_process";
import { edgeFunctionErrorMessage } from "../src/lib/edgeFunctionError.js";

const read = (path) => readFile(new URL("../" + path, import.meta.url), "utf8");

test("Edge recovery-chat source is parseable and boot-time owner collision is fixed", async () => {
  const code = await read("supabase/functions/recovery-chat/index.ts");
  const javascript = stripTypeScriptTypes(code);
  const parsed = spawnSync(process.execPath, ["--check", "--input-type=module"], {
    input: javascript,
    encoding: "utf8",
  });
  assert.equal(parsed.status, 0, parsed.stderr);
  assert.match(code, /const \{data:ownerProfile\}/);
  assert.doesNotMatch(code, /const \{data:owner\}/);
  assert.match(code, /const seenSender = owner === "user"/);
});

test("Function errors support Response, ordinary object, and unavailable gateway", async () => {
  assert.equal(
    await edgeFunctionErrorMessage({context:{status:503}, message:"Edge Function returned a non-2xx status code"}),
    "Layanan chat sementara tidak tersedia. Silakan coba lagi."
  );
  assert.equal(
    await edgeFunctionErrorMessage({context:{error:"Akses Admin tidak tersedia."}}),
    "Akses Admin tidak tersedia."
  );
  assert.equal(
    await edgeFunctionErrorMessage({context:{json:async()=>({error:"Nomor tidak terdaftar"})}}),
    "Nomor tidak terdaftar"
  );
  const [admin, parent] = await Promise.all([
    read("src/pages/AdminRecoveryChats.jsx"), read("src/pages/ForgotPassword.jsx"),
  ]);
  assert.match(admin, /edgeFunctionErrorMessage/);
  assert.match(parent, /edgeFunctionErrorMessage/);
  assert.doesNotMatch(admin, /context\?\.json\(\)/);
  assert.doesNotMatch(parent, /context\.json\(\)/);
});

test("Selecting Chat Pemulihan Kata Sandi navigates directly; no bridge screen", async () => {
  const s = await read("src/pages/AdminNotificationSections.jsx");
  assert.match(s, /onOpenRecoveryChats\?\.\(\)/);
  assert.match(s, /if \(tab\.shortcut\)/);
  assert.match(s, /Chat Pemulihan Kata Sandi/);
  assert.doesNotMatch(s, /Buka Chat Pemulihan Kata Sandi<\/button>/);
  assert.doesNotMatch(s, /section === "chats"/);
  assert.match(s, /onOpenRequest=\{\(source\)/);
});

test("All Admin notification sections use the staff's four-time accent", async () => {
  const [navigation, inbox, reminder, phone, chat, staff] = await Promise.all([
    read("src/pages/SectionTabs.css"),
    read("src/pages/AdminNoticeInbox.css"),
    read("src/pages/AdminReminderSettings.css"),
    read("src/pages/ParentPhoneChange.css"),
    read("src/pages/AdminRecoveryChats.css"),
    read("src/components/StaffWorkspace.css"),
  ]);
  assert.match(staff, /data-staff-theme="siang"/);
  assert.match(staff, /data-staff-theme="sore"/);
  assert.match(staff, /data-staff-theme="malam"/);
  for (const [name, css] of Object.entries({navigation,inbox,reminder,phone,chat})) {
    assert.match(css, /var\(--sa-accent/, name);
    assert.match(css, /var\(--sa-(soft|line|muted)/, name);
  }
  assert.match(navigation, /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(inbox, /grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
});
