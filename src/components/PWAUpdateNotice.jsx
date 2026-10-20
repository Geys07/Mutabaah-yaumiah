import { useEffect } from "react";
import "../lib/pwaInstall";

// Check quietly for updates; the Service Worker installs new assets in the
// background. Do not skipWaiting or reload while another tab may have a draft.
export default function PWAUpdateNotice() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return undefined;

    const scope = import.meta.env.BASE_URL || "/";
    let registration = null;
    let disposed = false;

    function checkForUpdates() {
      if (disposed || !registration || document.hidden || navigator.onLine === false) return;
      void registration.update().catch(() => {});
    }

    void navigator.serviceWorker.register(`${scope}parent-push-sw.js`, { scope })
      .then((result) => {
        if (disposed) return;
        registration = result;
        checkForUpdates();
      })
      .catch(() => {});

    function onVisible() {
      if (!document.hidden) checkForUpdates();
    }

    window.addEventListener("focus", checkForUpdates);
    window.addEventListener("online", checkForUpdates);
    document.addEventListener("visibilitychange", onVisible);
    const interval = window.setInterval(checkForUpdates, 60 * 60 * 1000);

    return () => {
      disposed = true;
      window.clearInterval(interval);
      window.removeEventListener("focus", checkForUpdates);
      window.removeEventListener("online", checkForUpdates);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  // New worker activates naturally after old app windows are closed. Never
  // interrupt an active form, and never show a blocking update banner.
  return null;
}
