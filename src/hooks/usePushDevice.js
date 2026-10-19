import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { checkPushDevice, preparePushDevice, enablePushDevice, disablePushDevice, pushAvailable, PUSH_DEVICE_EVENT } from "../lib/pushDevice";

const initial = { enabled: false, checked: false, busy: false, ready: false, preparing: true, error: "" };
export default function usePushDevice(kind, allowed = true) {
  const [id, setId] = useState(null);
  const [state, setState] = useState(initial);
  const generation = useRef(0);
  const accountVersion = useRef(0);
  const prepared = useRef(null);
  const working = useRef(false);
  const readInFlight = useRef(null);
  const invalidate = useCallback(() => { generation.current++; }, []);
  const invalidateAccount = useCallback(() => { accountVersion.current++; generation.current++; prepared.current = null; }, []);
  useEffect(() => {
    let live = true;
    let changed = false;
    let previous;
    function account(next) {
      if (!live) return;
      if (next !== previous) {
        previous = next;
        invalidateAccount();
        setState(initial);
      }
      setId(next);
    }
    void supabase.auth.getUser().then(({ data }) => { if (!changed) account(data?.user?.id || ""); });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => { changed = true; account(session?.user?.id || ""); });
    return () => { live = false; invalidateAccount(); data.subscription.unsubscribe(); };
  }, [invalidateAccount]);
  const refresh = useCallback(async (renew = false, preserveError = false) => {
    if (working.current || id === null || !allowed) return;
    if (readInFlight.current?.id === id && readInFlight.current.version === generation.current) return;
    const version = ++generation.current;
    const read = { id, version };
    readInFlight.current = read;
    setState(s => ({ ...s, preparing: !s.ready && !s.enabled, error: preserveError ? s.error : "" }));
    let enabled;
    try {
      enabled = await checkPushDevice(kind, id, renew);
      const context = id && pushAvailable() ? await preparePushDevice(kind, id) : null;
      if (version !== generation.current) return;
      prepared.current = context;
      setState(s => ({ enabled, checked: true, busy: false, ready: Boolean(context), preparing: false, error: preserveError ? s.error : "" }));
    } catch (error) {
      if (version !== generation.current) return;
      prepared.current = null;
      setState(s => ({ ...s, enabled: enabled ?? s.enabled, checked: true, busy: false, ready: false, preparing: false, error: error.message || "Notifikasi belum siap. Coba siapkan kembali." }));
    } finally {
      if (readInFlight.current === read) readInFlight.current = null;
    }
  }, [kind, id, allowed]);
  useEffect(() => {
    if (id === null) return undefined;
    const timer = setTimeout(() => { void refresh(true); }, 0);
    const update = () => { if (!working.current) void refresh(); };
    window.addEventListener(PUSH_DEVICE_EVENT, update);
    window.addEventListener("focus", update);
    window.addEventListener("online", update);
    return () => { clearTimeout(timer); invalidate(); window.removeEventListener(PUSH_DEVICE_EVENT, update); window.removeEventListener("focus", update); window.removeEventListener("online", update); };
  }, [refresh, id, invalidate]);
  async function toggle() {
    if (working.current || !id || !allowed || (!state.enabled && !prepared.current)) return false;
    working.current = true;
    const version = accountVersion.current;
    generation.current++;
    setState(s => ({ ...s, busy: true, error: "" }));
    try {
      if (state.enabled) await disablePushDevice(kind, id);
      else await enablePushDevice(kind, id, prepared.current);
      if (version === accountVersion.current) {
        prepared.current = null;
        setState({ enabled: !state.enabled, checked: true, busy: false, ready: false, preparing: false, error: "" });
        return true;
      }
    } catch (error) {
      const enabled = await checkPushDevice(kind, id).catch(() => false);
      if (version === accountVersion.current) {
        prepared.current = null;
        setState({ enabled, checked: true, busy: false, ready: false, preparing: false, error: error.message });
      }
    } finally {
      working.current = false;
      // Refresh only local/preparation status; never re-save a just-created sub.
      if (version === accountVersion.current) void refresh(false, true);
      else window.dispatchEvent(new Event(PUSH_DEVICE_EVENT));
    }
    return false;
  }
  return { ...state, id, toggle, refresh, prepare: () => refresh(false) };
}
