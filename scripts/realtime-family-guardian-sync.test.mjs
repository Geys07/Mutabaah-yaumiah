import { test } from "node:test";
import assert from "node:assert/strict";
import { access, readdir, readFile } from "node:fs/promises";

const read = (path) => readFile(new URL("../" + path, import.meta.url), "utf8");

test("guardian phone lookup auto-fills known names and asks before sharing a family phone", async () => {
  const [ui, sql] = await Promise.all([
    read("src/pages/StudentFamily.jsx"),
    read("supabase/migrations/20261025140000_guardian_name_autofill.sql"),
  ]);
  assert.match(ui, /function existingContactName\(issue\)/);
  assert.match(ui, /item\.registered_name/);
  assert.match(ui, /other\.contact_name/);
  assert.match(ui, /Nama terisi otomatis dari data wali yang sudah ada/);
  assert.match(ui, /Nomor ini sudah tercatat atas nama/);
  assert.match(ui, /Apakah \$\{student\.full_name\} satu keluarga dengan \$\{students\}/);
  assert.match(ui, /if\(!resolvedPayload\[type\.id\]\.full_name\)/);
  assert.doesNotMatch(ui, /Hubungkan ke Akun|linkExistingAccount|admin_link_existing_parent/);
  assert.match(sql, /'contact_name',fc\.full_name/);
  assert.match(sql, /'registered_name',v_registered_name/);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.admin_preview_parent_family\(uuid,jsonb\) FROM PUBLIC,anon/);
});

test("approved guardian phone change updates only linked and explicitly confirmed family contacts", async () => {
  const sql = await read("supabase/migrations/20261025140100_guardian_phone_sync.sql");
  assert.match(sql, /auth\.role\(\)<>'service_role'/);
  assert.match(sql, /UPDATE public\.profiles SET phone=v_req\.new_phone/);
  assert.match(sql, /WITH RECURSIVE family_links\(student_id,relationship\) AS/);
  assert.match(sql, /UPDATE public\.student_family_contacts fc/);
  assert.match(sql, /UPDATE public\.parent_family_consents c/);
  assert.match(sql, /UPDATE public\.parent_activation_codes pc/);
  assert.match(sql, /AND fc\.phone=v_req\.old_phone/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.admin_review_parent_phone_request\(uuid,uuid,boolean\)\s+TO service_role/);
});

test("school data changes are streamed through one shared Supabase Realtime channel", async () => {
  const [live, paged, parent] = await Promise.all([
    read("src/lib/studentDataUpdates.js"),
    read("src/lib/usePagedQuery.js"),
    read("src/pages/ParentDashboard.jsx"),
  ]);
  assert.match(live, /supabase\.channel\(CHANNEL_NAME\)/);
  assert.match(live, /postgres_changes/);
  assert.match(live, /student_family_contacts/);
  assert.match(live, /student_guardians/);
  assert.match(live, /parent_phone_change_requests/);
  assert.match(live, /function stopRealtime\(\)/);
  assert.match(live, /setInterval/);
  assert.match(paged, /useLiveDataRevision/);
  assert.match(paged, /liveRevision\]\)/);
  assert.match(parent, /\.from\("profiles"\)/);
  assert.match(parent, /\.eq\("user_id", accountId\)/);
  assert.match(parent, /liveRevision/);
});

test("all 20 student avatar variants exist and share a single frame/crop style", async () => {
  const [component, css, assets] = await Promise.all([
    read("src/components/StudentAvatar.jsx"),
    read("src/pages/ParentDashboard.css"),
    readdir(new URL("../public/avatars/", import.meta.url)),
  ]);
  assert.match(component, /parent-student-avatar-image/);
  assert.match(component, /loading="lazy"/);
  assert.match(css, /\.parent-student-avatar-image/);
  assert.match(css, /object-position:center 45%/);
  assert.match(css, /transform:scale\(1\.06\)/);
  for (const gender of ["siswa", "siswi"]) {
    for (let index = 1; index <= 10; index += 1) {
      const filename = `${gender}-${String(index).padStart(2, "0")}.webp`;
      assert.ok(assets.includes(filename), `missing avatar asset ${filename}`);
    }
  }
});
