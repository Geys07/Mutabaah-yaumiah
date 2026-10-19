
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import "./ParentPushPrompt.css";

const HIDE_KEY = "mutabaah-parent-push-hide";

function decodeKey(base64url) {
  const fixed = base64url
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const raw = atob(
    fixed.padEnd(
      Math.ceil(fixed.length / 4) * 4,
      "="
    )
  );

  return Uint8Array.from(
    raw,
    (character) => character.charCodeAt(0)
  );
}

async function invoke(action, values = {}) {
  const { data, error } =
    await supabase.functions.invoke(
      "parent-push",
      {
        body: {
          action,
          ...values,
        },
      }
    );

  if (error) throw error;
  if (data?.error) {
    throw new Error(data.error);
  }

  return data;
}

export default function ParentPushPrompt() {
  const [sessionId, setSessionId] =
    useState(null);

  const [eligible, setEligible] =
    useState(false);

  const [
    alreadySubscribed,
    setAlreadySubscribed,
  ] = useState(false);

  const [dismissed, setDismissed] =
    useState(
      () =>
        sessionStorage.getItem(HIDE_KEY) === "1"
    );

  const [busy, setBusy] =
    useState(false);

  const [error, setError] =
    useState("");

  useEffect(() => {
    let active = true;

    supabase.auth.getUser().then(
      ({ data }) => {
        if (active) {
          setSessionId(
            data.user?.id || null
          );
        }
      }
    );

    const { data: listener } =
      supabase.auth.onAuthStateChange(
        (_event, session) => {
          setSessionId(
            session?.user?.id || null
          );
        }
      );

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (
      !sessionId ||
      !("serviceWorker" in navigator) ||
      !("PushManager" in window) ||
      !("Notification" in window) ||
      Notification.permission === "denied"
    ) {
      return undefined;
    }

    let active = true;

    async function check() {
      const [role, profile] =
        await Promise.all([
          supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", sessionId)
            .eq("role", "parent")
            .maybeSingle(),

          supabase
            .from("profiles")
            .select("account_status")
            .eq("user_id", sessionId)
            .maybeSingle(),
        ]);

      if (
        !active ||
        role.error ||
        profile.error ||
        !role.data ||
        profile.data?.account_status !==
          "active"
      ) {
        return;
      }

      try {
        const registration =
          await navigator.serviceWorker
            .getRegistration("/");

        const subscribed =
          Boolean(
            await registration
              ?.pushManager.getSubscription()
          );

        if (active) {
          setEligible(true);
          setAlreadySubscribed(
            subscribed
          );
        }
      } catch {
        if (active) {
          setEligible(true);
        }
      }
    }

    void check();

    return () => {
      active = false;
    };
  }, [sessionId]);

  async function enablePush() {
    if (busy) return;

    setBusy(true);
    setError("");

    try {
      const permission =
        await Notification.requestPermission();

      if (permission !== "granted") {
        setError(
          "Izin notifikasi belum diberikan."
        );
        return;
      }

      const config =
        await invoke("config");

      if (!config.public_key) {
        throw new Error(
          "Kunci publik belum tersedia."
        );
      }

      const base =
        import.meta.env.BASE_URL || "/";

      const registration =
        await navigator.serviceWorker.register(
          `${base}parent-push-sw.js`,
          { scope: base }
        );

      let subscription =
        await registration.pushManager
          .getSubscription();

      if (!subscription) {
        subscription =
          await registration.pushManager
            .subscribe({
              userVisibleOnly: true,
              applicationServerKey:
                decodeKey(
                  config.public_key
                ),
            });
      }

      await invoke("subscribe", {
        subscription:
          subscription.toJSON(),
      });

      setAlreadySubscribed(true);
    } catch (caught) {
      setError(
        caught.message ||
        "Gagal mengaktifkan notifikasi."
      );
    } finally {
      setBusy(false);
    }
  }

  if (
    !eligible ||
    alreadySubscribed ||
    dismissed ||
    !sessionId
  ) {
    return null;
  }

  return (
    <aside
      className="mut-parent-push-prompt"
      role="region"
      aria-label="Pengingat Mutabaah"
    >
      <div>
        <strong>
          Pengingat Mutabaah
        </strong>

        <p>
          Aktifkan pengingat pukul
          20.00 WIB di perangkat ini.
        </p>

        {error && (
          <small role="alert">
            {error}
          </small>
        )}
      </div>

      <div className="mut-parent-push-actions">
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            void enablePush()
          }
        >
          {busy
            ? "Memproses…"
            : "Aktifkan"}
        </button>

        <button
          type="button"
          className="mut-parent-push-later"
          onClick={() => {
            sessionStorage.setItem(
              HIDE_KEY,
              "1"
            );

            setDismissed(true);
          }}
        >
          Nanti
        </button>
      </div>
    </aside>
  );
}
