import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const read = (p) => readFile(new URL("../" + p, import.meta.url), "utf8");

test("notifikasi sudah berizin: hanya sambungkan akun kembali, jangan meminta izin OS ulang", async () => {
  const [push,hook,parent,admin,auth] = await Promise.all([
    read("src/lib/pushDevice.js"),read("src/hooks/usePushDevice.js"),
    read("src/components/ParentNotificationControls.jsx"),
    read("src/components/AdminPushSettings.jsx"),read("src/lib/auth.js")
  ]);
  assert.match(push,/const reconnecting = new Map\(\)/);
  assert.match(push,/export function reconnectPushDevice\(kind,id,prepared\)/);
  assert.match(push,/if \(reconnecting\.has\(key\)\)/);
  assert.match(push,/if \(!id \|\| !prefersPushDevice\(kind,id\)\)/);
  assert.match(hook,/enabled = await reconnectPushDevice\(kind,id,context\)/);
  assert.match(hook,/permission: pushPermissionState\(\)/);
  assert.match(parent,/permission === "granted"/);
  assert.match(parent,/Hubungkan Notifikasi/);
  assert.match(admin,/permission === "granted"/);
  assert.match(admin,/Hubungkan Notifikasi Admin/);
  assert.match(auth,/await detachPushDevice\(\)/, "Saat logout wajib melepas endpoint agar akun berbeda tidak menerima pesan pribadi");
  const body=push.slice(push.indexOf("export function reconnectPushDevice"),push.indexOf("export function pushPermissionState"));
  assert.doesNotMatch(body,/requestPermission/, "Auto-reconnect dilarang membuka dialog izin baru");
});

test("hubungkan anak ditangani Admin saja tanpa popup klaim di Profil Orang Tua",async()=>{
  const [parent,manage,admin]=await Promise.all([
    read("src/pages/ParentDashboard.jsx"),
    read("src/pages/StudentFamily.jsx"),
    read("src/pages/Parents.jsx")
  ]);
  assert.doesNotMatch(parent,/Hubungkan Anak|claim-parent|linkChild\(/);
  assert.match(parent,/Penambahan anak ditangani Admin madrasah/);
  assert.match(manage,/admin_preview_parent_family/);
  assert.match(manage,/admin_save_parent_family/);
  assert.match(manage,/Ya, Satu Keluarga/);
  assert.doesNotMatch(manage,/linkExistingAccount\(type\.id\)/);
  assert.match(admin,/StudentFamily/);
});

test("aktivasi massal memakai ikon kartu identitas, bukan panah turun",async()=>{
  const panel=await read("src/pages/ActivationBatch.jsx");
  assert.match(panel,/<svg aria-hidden="true"/);
  assert.match(panel,/activation-batch-toggle-action/);
  assert.match(panel,/open \? "Tutup" : "Buka"/);
  assert.doesNotMatch(panel,/activation-batch-chevron/);
});

test("form kegiatan tidak memuat input urutan, penghitungan tetap otomatis saat simpan",async()=>{
  const activities=await read("src/pages/Activities.jsx");
  assert.match(activities,/function automaticSortOrder\(activity\)/);
  assert.match(activities,/const sort = automaticSortOrder\(form\)/);
  assert.match(activities,/sort_order: sort/);
  assert.doesNotMatch(activities,/<span>\s*Urutan\s*<\/span>/);
  assert.doesNotMatch(activities,/<th>Urutan<\/th>/);
});

test("hanya tabel ttd rapor tanpa border; garis capaian/catatan dipertahankan",async()=>{
  const code=await read("src/pages/ReportCards.jsx");
  const head=code.slice(code.indexOf("function removeSignatureBorders("),code.indexOf("function makeDetails("));
  assert.match(head,/clearBorders\(table,"tblPr","tblBorders"\)/);
  assert.match(head,/clearBorders\(cell,"tcPr","tcBorders"\)/);
  assert.match(head,/edge\.setAttributeNS\(W,"w:val","nil"\)/);
  assert.match(head,/edge\.setAttributeNS\(W,"w:sz","0"\)/);
  const call=code.match(/removeSignatureBorders\(tables\[tables\.length - 1\]\)/g)||[];
  assert.equal(call.length,1,"Pembersihan border hanya satu kali, tabel ttd terakhir");
  assert.match(code,/makeDetails\(tables\[1\], groups, grading\)/);
  assert.match(code,/\.details th, \.details td \{ border: \.25pt solid #999/);
  assert.match(code,/\.summary-notes \{ border: \.25pt solid #999/);
});
