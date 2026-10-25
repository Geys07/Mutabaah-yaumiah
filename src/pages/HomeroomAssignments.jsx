import EmptyState from "../components/EmptyState";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { fetchAll } from "../lib/pagination";
import { listenStudentDataChanges } from "../lib/studentDataUpdates";
import TeacherAccounts from "./TeacherAccounts";
import "./HomeroomAssignments.css";

const TABS = [
  { id: "accounts", label: "Akun Guru" },
  { id: "assignments", label: "Penugasan Kelas" },
];

export default function HomeroomAssignments() {
  const [activeTab, setActiveTab] = useState("accounts");
  const [years, setYears] = useState([]);
  const [yearId, setYearId] = useState("");
  const [classes, setClasses] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [assignments, setAssignments] = useState({});
  const [drafts, setDrafts] = useState({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [refresh, setRefresh] = useState(0);

  useEffect(() => listenStudentDataChanges(() => {
    if (!document.hidden) setRefresh((value) => value + 1);
  }), []);

  useEffect(() => {
    if (activeTab !== "assignments") {
      return undefined;
    }

    let cancelled = false;

    async function loadData() {
      try {
        const [
          yearResult,
          classResult,
          roleResult,
          assignmentResult,
        ] = await Promise.all([
          supabase
            .from("academic_years")
            .select("id, start_year")
            .order("start_year", { ascending: false }),

          fetchAll(() => supabase
            .from("classes")
            .select(
              "id, name, grade, academic_year_id"
            )
            .order("grade")
            .order("name"), ["id"]),

          fetchAll(() => supabase
            .from("user_roles")
            .select("user_id")
            .eq("role", "homeroom_teacher"), ["user_id","role"]),

          fetchAll(() => supabase
            .from("homeroom_assignments")
            .select("class_id, teacher_id"), ["class_id","teacher_id"]),
        ]);

        const requestError =
          yearResult.error ||
          classResult.error ||
          roleResult.error ||
          assignmentResult.error;

        if (requestError) {
          throw requestError;
        }

        const teacherIds = [
          ...new Set(
            (roleResult.data || []).map(
              (item) => item.user_id
            )
          ),
        ];

        let teacherRows = [];

        for (
          let offset = 0;
          offset < teacherIds.length;
          offset += 200
        ) {
          const { data, error: teacherError } =
            await fetchAll(() => supabase
              .from("profiles")
              .select(
                "user_id, full_name, phone, account_status"
              )
              .in(
                "user_id",
                teacherIds.slice(offset, offset + 200)
              ), ["user_id"]);

          if (teacherError) {
            throw teacherError;
          }

          teacherRows = [
            ...teacherRows,
            ...(data || []),
          ];
        }

        if (cancelled) return;

        const yearRows = yearResult.data || [];
        const nextAssignments = {};

        for (const item of assignmentResult.data || []) {
          nextAssignments[item.class_id] =
            item.teacher_id;
        }

        setYears(yearRows);

        setYearId((previous) =>
          yearRows.some((item) => item.id === previous)
            ? previous
            : yearRows[0]?.id || ""
        );

        setClasses(classResult.data || []);

        setTeachers(
          teacherRows
            .filter(
              (teacher) =>
                teacher.account_status === "active"
            )
            .sort((a, b) =>
              a.full_name.localeCompare(
                b.full_name,
                "id"
              )
            )
        );

        setAssignments(nextAssignments);
        setDrafts(nextAssignments);
        setError("");
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError.message ||
              "Gagal memuat penugasan."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadData();

    return () => {
      cancelled = true;
    };
  }, [activeTab, refresh]);

  const visibleClasses = useMemo(() => {
    return classes
      .filter(
        (item) => item.academic_year_id === yearId
      )
      .sort(
        (a, b) =>
          a.grade - b.grade ||
          a.name.localeCompare(b.name, "id")
      );
  }, [classes, yearId]);

  function selectTab(tabId) {
    if (savingId) return;

    setActiveTab(tabId);
    setError("");
    setNotice("");

    if (tabId === "assignments") {
      setLoading(true);
      setRefresh((previous) => previous + 1);
    }
  }

  function changeTeacher(classId, teacherId) {
    setDrafts((previous) => ({
      ...previous,
      [classId]: teacherId,
    }));

    setError("");
    setNotice("");
  }

  async function saveAssignment(classId) {
    if (savingId) return;

    const teacherId = drafts[classId] || null;

    setSavingId(classId);
    setError("");
    setNotice("");

    try {
      const { error: saveError } =
        await supabase.rpc(
          "set_homeroom_teacher",
          {
            p_class_id: classId,
            p_teacher_id: teacherId,
          }
        );

      if (saveError) {
        throw saveError;
      }

      setAssignments((previous) => ({
        ...previous,
        [classId]: teacherId,
      }));

      setNotice("Penugasan tersimpan.");
    } catch (saveError) {
      setError(
        saveError.message ||
          "Gagal menyimpan penugasan."
      );
    } finally {
      setSavingId("");
    }
  }

  function reload() {
    if (savingId) return;

    setLoading(true);
    setError("");
    setNotice("");
    setRefresh((previous) => previous + 1);
  }

  return (
    <div className="homeroom-page">
      <div
        className="homeroom-tabs"
        role="tablist"
        aria-label="Pengelolaan guru"
      >
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            className={
              activeTab === tab.id ? "active" : ""
            }
            disabled={Boolean(savingId)}
            onClick={() => selectTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "accounts" && (
        <TeacherAccounts />
      )}

      {activeTab === "assignments" && (
        <section className="homeroom-panel">
          <header className="homeroom-heading">
            <h2>Penugasan Wali Kelas</h2>

            <button
              type="button"
              className="homeroom-secondary"
              disabled={
                loading || Boolean(savingId)
              }
              onClick={reload}
            >
              Muat Ulang
            </button>
          </header>

          <div className="homeroom-filters">
            <label>
              <span>Tahun Ajaran</span>

              <select
                value={yearId}
                disabled={
                  loading || Boolean(savingId)
                }
                onChange={(event) =>
                  setYearId(event.target.value)
                }
              >
                {years.length === 0 && (
                  <option value="">
                    Belum ada tahun ajaran
                  </option>
                )}

                {years.map((item) => (
                  <option
                    value={item.id}
                    key={item.id}
                  >
                    {item.start_year}/
                    {item.start_year + 1}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {error && (
            <p
              className="homeroom-error"
              role="alert"
            >
              {error}
            </p>
          )}

          {notice && (
            <p
              className="homeroom-success"
              role="status"
            >
              {notice}
            </p>
          )}

          {loading ? (
            <div className="homeroom-empty">
              Memuat...
            </div>
          ) : visibleClasses.length === 0 ? (
            <EmptyState kind="school" illustration="class" title="Belum ada kelas" description="Tambahkan kelas sebelum menentukan wali kelas." />
          ) : (
            <div className="homeroom-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Kelas</th>
                    <th>Wali Kelas</th>
                    <th>Tindakan</th>
                  </tr>
                </thead>

                <tbody>
                  {visibleClasses.map(
                    (schoolClass) => {
                      const current =
                        assignments[schoolClass.id] ||
                        "";

                      const selected =
                        drafts[schoolClass.id] || "";

                      const changed =
                        current !== selected;

                      return (
                        <tr className="homeroom-assignment-row"
                          key={schoolClass.id}
                        >
                          <td className="homeroom-class" data-label="Kelas">
                            {schoolClass.name}
                          </td>

                          <td className="homeroom-assignment-teacher" data-label="Wali Kelas">
                            <select
                              aria-label={`Wali kelas ${schoolClass.name}`}
                              value={selected}
                              disabled={Boolean(savingId)}
                              onChange={(event) =>
                                changeTeacher(
                                  schoolClass.id,
                                  event.target.value
                                )
                              }
                            >
                              <option value="">
                                Belum ditugaskan
                              </option>

                              {teachers.map(
                                (teacher) => (
                                  <option
                                    key={
                                      teacher.user_id
                                    }
                                    value={
                                      teacher.user_id
                                    }
                                  >
                                    {
                                      teacher.full_name
                                    }
                                  </option>
                                )
                              )}
                            </select>
                          </td>

                          <td className="homeroom-assignment-action" data-label="Tindakan">
                            <button
                              type="button"
                              className="homeroom-primary"
                              disabled={
                                !changed ||
                                Boolean(savingId)
                              }
                              onClick={() =>
                                saveAssignment(
                                  schoolClass.id
                                )
                              }
                            >
                              {savingId ===
                              schoolClass.id
                                ? "Menyimpan..."
                                : "Simpan"}
                            </button>
                          </td>
                        </tr>
                      );
                    }
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
