
import {
  useEffect,
  useState,
} from "react";

import { createPortal } from "react-dom";
import { supabase } from "../lib/supabase";
import usePushDevice from "../hooks/usePushDevice";
import { pushAvailable as available, checkPushDevice, reconcilePushAccount } from "../lib/pushDevice";
import { pushSupportMessage } from "../lib/pwaPlatform";
import { SCHOOL_LOGO_URL } from "../lib/branding";

import "./ParentNotificationControls.css";

const POPUP_KEY = (userId) => `mutabaah-parent-push-offer-v1:${userId}`;
async function deviceIsEnabled() {
  const { data } = await supabase.auth.getUser();
  return checkPushDevice("parent", data?.user?.id || "");
}
function AlertIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 8-3 9h18c0-1-3-2-3-9" />
      <path d="M10 21h4" />
    </svg>
  );
}

export function ParentPushSettings() {
  const { enabled, busy, checked, ready, preparing, error, toggle, prepare, permission, optIn } = usePushDevice("parent");

  return (
    <section
      className="pnc-settings"
      aria-label="Pengaturan notifikasi perangkat"
    >
      <div className="pnc-settings-icon">
        <AlertIcon />
      </div>

      <div className="pnc-settings-body">
        <h2>Notifikasi Mutabaah</h2>

        <p>
          Pengingat pengisian pukul
          20.00 WIB. Pengaturan berlaku
          untuk perangkat ini.
        </p>

        <span
          className={
            `pnc-status ${
              enabled ? "is-on" : ""
            }`
          }
        >
          {checked
            ? enabled
              ? "Aktif"
              : error ? "Perlu diperiksa" : "Tidak aktif"
            : "Memeriksa…"}
        </span>
        {!enabled && <p role="status">{
          preparing ? "Memeriksa langganan perangkat dan akun…"
          : permission === "granted"
            ? optIn
              ? ready
                ? "Izin notifikasi HP aktif. Langganan akun ini belum tersambung; tekan Hubungkan Notifikasi."
                : "Izin notifikasi HP aktif. Memeriksa kembali sambungan akun."
              : "Izin HP aktif, tetapi notifikasi untuk akun ini pernah dinonaktifkan."
            : permission === "denied"
              ? "Notifikasi diblokir oleh perangkat. Ubah izin di pengaturan aplikasi."
              : ready ? "Perangkat siap untuk mengaktifkan izin dan notifikasi." : "Persiapan notifikasi belum berhasil."
        }</p>}


        {pushSupportMessage() && <p role="note">{pushSupportMessage()}</p>}

        {error && (
          <p
            className="pnc-error"
            role="alert"
          >
            {error}
          </p>
        )}
      </div>

      {(available() || enabled) && <button
        type="button"
        className="pnc-settings-button"
        disabled={
          busy ||
          !checked ||
          preparing ||
          (!available() && !enabled)
        }
        onClick={() =>
          (enabled || ready) ? void toggle() : void prepare()
        }
      >
        {busy
          ? "Memproses…"
          : preparing ? "Menyiapkan…"
          : enabled
            ? "Nonaktifkan"
            : !ready ? "Coba Lagi Persiapan" : permission === "granted" ? "Hubungkan Notifikasi" : "Aktifkan notifikasi"}
      </button>}
    </section>
  );
}

