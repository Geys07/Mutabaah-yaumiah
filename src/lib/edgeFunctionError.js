// Supabase FunctionsError.context tidak selalu berupa Response.
// Saat jaringan gagal / Edge Function belum hidup, context dapat berupa Error biasa.
export async function edgeFunctionErrorMessage(error, fallback = "Layanan sedang tidak tersedia. Coba kembali.") {
  const context = error?.context;
  let payload = null;
  if (context && typeof context.json === "function") {
    try {
      payload = await context.json();
    } catch {
      // Bisa berupa Response kosong, HTML dari gateway, atau gagal dibaca.
    }
  } else if (context && typeof context === "object") {
    payload = context;
  }

  const detail = payload?.error || payload?.message;
  if (typeof detail === "string" && detail.trim()) return detail.trim();

  const status = Number(context?.status);
  if (status === 503 || status === 502 || status === 504) {
    return "Layanan chat sementara tidak tersedia. Silakan coba lagi.";
  }
  if (status === 401 || status === 403) {
    return "Sesi Admin tidak berlaku atau tidak memiliki izin. Silakan masuk kembali.";
  }
  const original = typeof error?.message === "string" ? error.message.trim() : "";
  if (!original || /context|\.json|relay|fetch|network|non-2xx|edge function/i.test(original)) {
    return fallback;
  }
  return original;
}
