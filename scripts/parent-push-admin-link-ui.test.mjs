import {test} from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
const read=(file)=>readFile(new URL("../"+file,import.meta.url),"utf8");

test("once app notification permission is granted, parent popup does not reappear",async()=>{
 const [prompt,push,hook]=await Promise.all([
  read("src/components/ParentNotificationControls.jsx"),
  read("src/lib/pushDevice.js"),
  read("src/hooks/usePushDevice.js")
 ]);
 assert.match(prompt,/Notification\.permission !== "default"/);
 assert.match(prompt,/Notification\.permission === "granted"/);
 assert.match(prompt,/usePushDevice\("parent", Boolean\(userId && authorizedParentId === userId\)\)/);
 assert.match(push,/localStorage\.getItem\(OPT_IN_KEY\(kind,id\)\) !== "0"/);
 assert.match(push,/localStorage\.setItem\(OPT_IN_KEY\(kind,id\), "0"\)/);
 assert.match(hook,/prefersPushDevice\(kind,id\)/);
 assert.match(push,/export function reconnectPushDevice/);
 assert.match(hook,/await reconnectPushDevice\(kind,id,context\)/);
});
test("existing child claims are moved from parent panel into Admin contacts with security",async()=>{
 const [parent,admin,contacts,sql,activation]=await Promise.all([
  read("src/pages/ParentDashboard.jsx"),read("src/pages/Parents.jsx"),
  read("src/pages/StudentFamily.jsx"),
  read("supabase/migrations/20261025103000_admin_link_existing_parent.sql"),
  read("supabase/functions/activate-parent/index.ts"),
 ]);
 assert.doesNotMatch(parent,/claim-parent|openLink\(|linkChild\(|pd-link-modal|Hubungkan Anak/);
 assert.match(parent,/Hubungi Admin madrasah/);
 assert.match(parent,/useLiveDataRevision\(\)/);
 assert.match(admin,/linkedContacts:student\.contacts/);
 assert.match(contacts,/admin_preview_parent_family/);
 assert.match(contacts,/admin_save_parent_family/);
 assert.match(contacts,/familyConfirmation&&<AppConfirmDialog/);
 assert.match(contacts,/onClose\(\);/);
 assert.doesNotMatch(contacts,/Hubungkan ke Akun/);
 assert.match(sql,/public\.has_role\('admin'\)/);
 assert.match(sql,/public\.qa06_account_active\(\)/);
 assert.match(sql,/student_family_contacts fc/);
 assert.match(sql,/p\.phone=v_phone AND p\.account_status='active'/);
 assert.match(sql,/REVOKE ALL ON FUNCTION public\.claim_parent_activation\(text\)/);
 assert.match(sql,/FROM PUBLIC,anon,authenticated/);
 assert.match(activation,/complete_parent_activation/); // first child still works
 assert.match(activation,/hubungi Admin madrasah/);
});
test("new Mutabaah activity sort is automated and no technical sort controls clutter UI",async()=>{
 const activity=await read("src/pages/Activities.jsx");
 assert.match(activity,/function automaticSortOrder\(activity\)/);
 assert.match(activity,/const sort = automaticSortOrder\(form\)/);
 assert.match(activity,/sort_order: sort/);
 assert.doesNotMatch(activity,/<th>Urutan<\/th>/);
 assert.doesNotMatch(activity,/activity\.sort_order\}\s*<\/td>/);
});
test("mass activation icon is a meaningful account card rather than down arrow",async()=>{
 const [component,css]=await Promise.all([
  read("src/pages/ActivationBatch.jsx"),read("src/pages/ActivationBatch.css")
 ]);
 assert.match(component,/activation-batch-toggle-title/);
 assert.match(component,/activation-batch-toggle-action/);
 assert.match(component,/open \? "Tutup" : "Buka"/);
 assert.doesNotMatch(component,/activation-batch-chevron/);
 assert.match(css,/var\(--sa-accent/);
});
test("report signature table border removal is scoped to the last table only",async()=>{
 const report=await read("src/pages/ReportCards.jsx");
 assert.match(report,/function removeSignatureBorders\(table\)/);
 assert.match(report,/removeSignatureBorders\(tables\[tables\.length - 1\]\)/);
 assert.match(report,/edge\.setAttributeNS\(W,"w:val","nil"\)/);
 assert.match(report,/\.details th, \.details td \{ border: \.25pt solid/);
});
