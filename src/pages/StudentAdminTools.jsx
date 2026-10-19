
import { lazy, Suspense,
  useCallback,
  useState,
} from "react";

import { supabase } from "../lib/supabase";
import { fetchAll, searchFilter, literalPattern, PAGE_SIZE } from "../lib/pagination";
import usePagedQuery from "../lib/usePagedQuery";
import Pagination from "../components/Pagination";
const StudentImport = lazy(() => import("./StudentImport"));
import "./StudentAdminTools.css";

function getToday() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const p = Object.fromEntries(
    parts.map(({ type, value }) => [type, value])
  );

  return `${p.year}-${p.month}-${p.day}`;
}

function err(error) {
  return error?.message || "Permintaan tidak berhasil.";
}

export default function StudentAdminTools({ onChanged }) {
  const [tab, setTab] = useState("intake");
  const [years, setYears] = useState([]);
  const [year, setYear] = useState("");
  const [currentYear, setCurrentYear] = useState("");
  const [mode, setMode] = useState("combined");
  const [modal, setModal] = useState(false);
  const [importConfig, setImportConfig] = useState(null);

  const [classes, setClasses] = useState([]);
  const [page, setPage] = useState(0);

  const [selectedStudent, setSelectedStudent] =
    useState("");

  const [returnClass, setReturnClass] = useState("");
  const [search, setSearch] = useState("");

  const [busy, setBusy] = useState(false);

  const [refresh, setRefresh] = useState(0);

  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async (signal) => {
    const today = getToday();
    const [yearsResult, classesResult] = await Promise.all([
      fetchAll(() => supabase.from("academic_years").select("id,start_year,starts_on,ends_on").order("start_year", { ascending: false }), ["id"], signal),
      fetchAll(() => supabase.from("classes").select("id,name,grade,academic_year_id").order("grade").order("name"), ["id"], signal),
    ]);
    if (yearsResult.error || classesResult.error) return { error: yearsResult.error || classesResult.error };
    if (signal.aborted) return { data: [], count: 0 };
    const yearsData = yearsResult.data;
    const classesData = classesResult.data;
    const thisYear = yearsData.find((y) => y.starts_on <= today && y.ends_on >= today);
    setYears(yearsData); setClasses(classesData); setCurrentYear(thisYear?.id || "");
    setYear((old) => yearsData.some((y) => y.id === old) ? old : thisYear?.id || yearsData[0]?.id || "");
    const classIds = classesData.filter((c) => c.academic_year_id === thisYear?.id).map((c) => c.id);
    setReturnClass((old) => classIds.includes(old) ? old : classIds[0] || "");
    if (tab === "intake" || (tab === "exit" && !classIds.length)) return { data: [], count: 0 };
    const active = tab === "exit";
    let query;
    if (active) {
      const aliases = search.trim() ? ",student_match:students(),class_match:classes()" : "";
      query = supabase.from("student_enrollments").select(
        "id,class_id,students!inner(id,full_name,nis,nisn,status),classes!inner(name,academic_year_id)" + aliases,
        { count: "exact" }).is("ends_on", null).eq("classes.academic_year_id", thisYear.id).eq("students.status", "active");
      if (search.trim()) query = query
        .or(searchFilter(["full_name", "nis", "nisn"], search), { referencedTable: "student_match" })
        .ilike("class_match.name", literalPattern(search))
        .or("student_match.not.is.null,class_match.not.is.null");
      query = query.order("students(full_name)").order("id");
    } else {
      query = supabase.from("students").select("id,full_name,nis,nisn,status", { count: "exact" }).eq("status", "exited");
      if (search.trim()) query = query.or(searchFilter(["full_name", "nis", "nisn"], search));
      query = query.order("full_name").order("id");
    }
    const result = await query.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1).abortSignal(signal);
    return { ...result, data: result.data?.map((row) => active
      ? { ...row.students, className: row.classes.name, classId: row.class_id }
      : row) };

  }, [tab, search, page]);
  const lifecyclePage = usePagedQuery(load, page, setPage, 200, 0, refresh);
  const loading = lifecyclePage.loading;
  const activeRows = tab === "exit" ? lifecyclePage.data : [];
  const exitedRows = tab === "return" ? lifecyclePage.data : [];

  const currentClasses = classes.filter(
    (c) =>
      c.academic_year_id === currentYear
  );

  function reload(message) {
    setNotice(message || "");
    setRefresh((n) => n + 1);
    onChanged?.();
  }

  async function prepareImport() {
    if (!year || busy) return;

    setBusy(true);
    setError("");

    try {
      const academic = years.find(
        (y) => y.id === year
      );

      const { data, error: problem } =
        await supabase.rpc(
          "prepare_mutabaah_grade_seven",
          {
            p_start_year: academic.start_year,
            p_split: mode === "split",
          }
        );

      if (problem) throw problem;

      const classIds = [
        data.class_a,
        data.class_b,
      ].filter(Boolean);

      const {
        data: picked,
        error: queryError,
      } = await supabase
        .from("classes")
        .select("id,name,grade")
        .in("id", classIds)
        .order("name");

      if (queryError) throw queryError;

      setImportConfig({
        yearId: year,
        classes: picked || [],
      });

      setModal(false);
      reload("");
    } catch (cause) {
      setError(err(cause));
    } finally {
      setBusy(false);
    }
  }

  async function changeStatus(action) {
    const student = (
      action === "exit"
        ? activeRows
        : exitedRows
    ).find((s) => s.id === selectedStudent);

    if (!student || busy) return;

    if (
      action === "return" &&
      !returnClass
    ) {
      setError(
        "Pilih kelas tujuan terlebih dahulu."
      );
      return;
    }

    const text =
      action === "exit"
        ? `Tandai ${student.full_name} sebagai siswa keluar? Riwayat Mutabaah dan akun wali tetap tersimpan.`
        : `Aktifkan kembali ${student.full_name} menggunakan ID siswa dan akun wali yang sama?`;

    if (!window.confirm(text)) return;

    setBusy(true);
    setError("");

    try {
      const { error: problem } =
        await supabase.rpc(
          "admin_change_student_lifecycle",
          {
            p_student_id: selectedStudent,
            p_action: action,
            p_target_class_id:
              action === "return"
                ? returnClass
                : null,
          }
        );

      if (problem) throw problem;

      setSelectedStudent("");

      reload(
        action === "exit"
          ? "Status siswa menjadi Keluar. Riwayat tetap tersimpan."
          : "Siswa berhasil kembali aktif dengan ID lama."
      );
    } catch (cause) {
      setError(err(cause));
    } finally {
      setBusy(false);
    }
  }

  const list =
    tab === "exit"
      ? activeRows
      : exitedRows;

  const selected = list.find(
    (s) => s.id === selectedStudent
  );

  return (
    <section className="sat-panel">
      <header className="sat-heading">
        <div>
          <h2>Administrasi Siswa</h2>
          <p>
            Siswa baru kelas VII, siswa keluar
            dan kembali — riwayat tetap disimpan.
          </p>
        </div>
      </header>

      <nav
        className="sat-tabs"
        aria-label="Administrasi siswa"
      >
        {[
          {
            id: "intake",
            label: "Siswa Baru VII",
          },
          {
            id: "exit",
            label: "Siswa Keluar",
          },
          {
            id: "return",
            label: "Aktifkan Kembali",
          },
        ].map((item) => (
          <button
            type="button"
            key={item.id}
            className={
              tab === item.id
                ? "is-active"
                : ""
            }
            onClick={() => {
              setPage(0);
              setTab(item.id);
              setSelectedStudent("");
              setError("");
            }}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {(error || lifecyclePage.error) && (
        <p className="sat-error" role="alert">
          {error || lifecyclePage.error}
        </p>
      )}

      {notice && (
        <p className="sat-success" role="status">
          {notice}
        </p>
      )}

      {tab === "intake" && (
        <div className="sat-intake">
          <div>
            <strong>
              Impor Excel khusus kelas VII
            </strong>

            <p>
              Untuk siswa baru. Duplikat NIS,
              NISN, atau nama akan ditolak oleh
              sistem impor yang sudah ada.
            </p>
          </div>

          <button
            type="button"
            disabled={busy || loading}
            onClick={() => setModal(true)}
          >
            Siapkan Impor VII
          </button>
        </div>
      )}

      {tab !== "intake" && (
        <div className="sat-lifecycle">
          <label className="sat-search">
            Cari siswa

            <input
              type="search"
              placeholder="Nama, NIS, atau NISN"
              value={search}
              onChange={(e) =>
                { setPage(0); setSelectedStudent(""); setSearch(e.target.value); }
              }
            />
          </label>

          {loading ? (
            <p>Memuat daftar siswa…</p>
          ) : !currentYear ? (
            <p>
              Belum ada tahun ajaran yang
              sedang berjalan.
            </p>
          ) : (
            <>
              <label className="sat-search">
                Pilih siswa

                <select
                  value={selectedStudent}
                  onChange={(e) =>
                    setSelectedStudent(
                      e.target.value
                    )
                  }
                >
                  <option value="">
                    Pilih dari {lifecyclePage.total} siswa
                  </option>

                  {list.map((s) => (
                    <option
                      key={s.id}
                      value={s.id}
                    >
                      {s.full_name}
                      {s.className
                        ? ` — ${s.className}`
                        : ""}
                    </option>
                  ))}
                </select>
              </label>

              <Pagination page={page} total={lifecyclePage.total} loading={loading || busy} onChange={(next) => { setSelectedStudent(""); setPage(next); }} />

              {selected && (
                <p className="sat-selected">
                  {selected.full_name} ·{" "}
                  {selected.nis ||
                    "NIS belum diisi"}
                </p>
              )}

              {tab === "return" && (
                <label className="sat-search">
                  Kelas tujuan tahun berjalan

                  <select
                    value={returnClass}
                    onChange={(e) =>
                      setReturnClass(
                        e.target.value
                      )
                    }
                  >
                    <option value="">
                      Pilih kelas
                    </option>

                    {currentClasses.map((c) => (
                      <option
                        key={c.id}
                        value={c.id}
                      >
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <button
                type="button"
                disabled={
                  busy ||
                  !selected ||
                  (
                    tab === "return" &&
                    !returnClass
                  )
                }
                onClick={() =>
                  void changeStatus(tab)
                }
              >
                {busy
                  ? "Memproses…"
                  : tab === "exit"
                    ? "Tetapkan Siswa Keluar"
                    : "Aktifkan Kembali"}
              </button>
            </>
          )}
        </div>
      )}

      {modal && (
        <div
          className="sat-overlay"
          role="presentation"
          onMouseDown={(e) => {
            if (
              e.target === e.currentTarget &&
              !busy
            ) {
              setModal(false);
            }
          }}
        >
          <section
            className="sat-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="sat-modal-title"
          >
            <h3 id="sat-modal-title">
              Siapkan impor siswa kelas VII
            </h3>

            <label>
              Tahun ajaran

              <select
                value={year}
                onChange={(e) =>
                  setYear(e.target.value)
                }
              >
                {years.map((y) => (
                  <option
                    key={y.id}
                    value={y.id}
                  >
                    {y.start_year}/
                    {y.start_year + 1}
                  </option>
                ))}
              </select>
            </label>

            <fieldset>
              <legend>
                Model rombongan belajar
              </legend>

              <label>
                <input
                  type="radio"
                  checked={
                    mode === "combined"
                  }
                  onChange={() =>
                    setMode("combined")
                  }
                />
                Gabungan — VII A saja
              </label>

              <label>
                <input
                  type="radio"
                  checked={mode === "split"}
                  onChange={() =>
                    setMode("split")
                  }
                />
                Terpisah — VII A dan VII B
              </label>
            </fieldset>

            <p>
              Template impor bawaan tetap
              dipakai. Isi kolom Kelas dengan
              VII A atau VII B sesuai pilihan.
            </p>

            <div className="sat-dialog-actions">
              <button
                type="button"
                className="is-secondary"
                disabled={busy}
                onClick={() => setModal(false)}
              >
                Batal
              </button>

              <button
                type="button"
                disabled={busy || !year}
                onClick={() =>
                  void prepareImport()
                }
              >
                {busy
                  ? "Menyiapkan…"
                  : "Lanjut ke Impor"}
              </button>
            </div>
          </section>
        </div>
      )}

      {importConfig && (
        <Suspense fallback={<p role="status">Memuat…</p>}><StudentImport
          academicYearId={importConfig.yearId}
          classes={importConfig.classes}
          onClose={() =>
            setImportConfig(null)
          }
          onImported={() => {
            setImportConfig(null);
            reload(
              "Impor kelas VII berhasil disimpan."
            );
          }}
        /></Suspense>
      )}
    </section>
  );
}
