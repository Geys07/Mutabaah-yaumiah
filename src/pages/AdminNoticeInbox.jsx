import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { PAGE_SIZE } from "../lib/pagination";
import Pagination from "../components/Pagination";
import EmptyState from "../components/EmptyState";
import useNotificationPulse from "../hooks/useNotificationPulse";
import AppConfirmDialog from "../components/AppConfirmDialog";
import "./AdminNoticeInbox.css";

const FILTERS = [
  { id: "all", title: "Semua" },
  { id: "unread", title: "Belum Dibaca" },
  { id: "read", title: "Sudah Dibaca" },
];

function formatWib(date) {
  const value = new Date(date);
  if (Number.isNaN(value.getTime())) return "—";
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta", dateStyle: "medium", timeStyle: "short",
  }).format(value);
}

export default function AdminNoticeInbox({ onChanged, onOpenRequest }) {
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [revision, setRevision] = useState(0);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [confirmation, setConfirmation] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const reload = useCallback(() => setRevision((value) => value + 1), []);
  // Saat permohonan selesai di tab lain, baca ulang status pesan tanpa reload halaman.
  useNotificationPulse(reload);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError("");
      let query = supabase.from("admin_notice_inbox")
        .select("id,source,title,body,created_at,read_at", { count: "exact" })
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      if (filter === "unread") query = query.is("read_at", null);
      if (filter === "read") query = query.not("read_at", "is", null);
      const [listResult, unreadResult] = await Promise.all([
        query,
        supabase.from("admin_notice_inbox")
          .select("id", { count: "exact", head: true })
          .is("read_at", null),
      ]);
      if (!active) return;
      if (listResult.error || unreadResult.error) {
        setError("Kotak masuk belum bisa dimuat. Coba Muat Ulang.");
      } else {
        setItems(listResult.data || []);
        setTotal(listResult.count ?? 0);
        setUnread(unreadResult.count ?? 0);
      }
      setLoading(false);
    }
    void load();
    return () => { active = false; };
  }, [filter, page, revision]);

  useEffect(() => {
    if (loading || page === 0 || page * PAGE_SIZE < total) return undefined;
    const timer = window.setTimeout(() => setPage(Math.max(0, Math.ceil(total / PAGE_SIZE) - 1)), 0);
    return () => window.clearTimeout(timer);
  }, [loading, page, total]);

  async function act(action, id) {
    if (busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      let result;
      if (action === "mark-one") {
        result = await supabase.from("admin_notice_inbox")
          .update({ read_at: new Date().toISOString() })
          .eq("id", id).is("read_at", null);
      } else if (action === "mark-all") {
        result = await supabase.from("admin_notice_inbox")
          .update({ read_at: new Date().toISOString() })
          .is("read_at", null);
      } else if (action === "delete-one") {
        result = await supabase.from("admin_notice_inbox").delete().eq("id", id);
      } else if (action === "delete-read") {
        result = await supabase.from("admin_notice_inbox").delete().not("read_at", "is", null);
      } else {
        throw new Error("Tindakan tidak dikenal.");
      }
      if (result.error) throw result.error;
      const messages = {
        "mark-one": "Notifikasi ditandai sudah dibaca.",
        "mark-all": "Semua notifikasi sudah ditandai dibaca.",
        "delete-one": "Notifikasi berhasil dihapus.",
        "delete-read": "Seluruh notifikasi terbaca berhasil dihapus.",
      };
      setMessage(messages[action]);
      setConfirmation(null);
      reload();
      onChanged?.();
    } catch (caught) {
      setError(caught.message || "Tidak dapat memproses notifikasi.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="notice-inbox">
      <header className="notice-inbox-header">
        <div>
          <h2>Kotak Masuk</h2>
          <p>Pesan sistem dan pengingat. Riwayat permintaan tetap tersimpan.</p>
        </div>
        <span className="notice-inbox-count" aria-label={`${unread} belum dibaca`}>{unread} baru</span>
      </header>

      <div className="notice-inbox-toolbar">
        <div className="notice-inbox-filters" role="group" aria-label="Filter notifikasi">
          {FILTERS.map((item) => (
            <button type="button" key={item.id}
              className={filter === item.id ? "is-active" : ""}
              aria-pressed={filter === item.id}
              onClick={() => { setPage(0); setFilter(item.id); }}>
              {item.title}
            </button>
          ))}
        </div>
        <div className="notice-inbox-bulk">
          <button type="button" disabled={busy || loading || unread === 0}
            onClick={() => void act("mark-all")}>Tandai Semua</button>
          <button type="button" className="notice-inbox-danger"
            disabled={busy || loading || total === 0 && filter === "read"}
            onClick={() => setConfirmation({ action: "delete-read", title: "Hapus seluruh notifikasi yang sudah dibaca?" })}>
            Hapus Dibaca
          </button>
          <button type="button" disabled={loading || busy} onClick={reload}>Perbarui</button>
        </div>
      </div>

      {error && <p role="alert" className="notice-inbox-error">{error}</p>}
      {message && <p role="status" className="notice-inbox-success">{message}</p>}
      {loading ? (
        <p role="status" className="notice-inbox-loading">Memuat notifikasi…</p>
      ) : items.length === 0 ? (
        <EmptyState kind="notice" illustration="notification"
          title={filter === "unread" ? "Semua sudah dibaca" : filter === "read" ? "Belum ada yang dibaca" : "Belum ada notifikasi"}
          description="Notifikasi baru dan contoh pengingat akan muncul di sini." />
      ) : (
        <div className="notice-inbox-list">
          {items.map((item) => (
            <article className={`notice-inbox-item ${item.read_at ? "is-read" : "is-unread"}`} key={item.id}>
              <div className="notice-inbox-item-top">
                <span className="notice-inbox-type">{item.source === "sample" ? "CONTOH" : item.source === "account" ? "AKUN" : item.source === "phone" ? "WALI MURID" : "SISTEM"}</span>
                {item.read_at ? <span className="notice-inbox-read" aria-label="Notifikasi sudah dibaca">✓ Dibaca</span> : <span className="notice-inbox-new">● Baru</span>}
                <time dateTime={item.created_at}>{formatWib(item.created_at)} WIB</time>
              </div>
              <h3>{item.title}</h3>
              <p>{item.body}</p>
              <div className="notice-inbox-actions">
                {!item.read_at && <button type="button" disabled={busy} onClick={() => void act("mark-one", item.id)}>Tandai Dibaca</button>}
                {(item.source === "account" || item.source === "phone") &&
                  <button type="button" disabled={busy} onClick={() => onOpenRequest?.(item.source)}>Lihat Permintaan</button>}
                <button type="button" className="notice-inbox-danger" disabled={busy}
                  onClick={() => setConfirmation({ action: "delete-one", id: item.id, title: "Hapus notifikasi ini?" })}>Hapus</button>
              </div>
            </article>
          ))}
        </div>
      )}

      <Pagination page={page} total={total} loading={loading || busy} onChange={setPage} />

      {confirmation && <AppConfirmDialog
        danger
        title={confirmation.title}
        description="Pesan hanya dihapus dari kotak masuk Admin. Data permintaan dan catatan sistem tetap tersimpan."
        confirmLabel="Ya, Hapus" busy={busy} error={error}
        onCancel={()=>{setConfirmation(null);setError("");}}
        onConfirm={()=>void act(confirmation.action,confirmation.id)}
      />}
    </section>
  );
}
