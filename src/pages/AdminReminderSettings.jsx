import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { checkPushDevice, invokePush, pushAvailable } from "../lib/pushDevice";
import AppConfirmDialog from "../components/AppConfirmDialog";
import "./AdminReminderSettings.css";

export default function AdminReminderSettings({ onPreview, onChanged }) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [confirmEnable, setConfirmEnable] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    const { data, error: problem } = await supabase.rpc("admin_reminder_status");
    if (problem) setError(problem.message || "Status pengingat tidak dapat dibaca.");
    else setStatus(data);
    setLoading(false);
  }

  useEffect(() => {
    let active = true;
    void supabase.rpc("admin_reminder_status").then(({ data, error: problem }) => {
      if (!active) return;
      if (problem) setError(problem.message || "Status pengingat tidak dapat dibaca.");
      else setStatus(data);
      setLoading(false);
    });
    return () => { active = false; };
  }, []);

  async function setEnabled(enabled) {
    if (busy) return;
    setBusy("toggle");
    setError("");
    setNotice("");
    try {
      const { data, error: problem } = await supabase.rpc("admin_reminder_set_enabled", { p_enabled: enabled });
      if (problem) throw problem;
      setStatus(data);
      setConfirmEnable(false);
      setNotice(enabled
        ? "Pengingat 20.00 WIB diaktifkan. Pengiriman mengikuti jadwal server."
        : "Pengingat 20.00 WIB berhasil dinonaktifkan.");
      onChanged?.();
    } catch (caught) {
      // Do not reset the visible error or dismiss the confirmation.
      // The existing status remains unchanged until server confirms success.
      setError(caught.message || "Pengaturan gagal disimpan.");
    } finally {
      setBusy("");
    }
  }

  async function sendPreview() {
    if (busy) return;
    setBusy("preview");
    setError("");
    setNotice("");
    try {
      if (!pushAvailable() || !("serviceWorker" in navigator) || Notification.permission !== "granted") {
        throw new Error("Aktifkan izin Notifikasi Admin di perangkat ini terlebih dahulu.");
      }
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth.user || !await checkPushDevice("admin", auth.user.id)) {
        throw new Error("Perangkat ini belum terdaftar untuk notifikasi admin. Aktifkan di tab Notifikasi Push.");
      }
      const registration = await navigator.serviceWorker.getRegistration(import.meta.env.BASE_URL || "/");
      const subscription = await registration?.pushManager.getSubscription();
      if (!subscription?.endpoint) {
        throw new Error("Langganan push tidak ditemukan. Aktifkan Notifikasi Admin pada perangkat ini.");
      }
      // Endpoint hanya dipakai untuk memilih perangkat yang terdaftar milik admin login.
      // Kunci push tidak pernah dikirim dari browser untuk tindakan contoh.
      const delivery = await invokePush("admin", "test_reminder_push", {
        endpoint: subscription.endpoint,
      });
      if (delivery?.success !== true) {
        throw new Error("Layanan push belum menerima pesan contoh.");
      }
      // Kotak masuk menyimpan riwayat contoh, tetapi tidak menggantikan push sungguhan.
      const { error: archiveError } = await supabase.rpc("admin_reminder_preview");
      if (archiveError) {
        setNotice("Contoh push diterima layanan pengiriman. Penyimpanan ke kotak masuk gagal; coba muat ulang.");
      } else {
        setNotice("Contoh push dikirim ke perangkat ini. Periksa notifikasi Android/iOS; salinannya ada di Kotak Masuk.");
        onPreview?.();
        onChanged?.();
      }
    } catch (caught) {
      setError(caught.message || "Pengiriman contoh push gagal.");
    } finally {
      setBusy("");
    }
  }

  const enabled = status?.enabled === true;
  const ready = status?.can_enable === true;
  const schedulerReady = status?.scheduler_ready === true;
  const deliveryReady = status?.delivery_ready === true;

  return (
    <section className="reminder-settings">
      <div className="reminder-settings-header">
        <div>
          <span className="reminder-settings-eyebrow">PENGINGAT HARIAN</span>
          <h2>Notifikasi Wali Murid</h2>
          <p>Pengingat otomatis bagi wali yang belum menyelesaikan pengisian Mutabaah hari itu.</p>
        </div>
        <span className={`reminder-settings-status ${enabled ? "is-enabled" : "is-disabled"}`} role="status">
          <span aria-hidden="true" className="reminder-settings-dot" />
          {loading ? "Memeriksa…" : enabled ? "Aktif" : "Nonaktif"}
        </span>
      </div>

      <div className="reminder-settings-schedule">
        <div className="reminder-settings-clock" aria-hidden="true">20:00</div>
        <div>
          <strong>Setiap hari · 20.00 WIB</strong>
          <p>Waktu Indonesia Barat (Asia/Jakarta). Hanya untuk wali dengan pengisian yang belum selesai.</p>
        </div>
      </div>

      <div className="reminder-settings-control">
        <div className="reminder-settings-control-text">
          <strong>Aktifkan Pengingat Otomatis</strong>
          <small>{enabled ? "Pengiriman dijadwalkan setiap hari." : ready ? "Siap diaktifkan saat diperlukan." : "Belum siap diaktifkan. Periksa kesiapan sistem."}</small>
        </div>
        <button type="button" className={`reminder-settings-switch ${enabled ? "is-on" : ""}`}
          role="switch" aria-checked={enabled}
          aria-label="Pengingat otomatis pukul 20.00 WIB"
          disabled={loading || Boolean(busy) || (!enabled && !ready)}
          onClick={() => { if (enabled) void setEnabled(false); else setConfirmEnable(true); }}>
          <span className="reminder-settings-switch-thumb" />
          <span className="reminder-settings-switch-label">{enabled ? "ON" : "OFF"}</span>
        </button>
      </div>

      <div className="reminder-settings-checklist" aria-label="Kesiapan pengingat">
        <h3>Kesiapan Sistem</h3>
        <div className={schedulerReady ? "is-ready" : "is-pending"}>
          <span aria-hidden="true">{schedulerReady ? "✓" : "○"}</span>
          <span>Penjadwal otomatis 20.00 WIB</span>
          <strong>{schedulerReady ? "Siap" : "Belum disiapkan"}</strong>
        </div>
        <div className={deliveryReady ? "is-ready" : "is-pending"}>
          <span aria-hidden="true">{deliveryReady ? "✓" : "○"}</span>
          <span>Pengiriman push aman telah diverifikasi</span>
          <strong>{deliveryReady ? "Siap" : "Belum diverifikasi"}</strong>
        </div>
        {!ready && !loading && <p className="reminder-settings-explainer">
          Tombol ON akan tersedia setelah penjadwal dan layanan pengiriman dikonfigurasi serta diuji. Menyalakan sakelar saja tidak boleh dianggap mengaktifkan pengiriman jika server belum siap.
        </p>}
      </div>

      <div className="reminder-settings-preview">
        <div>
          <h3>Cek Contoh Notifikasi</h3>
          <p>Kirim push notification sungguhan ke perangkat admin yang sedang digunakan, sekaligus simpan salinannya di Kotak Masuk. Tidak ada pesan yang dikirim ke wali murid.</p>
        </div>
        <div className="reminder-settings-sample">
          <strong>Mutabaah Yaumiah — MTs Al-Khairiyah</strong>
          <span>Pengisian Mutabaah ananda hari ini belum selesai. Silakan lengkapi dan finalisasi.</span>
        </div>
        <button type="button" className="reminder-settings-preview-button"
          disabled={loading || Boolean(busy)}
          onClick={() => void sendPreview()}>
          {busy === "preview" ? "Mengirim Push…" : "Kirim Push Contoh ke Perangkat Ini"}
        </button>
      </div>

      <div className="reminder-settings-footer">
        <button type="button" onClick={() => void load()} disabled={loading || Boolean(busy)}>Perbarui Status</button>
        <small>Tombol contoh hanya menguji penerimaan push pada perangkat admin ini; pengingat otomatis wali murid tetap OFF.</small>
      </div>
      {error && <p className="reminder-settings-error" role="alert">{error}</p>}
      {notice && <p className="reminder-settings-success" role="status">{notice}</p>}

      {confirmEnable && <AppConfirmDialog
        title="Aktifkan Pengingat 20.00 WIB?"
        description="Jika layanan siap, pengingat sungguhan akan dikirim otomatis kepada wali murid yang memenuhi syarat mulai jadwal berikutnya."
        confirmLabel="Ya, Aktifkan"
        busy={Boolean(busy)} error={error}
        onCancel={()=>{setConfirmEnable(false);setError("");}}
        onConfirm={()=>void setEnabled(true)}
      />}
    </section>
  );
}
