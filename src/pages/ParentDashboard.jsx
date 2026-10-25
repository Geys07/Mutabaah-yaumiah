import { setParentEditorOpen } from "../lib/parentEditorState";
import InstallAppSettings from "../components/InstallAppSettings";
import EmptyState from "../components/EmptyState";

import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { fetchAll } from "../lib/pagination";
import { signOut } from "../lib/auth";
import usePanelHistory from "../hooks/usePanelHistory";
import useNotificationPulse from "../hooks/useNotificationPulse";
import { announceNotificationChange } from "../lib/notificationUpdates";
import { SCHOOL_LOGO_URL } from "../lib/branding";
import { getRandomQuote } from "../data/islamicQuotes";
import StudentAvatar from "../components/StudentAvatar";
import { createAvatarVariants } from "../lib/avatarVariants";
import ParentDaily from "./ParentDaily";
import ParentCalendar from "./ParentCalendar";
import AccountSecurity from "./AccountSecurity";
import "./ParentDashboard.css";
import "../styles/comfort-motion.css";

const MENU = [
  { id: "today", label: "Beranda", icon: "home" },
  { id: "calendar", label: "Kalender", icon: "calendar" },
  { id: "profile", label: "Profil", icon: "user" },
];

function Icon({ name, size = 21 }) {
  const shapes = {
    home: (
      <>
        <path d="m3 10 9-7 9 7v10H3Z" />
        <path d="M9 20v-7h6v7" />
      </>
    ),
    calendar: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M7 3v4M17 3v4M3 10h18M8 14h2M14 14h2" />
      </>
    ),
    user: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4.5 21a7.5 7.5 0 0 1 15 0" />
      </>
    ),
    left: <path d="m15 18-6-6 6-6" />,
    right: <path d="m9 18 6-6-6-6" />,
    close: <path d="M18 6 6 18M6 6l12 12" />,
    plus: <path d="M12 5v14M5 12h14" />,
    check: <path d="m4 12 5 5 11-11" />,
    pencil: (
      <path d="m13 6 5 5M3 21l4.5-1 12-12a2.1 2.1 0 0 0-5-5l-12 12L3 21Z" />
    ),
    info: (
      <>
        <circle cx="12" cy="12" r="10" />
        <path d="M12 11v5M12 7h.01" />
      </>
    ),
    sun: (
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.65 17.65l1.42 1.42M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.65 6.35l1.42-1.42" />
      </>
    ),
    moon: (
      <path d="M20.9 13A9 9 0 0 1 11 3.1 9 9 0 1 0 20.9 13Z" />
    ),
    book: (
      <>
        <path d="M12 6c-4-3-7-3-10-2v14c3-1 6-1 10 2 4-3 7-3 10-2V4c-3-1-6-1-10 2Z" />
        <path d="M12 6v14" />
      </>
    ),
    logout: (
      <>
        <path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4" />
        <path d="M13 16l4-4-4-4M9 12h8" />
      </>
    ),
  };

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.85"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {shapes[name] || shapes.info}
    </svg>
  );
}

function jakartaNow() {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Jakarta",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date())
      .map(({ type, value }) => [type, value])
  );

  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    hour: Number(parts.hour),
  };
}

function timeTheme(hour) {
  if (hour >= 4 && hour < 11) {
    return {
      key: "pagi",
      greeting: "Selamat pagi",
      icon: "sun",
    };
  }

  if (hour >= 11 && hour < 15) {
    return {
      key: "siang",
      greeting: "Selamat siang",
      icon: "sun",
    };
  }

  if (hour >= 15 && hour < 18) {
    return {
      key: "sore",
      greeting: "Selamat sore",
      icon: "sun",
    };
  }

  return {
    key: "malam",
    greeting: "Selamat malam",
    icon: "moon",
  };
}

function addDays(value, amount) {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

function fullDate(value) {
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T12:00:00Z`));
}

function monthName(value) {
  return new Intl.DateTimeFormat("id-ID", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value.slice(0, 7)}-01T12:00:00Z`));
}

