
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import "./PromotionManager.css";

const DESTINATIONS = {
  7: ["VIII A", "VIII B"],
  8: ["IX A", "IX B"],
};

export default function PromotionManager() {
  const [years, setYears] = useState([]);
  const [year, setYear] = useState("");
  const [preview, setPreview] = useState(null);
  const [placement, setPlacement] = useState({});
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function readYears() {
      const { data, error: problem } = await supabase
        .from("academic_years")
        .select("start_year")
        .order("start_year", { ascending: false });

      if (!mounted) return;

      if (problem) {
        setError(problem.message);
      } else {
        const list = (data || []).map(
          (item) => item.start_year
        );

        setYears(list);
        setYear(String(list[0] ?? ""));
      }
    }

    void readYears();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!confirmOpen) return undefined;

    function escape(event) {
      if (event.key === "Escape" && !busy) {
        setConfirmOpen(false);
      }
    }

    window.addEventListener("keydown", escape);

    return () => {
      window.removeEventListener("keydown", escape);
    };
  }, [confirmOpen, busy]);

  const students = useMemo(
    () => preview?.students || [],
    [preview]
  );

  const moving = useMemo(
    () => students.filter((s) => s.grade < 9),
    [students]
  );

  const graduating = students.filter(
    (s) => s.grade === 9
  );

  const grade7 = students.filter(
    (s) => s.grade === 7
  );

  const distribution = moving.reduce((acc, row) => {
    const target = placement[row.enrollment_id];

    if (target) {
      acc[target] = (acc[target] || 0) + 1;
    }

    return acc;
  }, {});

  async function readPreview() {
    if (!year || busy) return;

    setBusy(true);
    setError("");
    setMessage("");
    setPreview(null);
    setConfirmOpen(false);

    try {
      const { data, error: problem } = await supabase.rpc(
        "preview_mutabaah_promotion",
        {
          p_source_year: Number(year),
        }
      );

      if (problem) throw problem;

      if (!data || !Array.isArray(data.students)) {
        if (!data?.target_exists) {
          setPreview(data);
          return;
        }

        throw new Error(
          "Pratinjau siswa tidak sesuai format."
        );
      }

      setPreview(data);

      setPlacement(
        Object.fromEntries(
          data.students
            .filter((s) => s.grade < 9)
            .map((s) => [
              s.enrollment_id,
              s.destination,
            ])
        )
      );
    } catch (caught) {
      setError(
        caught.message || "Gagal memuat pratinjau."
      );
    } finally {
      setBusy(false);
    }
  }

  async function commit() {
    if (
      busy ||
      !preview?.can_confirm ||
      !students.length
    ) {
      return;
    }

    setBusy(true);
    setError("");
    setMessage("");

    try {
      const assignments = students.map((s) => ({
        enrollment_id: s.enrollment_id,

        destination:
          s.grade === 9
            ? "LULUS"
            : placement[s.enrollment_id],
      }));

      if (assignments.some((s) => !s.destination)) {
        throw new Error(
          "Semua siswa harus memiliki tujuan kelas."
        );
      }

      const { data, error: problem } = await supabase.rpc(
        "confirm_mutabaah_promotion",
        {
          p_source_year: Number(year),
          p_assignments: assignments,
          p_expected_count: students.length,
        }
      );

      if (problem) throw problem;

      if (!data?.success) {
        throw new Error(
          "Konfirmasi belum diterima server."
        );
      }

      setMessage(
        `${data.moved} siswa naik kelas; ` +
        `${data.graduated} siswa lulus. ` +
        "Riwayat siswa tetap tersimpan."
      );

      setPreview(null);
      setConfirmOpen(false);
    } catch (caught) {
      setError(
        caught.message ||
        "Gagal mengonfirmasi kenaikan kelas."
      );

      setConfirmOpen(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="pm-shell">
      <div className="pm-heading">
        <div>
          <h2>Kenaikan Kelas & Kelulusan</h2>
          <p>
            Periksa pembagian kelas dahulu, lalu
            konfirmasi melalui popup.
          </p>
        </div>

        <span className="pm-note">
          Dijalankan oleh Admin
        </span>
      </div>

      <div className="pm-controls">
        <label>
          <span>Tahun ajaran asal</span>

          <select
            value={year}
            disabled={busy}
            onChange={(e) => {
              setYear(e.target.value);
              setPreview(null);
              setError("");
              setMessage("");
            }}
          >
            {!years.length && (
              <option value="">
                Belum ada tahun ajaran
              </option>
            )}

            {years.map((value) => (
              <option key={value} value={value}>
                {value}/{value + 1}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          disabled={!year || busy}
          onClick={() => void readPreview()}
        >
          {busy ? "Memuat..." : "Lihat Pratinjau"}
        </button>
      </div>

      {error && (
        <p className="pm-error" role="alert">
          {error}
        </p>
      )}

      {message && (
        <p className="pm-success" role="status">
          {message}
        </p>
      )}

      {preview && !preview.target_exists && (
        <p className="pm-hint">
          Buat tahun ajaran {Number(year) + 1}/
          {Number(year) + 2} melalui menu Tahun Ajaran
          terlebih dahulu.
        </p>
      )}

      {preview?.target_exists && (
        <>
          <div className="pm-summary">
            <div>
              <span>Naik kelas</span>
              <strong>{moving.length}</strong>
            </div>

            <div>
              <span>VII → VIII</span>
              <strong>{grade7.length}</strong>
            </div>

            <div>
              <span>VIII → IX</span>
              <strong>
                {moving.length - grade7.length}
              </strong>
            </div>

            <div>
              <span>Lulus IX</span>
              <strong>{graduating.length}</strong>
            </div>
          </div>

          <p className="pm-description">
            Periode: {preview.source_ends_on}
            {" → "}
            {preview.target_starts_on}
          </p>

          {preview.already_confirmed && (
            <p className="pm-success">
              Tahun ajaran ini telah diproses.
              Tidak bisa dikonfirmasi ulang.
            </p>
          )}

          {!preview.can_confirm &&
            !preview.already_confirmed && (
              <p className="pm-hint">
                Konfirmasi tersedia mulai{" "}
                {preview.target_starts_on}.
                Anda bisa menyiapkan pembagian kelas
                lebih dulu.
              </p>
            )}

          {grade7.length > 0 && (
            <div className="pm-split">
              <div>
                <strong>Kelas VII → VIII</strong>
                <p>
                  Default seluruh siswa ke VIII A.
                  Anda dapat mengubah satu per satu
                  menjadi VIII B.
                </p>
              </div>

              <div className="pm-split-actions">
                <button
                  type="button"
                  onClick={() =>
                    setPlacement((old) => ({
                      ...old,
                      ...Object.fromEntries(
                        grade7.map((s) => [
                          s.enrollment_id,
                          "VIII A",
                        ])
                      ),
                    }))
                  }
                >
                  Gabungkan di VIII A
                </button>

                <button
                  type="button"
                  onClick={() => setExpanded(true)}
                >
                  Atur per siswa
                </button>
              </div>
            </div>
          )}

          <div className="pm-distribution">
            {Object.entries(distribution)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([name, count]) => (
                <span key={name}>
                  {name}: <strong>{count} siswa</strong>
                </span>
              ))}
          </div>

          <button
            className="pm-details-toggle"
            type="button"
            onClick={() =>
              setExpanded((value) => !value)
            }
          >
            {expanded
              ? "Tutup daftar"
              : "Lihat daftar dan pembagian kelas"}
          </button>

          {expanded && (
            <div className="pm-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>No</th>
                    <th>Siswa</th>
                    <th>Kelas asal</th>
                    <th>Tujuan</th>
                  </tr>
                </thead>

                <tbody>
                  {students.map((s, i) => (
                    <tr key={s.enrollment_id}>
                      <td>{i + 1}</td>
                      <td>{s.name}</td>
                      <td>{s.source_class}</td>

                      <td>
                        {s.grade === 9 ? (
                          <strong>Lulus</strong>
                        ) : (
                          <select
                            aria-label={`Tujuan ${s.name}`}
                            value={
                              placement[s.enrollment_id] ||
                              ""
                            }
                            onChange={(e) =>
                              setPlacement((old) => ({
                                ...old,
                                [s.enrollment_id]:
                                  e.target.value,
                              }))
                            }
                          >
                            {(
                              DESTINATIONS[s.grade] || []
                            ).map((dest) => (
                              <option
                                key={dest}
                                value={dest}
                              >
                                {dest}
                              </option>
                            ))}
                          </select>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {preview.can_confirm &&
            students.length > 0 && (
              <div className="pm-final-action">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setConfirmOpen(true)}
                >
                  Konfirmasi Kenaikan & Kelulusan
                </button>
              </div>
            )}
        </>
      )}

      {confirmOpen && (
        <div
          className="pm-modal-overlay"
          role="presentation"
          onMouseDown={(e) => {
            if (
              e.target === e.currentTarget &&
              !busy
            ) {
              setConfirmOpen(false);
            }
          }}
        >
          <section
            className="pm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pm-modal-title"
          >
            <h3 id="pm-modal-title">
              Konfirmasi kenaikan kelas?
            </h3>

            <p>
              Proses ini akan memindahkan{" "}
              <strong>{moving.length} siswa</strong>
              {" "}ke kelas berikutnya dan meluluskan{" "}
              <strong>{graduating.length} siswa</strong>
              {" "}kelas IX.
            </p>

            <p>
              Identitas dan riwayat siswa tetap
              tersimpan. Konfirmasi ini tidak dapat
              dibatalkan dari panel.
            </p>

            <div className="pm-modal-actions">
              <button
                type="button"
                className="is-secondary"
                disabled={busy}
                onClick={() => setConfirmOpen(false)}
              >
                Batal
              </button>

              <button
                type="button"
                autoFocus
                disabled={busy}
                onClick={() => void commit()}
              >
                {busy
                  ? "Memproses..."
                  : "Ya, Konfirmasi"}
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
