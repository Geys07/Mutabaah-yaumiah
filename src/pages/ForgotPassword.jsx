import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import "./ForgotPassword.css";

const TICKET_KEY = "mutabaah-password-recovery-chat-v1";
const initial = { phone: "", code: "", password: "", confirm: "" };
const normalizePhone = (value) => {
  const digits = String(value || "").replace(/\D/g, "");
  return digits.startsWith("62") ? "0" + digits.slice(2) : digits;
};

async function readError(error) {
  try {
    if (error?.context) {
      const data = await error.context.json();
      return data?.error || data?.message || error.message;
    }
  } catch { /* Gunakan pesan standar. */ }
  return error?.message || "Tidak dapat menghubungi layanan pemulihan.";
}

async function invoke(kind, body) {
  const { data, error } = await supabase.functions.invoke(kind, { body });
  if (error) throw new Error(await readError(error));
  if (data?.success !== true) throw new Error(data?.error || "Permintaan tidak berhasil.");
  return data;
}

function getSavedTicket() {
  try {
    const saved = localStorage.getItem(TICKET_KEY);
    return saved && /^[a-f0-9]{64}$/.test(saved) ? saved : "";
  } catch { return ""; }
}

function formatTime(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta", day: "numeric", month: "short",
    hour: "2-digit", minute: "2-digit",
  }).format(new Date(value));
}

function expiryText(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta", day: "numeric", month: "long", year: "numeric",
  }).format(new Date(value));
}

