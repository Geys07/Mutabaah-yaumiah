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
import useJakartaClock from "../hooks/useJakartaClock";
const MonthlyReports = lazy(() => import("./MonthlyReports"));
const ReportCards = lazy(() => import("./ReportCards"));
import AccountSecurity from "./AccountSecurity";
import StaffWorkspace, {
  StaffKpi,
} from "../components/StaffWorkspace";

import "./PrincipalDashboard.css";

const GROUPS = [
  {
    label: "Pemantauan",
    items: [
      {
        id: "overview",
        label: "Ringkasan Sekolah",
        icon: "home",
        mobileLabel: "Beranda",
      },
    ],
  },
  {
    label: "Laporan",
    items: [
      {
        id: "monthly",
        label: "Laporan Bulanan",
        icon: "chart",
        mobileLabel: "Laporan",
      },
      {
        id: "reports",
        label: "Arsip Rapor",
        icon: "file",
        mobileLabel: "Rapor",
      },
    ],
  },
  {
    label: "Pengaturan",
    items: [
      {
        id: "account",
        label: "Akun",
        icon: "shield",
      },
    ],
  },
  {
    label: "Pengaturan Perangkat",
    items: [{ id: "install-app", label: "Pasang Aplikasi", icon: "settings" }],
  },
];

const MENUS = GROUPS.flatMap((group) => group.items);

const STATUS = {
  finalized: { text: "Final", style: "done" },
  draft: { text: "Draf", style: "draft" },
  unfilled: { text: "Belum diisi", style: "empty" },
};

