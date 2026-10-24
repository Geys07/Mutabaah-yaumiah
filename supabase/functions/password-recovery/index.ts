
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const SUPABASE_URL =
  Deno.env.get("SUPABASE_URL") ?? "";

const SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const RESET_PEPPER =
  Deno.env.get("PASSWORD_RESET_PEPPER") ?? "";

const db = createClient(
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

type Body = Record<string, unknown>;

type Profile = {
  user_id: string;
  account_status: string;
};

type ResetRecord = {
  id: string;
  user_id: string;
  status: string;
};

function respond(
  value: Record<string, unknown>,
  status = 200
): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: HEADERS,
  });
}

function normalizePhone(value: unknown): string {
  const digits = String(value ?? "").replace(/\D/g, "");

  return digits.startsWith("62")
    ? `0${digits.slice(2)}`
    : digits;
}

function normalizeCode(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function validPhone(value: string): boolean {
  return /^08[0-9]{8,11}$/.test(value);
}

function validCode(value: string): boolean {
  return /^[a-z]{4}$/.test(value);
}

function validPassword(
  value: unknown
): value is string {
  return (
    typeof value === "string" &&
    value.length >= 10 &&
    value.length <= 72
  );
}

function validUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value
    )
  );
}

async function sha256(value: string): Promise<string> {
  const encoded = new TextEncoder().encode(value);

  const digest = await crypto.subtle.digest(
    "SHA-256",
    encoded
  );

  return Array.from(new Uint8Array(digest))
    .map((byte) =>
      byte.toString(16).padStart(2, "0")
    )
    .join("");
}

async function hashCode(
  requestId: string,
  userId: string,
  code: string
): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(RESET_PEPPER),
    {
      name: "HMAC",
      hash: "SHA-256",
    },
    false,
    ["sign"]
  );

  const text = `${requestId}:${userId}:${code}`;

  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(text)
  );

  return Array.from(new Uint8Array(signature))
    .map((byte) =>
      byte.toString(16).padStart(2, "0")
    )
    .join("");
}

function generateCode(): string {
  let code = "";

  while (code.length < 4) {
    const bytes = crypto.getRandomValues(
      new Uint8Array(8)
    );

    for (const byte of bytes) {
      if (byte >= 234) continue;

      code += String.fromCharCode(
        97 + (byte % 26)
      );

      if (code.length === 4) break;
    }
  }

  return code;
}

function getClientIp(request: Request): string {
  const forwarded =
    request.headers.get("x-forwarded-for") ?? "";

  return (
    forwarded.split(",")[0].trim().slice(0, 100) ||
    request.headers.get("cf-connecting-ip") ||
    "unknown"
  );
}

async function rateLimit(key: string): Promise<boolean> {
  const hashed = await sha256(key);

  const { data, error } = await db.rpc(
    "check_login_rate_limit",
    {
      p_key: hashed,
    }
  );

  if (error) {
    console.error(
      "Pembatasan percobaan gagal:",
      error.message
    );

    return false;
  }

  return data === true;
}

async function checkLimits(
  request: Request,
  action: string,
  phone: string
): Promise<boolean> {
  const ipAllowed = await rateLimit(
    `password-recovery:${action}:ip:${getClientIp(request)}`
  );

  const phoneAllowed = await rateLimit(
    `password-recovery:${action}:phone:${phone}`
  );

  return ipAllowed && phoneAllowed;
}

async function findAccount(
  phone: string
): Promise<Profile | null> {
  const { data, error } = await db
    .from("profiles")
    .select("user_id, account_status")
    .eq("phone", phone)
    .maybeSingle();

  if (error) throw error;

  return data;
}

async function isAdmin(
  userId: string
): Promise<boolean> {
  const [roleResult, profileResult] =
    await Promise.all([
      db
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "admin")
        .maybeSingle(),

      db
        .from("profiles")
        .select("account_status")
        .eq("user_id", userId)
        .maybeSingle(),
    ]);

  if (
    roleResult.error ||
    profileResult.error
  ) {
    throw new Error(
      "Gagal memeriksa hak akses."
    );
  }

  return (
    Boolean(roleResult.data) &&
    profileResult.data?.account_status === "active"
  );
}

