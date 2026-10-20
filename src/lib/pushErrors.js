/**
 * Provide predictable and privacy-safe feedback for Supabase Edge Function failures.
 * The server response body may contain sensitive diagnostics: never display it.
 */
export function pushErrorMessage(error, action) {
  const status = Number(error?.context?.status ?? error?.status ?? 0);
  if (status === 401) return "Sesi login telah berakhir. Silakan masuk kembali lalu coba lagi.";
  if (status === 403) return "Akun tidak aktif atau tidak memiliki izin mengelola notifikasi. Hubungi Admin jika perlu.";
  if (status === 409) {
    return action === "subscribe"
      ? "Perangkat ini sudah terdaftar pada akun lain. Nonaktifkan dari akun asal atau hubungi Admin."
      : "Permintaan notifikasi sedang mengalami konflik. Periksa status lalu coba lagi.";
  }
  if (status === 400 || status === 422) return "Data notifikasi perangkat tidak valid. Siapkan ulang notifikasi lalu coba lagi.";
  if (status === 429) return "Terlalu banyak percobaan. Coba lagi beberapa saat.";
  if (status === 500 || status === 502 || status === 503 || status === 504) {
    return "Layanan notifikasi sedang bermasalah. Coba lagi beberapa saat.";
  }
  if (error?.name === "FunctionsFetchError" || error?.name === "FunctionsRelayError") {
    return "Tidak dapat menghubungi layanan notifikasi. Periksa koneksi internet lalu coba lagi.";
  }
  return "Notifikasi belum dapat diproses. Coba lagi.";
}
