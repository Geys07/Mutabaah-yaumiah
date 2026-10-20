import { test } from "node:test";
import assert from "node:assert/strict";
import { pushErrorMessage } from "../src/lib/pushErrors.js";

test("HTTP 401 meminta login kembali", () => {
  assert.match(pushErrorMessage({ context: { status: 401 } }, "config"), /masuk kembali/);
});
test("HTTP 403 menjelaskan hak akses tanpa menampilkan detail server", () => {
  const secret = "SECRET_INTERNAL_DONT_SHOW";
  const message = pushErrorMessage({ context: { status: 403 }, message: secret }, "status");
  assert.match(message, /tidak aktif|tidak memiliki izin/);
  assert.ok(!message.includes(secret));
});
test("HTTP 409 subscription menolak pengambilalihan akun lain", () => {
  const message = pushErrorMessage({ context: { status: 409 } }, "subscribe");
  assert.match(message, /akun lain/);
  assert.match(pushErrorMessage({ context: { status: 409 } }, "unsubscribe"), /konflik/);
});
test("HTTP 400, 429, dan 503 mempunyai pesan aman", () => {
  assert.match(pushErrorMessage({ context: { status: 400 } }, "subscribe"), /tidak valid/);
  assert.match(pushErrorMessage({ context: { status: 429 } }, "subscribe"), /Terlalu banyak/);
  assert.match(pushErrorMessage({ context: { status: 503 } }, "status"), /bermasalah/);
});
test("Relay dan fetch errors menyarankan pengecekan koneksi", () => {
  for (const name of ["FunctionsFetchError", "FunctionsRelayError"]) {
    assert.match(pushErrorMessage({ name }, "config"), /koneksi internet/);
  }
});
test("Kesalahan tidak dikenal memakai fallback aman", () => {
  assert.equal(pushErrorMessage(new Error("token=sensitive"), "subscribe"), "Notifikasi belum dapat diproses. Coba lagi.");
});
