import { useEffect, useRef, useState } from "react";
import { supabase } from "./supabase";

// Sinyal real-time TIDAK membawa isi pesan. Setelah sinyal, isi chat dibaca
// kembali lewat Edge Function yang memvalidasi pemilik tiket / role Admin.
export function useRecoverySignal(topic, onRefresh, fallbackMs = 12000) {
  const callback = useRef(onRefresh);
  useEffect(() => { callback.current = onRefresh; }, [onRefresh]);
  useEffect(() => {
    if (!topic || !/^recovery-chat-(?:admin-)?[a-f0-9]{48}$/.test(topic)) return undefined;
    const refresh = () => { if (!document.hidden) void callback.current(); };
    const channel = supabase.channel(topic)
      .on("broadcast", { event: "refresh" }, refresh)
      .subscribe((status) => {
        if (status === "SUBSCRIBED") refresh();
      });
    const timer = window.setInterval(refresh, fallbackMs);
    window.addEventListener("focus", refresh);
    window.addEventListener("online", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("online", refresh);
      document.removeEventListener("visibilitychange", refresh);
      void supabase.removeChannel(channel);
    };
  }, [topic, fallbackMs]);
}

export function combineRecoveryMessages(remote = [], queue = [], scope = "") {
  const serverClientIds = new Set(remote.map((m) => m.client_id).filter(Boolean));
  const remaining = queue.filter((m) => m.scope === scope &&
    !serverClientIds.has(m.client_id));
  return [...remote, ...remaining].sort((a, b) => {
    const diff = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    return diff || String(a.id).localeCompare(String(b.id));
  });
}

export function receiptFor(message) {
  if (message.local_state === "sending") return "sending";
  if (message.local_state === "failed") return "failed";
  if (message.read_at) return "read";
  if (message.delivered_at) return "delivered";
  return "sent";
}

export function Receipt({ message }) {
  const state = receiptFor(message);
  if (state === "sending") return <span className="rc-receipt is-sending" title="Mengirim pesan" aria-label="Mengirim pesan">◷</span>;
  if (state === "failed") return <span className="rc-receipt is-failed" title="Gagal mengirim, ketuk untuk mencoba lagi" aria-label="Gagal mengirim">!</span>;
  return (
    <span className={`rc-receipt ${state === "read" ? "is-read" : ""}`}
      aria-label={state === "read" ? "Sudah dibaca" : state === "delivered" ? "Sudah diterima" : "Terkirim"}
      title={state === "read" ? "Sudah dibaca" : state === "delivered" ? "Sudah diterima" : "Terkirim"}>
      {state === "sent" ? "✓" : "✓✓"}
    </span>
  );
}

export function createOptimisticMessage(sender, text, scope) {
  const client_id = crypto.randomUUID();
  return { id: client_id, client_id, sender, body: text, scope,
    created_at: new Date().toISOString(), read_at: null, delivered_at: null,
    local_state: "sending" };
}

export function useRecoveryOutbox() {
  const [outbox, setOutbox] = useState([]);
  function add(message) { setOutbox((old) => [...old, message]); }
  function ack(clientId, data = {}) {
    setOutbox((old) => old.map((m) =>
      m.client_id === clientId ? {...m,...data,local_state:"sent"} : m
    ));
  }
  function fail(clientId) {
    setOutbox((old) => old.map((m) =>
      m.client_id === clientId ? {...m,local_state:"failed"} : m
    ));
  }
  return {outbox,add,ack,fail};
}
