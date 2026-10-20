
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { fetchAll, searchFilter, PAGE_SIZE } from "../lib/pagination";
import usePagedQuery from "../lib/usePagedQuery";
import Pagination from "../components/Pagination";
const StudentImport = lazy(() => import("./StudentImport"));
import StudentFamily from "./StudentFamily";
import "./Students.css";

const EMPTY_FORM = {
  id: null,
  full_name: "",
  nis: "",
  nisn: "",
  gender: "",
  class_id: "",
};

function getError(error) {
  if (error?.code === "23505") {
    return "NIS atau NISN sudah terdaftar.";
  }

  return error?.message || "Terjadi kesalahan.";
}

export default function Students() {
  const [years, setYears] = useState([]);
  const [yearId, setYearId] = useState("");
  const [classes, setClasses] = useState([]);
  
  const [page, setPage] = useState(0);
  const [loadingYears, setLoadingYears] = useState(true);
  
  const [busy, setBusy] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [form, setForm] = useState(null);
  const [importOpen, setImportOpen] = useState(false);
  const [familyStudent, setFamilyStudent] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function fetchYears() {
      const { data, error: queryError } = await supabase
        .from("academic_years")
        .select("id, start_year")
        .order("start_year", { ascending: false });

      if (cancelled) return;

      if (queryError) {
        setError(getError(queryError));
      } else {
        const result = data || [];
        setYears(result);
        setYearId((previous) =>
          result.some((item) => item.id === previous)
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

  const loadStudents = useCallback(async (signal) => {
    if (!yearId) return { data: [], count: 0 };
    const classResult = await fetchAll(() => supabase.from("classes")
      .select("id,name,grade").eq("academic_year_id", yearId).order("grade").order("name"), ["id"], signal);
    if (classResult.error) return classResult;
    if (signal.aborted) return { data: [], count: 0 };
    setClasses(classResult.data);
    let query = supabase.from("student_enrollments").select(
      "id,class_id,students!inner(id,full_name,nis,nisn,gender,status),classes!inner(id,name,grade,academic_year_id)", { count: "exact" }
    ).is("ends_on", null).eq("classes.academic_year_id", yearId);
    if (classFilter) query = query.eq("class_id", classFilter);
    if (search.trim()) query = query.or(searchFilter(["full_name", "nis", "nisn"], search), { referencedTable: "students" });
    const result = await query.order("classes(grade)").order("classes(name)").order("students(full_name)").order("id")
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1).abortSignal(signal);
    return { ...result, data: result.data?.map((enrollment) => ({ ...enrollment.students,
      class_id: enrollment.class_id, class_name: enrollment.classes.name, grade: enrollment.classes.grade
    })) };

  }, [yearId, classFilter, search, page]);
  const studentPage = usePagedQuery(loadStudents, page, setPage, 200, 0, refreshKey);
  const loadingData = studentPage.loading;
  const filteredRows = studentPage.data;

  useEffect(() => {
    if (!form || busy) return undefined;

    function closeOnEscape(event) {
      if (event.key === "Escape") {
        setForm(null);
        setError("");
      }
    }

    window.addEventListener("keydown", closeOnEscape);

    return () => {
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [form, busy]);

  const groupedRows = useMemo(() => {
    const groups = new Map();

    for (const student of filteredRows) {
      if (!groups.has(student.class_id)) {
        groups.set(student.class_id, {
          id: student.class_id,
          name: student.class_name,
          students: [],
        });
      }

      groups.get(student.class_id).students.push(student);
    }

    return [...groups.values()];
  }, [filteredRows]);

  const loading = loadingYears || loadingData;

  function refreshData() {
    setRefreshKey((previous) => previous + 1);
  }

  function changeYear(value) {
    setPage(0);
    setYearId(value);
    setClasses([]);
    setClassFilter("");
    setForm(null);
    setFamilyStudent(null);
    setImportOpen(false);
    setError("");
    setNotice("");
  }

  function openAdd() {
    setForm({
      ...EMPTY_FORM,
      class_id: classFilter || classes[0]?.id || "",
    });
    setError("");
    setNotice("");
  }

  function openEdit(student) {
    setForm({
      id: student.id,
      full_name: student.full_name || "",
      nis: student.nis || "",
      nisn: student.nisn || "",
      gender: student.gender || "",
      class_id: student.class_id,
    });
    setError("");
    setNotice("");
  }

  function changeField(field, value) {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));
    setError("");
  }

  async function saveStudent(event) {
    event.preventDefault();

    if (busy || !form) return;

    if (!form.class_id || form.full_name.trim().length < 2) {
      setError("Nama siswa dan kelas wajib diisi.");
      return;
    }

    setBusy(true);
    setError("");
    setNotice("");

    try {
      const { error: saveError } = await supabase.rpc(
        "save_student_with_class",
        {
          p_student_id: form.id,
          p_full_name: form.full_name.trim(),
          p_nis: form.nis.trim() || null,
          p_nisn: form.nisn.trim() || null,
          p_gender: form.gender || null,
          p_class_id: form.class_id,
        }
      );

      if (saveError) throw saveError;

      setNotice(
        form.id
          ? "Data siswa berhasil diperbarui."
          : "Siswa berhasil ditambahkan."
      );
      setForm(null);
      refreshData();
    } catch (saveError) {
      setError(getError(saveError));
    } finally {
      setBusy(false);
    }
  }

  function handleImported() {
    setNotice("Impor berhasil. Data siswa diperbarui.");
    refreshData();
  }

  return (
    <div className="students-page">
      <section className="students-panel">
        <div className="students-page-heading">
          <h2>Data Siswa</h2>
        </div>

        <div className="students-filter-bar">
          <label className="students-field">
            <span>Tahun Ajaran</span>
            <select
              value={yearId}
              disabled={loadingYears || busy}
              onChange={(event) => changeYear(event.target.value)}
            >
              {years.length === 0 && (
                <option value="">Belum ada tahun ajaran</option>
              )}
              {years.map((year) => (
                <option key={year.id} value={year.id}>
                  {year.start_year}/{year.start_year + 1}
                </option>
              ))}
            </select>
          </label>

          <label className="students-field">
            <span>Kelas</span>
            <select
              value={classFilter}
              disabled={loading || busy || !yearId}
              onChange={(event) =>
                { setPage(0); setClassFilter(event.target.value); }
              }
            >
              <option value="">Semua Kelas</option>
              {classes.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>

          <label className="students-field students-search-field">
            <span>Cari Siswa</span>
            <input
              type="search"
              value={search}
              placeholder="Nama, NIS, atau NISN"
              onChange={(event) => { setPage(0); setSearch(event.target.value); }}
            />
          </label>
        </div>
      </section>

      <section className="students-panel">
        <div className="students-list-heading">
          <div className="students-list-title">
            <h2>Daftar Siswa</h2>
            <p>
              {loading
                ? "Memuat data..."
                : `${studentPage.total} siswa ditemukan`}
            </p>
          </div>

          <div className="students-list-actions">
            <button
              type="button"
              className="students-secondary"
              disabled={loading || busy || classes.length === 0}
              onClick={() => {
                setImportOpen(true);
                setError("");
              }}
            >
              Impor Excel
            </button>

            <button
              type="button"
              className="students-primary students-add-button"
              disabled={loading || busy || classes.length === 0}
              onClick={openAdd}
            >
              <span aria-hidden="true">+</span>
              Tambah Siswa
            </button>
          </div>
        </div>

        {notice && (
          <p className="students-success" role="status">
            {notice}
          </p>
        )}

        {!form && (error || studentPage.error) && (
          <p className="students-error" role="alert">
            {error || studentPage.error}
          </p>
        )}

        {loading ? (
          <div className="students-empty">
            Memuat data siswa...
          </div>
        ) : !yearId ? (
          <div className="students-empty">
            Tambahkan tahun ajaran terlebih dahulu.
          </div>
        ) : classes.length === 0 ? (
          <div className="students-empty">
            Buat rombongan belajar melalui menu Kelas.
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="students-empty">
            {search || classFilter
              ? "Tidak ada siswa yang sesuai."
              : "Belum ada siswa. Gunakan Tambah Siswa atau Impor Excel."}
          </div>
        ) : (
          <div className="students-groups">
            {groupedRows.map((group) => (
              <section
                key={group.id}
                className="students-class-group"
              >
                <div className="students-class-heading">
                  <h3>{group.name}</h3>
                  <span>{group.students.length} siswa pada halaman ini</span>
                </div>

                <div className="students-table-wrap">
                  <table className="students-table">
                    <thead>
                      <tr>
                        <th>No.</th>
                        <th>Nama Siswa</th>
                        <th>NIS</th>
                        <th>NISN</th>
                        <th>Jenis Kelamin</th>
                        <th>Tindakan</th>
                      </tr>
                    </thead>

                    <tbody>
                      {group.students.map((student, index) => (
                        <tr key={student.id}>
                          <td>{index + 1}</td>
                          <td className="students-name">
                            {student.full_name}
                          </td>
                          <td>{student.nis || "—"}</td>
                          <td>{student.nisn || "—"}</td>
                          <td>
                            {student.gender === "male"
                              ? "Laki-laki"
                              : student.gender === "female"
                                ? "Perempuan"
                                : "—"}
                          </td>
                          <td>
                            <div className="students-row-actions">
                              <button
                                type="button"
                                className="students-edit"
                                onClick={() => openEdit(student)}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                className="students-edit"
                                onClick={() =>
                                  setFamilyStudent(student)
                                }
                              >
                                Orang Tua/Wali
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ))}
          </div>
        )}
      </section>

      <Pagination page={page} total={studentPage.total} loading={loading} onChange={setPage} />

      {form && (
        <div
          className="students-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !busy) {
              setForm(null);
              setError("");
            }
          }}
        >
          <section
            className="students-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="students-modal-title"
          >
            <div className="students-modal-header">
              <div>
                <h2 id="students-modal-title">
                  {form.id ? "Edit Siswa" : "Tambah Siswa"}
                </h2>
                </div>

              <button
                type="button"
                className="students-modal-close"
                aria-label="Tutup"
                disabled={busy}
                onClick={() => {
                  setForm(null);
                  setError("");
                }}
              >
                ×
              </button>
            </div>

            <form
              className="students-modal-form"
              onSubmit={saveStudent}
            >
              <div className="students-modal-body">
                <div className="students-form-grid">
                  <label className="students-field students-full">
                    <span>Nama Lengkap *</span>
                    <input
                      autoFocus
                      required
                      minLength={2}
                      maxLength={150}
                      value={form.full_name}
                      disabled={busy}
                      placeholder="Nama lengkap siswa"
                      onChange={(event) =>
                        changeField("full_name", event.target.value)
                      }
                    />
                  </label>

                  <label className="students-field">
                    <span>NIS</span>
                    <input
                      maxLength={30}
                      value={form.nis}
                      disabled={busy}
                      onChange={(event) =>
                        changeField("nis", event.target.value)
                      }
                    />
                  </label>

                  <label className="students-field">
                    <span>NISN</span>
                    <input
                      maxLength={30}
                      value={form.nisn}
                      disabled={busy}
                      onChange={(event) =>
                        changeField("nisn", event.target.value)
                      }
                    />
                  </label>

                  <label className="students-field">
                    <span>Jenis Kelamin</span>
                    <select
                      value={form.gender}
                      disabled={busy}
                      onChange={(event) =>
                        changeField("gender", event.target.value)
                      }
                    >
                      <option value="">Pilih Jenis Kelamin</option>
                      <option value="male">Laki-laki</option>
                      <option value="female">Perempuan</option>
                    </select>
                  </label>

                  <label className="students-field">
                    <span>Kelas *</span>
                    <select
                      required
                      value={form.class_id}
                      disabled={busy}
                      onChange={(event) =>
                        changeField("class_id", event.target.value)
                      }
                    >
                      <option value="">Pilih Kelas</option>
                      {classes.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                {error && (
                  <p className="students-error" role="alert">
                    {error}
                  </p>
                )}
              </div>

              <div className="students-modal-footer">
                <button
                  type="button"
                  className="students-secondary"
                  disabled={busy}
                  onClick={() => {
                    setForm(null);
                    setError("");
                  }}
                >
                  Batal
                </button>

                <button
                  type="submit"
                  className="students-primary"
                  disabled={busy}
                >
                  {busy
                    ? "Menyimpan..."
                    : form.id
                      ? "Simpan Perubahan"
                      : "Simpan Siswa"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {importOpen && (
        <Suspense fallback={<p role="status">Memuat…</p>}><StudentImport
          academicYearId={yearId}
          classes={classes}
          onClose={() => setImportOpen(false)}
          onImported={handleImported}
        /></Suspense>
      )}

      {familyStudent && (
        <StudentFamily
          student={familyStudent}
          onClose={() => setFamilyStudent(null)}
        />
      )}
    </div>
  );
}
