
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { fetchAll } from "../lib/pagination";
import "./SemesterBoundaryManager.css";

function dateBefore(day) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    return "—";
  }

  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);

  return date.toISOString().slice(0, 10);
}

export default function SemesterBoundaryManager() {
  const [years, setYears] = useState([]);
  const [terms, setTerms] = useState([]);
  const [yearId, setYearId] = useState("");
  const [drafts, setDrafts] = useState({});

  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function loadData() {
    const [yearsResult, termsResult] =
      await Promise.all([
        supabase
          .from("academic_years")
          .select("id,start_year,starts_on,ends_on")
          .order("start_year", {
            ascending: false,
          }),

        fetchAll(() => supabase
          .from("semesters")
          .select(
            "id,academic_year_id,term,starts_on,ends_on"
          ), ["id"]),
      ]);

    if (
      yearsResult.error ||
      termsResult.error
    ) {
      throw (
        yearsResult.error ||
        termsResult.error
      );
    }

    const items = yearsResult.data || [];

    setYears(items);
    setTerms(termsResult.data || []);

    setYearId((previous) =>
      items.some(
        (item) => item.id === previous
      )
        ? previous
        : items[0]?.id || ""
    );
  }

  useEffect(() => {
    let mounted = true;

    Promise.resolve().then(async () => {
      try {
        const [yr, sm] = await Promise.all([
          supabase
            .from("academic_years")
            .select(
              "id,start_year,starts_on,ends_on"
            )
            .order("start_year", {
              ascending: false,
            }),

          fetchAll(() => supabase
            .from("semesters")
            .select(
              "id,academic_year_id,term,starts_on,ends_on"
            ), ["id"]),
        ]);

        if (!mounted) return;

        if (yr.error || sm.error) {
          throw yr.error || sm.error;
        }

        const list = yr.data || [];

        setYears(list);
        setTerms(sm.data || []);
        setYearId(list[0]?.id || "");
      } catch (caught) {
        if (mounted) {
          setError(
            caught.message ||
            "Gagal memuat semester."
          );
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    });

    return () => {
      mounted = false;
    };
  }, []);

  const year = years.find(
    (item) => item.id === yearId
  );

  const ganjil = terms.find(
    (item) =>
      item.academic_year_id === yearId &&
      item.term === 1
  );

  const genap = terms.find(
    (item) =>
      item.academic_year_id === yearId &&
      item.term === 2
  );

  const chosen =
    drafts[yearId] ??
    genap?.starts_on ??
    "";

  const valid = Boolean(
    year &&
    ganjil &&
    genap &&
    chosen &&
    chosen > year.starts_on &&
    chosen <= year.ends_on
  );

  const changed =
    valid &&
    (
      ganjil.starts_on !== year.starts_on ||
      ganjil.ends_on !== dateBefore(chosen) ||
      genap.starts_on !== chosen ||
      genap.ends_on !== year.ends_on
    );

  async function save() {
    if (!valid || !changed || busy) {
      return;
    }

    setBusy(true);
    setError("");
    setSuccess("");

    try {
      const { error: problem } =
        await supabase.rpc(
          "set_mutabaah_semester_boundary",
          {
            p_academic_year_id: yearId,
            p_semester_two_starts_on: chosen,
          }
        );

      if (problem) throw problem;

      await loadData();

      setDrafts((previous) => {
        const next = { ...previous };
        delete next[yearId];
        return next;
      });

      setSuccess(
        "Batas semester berhasil disimpan tanpa jeda tanggal."
      );

      setConfirmOpen(false);
    } catch (caught) {
      setError(
        caught.message ||
        "Gagal menyimpan batas semester."
      );

      setConfirmOpen(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      className="sb-panel"
      aria-label="Batas semester otomatis"
    >
      <div className="sb-heading">
        <div>
          <h2>Periode Semester</h2>

          <p>
            Atur satu tanggal; hari sebelum
            Semester Genap otomatis menjadi
            akhir Semester Ganjil.
          </p>
        </div>

        <span>Tanpa jeda</span>
      </div>

      <div className="sb-fields">
        <label>
          Tahun ajaran

          <select
            value={yearId}
            disabled={busy || loading}
            onChange={(event) => {
              setYearId(event.target.value);
              setError("");
              setSuccess("");
            }}
          >
            {years.map((item) => (
              <option
                key={item.id}
                value={item.id}
              >
                {item.start_year}/
                {item.start_year + 1}
              </option>
            ))}
          </select>
        </label>

        <label>
          Hari pertama Semester Genap

          <input
            type="date"
            value={chosen}
            disabled={
              busy ||
              loading ||
              !genap
            }
            min={year?.starts_on}
            max={year?.ends_on}
            onChange={(event) => {
              setDrafts((previous) => ({
                ...previous,
                [yearId]: event.target.value,
              }));

              setSuccess("");
            }}
          />
        </label>

        <button
          type="button"
          disabled={
            !changed ||
            busy ||
            loading
          }
          onClick={() =>
            setConfirmOpen(true)
          }
        >
          Simpan Periode
        </button>
      </div>

      {year && chosen && (
        <div className="sb-preview">
          <div>
            <strong>Semester Ganjil</strong>

            <span>
              {year.starts_on}
              {" — "}
              {dateBefore(chosen)}
            </span>
          </div>

          <div>
            <strong>Semester Genap</strong>

            <span>
              {chosen}
              {" — "}
              {year.ends_on}
            </span>
          </div>
        </div>
      )}

      <p className="sb-hint">
        Libur di antara kegiatan belajar tetap
        masuk dalam periode semester berikutnya.
        Jika rapor sudah diterbitkan, tanggal
        tahun tersebut dikunci.
      </p>

      {error && (
        <p
          className="sb-error"
          role="alert"
        >
          {error}
        </p>
      )}

      {success && (
        <p
          className="sb-success"
          role="status"
        >
          {success}
        </p>
      )}

      {loading && (
        <p
          className="sb-hint"
          role="status"
        >
          Memuat data semester…
        </p>
      )}

      {confirmOpen && (
        <div
          className="sb-overlay"
          role="presentation"
          onMouseDown={(event) => {
            if (
              event.target ===
                event.currentTarget &&
              !busy
            ) {
              setConfirmOpen(false);
            }
          }}
        >
          <section
            className="sb-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="sb-confirm-title"
          >
            <h3 id="sb-confirm-title">
              Simpan batas semester?
            </h3>

            <p>
              Tahun ajaran{" "}
              {year?.start_year}/
              {year?.start_year + 1}
              {" "}akan memakai awal
              Semester Genap{" "}
              <strong>{chosen}</strong>.
              Akhir Semester Ganjil
              otomatis{" "}
              <strong>
                {dateBefore(chosen)}
              </strong>.
            </p>

            <p>
              Perubahan ini dapat memengaruhi
              perhitungan rapor yang belum
              diterbitkan. Arsip rapor yang
              sudah terbit dilindungi.
            </p>

            <div className="sb-dialog-actions">
              <button
                type="button"
                className="is-secondary"
                disabled={busy}
                onClick={() =>
                  setConfirmOpen(false)
                }
              >
                Batal
              </button>

              <button
                type="button"
                disabled={busy}
                onClick={() => void save()}
              >
                {busy
                  ? "Menyimpan…"
                  : "Ya, Simpan"}
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
