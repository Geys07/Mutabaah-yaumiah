// Integrated backend source. Deployment status is recorded in the implementation report.
import { createClient } from "npm:@supabase/supabase-js@2.117.3";
import webpush from "npm:web-push@3.6.7";
import { inWindow, runReminders } from "./core.mjs";

type Device = { id: string; endpoint: string; p256dh: string; auth_key: string };

const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { "content-type": "application/json", "cache-control": "no-store" },
});
function sameSecret(a: string, b: string) {
  const aa = new TextEncoder().encode(a), bb = new TextEncoder().encode(b);
  let diff = aa.length ^ bb.length;
  for (let i = 0; i < Math.max(aa.length, bb.length); i++) diff |= (aa[i] || 0) ^ (bb[i] || 0);
  return diff === 0;
}
Deno.serve(async req => {
  if (req.method !== "POST") return reply({ error: "Metode tidak didukung" }, 405);
  const secret = Deno.env.get("PARENT_REMINDER_SECRET") || "";
  if (secret.length < 32 || !sameSecret(secret, req.headers.get("x-reminder-secret") || "")) return reply({ error: "Tidak berwenang" }, 401);
  if (!inWindow(new Date())) return reply({ error: "Jadwal hanya 20.00–20.15 WIB" }, 409);
  // Default OFF. A dry run only reads targets and cannot send, claim or delete.
  const enabled = Deno.env.get("PARENT_REMINDER_ENABLED") === "true";
  const body = await req.json().catch(() => ({}));
  const dryRun = body?.dry_run !== false;
  if (!dryRun && body?.confirm_send !== true) return reply({ error: "Konfirmasi pengiriman belum diberikan" }, 409);
  if (!dryRun && !enabled) return reply({ error: "Pengiriman belum diaktifkan" }, 409);
  const url = Deno.env.get("SUPABASE_URL") || "";
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!url || !key) return reply({ error: "Konfigurasi belum lengkap" }, 503);
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  async function rpc(name: string, params: Record<string, unknown>) {
    const { data, error } = await db.rpc(name, params);
    if (error) throw new Error("database_operation_failed");
    if (name === "finish_parent_reminder_qa05" && data !== true) throw new Error("outcome_not_recorded");
    return data;
  }
  try {
    // Fail closed: both the environment switch and the persisted switch must allow sending.
    // Read-only dry-run remains available while delivery is OFF.
    if (!dryRun) {
      const { data: setting, error: settingError } = await db.from("app_settings")
        .select("value").eq("key", "daily_reminder").maybeSingle();
      if (settingError || setting?.value?.enabled !== true) {
        return reply({ error: "Pengiriman belum diaktifkan" }, 409);
      }
    }
    const { jakartaTime } = await import("./core.mjs");
    const date = jakartaTime().date;
    if (dryRun) {
      let cursor: string | null = null, eligible = 0;
      for (;;) {
        const rows = await rpc("list_parent_reminder_targets_page", { p_date: date, p_after: cursor, p_limit: 500 });
        eligible += rows.length;
        if (rows.length < 500) break;
        cursor = rows[rows.length - 1].guardian_id;
      }
      return reply({ dry_run: true, reminder_date: date, eligible, sent: 0 });
    }
    const pub = Deno.env.get("VAPID_PUBLIC_KEY") || "", priv = Deno.env.get("VAPID_PRIVATE_KEY") || "", subject = Deno.env.get("VAPID_SUBJECT") || "";
    if (!pub || !priv || !subject) return reply({ error: "Konfigurasi push belum lengkap" }, 503);
    webpush.setVapidDetails(subject, pub, priv);
    const result = await runReminders({
      targets: (d: string, after: string | null, limit: number) => rpc("list_parent_reminder_targets_page", { p_date: d, p_after: after, p_limit: limit }),
      claim: (g: string, d: string) => rpc("claim_parent_reminder_qa05", { p_guardian: g, p_date: d }),
      pending: (g: string, d: string) => rpc("parent_reminder_pending_qa05", { p_guardian: g, p_date: d }),
      begin: (g: string, d: string, token: string) => rpc("begin_parent_reminder_qa05", { p_guardian: g, p_date: d, p_token: token }),
      finish: (g: string, d: string, token: string, status: string, safe: boolean, code: string | null) => rpc("finish_parent_reminder_qa05", { p_guardian: g, p_date: d, p_token: token, p_status: status, p_safe: safe, p_code: code }),
      devices: async (g: string) => {
        const rows: Device[] = [];
        let after: string | null = null;
        for (;;) {
          let query = db.from("parent_push_subscriptions").select("id,endpoint,p256dh,auth_key").eq("guardian_id", g).order("id").limit(500);
          if (after) query = query.gt("id", after);
          const { data, error } = await query;
          if (error) throw new Error("device_read_failed");
          rows.push(...data);
          if (data.length < 500) return rows;
          after = data[data.length - 1].id;
        }
      },
      send: (device: Device, payload: string) => webpush.sendNotification({ endpoint: device.endpoint, keys: { p256dh: device.p256dh, auth: device.auth_key } }, payload, { TTL: 3600, urgency: "normal", timeout: 5000 }),
      expire: async (device: Device) => {
        const { error } = await db.from("parent_push_subscriptions").delete().eq("id", device.id);
        if (error) throw new Error("expire_failed");
      },
    });
    return reply({ success: true, ...result });
  } catch {
    console.error("parent-reminder-send: batch_operation_failed");
    return reply({ error: "Pengiriman belum selesai. Periksa ringkasan dan status klaim." }, 500);
  }
});
