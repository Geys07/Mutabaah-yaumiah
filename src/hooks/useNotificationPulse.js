import { useEffect, useRef } from "react";
import { subscribeNotificationChanges } from "../lib/notificationUpdates";

// Fallback lintas perangkat: perbarui saat tab aktif setiap 30 detik;
// aksi lokal dan tab lain ter-update langsung tanpa refresh manual.
export default function useNotificationPulse(onRefresh, enabled = true, intervalMs = 30000) {
  const callback = useRef(onRefresh);
  useEffect(() => { callback.current = onRefresh; }, [onRefresh]);

  useEffect(() => {
    if (!enabled) return undefined;
    const refresh = () => {
      if (!document.hidden) callback.current();
    };
    const interval = window.setInterval(refresh, intervalMs);
    const stop = subscribeNotificationChanges(refresh);
    window.addEventListener("focus", refresh);
    window.addEventListener("online", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(interval);
      stop();
      window.removeEventListener("focus", refresh);
      window.removeEventListener("online", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [enabled, intervalMs]);
}
