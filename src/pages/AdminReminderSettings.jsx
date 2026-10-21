import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
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

  useEffect(() => { void load(); }, []);

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
      setError(caught.message || "Pengaturan gagal disimpan.");
      await load();
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
      const { error: problem } = await supabase.rpc("admin_reminder_preview");
      if (problem) throw problem;
      onChanged?.();
      onPreview?.();
    } catch (caught) {
      setError(caught.message || "Contoh notifikasi gagal dibuat.");
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
          <p>Masukkan contoh pesan yang akan diterima wali ke Kotak Masuk Admin. Tidak mengirim ke perangkat atau akun wali murid.</p>
        </div>
        <div className="reminder-settings-sample">
          <strong>Mutabaah Yaumiah — MTs Al-Khairiyah</strong>
          <span>Pengisian Mutabaah ananda hari ini belum selesai. Silakan lengkapi dan finalisasi.</span>
        </div>
        <button type="button" className="reminder-settings-preview-button"
          disabled={loading || Boolean(busy)}
          onClick={() => void sendPreview()}>
          {busy === "preview" ? "Menyiapkan Contoh…" : "Kirim Contoh ke Admin"}
        </button>
      </div>

      <div className="reminder-settings-footer">
        <button type="button" onClick={() => void load()} disabled={loading || Boolean(busy)}>Perbarui Status</button>
        <small>Status disimpan di server. Pengiriman pengingat nyata tidak diuji dengan tombol contoh.</small>
      </div>
      {error && <p className="reminder-settings-error" role="alert">{error}</p>}
      {notice && <p className="reminder-settings-success" role="status">{notice}</p>}

      {confirmEnable && <div className="reminder-settings-overlay">
        <div className="reminder-settings-dialog" role="dialog" aria-modal="true" aria-labelledby="reminder-settings-confirm">
          <h3 id="reminder-settings-confirm">Aktifkan Pengingat 20.00 WIB?</h3>
          <p>Jika layanan telah siap, pesan sungguhan akan dikirim otomatis kepada wali murid yang memenuhi syarat mulai jadwal berikutnya.</p>
          <div>
            <button type="button" disabled={Boolean(busy)} onClick={() => setConfirmEnable(false)}>Batal</button>
            <button type="button" className="is-primary" disabled={Boolean(busy)} onClick={() => void setEnabled(true)}>
              {busy ? "Memproses…" : "Ya, Aktifkan"}
            </button>
          </div>
        </div>
      </div>}
    </section>
  );
}
