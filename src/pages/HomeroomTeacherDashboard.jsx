import InstallAppSettings from "../components/InstallAppSettings";
import EmptyState from "../components/EmptyState";

import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import useDisplayPage from "../lib/useDisplayPage";
import Pagination from "../components/Pagination";
import { fetchAll } from "../lib/pagination";
import { signOut } from "../lib/auth";
import usePanelHistory from "../hooks/usePanelHistory";
import useNotificationPulse from "../hooks/useNotificationPulse";
const MonthlyReports = lazy(() => import("./MonthlyReports"));
const ReportCards = lazy(() => import("./ReportCards"));
const ActivationBatch = lazy(() => import("./ActivationBatch"));
import AccountSecurity from "./AccountSecurity";
import StaffWorkspace, {
  StaffKpi,
  StaffMeter,
} from "../components/StaffWorkspace";

import "./TeacherDashboard.css";

const GROUPS = [
  {
    label: "Pemantauan Kelas",
    items: [
      {
        id: "daily",
        label: "Rekap Harian",
        icon: "home",
        mobileLabel: "Beranda",
      },
    ],
  },
  {
    label: "Orang Tua / Wali",
    items: [{ id: "activation", label: "Aktivasi Orang Tua", icon: "users" }],
  },
  {
    label: "Laporan & Rapor",
    items: [
      {
        id: "monthly",
        label: "Laporan Bulanan",
        icon: "chart",
        mobileLabel: "Laporan",
      },
      {
        id: "report",
        label: "Rapor",
        icon: "file",
      },
    ],
  },
  {
    label: "Pengaturan",
    items: [
      { id: "account", label: "Akun", icon: "shield" },
    ],
  },
  {
    label: "Pengaturan Perangkat",
    items: [{ id: "install-app", label: "Pasang Aplikasi", icon: "settings" }],
  },
];

const TABS = GROUPS.flatMap((group) => group.items);

const STATUS_LABELS = {
  finalized: "Final",
  draft: "Draf",
  unfilled: "Belum Diisi",
};

function todayInJakarta() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value])
  );

  return `${values.year}-${values.month}-${values.day}`;
}

function daysBefore(value, count) {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - count);
  return date.toISOString().slice(0, 10);
}

function formatDate(value) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  }).format(new Date(`${value}T12:00:00+07:00`));
}

function statusStyle(status) {
  if (status === "finalized") {
    return {
      background: "#e0f3e7",
      color: "#155e3b",
    };
  }

  if (status === "draft") {
    return {
      background: "#fff4d6",
      color: "#875a10",
    };
  }

  return {
    background: "#f2f4f3",
    color: "#67746d",
  };
}

