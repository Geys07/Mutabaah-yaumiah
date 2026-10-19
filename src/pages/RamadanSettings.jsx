
import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import "./RamadanSettings.css";

const DEFAULTS = [
  "Puasa Ramadan",
  "Sahur",
  "Salat Tarawih",
  "Salat Witir",
  "Tadarus Al-Qur’an",
  "Sedekah Ramadan",
  "Doa dan Zikir Ramadan",
];

function readError(error) {
  return error?.message || "Gagal memproses pengaturan Ramadan.";
}

function daysBetween(a, b) {
  const start = new Date(`${a}T12:00:00Z`);
  const end = new Date(`${b}T12:00:00Z`);

  return Math.round((end - start) / 86400000);
}

export default function RamadanSettings() {
  const [periods, setPeriods] = useState([]);
  const [startsOn, setStartsOn] = useState("");
  const [endsOn, setEndsOn] = useState("");
  const [enabled, setEnabled] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const refresh = useCallback(async () => {
    try {
      const { data, error: problem } = await supabase.rpc(
        "get_mutabaah_ramadan_settings"
      );

      if (problem) throw problem;

      setPeriods(Array.isArray(data) ? data : []);
      setError("");
    } catch (caught) {
      setError(readError(caught));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Tidak memanggil setState langsung di dalam effect.
    void Promise.resolve().then(refresh);
  }, [refresh]);

  function choosePeriod(item) {
    setStartsOn(item.starts_on);
    setEndsOn(item.ends_on);
    setEnabled(Boolean(item.is_enabled));
    setError("");
    setMessage("");
  }

  async function save(event) {
    event.preventDefault();

    if (saving) return;

    if (!startsOn || !endsOn) {
      setError("Isi tanggal mulai dan tanggal selesai Ramadan.");
      return;
    }

    const duration = daysBetween(startsOn, endsOn);

    if (
      !Number.isFinite(duration) ||
      duration < 0 ||
      duration > 44
    ) {
      setError("Periode Ramadan harus antara 1 sampai 45 hari.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const { error: problem } = await supabase.rpc(
        "save_mutabaah_ramadan_period",
        {
          p_start: startsOn,
          p_end: endsOn,
          p_enabled: enabled,
        }
      );

      if (problem) throw problem;

      setMessage(
        "Pengaturan Ramadan tersimpan. Kegiatan biasa tetap ada."
      );

      await refresh();
    } catch (caught) {
      setError(readError(caught));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section
      className="ramadan-admin"
      aria-label="Pengaturan kegiatan Ramadan"
    >
      <div className="ramadan-admin-heading">
        <div>
          <h2>Mode Ramadan</h2>

          <p>
            Periode dan kegiatan Ramadan, terpisah dari
            kegiatan harian biasa.
          </p>
        </div>

        <span className="ramadan-admin-label">
          Kegiatan tambahan
        </span>
      </div>

      <form
        className="ramadan-admin-form"
        onSubmit={(event) => void save(event)}
      >
        <label>
          <span>Mulai Ramadan</span>

          <input
            type="date"
            required
            value={startsOn}
            disabled={saving}
            onChange={(event) =>
              setStartsOn(event.target.value)
            }
          />
        </label>

        <label>
          <span>Akhir Ramadan</span>

          <input
            type="date"
            required
            value={endsOn}
            disabled={saving}
            min={startsOn || undefined}
            onChange={(event) =>
              setEndsOn(event.target.value)
            }
          />
        </label>

        <label className="ramadan-admin-toggle">
          <input
            type="checkbox"
            checked={enabled}
            disabled={saving}
            onChange={(event) =>
              setEnabled(event.target.checked)
            }
          />

          <span>
            Aktifkan pada rentang tanggal ini
          </span>
        </label>

        <button
          type="submit"
          disabled={saving || loading}
        >
          {saving ? "Menyimpan…" : "Simpan Pengaturan"}
        </button>
      </form>

      <p className="ramadan-admin-hint">
        Kegiatan Ramadan hanya muncul pada tanggal
        yang ditetapkan dan saat mode diaktifkan.
        Di luar periode, kegiatan harian biasa tetap
        berjalan. Jawaban lama tidak dihapus.
      </p>

      {error && (
        <p className="ramadan-admin-error" role="alert">
          {error}
        </p>
      )}

      {message && (
        <p className="ramadan-admin-success" role="status">
          {message}
        </p>
      )}

      <div className="ramadan-admin-list">
        <div>
          <h3>Kegiatan Ramadan bawaan</h3>

          <p>{DEFAULTS.join(" · ")}</p>
        </div>

        <div>
          <h3>Periode tersimpan</h3>

          {loading ? (
            <p>Memuat periode…</p>
          ) : periods.length === 0 ? (
            <p>
              Belum ada periode. Tentukan tanggal terlebih dahulu.
            </p>
          ) : (
            <div className="ramadan-period-list">
              {periods.map((period) => (
                <button
                  key={period.id}
                  type="button"
                  onClick={() => choosePeriod(period)}
                >
                  <strong>
                    {period.starts_on} — {period.ends_on}
                  </strong>

                  <span>
                    {period.is_enabled ? "Aktif" : "Nonaktif"}
                    {" · "}
                    {period.activities?.length || 0} kegiatan
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
