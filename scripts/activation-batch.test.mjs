import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { ACTIVATION_CARD_LAYOUT } from "../src/lib/activationCardsPdf.js";

const read = (file) => readFile(new URL("../" + file, import.meta.url), "utf8");

test("card geometry is exactly 3 by 4 on portrait A4", () => {
  assert.equal(ACTIVATION_CARD_LAYOUT.columns, 3);
  assert.equal(ACTIVATION_CARD_LAYOUT.rows, 4);
  assert.equal(ACTIVATION_CARD_LAYOUT.cardsPerPage, 12);
  assert.ok(ACTIVATION_CARD_LAYOUT.widthMm > 61);
  assert.ok(ACTIVATION_CARD_LAYOUT.heightMm > 66);
});

test("QR is a nonempty shared PNG and PDF never uploads a private code", async () => {
  const png = await readFile(new URL("../public/activation/qr-umum.png", import.meta.url));
  assert.equal(png.toString("hex", 0, 8), "89504e470d0a1a0a");
  assert.ok(png.length > 500);
  const pdf = await read("src/lib/activationCardsPdf.js");
  assert.match(pdf, /activation\/qr-umum\.png/);
  assert.match(pdf, /code_state === "active"/);
  assert.match(pdf, /index % CARDS_PER_PAGE === 0/);
  assert.match(pdf, /doc\.save\(/);
  assert.doesNotMatch(pdf, /supabase|storage\.upload|\.insert\(/);
});

test("Admin and Wali Kelas both show the activation flow", async () => {
  const [admin, teacher, batch] = await Promise.all([
    read("src/pages/Parents.jsx"),
    read("src/pages/HomeroomTeacherDashboard.jsx"),
    read("src/pages/ActivationBatch.jsx"),
  ]);
  assert.match(admin, /<ActivationBatch \/>/);
  assert.match(teacher, /id: "activation"/);
  assert.match(teacher, /<ActivationBatch isTeacher \/>/);
  assert.match(batch, /list_parent_activation_batch/);
  assert.match(batch, /issue_parent_activation_batch/);
  assert.match(batch, /p_student_id: student\?\.student_id \|\| null/);
  assert.match(batch, /Buat Kode Massal/);
  assert.match(batch, /Unduh Kartu Aktivasi \(PDF\)/);
  assert.doesNotMatch(batch, /downloadExcel|\.xlsx/);
});

test("database guards assigned classes, preserves valid codes and serializes issuance", async () => {
  const sql = await read("supabase/migrations/20261024094913_parent_activation_batch_roles_print_20261024.sql");
  assert.match(sql, /qa06_account_active\(\)/);
  assert.match(sql, /has_role\('admin'\)/);
  assert.match(sql, /has_role\('homeroom_teacher'\)/);
  assert.match(sql, /homeroom_assignments/);
  assert.match(sql, /h\.teacher_id = \( SELECT auth\.uid\(\)/);
  assert.match(sql, /code_state = 'ready'/);
  assert.match(sql, /pg_advisory_xact_lock/);
  assert.match(sql, /parent_activation_codes\.used_at IS NULL/);
  assert.match(sql, /parent_activation_codes\.expires_at > now\(\)/);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.issue_parent_activation_batch/);
  assert.doesNotMatch(sql, /DELETE FROM public\.parent_activation_codes/i);
});
