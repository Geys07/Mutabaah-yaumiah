import { getParentEditorOpen, subscribeParentEditor } from "../lib/parentEditorState";
import { useEffect, useState, useSyncExternalStore } from "react";
import "./PWAUpdateNotice.css";
import "../lib/pwaInstall";

export default function PWAUpdateNotice() {
  const editorOpen = useSyncExternalStore(subscribeParentEditor, getParentEditorOpen);
  const [waiting, setWaiting] = useState(null);
  const [showUpdateGuide, setShowUpdateGuide] = useState(false);
  const [online, setOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return undefined;
    let active = true;
    let registration;
    function handleOnline() { setOnline(true); }
    function handleOffline() { setOnline(false); }
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL || "/"}parent-push-sw.js`, {
      scope: import.meta.env.BASE_URL || "/"
    }).then((r) => {
      if (!active) return;
      registration = r;
      if (r.waiting) setWaiting(r.waiting);
      r.addEventListener("updatefound", () => {
        const worker = r.installing;
        if (!worker) return;
        worker.addEventListener("statechange", () => {
          if (worker.state === "installed" && navigator.serviceWorker.controller && active) setWaiting(r.waiting);
        });
      });
    }).catch(() => {});
    function focus() { void registration?.update().catch(() => {}); }
    window.addEventListener("focus", focus);
    return () => {
      active = false;
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("focus", focus);
    };
  }, []);


  // There is no reliable global signal that every form/draft has synced.
  // Do not activate a waiting worker or arm a reload in this live document.
  // The browser can activate it naturally once all old clients are closed.
  if (editorOpen || (online && !waiting)) return null;
  return (
    <div className="pwa-notice" role="status">
      {!online && <span>Offline — pengisian baru perlu koneksi internet.</span>}
      {waiting && <button type="button" aria-expanded={showUpdateGuide} onClick={() => setShowUpdateGuide(value => !value)}>Pembaruan tersedia</button>}
      {waiting && showUpdateGuide && <p style={{ margin: 0, maxWidth: 360 }}>Pastikan semua draf sudah tersimpan. Setelah itu, tutup semua jendela aplikasi dan buka kembali untuk menggunakan pembaruan. Halaman ini tidak dimuat ulang otomatis.</p>}
    </div>
  );
}