export default function HomeroomTeacherDashboard({
  account,
  school,
  onLogout,
}) {
  const [today] = useState(todayInJakarta);
  const earliestDate = daysBefore(today, 365);

  const [activeTab, setActiveTab] = useState("daily");
  const [classes, setClasses] = useState([]);
  const [classId, setClassId] = useState("");
  const [selectedDate, setSelectedDate] = useState(today);
  const [students, setStudents] = useState([]);
  const display = useDisplayPage(students);

  const [loadingClasses, setLoadingClasses] = useState(true);
  const [loadingReport, setLoadingReport] = useState(false);
  const [error, setError] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);
  const [refresh, setRefresh] = useState(0);
  useNotificationPulse(() => setRefresh((n) => n + 1), Boolean(classId) && !loggingOut);
  const { push: pushPage } = usePanelHistory("homeroom", "daily", (page) => {
    if (TABS.some((item) => item.id === page)) { setActiveTab(page); setError(""); if (page === "daily") setRefresh((n) => n + 1); }
  });

  useEffect(() => {
    let cancelled = false;

    async function loadClasses() {
      try {
        const {
          data,
          error: queryError,
        } = await fetchAll(() => supabase.rpc(
          "get_mutabaah_accessible_classes"
        ).order("academic_year", { ascending: false }).order("grade").order("class_name"), ["class_id"]);

        if (queryError) throw queryError;
        if (cancelled) return;

        const rows = Array.isArray(data) ? data : [];

        setClasses(rows);
        setClassId((previous) =>
          rows.some((item) => item.class_id === previous)
            ? previous
            : rows[0]?.class_id || ""
        );
        setError("");
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError.message || "Gagal memuat kelas."
          );
        }
      } finally {
        if (!cancelled) setLoadingClasses(false);
      }
    }

    void loadClasses();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (
      !classId ||
      !selectedDate
    ) {
      return undefined;
    }

    let cancelled = false;

    async function loadReport() {
      setLoadingReport(true);
      try {
        const [reportResult, statusResult] =
          await Promise.all([
            supabase.rpc(
              "get_mutabaah_class_report",
              {
                p_class_id: classId,
                p_date: selectedDate,
              }
            ),
            supabase.rpc(
              "get_mutabaah_class_day_status",
              {
                p_class_id: classId,
                p_date: selectedDate,
              }
            ),
          ]);

        if (reportResult.error) throw reportResult.error;
        if (statusResult.error) throw statusResult.error;

        if (cancelled) return;

        const statusMap = new Map(
          (Array.isArray(statusResult.data)
            ? statusResult.data
            : []
          ).map((item) => [item.id, item.status])
        );

        const rows = Array.isArray(reportResult.data)
          ? reportResult.data
          : [];

        setStudents(
          rows.map((item) => ({
            ...item,
            submission_status:
              statusMap.get(item.id) || "unfilled",
          }))
        );

        setError("");
      } catch (loadError) {
        if (!cancelled) {
          setStudents([]);
          setError(
            loadError.message ||
              "Gagal memuat rekap harian."
          );
        }
      } finally {
        if (!cancelled) setLoadingReport(false);
      }
    }

    void loadReport();

    return () => {
      cancelled = true;
    };
  }, [classId, selectedDate, refresh]);

  const statusSummary = useMemo(() => {
    return students.reduce(
      (total, student) => {
        const status = student.submission_status;

        if (status in total) {
          total[status] += 1;
        } else {
          total.unfilled += 1;
        }

        return total;
      },
      {
        finalized: 0,
        draft: 0,
        unfilled: 0,
      }
    );
  }, [students]);

  function changeClass(value) {
    setClassId(value);
    setStudents([]);
    setError("");
    setLoadingReport(Boolean(value));
  }

  function changeDate(value) {
    if (
      !value ||
      value > today ||
      value < earliestDate
    ) {
      return;
    }

    setSelectedDate(value);
    setStudents([]);
    setError("");
    setLoadingReport(Boolean(classId));
  }

  function selectTab(tabId) {
    if (!TABS.some((item) => item.id === tabId) || tabId === activeTab) return;
    pushPage(tabId);
    setActiveTab(tabId);
    setError("");

    if (tabId === "daily") {
      setLoadingReport(Boolean(classId));
      setRefresh((value) => value + 1);
    }
  }

  function reloadReport() {
    if (!classId || loadingReport) return;

    setLoadingReport(true);
    setRefresh((value) => value + 1);
  }

  async function handleLogout() {
    if (loggingOut) return;

    setLoggingOut(true);
    setError("");

    try {
      await signOut();
      onLogout?.();
    } catch (logoutError) {
      setError(
        logoutError.message || "Gagal keluar."
      );
      setLoggingOut(false);
    }
  }

  const heading =
    activeTab === "daily"
      ? "Rekap Mutabaah"
      : activeTab === "monthly"
        ? "Laporan Mutabaah"
        : activeTab === "report"
          ? "Rapor Mutabaah"
          : activeTab === "activation"
            ? "Aktivasi Orang Tua"
          : "Pengaturan Akun";

  const pending =
    statusSummary.draft + statusSummary.unfilled;

  const currentClass = classes.find(
    (item) => item.class_id === classId
  );

  return (
    <StaffWorkspace
      role="Wali Kelas"
      title={activeTab === "install-app" ? "Pasang Aplikasi" : heading}
      account={account}
      school={school}
      groups={GROUPS}
      activeId={activeTab}
      onNavigate={selectTab}
      mobileIds={["daily", "monthly", "report"]}
      pendingCount={
        students.length > 0 ? pending : 0
      }
      noticeItems={
        students.length > 0 &&
        pending > 0
          ? [
              `${pending} siswa di ${
                currentClass?.class_name || "kelas"
              } belum final pada ${formatDate(selectedDate)}.`,
              `${statusSummary.draft} draf, ${
                statusSummary.unfilled
              } belum diisi.`,
            ]
          : []
      }
      onNoticeAction={() => selectTab("daily")}
      noticeActionLabel="Lihat rekap harian"
      onLogout={handleLogout}
      loggingOut={loggingOut}
    >
      <div className="staff-page-intro">
        <div>
          <h2>{heading}</h2>
          <p>
            {currentClass?.class_name || "Kelas Saya"} ·{" "}
            {account?.name || "Wali Kelas"}
          </p>
        </div>
      </div>

      {activeTab === "account" && (
        <AccountSecurity account={account} />
      )}

      {activeTab === "activation" && (
        <Suspense fallback={<p role="status">Memuat aktivasi...</p>}>
          <ActivationBatch isTeacher />
        </Suspense>
      )}

      {activeTab === "monthly" && (
        <Suspense fallback={<p role="status">Memuat…</p>}><MonthlyReports /></Suspense>
      )}

      {activeTab === "report" && (
        <Suspense fallback={<p role="status">Memuat…</p>}><ReportCards
          account={account}
          school={school}
        /></Suspense>
      )}

      {activeTab === "daily" && (
        <section className="teacher-panel">
          <div className="teacher-filters">
            <label>
              <span>Kelas</span>

              <select
                value={classId}
                disabled={loadingClasses}
                onChange={(event) =>
                  changeClass(event.target.value)
                }
              >
                {classes.length === 0 && (
                  <option value="">
                    Belum ada kelas
                  </option>
                )}

                {classes.map((item) => (
                  <option
                    key={item.class_id}
                    value={item.class_id}
                  >
                    {item.class_name} · {item.academic_year}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Tanggal</span>

              <input
                type="date"
                value={selectedDate}
                min={earliestDate}
                max={today}
                onChange={(event) =>
                  changeDate(event.target.value)
                }
              />
            </label>
          </div>

          {!loadingClasses &&
            !loadingReport &&
            students.length > 0 && (
              <div
                className="staff-kpis"
                style={{ marginTop: 18 }}
              >
                <StaffKpi
                  label="Siswa"
                  value={students.length}
                />

                <StaffKpi
                  label="Sudah final"
                  value={statusSummary.finalized}
                  detail={`${
                    Math.round(
                      (statusSummary.finalized /
                        students.length) *
                        100
                    )
                  }% hari ini`}
                />

                <StaffKpi
                  label="Draf"
                  value={statusSummary.draft}
                />

                <StaffKpi
                  label="Belum diisi"
                  value={statusSummary.unfilled}
                />
              </div>
            )}

          {!loadingClasses &&
            !loadingReport &&
            students.length > 0 && (
              <div
                className="staff-card"
                style={{ marginBottom: 18 }}
              >
                <div className="staff-card-head">
                  <h3>Progres kelas</h3>
                  <span className="staff-muted">
                    {formatDate(selectedDate)}
                  </span>
                </div>

                <StaffMeter
                  value={statusSummary.finalized}
                  total={students.length}
                />
              </div>
            )}

          {error && (
            <p className="teacher-error" role="alert">
              {error}
            </p>
          )}

          {!loadingClasses && Boolean(classId) && (
            <div className="teacher-table-header">
              <h2>Daftar Siswa</h2>
              <span>{formatDate(selectedDate)}</span>

              <button
                type="button"
                className="teacher-report-refresh"
                disabled={loadingReport}
                onClick={reloadReport}
              >
                Muat Ulang
              </button>
            </div>
          )}

          {loadingClasses || loadingReport ? (
            <div className="teacher-empty">
              Memuat...
            </div>
          ) : !classId ? (
            <EmptyState kind="school" illustration="class" title="Belum ada kelas yang ditugaskan" description="Hubungi administrator untuk penugasan kelas." />
          ) : students.length === 0 ? (
            <EmptyState kind="student" illustration="student" title="Belum ada siswa" description="Siswa yang terdaftar pada kelas ini akan muncul di sini." />
          ) : (
            <div className="teacher-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>No.</th>
                    <th>Nama Siswa</th>
                    <th>NIS</th>
                    <th>Ya</th>
                    <th>Tidak</th>
                    <th>Terisi</th>
                    <th>Status</th>
                  </tr>
                </thead>

                <tbody>
                  {display.rows.map((student, index) => (
                    <tr key={student.id}>
                      <td>{index + 1}</td>

                      <td className="teacher-student-name">
                        {student.name}
                      </td>

                      <td>{student.nis || "—"}</td>
                      <td>{student.yes_count}</td>
                      <td>{student.no_count}</td>

                      <td>
                        {student.filled_count}/
                        {student.total_count}
                      </td>

                      <td>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "5px 9px",
                            borderRadius: 7,
                            fontSize: 12,
                            fontWeight: 600,
                            ...statusStyle(
                              student.submission_status
                            ),
                          }}
                        >
                          {STATUS_LABELS[
                            student.submission_status
                          ] || "Belum Diisi"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Pagination page={display.page} total={students.length} loading={loadingReport} onChange={display.setPage} />
            </div>
          )}
        </section>
      )}
      {activeTab === "install-app" && <InstallAppSettings />}
    </StaffWorkspace>
  );
}