function prettyDate(date) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`));
}

function oneYearAgo(date) {
  const parsed = new Date(`${date}T12:00:00Z`);
  parsed.setUTCDate(parsed.getUTCDate() - 365);
  return parsed.toISOString().slice(0, 10);
}

function normalizeStatus(value) {
  return Object.hasOwn(STATUS, value)
    ? value
    : "unfilled";
}

function summarizeStatuses(rows) {
  const count = {
    finalized: 0,
    draft: 0,
    unfilled: 0,
  };

  for (const item of rows) {
    count[normalizeStatus(item.status)] += 1;
  }

  return count;
}

function percent(part, total) {
  return total ? Math.round((100 * part) / total) : 0;
}

async function fetchClassSummaries(
  items,
  date,
  stillActive
) {
  const results = [];

  // Maksimal 4 kelas diproses secara bersamaan.
  for (let offset = 0; offset < items.length; offset += 4) {
    if (!stillActive()) return null;

    const batch = items.slice(offset, offset + 4);

    const fetched = await Promise.all(
      batch.map(async (item) => {
        try {
          const {
            data,
            error,
          } = await supabase.rpc(
            "get_mutabaah_class_day_status",
            {
              p_class_id: item.class_id,
              p_date: date,
            }
          );

          if (error) throw error;

          if (!Array.isArray(data)) {
            throw new Error(
              "Format status kelas tidak sesuai."
            );
          }

          return {
            ...item,
            ...summarizeStatuses(data),
            total: data.length,
            failed: false,
          };
        } catch (error) {
          return {
            ...item,
            finalized: 0,
            draft: 0,
            unfilled: 0,
            total: 0,
            failed: true,
            reason: error?.message || "Gagal membaca kelas",
          };
        }
      })
    );

    results.push(...fetched);
  }

  return results;
}

export default function PrincipalDashboard({
  account,
  school,
  onLogout,
}) {
  const clock = useJakartaClock();

  const [tab, setTab] = useState("overview");
  const [classes, setClasses] = useState([]);
  const [year, setYear] = useState("");
  const [date, setDate] = useState(() => clock.date);
  const [reload, setReload] = useState(0);
  useNotificationPulse(() => setReload((n) => n + 1), Boolean(year) && !loggingOut);

  const [loadingClasses, setLoadingClasses] = useState(true);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [summaries, setSummaries] = useState([]);

  const [selectedClassId, setSelectedClassId] = useState("");
  const [detail, setDetail] = useState([]);
  const display = useDisplayPage(detail);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const [error, setError] = useState("");
  const [detailError, setDetailError] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const { push: pushPage } = usePanelHistory("principal", "overview", (page) => {
    if (MENUS.some((item) => item.id === page)) { setTab(page); if (page === "overview") setReload((n) => n + 1); }
  });

  const schoolYears = useMemo(
    () => [...new Set(classes.map((c) => c.academic_year))],
    [classes]
  );

  const shownClasses = useMemo(
    () =>
      classes.filter((c) => c.academic_year === year),
    [classes, year]
  );

  const total = useMemo(() => {
    const good = summaries.filter((c) => !c.failed);

    return {
      classes: good.length,
      students: good.reduce(
        (n, c) => n + c.total,
        0
      ),
      finalized: good.reduce(
        (n, c) => n + c.finalized,
        0
      ),
      draft: good.reduce(
        (n, c) => n + c.draft,
        0
      ),
      unfilled: good.reduce(
        (n, c) => n + c.unfilled,
        0
      ),
      failed: summaries.filter(
        (c) => c.failed
      ).length,
    };
  }, [summaries]);

  const selectedClass = shownClasses.find(
    (c) => c.class_id === selectedClassId
  );

  useEffect(() => {
    let active = true;

    async function getClasses() {
      try {
        const {
          data,
          error: queryError,
        } = await fetchAll(() => supabase.rpc(
          "get_mutabaah_accessible_classes"
        ).order("academic_year", { ascending: false }).order("grade").order("class_name"), ["class_id"]);

        if (queryError) throw queryError;
        if (!active) return;

        const items = Array.isArray(data) ? data : [];

        setClasses(items);
        setYear(items[0]?.academic_year || "");
        setLoadingSummary(items.length > 0);
        setError("");
      } catch (caught) {
        if (active) {
          setError(
            caught.message || "Kelas tidak dapat dimuat."
          );
        }
      } finally {
        if (active) setLoadingClasses(false);
      }
    }

    void getClasses();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (
      !year ||
      shownClasses.length === 0
    ) {
      return undefined;
    }

    let active = true;

    async function load() {
      const data = await fetchClassSummaries(
        shownClasses,
        date,
        () => active
      );

      if (!active || !data) return;

      setSummaries(data);
      setLoadingSummary(false);
    }

    void load();

    return () => {
      active = false;
    };
  }, [year, date, reload, shownClasses]);

  useEffect(() => {
    if (
      tab !== "overview" ||
      !selectedClassId
    ) {
      return undefined;
    }

    let active = true;

    async function loadDetail() {
      try {
        const [
          studentsResult,
          statusesResult,
        ] = await Promise.all([
          supabase.rpc(
            "get_mutabaah_class_report",
            {
              p_class_id: selectedClassId,
              p_date: date,
            }
          ),
          supabase.rpc(
            "get_mutabaah_class_day_status",
            {
              p_class_id: selectedClassId,
              p_date: date,
            }
          ),
        ]);

        if (studentsResult.error) throw studentsResult.error;
        if (statusesResult.error) throw statusesResult.error;

        const statusMap = new Map(
          (statusesResult.data || []).map(
            (s) => [s.id, s.status]
          )
        );

        if (active) {
          setDetail(
            (studentsResult.data || []).map((item) => ({
              ...item,
              status: normalizeStatus(
                statusMap.get(item.id)
              ),
            }))
          );
          setDetailError("");
        }
      } catch (caught) {
        if (active) {
          setDetail([]);
          setDetailError(
            caught.message ||
              "Rincian siswa gagal dimuat."
          );
        }
      } finally {
        if (active) setLoadingDetail(false);
      }
    }

    void loadDetail();

    return () => {
      active = false;
    };
  }, [tab, selectedClassId, date, reload]);

  async function logout() {
    if (loggingOut) return;

    setLoggingOut(true);
    setLogoutError("");

    try {
      await signOut();
      onLogout?.();
    } catch (caught) {
      setLogoutError(
        caught?.message || "Gagal keluar akun."
      );
      setLoggingOut(false);
    }
  }

  function updateYear(value) {
    setYear(value);
    setSelectedClassId("");
    setDetail([]);
    setSummaries([]);
    setLoadingSummary(true);
  }

  function updateDate(value) {
    if (
      !value ||
      value > clock.date ||
      value < oneYearAgo(clock.date)
    ) {
      return;
    }

    setDate(value);
    setSummaries([]);
    setDetail([]);
    setLoadingSummary(true);
    setLoadingDetail(Boolean(selectedClassId));
  }

  function selectClass(id) {
    setSelectedClassId(id);
    setDetail([]);
    setDetailError("");
    setLoadingDetail(true);
  }

  function changeTab(id) {
    if (!MENUS.some((item) => item.id === id) || id === tab) return;
    pushPage(id);
    setTab(id);

    if (id === "overview") {
      setLoadingSummary(true);
      setLoadingDetail(Boolean(selectedClassId));
      setReload((value) => value + 1);
    }
  }

  function refresh() {
    setLoadingSummary(true);
    setLoadingDetail(Boolean(selectedClassId));
    setReload((n) => n + 1);
  }

  const notices = [];

  if (total.unfilled + total.draft > 0) {
    notices.push(
      `${
        total.draft + total.unfilled
      } siswa belum final pada ${
        prettyDate(date)
      }.`
    );
  }

  if (total.failed > 0) {
    notices.push(
      `${total.failed} kelas gagal dimuat. Silakan muat ulang rekap.`
    );
  }

  return (
    <StaffWorkspace
      role="Kepala Sekolah"
      title={
        MENUS.find((item) => item.id === tab)?.label ||
        "Pemantauan"
      }
      account={account}
      school={school}
      groups={GROUPS}
      activeId={tab}
      onNavigate={changeTab}
      mobileIds={[
        "overview",
        "monthly",
        "reports",
      ]}
      pendingCount={
        total.unfilled + total.draft
      }
      noticeItems={notices}
      onNoticeAction={() => changeTab("overview")}
      noticeActionLabel="Lihat ringkasan"
      onLogout={logout}
      loggingOut={loggingOut}
    >
      {logoutError && (
        <div role="alert" className="principal-alert">
          {logoutError}
        </div>
      )}

      <div className="staff-page-intro">
        <div>
          <h2>
            {tab === "overview"
              ? "Pemantauan Mutabaah Sekolah"
              : MENUS.find((item) => item.id === tab)?.label}
          </h2>
        </div>
      </div>

      {tab === "overview" && (
        <section className="principal-section">
          <div className="principal-section-head">
            <div>
              <h2>Rekap Mutabaah Sekolah</h2>
            </div>

            <button
              type="button"
              className="principal-refresh"
              onClick={refresh}
              disabled={loadingClasses || loadingSummary}
            >
              Muat ulang
            </button>
          </div>

          <div className="principal-filters">
            <label>
              Tahun ajaran
              <select
                value={year}
                disabled={loadingClasses}
                onChange={(e) => updateYear(e.target.value)}
              >
                {schoolYears.length === 0 && (
                  <option value="">
                    Belum tersedia
                  </option>
                )}

                {schoolYears.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Tanggal
              <input
                type="date"
                value={date}
                min={oneYearAgo(clock.date)}
                max={clock.date}
                onChange={(e) => updateDate(e.target.value)}
              />
            </label>
          </div>

          {error && (
            <p className="principal-alert" role="alert">
              {error}
            </p>
          )}

          {total.failed > 0 && !loadingSummary && (
            <p className="principal-alert" role="alert">
              {total.failed} kelas belum berhasil dibaca.
              Angka ringkasan hanya menghitung kelas yang
              berhasil dimuat.
            </p>
          )}

          {loadingClasses ||
          (shownClasses.length > 0 && loadingSummary) ? (
            <p className="principal-info" role="status">
              Memuat rekap kelas...
            </p>
          ) : (
            <>
              <div className="staff-kpis">
                <StaffKpi
                  label="Kelas terbaca"
                  value={`${total.classes}/${shownClasses.length}`}
                />
                <StaffKpi
                  label="Jumlah siswa"
                  value={total.students}
                />
                <StaffKpi
                  label="Sudah final"
                  value={total.finalized}
                  detail={`${
                    percent(total.finalized, total.students)
                  }% dari siswa`}
                />
                <StaffKpi
                  label="Belum final"
                  value={total.draft + total.unfilled}
                  detail={
                    `${total.draft} draf · ` +
                    `${total.unfilled} belum diisi`
                  }
                />
              </div>

              {total.students > 0 && (
                <p className="principal-completion">
                  Sudah final:{" "}
                  <strong>
                    {percent(
                      total.finalized,
                      total.students
                    )}%
                  </strong>{" "}
                  dari siswa yang tercatat pada tanggal{" "}
                  {prettyDate(date)}.
                </p>
              )}

              <div className="principal-table-scroll">
                <table className="principal-table">
                  <thead>
                    <tr>
                      <th>Kelas</th>
                      <th>Jumlah Siswa</th>
                      <th>Final</th>
                      <th>Draf</th>
                      <th>Belum diisi</th>
                      <th></th>
                    </tr>
                  </thead>

                  <tbody>
                    {summaries.map((item) => (
                      <tr key={item.class_id}>
                        <td>
                          <strong>{item.class_name}</strong>
                        </td>

                        {item.failed ? (
                          <td
                            colSpan="4"
                            className="principal-muted"
                          >
                            Gagal membaca data kelas
                          </td>
                        ) : (
                          <>
                            <td>{item.total}</td>
                            <td>{item.finalized}</td>
                            <td>{item.draft}</td>
                            <td>{item.unfilled}</td>
                          </>
                        )}

                        <td>
                          <button
                            type="button"
                            className="principal-detail-button"
                            disabled={item.failed}
                            onClick={() =>
                              selectClass(item.class_id)
                            }
                          >
                            Lihat siswa
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {summaries.length === 0 && (
                <EmptyState kind="school" illustration="class" title="Belum ada data kelas" description="Belum ada kelas atau data untuk periode ini." />
              )}
            </>
          )}

          {selectedClassId && selectedClass && (
            <div className="principal-detail">
              <div className="principal-section-head">
                <div>
                  <h3>
                    Rincian {selectedClass.class_name}
                  </h3>
                  <p>
                    {prettyDate(date)}
                  </p>
                </div>

                <button
                  type="button"
                  className="principal-refresh"
                  onClick={() => setSelectedClassId("")}
                >
                  Tutup
                </button>
              </div>

              {detailError && (
                <p
                  role="alert"
                  className="principal-alert"
                >
                  {detailError}
                </p>
              )}

              {loadingDetail ? (
                <p role="status" className="principal-info">
                  Memuat rincian siswa...
                </p>
              ) : (
                <div className="principal-table-scroll">
                  <table className="principal-table">
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
                          <td>
                            <strong>{student.name}</strong>
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
                              className={
                                `principal-status ` +
                                STATUS[student.status].style
                              }
                            >
                              {STATUS[student.status].text}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
              <Pagination page={display.page} total={detail.length} loading={loadingDetail} onChange={display.setPage} />
                </div>
              )}

              {!loadingDetail &&
                !detailError &&
                detail.length === 0 && (
                  <EmptyState kind="student" illustration="student" title="Belum ada siswa" description="Belum ada siswa pada tanggal tersebut." />
                )}
            </div>
          )}
        </section>
      )}

      {tab === "monthly" && <Suspense fallback={<p role="status">Memuat…</p>}><MonthlyReports /></Suspense>}

      {tab === "reports" && (
        <Suspense fallback={<p role="status">Memuat…</p>}><ReportCards
          account={account}
          school={school}
        /></Suspense>
      )}

      {tab === "account" && (
        <AccountSecurity account={account} />
      )}
      {tab === "install-app" && <InstallAppSettings />}
    </StaffWorkspace>
  );
}
