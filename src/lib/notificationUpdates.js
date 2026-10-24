// Tidak mengirim data pribadi atau isi notifikasi lintas tab.
// Semua pembaruan selalu dibaca kembali dari Supabase dengan sesi/RLS pengguna saat ini.
export const NOTIFICATION_CHANGE_EVENT = "mutabaah:notifications-changed";
const CHANNEL_NAME = "mutabaah-notification-refresh-v1";

export function announceNotificationChange() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(NOTIFICATION_CHANGE_EVENT));
  if (typeof BroadcastChannel === "undefined") return;
  try {
    const channel = new BroadcastChannel(CHANNEL_NAME);
    channel.postMessage("refresh");
    channel.close();
  } catch { /* BroadcastChannel tidak didukung; event halaman tetap bekerja. */ }
}

export function subscribeNotificationChanges(listener) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(NOTIFICATION_CHANGE_EVENT, listener);
  let channel = null;
  if (typeof BroadcastChannel !== "undefined") {
    try {
      channel = new BroadcastChannel(CHANNEL_NAME);
      channel.onmessage = (event) => {
        if (event.data === "refresh") listener();
      };
    } catch { /* Polling/focus tetap menjadi fallback. */ }
  }
  return () => {
    window.removeEventListener(NOTIFICATION_CHANGE_EVENT, listener);
    if (channel) {
      channel.onmessage = null;
      channel.close();
    }
  };
}
