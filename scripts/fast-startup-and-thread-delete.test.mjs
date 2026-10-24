import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import { spawnSync } from "node:child_process";
const read=(name)=>readFile(new URL("../"+name,import.meta.url),"utf8");

test("opening splash ends after approximately five seconds rather than 10–18 seconds", async()=>{
 const app=await read("src/App.jsx");
 assert.match(app,/const readingMs = session === 0 \? 4300 : 250;/);
 assert.match(app,/setPhase\("exiting"\),\s*240/);
 assert.match(app,/setLoading\(false\),\s*460/);
 assert.doesNotMatch(app,/18000|10000|9500\s*\+/);
 assert.match(app,/const dataReady = bootReady;/);
 assert.match(app,/PanelReadyGate/);
});

test("login avoids repeated Auth getUser request after successful setSession", async()=>{
 const [app,auth,edge]=await Promise.all([
  read("src/App.jsx"),read("src/lib/auth.js"),
  read("supabase/functions/login-username/index.ts"),
 ]);
 assert.match(app,/const authenticated = await signIn/);
 assert.match(app,/verifiedUser: authenticated\?\.user/);
 assert.match(auth,/verifiedUser = null/);
 assert.match(auth,/verifiedUser\s*\? \{ data: \{ user: verifiedUser \}, error: null \}/);
 assert.match(auth,/account_status !== "active"/);
 assert.match(auth,/\.from\("user_roles"\)/);
 assert.match(edge,/check_login_rate_limit/);
 assert.match(edge,/const \[userLookup,roleLookup,adminProfileLookup\]=await Promise\.all/);
 assert.match(edge,/adminProfileLookup\.data\?\.account_status!=="active"/);
 assert.match(edge,/client\.auth\.signInWithPassword/);
 const transformed=stripTypeScriptTypes(edge);
 const valid=spawnSync(process.execPath,["--check","--input-type=module"],{input:transformed,encoding:"utf8"});
 assert.equal(valid.status,0,valid.stderr);
});

test("deleting a whole chat requires terminal ticket and keeps recovery audit",async()=>{
 const [edge,admin,sql]=await Promise.all([
  read("supabase/functions/recovery-chat/index.ts"),
  read("src/pages/AdminRecoveryChats.jsx"),
  read("supabase/migrations/20261024180000_recovery_chat_tickets.sql"),
 ]);
 assert.match(edge,/\["used","rejected","revoked"\]\.includes\(request\.status\)/);
 assert.match(edge,/\.from\("recovery_chat_tickets"\)\s*\.delete\(\)/);
 assert.doesNotMatch(edge,/\.from\("password_reset_requests"\)\s*\.delete\(\)\.eq\("id",ticket\.request_id\)/);
 assert.match(admin,/aria-label="Hapus seluruh percakapan"/);
 assert.doesNotMatch(admin,/Hapus pesan untuk Admin/);
 assert.match(sql,/REFERENCES public\.recovery_chat_tickets\(id\) ON DELETE CASCADE/);
});
