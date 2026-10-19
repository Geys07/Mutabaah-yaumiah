// Integrated backend source. Deployment status is recorded in the implementation report.

import { createClient } from "npm:@supabase/supabase-js@2";

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
