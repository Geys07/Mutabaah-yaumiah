import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const read=(p)=>readFile(new URL("../"+p,import.meta.url),"utf8");

test("modal actions close only after confirmed server success, not post-save refresh",async()=>{
  const [chat,activation,report,daily,teacher,student,semester]=await Promise.all([
    read("src/pages/AdminRecoveryChats.jsx"),read("src/pages/ActivationBatch.jsx"),
    read("src/pages/ReportCards.jsx"),read("src/pages/ParentDaily.jsx"),
    read("src/pages/TeacherAccounts.jsx"),read("src/pages/StudentsBase.jsx"),
    read("src/pages/SemesterBoundaryManager.jsx"),
  ]);
  assert.match(chat,/action:"admin_review"[\s\S]*?setDecision\("?"\);/);
  assert.match(chat,/setConfirmReissue\(false\);[\s\S]*?Promise\.allSettled/);
  assert.match(chat,/setDecision\("?"\);[\s\S]*?Promise\.allSettled/);
  assert.match(chat,/title=\{decision==="approve"\?"Setujui Pemulihan Kata Sandi\?"/);
  assert.doesNotMatch(chat,/arc-dialog-backdrop/);
  assert.match(activation,/setConfirmAll\(false\);[\s\S]*?await loadRows\(\)/);
  assert.match(report,/setDeleteTarget\(null\);[\s\S]*?await refreshArchives\(\)/);
  assert.match(daily,/setConfirmOpen\(false\);\s*callbacks\.current\.onFinalized/);
  assert.match(teacher,/setModal\("?"\)/);
  assert.match(student,/setForm\(null\)/);
  assert.match(semester,/setConfirmOpen\(false\)/);
});

test("generated activation codes cannot silently rotate after read-back failure",async()=>{
  const code=await read("src/pages/StudentFamily.jsx");
  assert.match(code,/let issued = false/);
  assert.match(code,/issued = true/);
  assert.match(code,/setCodeReadFailed\(true\)/);
  assert.match(code,/async function retryReadCodes\(\)/);
  assert.match(code,/codeReadFailed \? retryReadCodes\(\) : generateCode\(type\.id\)/);
  assert.match(code,/codeReadFailed\) return/);
  assert.match(code,/Muat Ulang Kode/);
  assert.match(code,/onClose\(\); \/\/ Tutup hanya setelah server memastikan data berhasil tersimpan/);
});

test("school import success is never presented as a failed database import due to callback",async()=>{
  const s=await read("src/pages/StudentImport.jsx");
  assert.match(s,/let importedOnServer = false/);
  assert.match(s,/importedOnServer = true;\s*setResult/);
  assert.match(s,/importedOnServer\s*\? "Seluruh siswa sudah diimpor/);
  assert.match(s,/onImported\(\)/);
});

test("phone review errors display once and remain accessible in the confirmation",async()=>{
  const s=await read("src/pages/AdminPhoneRequests.jsx");
  assert.match(s,/if \(!data\?\.success\) throw/);
  assert.match(s,/setDialog\(null\)/);
  assert.match(s,/\{error && !dialog && <p role="alert" className="phone-error">/);
  assert.match(s,/\{error && <p role="alert" className="phone-error">\{error\}<\/p>\}\s*<div className="phone-actions">/);
  assert.doesNotMatch(s,/\{error && <p className="phone-error" role="alert">\{error\}<\/p>\}/);
});

test("class groups remain but extra wrapper removed; four-time colors on Admin notices and chat",async()=>{
  const [parents,notice,chat,shared]=await Promise.all([
    read("src/pages/Parents.css"),read("src/pages/AdminNotifications.css"),
    read("src/pages/AdminRecoveryChats.css"),read("src/styles/staff-dialog-unified.css")
  ]);
  assert.match(parents,/\.parents-class-group\{/);
  assert.match(parents,/\.parents-panel\{[\s\S]*?border:0;/);
  assert.match(parents,/background:transparent/);
  assert.match(notice,/\.staff-app \.admin-notifications/);
  assert.match(notice,/\.notification-filters button\.active/);
  assert.match(notice,/\.notification-item/);
  assert.match(chat,/\.staff-app \.arc-root/);
  for(const css of [parents,notice,chat,shared])assert.match(css,/var\(--sa-/);
});
