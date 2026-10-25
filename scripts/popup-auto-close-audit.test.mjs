import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (file) => readFile(new URL("../" + file, import.meta.url), "utf8");
const inMethod = (source, start, stop) => {
  const a = source.indexOf(start);
  const b = source.indexOf(stop,a+start.length);
  assert.ok(a>=0 && b>a, "Method boundary exists: "+start);
  return source.slice(a,b);
};

test("promotion and semester confirmations close on persisted success, remain on failure", async () => {
  for(const [path,method] of [
    ["src/pages/PromotionManager.jsx","async function commit()"],
    ["src/pages/SemesterBoundaryManager.jsx","async function save()"],
  ]){
    const src=await read(path);
    const operation=inMethod(src,method,"\n  return (");
    const good=operation.indexOf('setConfirmOpen(false);');
    const error=operation.indexOf("} catch (caught)");
    assert.ok(good>=0 && error>good,path+" should close on confirmed write");
    assert.doesNotMatch(operation.slice(error),/setConfirmOpen\(false\)/,path+" should not close on error");
    assert.match(src,/AppConfirmDialog/);
    assert.match(src,/error=\{error\}/);
  }
});
test("password request approval stays open on server error, not after a completed request",async()=>{
  const src=await read("src/pages/AdminNotifications.jsx");
  const operation=inMethod(src,"async function processDecision()","\n  async function copyCode()");
  assert.match(operation,/savedByServer = true/);
  assert.match(operation,/if \(savedByServer\) setConfirmation\(null\)/);
  assert.doesNotMatch(operation,/} catch \(processError\) \{\s*setConfirmation\(null\)/);
  assert.match(src,/AppConfirmDialog/);
  // One-time recovery code is a result screen, NOT a save form.
  assert.match(src,/\{issuedCode && \(/);
  assert.match(src,/Salin kode sebelum menutup jendela/);
});
test("admin notifications and reminder controls use consistent confirmation design",async()=>{
  const paths=[
    "src/pages/PromotionManager.jsx",
    "src/pages/SemesterBoundaryManager.jsx",
    "src/pages/AdminNotifications.jsx",
    "src/pages/AdminReminderSettings.jsx",
    "src/pages/AdminNoticeInbox.jsx",
    "src/pages/ActivationBatch.jsx",
    "src/pages/AdminRecoveryChats.jsx",
    "src/pages/StudentAdminTools.jsx",
    "src/pages/ReportCards.jsx",
  ];
  for(const path of paths){
    const src=await read(path);
    assert.match(src,/<AppConfirmDialog/,path);
    assert.doesNotMatch(src,/window\.(?:confirm|alert|prompt)\s*\(/,path);
  }
  const reminder=await read("src/pages/AdminReminderSettings.jsx");
  const setEnabled=inMethod(reminder,"async function setEnabled(enabled)","\n  async function sendPreview()");
  assert.match(setEnabled,/setConfirmEnable\(false\)/);
  assert.doesNotMatch(setEnabled,/await load\(\)/);
  assert.match(reminder,/mengikuti sakelar \{enabled \? "ON" : "OFF"\}/);
});
test("activation issue, archived deletion and semester save never re-submit due to readback failure",async()=>{
  const activation=await read("src/pages/ActivationBatch.jsx");
  const issuing=inMethod(activation,"async function issue(student = null)","\n  async function downloadPdf()");
  assert.ok(issuing.indexOf("setConfirmAll(false)")<issuing.indexOf("await loadRows()"));
  assert.match(issuing,/Perubahan kode tersimpan/);
  const reports=await read("src/pages/ReportCards.jsx");
  const archives=inMethod(reports,"async function deleteArchive(entry)","\n  return (");
  assert.ok(archives.indexOf("setDeleteTarget(null)")<archives.indexOf("await refreshArchives()"));
  assert.match(archives,/Arsip .*berhasil dihapus/);
  const semester=await read("src/pages/SemesterBoundaryManager.jsx");
  const save=inMethod(semester,"async function save()","\n  return (");
  assert.ok(save.indexOf("setConfirmOpen(false)")<save.indexOf("await loadData()"));
});
test("main edit dialogs close after confirmed success, except drafts and read-once information",async()=>{
  const files={
    students:"src/pages/StudentsBase.jsx",
    family:"src/pages/StudentFamily.jsx",
    import:"src/pages/StudentImport.jsx",
    importParent:"src/pages/StudentAdminTools.jsx",
    staff:"src/pages/TeacherAccounts.jsx",
    activities:"src/pages/Activities.jsx",
    phone:"src/pages/AdminPhoneRequests.jsx",
    daily:"src/pages/ParentDaily.jsx",
    dashboard:"src/pages/ParentDashboard.jsx",
    parentPrompt:"src/components/ParentNotificationControls.jsx",
  };
  const data=Object.fromEntries(await Promise.all(
    Object.entries(files).map(async([k,p])=>[k,await read(p)])));
  assert.match(data.students,/setForm\(null\)/);
  assert.match(data.family,/announceStudentDataChange\(\);\s*onClose\(\)/);
  assert.match(data.import,/onImported\(\)/);
  assert.match(data.importParent,/onImported=\{\(\) => \{/);
  assert.match(data.staff,/setModal\(""\)/);
  assert.match(data.activities,/setForm\(null\)/);
  assert.match(data.phone,/setDialog\(null\)/);
  assert.match(data.daily,/onFinalized\?\.\(\)/);
  assert.match(data.dashboard,/onFinalized=\{closeOverlay\}/);
  assert.match(data.parentPrompt,/if \(await device\.toggle\(\)\) dismiss\(\)/);
});
test("dialog a11y and rapor interface use four time theme without changing printed output",async()=>{
  const [dialog,css,report]=await Promise.all([
    read("src/components/AppConfirmDialog.jsx"),
    read("src/components/AppConfirmDialog.css"),
    read("src/pages/ReportCards.jsx"),
  ]);
  assert.match(dialog,/aria-modal="true"/);
  assert.match(dialog,/getTimeTheme\(getJakartaClock\(\)\.hour\)/);
  assert.match(dialog,/dialogRef\.current\.querySelectorAll/);
  assert.match(dialog,/previous\?\.focus\?\.\(\)/);
  assert.match(css,/data-time-theme="siang"/);
  assert.match(css,/data-time-theme="sore"/);
  assert.match(css,/data-time-theme="malam"/);
  assert.match(css,/body:has\(\.app-confirm-overlay\)/);
  assert.match(report,/\.mut-rapor-page \{ background:var\(--sa-card/);
  assert.match(report,/\.mut-rapor-page h2 .*var\(--sa-accent/);
});

test("confirmation descriptions render actual line breaks, not visible backslash-n codes",async()=>{
 for(const path of [
   "src/pages/PromotionManager.jsx",
   "src/pages/SemesterBoundaryManager.jsx",
   "src/pages/AdminNotifications.jsx",
   "src/pages/ReportCards.jsx",
 ]){
   const file=await read(path);
   const start=file.indexOf("<AppConfirmDialog");
   const end=file.indexOf("/>",start);
   assert.ok(start>=0 && end>start,path);
   const dialog=file.slice(start,end);
   assert.equal(dialog.includes(String.fromCharCode(92,92,110)),false,path+" must not print literal escapes");
   assert.ok(dialog.includes(String.fromCharCode(92,110)),path+" includes a purposeful line break");
 }
});
