
import { supabase } from "./supabase";
import { detachPushDevice } from "./pushDevice";

export function normalizeLoginIdentifier(value) {
  const raw = String(value || "").trim().toLowerCase();

  if (/^[a-z][a-z0-9._-]{3,23}$/.test(raw)) return raw;

  const phone = raw.replace(/\D/g, "");
  return phone.startsWith("62") ? `0${phone.slice(2)}` : phone;
}

export async function signIn(identifier, password) {
  const normalized = normalizeLoginIdentifier(identifier);

  if (
    !/^[a-z][a-z0-9._-]{3,23}$/.test(normalized) &&
    !/^08\d{8,11}$/.test(normalized)
  ) {
    throw new Error("Masukkan nama pengguna atau nomor HP yang valid.");
  }

  if (!password) {
    throw new Error("Kata sandi wajib diisi.");
  }

  const { data, error } = await supabase.functions.invoke(
    "login-username",
    {
      body: {
        identifier: normalized,
        password,
      },
    }
  );

  if (error) {
    let message = "Gagal menghubungkan ke server login.";

    if (error.context) {
      try {
        const result = await error.context.json();

        if (result?.error) {
          message = result.error;
        }
      } catch {
        // Respons error tidak selalu berbentuk JSON.
      }
    }

    throw new Error(message);
  }

  if (!data?.access_token || !data?.refresh_token) {
    throw new Error("Respons login tidak valid.");
  }

  const { data: sessionData, error: sessionError } =
    await supabase.auth.setSession({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
    });

  if (sessionError) {
    throw sessionError;
  }

  return sessionData;
}

export async function getCurrentAccount({ rejectNetworkErrors = false } = {}) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (rejectNetworkErrors && userError && (
    userError.name === "AuthRetryableFetchError" || userError.status === 0 ||
    userError.status >= 500 || userError instanceof TypeError
  )) {
    throw new Error("Koneksi akun belum dapat diverifikasi.");
  }

  if (userError || !user) {
    return null;
  }

  const [profileResult, rolesResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, phone, account_status")
      .eq("user_id", user.id)
      .single(),

    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id),
  ]);

  if (profileResult.error || rolesResult.error) {
    throw new Error(
      "Gagal membaca profil atau hak akses akun."
    );
  }

  if (profileResult.data.account_status !== "active") {
    await supabase.auth.signOut();

    throw new Error("Akun tidak aktif.");
  }

  return {
    id: user.id,
    name: profileResult.data.full_name,
    phone: profileResult.data.phone || null,
    roles: rolesResult.data.map((item) => item.role),
  };
}

export async function signOut() {
  // Remove this browser delivery channel before ending the account session.
  await detachPushDevice();
  const { error } = await supabase.auth.signOut();

  if (error) {
    throw error;
  }
}
