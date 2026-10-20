import OfflineStartup from "./components/OfflineStartup";
import { readAppStartup } from "./lib/appStartup";

import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";




import useScreenHistory from "./hooks/useScreenHistory";
import ParentActivation from "./pages/ParentActivation";
import ForgotPassword from "./pages/ForgotPassword";

import LoadingAnimation from "./components/LoadingAnimation";
import PanelReadyGate from "./components/PanelReadyGate";
import AuthAmbient from "./components/AuthAmbient";

import useJakartaClock from "./hooks/useJakartaClock";
import { getTimeTheme } from "./lib/jakartaTheme";
import { getRandomQuote } from "./data/islamicQuotes";
import { SCHOOL_LOGO_URL, getSchoolLogoUrl } from "./lib/branding";

import {
  supabase,
} from "./lib/supabase";

import {
  signIn,
  signOut,
  getCurrentAccount,
} from "./lib/auth";

import "./App.css";
import "./pages/LoginPage.css";
import "./styles/time-theme.css";
import "./styles/splash-transition.css";

const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const TeacherDashboard = lazy(() => import("./pages/TeacherDashboard"));
const ParentDashboard = lazy(() => import("./pages/ParentDashboard"));

const DEFAULT_SCHOOL = {
  appName: "Mutabaah Yaumiah",
  name: "MTs Al-Khairiyah",
  logoUrl: SCHOOL_LOGO_URL,
};

function mapSchoolIdentity(data) {
  return {
    appName:
      data?.app_name?.trim() ||
      DEFAULT_SCHOOL.appName,

    name:
      data?.school_name?.trim() ||
      DEFAULT_SCHOOL.name,

    logoUrl: getSchoolLogoUrl(data),
  };
}

function SchoolLogo({ school }) {
  return (
    <div className="school-logo-frame">
      <img
        src={school.logoUrl}
        alt={`Logo ${school.name}`}
        className="school-logo"
      />
    </div>
  );
}