async function getAdminId(
  request: Request
): Promise<string | null> {
  const authorization =
    request.headers.get("authorization") ?? "";

  if (!authorization.startsWith("Bearer ")) {
    return null;
  }

  const token = authorization.slice(7).trim();

  if (!token) return null;

  const { data, error } =
    await db.auth.getUser(token);

  if (error || !data.user) {
    return null;
  }

  return (await isAdmin(data.user.id))
    ? data.user.id
    : null;
}

// Kirim hanya ketika permintaan BARU berhasil dibuat. Tidak ada nomor HP,
// nama pengguna ataupun kode pemulihan di dalam push.
async function notifyAdminsOfResetRequest(): Promise<void> {
  const publicKey = Deno.env.get("VAPID_PUBLIC_KEY") || "";
  const privateKey = Deno.env.get("VAPID_PRIVATE_KEY") || "";
  const subject = Deno.env.get("VAPID_SUBJECT") || "";
  if (!publicKey || !privateKey || !subject) return;

  try {
    const { data: admins, error: roleError } = await db
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");
    if (roleError || !admins?.length) return;

    const ids = [...new Set(admins.map((admin) => admin.user_id))];
    const { data: active, error: accountError } = await db
      .from("profiles")
      .select("user_id")
      .in("user_id", ids)
      .eq("account_status", "active");
    if (accountError || !active?.length) return;

    const activeIds = active.map((item) => item.user_id);
    const { data: devices, error: deviceError } = await db
      .from("admin_push_subscriptions")
      .select("id,user_id,endpoint,p256dh,auth_key")
      .in("user_id", activeIds)
      .limit(500);
    if (deviceError || !devices?.length) return;

    webpush.setVapidDetails(subject, publicKey, privateKey);
    const message = JSON.stringify({
      title: "Mutabaah Yaumiah",
      body: "Ada permintaan lupa kata sandi baru. Periksa Notifikasi > Permintaan Akun.",
      tag: "permintaan-pemulihan-akun",
      url: "/",
    });

    await Promise.allSettled(devices.map(async (device) => {
      try {
        await webpush.sendNotification(
          { endpoint: device.endpoint, keys: {
            p256dh: device.p256dh, auth: device.auth_key,
          } },
          message,
          { TTL: 3600, timeout: 5000 }
        );
      } catch (error) {
        const status = (error as { statusCode?: number } | null)?.statusCode;
        if (status === 404 || status === 410) {
          await db.from("admin_push_subscriptions")
            .delete().eq("id", device.id).eq("user_id", device.user_id);
        }
        // Gagal push tidak membatalkan permintaan pemulihan yang telah tercatat.
      }
    }));
  } catch {
    console.error("password-recovery: admin_push_failed");
  }
}

async function requestReset(
  request: Request,
  body: Body
): Promise<Response> {
  const phone = normalizePhone(body.phone);

  if (!validPhone(phone)) {
    return respond(
      { error: "Nomor HP tidak valid." },
      400
    );
  }

  if (
    !(await checkLimits(
      request,
      "request",
      phone
    ))
  ) {
    return respond(
      {
        error:
          "Terlalu banyak permintaan. Coba lagi dalam 15 menit.",
      },
      429
    );
  }

  const genericResult = {
    success: true,
    message:
      "Jika akun terdaftar, permintaan telah diterima.",
  };

  const account = await findAccount(phone);

  if (
    !account ||
    account.account_status !== "active" ||
    (await isAdmin(account.user_id))
  ) {
    return respond(genericResult);
  }

  const { data: existing, error: readError } =
    await db
      .from("password_reset_requests")
      .select("id")
      .eq("user_id", account.user_id)
      .in(
        "status",
        ["pending", "approved", "processing"]
      )
      .maybeSingle();

  if (readError) throw readError;

  if (existing) {
    return respond(genericResult);
  }

  const { error: insertError } = await db
    .from("password_reset_requests")
    .insert({
      user_id: account.user_id,
      status: "pending",
    });

  if (
    insertError &&
    insertError.code !== "23505"
  ) {
    throw insertError;
  }

  // Kode duplikat atau permintaan lama tidak boleh memicu push berulang.
  if (!insertError) {
    await notifyAdminsOfResetRequest();
  }

  return respond(genericResult);
}