export default function ParentNotificationGate() {
  const [
    userId,
    setUserId,
  ] = useState("");

  const [
    authorizedParentId,
    setAuthorizedParentId,
  ] = useState("");

  const [
    panel,
    setPanel,
  ] = useState(null);

  const [
    open,
    setOpen,
  ] = useState(false);



  // Sinkronkan push secara diam-diam walau popup tidak terbuka.
  const device = usePushDevice("parent", Boolean(userId && authorizedParentId === userId));
  const { busy, error, ready, preparing, checked } = device;

  useEffect(() => {
    let live = true;
    let changed = false;

    void supabase.auth.getUser()
      .then(({ data }) => {
        if (live && !changed) {
          void reconcilePushAccount(data?.user?.id || "").catch(() => {});
          setUserId(
            data?.user?.id || ""
          );
        }
      });

    const {
      data: authListener,
    } = supabase.auth
      .onAuthStateChange(
        (_event, session) => {
          changed = true;
          void reconcilePushAccount(session?.user?.id || "").catch(() => {});
          setUserId(
            session?.user?.id || ""
          );
        }
      );

    return () => {
      live = false;

      authListener.subscription
        .unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!userId) {
      return undefined;
    }

    let live = true;

    async function checkRole() {
      const [
        role,
        profile,
      ] = await Promise.all([
        supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", userId)
          .eq("role", "parent")
          .maybeSingle(),

        supabase
          .from("profiles")
          .select("account_status")
          .eq("user_id", userId)
          .maybeSingle(),
      ]);

      if (live) {
        setAuthorizedParentId(
          !role.error &&
          !profile.error &&
          Boolean(role.data) &&
          profile.data?.account_status === "active"
            ? userId
            : ""
        );
      }
    }

    void checkRole();

    return () => {
      live = false;
    };
  }, [userId]);


  useEffect(() => {
    if (
      authorizedParentId !== userId ||
      !userId ||
      !available() ||
      Notification.permission !== "default"
    ) {
      return undefined;
    }

    if (
      localStorage.getItem(
        POPUP_KEY(userId)
      ) === "1"
    ) {
      return undefined;
    }

    let live = true;
    let checking = false;
    let observer;

    async function checkPanel() {
      if (checking || !live) {
        return;
      }

      const element =
        document.querySelector(".pd-app");

      if (
        !element ||
        document.querySelector(
          ".mut-splash-layer"
        )
      ) {
        return;
      }

      checking = true;

      try {
        const subscribed = Notification.permission === "granted" || await deviceIsEnabled();

        if (!live) {
          return;
        }

        if (subscribed) {
          localStorage.setItem(
            POPUP_KEY(userId),
            "1"
          );
        } else {
          setPanel(element);
          setOpen(userId);
        }

        observer?.disconnect();
      } catch {
        observer?.disconnect();
      } finally {
        checking = false;
      }
    }

    observer = new MutationObserver(
      () => {
        void checkPanel();
      }
    );

    observer.observe(
      document.body,
      {
        childList: true,
        subtree: true,
      }
    );

    void checkPanel();

    return () => {
      live = false;
      observer.disconnect();
    };
  }, [
    authorizedParentId,
    userId,
  ]);

  function dismiss() {
    if (userId) {
      localStorage.setItem(
        POPUP_KEY(userId),
        "1"
      );
    }

    setOpen(false);
  }

  async function accept() {
    if (!ready || device.id !== userId || busy) return;
    if (await device.toggle()) dismiss();
  }

  if (
    !userId ||
    authorizedParentId !== userId ||
    (!open || open !== userId) ||
    !panel
  ) {
    return null;
  }

  return createPortal(
    <div
      className="pnc-overlay"
      role="presentation"
    >
      <section
        className="pnc-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pnc-title"
        aria-describedby="pnc-desc"
      >
        <button
          type="button"
          className="pnc-close"
          onClick={dismiss}
          aria-label="Tutup pemberitahuan"
          disabled={busy}
        >
          ×
        </button>

        <img
          className="pnc-logo"
          src={SCHOOL_LOGO_URL}
          alt="Logo sekolah"
        />

        <div className="pnc-dialog-icon">
          <AlertIcon />
        </div>

        <h2 id="pnc-title">
          Aktifkan Pengingat Mutabaah?
        </h2>

        <p id="pnc-desc">
          Dapatkan pengingat pukul
          20.00 WIB apabila pengisian
          ananda belum selesai.
          Anda bisa mengubahnya kapan
          saja di menu Profil.
        </p>

        {error && (
          <p
            className="pnc-error"
            role="alert"
          >
            {error}
          </p>
        )}

        <p role="status">{preparing || !checked ? "Menyiapkan notifikasi…" : ready ? "Perangkat siap. Tekan Aktifkan Notifikasi." : "Persiapan notifikasi belum berhasil. Coba lagi."}</p>
        {ready || busy ? <button
          type="button"
          className="pnc-primary"
          autoFocus
          onClick={() => void accept()}
          disabled={busy || device.id !== userId}
        >{busy ? "Mengaktifkan…" : "Aktifkan Notifikasi"}</button> : <button
          type="button"
          className="pnc-primary"
          disabled={preparing || !checked}
          onClick={() => void device.prepare()}
        >{preparing || !checked ? "Menyiapkan…" : "Coba Lagi Persiapan"}</button>}

        <button
          type="button"
          className="pnc-later"
          onClick={dismiss}
          disabled={busy}
        >
          Nanti saja
        </button>
      </section>
    </div>,
    panel
  );
}