function LoginPage({
  school,
  onLogin,
  year,
}) {
  const [mode, setMode, replaceMode, backMode] = useScreenHistory("login", "auth");
  const [loginAudience, setLoginAudience] = useState("parent");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] =
    useState(false);

  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    if (!notice) {
      return undefined;
    }

    const timer = window.setTimeout(
      () => setNotice(null),
      4500
    );

    return () => window.clearTimeout(timer);
  }, [notice]);

  function changeMode(next) {
    if (busy) {
      return;
    }

    if (next === "login" && mode !== "login") backMode();
    else setMode(next);
    setPassword("");
    setShowPassword(false);
    setNotice(null);
  }

  function returnAfter(message) {
    replaceMode("login");
    setUsername("");
    setPassword("");
    setShowPassword(false);

    setNotice({
      type: "success",
      text:
        message ||
        "Berhasil. Silakan masuk.",
    });
  }

  async function handleLogin(event) {
    event.preventDefault();

    if (busy) {
      return;
    }

    if (!username.trim() || !password) {
      setNotice({
        type: "error",
        text:
          "Isi nomor HP/pengguna dan kata sandi.",
      });

      return;
    }

    setBusy(true);
    setNotice(null);

    try {
      await signIn(
        username.trim(),
        password
      );

      const current =
        await getCurrentAccount();

      if (!current) {
        throw new Error(
          "Akun tidak ditemukan."
        );
      }

      onLogin(current);
    } catch (error) {
      setNotice({
        type: "error",
        text:
          error?.message ||
          "Gagal masuk.",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mut-login-page">
      <AuthAmbient />

      <div className="mut-login-content">
        <header className="mut-login-brand">
          <SchoolLogo school={school} />

          <h1>{school.appName}</h1>
          <p>{school.name}</p>
        </header>

        <section
          className={
            `mut-login-card${
              mode === "login"
                ? ""
                : " mut-login-card-secondary"
            }`
          }
          aria-label={
            mode === "login"
              ? "Formulir masuk"
              : undefined
          }
        >
          {mode === "activation" ? (
            <ParentActivation
              onBack={() =>
                changeMode("login")
              }
              onSuccess={returnAfter}
            />
          ) : mode === "forgot" ? (
            <ForgotPassword
              onBack={() =>
                changeMode("login")
              }
              onSuccess={returnAfter}
            />
          ) : (
            <>
              <h2 className="mut-login-welcome">
                Selamat Datang
              </h2>

              <form
                className="mut-login-form"
                onSubmit={handleLogin}
                noValidate
              >
                <label
                  className="mut-login-field"
                  htmlFor="phone"
                >
                  <svg
                    className="mut-login-field-icon"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    aria-hidden="true"
                  >
                    <rect
                      x="6"
                      y="2"
                      width="12"
                      height="20"
                      rx="2"
                    />

                    <path d="M10 5h4M11 19h2" />
                  </svg>

                  <span className="mut-login-field-body">
                    <span className="mut-login-field-label">
                      {loginAudience === "parent" ? "Nomor HP" : "Pengguna / Nomor HP"}
                    </span>

                    <input
                      id="phone"
                      type="text"
                      inputMode={loginAudience === "parent" ? "numeric" : "text"}
                      pattern={loginAudience === "parent" ? "[0-9]*" : undefined}
                      maxLength={loginAudience === "parent" ? 17 : 64}
                      autoComplete="username"
                      autoCapitalize="none"
                      spellCheck={false}
                      placeholder={loginAudience === "parent" ? "08xxxxxxxxxx" : "Nama pengguna / nomor HP"}
                      value={username}
                      disabled={busy}
                      onChange={(event) =>
                        setUsername(
                          loginAudience === "parent"
                            ? event.target.value.replace(/\D/g, "")
                            : event.target.value
                        )
                      }
                    />
                  </span>
                </label>

                <div className="mut-login-field">
                  <svg
                    className="mut-login-field-icon"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    aria-hidden="true"
                  >
                    <rect
                      x="5"
                      y="10"
                      width="14"
                      height="12"
                      rx="2"
                    />

                    <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                  </svg>

                  <label
                    className="mut-login-field-body"
                    htmlFor="password"
                  >
                    <span className="mut-login-field-label">
                      Kata sandi
                    </span>

                    <input
                      id="password"
                      type={
                        showPassword
                          ? "text"
                          : "password"
                      }
                      autoComplete="current-password"
                      placeholder="Masukkan kata sandi"
                      value={password}
                      disabled={busy}
                      onChange={(event) =>
                        setPassword(
                          event.target.value
                        )
                      }
                    />
                  </label>

                  <button
                    className="mut-login-eye"
                    type="button"
                    disabled={busy}
                    aria-label={
                      showPassword
                        ? "Sembunyikan kata sandi"
                        : "Tampilkan kata sandi"
                    }
                    onClick={() =>
                      setShowPassword(
                        (old) => !old
                      )
                    }
                  >
                    {showPassword ? "◉" : "◌"}
                  </button>
                </div>

                <div className="mut-login-audience">
                  <button type="button" disabled={busy} aria-pressed={loginAudience === "staff"}
                    onClick={() => {
                      setLoginAudience(loginAudience === "parent" ? "staff" : "parent");
                      setUsername("");
                      setPassword("");
                      setNotice(null);
                    }}>
                    {loginAudience === "parent" ? "Login Admin / Guru" : "Login Orang Tua"}
                  </button>
                </div>
                <div className="mut-login-forgot">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      changeMode("forgot")
                    }
                  >
                    Lupa kata sandi?
                  </button>
                </div>

                <button
                  className="mut-login-submit"
                  type="submit"
                  disabled={busy}
                >
                  {busy
                    ? "Memeriksa..."
                    : "Masuk"}
                </button>
              </form>

              <div className="mut-login-divider">
                <span />
                atau
                <span />
              </div>

              <div className="mut-login-activation">
                Belum memiliki akun orang tua?{" "}

                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    changeMode("activation")
                  }
                >
                  Aktivasi Akun
                </button>
              </div>

            </>
          )}
        </section>

        <footer>
          © {year} {school.name}
        </footer>
      </div>

      {notice && (
        <div
          className={
            `toast toast-${notice.type}`
          }
          role="status"
          aria-live="polite"
        >
          <span>{notice.text}</span>

          <button
            type="button"
            aria-label="Tutup pemberitahuan"
            onClick={() =>
              setNotice(null)
            }
          >
            ×
          </button>
        </div>
      )}
    </main>
  );
}

