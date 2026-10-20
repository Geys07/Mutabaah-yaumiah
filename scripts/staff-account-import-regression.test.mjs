import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const file=(name)=>readFileSync(new URL("../"+name,import.meta.url),"utf8");

test("parent login numeric and staff username available",()=>{
 const app=file("src/App.jsx"),auth=file("src/lib/auth.js");
 assert.match(app,/loginAs === "parent" \? "numeric" : "text"/);
 assert.match(app,/Nama Pengguna/);
 assert.match(auth,/\^\[a-z\]/);
 assert.match(auth,/login-username/);
});

test("staff manager supports both roles and guards identity",()=>{
 const staff=file("src/pages/TeacherAccounts.jsx");
 const admin=file("src/pages/AdminDashboard.jsx");
 const sql=file("supabase/migrations/20261020090146_staff_usernames_and_account_management.sql");
 assert.match(admin,/principal-accounts/);
 assert.match(admin,/role="principal"/);
 assert.match(staff,/manage_staff_account/);
 assert.match(staff,/username/);
 assert.match(sql,/profiles_staff_username_unique/);
 assert.match(sql,/has_role\('admin'\)/);
 assert.match(sql,/role<>p_role/);
});

test("student import uses one entry point and never deletes other students",()=>{
 const base=file("src/pages/StudentsBase.jsx");
 const admin=file("src/pages/StudentAdminTools.jsx");
 const modal=file("src/pages/StudentImport.jsx");
 assert.doesNotMatch(base,/StudentImport|Impor Excel|importOpen/);
 assert.match(admin,/Siapkan Impor/);
 assert.match(admin,/scope === "all"/);
 assert.match(admin,/scope === "grade7"/);
 assert.match(admin,/prepare_mutabaah_grade_seven/);
 assert.match(admin,/Data siswa lain tidak dihapus/);
 assert.match(modal,/import_students_atomic/);
});