async function reviewReset(
  request: Request,
  body: Body
): Promise<Response> {
  const adminId = await getAdminId(request);

  if (!adminId) {
    return respond(
      { error: "Akses admin diperlukan." },
      403
    );
  }

  const requestId = body.request_id;
  const decision = String(body.decision ?? "");

  if (
    !validUuid(requestId) ||
    !["approve", "reject", "revoke"].includes(
      decision
    )
  ) {
    return respond(
      { error: "Data keputusan tidak valid." },
      400
    );
  }

  const { data: record, error: readError } =
    await db
      .from("password_reset_requests")
      .select("id, user_id, status")
      .eq("id", requestId)
      .maybeSingle();

  if (readError) throw readError;

  if (!record) {
    return respond(
      { error: "Permintaan tidak ditemukan." },
      404
    );
  }

  if (record.user_id === adminId) {
    return respond(
      {
        error:
          "Admin tidak boleh memulihkan akunnya sendiri.",
      },
      403
    );
  }

  if (
    decision === "reject" ||
    decision === "revoke"
  ) {
    const requiredStatus =
      decision === "reject"
        ? "pending"
        : "approved";

    const newStatus =
      decision === "reject"
        ? "rejected"
        : "revoked";

    if (record.status !== requiredStatus) {
      return respond(
        {
          error:
            "Permintaan sudah diproses atau sedang digunakan.",
        },
        409
      );
    }

    const fields =
      decision === "reject"
        ? {
            status: newStatus,
            reviewed_by: adminId,
            reviewed_at:
              new Date().toISOString(),
          }
        : {
            status: newStatus,
            revoked_at:
              new Date().toISOString(),
            lock_reason:
              "Dicabut oleh admin",
          };

    const { data, error } = await db
      .from("password_reset_requests")
      .update(fields)
      .eq("id", requestId)
      .eq("status", requiredStatus)
      .select("id")
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      return respond(
        {
          error:
            "Permintaan telah diproses oleh pihak lain.",
        },
        409
      );
    }

    return respond({
      success: true,
      message:
        decision === "reject"
          ? "Permintaan ditolak."
          : "Kode pemulihan dicabut.",
    });
  }

  if (record.status !== "pending") {
    return respond(
      {
        error:
          "Permintaan tidak lagi menunggu persetujuan.",
      },
      409
    );
  }

  const code = generateCode();

  const code_hash = await hashCode(
    record.id,
    record.user_id,
    code
  );

  const { data: approved, error } =
    await db
      .from("password_reset_requests")
      .update({
        status: "approved",
        code_hash,
        code_attempts: 0,
        reviewed_by: adminId,
        reviewed_at:
          new Date().toISOString(),
      })
      .eq("id", requestId)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();

  if (error) throw error;

  if (!approved) {
    return respond(
      {
        error:
          "Permintaan sudah diproses oleh admin lain.",
      },
      409
    );
  }

  return respond({
    success: true,
    code,
    message:
      "Permintaan disetujui. Salin kode sekarang.",
  });
}

