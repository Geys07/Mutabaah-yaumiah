import EmptyState from "../components/EmptyState";
import InstallAppSettings from "../components/InstallAppSettings";

import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { fetchAll } from "../lib/pagination";
import { readNotification, notificationGroup } from "../lib/notificationRead";
import useNotificationRead from "../hooks/useNotificationRead";
import { signOut } from "../lib/auth";
import usePanelHistory from "../hooks/usePanelHistory";
import useJakartaClock from "../hooks/useJakartaClock";
import StaffWorkspace, {
  StaffKpi,
  StaffMeter,
} from "../components/StaffWorkspace";

import AcademicYears from "./AcademicYears";
import Classes from "./Classes";
import Students from "./Students";
import Activities from "./Activities";
import HomeroomAssignments from "./HomeroomAssignments";
import TeacherAccounts from "./TeacherAccounts";
import Parents from "./Parents";
const MonthlyReports = lazy(() => import("./MonthlyReports"));
const ReportCards = lazy(() => import("./ReportCards"));
import ReportTargetSettings from "./ReportTargetSettings";
import ReportGradingSettings from "./ReportGradingSettings";
import AccountSecurity from "./AccountSecurity";
import AdminNotificationSections from "./AdminNotificationSections";
import "./AdminDashboard.css";

const BUCKET = "school-assets";
const MAX_LOGO_SIZE = 2 * 1024 * 1024;

const LOGO_TYPES = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

const GROUPS = [
  {
    label: "Ringkasan",
    items: [
      { id: "dashboard", label: "Beranda", icon: "home" },
      { id: "notifications", label: "Notifikasi", icon: "bell" },
    ],
  },
  {
    label: "Data & Akademik",
    items: [
      { id: "academic", label: "Tahun Ajaran", icon: "calendar" },
      { id: "classes", label: "Kelas", icon: "layers" },
      {
        id: "students",
        label: "Data Siswa",
        icon: "users",
        mobileLabel: "Siswa",
      },
      { id: "teachers", label: "Wali Kelas", icon: "user" },
      { id: "principal-accounts", label: "Kepala Madrasah", icon: "school" },
      { id: "parents", label: "Orang Tua", icon: "users" },
    ],
  },
  {
    label: "Mutabaah & Laporan",
    items: [
      {
        id: "activities",
        label: "Kegiatan Mutabaah",
        icon: "book",
      },
      { id: "reports", label: "Laporan", icon: "chart" },
      { id: "report-cards", label: "Rapor", icon: "file" },
      {
        id: "report-targets",
        label: "Target Kegiatan",
        icon: "settings",
      },
      {
        id: "report-grading",
        label: "Nilai & Grade",
        icon: "chart",
      },
    ],
  },
  {
    label: "Pengaturan",
    items: [
      {
        id: "identity",
        label: "Identitas Sekolah",
        icon: "school",
      },
      {
        id: "account",
        label: "Profil & Keamanan Akun",
        icon: "shield",
      },
    ],
  },
  {
    label: "Pengaturan Perangkat",
    items: [{ id: "install-app", label: "Pasang Aplikasi", icon: "settings" }],
  },
];

const MENU = GROUPS.flatMap((group) => group.items);

const EMPTY_IDENTITY = {
  school_name: "",
  app_name: "",
  logo_path: "",
  address: "",
  principal_name: "",
  principal_employee_number: "",
  signing_location: "",
};

function errorMessage(error) {
  return error?.message || "Terjadi kesalahan.";
}