function monthLength(value) {
  const [year, month] = value
    .slice(0, 7)
    .split("-")
    .map(Number);

  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function dayStatus(status) {
  if (status === "finalized") {
    return {
      label: "Selesai",
      kind: "complete",
      heading: "Pengisian telah selesai",
      detail:
        "Mutabaah sudah difinalisasi. Terima kasih telah mendampingi ananda.",
      icon: "check",
    };
  }

  if (status === "draft") {
    return {
      label: "Draf",
      kind: "draft",
      heading: "Mutabaah masih draf",
      detail:
        "Lanjutkan pengisian dan finalisasi agar tercatat sebagai selesai.",
      icon: "pencil",
    };
  }

  return {
    label: "Belum diisi",
    kind: "unfilled",
    heading: "Mutabaah belum diisi",
    detail:
      "Mari dampingi ananda mengisi kegiatan hari ini.",
    icon: "info",
  };
}


function ChildChoice({
  student,
  variant,
  selected,
  onClick,
}) {
  return (
    <button
      type="button"
      className={`pd-child-choice${
        selected ? " is-selected" : ""
      }`}
      aria-pressed={selected}
      onClick={onClick}
    >
      <StudentAvatar
        student={student}
        variant={variant}
      />

      <strong>{student.full_name}</strong>

      <small>
        {student.className
          ? `Kelas ${student.className}`
          : "Kelas belum tersedia"}
      </small>

      {selected && (
        <span className="pd-choice-check">
          <Icon name="check" size={12} />
        </span>
      )}
    </button>
  );
}

export default function ParentDashboard({
  account,
  school,
  onLogout,
}) {
  const [clock, setClock] = useState(jakartaNow);
  const [tab, setTab] = useState("today");
  const [selectedDate, setSelectedDate] =
    useState(clock.date);

  const [dailyOpen, setDailyOpen] = useState(false);
  const [children, setChildren] = useState([]);
  const [studentId, setStudentId] = useState("");
  const [loadingChildren, setLoadingChildren] =
    useState(true);

  const [childrenRevision, setChildrenRevision] =
    useState(0);
  const [statusRevision, setStatusRevision] =
    useState(0);

  const [selectedStatuses, setSelectedStatuses] =
    useState([]);
  const [currentStatuses, setCurrentStatuses] =
    useState([]);
  const [statusLoading, setStatusLoading] =
    useState(false);
  const [statusError, setStatusError] =
    useState("");

  const [chooserOpen, setChooserOpen] = useState(false);

const [loggingOut, setLoggingOut] =
    useState(false);

  useNotificationPulse(
    () => setStatusRevision((value) => value + 1),
    Boolean(studentId) && !loggingOut
  );


  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const { push: pushPage, replace: replacePage } = usePanelHistory("parent", "today", (page) => {
    setDailyOpen(false);
    setChooserOpen(false);
    if (page.startsWith("daily:")) { setSelectedDate(page.slice(6)); setDailyOpen(true); }
    else if (page === "chooser") setChooserOpen(true);
    else if (MENU.some((item) => item.id === page) || page === "install-app") setTab(page);
  });
  const [quote] = useState(() => getRandomQuote());

  const today = clock.date;
  const theme = timeTheme(clock.hour);
  const earliest = addDays(today, -29);

  const currentMonth = `${today.slice(0, 7)}-01`;
  const selectedMonth =
    `${selectedDate.slice(0, 7)}-01`;

  const parentName =
    account?.name ||
    account?.full_name ||
    "Orang Tua";

  const accountId =
    account?.id ||
    account?.user_id ||
    "";
  // Sesudah Admin menghubungkan anak di perangkat lain, perbarui daftar
  // ketika wali kembali membuka PWA. Tidak perlu notifikasi khusus.
  useEffect(() => {
    if (!accountId) return undefined;
    const refresh = () => {
      if (!document.hidden) setChildrenRevision((n) => n + 1);
    };
    const timer = window.setInterval(refresh, 45000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [accountId]);


  const assetBase = (
    import.meta.env.BASE_URL || "/"
  ).replace(/\/?$/, "/");

  const imageRoot =
    `${assetBase}header/header-${theme.key}`;

  useEffect(() => {
    function refreshClock() {
      const next = jakartaNow();

      setClock((old) =>
        old.date === next.date &&
        old.hour === next.hour
          ? old
          : next
      );

      if (next.date !== today) {
        setSelectedDate((old) =>
          old === today ? next.date : old
        );
      }
    }

    const timer = window.setInterval(
      refreshClock,
      60_000
    );

    window.addEventListener("focus", refreshClock);
    document.addEventListener(
      "visibilitychange",
      refreshClock
    );

    return () => {
      window.clearInterval(timer);
      window.removeEventListener(
        "focus",
        refreshClock
      );
      document.removeEventListener(
        "visibilitychange",
        refreshClock
      );
    };
  }, [today]);

  useEffect(() => {
    let cancelled = false;

    async function loadChildren() {
      if (!accountId) {
        setError("Identitas akun tidak ditemukan.");
        setLoadingChildren(false);
        return;
      }

      try {
        const {
          data: relations,
          error: relationError,
        } = await fetchAll(() => supabase
          .from("student_guardians")
          .select("student_id")
          .eq("guardian_id", accountId), ["student_id","guardian_id"]);

        if (relationError) {
          throw relationError;
        }

        const ids = [
          ...new Set(
            (relations || []).map(
              ({ student_id }) => student_id
            )
          ),
        ];

        if (ids.length === 0) {
          if (!cancelled) {
            setChildren([]);
            setStudentId("");
            setError("");
          }
          return;
        }

        let students = [];

        for (
          let index = 0;
          index < ids.length;
          index += 200
        ) {
          const {
            data,
            error: studentError,
          } = await fetchAll(() => supabase
            .from("students")
            .select(
              "id, full_name, gender, nis, status"
            )
            .in(
              "id",
              ids.slice(index, index + 200)
            ), ["id"]);

          if (studentError) throw studentError;

          students = students.concat(data || []);
        }

        if (cancelled) return;

        try {
          const enrollments = [];
          for (let i = 0; i < ids.length; i += 200) {
            const { data, error } = await fetchAll(() => supabase.from("student_enrollments")
              .select("student_id,starts_on,ends_on,classes(name,academic_years(starts_on,ends_on))")
              .in("student_id", ids.slice(i, i + 200)).order("starts_on", { ascending: false }), ["id"]);
            if (error) throw error;
            if (cancelled) return;
            enrollments.push(...data);
          }
          enrollments.sort((a, b) => b.starts_on.localeCompare(a.starts_on));

          const best = new Map();

          for (const row of enrollments || []) {
            const active =
              row.starts_on <= today &&
              (
                !row.ends_on ||
                row.ends_on >= today
              );

            const yr =
              row.classes?.academic_years;

            const activeYear =
              !yr ||
              (
                yr.starts_on <= today &&
                yr.ends_on >= today
              );

            if (
              !best.has(row.student_id) ||
              (
                active &&
                activeYear &&
                !best.get(row.student_id).active
              )
            ) {
              best.set(row.student_id, {
                active: active && activeYear,
                name: row.classes?.name || "",
              });
            }
          }

          students = students.map((student) => ({
            ...student,
            className:
              best.get(student.id)?.name || "",
          }));
        } catch {
          // Data kelas yang belum lengkap tidak
          // menghalangi pengisian Mutabaah.
        }

        students.sort((a, b) =>
          a.full_name.localeCompare(
            b.full_name,
            "id"
          )
        );

        if (!cancelled) {
          setChildren(students);

          setStudentId((old) =>
            students.some(
              (student) => student.id === old
            )
              ? old
              : students[0]?.id || ""
          );

          setError("");
        }
      } catch (caught) {
        if (!cancelled) {
          setError(
            caught?.message ||
            "Gagal memuat data anak."
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingChildren(false);
        }
      }
    }

    void loadChildren();

    return () => {
      cancelled = true;
    };
  }, [accountId, childrenRevision, today]);

  useEffect(() => {
    if (!studentId) return undefined;

    let cancelled = false;

    async function loadStatuses() {
      setStatusLoading(true);
      setStatusError("");

      try {
        const request = (month) =>
          supabase.rpc(
            "get_parent_mutabaah_month_status",
            {
              p_student_id: studentId,
              p_month: month,
            }
          );

        const current = request(currentMonth);

        const selected =
          selectedMonth === currentMonth
            ? current
            : request(selectedMonth);

        const [
          currentResult,
          selectedResult,
        ] = await Promise.all([
          current,
          selected,
        ]);

        if (currentResult.error) {
          throw currentResult.error;
        }

        if (selectedResult.error) {
          throw selectedResult.error;
        }

        if (!cancelled) {
          setCurrentStatuses(
            Array.isArray(currentResult.data)
              ? currentResult.data
              : []
          );

          setSelectedStatuses(
            Array.isArray(selectedResult.data)
              ? selectedResult.data
              : []
          );
        }
      } catch (caught) {
        if (!cancelled) {
          setStatusError(
            caught?.message ||
            "Gagal memuat rekap."
          );
          setSelectedStatuses([]);
          setCurrentStatuses([]);
        }
      } finally {
        if (!cancelled) {
          setStatusLoading(false);
        }
      }
    }

    void loadStatuses();

    return () => {
      cancelled = true;
    };
  }, [
    studentId,
    selectedMonth,
    currentMonth,
    statusRevision,
  ]);

  const closeOverlay = useCallback(() => {
    const route = window.history.state?.__mutabaahNav;
    if (route?.scope === "parent" &&
        (route.page?.startsWith("daily:") || route.page === "chooser")) {
      window.history.back();
    } else {
      setDailyOpen(false);
      setChooserOpen(false);
      replacePage(tab);
    }
  }, [replacePage, tab]);

  useEffect(() => {
    if (!dailyOpen && !chooserOpen) {
      return undefined;
    }

    function escape(event) {
      if (event.key !== "Escape") return;

      closeOverlay();
    }

    window.addEventListener("keydown", escape);

    return () =>
      window.removeEventListener("keydown", escape);
  }, [
    dailyOpen,
    chooserOpen,
    closeOverlay,
  ]);

  const selectedChild = children.find(
    (child) => child.id === studentId
  );

  const avatarVariants = useMemo(
    () => createAvatarVariants(children),
    [children]
  );

  const avatarOf = (child) =>
    child
      ? avatarVariants.get(child.id) ?? 0
      : 0;

  const selectedStatus =
    selectedStatuses.find(
      (row) => row.date === selectedDate
    )?.status || "unfilled";

  const day = dayStatus(selectedStatus);

  const completed = currentStatuses.filter(
    (row) => row.status === "finalized"
  ).length;

  const drafts = currentStatuses.filter(
    (row) => row.status === "draft"
  ).length;

  const total = monthLength(today);
  const remaining = Math.max(
    0,
    total - completed - drafts
  );

  const percentage = total
    ? Math.round((100 * completed) / total)
    : 0;

  function selectChild(next) {
    setStudentId(next);
    setSelectedDate(today);
    setChooserOpen(false);
    setDailyOpen(false);
    replacePage(tab);
    setError("");
    setMessage("");
    setStatusRevision((n) => n + 1);
  }

  function navigate(next) {
    if (next === tab) return;
    pushPage(next);
    setTab(next);
    setDailyOpen(false);
    setError("");
    setMessage("");

    if (next === "today") {
      setSelectedDate(today);
    }

    const reduced = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)"
    )?.matches;

    window.requestAnimationFrame(() =>
      window.scrollTo({
        top: 0,
        behavior: reduced ? "auto" : "smooth",
      })
    );
  }

  function openDay(date = today) {
    if (!selectedChild) return;

    if (
      !date ||
      date < earliest ||
      date > today
    ) {
      return;
    }

    pushPage(`daily:${date}`);
    setSelectedDate(date);
    setDailyOpen(true);
  }

  async function logout() {
    if (loggingOut) return;

    setLoggingOut(true);
    setError("");

    try {
      await signOut();
      onLogout?.();
    } catch (caught) {
      setError(
        caught?.message ||
        "Gagal keluar akun."
      );
      setLoggingOut(false);
    }
  }

  function renderChildren() {
    if (loadingChildren) {
      return (
        <p className="pd-muted">
          Memuat data anak...
        </p>
      );
    }

    if (children.length === 0) {
      return (
        <div className="pd-no-child">
          <EmptyState kind="people" illustration="parent" title="Belum ada anak terhubung"
            description="Hubungi Admin madrasah untuk menghubungkan data anak dengan akun Anda." />
        </div>
      );
    }

    if (children.length === 1) {
      return (
        <div className="pd-current-child">
          <StudentAvatar
            student={selectedChild}
            variant={avatarOf(selectedChild)}
          />

          <div>
            <strong>{selectedChild.full_name}</strong>
            <small>
              {selectedChild.className
                ? `Kelas ${selectedChild.className}`
                : "Kelas belum tersedia"}
            </small>
          </div>
        </div>
      );
    }

    if (children.length === 2) {
      return (
        <div className="pd-two-children">
          {children.map((child) => (
            <ChildChoice
              key={child.id}
              student={child}
              variant={avatarOf(child)}
              selected={child.id === studentId}
              onClick={() => selectChild(child.id)}
            />
          ))}
        </div>
      );
    }

    return (
      <button
        type="button"
        className="pd-current-child pd-current-child-button"
        onClick={() => { pushPage("chooser"); setChooserOpen(true); }}
        aria-label="Pilih anak"
      >
        <StudentAvatar
          student={selectedChild}
          variant={avatarOf(selectedChild)}
        />

        <div>
          <strong>
            {selectedChild?.full_name || "Pilih Anak"}
          </strong>

          <small>
            {selectedChild?.className
              ? `Kelas ${selectedChild.className}`
              : "Kelas belum tersedia"}
          </small>

          <span>
            {children.length} anak terhubung · Pilih Anak
          </span>
        </div>

        <span className="pd-child-arrow">
          <Icon name="right" />
        </span>
      </button>
    );
  }

  useLayoutEffect(() => {
    setParentEditorOpen(dailyOpen);
    return () => setParentEditorOpen(false);
  }, [dailyOpen]);

  function navButtons() {
    return MENU.map(({ id, label, icon }) => (
      <button
        type="button"
        key={id}
        className={tab === id || (id === "profile" && tab === "install-app") ? "is-active" : ""}
        aria-current={
          tab === id ? "page" : undefined
        }
        onClick={() => navigate(id)}
      >
        <span className="pd-nav-icon">
          <Icon name={icon} size={20} />

        </span>

        <span>{label}</span>
      </button>
    ));
  }

  return (
    <div
      className="pd-app"
      data-theme={theme.key}
    >
      <aside
        className="pd-sidebar"
        aria-label="Menu Orang Tua"
      >
        <div className="pd-sidebar-brand">
          <img
            src={school?.logoUrl || SCHOOL_LOGO_URL}
            alt={`Logo ${school?.name || "madrasah"}`}
          />

          <strong>
            {school?.appName || "Mutabaah Yaumiah"}
          </strong>

          <small>
            {school?.name || "Madrasah"}
          </small>
        </div>

        <nav className="pd-sidebar-nav">
          {navButtons()}
        </nav>

        <button
          type="button"
          className="pd-sidebar-logout"
          disabled={loggingOut}
          onClick={() => void logout()}
        >
          <Icon name="logout" size={19} />
          Keluar Akun
        </button>
      </aside>

      <div className="pd-workspace">
        <header className="pd-hero">
          <picture
            className="pd-hero-picture"
            aria-hidden="true"
          >
            <source
              media="(max-width: 899px)"
              srcSet={`${imageRoot}-mobile.webp`}
            />

            <img
              src={`${imageRoot}.webp`}
              alt=""
              decoding="async"
              fetchPriority="high"
              draggable={false}
            />
          </picture>

          <div
            className="pd-hero-tint"
            aria-hidden="true"
          />

          <div className="pd-hero-inner">
            <div className="pd-hero-top">
              <div className="pd-hero-brand">
                <img
                  src={school?.logoUrl || SCHOOL_LOGO_URL}
                  alt={`Logo ${school?.name || "madrasah"}`}
                />

                <div>
                  <strong>
                    {school?.appName || "Mutabaah Yaumiah"}
                  </strong>

                  <small>
                    {school?.name || "Madrasah"}
                  </small>
                </div>
              </div>

              <div className="pd-hero-actions">
                <button
                  type="button"
                  className="pd-account-pill"
                  onClick={() => navigate("profile")}
                >
                  <Icon name="user" size={18} />
                  <span>{parentName}</span>
                  <Icon name="right" size={14} />
                </button>
              </div>
            </div>

            <div className="pd-hero-greeting">
              <Icon
                name={theme.icon}
                size={28}
              />

              <div>
                <span>{theme.greeting},</span>
                <strong>{parentName}</strong>
              </div>
            </div>
          </div>
        </header>

        <main className="pd-main">
          {tab !== "profile" && tab !== "install-app" && (
            <section
              className="pd-identity-card"
              aria-label="Identitas anak"
            >
              {renderChildren()}
            </section>
          )}

          {message && (
            <p className="pd-message" role="status">
              {message}
            </p>
          )}

          {error &&
&& (
            <p className="pd-error" role="alert">
              {error}
            </p>
          )}

          <div
            key={tab}
            className="pd-page-appear"
          >
            {tab === "today" && (
              <div className="pd-home-layout">
                <div className="pd-primary-grid">
                  <section className="pd-card pd-recap-card">
                    <header className="pd-card-heading">
                      <h2>
                        <span className="pd-section-icon">
                          <Icon name="calendar" size={17} />
                        </span>
                        Rekap Bulan Ini
                      </h2>

                      <small>{monthName(today)}</small>
                    </header>

                    <div className="pd-recap-body">
                      <div
                        className="pd-ring"
                        style={{
                          "--pd-progress": `${percentage}%`,
                        }}
                        role="img"
                        aria-label={`${percentage} persen hari sudah difinalisasi`}
                      >
                        <div>
                          {statusLoading
                            ? "…"
                            : statusError
                              ? "—"
                              : `${percentage}%`}
                        </div>
                      </div>

                      <div className="pd-recap-numbers">
                        <strong>
                          {statusLoading
                            ? "Memuat..."
                            : statusError
                              ? "Rekap belum tersedia"
                              : `${completed} dari ${total} hari`}
                        </strong>

                        <span>
                          sudah difinalisasi
                        </span>

                        <div className="pd-progress-track">
                          <i
                            style={{
                              width: `${percentage}%`,
                            }}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="pd-recap-legend">
                      <span>
                        <i className="done" />
                        {completed} Selesai
                      </span>

                      <span>
                        <i className="draft" />
                        {drafts} Draf
                      </span>

                      <span>
                        <i className="empty" />
                        {remaining} Belum diisi
                      </span>
                    </div>

                    {statusError && (
                      <p
                        className="pd-error"
                        role="alert"
                      >
                        {statusError}
                      </p>
                    )}
                  </section>

                  <section className="pd-card pd-today-card">
                    <header className="pd-card-heading">
                      <h2>
                        <span className="pd-section-icon">
                          <Icon name="calendar" size={17} />
                        </span>
                        Mutabaah Hari Ini
                      </h2>

                      <span
                        className={`pd-status ${day.kind}`}
                      >
                        {day.label}
                      </span>
                    </header>

                    <div className="pd-date-nav">
                      <button
                        type="button"
                        aria-label="Hari sebelumnya"
                        disabled={selectedDate <= earliest}
                        onClick={() =>
                          setSelectedDate(
                            addDays(selectedDate, -1)
                          )
                        }
                      >
                        <Icon name="left" size={19} />
                      </button>

                      <strong>
                        {fullDate(selectedDate)}
                      </strong>

                      <button
                        type="button"
                        aria-label="Hari berikutnya"
                        disabled={selectedDate >= today}
                        onClick={() =>
                          setSelectedDate(
                            addDays(selectedDate, 1)
                          )
                        }
                      >
                        <Icon name="right" size={19} />
                      </button>
                    </div>

                    <div className="pd-status-message">
                      <span>
                        <Icon
                          name={day.icon}
                          size={22}
                        />
                      </span>

                      <div>
                        <strong>
                          {selectedChild
                            ? day.heading
                            : "Belum ada anak terhubung"}
                        </strong>

                        <small>
                          {selectedChild
                            ? day.detail
                            : "Hubungi Admin madrasah untuk menghubungkan data anak."}
                        </small>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="pd-primary-button"
                      onClick={() => openDay(selectedDate)}
                      disabled={!selectedChild}
                    >
                      {!selectedChild
                        ? "Belum ada anak terhubung"
                        : selectedStatus === "finalized"
                          ? "Lihat / Edit Mutabaah"
                          : selectedStatus === "draft"
                            ? "Lanjutkan Mutabaah"
                            : "Isi Mutabaah"}

                      <Icon name="right" size={19} />
                    </button>
                  </section>
                </div>

                <div className="pd-secondary-grid">
                  <section className="pd-card pd-shortcuts">
                    <header className="pd-card-heading">
                      <h2>
                        <span className="pd-section-icon">
                          <Icon name="book" size={17} />
                        </span>
                        Menu Cepat
                      </h2>
                    </header>

                    <div className="pd-shortcut-grid">
                      <button
                        type="button"
                        onClick={() => openDay(today)}
                        disabled={!selectedChild}
                      >
                        <span className="green">
                          <Icon name="book" />
                        </span>
                        Isi Mutabaah
                      </button>

                      <button
                        type="button"
                        onClick={() => navigate("calendar")}
                      >
                        <span className="blue">
                          <Icon name="calendar" />
                        </span>
                        Kalender
                      </button>

                      <button
                        type="button"
                        onClick={() => navigate("profile")}
                      >
                        <span className="purple">
                          <Icon name="user" />
                        </span>
                        Profil
                      </button>
                    </div>
                  </section>

                  <section className="pd-card pd-quran-card">
                    <div className="pd-quote-title">
                      <span aria-hidden="true">“</span>
                      <h2>Ayat Al-Qur’an Hari Ini</h2>
                    </div>

                    {quote ? (
                      <>
                        <p
                          className="pd-quran-arabic"
                          lang="ar"
                          dir="rtl"
                        >
                          {quote.arabic}
                        </p>

                        <p className="pd-quran-translation">
                          “{quote.translation}”
                        </p>

                        <small className="pd-quran-source">
                          {quote.source}
                        </small>
                      </>
                    ) : (
                      <p className="pd-quran-translation">
                        Kutipan Al-Qur’an sedang disiapkan.
                      </p>
                    )}

                    <span
                      className="pd-quote-decoration"
                      aria-hidden="true"
                    >
                      ۞
                    </span>
                  </section>
                </div>
              </div>
            )}

            {tab === "calendar" && (
              <section className="pd-card pd-page-card">
                <header className="pd-page-title">
                  <h1>Kalender Mutabaah</h1>
                  <small>
                    {selectedChild?.full_name || ""}
                  </small>
                </header>

                {loadingChildren ? (
                  <p className="pd-muted">
                    Memuat kalender...
                  </p>
                ) : selectedChild ? (
                  <ParentCalendar
                    key={`${studentId}-${statusRevision}`}
                    studentId={studentId}
                    selectedDate={selectedDate}
                    maxDate={today}
                    minEditableDate={earliest}
                    onSelectDate={openDay}
                  />
                ) : (
                  <p className="pd-muted">
                    Hubungi Admin madrasah untuk menghubungkan data anak.
                  </p>
                )}

                <p className="pd-calendar-help">
                  <Icon name="info" size={18} />
                  Pilih tanggal (maksimal 30 hari terakhir).
                </p>
              </section>
            )}

            {tab === "install-app" && <>
              <button type="button" className="pd-outline-button" onClick={() => navigate("profile")}>Kembali ke Profil</button>
              <InstallAppSettings />
            </>}

            {tab === "profile" && (
              <section className="pd-card pd-page-card">
                <header className="pd-page-title">
                  <h1>Profil Orang Tua</h1>
                  <small>Informasi akun</small>
                </header>

                <div className="pd-profile-user">
                  <span>
                    <Icon name="user" size={25} />
                  </span>

                  <div>
                    <strong>{parentName}</strong>
                    <small>
                      {account?.phone ||
                        "Nomor HP tidak tersedia"}
                    </small>
                  </div>
                </div>

                <h2 className="pd-children-title">
                  Anak yang Terhubung
                </h2>

                {children.map((child) => (
                  <div
                    className="pd-profile-child"
                    key={child.id}
                  >
                    <StudentAvatar
                      student={child}
                      variant={avatarOf(child)}
                    />

                    <div>
                      <strong>{child.full_name}</strong>
                      <small>
                        {child.className
                          ? `Kelas ${child.className}`
                          : "Kelas belum tersedia"}
                      </small>

                      {child.nis && (
                        <small>NIS: {child.nis}</small>
                      )}
                    </div>
                  </div>
                ))}
                <p className="pd-muted">Penambahan anak ditangani Admin madrasah. Hubungi Admin jika ada anak yang belum tampil.</p>

                <AccountSecurity account={account} />

                <hr className="install-menu-separator" />
                <button type="button" className="pd-outline-button" onClick={() => navigate("install-app")}>Panduan Aplikasi</button>

                <button
                  type="button"
                  className="pd-logout-button"
                  disabled={loggingOut}
                  onClick={() => void logout()}
                >
                  {loggingOut
                    ? "Memproses..."
                    : "Keluar Akun"}
                </button>
              </section>
            )}
          </div>
        </main>

        <nav
          className="pd-bottom-nav"
          aria-label="Navigasi Orang Tua"
        >
          {navButtons()}
        </nav>
      </div>

      {dailyOpen && selectedChild && (
        <div
          className="pd-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeOverlay();
            }
          }}
        >
          <section
            className="pd-modal pd-daily-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pd-form-title"
          >
            <header className="pd-daily-header">
              <button
                type="button"
                className="pd-modal-close"
                aria-label="Tutup formulir"
                onClick={closeOverlay}
              >
                <Icon name="close" />
              </button>

              <h2 id="pd-form-title">
                Mutabaah Harian
              </h2>

              <small>{fullDate(selectedDate)}</small>

              <div className="pd-modal-child">
                <StudentAvatar
                  student={selectedChild}
                  variant={avatarOf(selectedChild)}
                />

                <div>
                  <strong>{selectedChild.full_name}</strong>
                  <small>
                    {selectedChild.className
                      ? `Kelas ${selectedChild.className}`
                      : "Kelas belum tersedia"}
                  </small>
                </div>
              </div>
            </header>

            <div className="pd-daily-scroll">
              <ParentDaily
                key={`${studentId}-${selectedDate}`}
                studentId={studentId}
                selectedDate={selectedDate}
                maxDate={today}
                onSaved={() => announceNotificationChange()}
                onFinalized={closeOverlay}
              />
            </div>
          </section>
        </div>
      )}

      {chooserOpen && children.length > 2 && (
        <div
          className="pd-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeOverlay();
            }
          }}
        >
          <section
            className="pd-modal pd-chooser-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pd-choose-title"
          >
            <button
              type="button"
              className="pd-modal-close"
              aria-label="Tutup pilihan anak"
              onClick={closeOverlay}
            >
              <Icon name="close" />
            </button>

            <h2 id="pd-choose-title">
              Pilih Anak
            </h2>


            <div className="pd-chooser-grid">
              {children.map((child) => (
                <ChildChoice
                  key={child.id}
                  student={child}
                  variant={avatarOf(child)}
                  selected={child.id === studentId}
                  onClick={() => selectChild(child.id)}
                />
              ))}
            </div>
          </section>
        </div>
      )}


    </div>
  );
}
