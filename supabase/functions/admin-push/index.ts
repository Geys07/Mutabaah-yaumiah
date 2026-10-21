// Integrated backend source. Deployment status is recorded in the implementation report.

import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";

const SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const VAPID_PUBLIC_KEY =
  Deno.env.get("VAPID_PUBLIC_KEY") ?? "";

const supabase = createClient(
  SUPABASE_URL,
  SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

const HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};

type PushSubscriptionData = {
  endpoint?: unknown;
  expirationTime?: unknown;
  keys?: {
    p256dh?: unknown;
    auth?: unknown;
  };
};

function respond(
  body: Record<string, unknown>,
  status = 200
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: HEADERS,
  });
}

async function getAdminId(
  request: Request
): Promise<string | null> {
  const header =
    request.headers.get("Authorization") ?? "";

  if (!header.startsWith("Bearer ")) {
    return null;
  }

  const token = header.slice(7).trim();

  if (!token) {
    return null;
  }

  const { data, error } =
    await supabase.auth.getUser(token);

  if (error || !data.user) {
    return null;
  }

  const userId = data.user.id;

  const [roleResult, profileResult] =
    await Promise.all([
      supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "admin")
        .maybeSingle(),

      supabase
        .from("profiles")
        .select("account_status")
        .eq("user_id", userId)
        .maybeSingle(),
    ]);

  if (
    roleResult.error ||
    profileResult.error ||
    !roleResult.data ||
    profileResult.data?.account_status !== "active"
  ) {
    return null;
  }

  return userId;
}

function validEndpoint(
  value: unknown
): value is string {
  if (
    typeof value !== "string" ||
    value.length < 20 ||
    value.length > 2048
  ) {
    return false;
  }

  try {
    const url = new URL(value);

    return (
      url.protocol === "https:" &&
      Boolean(url.hostname) &&
      !url.username &&
      !url.password &&
      !url.hash
    );
  } catch {
    return false;
  }
}

function validBase64UrlKey(
  value: unknown,
  min: number,
  max: number
): value is string {
  return (
    typeof value === "string" &&
    value.length >= min &&
    value.length <= max &&
    /^[A-Za-z0-9_-]+$/.test(value)
  );
}

