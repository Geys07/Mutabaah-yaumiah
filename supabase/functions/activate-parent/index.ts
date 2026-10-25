
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const admin = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};

function respond(
  body: Record<string, unknown>,
  status = 200
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers,
  });
}

function normalizePhone(value: unknown): string {
  const raw = String(value ?? "").replace(/\D/g, "");

  if (raw.startsWith("62")) {
    return `0${raw.slice(2)}`;
  }

  return raw;
}

function normalizeName(value: unknown): string {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ");
}

async function hashKey(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);

  const digest = await crypto.subtle.digest(
    "SHA-256",
    bytes
  );

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function checkLimit(
  key: string
): Promise<boolean> {
  const hashed = await hashKey(key);

  const { data, error } = await admin.rpc(
    "check_login_rate_limit",
    {
      p_key: hashed,
    }
  );

  return !error && data === true;
}

Deno.serve(async (request: Request): Promise<Response> => {
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
      !SUPABASE_SERVICE_ROLE_KEY
    ) {
      return respond(
        { error: "Konfigurasi server belum lengkap." },
        500
      );
    }

    let body: Record<string, unknown>;

    try {
      body = await request.json();
    } catch {
      return respond(
        { error: "Permintaan tidak valid." },
        400
      );
    }

    const fullName = normalizeName(
      body.full_name ?? body.name
    );

    const phone = normalizePhone(body.phone);

    const code = String(body.code ?? "")
      .trim()
      .toLowerCase();

    const password = body.password;

    if (fullName.length < 2 || fullName.length > 150) {
      return respond(
        { error: "Nama harus terdiri dari 2–150 karakter." },
        400
      );
    }

    if (!/^08[0-9]{8,11}$/.test(phone)) {
      return respond(
        { error: "Nomor HP tidak valid." },
        400
      );
    }

    if (!/^[a-z]{4}$/.test(code)) {
      return respond(
        { error: "Kode aktivasi harus 4 huruf." },
        400
      );
    }

    if (
      typeof password !== "string" ||
      password.length < 6 ||
      password.length > 72
    ) {
      return respond(
        {
          error:
            "Kata sandi harus terdiri dari 6–72 karakter.",
        },
        400
      );
    }

    // Membatasi percobaan aktivasi sebelum membaca kode.
    const forwarded =
      request.headers.get("x-forwarded-for") ?? "";

    const clientIp = forwarded
      .split(",")[0]
      .trim()
      .slice(0, 100) || "unknown";

    const allowedIp = await checkLimit(
      `activate-parent-ip:${clientIp}`
    );

    if (!allowedIp) {
      return respond(
        {
          error:
            "Terlalu banyak percobaan. Coba lagi dalam 15 menit.",
        },
        429
      );
    }

    const allowedPhone = await checkLimit(
      `activate-parent-phone:${phone}`
    );

    if (!allowedPhone) {
      return respond(
        {
          error:
            "Terlalu banyak percobaan. Coba lagi dalam 15 menit.",
        },
        429
      );
    }

    const { data: activation, error: activationError } =
      await admin
        .from("parent_activation_codes")
        .select(
          "id, student_id, relationship, phone, used_at, expires_at"
        )
        .eq("phone", phone)
        .eq("code", code)
        .is("used_at", null)
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();

    if (activationError || !activation) {
      return respond(
        {
          error:
            "Nomor HP atau kode aktivasi tidak valid.",
        },
        400
      );
    }

    // Kode harus tetap sesuai dengan kontak yang
    // tercatat pada data keluarga siswa.
    const { data: familyContact, error: familyError } =
      await admin
        .from("student_family_contacts")
        .select("id")
        .eq("student_id", activation.student_id)
        .eq("relationship", activation.relationship)
        .eq("phone", phone)
        .maybeSingle();

    if (familyError || !familyContact) {
      return respond(
        {
          error:
            "Kode tidak sesuai dengan data keluarga.",
        },
        400
      );
    }

    const { data: existing, error: existingError } =
      await admin
        .from("profiles")
        .select("user_id")
        .eq("phone", phone)
        .maybeSingle();

    if (existingError) {
      return respond(
        {
          error:
            "Tidak dapat memeriksa akun saat ini.",
        },
        500
      );
    }

    if (existing) {
      return respond(
        {
          error:
            "Nomor HP sudah memiliki akun. Silakan hubungi Admin madrasah untuk menghubungkan anak tambahan.",
        },
        409
      );
    }

    // Email internal digunakan untuk sistem Auth.
    // Pengguna tidak perlu mengetahui email ini.
    const internalEmail =
      `parent-${crypto.randomUUID()}@accounts.example.com`;

    const { data: created, error: createError } =
      await admin.auth.admin.createUser({
        email: internalEmail,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: fullName,
        },
      });

    if (createError || !created.user) {
      console.error(
        "Gagal membuat Auth orang tua:",
        createError?.message
      );

      return respond(
        { error: "Gagal membuat akun orang tua." },
        400
      );
    }

    const userId = created.user.id;

    // Fungsi database memeriksa ulang kode,
    // memasang peran parent, menghubungkan anak,
    // dan menandai kode sebagai sudah digunakan.
    const { data: studentId, error: linkError } =
      await admin.rpc(
        "complete_parent_activation",
        {
          p_phone: phone,
          p_code: code,
          p_user_id: userId,
          p_full_name: fullName,
        }
      );

    if (linkError || !studentId) {
      console.error(
        "Gagal menuntaskan aktivasi orang tua:",
        linkError?.message
      );

      const { error: cleanupError } =
        await admin.auth.admin.deleteUser(userId);

      if (cleanupError) {
        console.error(
          "Gagal membersihkan akun sementara:",
          cleanupError.message
        );
      }

      return respond(
        {
          error:
            "Aktivasi gagal. Kode mungkin telah digunakan atau kedaluwarsa.",
        },
        400
      );
    }

    return respond({
      success: true,
      message:
        "Akun orang tua berhasil diaktifkan. Silakan masuk menggunakan nomor HP dan kata sandi.",
      student_id: studentId,
    });
  } catch (error) {
    console.error("activate-parent:", error);

    return respond(
      { error: "Terjadi gangguan server." },
      500
    );
  }
});
