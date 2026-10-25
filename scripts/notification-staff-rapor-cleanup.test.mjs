import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const read=(p)=>readFile(new URL("../"+p,import.meta.url),"utf8");

test("notifications persist without daily permission and recover their existing verified endpoint",async()=>{
 const [push,hook,auth]=await Promise.all([
   read("src/lib/pushDevice.js"),read("src/hooks/usePushDevice.js"),read("src/lib/auth.js")
 ]);
 assert.match(push,/OPT_IN_KEY/);
 assert.match(push,/export function prefersPushDevice/);
 assert.match(push,/binding && \(binding\.id !== id \|\| binding\.kind !== kind\)/);
 assert.match(push,/if \(!binding \|\| refresh\)/);
 assert.match(push,/invokePush\(kind, "subscribe", \{ subscription: sub\.toJSON\(\) \}\)/);
 assert.match(push,/localStorage\.setItem\(OPT_IN_KEY\(kind,id\), "1"\)/);
 assert.match(push,/localStorage\.setItem\(OPT_IN_KEY\(kind,id\), "0"\)/);
 assert.match(hook,/prefersPushDevice\(kind,id\)/);
 assert.match(hook,/Notification\.permission === "granted"/);
 assert.match(hook,/await enablePushDevice\(kind,id,context\)/);
 assert.match(auth,/await detachPushDevice\(\)/); // explicit logout still detaches privately
});
test("teacher and principal account default password is system assigned with no entry boxes",async()=>{
 const [staff,backend]=await Promise.all([
  read("src/pages/TeacherAccounts.jsx"),
  read("supabase/functions/create-teacher-account/index.ts")
 ]);
 assert.match(staff,/const INITIAL_STAFF_PASSWORD = "123456"/);
 assert.match(staff,/password:INITIAL_STAFF_PASSWORD/);
 assert.match(staff,/role === "principal"/);
 assert.doesNotMatch(staff,/form\.password|form\.confirm_password/);
 assert.match(backend,/password\.length<6/);
});
test("new activities pick their position without asking admin for a sort number",async()=>{
 const s=await read("src/pages/Activities.jsx");
 assert.match(s,/function automaticSortOrder\(activity\)/);
 assert.match(s,/const sort = automaticSortOrder\(form\)/);
 assert.doesNotMatch(s,/<span>\s*Urutan\s*<\/span>\s*<input/);
 assert.match(s,/sort_order: sort/);
});
test("students are numbered by class and activation has a meaningful icon",async()=>{
 const [parents,history,students,activation]=await Promise.all([
 read("src/pages/Parents.jsx"),read("src/pages/StudentHistoryPanel.jsx"),
 read("src/pages/StudentsBase.jsx"),read("src/pages/ActivationBatch.jsx")
 ]);
 assert.match(parents,/className="parents-number"/);
 assert.match(parents,/index\+1/);
 assert.match(history,/className="sh-row-number"/);
 assert.match(students,/className="students-number"/);
 assert.match(activation,/activation-batch-toggle-action/);
 assert.match(activation,/<svg aria-hidden="true"/);
});
test("only generated Word signature table has borders disabled; details stay unchanged",async()=>{
 const s=await read("src/pages/ReportCards.jsx");
 assert.match(s,/function removeSignatureBorders\(table\)/);
 assert.match(s,/const borderNames=\["top","left","bottom","right","insideH","insideV","start","end"\]/);
 assert.match(s,/edge\.setAttributeNS\(W,"w:val","nil"\)/);
 assert.match(s,/removeSignatureBorders\(tables\[tables\.length - 1\]\)/);
 assert.match(s,/makeDetails\(tables\[1\], groups, grading\)/);
 assert.match(s,/\.details th, \.details td \{ border: \.25pt solid #999/);
});
test("admin notification read distinction and mobile form stay compact",async()=>{
 const [notice,css,activityCss]=await Promise.all([
 read("src/pages/AdminNoticeInbox.jsx"),read("src/pages/AdminNoticeInbox.css"),
 read("src/pages/Activities.css")
 ]);
 assert.match(notice,/notice-inbox-read/);
 assert.match(notice,/notice-inbox-new/);
 assert.match(css,/\.notice-inbox-item\.is-read/);
 assert.match(css,/-webkit-line-clamp:2/);
 assert.match(activityCss,/\.staff-app \.activities-form-body/);
 assert.match(activityCss,/\.staff-app \.activities-dialog-footer/);
});
