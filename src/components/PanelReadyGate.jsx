
import { useEffect, useRef } from "react";

import {
  getDataRequestState,
  watchDataRequests,
} from "../lib/supabase";

const FIRST_SCREEN_BUSY = [
  /memuat data anak/i,
  /memuat rekap/i,
  /memuat kelas/i,
  /memuat laporan/i,
  /memuat\.\.\./i,
  /sedang memuat/i,
];

export default function PanelReadyGate({
  children,
  onReady,
  sessionKey,
}) {
  const rootRef = useRef(null);
  const readyRef = useRef(false);

  useEffect(() => {
    readyRef.current = false;

    const mountedAt = performance.now();
    let stableSince = null;
    let lastRevision = -1;

    function check() {
      if (readyRef.current) {
        return;
      }

      const now = performance.now();

      const {
        pending,
        revision,
        changedAt,
      } = getDataRequestState();

      const text =
        rootRef.current?.textContent || "";

      const visiblyBusy = FIRST_SCREEN_BUSY.some(
        (pattern) => pattern.test(text)
      );

      if (
        pending > 0 ||
        visiblyBusy ||
        revision !== lastRevision
      ) {
        stableSince = null;
        lastRevision = revision;
        return;
      }

      if (stableSince === null) {
        stableSince = now;
      }

      if (
        now - mountedAt >= 1400 &&
        now - changedAt >= 1100 &&
        now - stableSince >= 950
      ) {
        readyRef.current = true;
        onReady();
      }
    }

    const observer = new MutationObserver(check);

    if (rootRef.current) {
      observer.observe(rootRef.current, {
        childList: true,
        subtree: true,
        characterData: true,
      });
    }

    const unwatch = watchDataRequests(check);

    const interval = window.setInterval(
      check,
      150
    );

    check();

    return () => {
      unwatch();
      observer.disconnect();
      window.clearInterval(interval);
    };
  }, [onReady, sessionKey]);

  return (
    <div
      ref={rootRef}
      className="mut-panel-ready-gate"
    >
      {children}
    </div>
  );
}
