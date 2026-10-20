import { useCallback, useEffect, useRef, useState } from "react";

const HISTORY_KEY = "__mutabaahScreen";

function readState() {
  const state = window.history.state;
  return state && typeof state === "object" ? state : {};
}

// Catat perpindahan layar dalam riwayat browser agar tombol Back Android
// kembali ke layar sebelumnya, tanpa mengubah URL atau membuat reload.
export default function useScreenHistory(initialScreen, scope) {
  const [screen, setScreen] = useState(initialScreen);
  const current = useRef(initialScreen);

  useEffect(() => {
    const state = readState();
    window.history.replaceState(
      { ...state, [HISTORY_KEY]: { scope, screen: initialScreen } },
      "",
      window.location.href
    );

    function onPopState(event) {
      const entry = event.state?.[HISTORY_KEY];
      const next =
        entry?.scope === scope && typeof entry.screen === "string"
          ? entry.screen
          : initialScreen;
      current.current = next;
      setScreen(next);
    }

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [initialScreen, scope]);

  const navigate = useCallback(
    (next) => {
      if (typeof next !== "string" || !next || current.current === next) return;
      window.history.pushState(
        { ...readState(), [HISTORY_KEY]: { scope, screen: next } },
        "",
        window.location.href
      );
      current.current = next;
      setScreen(next);
    },
    [scope]
  );

  const replace = useCallback(
    (next) => {
      if (typeof next !== "string" || !next) return;
      window.history.replaceState(
        { ...readState(), [HISTORY_KEY]: { scope, screen: next } },
        "",
        window.location.href
      );
      current.current = next;
      setScreen(next);
    },
    [scope]
  );

  const goBack = useCallback(() => window.history.back(), []);

  return [screen, navigate, replace, goBack];
}
