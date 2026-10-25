import usePushDevice from "../hooks/usePushDevice";
import { pushSupportMessage } from "../lib/pwaPlatform";
import { pushAvailable } from "../lib/pushDevice";

export default function AdminPushSettings() {
  const { enabled, checked, busy, ready, preparing, error, toggle, prepare, permission, optIn } = usePushDevice("admin");
  return <section className="phone-panel">
    <h2>Notifikasi Admin di Ponsel</h2>
    <p>Aktifkan agar permohonan perubahan nomor HP dan pemberitahuan sistem dapat diterima di perangkat Admin.</p>
    <p role="status">{
      !checked || (preparing && !enabled && !ready) ? "Memeriksa langganan akun Admin…"
      : enabled ? "Aktif untuk akun Admin pada perangkat ini."
      : permission === "granted"
        ? optIn
          ? ready
            ? "Izin notifikasi HP aktif. Langganan akun Admin belum tersambung."
            : "Izin notifikasi HP aktif. Memeriksa sambungan akun Admin."
          : "Izin HP aktif, tetapi notifikasi akun Admin pernah dinonaktifkan."
        : permission === "denied" ? "Notifikasi diblokir perangkat. Izinkan kembali dari pengaturan aplikasi."
        : error ? "Status notifikasi belum dapat dipastikan."
        : ready ? "Perangkat siap untuk mengaktifkan notifikasi Admin."
        : "Persiapan notifikasi belum berhasil."
    }</p>
    {pushSupportMessage() && <p role="note">{pushSupportMessage()}</p>}
    {(pushAvailable() || enabled) && <button type="button" disabled={busy || preparing || !checked} onClick={() => { if (enabled || ready) void toggle(); else void prepare(); }}>
      {busy ? "Memproses…" : preparing ? "Menyiapkan…" : enabled ? "Nonaktifkan Notifikasi Admin" : !ready ? "Coba Lagi Persiapan" : permission === "granted" ? "Hubungkan Notifikasi Admin" : "Aktifkan Notifikasi Admin"}
    </button>}
    {error && <p role="alert" className="phone-error">{error}</p>}
  </section>;
}