Deno.serve(
  async (request: Request): Promise<Response> => {
    if (request.method === "OPTIONS") {
      return respond({});
    }

    if (request.method !== "POST") {
      return respond(
        {
          error: "Metode tidak diizinkan.",
        },
        405
      );
    }

    try {
      if (
        !SUPABASE_URL ||
        !SERVICE_ROLE_KEY ||
        !VAPID_PUBLIC_KEY
      ) {
        return respond(
          {
            error:
              "Konfigurasi push belum lengkap.",
          },
          500
        );
      }

      const adminId =
        await getAdminId(request);

      if (!adminId) {
        return respond(
          {
            error:
              "Akses hanya untuk admin aktif.",
          },
          403
        );
      }

      let body: Record<string, unknown>;

      try {
        const value = await request.json();

        if (
          !value ||
          typeof value !== "object" ||
          Array.isArray(value)
        ) {
          return respond(
            {
              error:
                "Format data tidak valid.",
            },
            400
          );
        }

        body = value;
      } catch {
        return respond(
          {
            error:
              "Format data tidak valid.",
          },
          400
        );
      }

      const action =
        String(body.action ?? "");

      if (action === "config") {
        return respond({
          success: true,
          public_key: VAPID_PUBLIC_KEY,
        });
      }

      if (action === "status") {
        const {
          count,
          error,
        } = await supabase
          .from("admin_push_subscriptions")
          .select("id", {
            count: "exact",
            head: true,
          })
          .eq("user_id", adminId);

        if (error) {
          throw error;
        }

        return respond({
          success: true,
          subscription_count: count ?? 0,
        });
      }

      if (action === "subscribe") {
        const subscription =
          body.subscription as
            | PushSubscriptionData
            | undefined;

        if (!subscription) {
          return respond(
            {
              error:
                "Data langganan tidak ditemukan.",
            },
            400
          );
        }

        const endpoint =
          subscription.endpoint;

        const p256dh =
          subscription.keys?.p256dh;

        const authKey =
          subscription.keys?.auth;

        if (
          !validEndpoint(endpoint) ||
          !validBase64UrlKey(
            p256dh,
            20,
            512
          ) ||
          !validBase64UrlKey(
            authKey,
            8,
            512
          )
        ) {
          return respond(
            {
              error:
                "Data langganan tidak valid.",
            },
            400
          );
        }

        const values = {
          user_id: adminId, endpoint, p256dh, auth_key: authKey,
          user_agent: String(request.headers.get("user-agent") || "").slice(0,500),
          updated_at: new Date().toISOString(), last_error: null,
        };
        // Insert-if-absent, then update ONLY the authenticated owner. Never
        // overwrite another owner via an endpoint-conflict upsert, even in a race.
        const { error: insertError } = await supabase.from("admin_push_subscriptions")
          .upsert(values, { onConflict: "endpoint", ignoreDuplicates: true });
        if (insertError?.code === "23505") return respond({error:"Perangkat terhubung ke akun lain."},409);
        if (insertError?.code === "42501") return respond({error:"Akun atau peran tidak aktif."},403);
        if (insertError) throw new Error("subscription_insert_failed");
        const { data: saved, error: saveError } = await supabase.from("admin_push_subscriptions")
          .update(values).eq("endpoint",endpoint).eq("user_id",adminId)
          .select("id").maybeSingle();
        if (saveError?.code === "23505") return respond({error:"Perangkat terhubung ke akun lain."},409);
        if (saveError?.code === "42501") return respond({error:"Akun atau peran tidak aktif."},403);
        if (saveError) throw new Error("subscription_save_failed");
        if (!saved) return respond({ error: "Perangkat terhubung ke akun lain." },409);

        return respond({
          success: true,
          message:
            "Notifikasi perangkat berhasil diaktifkan.",
        });
      }

      if (action === "test_reminder_push") {
        // Push uji ditujukan hanya kepada endpoint yang aktif dan dimiliki
        // pengguna admin yang terautentikasi. Tidak membaca perangkat wali.
        const endpoint = body.endpoint;
        if (!validEndpoint(endpoint)) {
          return respond({ error: "Perangkat admin tidak valid." }, 400);
        }

        const privateKey = Deno.env.get("VAPID_PRIVATE_KEY") || "";
        const subject = Deno.env.get("VAPID_SUBJECT") || "";
        if (!privateKey || !subject) {
          return respond({ error: "Konfigurasi pengiriman push belum lengkap." }, 503);
        }

        const { data: device, error: deviceError } = await supabase
          .from("admin_push_subscriptions")
          .select("id,endpoint,p256dh,auth_key,last_sent_at")
          .eq("user_id", adminId)
          .eq("endpoint", endpoint)
          .maybeSingle();
        if (deviceError) throw new Error("admin_device_lookup_failed");
        if (!device) {
          return respond({
            error: "Perangkat ini belum terdaftar untuk push Admin. Aktifkan notifikasi perangkat terlebih dahulu.",
          }, 404);
        }

        // Cooldown dijaga oleh update berkondisi untuk mencegah klik berulang
        // dari beberapa tab yang dapat memicu spam push bersamaan.
        const cutoff = new Date(Date.now() - 30000).toISOString();
        const { data: reserved, error: reserveError } = await supabase
          .from("admin_push_subscriptions")
          .update({ last_sent_at: new Date().toISOString(), last_error: null })
          .eq("id", device.id)
          .eq("user_id", adminId)
          .or(`last_sent_at.is.null,last_sent_at.lt.${cutoff}`)
          .select("id")
          .maybeSingle();
        if (reserveError) throw new Error("admin_push_rate_limit_failed");
        if (!reserved) {
          return respond({ error: "Tunggu 30 detik sebelum mengirim contoh berikutnya." }, 429);
        }

        webpush.setVapidDetails(subject, VAPID_PUBLIC_KEY, privateKey);
        const message = JSON.stringify({
          title: "Mutabaah Yaumiah — MTs Al-Khairiyah",
          body: "Pengisian Mutabaah ananda hari ini belum selesai. Silakan lengkapi dan finalisasi.",
          tag: "contoh-mutabaah-admin",
          url: "/",
        });
        try {
          await webpush.sendNotification({
            endpoint: device.endpoint,
            keys: { p256dh: device.p256dh, auth: device.auth_key },
          }, message, { TTL: 120, urgency: "normal", timeout: 8000 });
        } catch (sendError) {
          const expired = sendError?.statusCode === 404 || sendError?.statusCode === 410;
          await supabase.from("admin_push_subscriptions")
            .update({ last_error: expired ? "subscription_expired" : "sample_push_failed" })
            .eq("id", device.id).eq("user_id", adminId);
          return respond({
            error: expired
              ? "Langganan push perangkat sudah kedaluwarsa. Nonaktifkan lalu aktifkan kembali notifikasi admin."
              : "Layanan push belum menerima contoh. Periksa koneksi dan pengaturan izin notifikasi.",
          }, expired ? 410 : 502);
        }
        // Respons diterima penyedia Web Push, bukan bukti notifikasi dibaca.
        return respond({ success: true, accepted: true, target: "current_admin_device" });
      }

      if (action === "unsubscribe") {
        const endpoint =
          body.endpoint;

        if (!validEndpoint(endpoint)) {
          return respond(
            {
              error:
                "Alamat langganan tidak valid.",
            },
            400
          );
        }

        const {
          error: deleteError,
        } = await supabase
          .from("admin_push_subscriptions")
          .delete()
          .eq("user_id", adminId)
          .eq("endpoint", endpoint);

        if (deleteError) {
          throw deleteError;
        }

        return respond({
          success: true,
          message:
            "Notifikasi perangkat dinonaktifkan.",
        });
      }

      return respond(
        {
          error:
            "Tindakan tidak dikenal.",
        },
        400
      );
    } catch (error) {
      console.error(
        "admin-push:",
        "operation_failed"
      );

      return respond(
        {
          error:
            "Terjadi gangguan server.",
        },
        500
      );
    }
  }
);
