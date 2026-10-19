export function isStandalone() {
  return window.matchMedia?.("(display-mode: standalone)").matches === true || navigator.standalone === true;
}

export function isAppleMobile() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

export function pushSupportMessage() {
  if (isAppleMobile() && !isStandalone()) {
    return "Di iPhone/iPad, pasang melalui menu Pasang Aplikasi, lalu buka dari ikon Layar Utama untuk mengaktifkan notifikasi (iOS/iPadOS 16.4 atau lebih baru).";
  }
  if (!window.isSecureContext) return "Notifikasi memerlukan alamat HTTPS yang aman.";
  if (!("serviceWorker" in navigator && "PushManager" in window && "Notification" in window)) {
    return "Perangkat atau browser ini belum mendukung Web Push. Fitur aplikasi lainnya tetap dapat digunakan.";
  }
  return "";
}
