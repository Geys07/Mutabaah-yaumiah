import { useEffect, useState } from "react";
import { PAGE_SIZE } from "./pagination";
import { useLiveDataRevision } from "./studentDataUpdates";
// Debounce filters, cancel superseded reads, and discard incomplete results.
export default function usePagedQuery(load, page, setPage, delay = 200, refreshMs = 0, reload = 0) {
  const liveRevision = useLiveDataRevision();
  const [result, setResult] = useState({ data: [], total: 0, loading: true, error: "", scope: null, reload: null });
  useEffect(() => {
    void reload;
    void liveRevision;
    let alive = true;
    let controller;
    async function run() {
      controller?.abort();
      const current = new AbortController(); controller = current;
      setResult((old) => ({ ...old, loading: true, error: "" }));
      try {
        const { data, count, error } = await load(current.signal);
        if (error) throw error;
        if (!alive || current.signal.aborted) return;
        if (!Number.isFinite(count)) throw new Error("Jumlah total tidak tersedia. Muat ulang daftar.");
        const total = count;
        if (page > 0 && page * PAGE_SIZE >= total) {
          setPage(Math.max(0, Math.ceil(total / PAGE_SIZE) - 1)); return;
        }
        setResult({ data: data || [], total, loading: false, error: "", scope: load, reload });
      } catch (error) {
        if (alive && !current.signal.aborted) setResult({ data: [], total: 0, loading: false, error: error.message || "Gagal memuat data.", scope: load, reload });
      }
    }
    const timer = setTimeout(run, delay);
    const poll = refreshMs ? setInterval(() => { if (!document.hidden) void run(); }, refreshMs) : null;
    return () => { alive = false; clearTimeout(timer); clearInterval(poll); controller?.abort(); };
  }, [load, page, setPage, delay, refreshMs, reload, liveRevision]);
  const pending = result.scope !== load || result.reload !== reload;
  return { ...result, data: pending ? [] : result.data, loading: pending || result.loading };
}
