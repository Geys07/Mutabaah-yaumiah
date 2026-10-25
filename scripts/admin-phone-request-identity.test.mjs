import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const read = (path) => readFile(new URL("../" + path, import.meta.url), "utf8");

test("admin phone requests identify the guardian and linked students without changing review action", async () => {
  const source = await read("src/pages/AdminPhoneRequests.jsx");

  assert.match(source, /guardian:profiles!parent_phone_change_requests_guardian_id_fkey/);
  assert.match(source, /student_guardians\(/);
  assert.match(source, /student:students!student_guardians_student_id_fkey/);
  assert.match(source, /student_enrollments\(/);
  assert.match(source, /class:classes!student_enrollments_class_id_fkey/);

  assert.match(source, /Nama wali murid/);
  assert.match(source, /Siswa terkait/);
  assert.match(source, /Nomor lama/);
  assert.match(source, /Nomor baru/);
  assert.match(source, /guardianName\(dialog\)/);
  assert.match(source, /linkedStudents\(dialog\)/);
  assert.match(source, /Nama wali belum tersedia/);

  assert.match(source, /\.eq\("status", "pending"\)/);
  assert.match(source, /\.range\(page \* PAGE_SIZE/);
  assert.match(source, /\.abortSignal\(signal\)/);
  assert.match(source, /functions\.invoke\("parent-phone-change"/);
  assert.match(source, /action: "review", request_id: dialog\.id, approve: dialog\.approve/);
  assert.match(source, /onClick=\{\(\) => \{setError\(""\);setDialog\(\{ \.\.\.item, approve: true \}\);\}\}/);
  assert.match(source, /onClick=\{\(\) => \{setError\(""\);setDialog\(\{ \.\.\.item, approve: false \}\);\}\}/);
  assert.match(source, /\{error && !dialog && <p role="alert"/);
  assert.match(source, /\{error && <p role="alert" className="phone-error">\{error\}<\/p>\}/);
});

test("request identity presentation stays responsive and does not affect parent phone form", async () => {
  const css = await read("src/pages/ParentPhoneChange.css");
  assert.match(css, /\.phone-request-identity/);
  assert.match(css, /\.phone-request-student-list/);
  assert.match(css, /\.phone-request-phones/);
  assert.match(css, /\.phone-dialog\{max-height/);
  assert.match(css, /@media\(max-width:390px\)/);

  const parent = await read("src/pages/ParentPhoneChange.jsx");
  assert.match(parent, /action: "request", new_phone: phone, password/);
});