function OtherAccount({
  account,
  onLogout,
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function leave() {
    if (busy) {
      return;
    }

    setBusy(true);

    try {
      await signOut();
      onLogout();
    } catch (caught) {
      setError(
        caught?.message ||
        "Gagal keluar."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login-page">
      <div className="login-form-panel">
        <h2>
          {account?.name || "Akun"}
        </h2>

        {error && (
          <p role="alert">
            {error}
          </p>
        )}

        <button
          className="submit-button"
          type="button"
          disabled={busy}
          onClick={leave}
        >
          {busy
            ? "Memproses..."
            : "Keluar"}
        </button>
      </div>
    </main>
  );
}

export default function App() {
  const clock = useJakartaClock();
  const theme = getTimeTheme(clock.hour);

  useLayoutEffect(() => {
    document.documentElement.dataset.timeTheme =
      theme.key;
  }, [theme.key]);

  const [quote] = useState(getRandomQuote);

  const [school, setSchool] =
    useState(DEFAULT_SCHOOL);

  const [account, setAccount] =
    useState(null);

  const [bootReady, setBootReady] =
    useState(false);

  const [panelReady, setPanelReady] =
    useState(false);

  const [progress, setProgress] =
    useState(0);

  const [elapsedMs, setElapsedMs] =
    useState(0);

  const [loading, setLoading] =
    useState(true);

  const [phase, setPhase] =
    useState("show");

  const [loadError, setLoadError] =
    useState(false);

  const [retryCount, setRetryCount] =
    useState(0);

  const [session, setSession] =
    useState(0);

  const [skipRequested, setSkipRequested] =
    useState(false);

  const [showRecovery, setShowRecovery] =
    useState(false);

  // Waktu dimulai dari effect/event handler,
  // bukan dari proses render React.
  const startedAt = useRef(0);

  const onPanelReady = useCallback(
    () => setPanelReady(true),
    []
  );

  // Loading awal memberikan waktu baca ayat.
  // Setelah login, menunggu data panel siap.
  const readingMs =
    session === 0
      ? Math.min(
          18000,
          Math.max(
            10000,
            9500 +
              (quote?.arabic?.length || 0) * 65
          )
        )
      : 2600;

  useEffect(() => {
    if (startedAt.current === 0) {
      startedAt.current = performance.now();
    }
  }, []);

  // Memuat identitas sekolah dan akun.
  useEffect(() => {
    let active = true;

    async function prepare() {
      try {
        const [
          identity,
          current,
        ] = await readAppStartup();

        if (!active) {
          return;
        }

        setSchool(
          mapSchoolIdentity(identity)
        );

        setAccount(current);
        setBootReady(true);
        setLoadError(false);
      } catch {
        if (!active) {
          return;
        }

        console.error(
          "Gagal menyiapkan aplikasi: startup_failed"
        );

        setLoadError(true);
      }
    }

    void prepare();

    return () => {
      active = false;
    };
  }, [retryCount]);

  // Menangani logout dari Supabase.
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (event) => {
        if (event === "SIGNED_OUT") {
          setAccount(null);
          setPanelReady(false);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  function startPanelSession(current) {
    // performance.now() aman dipanggil
    // dari event handler.
    startedAt.current = performance.now();

    setElapsedMs(0);

    // Progress direset hanya untuk sesi baru.
    setProgress(0);

    setPhase("show");
    setLoading(true);

    setSkipRequested(false);
    setShowRecovery(false);
    setPanelReady(false);

    setSession(
      (old) => old + 1
    );

    setAccount(current);
  }

  const roles = Array.isArray(account?.roles)
    ? account.roles
    : [];

  const hasPanel = roles.some((role) =>
    [
      "admin",
      "principal",
      "homeroom_teacher",
      "parent",
    ].includes(role)
  );

  const dataReady =
    bootReady &&
    (!hasPanel || panelReady);

  // Progress menggunakan angka tertinggi
  // yang pernah dicapai dalam sesi berjalan.
  useEffect(() => {
    if (
      !loading ||
      phase !== "show" ||
      loadError
    ) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      const elapsed = Math.max(
        0,
        performance.now() -
          startedAt.current
      );

      setElapsedMs(elapsed);

      const target = Math.min(
        96,
        Math.floor(
          96 *
            (
              1 -
              Math.exp(-elapsed / 4100)
            )
        )
      );

      setProgress((old) =>
        Math.max(old, target)
      );

      if (
        elapsed > 26000 &&
        !dataReady
      ) {
        setShowRecovery(true);
      }

      if (
        dataReady &&
        (
          elapsed >= readingMs ||
          (
            skipRequested &&
            elapsed >= 4500
          )
        )
      ) {
        setProgress(100);
        setPhase("complete");
      }
    }, 100);

    return () => {
      window.clearInterval(timer);
    };
  }, [
    loading,
    phase,
    dataReady,
    readingMs,
    skipRequested,
    session,
    loadError,
  ]);

  // Biarkan angka 100% terlihat sejenak.
  useEffect(() => {
    if (
      !loading ||
      phase !== "complete"
    ) {
      return undefined;
    }

    const timer = window.setTimeout(
      () => setPhase("exiting"),
      240
    );

    return () => {
      window.clearTimeout(timer);
    };
  }, [loading, phase]);

  // Fade-out halus.
  useEffect(() => {
    if (
      !loading ||
      phase !== "exiting"
    ) {
      return undefined;
    }

    const timer = window.setTimeout(
      () => setLoading(false),
      800
    );

    return () => {
      window.clearTimeout(timer);
    };
  }, [loading, phase]);

  function retry() {
    setLoadError(false);
    setBootReady(false);
    setPanelReady(false);
    setShowRecovery(false);
    setSkipRequested(true);

    setRetryCount(
      (old) => old + 1
    );
  }

  // Panel dipasang di belakang loading.
  // Komponen panel tidak dibuat ulang
  // saat splash mulai menghilang.

  let content = null;

  if (bootReady && !account) {
    content = (
      <LoginPage
        school={school}
        year={clock.date.slice(0, 4)}
        onLogin={startPanelSession}
      />
    );
  } else if (
    bootReady &&
    roles.includes("admin")
  ) {
    content = (
      <PanelReadyGate
        key={`admin-${session}`}
        sessionKey={session}
        onReady={onPanelReady}
      >
        <AdminDashboard
          account={account}
          school={school}
          onSchoolUpdated={(data) =>
            setSchool(
              mapSchoolIdentity(data)
            )
          }
          onLogout={() =>
            setAccount(null)
          }
        />
      </PanelReadyGate>
    );
  } else if (
    bootReady &&
    (
      roles.includes("principal") ||
      roles.includes("homeroom_teacher")
    )
  ) {
    content = (
      <PanelReadyGate
        key={`teacher-${session}`}
        sessionKey={session}
        onReady={onPanelReady}
      >
        <TeacherDashboard
          account={account}
          school={school}
          onLogout={() =>
            setAccount(null)
          }
        />
      </PanelReadyGate>
    );
  } else if (
    bootReady &&
    roles.includes("parent")
  ) {
    content = (
      <PanelReadyGate
        key={`parent-${session}`}
        sessionKey={session}
        onReady={onPanelReady}
      >
        <ParentDashboard
          account={account}
          school={school}
          onLogout={() =>
            setAccount(null)
          }
        />
      </PanelReadyGate>
    );
  } else if (
    bootReady &&
    account
  ) {
    content = (
      <OtherAccount
        account={account}
        onLogout={() =>
          setAccount(null)
        }
      />
    );
  }

  // Nilai elapsedMs diperbarui oleh effect.
  // Tidak membaca waktu atau ref saat render.
  const canContinue =
    dataReady &&
    elapsedMs >= 4500 &&
    phase === "show";

  if (loadError && !bootReady) return <OfflineStartup onRetry={retry} />;

  return (
    <>
      <div
        className={
          `mut-app-content-under-splash${
            loading &&
            phase !== "exiting"
              ? " is-preparing"
              : ""
          }`
        }
      >
        <Suspense fallback={<p role="status">Memuat panel…</p>}>{content}</Suspense>
      </div>

      {loading && (
        <div
          className={
            `mut-splash-layer${
              phase === "exiting"
                ? " is-exiting"
                : ""
            }`
          }
        >
          <LoadingAnimation
            school={school}
            quote={quote}
            progress={progress}
            message={
              loadError
                ? "Gagal menghubungkan ke server."
                : !bootReady
                  ? "Menghubungkan ke server..."
                  : !dataReady
                    ? "Menyiapkan data beranda..."
                    : progress === 100
                      ? "Semua siap. Selamat datang!"
                      : "Beranda siap. Silakan membaca ayat..."
            }
          />

          {canContinue &&
            session === 0 && (
              <button
                type="button"
                className="mut-splash-continue"
                onClick={() =>
                  setSkipRequested(true)
                }
              >
                Masuk sekarang →
              </button>
            )}

          {loadError && (
            <div className="mut-splash-recovery">
              <span>
                Koneksi belum berhasil.
              </span>

              <button
                type="button"
                onClick={retry}
              >
                Coba lagi
              </button>
            </div>
          )}

          {showRecovery &&
            !loadError &&
            !dataReady && (
              <div className="mut-splash-recovery">
                <span>
                  Data beranda membutuhkan
                  waktu lebih lama.
                </span>

                <button
                  type="button"
                  onClick={() =>
                    setPanelReady(true)
                  }
                >
                  Buka dengan data sementara
                </button>
              </div>
            )}
        </div>
      )}
    </>
  );
}
