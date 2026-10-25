import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const read=(p)=>readFile(new URL("../"+p,import.meta.url),"utf8");

test("Admin family editor removes manual linking and confirms shared phone before saving",async()=>{
 const [ui,dialog]=await Promise.all([
  read("src/pages/StudentFamily.jsx"),read("src/components/AppConfirmDialog.jsx")
 ]);
 assert.doesNotMatch(ui,/Hubungkan ke Akun|linkExistingAccount|admin_link_existing_parent/);
 assert.match(ui,/admin_preview_parent_family/);
 assert.match(ui,/async function checkSharedPhone\(type\)/);
 assert.match(ui,/onBlur=\{\(\) => void checkSharedPhone\(type\.id\)\}/);
 assert.match(ui,/approvedFamilyPhones/);
 assert.match(ui,/previewVersion\.current/);
 assert.match(ui,/saveAfter:false/);
 assert.match(ui,/admin_save_parent_family/);
 assert.match(ui,/familyConfirmation&&<AppConfirmDialog/);
 assert.match(ui,/Konfirmasi Nomor HP Keluarga/);
 assert.match(ui,/Apakah \$\{student\.full_name\} satu keluarga/);
 assert.match(ui,/Ya, Satu Keluarga/);
 assert.match(ui,/Tidak, Periksa Nomor/);
 assert.match(ui,/p_approved_matches: approvedMatches/);
 assert.match(ui,/if\(data\?\.success !== true\)/);
 assert.match(ui,/announceStudentDataChange\(\);\s*onClose\(\)/);
 assert.match(dialog,/aria-modal="true"/);
 assert.match(dialog,/data-time-theme=\{theme\}/);
});
test("Family confirmation works when phone already has an account and later activation claims siblings",async()=>{
 const sql=await read("supabase/migrations/20261025115600_confirmed_family_auto_link.sql");
 assert.match(sql,/CREATE TABLE IF NOT EXISTS public\.parent_family_consents/);
 assert.match(sql,/matched_student_id uuid NOT NULL REFERENCES public\.students\(id\) ON DELETE CASCADE/);
 assert.match(sql,/ALTER TABLE public\.parent_family_consents ENABLE ROW LEVEL SECURITY/);
 assert.match(sql,/REVOKE ALL ON public\.parent_family_consents FROM PUBLIC,anon,authenticated/);
 assert.match(sql,/CREATE OR REPLACE FUNCTION public\.admin_preview_parent_family/);
 assert.match(sql,/CREATE OR REPLACE FUNCTION public\.admin_save_parent_family/);
 assert.match(sql,/p_approved_matches @> pg_catalog\.jsonb_build_array/);
 assert.match(sql,/PERFORM public\.save_student_family_contacts/);
 assert.match(sql,/PERFORM public\.admin_link_existing_parent/);
 assert.match(sql,/CREATE TRIGGER confirmed_family_sibling_activation/);
 assert.match(sql,/AFTER INSERT ON public\.student_guardians/);
 assert.match(sql,/pg_catalog\.pg_trigger_depth\(\)>1/);
 assert.match(sql,/c\.phone=v_phone/);
 assert.match(sql,/fc\.phone=v_phone/);
 assert.match(sql,/public\.has_role\('admin'\)/);
 assert.match(sql,/family-contact-admin-confirmation/);
 assert.match(sql,/REVOKE EXECUTE ON FUNCTION public\.save_student_family_contacts/);
 assert.match(sql,/REVOKE EXECUTE ON FUNCTION public\.admin_link_existing_parent/);
 assert.match(sql,/public\.qa06_account_active\(\)/);
 assert.match(sql,/REVOKE ALL ON FUNCTION public\.admin_preview_parent_family\(uuid,jsonb\) FROM PUBLIC,anon/);
 assert.match(sql,/REVOKE ALL ON FUNCTION public\.admin_save_parent_family\(uuid,jsonb,jsonb\) FROM PUBLIC,anon/);
 assert.match(sql,/GRANT EXECUTE ON FUNCTION public\.admin_preview_parent_family\(uuid,jsonb\) TO authenticated/);
 assert.doesNotMatch(sql,/CREATE OR REPLACE FUNCTION public\.claim_parent_activation/);
 assert.doesNotMatch(sql,/CREATE OR REPLACE FUNCTION public\.complete_parent_activation/);
});
test("No same-number relation hijacking and old guardian access is removed after a phone change",async()=>{
 const sql=await read("supabase/migrations/20261025115600_confirmed_family_auto_link.sql");
 assert.match(sql,/Nomor HP sama tidak dapat digunakan untuk dua hubungan/);
 assert.match(sql,/DELETE FROM public\.parent_family_consents a WHERE/);
 assert.match(sql,/DELETE FROM public\.student_guardians sg\s+USING public\.profiles prof/);
 assert.match(sql,/AND prof\.user_id=sg\.guardian_id/);
 assert.match(sql,/ON CONFLICT\(student_id,guardian_id\) DO NOTHING/);
 assert.match(sql,/AND sg\.guardian_id<>NEW\.guardian_id/);
 assert.match(sql,/AND sg\.relationship<>v_row\.rel/);
});
test("Parent class card has breathing room in desktop and narrow phone layouts",async()=>{
 const css=await read("src/pages/Parents.css");
 assert.match(css,/padding:clamp\(16px,2\.2vw,24px\)/);
 assert.match(css,/\.parents-panel\{padding:16px 14px 18px\}/);
 assert.match(css,/\.parents-table-wrapper tr\{padding:17px 16px/);
 assert.match(css,/\.parents-class-heading\{padding:13px 16px\}/);
 assert.match(css,/var\(--sa-(accent|ink)/);
});

test("newly discovered siblings require a fresh explicit confirmation, never blanket phone approval",async()=>{
 const [ui,sql]=await Promise.all([
   read("src/pages/StudentFamily.jsx"),
   read("supabase/migrations/20261025123800_family_approval_exact_siblings.sql")
 ]);
 assert.match(ui,/function issueApproval\(item\)/);
 assert.match(ui,/students:\(item\.students\|\|\[\]\)\.map\(other=>\(\{id:other\.id,relationship:other\.relationship\}\)\)/);
 assert.match(ui,/function approvalCoversIssue\(approval,item\)/);
 assert.match(ui,/\.every\(other=>\(approval\.students\|\|\[\]\)\.some/);
 assert.match(ui,/function combineApprovals\(previous,additional\)/);
 assert.match(sql,/v_expected_students jsonb/);
 assert.match(sql,/FROM pg_catalog\.jsonb_array_elements\(v_issue\.value->'students'\) AS x\(value\)/);
 assert.match(sql,/'students',v_expected_students/);
 assert.match(sql,/p_approved_matches @> pg_catalog\.jsonb_build_array/);
 assert.match(sql,/REVOKE ALL ON FUNCTION public\.admin_save_parent_family/);
});