function DashboardHome({ account, onNavigate, pendingCount }) {
  const clock = useJakartaClock();

  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(true);
  const [warning, setWarning] = useState("");
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const {
          data: classes,
          error,
        } = await fetchAll(() => supabase.rpc("get_mutabaah_accessible_classes").order("academic_year", { ascending: false }).order("grade").order("class_name"), ["class_id"]);

        if (error) throw error;

        const all = Array.isArray(classes) ? classes : [];
        const newestYear = all[0]?.academic_year;
        const list = all.filter(
          (item) => item.academic_year === newestYear
        );

        const result = [];

        for (let i = 0; i < list.length; i += 4) {
          const batch = await Promise.all(
            list.slice(i, i + 4).map(async (item) => {
              try {
                const {
                  data,
                  error: queryError,
                } = await supabase.rpc(
                  "get_mutabaah_class_day_status",
                  {
                    p_class_id: item.class_id,
                    p_date: clock.date,
                  }
                );

                if (queryError) throw queryError;

                const statuses = Array.isArray(data) ? data : [];

                return {
                  ...item,
                  total: statuses.length,
                  finalized: statuses.filter(
                    (x) => x.status === "finalized"
                  ).length,
                  draft: statuses.filter(
                    (x) => x.status === "draft"
                  ).length,
                  unfilled: statuses.filter(
                    (x) =>
                      x.status !== "finalized" &&
                      x.status !== "draft"
                  ).length,
                  failed: false,
                };
              } catch {
                return {
                  ...item,
                  failed: true,
                  total: 0,
                  finalized: 0,
                  draft: 0,
                  unfilled: 0,
                };
              }
            })
          );

          result.push(...batch);

          if (!active) return;
        }

        if (active) {
          setRows(result);
          setWarning("");
        }
      } catch (caught) {
        if (active) {
          setRows([]);
          setWarning(
            caught?.message ||
              "Rekap sekolah belum dapat dimuat."
          );
        }
      } finally {
        if (active) setBusy(false);
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [clock.date, revision]);

  const valid = rows.filter((row) => !row.failed);

  const sum = (key) =>
    valid.reduce((count, row) => count + row[key], 0);

  const total = sum("total");
  const done = sum("finalized");
  const draft = sum("draft");
  const missing = sum("unfilled");
  const failed = rows.filter((row) => row.failed).length;

  return (
    <div>
      <div className="staff-page-intro">
        <div>
          <h2>
            Assalamu'alaikum, {account?.name || "Administrator"}
          </h2>
          <p>
            Ringkasan Mutabaah, {clock.date}.
          </p>
        </div>

        <button
          type="button"
          className="staff-soft-button"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            setRevision((n) => n + 1);
          }}
        >
          Perbarui
        </button>
      </div>

      {warning && (
        <p className="staff-alert" role="alert">
          {warning}
        </p>
      )}

      {failed > 0 && (
        <p className="staff-alert" role="alert">
          Data {failed} kelas gagal dimuat dan tidak termasuk
          angka ringkasan.
        </p>
      )}

      <div className="staff-kpis">
        <StaffKpi
          label="Jumlah siswa"
          value={busy ? "…" : total}
          detail="Terdaftar pada kelas terbaca"
        />

        <StaffKpi
          label="Sudah final"
          value={busy ? "…" : done}
          detail={
            total
              ? `${Math.round((done / total) * 100)}% dari siswa`
              : "Hari ini"
          }
        />

        <StaffKpi
          label="Masih draf"
          value={busy ? "…" : draft}
        />

        <StaffKpi
          label="Belum diisi"
          value={busy ? "…" : missing}
        />
      </div>

      <div className="staff-grid">
        <section className="staff-card">
          <div className="staff-card-head">
            <h3>Pengisian per kelas</h3>
            <button
              type="button"
              className="staff-plain-link"
              onClick={() => onNavigate("reports")}
            >
              Lihat laporan ›
            </button>
          </div>

          <div className="staff-table-wrap">
            <table className="staff-simple-table">
              <thead>
                <tr>
                  <th>Kelas</th>
                  <th>Siswa</th>
                  <th>Final</th>
                  <th>Progres</th>
                </tr>
              </thead>
              <tbody>
                {valid.map((row) => (
                  <tr key={row.class_id}>
                    <td>{row.class_name}</td>
                    <td>{row.total}</td>
                    <td>{row.finalized}</td>
                    <td>
                      <StaffMeter
                        value={row.finalized}
                        total={row.total}
                      />
                    </td>
                  </tr>
                ))}

                {valid.length === 0 && (
                  <tr>
                    <td colSpan="4" className="staff-muted">
                      {busy ? "Memuat rekap…" : (
                        <EmptyState kind="school" illustration="class" title="Belum ada kelas aktif" description="Kelas aktif akan muncul dalam rekap pengisian." />
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="staff-card">
          <div className="staff-card-head">
            <h3>Perlu perhatian</h3>
          </div>

          <div className="staff-attention">
            <div>
              <strong>
                {pendingCount} permintaan akun menunggu
              </strong>
              <span>Permintaan pemulihan kata sandi.</span>
              <button
                className="staff-plain-link"
                type="button"
                onClick={() => onNavigate("notifications")}
              >
                Buka notifikasi ›
              </button>
            </div>

            <div>
              <strong>
                {busy
                  ? "Memuat…"
                  : `${draft + missing} siswa belum final`}
              </strong>
            </div>

            <div>
              <strong>
                {rows.length} kelas pada tahun ajaran terbaru
              </strong>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function IdentityPage({ onSaved }) {
  const [form, setForm] = useState(EMPTY_IDENTITY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState("");
  const [removeLogo, setRemoveLogo] = useState(false);

  const fileInputRef = useRef(null);
  const previewUrlRef = useRef("");

  useEffect(() => {
    let cancelled = false;

    async function loadIdentity() {
      try {
        const {
          data,
          error: queryError,
        } = await supabase
          .from("school_identity")
          .select(
            "school_name,app_name,logo_path,address,principal_name,principal_employee_number,signing_location"
          )
          .eq("id", true)
          .single();

        if (queryError) throw queryError;
        if (cancelled) return;

        setForm({
          school_name: data.school_name || "",
          app_name: data.app_name || "",
          logo_path: data.logo_path || "",
          address: data.address || "",
          principal_name: data.principal_name || "",
          principal_employee_number:
            data.principal_employee_number || "",
          signing_location: data.signing_location || "",
        });

        setError("");
      } catch (loadError) {
        if (!cancelled) {
          setError(errorMessage(loadError));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadIdentity();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = "";
      }
    };
  }, []);

  function clearPreview() {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = "";
    }
    setLogoPreview("");
  }

  function updateField(field, value) {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));
    setError("");
    setMessage("");
  }

  function chooseLogo(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    event.target.value = "";

    if (!LOGO_TYPES[file.type]) {
      setError("Logo harus berupa PNG, JPG, atau WebP.");
      return;
    }

    if (file.size > MAX_LOGO_SIZE) {
      setError("Ukuran logo maksimal 2 MB.");
      return;
    }

    clearPreview();

    const objectUrl = URL.createObjectURL(file);

    previewUrlRef.current = objectUrl;
    setLogoFile(file);
    setLogoPreview(objectUrl);
    setRemoveLogo(false);
    setMessage("");
    setError("");
  }

  function deleteLogoSelection() {
    clearPreview();
    setLogoFile(null);
    setRemoveLogo(true);
    setError("");
    setMessage("");
  }

  async function uploadLogo(file) {
    const extension = LOGO_TYPES[file.type];

    if (!extension || file.size > MAX_LOGO_SIZE) {
      throw new Error("File logo tidak valid.");
    }

    const path =
      `logos/school-${crypto.randomUUID()}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, {
        contentType: file.type,
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) throw uploadError;

    const { data } = supabase.storage
      .from(BUCKET)
      .getPublicUrl(path);

    return {
      path,
      url: data.publicUrl,
    };
  }

  async function removeOldLogo(url) {
    if (!url) return;

    const marker =
      `/storage/v1/object/public/${BUCKET}/`;

    const position = url.indexOf(marker);
    if (position < 0) return;

    const path = url.slice(position + marker.length);

    if (
      !path.startsWith("logos/") ||
      path.includes("?")
    ) {
      return;
    }

    const { error: cleanupError } = await supabase.storage
      .from(BUCKET)
      .remove([path]);

    if (cleanupError) {
      console.warn(
        "Logo lama belum terhapus: cleanup_failed"
      );
    }
  }

  async function handleSave(event) {
    event.preventDefault();
    if (saving) return;

    if (
      !form.school_name.trim() ||
      !form.app_name.trim()
    ) {
      setError("Nama sekolah dan aplikasi wajib diisi.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    let uploaded = null;
    let identitySaved = false;

    try {
      let logoUrl = removeLogo
        ? null
        : form.logo_path || null;

      if (logoFile) {
        uploaded = await uploadLogo(logoFile);
        logoUrl = uploaded.url;
      }

      const {
        data,
        error: saveError,
      } = await supabase
        .from("school_identity")
        .update({
          school_name: form.school_name.trim(),
          app_name: form.app_name.trim(),
          logo_path: logoUrl,
          address: form.address.trim() || null,
          principal_name: form.principal_name.trim() || null,
          principal_employee_number:
            form.principal_employee_number.trim() || null,
          signing_location:
            form.signing_location.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", true)
        .select(
          "school_name,app_name,logo_path,address,principal_name,principal_employee_number,signing_location"
        )
        .single();

      if (saveError) throw saveError;
      identitySaved = true;

      const previousLogo = form.logo_path;

      setForm({
        school_name: data.school_name || "",
        app_name: data.app_name || "",
        logo_path: data.logo_path || "",
        address: data.address || "",
        principal_name: data.principal_name || "",
        principal_employee_number:
          data.principal_employee_number || "",
        signing_location: data.signing_location || "",
      });

      clearPreview();
      setLogoFile(null);
      setRemoveLogo(false);
      setMessage("Identitas sekolah berhasil disimpan.");

      onSaved?.(data);

      if (
        previousLogo &&
        previousLogo !== data.logo_path
      ) {
        try {
          await removeOldLogo(previousLogo);
        } catch {
          console.warn(
            "Gagal membersihkan logo lama: cleanup_failed"
          );
        }
      }
    } catch (saveError) {
      if (uploaded && !identitySaved) {
        try {
          const {
            error: cleanupError,
          } = await supabase.storage
            .from(BUCKET)
            .remove([uploaded.path]);

          if (cleanupError) {
            console.warn(
              "Unggahan sementara belum terhapus: cleanup_failed"
            );
          }
        } catch {
          console.warn(
            "Pembersihan unggahan gagal: cleanup_failed"
          );
        }
      }

      setError(errorMessage(saveError));
    } finally {
      setSaving(false);
    }
  }

  const displayedLogo = removeLogo
    ? ""
    : logoFile
      ? logoPreview
      : form.logo_path;

  if (loading) {
    return <div className="admin-panel">Memuat...</div>;
  }

  return (
    <div className="admin-panel">
      <div className="admin-section-heading">
        <h3>Identitas Sekolah</h3>
      </div>

      <form onSubmit={handleSave} className="identity-form">
        <div className="identity-logo-section">
          <div className="identity-logo-preview">
            {displayedLogo ? (
              <img src={displayedLogo} alt="Logo sekolah" />
            ) : (
              <span className="identity-logo-placeholder">
                Belum ada logo
              </span>
            )}
          </div>

          <div className="identity-logo-controls">
            <strong>Logo Sekolah</strong>
            <p>PNG, JPG, atau WebP. Maksimal 2 MB.</p>

            <input
              ref={fileInputRef}
              className="identity-file-input"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              aria-label="Pilih logo sekolah"
              disabled={saving}
              onChange={chooseLogo}
            />

            <div className="identity-logo-buttons">
              <button
                type="button"
                className="admin-secondary-button"
                disabled={saving}
                onClick={() => fileInputRef.current?.click()}
              >
                {displayedLogo ? "Ganti Logo" : "Unggah Logo"}
              </button>

              {displayedLogo && (
                <button
                  type="button"
                  className="admin-text-button"
                  disabled={saving}
                  onClick={deleteLogoSelection}
                >
                  Hapus Logo
                </button>
              )}
            </div>

            {logoFile && (
              <small className="identity-selected-file">
                Dipilih: {logoFile.name}
              </small>
            )}
          </div>
        </div>

        <div className="identity-grid">
          <label className="admin-field">
            <span>Nama Sekolah *</span>
            <input
              value={form.school_name}
              required
              disabled={saving}
              onChange={(event) =>
                updateField("school_name", event.target.value)
              }
            />
          </label>

          <label className="admin-field">
            <span>Nama Aplikasi *</span>
            <input
              value={form.app_name}
              required
              disabled={saving}
              onChange={(event) =>
                updateField("app_name", event.target.value)
              }
            />
          </label>

          <label className="admin-field admin-field-full">
            <span>Alamat Sekolah</span>
            <textarea
              rows={3}
              value={form.address}
              disabled={saving}
              onChange={(event) =>
                updateField("address", event.target.value)
              }
            />
          </label>

          <label className="admin-field">
            <span>Nama Kepala Sekolah</span>
            <input
              value={form.principal_name}
              disabled={saving}
              onChange={(event) =>
                updateField("principal_name", event.target.value)
              }
            />
          </label>

          <label className="admin-field">
            <span>NIY / NIP Kepala Sekolah</span>
            <input
              value={form.principal_employee_number}
              disabled={saving}
              onChange={(event) =>
                updateField(
                  "principal_employee_number",
                  event.target.value
                )
              }
            />
          </label>

          <label className="admin-field">
            <span>Tempat Penandatanganan</span>
            <input
              value={form.signing_location}
              disabled={saving}
              onChange={(event) =>
                updateField(
                  "signing_location",
                  event.target.value
                )
              }
            />
          </label>
        </div>

        {error && (
          <p className="admin-error" role="alert">
            {error}
          </p>
        )}

        {message && (
          <p className="admin-success" role="status">
            {message}
          </p>
        )}

        <div className="identity-actions">
          <button
            className="admin-primary-button"
            type="submit"
            disabled={saving}
          >
            {saving ? "Menyimpan..." : "Simpan Perubahan"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function AdminDashboard({
  account,
  school,
  onSchoolUpdated,
  onLogout,
}) {
  const [activeMenu, setActiveMenu] = useState("dashboard");
  const { push: pushPage } = usePanelHistory("admin", "dashboard", (page) => {
    if (MENU.some((item) => item.id === page)) setActiveMenu(page);
  });
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const readCounts = useCallback(async (signal) => {
    const [password, phone, inbox] = await notificationGroup([
      readNotification((requestSignal) => supabase.rpc("password_reset_pending_count")
        .abortSignal(requestSignal), signal),
      readNotification((requestSignal) => supabase.from("parent_phone_change_requests")
        .select("id", { count: "exact", head: true }).eq("status", "pending")
        .abortSignal(requestSignal), signal),
      readNotification((requestSignal) => supabase.from("admin_notice_inbox")
        .select("id", { count: "exact", head: true }).is("read_at", null)
        .abortSignal(requestSignal), signal),
    ]);
    if (password.data === null || !Number.isFinite(Number(password.data)) ||
        Number(password.data) < 0 || typeof phone.count !== "number" || phone.count < 0 ||
        typeof inbox.count !== "number" || inbox.count < 0) {
      throw new Error("Jumlah notifikasi belum tersedia.");
    }
    return { password: Number(password.data), phone: phone.count, inbox: inbox.count,
      requestsTotal: Number(password.data) + phone.count,
      total: Number(password.data) + phone.count + inbox.count };
  }, []);
  const counts = useNotificationRead("admin-counts:" + account?.id, readCounts, !loggingOut);
  const pendingCount = counts.current ? counts.data?.requestsTotal ?? null : null;
  const bellCount = counts.current ? counts.data?.total ?? null : null;
  const unreadCount = counts.current ? counts.data?.inbox ?? null : null;
  const passwordPendingCount = counts.current ? counts.data?.password ?? null : null;
  const refreshCounts = counts.refresh;
  const loadPendingCount = useCallback(() => refreshCounts({ force: true }), [refreshCounts]);
  const notificationChanged = useCallback(() => {
    void refreshCounts({ force: true, replace: true });
  }, [refreshCounts]);

  function navigate(id) {
    if (MENU.some((item) => item.id === id) && id !== activeMenu) {
      pushPage(id);
      setActiveMenu(id);
    }
  }

  async function handleLogout() {
    if (loggingOut) return;

    counts.cancel();
    setLoggingOut(true);
    setLogoutError("");

    try {
      await signOut();
      onLogout?.();
    } catch (error) {
      setLogoutError(errorMessage(error));
      setLoggingOut(false);
    }
  }

  const currentMenu =
    MENU.find((item) => item.id === activeMenu) || MENU[0];

  return (
    <StaffWorkspace
      role="Administrator"
      title={currentMenu.label}
      account={account}
      school={school}
      groups={GROUPS}
      activeId={activeMenu}
      onNavigate={navigate}
      mobileIds={[
        "dashboard",
        "students",
        "classes",
        "reports",
      ]}
      pendingCount={bellCount}
      noticeItems={
        pendingCount === null || unreadCount === null
          ? ["Jumlah notifikasi belum tersedia."]
          : [
              ...(unreadCount ? [`${unreadCount} notifikasi baru di kotak masuk.`] : []),
              ...(pendingCount ? [`${pendingCount} permintaan memerlukan penanganan.`] : []),
            ]
      }
      onNoticeAction={() => navigate("notifications")}
      onLogout={handleLogout}
      loggingOut={loggingOut}
    >
      <div className="admin-notification-status" role="status" aria-live="polite">
        {(counts.error || counts.loading) && (
          <span>
            {counts.error ? "Notifikasi belum diperbarui." : "Memperbarui notifikasi…"}
          </span>
        )}
      </div>
      {logoutError && (
        <p className="admin-error" role="alert">
          {logoutError}
        </p>
      )}

      {activeMenu === "dashboard" && (
        <DashboardHome
          account={account}
          onNavigate={navigate}
          pendingCount={pendingCount ?? "—"}
        />
      )}

      {activeMenu === "notifications" && (
        <AdminNotificationSections
          passwordPendingCount={passwordPendingCount}
          notificationChanged={notificationChanged}
          loadPendingCount={loadPendingCount}
          loggingOut={loggingOut}
        />
      )}

      {activeMenu === "identity" && (
        <IdentityPage onSaved={onSchoolUpdated} />
      )}

      {activeMenu === "academic" && <AcademicYears />}
      {activeMenu === "classes" && <Classes />}
      {activeMenu === "students" && <Students />}

      {activeMenu === "teachers" && (
        <HomeroomAssignments />
      )}

      {activeMenu === "parents" && <Parents />}
      {activeMenu === "principal-accounts" && <TeacherAccounts role="principal" />}
      {activeMenu === "activities" && <Activities />}

      {activeMenu === "reports" && <Suspense fallback={<p role="status">Memuat…</p>}><MonthlyReports /></Suspense>}


      {activeMenu === "report-cards" && (
        <Suspense fallback={<p role="status">Memuat…</p>}><ReportCards account={account} school={school} /></Suspense>
      )}

      {activeMenu === "report-targets" && (
        <ReportTargetSettings />
      )}

      {activeMenu === "report-grading" && (
        <ReportGradingSettings />
      )}

      {activeMenu === "account" && (
        <AccountSecurity account={account} />
      )}
      {activeMenu === "install-app" && <InstallAppSettings />}
    </StaffWorkspace>
  );
}
