
import { useEffect, useMemo, useRef, useState } from "react";
import useJakartaClock from "../hooks/useJakartaClock";
import { getTimeTheme } from "../lib/jakartaTheme";
import ViewportPopover from "./ViewportPopover";
import "./StaffWorkspace.css";
import "../styles/staff-dialog-unified.css";

const ICONS = {
  home: (
    <>
      <path d="m3 10 9-7 9 7v10H3z" />
      <path d="M9 20v-7h6v7" />
    </>
  ),
  bell: (
    <>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 8-3 9h18c0-1-3-2-3-9" />
      <path d="M10 21h4" />
    </>
  ),
  school: (
    <>
      <path d="M3 21V8l9-5 9 5v13M3 21h18M9 21v-7h6v7M7 10h.01M17 10h.01" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M7 3v4M17 3v4M3 10h18" />
    </>
  ),
  layers: (
    <>
      <path d="m12 3-9 5 9 5 9-5-9-5ZM3 12l9 5 9-5M3 16l9 5 9-5" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20v-2a6 6 0 0 1 12 0v2M17 11a3 3 0 0 0-1-6M18 14a5 5 0 0 1 3 5v1" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </>
  ),
  book: (
    <>
      <path d="M12 6c-4-2-7-2-10-1v14c3-1 6-1 10 1 4-2 7-2 10-1V5c-3-1-6-1-10 1ZM12 6v14" />
    </>
  ),
  chart: (
    <>
      <path d="M4 20V11M10 20V4M16 20v-8M22 20V7M2 20h22" />
    </>
  ),
  file: (
    <>
      <path d="M6 2h9l5 5v15H6zM15 2v6h5M9 13h8M9 17h8" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M4 9v6l3 1 1 3h8l1-3 3-1V9l-3-1-1-3H8L7 8z" />
    </>
  ),
  shield: (
    <>
      <path d="m12 2 9 4v6c0 5-4 8-9 10-5-2-9-5-9-10V6z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  close: <path d="M18 6 6 18M6 6l12 12" />,
  logout: (
    <>
      <path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4" />
      <path d="m13 16 4-4-4-4M9 12h8" />
    </>
  ),
  arrow: <path d="m9 18 6-6-6-6" />,
};

export function StaffIcon({ name = "file", size = 19 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICONS[name] || ICONS.file}
    </svg>
  );
}

export function StaffKpi({ label, value, detail }) {
  return (
    <div className="staff-kpi">
      <span>{label}</span>
      <strong>{value}</strong>
      {detail && <small>{detail}</small>}
    </div>
  );
}

export function StaffMeter({ value, total }) {
  const ratio =
    total > 0
      ? Math.max(0, Math.min(100, Math.round((value / total) * 100)))
      : 0;

  return (
    <div className="staff-meter" aria-label={`${ratio}% sudah final`}>
      <span style={{ width: `${ratio}%` }} />
    </div>
  );
}

