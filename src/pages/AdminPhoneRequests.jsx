import { useCallback, useState } from "react";
import { supabase } from "../lib/supabase";
import { PAGE_SIZE } from "../lib/pagination";
import usePagedQuery from "../lib/usePagedQuery";
import Pagination from "../components/Pagination";
import "./ParentPhoneChange.css";

export default function AdminPhoneRequests({ onChanged }) {
  const [page, setPage] = useState(0);
  const [refresh, setRefresh] = useState(0);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState("");
  const [dialog, setDialog] = useState(null);

  const query = useCallback((signal) => supabase.from("parent_phone_change_requests")
    .select("id,old_phone,new_phone,created_at,status,guardian_id", { count: "exact" })
    .eq("status", "pending").order("created_at", { ascending: false }).order("id")
    .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1).abortSignal(signal), [page]);
  const phonePage = usePagedQuery(query, page, setPage, 0, 30000, refresh);
  const requests = phonePage.data;
  async function load() { setRefresh((value) => value + 1); onChanged?.(); }

  async function decide() {
    if (!dialog || busy) return;
    setBusy(dialog.id);
    setError("");setMessage("");
    try {
      const { data, error: problem } = await supabase.functions.invoke("parent-phone-change", {
        body: {action:"review",request_id:dialog.id,approve:dialog.approve}
      });
      if (problem) {
        let detail=problem.message;
        try {detail=(await problem.context?.json())?.error||detail;} catch {/* bukan JSON */}
        throw new Error(detail);
      }
      if (!data?.success) throw new Error(data?.error || "Keputusan gagal disimpan.");
      setMessage(dialog.approve?"Nomor HP wali berhasil diganti.":"Permohonan ditolak.");
      setDialog(null);
      await load();
    } catch (caught) { setError(caught.message || "Gagal memproses permohonan."); }
    finally {setBusy("");}
  }

  const pending = requests.filter((item)=>item.status==="pending");
  return (
    <section className="phone-panel">
      <h2>Permohonan Ganti Nomor HP</h2>
      <p>Periksa nomor lama dan baru sebelum menyetujui permohonan.</p>
      {phonePage.loading ? <p>Memuat permohonan...</p> : pending.length === 0 ? <p>Belum ada permohonan menunggu persetujuan.</p> : (
        <div className="phone-request-list">
          {pending.map((item)=><div className="phone-request" key={item.id}>
            <div><strong>{item.old_phone} → {item.new_phone}</strong>
              <small>{new Date(item.created_at).toLocaleString("id-ID",{timeZone:"Asia/Jakarta"})}</small>
            </div>
            <div className="phone-actions">
              <button type="button" disabled={Boolean(busy)} onClick={()=>setDialog({...item,approve:false})}>Tolak</button>
              <button type="button" disabled={Boolean(busy)} onClick={()=>setDialog({...item,approve:true})}>Setujui</button>
            </div>
          </div>)}
        </div>
      )}
      <Pagination page={page} total={phonePage.total} loading={phonePage.loading || Boolean(busy)} onChange={setPage} />
      {phonePage.error && <p role="alert" className="phone-error">{phonePage.error}</p>}
      {message && <p role="status" className="phone-success">{message}</p>}
      {error && <p role="alert" className="phone-error">{error}</p>}
      {dialog && <div className="phone-overlay"><div className="phone-dialog" role="dialog" aria-modal="true" aria-labelledby="phone-title">
        <h3 id="phone-title">{dialog.approve?"Setujui perubahan?":"Tolak perubahan?"}</h3>
        <p>{dialog.old_phone} → {dialog.new_phone}</p>
        <div className="phone-actions">
          <button type="button" disabled={Boolean(busy)} onClick={()=>setDialog(null)}>Batal</button>
          <button type="button" autoFocus disabled={Boolean(busy)} onClick={()=>void decide()}>{busy?"Memproses…":"Ya, Konfirmasi"}</button>
        </div>
      </div></div>}
    </section>
  );
}