async function redeemReset(
  request: Request,
  body: Body
): Promise<Response> {
  const phone = normalizePhone(body.phone);
  const code = normalizeCode(body.code);
  const password = body.password;

  if (!validPhone(phone)) {
    return respond(
      { error: "Nomor HP tidak valid." },
      400
    );
  }

  if (!validCode(code)) {
    return respond(
      { error: "Kode harus terdiri dari 4 huruf." },
      400
    );
  }

  if (!validPassword(password)) {
    return respond(
      {
        error:
          "Kata sandi harus terdiri dari 10–72 karakter.",
      },
      400
    );
  }

  if (
    !(await checkLimits(
      request,
      "redeem",
      phone
    ))
  ) {
    return respond(
      {
        error:
          "Terlalu banyak percobaan. Coba lagi dalam 15 menit.",
      },
      429
    );
  }

  const account = await findAccount(phone);

  if (
    !account ||
    account.account_status !== "active" ||
    (await isAdmin(account.user_id))
  ) {
    return respond(
      {
        error:
          "Kode pemulihan tidak valid atau tidak aktif.",
      },
      400
    );
  }

  const { data: record, error: readError } =
    await db
      .from("password_reset_requests")
      .select("id, user_id, status")
      .eq("user_id", account.user_id)
      .eq("status", "approved")
      .maybeSingle();

  if (readError) throw readError;

  if (!record) {
    return respond(
      {
        error:
          "Kode pemulihan tidak valid atau sedang diproses.",
      },
      400
    );
  }

  const providedHash = await hashCode(
    record.id,
    record.user_id,
    code
  );

  const processingId = crypto.randomUUID();

  // RPC mengunci baris database secara atomik.
  // Hanya satu permintaan yang boleh
  // memperoleh status processing.
  const { data: claimResult, error: claimError } =
    await db.rpc(
      "claim_password_reset_code",
      {
        p_request_id: record.id,
        p_user_id: account.user_id,
        p_code_hash: providedHash,
        p_processing_id: processingId,
      }
    );

  if (claimError) {
    throw claimError;
  }

  if (claimResult !== "claimed") {
    return respond(
      {
        error:
          claimResult === "revoked"
            ? "Kode dibatalkan karena terlalu banyak percobaan salah. Hubungi admin."
            : "Kode tidak valid atau sedang diproses.",
      },
      claimResult === "revoked" ? 403 : 400
    );
  }

  // Setelah claim berhasil, permintaan lain
  // tidak bisa mengambil kode yang sama.
  let passwordUpdated = false;

  try {
    const { error: updateError } =
      await db.auth.admin.updateUserById(
        account.user_id,
        {
          password,
        }
      );

    if (updateError) {
      throw updateError;
    }

    passwordUpdated = true;
  } catch (authError) {
    console.error(
      "Pembaruan Auth gagal:",
      authError
    );
  }

  const { data: finished, error: finishError } =
    await db.rpc(
      "finish_password_reset_code",
      {
        p_request_id: record.id,
        p_processing_id: processingId,
        p_success: passwordUpdated,
      }
    );

  if (finishError || finished !== true) {
    console.error(
      "Finalisasi pemulihan gagal:",
      finishError?.message
    );

    return respond(
      {
        error: passwordUpdated
          ? "Kata sandi mungkin sudah diperbarui, tetapi pencatatan belum selesai. Coba login dengan kata sandi baru dan hubungi admin bila perlu."
          : "Pemulihan belum selesai. Hubungi admin sekolah.",
      },
      500
    );
  }

  if (!passwordUpdated) {
    return respond(
      {
        error:
          "Gagal memperbarui kata sandi. Kode tetap aktif; silakan coba kembali.",
      },
      500
    );
  }

  return respond({
    success: true,
    message:
      "Kata sandi berhasil diperbarui. Silakan masuk kembali.",
  });
}

Deno.serve(
  async (request: Request): Promise<Response> => {
    if (request.method === "OPTIONS") {
      return respond({});
    }

    if (request.method !== "POST") {
      return respond(
        { error: "Metode tidak diizinkan." },
        405
      );
    }

    try {
      if (
        !SUPABASE_URL ||
        !SERVICE_ROLE_KEY ||
        RESET_PEPPER.length < 32
      ) {
        console.error(
          "Konfigurasi password-recovery tidak lengkap."
        );

        return respond(
          {
            error:
              "Konfigurasi server belum lengkap.",
          },
          500
        );
      }

      let body: Body;

      try {
        const parsed = await request.json();

        if (
          !parsed ||
          typeof parsed !== "object" ||
          Array.isArray(parsed)
        ) {
          return respond(
            { error: "Data tidak valid." },
            400
          );
        }

        body = parsed;
      } catch {
        return respond(
          { error: "Data tidak valid." },
          400
        );
      }

      const action = String(
        body.action ?? ""
      );

      if (action === "request") {
        return await requestReset(
          request,
          body
        );
      }

      if (action === "review") {
        return await reviewReset(
          request,
          body
        );
      }

      if (action === "redeem") {
        return await redeemReset(
          request,
          body
        );
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
        "password-recovery:",
        error
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
