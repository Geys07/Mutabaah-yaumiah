import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const read = (file) => readFile(new URL("../" + file, import.meta.url), "utf8");

test("scheduler 20 WIB uses cron and Vault only, no hardcoded secret", async () => {
  const [sql, edge, core] = await Promise.all([
    read("supabase/migrations/20261022060000_daily_parent_reminder_cron_vault.sql"),
    read("supabase/functions/parent-reminder-send/index.ts"),
    read("supabase/functions/parent-reminder-send/core.mjs"),
  ]);
  assert.match(sql, /create extension if not exists pg_cron/i);
  assert.match(sql, /create extension if not exists pg_net/i);
  assert.match(sql, /'mutabaah_parent_reminder_2000_wib'/);
  assert.match(sql, /'0 13 \* \* \*'/);
  assert.match(sql, /vault\.create_secret\(/);
  assert.match(sql, /vault\.decrypted_secrets/);
  assert.match(sql, /verify_parent_reminder_secret/);
  assert.match(sql, /grant execute on function public\.verify_parent_reminder_secret\(text\) to service_role/);
  assert.match(sql, /a\.value->>'enabled' = 'true'/);
  assert.match(sql, /r\.transport_ready = true/);
  assert.match(sql, /\{"dry_run":false,"confirm_send":true\}/);
  assert.doesNotMatch(sql, /update\s+public\.app_settings\s+set\s+value/i);
  assert.doesNotMatch(sql, /update\s+public\.reminder_delivery_readiness\s+set\s+transport_ready/i);
  assert.match(edge, /verify_parent_reminder_secret/);
  assert.match(edge, /authorized !== true/);
  assert.match(edge, /if \(!dryRun && !inWindow\(new Date\(\)\)\)/);
  assert.match(edge, /settingResult\.data\?\.value\?\.enabled !== true/);
  assert.match(edge, /readinessResult\.data\?\.transport_ready !== true/);
  assert.match(edge, /health_only === true && dryRun/);
  assert.match(core, /if \(!inWindow\(started\)\)/);
  assert.match(core, /claim:|runReminders/);
});

test("mobile top bar displays clear app branding without changing page title", async () => {
  const [component, css] = await Promise.all([
    read("src/components/StaffWorkspace.jsx"),
    read("src/components/StaffWorkspace.css"),
  ]);
  assert.match(component, /staff-top-app-name/);
  assert.match(component, /school\?\.appName \|\| "Mutabaah Yaumiah"/);
  assert.match(component, /staff-top-role/);
  assert.match(css, /\.staff-top-title \.staff-top-app-name/);
  assert.match(css, /font-size: clamp\(15px, 4\.1vw, 18px\)/);
});
