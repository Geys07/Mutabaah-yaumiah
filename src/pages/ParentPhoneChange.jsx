import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import "./ParentPhoneChange.css";

const phonePattern = /^08\d{8,11}$/;

export default function ParentPhoneChange({ account }) {
  const [newPhone, setNewPhone] = useState("");
  const [password, setPassword] = useState("");
  const [requests, setRequests] = useState([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function refresh() {
    const { data, error: problem } = await supabase
      .from("parent_phone_change_requests")
      .select("id,old_phone,new_phone,status,created_at")
      .eq("guardian_id", account.id)
      .order("created_at", { ascending: false })
      .limit(3);
    if (problem) throw problem;
    setRequests(data || []);
  }

  useEffect(() => {
    if (!account?.id) return undefined;
    let active = true;
    const start = window.setTimeout(() => {
      void supabase.from("parent_phone_change_requests")
        .select("id,old_phone,new_phone,status,created_at")
        .eq("guardian_id", account.id)
        .order("created_at", { ascending: false })
        .limit(3)
        .then(({ data }) => { if (active) setRequests(data || []); });
    }, 0);
    return () => { active = false; window.clearTimeout(start); };
  }, [account?.id]);

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    const phone = newPhone.replace(/\D/g, "");
    if (!phonePattern.test(phone)) {
      setError("Gunakan nomor HP 08 dengan panjang 10–13 digit.");
      return;
    }
    if (phone === account?.phone) {
      setError("Nomor baru tidak boleh sama dengan nomor sekarang.");
      return;
    }
    if (!password) {
      setError("Masukkan kata sandi saat ini.");
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const { data, error: problem } = await supabase.functions.invoke(
        "parent-phone-change", { body: { action: "request", new_phone: phone, password } }
      );
      if (problem) {
        let detail = problem.message;
        try { detail = (await problem.context?.json())?.error || detail; } catch { /* bukan JSON */ }
        throw new Error(detail);
      }
      if (!data?.success) throw new Error(data?.error || "Permohonan belum tersimpan.");
      setNewPhone("");
      setPassword("");
      setMessage("Permohonan terkirim. Nomor lama masih berlaku hingga disetujui Admin.");
      await refresh();
    } catch (caught) {
      setError(caught.message || "Gagal mengirim permohonan.");
    } finally {
      setBusy(false);
    }
  }

  const pending = requests.some((item) => item.status === "pending");
  return (
    <section className="phone-panel">
      <h2>Ganti Nomor HP</h2>
      <p>Nomor HP dipakai untuk masuk. Perubahan memerlukan persetujuan Admin.</p>
      <form onSubmit={submit}>
        <label>Nomor HP Baru
          <input type="tel" inputMode="numeric" autoComplete="tel" placeholder="08xxxxxxxxxx"
            value={newPhone} disabled={busy || pending} maxLength={16}
            onChange={(e) => setNewPhone(e.target.value)} />
        </label>
        <label>Konfirmasi Kata Sandi
          <input type="password" autoComplete="current-password" value={password}
            disabled={busy || pending} onChange={(e) => setPassword(e.target.value)} />
        </label>
        <button type="submit" disabled={busy || pending}>
          {pending ? "Menunggu Persetujuan" : busy ? "Memproses…" : "Ajukan Perubahan"}
        </button>
      </form>
      {requests[0] && <p className="phone-status">Pengajuan terakhir ({requests[0].new_phone}): {
        {pending:"Menunggu",approved:"Disetujui",rejected:"Ditolak"}[requests[0].status] || requests[0].status
      }</p>}
      {message && <p className="phone-success" role="status">{message}</p>}
      {error && <p className="phone-error" role="alert">{error}</p>}
    </section>
  );
}
