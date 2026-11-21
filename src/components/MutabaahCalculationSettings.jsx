import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

const SETTING_KEY = "mutabaah_calculation_start";
const PAUSE_SETTING_KEY = "mutabaah_calculation_pause";

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(`${value}T12:00:00+07:00`);
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  }).format(date);
}

function formatDateTime(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(new Date(value));
}

export default function MutabaahCalculationSettings() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [togglingPause, setTogglingPause] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadStatus = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data, error: queryError } = await supabase
        .from("app_settings")
        .select("key, value")
        .in("key", [SETTING_KEY, PAUSE_SETTING_KEY]);
      if (queryError) throw queryError;

      const startSetting = data?.find((item) => item.key === SETTING_KEY)?.value || null;
      const pauseSetting = data?.find((item) => item.key === PAUSE_SETTING_KEY)?.value || null;
      setStatus({
        ...(startSetting || {}),
        paused: pauseSetting?.paused === true,
        pause_updated_at: pauseSetting?.updated_at || null,
      });
    } catch (caught) {
      setError(caught?.message || "Status perhitungan belum dapat dimuat.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;

    async function loadInitialStatus() {
      try {
        const { data, error: queryError } = await supabase
          .from("app_settings")
          .select("key, value")
          .in("key", [SETTING_KEY, PAUSE_SETTING_KEY]);
        if (queryError) throw queryError;

        const startSetting = data?.find((item) => item.key === SETTING_KEY)?.value || null;
        const pauseSetting = data?.find((item) => item.key === PAUSE_SETTING_KEY)?.value || null;
        if (active) {
          setStatus({
            ...(startSetting || {}),
            paused: pauseSetting?.paused === true,
            pause_updated_at: pauseSetting?.updated_at || null,
          });
        }
      } catch (caught) {
        if (active) setError(caught?.message || "Status perhitungan belum dapat dimuat.");
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadInitialStatus();
    return () => { active = false; };
  }, []);

  async function startCalculation() {
    if (starting || status?.started_on) return;
    const confirmed = window.confirm(
      "Mulai perhitungan dari tanggal hari ini? Data sebelum tanggal ini tidak akan dihitung dalam rekap dan rapor. Orang tua baru dapat mengisi setelah periode dimulai; petugas madrasah tetap dapat menyiapkan dan mengoreksi data."
    );
    if (!confirmed) return;

    setStarting(true);
    setError("");
    setNotice("");
    try {
      const { data, error: startError } = await supabase.rpc("start_mutabaah_calculation");
      if (startError) throw startError;
      if (!data?.started_on) throw new Error("Server belum mengembalikan tanggal mulai perhitungan.");
      setStatus((current) => ({ ...data, paused: current?.paused === true }));
      setNotice("Perhitungan Mutabaah berhasil dimulai.");
    } catch (caught) {
      setError(caught?.message || "Gagal memulai perhitungan.");
    } finally {
      setStarting(false);
    }
  }

  async function togglePause() {
    if (!status?.started_on || togglingPause) return;
    const nextPaused = status.paused !== true;
    const confirmed = window.confirm(
      nextPaused
        ? "Jeda pengisian Mutabaah orang tua sekarang? Orang tua tidak dapat membuka atau mengirim pengisian baru selama jeda. Tanggal mulai, data, rekap, nilai, dan rapor yang sudah ada tetap dipertahankan."
        : "Lanjutkan perhitungan Mutabaah? Orang tua akan dapat membuka dan mengirim pengisian kembali. Tanggal mulai dan seluruh data lama tetap sama."
    );
    if (!confirmed) return;

    setTogglingPause(true);
    setError("");
    setNotice("");
    try {
      const { data, error: pauseError } = await supabase.rpc(
        "set_mutabaah_calculation_paused",
        { p_paused: nextPaused }
      );
      if (pauseError) throw pauseError;
      setStatus((current) => ({ ...current, paused: data?.paused === true }));
      setNotice(
        nextPaused
          ? "Pengisian Mutabaah orang tua berhasil dijeda."
          : "Pengisian Mutabaah orang tua berhasil dilanjutkan."
      );
    } catch (caught) {
      setError(caught?.message || "Gagal mengubah status perhitungan.");
    } finally {
      setTogglingPause(false);
    }
  }

  return (
    <section className="staff-card" style={{ maxWidth: 760, padding: 20 }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, color: "var(--sa-accent, #17533b)" }}>Mulai Perhitungan Mutabaah</h2>
          <p style={{ margin: "7px 0 0", color: "var(--sa-muted, #687970)", fontSize: 13, lineHeight: 1.6 }}>
            Tentukan tanggal resmi dimulainya perhitungan untuk seluruh siswa dan kelas.
          </p>
        </div>
        <button type="button" className="staff-soft-button" disabled={loading || starting || togglingPause} onClick={() => void loadStatus()}>
          Perbarui
        </button>
      </div>

      {loading ? (
        <p role="status" style={{ marginTop: 18 }}>Memuat status perhitungan…</p>
      ) : status?.started_on ? (
        <div style={{ marginTop: 20, padding: 16, border: "1px solid var(--sa-line, #dce8df)", borderRadius: 10 }}>
          <strong style={{ display: "block", color: status.paused ? "var(--sa-muted, #687970)" : "var(--sa-accent, #17533b)" }}>
            {status.paused ? "Perhitungan sedang dijeda" : "Perhitungan sudah dimulai"}
          </strong>
          <p style={{ margin: "8px 0 4px", fontSize: 14 }}>Tanggal mulai: <strong>{formatDate(status.started_on)}</strong></p>
          <p style={{ margin: 0, color: "var(--sa-muted, #687970)", fontSize: 12 }}>Diaktifkan pada {formatDateTime(status.started_at)}.</p>
          <p style={{ margin: "12px 0 0", fontSize: 13, lineHeight: 1.6 }}>
            Rekap harian, rekap bulanan, kalender status orang tua, perhitungan bonus, dan rapor tetap menggunakan tanggal mulai ini. {status.paused
              ? "Selama jeda, orang tua tidak dapat membuka atau mengirim pengisian baru. Data dan hasil yang sudah ada tetap aman."
              : "Pengisian orang tua sedang dibuka."}
          </p>
          <button
            type="button"
            className={status.paused ? "admin-primary-button" : "staff-soft-button"}
            style={{ marginTop: 16 }}
            disabled={togglingPause}
            onClick={() => void togglePause()}
          >
            {togglingPause
              ? "Menyimpan…"
              : status.paused
                ? "Lanjutkan Perhitungan"
                : "Jeda Perhitungan"}
          </button>
        </div>
      ) : (
        <div style={{ marginTop: 20, padding: 16, border: "1px solid var(--sa-line, #dce8df)", borderRadius: 10 }}>
          <strong style={{ display: "block", color: "var(--sa-ink, #253d31)" }}>Perhitungan belum dimulai</strong>
          <p style={{ margin: "8px 0 14px", color: "var(--sa-muted, #687970)", fontSize: 13, lineHeight: 1.65 }}>
            Pengisian orang tua baru dibuka setelah perhitungan dimulai. Petugas madrasah tetap dapat menyiapkan atau mengoreksi data melalui panel petugas.
          </p>
          <button type="button" className="admin-primary-button" disabled={starting} onClick={() => void startCalculation()}>
            {starting ? "Memulai…" : "Mulai Perhitungan"}
          </button>
        </div>
      )}

      {error && <p className="admin-error" role="alert" style={{ marginTop: 14 }}>{error}</p>}
      {notice && <p className="admin-success" role="status" style={{ marginTop: 14 }}>{notice}</p>}
    </section>
  );
}