function uint8Base64(value) {
  const pad = "=".repeat((4 - (value.length % 4)) % 4);
  return Uint8Array.from(atob((value + pad).replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
}

export default function ForgotPassword({ onBack, onSuccess }) {
  const [token, setToken] = useState(getSavedTicket);
  const [view, setView] = useState(() => getSavedTicket() ? "chat" : "request");
  const [form, setForm] = useState(initial);
  const [chat, setChat] = useState(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [notificationsOn, setNotificationsOn] = useState(false);
  const lastMessageRef = useRef(null);

  const loadChat = useCallback(async () => {
    if (!token) return;
    try {
      const data = await invoke("recovery-chat", { action: "my_chat", token });
      setChat(data);
      setError("");
    } catch (problem) {
      if (/Akses percakapan tidak tersedia|403|401/.test(problem.message || "")) {
        try { localStorage.removeItem(TICKET_KEY); } catch { /* Abaikan. */ }
        setToken("");
        setChat(null);
        setView("request");
      } else {
        setError(problem.message || "Gagal mengambil chat.");
      }
    }
  }, [token]);

  useEffect(() => {
    if (view !== "chat" || !token) return undefined;
    let mounted = true;
    Promise.resolve().then(() => { if (mounted) void loadChat(); });
    const timer = window.setInterval(() => {
      if (!document.hidden) void loadChat();
    }, 10000);
    const focus = () => { if (!document.hidden) void loadChat(); };
    document.addEventListener("visibilitychange", focus);
    window.addEventListener("focus", focus);
    return () => {
      mounted = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", focus);
      window.removeEventListener("focus", focus);
    };
  }, [view, token, loadChat]);

  useEffect(() => {
    if (view === "chat") lastMessageRef.current?.scrollIntoView({ block: "end" });
  }, [view, chat?.messages?.length]);

  function update(key, value) {
    setForm((old) => ({ ...old, [key]: value }));
    setError("");
  }

  async function requestChat(event) {
    event.preventDefault();
    const phone = normalizePhone(form.phone);
    if (!/^08\d{8,11}$/.test(phone)) {
      setError("Masukkan nomor HP terdaftar dengan format 08xxxxxxxxxx.");
      return;
    }
    setBusy(true);setError("");setNotice("");
    try {
      const data = await invoke("recovery-chat", { action: "request", phone });
      localStorage.setItem(TICKET_KEY, data.token);
      setToken(data.token);
      setForm((old) => ({ ...old, phone }));
      setChat(null);
      setView("chat");
    } catch (problem) {
      setError(problem.message || "Permintaan gagal dikirim.");
    } finally { setBusy(false); }
  }

  async function sendMessage(event) {
    event.preventDefault();
    const message = draft.trim();
    if (!message || !token || busy) return;
    setBusy(true);setError("");
    try {
      await invoke("recovery-chat", { action: "my_send", token, message });
      setDraft("");
      await loadChat();
    } catch (problem) { setError(problem.message); }
    finally { setBusy(false); }
  }

  async function enableNotifications() {
    setBusy(true);setError("");
    try {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        throw new Error("Push notification belum didukung perangkat atau browser ini.");
      }
      const permission = await Notification.requestPermission();
      if (permission !== "granted") throw new Error("Izin notifikasi belum diberikan.");
      const data = await invoke("recovery-chat", { action: "push_config" });
      if (!data.public_key) throw new Error("Konfigurasi push belum siap.");
      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true, applicationServerKey: uint8Base64(data.public_key),
        });
      }
      await invoke("recovery-chat", { action: "my_subscribe", token, subscription: subscription.toJSON() });
      setNotificationsOn(true);
      setNotice("Pemberitahuan chat sudah aktif di perangkat ini.");
    } catch (problem) {
      setError(problem.message || "Notifikasi belum dapat diaktifkan.");
    } finally { setBusy(false); }
  }

  function openReset(code) {
    setForm((old) => ({ ...old, code: code || "", password: "", confirm: "" }));
    setError("");
    setView("reset");
  }

  async function redeem(event) {
    event.preventDefault();
    const phone = normalizePhone(form.phone);
    const code = form.code.toLowerCase().trim();
    if (!/^08\d{8,11}$/.test(phone)) return setError("Nomor HP tidak valid.");
    if (!/^[a-z]{4}$/.test(code)) return setError("Kode pemulihan harus empat huruf.");
    if (form.password.length < 6 || form.password.length > 72)
      return setError("Kata sandi baru harus 6–72 karakter.");
    if (form.password !== form.confirm) return setError("Konfirmasi kata sandi tidak cocok.");
    setBusy(true);setError("");
    try {
      await invoke("password-recovery", {
        action: "redeem", phone, code, password: form.password,
      });
      setForm((old) => ({ ...old, password: "", confirm: "", code: "" }));
      setNotice("Kata sandi berhasil diubah. Silakan kembali ke login.");
      setView("chat");
      await loadChat();
    } catch (problem) { setError(problem.message || "Gagal mengubah kata sandi."); }
    finally { setBusy(false); }
  }

  const status = chat?.status || "pending";
  const readOnly = ["used", "rejected", "revoked"].includes(status);
  const statusText = {
    pending: "Menunggu Admin", approved: "Disetujui", used: "Selesai",
    rejected: "Ditolak", revoked: "Ditutup", processing: "Sedang Diproses",
  };
  return (
    <section className={`forgot-password ${view === "chat" ? "is-chat" : ""}`} aria-label="Pemulihan Kata Sandi">
      {view === "request" && (
        <>
          <div className="fp-intro">
            <span className="fp-lock" aria-hidden="true">♙</span>
            <h2>Pemulihan Kata Sandi</h2>
            <p>Masukkan nomor HP yang terdaftar. Anda akan langsung terhubung ke ruang chat bantuan Admin.</p>
          </div>
          <form onSubmit={requestChat} className="fp-form">
            <label>Nomor HP
              <input autoFocus type="tel" inputMode="tel" autoComplete="tel" placeholder="08xxxxxxxxxx"
                value={form.phone} onChange={(e) => update("phone",e.target.value)} disabled={busy} required />
            </label>
            <button type="submit" className="fp-primary" disabled={busy}>{busy ? "Memeriksa..." : "Lanjutkan ke Chat"}</button>
          </form>
          <button type="button" className="fp-link" onClick={onBack}>Kembali ke Login</button>
        </>
      )}

      {view === "chat" && (
        <div className="fp-chat">
          <header className="fp-chat-head">
            <button type="button" onClick={onBack} className="fp-back" aria-label="Kembali ke Login">‹</button>
            <span className="fp-support-icon" aria-hidden="true">✦</span>
            <span className="fp-chat-title"><strong>Bantuan Pemulihan Kata Sandi</strong><small>Admin MTs Al-Khairiyah</small></span>
          </header>
          <div className="fp-chat-status"><span data-status={status}>{statusText[status] || status}</span></div>
          <div className="fp-chat-messages" role="log" aria-live="polite" aria-relevant="additions text">
            {!chat && <p className="fp-chat-loading">Memuat percakapan…</p>}
            {(chat?.messages || []).map((msg) => (
              <article key={msg.id} className={`fp-bubble ${msg.sender === "user" ? "is-mine" : "is-theirs"} ${msg.sender === "code" ? "is-code" : ""}`}>
                {msg.sender === "code" && /^[a-z]{4}$/.test(msg.body) ? (
                  <>
                    <strong>Kode Pemulihan</strong>
                    <div className="fp-secret" aria-label="Kode pemulihan">{msg.body}</div>
                    <small>Berlaku 14 hari sejak disetujui Admin.</small>
                    <button type="button" className="fp-primary" onClick={() => openReset(msg.body)}>Ganti Kata Sandi →</button>
                  </>
                ) : (
                  <p>{msg.body}</p>
                )}
                <small>{msg.sender === "user" ? "Anda" : msg.sender === "system" ? "Sistem" : "Admin"} · {formatTime(msg.created_at)}</small>
              </article>
            ))}
            {chat?.delete_after && (
              <p className="fp-expiry-note">Riwayat percakapan akan dihapus otomatis pada {expiryText(chat.delete_after)} (30 hari setelah keputusan Admin).</p>
            )}
            {status === "used" && <button type="button" className="fp-primary" onClick={() => onSuccess?.("Kata sandi berhasil diperbarui.")}>Kembali ke Login</button>}
            {!notificationsOn && !readOnly && (
              <button type="button" className="fp-notification-optin" onClick={() => void enableNotifications()} disabled={busy}>
                <span aria-hidden="true">♢</span> Aktifkan pemberitahuan ketika Admin membalas
              </button>
            )}
            <div ref={lastMessageRef}/>
          </div>
          {!readOnly && (
            <form className="fp-composer" onSubmit={sendMessage}>
              <input aria-label="Tulis pesan" value={draft} onChange={(e)=>setDraft(e.target.value)}
                maxLength={600} placeholder="Tulis pesan..." disabled={busy}/>
              <button type="submit" disabled={busy || !draft.trim()} aria-label="Kirim pesan">➤</button>
            </form>
          )}
        </div>
      )}

      {view === "reset" && (
        <>
          <div className="fp-intro">
            <h2>Ganti Kata Sandi</h2>
            <p>Masukkan kode empat huruf yang dikirim Admin melalui chat dan buat kata sandi baru.</p>
          </div>
          <form onSubmit={redeem} className="fp-form">
            <label>Nomor HP
              <input value={form.phone} onChange={(e)=>update("phone",e.target.value)} type="tel" required disabled={busy}/>
            </label>
            <label>Kode Pemulihan
              <input value={form.code} onChange={(e)=>update("code",e.target.value.toLowerCase().replace(/[^a-z]/g,"").slice(0,4))}
                autoComplete="off" maxLength={4} required disabled={busy}/>
            </label>
            <label>Kata Sandi Baru
              <input value={form.password} onChange={(e)=>update("password",e.target.value)}
                type="password" minLength={6} maxLength={72} required disabled={busy} autoComplete="new-password"/>
            </label>
            <label>Konfirmasi Kata Sandi
              <input value={form.confirm} onChange={(e)=>update("confirm",e.target.value)}
                type="password" minLength={6} maxLength={72} required disabled={busy} autoComplete="new-password"/>
            </label>
            <button type="submit" className="fp-primary" disabled={busy}>{busy ? "Memproses..." : "Simpan Kata Sandi Baru"}</button>
          </form>
          <button type="button" className="fp-link" onClick={() => setView("chat")}>Kembali ke Percakapan</button>
        </>
      )}
      {error && <p className="fp-error" role="alert">{error}</p>}
      {notice && <p className="fp-notice" role="status">{notice}</p>}
    </section>
  );
}