export default function StaffWorkspace({
  role,
  title,
  account,
  school,
  groups,
  activeId,
  onNavigate,
  mobileIds = [],
  pendingCount = 0,
  noticeItems = [],
  showNoticeBell = true,
  onNoticeAction,
  noticeActionLabel = "Buka notifikasi",
  onLogout,
  loggingOut = false,
  children,
}) {
  const clock = useJakartaClock();
  const theme = getTimeTheme(clock.hour);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [noticeOpen, setNoticeOpen] = useState(false);
  const noticeAnchorRef = useRef(null);

  const items = useMemo(
    () => groups.flatMap((group) => group.items),
    [groups]
  );

  const selected = items.find((item) => item.id === activeId);

  const visibleMobile = mobileIds
    .map((id) => items.find((item) => item.id === id))
    .filter(Boolean);

  const isMoreActive = !mobileIds.includes(activeId);

  function go(id) {
    onNavigate(id);
    setDrawerOpen(false);
    setNoticeOpen(false);
  }

  useEffect(() => {
    function onEscape(event) {
      if (event.key === "Escape") {
        setDrawerOpen(false);
        setNoticeOpen(false);
      }
    }

    window.addEventListener("keydown", onEscape);

    return () => {
      window.removeEventListener("keydown", onEscape);
    };
  }, []);

  function renderGroups() {
    return groups.map((group) => (
      <div className="staff-nav-group" key={group.label}>
        <span className="staff-nav-heading">{group.label}</span>

        {group.items.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`staff-nav-link${
              activeId === item.id ? " is-active" : ""
            }`}
            onClick={() => go(item.id)}
            aria-current={
              activeId === item.id ? "page" : undefined
            }
          >
            <StaffIcon name={item.icon} />
            <span>{item.id === "install-app" ? "Panduan Aplikasi" : item.label}</span>

            {item.id === "notifications" && pendingCount > 0 && (
              <b className="staff-nav-count">{pendingCount}</b>
            )}
          </button>
        ))}
      </div>
    ));
  }

  return (
    <div className="staff-app" data-staff-theme={theme.key}>
      {drawerOpen && (
        <button
          type="button"
          className="staff-drawer-backdrop"
          aria-label="Tutup menu"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      <aside
        className={`staff-sidebar${drawerOpen ? " is-open" : ""}`}
        aria-label={`Menu ${role}`}
      >
        <div className="staff-sidebar-brand">
          {school?.logoUrl && (
            <img src={school.logoUrl} alt="Logo sekolah" />
          )}

          <div>
            <strong>{school?.appName || "Mutabaah Yaumiah"}</strong>
            <small>{school?.name || "MTs Al-Khairiyah"}</small>
          </div>

          <button
            className="staff-sidebar-close"
            type="button"
            aria-label="Tutup menu"
            onClick={() => setDrawerOpen(false)}
          >
            <StaffIcon name="close" />
          </button>
        </div>

        <div className="staff-sidebar-role">{role}</div>

        <nav className="staff-nav">{renderGroups()}</nav>

        <div className="staff-sidebar-profile">
          <StaffIcon name="user" />
          <span>{account?.name || role}</span>
        </div>
      </aside>

      <div className="staff-workspace">
        <header className="staff-topbar">
          <div className="staff-top-title">
            <span className="staff-top-app-name">{school?.appName || "Mutabaah Yaumiah"}</span>
            <span className="staff-top-role">{role}</span>
            <h1>{activeId === "install-app" ? "Panduan Aplikasi" : title || selected?.label || "Beranda"}</h1>
          </div>

          <div className="staff-top-actions">
            {showNoticeBell && <div className="staff-notice-anchor" ref={noticeAnchorRef}>
              <button
                type="button"
                className="staff-bell"
                aria-label="Pemberitahuan"
                aria-expanded={noticeOpen}
                onClick={() => setNoticeOpen((open) => !open)}
              >
                <StaffIcon name="bell" size={21} />
                {pendingCount > 0 && (
                  <span className="staff-bell-dot" />
                )}
              </button>

              {noticeOpen && (
                <ViewportPopover
                  className="staff-notice-pop"
                  label="Pemberitahuan"
                  theme={theme.key}
                  anchorRef={noticeAnchorRef}
                  onClose={() => setNoticeOpen(false)}
                >
                  <strong>Pemberitahuan</strong>

                  {noticeItems.length === 0 ? (
                    <p>
                      Belum ada informasi baru pada ringkasan ini.
                    </p>
                  ) : (
                    noticeItems.map((entry, index) => (
                      <p key={`${index}-${entry}`}>{entry}</p>
                    ))
                  )}

                  {onNoticeAction && (
                    <button
                      className="staff-notice-action"
                      type="button"
                      onClick={() => {
                        setNoticeOpen(false);
                        onNoticeAction();
                      }}
                    >
                      {noticeActionLabel}
                      <StaffIcon name="arrow" size={14} />
                    </button>
                  )}
                </ViewportPopover>
              )}
            </div>}

            <div className="staff-top-user">
              <StaffIcon name="user" />
              <span>{account?.name || role}</span>
            </div>

            <button
              type="button"
              className="staff-logout"
              disabled={loggingOut}
              onClick={onLogout}
            >
              <StaffIcon name="logout" size={17} />
              <span>{loggingOut ? "Memproses" : "Keluar"}</span>
            </button>
          </div>
        </header>

        <main className="staff-main">{children}</main>
      </div>

      <nav
        className="staff-mobile-nav"
        style={{
          gridTemplateColumns: `repeat(${
            visibleMobile.length + 1
          }, minmax(0, 1fr))`,
        }}
        aria-label={`Navigasi cepat ${role}`}
      >
        {visibleMobile.map((item) => (
          <button
            key={item.id}
            type="button"
            className={activeId === item.id ? "is-active" : ""}
            aria-current={
              activeId === item.id ? "page" : undefined
            }
            onClick={() => go(item.id)}
          >
            <StaffIcon name={item.icon} size={20} />
            <span>{item.mobileLabel || item.label}</span>
          </button>
        ))}

        <button
          type="button"
          className={isMoreActive ? "is-active" : ""}
          aria-label="Buka menu lainnya"
          onClick={() => setDrawerOpen(true)}
        >
          <StaffIcon name="menu" size={20} />
          <span>Lainnya</span>
        </button>
      </nav>
    </div>
  );
}
