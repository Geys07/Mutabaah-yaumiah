import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { isNotificationAbort } from "../lib/notificationRead";

export default function useNotificationRead(key, loader, enabled = true) {
  const [state, setState] = useState({
    requestKey: null, dataKey: null, data: null, loading: true, error: null,
  });
  const loaderRef = useRef(loader);
  const resource = useRef({
    active: false, generation: 0, controller: null, promise: null,
    lastFinished: 0, lastKey: null,
  });
  useEffect(() => { loaderRef.current = loader; }, [loader]);

  const cancel = useCallback(() => {
    const item = resource.current;
    item.generation += 1;
    item.controller?.abort();
    item.controller = null;
    item.promise = null;
    item.lastFinished = 0;
  }, []);

  const refresh = useCallback(({ force = false, replace = false } = {}) => {
    const item = resource.current;
    if (!item.active || document.hidden) return Promise.resolve(null);
    if (item.promise && !replace) return item.promise;
    if (replace) cancel();
    if (!force && item.lastKey === key && Date.now() - item.lastFinished < 1000) {
      return Promise.resolve(null);
    }
    const controller = new AbortController();
    const generation = ++item.generation;
    item.controller = controller;
    setState((old) => ({ ...old, requestKey: key, loading: true, error: null }));
    const task = (async () => {
      // Assign the shared promise before even a synchronous loader can finish.
      await Promise.resolve();
      try {
        const data = await loaderRef.current(controller.signal);
        if (item.active && generation === item.generation) {
          setState({ requestKey: key, dataKey: key, data, loading: false, error: null });
        }
        return data;
      } catch (error) {
        if (item.active && generation === item.generation) {
          setState((old) => ({
            ...old, requestKey: key, loading: false,
            error: isNotificationAbort(error, controller.signal) ? null : error,
          }));
        }
        return null;
      } finally {
        if (item.controller === controller) {
          item.controller = null;
          item.promise = null;
          item.lastFinished = Date.now();
          item.lastKey = key;
        }
      }
    })();
    item.promise = task;
    return task;
  }, [key, cancel]);

  useEffect(() => {
    const item = resource.current;
    item.active = enabled;
    if (!enabled) { cancel(); return undefined; }
    item.lastFinished = 0;
    const initial = window.setTimeout(() => { void refresh(); }, 0);
    const interval = window.setInterval(() => {
      if (!document.hidden) void refresh();
    }, 30000);
    function focus() { if (!document.hidden) void refresh(); }
    function online() { if (!document.hidden) void refresh({ force: true }); }
    function visibility() {
      if (document.hidden) cancel();
      else void refresh();
    }
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") { item.active = false; cancel(); }
    });
    window.addEventListener("focus", focus);
    window.addEventListener("online", online);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      item.active = false;
      cancel();
      subscription.unsubscribe();
      window.clearTimeout(initial);
      window.clearInterval(interval);
      window.removeEventListener("focus", focus);
      window.removeEventListener("online", online);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [key, enabled, refresh, cancel]);

  return {
    data: state.data,
    current: state.dataKey === key,
    loading: enabled && (state.requestKey !== key || state.loading),
    error: state.requestKey === key ? state.error : null,
    refresh, cancel,
  };
}
