
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { fetchAll } from "../lib/pagination";
import "./AcademicYears.css";

const CURRENT_YEAR = new Date().getFullYear();

function formatYear(year) {
  return `${year}/${year + 1}`;
}

function getErrorMessage(error) {
  if (error?.code === "23505") {
    return "Tahun ajaran tersebut sudah terdaftar.";
  }

  return error?.message || "Terjadi kesalahan.";
}

export default function AcademicYears() {
  const [years, setYears] = useState([]);
  const [semesters, setSemesters] = useState([]);
  const [startYear, setStartYear] = useState(CURRENT_YEAR);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [dates, setDates] = useState({
    starts_on: "",
    ends_on: "",
  });
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      const [yearResult, semesterResult] =
        await Promise.all([
          supabase
            .from("academic_years")
            .select("id, start_year, starts_on, ends_on")
            .order("start_year", { ascending: false }),

          fetchAll(() => supabase
            .from("semesters")
            .select(
              "id, academic_year_id, term, starts_on, ends_on"
            )
            .order("term", { ascending: true }), ["id"]),
        ]);

      if (cancelled) return;

      if (yearResult.error || semesterResult.error) {
        setError(
          getErrorMessage(
            yearResult.error || semesterResult.error
          )
        );
      } else {
        setYears(yearResult.data || []);
        setSemesters(semesterResult.data || []);
      }

      setLoading(false);
    }

    fetchData();

    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  function refreshData() {
    setLoading(true);
    setReloadKey((value) => value + 1);
  }

  async function handleCreate(event) {
    event.preventDefault();

    if (saving) return;

    const year = Number(startYear);

    if (
      !Number.isInteger(year) ||
      year < 2020 ||
      year > 2200
    ) {
      setError("Tahun awal tidak valid.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const { error: createError } = await supabase.rpc(
        "create_academic_year",
        {
          p_start_year: year,
        }
      );

      if (createError) throw createError;

      setMessage(
        `Tahun ajaran ${formatYear(year)} berhasil dibuat beserta dua semester.`
      );

      refreshData();
    } catch (createError) {
      setError(getErrorMessage(createError));
    } finally {
      setSaving(false);
    }
  }

  function beginEdit(semester) {
    setEditingId(semester.id);
    setDates({
      starts_on: semester.starts_on,
      ends_on: semester.ends_on,
    });
    setError("");
    setMessage("");
  }

  async function saveSemester(semester) {
    if (saving) return;

    if (!dates.starts_on || !dates.ends_on) {
      setError("Tanggal awal dan akhir wajib diisi.");
      return;
    }

    if (dates.starts_on > dates.ends_on) {
      setError(
        "Tanggal akhir tidak boleh sebelum tanggal awal."
      );
      return;
    }

    const year = years.find(
      (item) => item.id === semester.academic_year_id
    );

    if (
      !year ||
      dates.starts_on < year.starts_on ||
      dates.ends_on > year.ends_on
    ) {
      setError(
        "Tanggal semester harus berada dalam rentang tahun ajaran."
      );
      return;
    }

    const otherSemester = semesters.find(
      (item) =>
        item.academic_year_id ===
          semester.academic_year_id &&
        item.id !== semester.id
    );

    if (
      otherSemester &&
      !(
        dates.ends_on < otherSemester.starts_on ||
        dates.starts_on > otherSemester.ends_on
      )
    ) {
      setError(
        "Tanggal semester tidak boleh bertumpang tindih."
      );
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const { error: updateError } = await supabase
        .from("semesters")
        .update({
          starts_on: dates.starts_on,
          ends_on: dates.ends_on,
        })
        .eq("id", semester.id);

      if (updateError) throw updateError;

      setEditingId(null);
      setMessage("Tanggal semester berhasil diperbarui.");
      refreshData();
    } catch (updateError) {
      setError(getErrorMessage(updateError));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="academic-page">
      <section className="academic-panel">
        <div className="academic-heading">
          <h2>Tahun Ajaran</h2>
          
        </div>

        <form
          className="academic-create-form"
          onSubmit={handleCreate}
        >
          <label>
            <span>Tahun Awal</span>
            <select
              value={startYear}
              disabled={saving}
              onChange={(event) =>
                setStartYear(Number(event.target.value))
              }
            >
              {Array.from(
                { length: 6 },
                (_, index) => CURRENT_YEAR + index
              ).map((year) => (
                <option key={year} value={year}>
                  {formatYear(year)}
                </option>
              ))}
            </select>
          </label>

          <button
            className="academic-primary"
            type="submit"
            disabled={saving}
          >
            {saving
              ? "Menyimpan..."
              : "Tambah Tahun Ajaran"}
          </button>
        </form>

        {error && (
          <p className="academic-error" role="alert">
            {error}
          </p>
        )}

        {message && (
          <p className="academic-success" role="status">
            {message}
          </p>
        )}
      </section>

      <section className="academic-panel">
        <div className="academic-heading">
          <h2>Daftar Tahun Ajaran</h2>
          
        </div>

        {loading ? (
          <p className="academic-muted">
            Memuat data...
          </p>
        ) : years.length === 0 ? (
          <p className="academic-muted">
            Belum ada tahun ajaran.
          </p>
        ) : (
          <div className="academic-year-list">
            {years.map((year) => {
              const terms = semesters.filter(
                (item) =>
                  item.academic_year_id === year.id
              );

              return (
                <section
                  key={year.id}
                  className="academic-year-item"
                >
                  <div className="academic-year-title">
                    <h3>
                      {formatYear(year.start_year)}
                    </h3>
                    <span>
                      {year.starts_on} — {year.ends_on}
                    </span>
                  </div>

                  <div className="academic-semesters">
                    {terms.map((semester) => (
                      <div
                        key={semester.id}
                        className="academic-semester"
                      >
                        <div className="academic-semester-title">
                          <strong>
                            Semester{" "}
                            {semester.term === 1
                              ? "Ganjil"
                              : "Genap"}
                          </strong>
                        </div>

                        {editingId === semester.id ? (
                          <div className="academic-edit">
                            <label>
                              <span>Mulai</span>
                              <input
                                type="date"
                                value={dates.starts_on}
                                disabled={saving}
                                onChange={(event) =>
                                  setDates((previous) => ({
                                    ...previous,
                                    starts_on:
                                      event.target.value,
                                  }))
                                }
                              />
                            </label>

                            <label>
                              <span>Selesai</span>
                              <input
                                type="date"
                                value={dates.ends_on}
                                disabled={saving}
                                onChange={(event) =>
                                  setDates((previous) => ({
                                    ...previous,
                                    ends_on:
                                      event.target.value,
                                  }))
                                }
                              />
                            </label>

                            <div className="academic-actions">
                              <button
                                type="button"
                                className="academic-primary"
                                disabled={saving}
                                onClick={() =>
                                  saveSemester(semester)
                                }
                              >
                                Simpan
                              </button>

                              <button
                                type="button"
                                className="academic-secondary"
                                disabled={saving}
                                onClick={() =>
                                  setEditingId(null)
                                }
                              >
                                Batal
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="academic-semester-detail">
                            <span>
                              {semester.starts_on} —{" "}
                              {semester.ends_on}
                            </span>

                            <button
                              type="button"
                              className="academic-secondary"
                              onClick={() =>
                                beginEdit(semester)
                              }
                            >
                              Ubah Tanggal
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
