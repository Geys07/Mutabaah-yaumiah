import EmptyState from "../components/EmptyState";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { fetchAll } from "../lib/pagination";
import "./Classes.css";

const GRADES = [
  { grade: 7, roman: "VII" },
  { grade: 8, roman: "VIII" },
  { grade: 9, roman: "IX" },
];

function letterFromNumber(number) {
  let result = "";
  let value = number;

  while (value > 0) {
    value -= 1;
    result =
      String.fromCharCode(65 + (value % 26)) + result;
    value = Math.floor(value / 26);
  }

  return result;
}

function gradeLabel(grade) {
  return (
    GRADES.find((item) => item.grade === grade)
      ?.roman || String(grade)
  );
}

function errorMessage(error) {
  if (error?.code === "23505") {
    return "Nama kelas sudah digunakan pada tahun ajaran ini.";
  }

  if (error?.code === "23503") {
    return "Kelas tidak dapat dihapus karena sudah digunakan oleh data lain.";
  }

  return error?.message || "Terjadi kesalahan.";
}

export default function Classes() {
  const [years, setYears] = useState([]);
  const [yearId, setYearId] = useState("");
  const [classes, setClasses] = useState([]);
  const [loadingYears, setLoadingYears] =
    useState(true);
  const [loadingClasses, setLoadingClasses] =
    useState(true);
  const [busy, setBusy] = useState(false);
  const [selectedGrade, setSelectedGrade] =
    useState(7);
  const [quantity, setQuantity] = useState(1);
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] =
    useState("");
  const [deletingId, setDeletingId] =
    useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function fetchYears() {
      const { data, error: queryError } =
        await supabase
          .from("academic_years")
          .select("id, start_year")
          .order("start_year", {
            ascending: false,
          });

      if (cancelled) return;

      if (queryError) {
        setError(errorMessage(queryError));
      } else {
        const result = data || [];
        setYears(result);
        setYearId((previous) =>
          result.some(
            (year) => year.id === previous
          )
            ? previous
            : result[0]?.id || ""
        );
      }

      setLoadingYears(false);
    }

    fetchYears();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!yearId) return undefined;

    let cancelled = false;

    async function fetchClasses() {
      const { data, error: queryError } =
        await fetchAll(() => supabase
          .from("classes")
          .select(
            "id, academic_year_id, name, grade"
          )
          .eq("academic_year_id", yearId)
          .order("grade")
          .order("name"), ["id"]);

      if (cancelled) return;

      if (queryError) {
        setError(errorMessage(queryError));
      } else {
        setClasses(data || []);
      }

      setLoadingClasses(false);
    }

    fetchClasses();

    return () => {
      cancelled = true;
    };
  }, [yearId, reloadKey]);

  const selectedYear = years.find(
    (year) => year.id === yearId
  );

  const groupedClasses = useMemo(
    () =>
      GRADES.map((grade) => ({
        ...grade,
        items: classes.filter(
          (item) => item.grade === grade.grade
        ),
      })),
    [classes]
  );

  function refreshClasses() {
    setLoadingClasses(true);
    setReloadKey((value) => value + 1);
  }

  function changeYear(value) {
    setYearId(value);
    setClasses([]);
    setLoadingClasses(true);
    setEditingId(null);
    setDeletingId(null);
    setError("");
    setSuccess("");
  }

  async function addClasses(event) {
    event.preventDefault();

    if (busy || !yearId || loadingClasses) {
      return;
    }

    const count = Number(quantity);

    if (
      !Number.isInteger(count) ||
      count < 1 ||
      count > 20
    ) {
      setError(
        "Jumlah rombel harus antara 1 sampai 20."
      );
      return;
    }

    const existingNames = new Set(
      classes.map((item) =>
        item.name.toUpperCase()
      )
    );

    const newRows = [];
    let index = 1;

    while (newRows.length < count) {
      const name = `${gradeLabel(
        selectedGrade
      )} ${letterFromNumber(index)}`;

      if (!existingNames.has(name)) {
        newRows.push({
          academic_year_id: yearId,
          grade: selectedGrade,
          name,
        });

        existingNames.add(name);
      }

      index += 1;
    }

    setBusy(true);
    setError("");
    setSuccess("");

    try {
      const { error: insertError } =
        await supabase
          .from("classes")
          .insert(newRows);

      if (insertError) throw insertError;

      setSuccess(
        `${count} rombel kelas ${gradeLabel(
          selectedGrade
        )} berhasil ditambahkan.`
      );

      refreshClasses();
    } catch (insertError) {
      setError(errorMessage(insertError));
    } finally {
      setBusy(false);
    }
  }

  function beginEdit(item) {
    setEditingId(item.id);
    setEditingName(item.name);
    setDeletingId(null);
    setError("");
    setSuccess("");
  }

  async function saveEdit(item) {
    if (busy) return;

    const name = editingName
      .trim()
      .replace(/\s+/g, " ")
      .toUpperCase();

    if (!name || name.length > 40) {
      setError(
        "Nama kelas harus berisi 1–40 karakter."
      );
      return;
    }

    const prefix = `${gradeLabel(item.grade)} `;

    if (!name.startsWith(prefix)) {
      setError(
        `Nama kelas harus diawali "${prefix}".`
      );
      return;
    }

    setBusy(true);
    setError("");
    setSuccess("");

    try {
      const { error: updateError } =
        await supabase
          .from("classes")
          .update({ name })
          .eq("id", item.id)
          .eq("academic_year_id", yearId);

      if (updateError) throw updateError;

      setEditingId(null);
      setSuccess(
        "Nama kelas berhasil diperbarui."
      );

      refreshClasses();
    } catch (updateError) {
      setError(errorMessage(updateError));
    } finally {
      setBusy(false);
    }
  }

  async function deleteClass(item) {
    if (busy) return;

    setBusy(true);
    setError("");
    setSuccess("");

    try {
      const { error: deleteError } =
        await supabase
          .from("classes")
          .delete()
          .eq("id", item.id)
          .eq("academic_year_id", yearId);

      if (deleteError) throw deleteError;

      setDeletingId(null);
      setSuccess(
        `Kelas ${item.name} berhasil dihapus.`
      );

      refreshClasses();
    } catch (deleteError) {
      setError(errorMessage(deleteError));
    } finally {
      setBusy(false);
    }
  }

  const isLoading =
    loadingYears ||
    (Boolean(yearId) && loadingClasses);

  return (
    <div className="classes-page">
      <section className="classes-panel">
        <div className="classes-heading">
          <h2>Pengelolaan Kelas</h2>
        </div>

        <label className="classes-field classes-year-field">
          <span>Tahun Ajaran</span>

          <select
            value={yearId}
            disabled={busy || loadingYears}
            onChange={(event) =>
              changeYear(event.target.value)
            }
          >
            {years.length === 0 && (
              <option value="">
                Belum ada tahun ajaran
              </option>
            )}

            {years.map((year) => (
              <option
                key={year.id}
                value={year.id}
              >
                {year.start_year}/
                {year.start_year + 1}
              </option>
            ))}
          </select>
        </label>

        {!yearId ? (
          <p className="classes-empty">
            Buat tahun ajaran terlebih dahulu
            melalui menu Tahun Ajaran.
          </p>
        ) : (
          <form
            className="classes-add-form"
            onSubmit={addClasses}
          >
            <label className="classes-field">
              <span>Tingkat</span>

              <select
                value={selectedGrade}
                disabled={busy || isLoading}
                onChange={(event) =>
                  setSelectedGrade(
                    Number(event.target.value)
                  )
                }
              >
                {GRADES.map((grade) => (
                  <option
                    key={grade.grade}
                    value={grade.grade}
                  >
                    Kelas {grade.roman}
                  </option>
                ))}
              </select>
            </label>

            <label className="classes-field">
              <span>Jumlah Rombel Baru</span>

              <input
                type="number"
                min="1"
                max="20"
                value={quantity}
                disabled={busy || isLoading}
                onChange={(event) =>
                  setQuantity(event.target.value)
                }
              />
            </label>

            <button
              type="submit"
              className="classes-primary"
              disabled={busy || isLoading}
            >
              {busy
                ? "Memproses..."
                : "Tambah Kelas"}
            </button>
          </form>
        )}

        {error && (
          <p
            className="classes-error"
            role="alert"
          >
            {error}
          </p>
        )}

        {success && (
          <p
            className="classes-success"
            role="status"
          >
            {success}
          </p>
        )}
      </section>

      {yearId && (
        <section className="classes-panel">
          <div className="classes-heading">
            <h2>
              Daftar Kelas{" "}
              {selectedYear
                ? `${selectedYear.start_year}/${
                    selectedYear.start_year + 1
                  }`
                : ""}
            </h2>

            <p>
              Total {classes.length} rombongan
              belajar.
            </p>
          </div>

          {isLoading ? (
            <p className="classes-empty">
              Memuat kelas...
            </p>
          ) : classes.length === 0 ? (
            <EmptyState kind="school" illustration="class" title="Belum ada rombongan belajar" description="Gunakan formulir Tambah Kelas untuk membuat rombongan belajar." />
          ) : (
            <div className="classes-groups">
              {groupedClasses.map((group) => (
                <div
                  className="classes-group"
                  key={group.grade}
                >
                  <div className="classes-group-header">
                    <h3>
                      Kelas {group.roman}
                    </h3>

                    <span>
                      {group.items.length} rombel
                    </span>
                  </div>

                  {group.items.length === 0 ? (
                    <p className="classes-empty">
                      Belum ada rombongan belajar.
                    </p>
                  ) : (
                    <div className="classes-list">
                      {group.items.map((item) => (
                        <div
                          key={item.id}
                          className="classes-item"
                        >
                          {editingId === item.id ? (
                            <div className="classes-edit-row">
                              <input
                                value={editingName}
                                maxLength={40}
                                disabled={busy}
                                aria-label="Nama kelas"
                                onChange={(event) =>
                                  setEditingName(
                                    event.target.value
                                  )
                                }
                              />

                              <button
                                type="button"
                                className="classes-primary"
                                disabled={busy}
                                onClick={() =>
                                  saveEdit(item)
                                }
                              >
                                Simpan
                              </button>

                              <button
                                type="button"
                                className="classes-secondary"
                                disabled={busy}
                                onClick={() =>
                                  setEditingId(null)
                                }
                              >
                                Batal
                              </button>
                            </div>
                          ) : deletingId === item.id ? (
                            <div className="classes-delete-row">
                              <span>
                                Hapus kelas{" "}
                                {item.name}?
                              </span>

                              <button
                                type="button"
                                className="classes-danger"
                                disabled={busy}
                                onClick={() =>
                                  deleteClass(item)
                                }
                              >
                                Ya, Hapus
                              </button>

                              <button
                                type="button"
                                className="classes-secondary"
                                disabled={busy}
                                onClick={() =>
                                  setDeletingId(null)
                                }
                              >
                                Batal
                              </button>
                            </div>
                          ) : (
                            <>
                              <strong>
                                {item.name}
                              </strong>

                              <div className="classes-actions">
                                <button
                                  type="button"
                                  className="classes-secondary"
                                  disabled={busy}
                                  onClick={() =>
                                    beginEdit(item)
                                  }
                                >
                                  Edit
                                </button>

                                <button
                                  type="button"
                                  className="classes-delete-button"
                                  disabled={busy}
                                  onClick={() => {
                                    setDeletingId(
                                      item.id
                                    );
                                    setEditingId(null);
                                    setError("");
                                    setSuccess("");
                                  }}
                                >
                                  Hapus
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
