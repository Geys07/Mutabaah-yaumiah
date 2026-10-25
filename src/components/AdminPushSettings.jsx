import usePushDevice from "../hooks/usePushDevice";
import { pushSupportMessage } from "../lib/pwaPlatform";
import { pushAvailable } from "../lib/pushDevice";

export default function AdminPushSettings() {
  const { enabled, checked, busy, ready, preparing, error, toggle, prepare } = usePushDevice("admin");
  return <section className="phone-panel">
    <h2>Notifikasi Admin di Ponsel</h2>
    <p>Aktifkan agar permohonan perubahan nomor HP dan pemberitahuan sistem dapat diterima di perangkat Admin.</p>
    <p role="status">{!checked || (preparing && !enabled && !ready) ? "Menyiapkan notifikasi…" : enabled ? "Aktif pada perangkat ini." : error ? "Status notifikasi belum dapat dipastikan." : ready ? "Perangkat siap. Notifikasi belum aktif." : "Persiapan notifikasi belum berhasil."}</p>
    {pushSupportMessage() && <p role="note">{pushSupportMessage()}</p>}
    {(pushAvailable() || enabled) && <button type="button" disabled={busy || preparing || !checked} onClick={() => { if (enabled || ready) void toggle(); else void prepare(); }}>
      {busy ? "Memproses…" : preparing ? "Menyiapkan…" : enabled ? "Nonaktifkan Notifikasi Admin" : !ready ? "Coba Lagi Persiapan" : "Aktifkan Notifikasi Admin"}
    </button>}
    {error && <p role="alert" className="phone-error">{error}</p>}
  </section>;
}
