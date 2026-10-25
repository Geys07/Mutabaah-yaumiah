import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { groupParentStudents, groupParentsByClass } from "../src/lib/parentDirectory.js";
const read = name=>readFile(new URL("../"+name,import.meta.url),"utf8");

const contacts=[
  {student_id:"s1",student_name:"Alif",class_name:"VII A",relationship:"father",contact_name:"Ayah Alif",phone:"081234567890",account_linked:true},
  {student_id:"s1",student_name:"Alif",class_name:"VII A",relationship:"mother",contact_name:"Ibu Alif",phone:null,account_linked:false},
  {student_id:"s2",student_name:"Bima",class_name:"VIII B",relationship:"mother",contact_name:"Ibu Bima",phone:"081234567891",account_linked:false},
  {student_id:"s3",student_name:"Andi",class_name:"VII A",relationship:"father",contact_name:"Ayah Andi",phone:"081234567892",account_linked:false},
];
test("each student occurs once even with two guardian contacts and an incomplete optional parent",()=>{
  const students=groupParentStudents(contacts);
  assert.equal(students.length,3);
  const first=students.find(s=>s.id==="s1");
  assert.equal(first.contacts.father.contact_name,"Ayah Alif");
  assert.equal(first.contacts.mother.contact_name,"Ibu Alif");
  assert.equal(first.contacts.mother.phone,null);
  assert.equal(first.contacts.guardian,null);
  assert.deepEqual(groupParentsByClass(students).map(x=>[x.name,x.students.length]),
    [["VII A",2],["VIII B",1]]);
  assert.deepEqual(groupParentStudents(contacts,{status:"linked"}).map(s=>s.id),["s1"]);
  assert.equal(groupParentStudents(contacts,{search:"ibu alif"}).length,1);
  assert.equal(groupParentStudents(contacts,{classId:"VIII B"}).length,1);
});
test("parents directory uses one row per student, class cards, and optional empty contact",async()=>{
  const [jsx,css]=await Promise.all([read("src/pages/Parents.jsx"),read("src/pages/Parents.css")]);
  assert.match(jsx,/groupParentStudents\(/);
  assert.match(jsx,/groupParentsByClass\(/);
  assert.match(jsx,/group\.students\.map\(\(student,index\)/);
  assert.match(jsx,/student\.contacts\.father/);
  assert.match(jsx,/student\.contacts\.mother/);
  assert.match(jsx,/student\.contacts\.guardian/);
  assert.doesNotMatch(jsx,/filtered\.map\(\(item\)/);
  assert.match(jsx,/listenStudentDataChanges/);
  assert.match(css,/var\(--sa-accent/);
  assert.match(css,/\.parents-class-group/);
  assert.match(css,/@media\(max-width:780px\)/);
});
test("activation panel is collapsed unless teacher needs it, groups codes and ignores optional missing contacts",async()=>{
  const [jsx,css]=await Promise.all([read("src/pages/ActivationBatch.jsx"),read("src/pages/ActivationBatch.css")]);
  assert.match(jsx,/useState\(Boolean\(isTeacher\)\)/);
  assert.match(jsx,/activation-batch-toggle/);
  assert.match(jsx,/item\.code_state === "incomplete" \|\| item\.code_state === "linked"/);
  assert.match(jsx,/displayedClasses\.map/);
  assert.match(jsx,/setConfirmAll\(false\)/);
  assert.match(css,/activation-batch-class-heading/);
  assert.match(css,/var\(--sa-accent/);
});
test("save dialogs close only on successful server responses and finalized daily entry",async()=>{
  const [family,daily,dashboard,students,accounts,activities,importer]=await Promise.all([
    read("src/pages/StudentFamily.jsx"),read("src/pages/ParentDaily.jsx"),
    read("src/pages/ParentDashboard.jsx"),read("src/pages/StudentsBase.jsx"),
    read("src/pages/TeacherAccounts.jsx"),read("src/pages/Activities.jsx"),
    read("src/pages/StudentImport.jsx")
  ]);
  assert.match(family,/if \(saveError\)[\s\S]*?announceStudentDataChange\(\);\s*onClose\(\)/);
  assert.match(daily,/callbacks\.current\.onFinalized\?\.\(\)/);
  assert.match(dashboard,/onFinalized=\{closeOverlay\}/);
  assert.match(daily,/if \(finalize\) \{/);
  assert.match(students,/setForm\(null\)/);
  assert.match(accounts,/setModal\("?"\)/);
  assert.match(activities,/setForm\(null\)/);
  assert.match(importer,/onClose\(\)/);
});
test("native browser confirmation boxes replaced in high-impact admin operations",async()=>{
  const [chat,lifecycle,reports,appDialog,dialogCSS,themeCSS]=await Promise.all([
    read("src/pages/AdminRecoveryChats.jsx"),read("src/pages/StudentAdminTools.jsx"),
    read("src/pages/ReportCards.jsx"),read("src/components/AppConfirmDialog.jsx"),
    read("src/components/AppConfirmDialog.css"),read("src/styles/staff-dialog-unified.css")
  ]);
  for(const page of [chat,lifecycle,reports]){
    assert.doesNotMatch(page,/window\.confirm\(/);
    assert.match(page,/AppConfirmDialog/);
  }
  assert.match(appDialog,/createPortal\(/);
  assert.match(appDialog,/aria-modal="true"/);
  assert.match(dialogCSS,/data-time-theme="siang"/);
  assert.match(dialogCSS,/data-time-theme="sore"/);
  assert.match(dialogCSS,/data-time-theme="malam"/);
  assert.match(themeCSS,/max-height:calc\(100dvh/);
});
test("student-related pickers group by class and update data across tabs without leaking PII",async()=>{
  const [studentList,adminTools,signals]=await Promise.all([
    read("src/pages/StudentsBase.jsx"),read("src/pages/StudentAdminTools.jsx"),
    read("src/lib/studentDataUpdates.js")
  ]);
  assert.match(studentList,/students-class-group/);
  assert.match(adminTools,/<optgroup key=\{className\} label=\{className\}>/);
  assert.match(signals,/BroadcastChannel/);
  assert.match(signals,/45000/);
  const broadcastPayload = signals.match(/channel\.postMessage\(([^)]*)\)/)?.[1] || "";
  assert.equal(broadcastPayload, '"refresh"');
  assert.doesNotMatch(broadcastPayload,/full_name|student_name|phone/);
});


test("history search groups student results under latest class without changing audit RPC",async()=>{
  const [history,css]=await Promise.all([
    read("src/pages/StudentHistoryPanel.jsx"),
    read("src/pages/StudentHistoryPanel.css"),
  ]);
  assert.match(history,/groupedResults\.map\(\(\[className,items\]\)/);
  assert.match(history,/\.from\("student_enrollments"\)/);
  assert.match(history,/\.order\("starts_on",\{ascending:false\}\)/);
  assert.match(history,/\.limit\(300\)/);
  assert.match(history,/sh-class-group/);
  assert.match(css,/var\(--sa-accent/);
  assert.match(css,/\.sh-class-heading/);
});
test("daily finalize confirmation stays until backend result, and failures remain actionable",async()=>{
  const daily=await read("src/pages/ParentDaily.jsx");
  const begin=daily.indexOf("async function saveDay(finalize)");
  const operation=daily.slice(begin,begin+2100);
  assert.match(operation,/setFinalizing\(true\)/);
  assert.doesNotMatch(operation,/setConfirmOpen\(false\)/);
  assert.match(daily,/callbacks\.current\.onFinalized\?\.\(\)/);
  assert.match(daily,/setConfirmOpen\(false\);\s*callbacks\.current\.onFinalized/);
  assert.match(daily,/role="alert"/);
});
