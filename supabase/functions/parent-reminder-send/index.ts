// Integrated backend source. Deployment status is recorded in the implementation report.
import { createClient } from "npm:@supabase/supabase-js@2.117.3";
import webpush from "npm:web-push@3.6.7";
import { inWindow, runReminders } from "./core.mjs";

type Device = { id: string; endpoint: string; p256dh: string; auth_key: string };

const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { "content-type": "application/json", "cache-control": "no-store" },
});
Deno.serve(async req => {
  if (req.method !== "POST") return reply({ error: "Metode tidak didukung" }, 405);
  const url = Deno.env.get("SUPABASE_URL") || "";
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!url || !key) return reply({ error: "Konfigurasi belum lengkap" }, 503);
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  // Rahasia dibuat acak di Supabase Vault dan tidak pernah masuk frontend,
  // GitHub, atau isi perintah Cron. Hanya backend service_role yang dapat
  // memvalidasinya. Bahkan dry-run/health-check wajib terautentikasi.
  const candidate = req.headers.get("x-reminder-secret") || "";
  if (candidate.length < 32 || candidate.length > 256) return reply({ error: "Tidak berwenang" }, 401);
  const { data: authorized, error: authError } = await db.rpc("verify_parent_reminder_secret", {
    p_candidate: candidate,
  });
  if (authError || authorized !== true) return reply({ error: "Tidak berwenang" }, 401);

  // Pada saat OFF, dry-run dan health-check boleh berjalan di luar jam 20.00;
  // keduanya tidak boleh mengirim push ataupun mengubah ledger pengiriman.
  const body = await req.json().catch(() => ({}));
  const dryRun = body?.dry_run !== false;
  if (!dryRun && !inWindow(new Date())) return reply({ error: "Jadwal hanya 20.00–20.15 WIB" }, 409);
  if (!dryRun && body?.confirm_send !== true) return reply({ error: "Konfirmasi pengiriman belum diberikan" }, 409);
  async function rpc(name: string, params: Record<string, unknown>) {
    const { data, error } = await db.rpc(name, params);
    if (error) throw new Error("database_operation_failed");
    if (name === "finish_parent_reminder_qa05" && data !== true) throw new Error("outcome_not_recorded");
    return data;
  }
  try {
    // Hanya ADMIN yang dapat mengubah setting; scheduler dan Edge harus sama-sama
    // melihat status aktif dan kesiapan. Semua nilai default adalah OFF.
    if (!dryRun) {
      const [settingResult, readinessResult] = await Promise.all([
        db.from("app_settings").select("value").eq("key", "daily_reminder").maybeSingle(),
        db.from("reminder_delivery_readiness").select("transport_ready").eq("id", true).maybeSingle(),
      ]);
      if (settingResult.error || settingResult.data?.value?.enabled !== true ||
          readinessResult.error || readinessResult.data?.transport_ready !== true) {
        return reply({ error: "Pengiriman belum diaktifkan atau belum siap" }, 409);
      }
    }

    if (body?.health_only === true && dryRun) {
      const pub = Deno.env.get("VAPID_PUBLIC_KEY") || "";
      const priv = Deno.env.get("VAPID_PRIVATE_KEY") || "";
      const subject = Deno.env.get("VAPID_SUBJECT") || "";
      const { error: devicesError } = await db.from("parent_push_subscriptions")
        .select("id", { head: true, count: "exact" });
      const { error: targetError } = await db.rpc("list_parent_reminder_targets_page", {
        p_date: new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" }),
        p_after: null, p_limit: 1,
      });
      if (devicesError || targetError) {
        return reply({ error: "Koneksi data pengingat belum siap" }, 503);
      }
      const configured = Boolean(pub && priv && subject);
      return reply({ success: configured, health_check: true,
        transport_ready: configured, sends_to_parents: false }, configured ? 200 : 503);
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
