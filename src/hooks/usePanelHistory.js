import { useCallback, useEffect, useRef } from "react";

// Menyimpan perjalanan menu PWA ke browser History (termasuk Back Android).
export default function usePanelHistory(scope, initialPage, onRestore) {
  const restoreRef = useRef(onRestore);
  useEffect(() => { restoreRef.current = onRestore; }, [onRestore]);

  useEffect(() => {
    const old = window.history.state;
    const state = old && typeof old === "object" ? old : {};
    window.history.replaceState({ ...state, __mutabaahNav: { scope, page: initialPage } }, "");
    const onPop = (event) => {
      const route = event.state?.__mutabaahNav;
      restoreRef.current(route?.scope === scope ? route.page : initialPage);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [scope, initialPage]);

  const push = useCallback((page) => {
    if (window.history.state?.__mutabaahNav?.scope === scope &&
        window.history.state.__mutabaahNav.page === page) return;
    const old = window.history.state;
    const state = old && typeof old === "object" ? old : {};
    window.history.pushState({ ...state, __mutabaahNav: { scope, page } }, "");
  }, [scope]);
  const replace = useCallback((page) => {
    const old = window.history.state;
    const state = old && typeof old === "object" ? old : {};
    window.history.replaceState({ ...state, __mutabaahNav: { scope, page } }, "");
  }, [scope]);
  return { push, replace };
}
