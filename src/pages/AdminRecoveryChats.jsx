import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import "./AdminRecoveryChats.css";

async function callChat(body) {
  const { data, error } = await supabase.functions.invoke("recovery-chat", { body });
  if (error) {
    try {
      const parsed = await error.context?.json();
      throw new Error(parsed?.error || error.message);
    } catch (problem) {
      if (problem?.message && problem.message !== "Unexpected end of JSON input") throw problem;
      throw error;
    }
  }
  if (data?.success !== true) throw new Error(data?.error || "Gagal memuat chat.");
  return data;
}
const statusLabel = {
  pending: "Menunggu", approved: "Disetujui", processing: "Diproses",
  rejected: "Ditolak", revoked: "Dibatalkan", used: "Selesai",
};
function formatDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  }).format(new Date(value));
}
function fullDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta", day: "numeric", month: "long", year: "numeric",
  }).format(new Date(value));
}
export default function AdminRecoveryChats() {
  const [tickets,setTickets]=useState([]);
  const [selected,setSelected]=useState("");
  const [detail,setDetail]=useState(null);
  const [query,setQuery]=useState("");
  const [statusFilter,setStatusFilter]=useState("all");
  const [draft,setDraft]=useState("");
  const [decision,setDecision]=useState("");
  const [busy,setBusy]=useState("");
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [mobileChat,setMobileChat]=useState(false);
  const endRef=useRef(null);

  const loadList=useCallback(async()=>{
    try {
      const result=await callChat({action:"admin_list"});
      setTickets(result.tickets || []);
    } catch (problem) {setError(problem.message || "Tidak dapat memuat daftar pemulihan.");}
  },[]);

  const loadDetail=useCallback(async(ticketId)=>{
    if(!ticketId)return;
    try {
      const result=await callChat({action:"admin_chat",ticket_id:ticketId});
      setDetail((old)=>old?.ticket_id===ticketId && old?.messages?.length===result.messages?.length ? {...result} : result);
    }catch(problem){setError(problem.message || "Tidak dapat memuat pesan.");}
  },[]);

  useEffect(()=>{
    let mounted=true;
    Promise.resolve().then(()=>{if(mounted) void loadList();});
    const timer=window.setInterval(()=>{if(!document.hidden) void loadList();},12000);
    const visible=()=>{if(!document.hidden)void loadList();};
    window.addEventListener("focus",visible);
    document.addEventListener("visibilitychange",visible);
    return ()=>{mounted=false;window.clearInterval(timer);window.removeEventListener("focus",visible);document.removeEventListener("visibilitychange",visible);};
  },[loadList]);

  useEffect(()=>{
    if(!selected)return undefined;
    let mounted=true;
    Promise.resolve().then(()=>{if(mounted) void loadDetail(selected);});
    const timer=window.setInterval(()=>{if(!document.hidden)void loadDetail(selected);},10000);
    return ()=>{mounted=false;window.clearInterval(timer);};
  },[selected,loadDetail]);

  useEffect(()=>{endRef.current?.scrollIntoView({block:"end"});},[selected,detail?.messages?.length]);

  const filtered=tickets.filter((ticket)=>{
    const match=(!query||[ticket.full_name,ticket.phone,ticket.child_summary].join(" ").toLowerCase().includes(query.toLowerCase()));
    const statusMatch=statusFilter==="all"||statusFilter==="active" && ["pending","approved","processing"].includes(ticket.status)
      ||statusFilter===ticket.status;
    return match&&statusMatch;
  });
  const current=tickets.find((item)=>item.id===selected);
  const pending=detail?.status==="pending";
  const canTalk=["pending","approved"].includes(detail?.status);
  const unread=tickets.reduce((n,t)=>n+(t.unread||0),0);

  function openChat(id){
    setSelected(id);setDetail(null);setMobileChat(true);setDecision("");setError("");setNotice("");
  }

  async function send(event){
    event.preventDefault();
    if(!selected||!draft.trim()||busy)return;
    setBusy("send");setError("");
    try{
      await callChat({action:"admin_send",ticket_id:selected,message:draft.trim()});
      setDraft("");
      await Promise.all([loadDetail(selected),loadList()]);
    }catch(problem){setError(problem.message || "Pesan gagal dikirim.");}
    finally{setBusy("");}
  }

  async function reissueCode(){
    if(!selected||busy||!window.confirm("Terbitkan kode pemulihan baru? Kode lama langsung dibatalkan."))return;
    setBusy("reissue");setError("");
    try{
      const result=await callChat({action:"admin_reissue",ticket_id:selected});
      setNotice(result.warning||"Kode baru berhasil dikirim melalui chat.");
      await Promise.all([loadDetail(selected),loadList()]);
    }catch(problem){setError(problem.message||"Gagal menerbitkan kode baru.");}
    finally{setBusy("");}
  }

  async function confirmDecision(){
    if(!pending||!decision||!selected||busy)return;
    setBusy("decision");setError("");
    try{
      const result=await callChat({action:"admin_review",ticket_id:selected,decision});
      setNotice(result.warning|| (decision==="approve"?"Permintaan disetujui. Kode dikirim ke chat.":"Permintaan telah ditolak."));
      setDecision("");
      await Promise.all([loadDetail(selected),loadList()]);
    }catch(problem){setError(problem.message || "Keputusan gagal disimpan.");}
    finally{setBusy("");}
  }

  return (
    <section className="arc-root" aria-label="Chat Pemulihan Kata Sandi">
      <header className="arc-page-title">
        <div><h2>Chat Pemulihan Kata Sandi</h2><p>Kelola percakapan pribadi wali murid dan staf tanpa keluar dari chat.</p></div>
        <button type="button" onClick={()=>void Promise.all([loadList(),selected?loadDetail(selected):null])} disabled={Boolean(busy)}>Perbarui</button>
      </header>
      {error&&<p className="arc-error" role="alert">{error}</p>}
      {notice&&<p className="arc-notice" role="status">{notice}</p>}
      <div className={`arc-layout ${mobileChat ? "is-open" : ""}`}>
        <aside className="arc-list" aria-label="Daftar percakapan">
          <div className="arc-list-header">
            <strong>Percakapan <span>{unread>0? "(" + unread + " baru)":""}</span></strong>
            <input type="search" value={query} onChange={e=>setQuery(e.target.value)}
              placeholder="Cari nama atau nomor HP..." aria-label="Cari percakapan"/>
            <div className="arc-filters">
              {[["all","Semua"],["active","Aktif"],["pending","Menunggu"],["approved","Disetujui"],["used","Selesai"],["rejected","Ditolak"]].map(([value,label])=>
                <button key={value} type="button" className={statusFilter===value?"is-active":""}
                  onClick={()=>setStatusFilter(value)}>{label}</button>)}
            </div>
          </div>
          <div className="arc-contacts">
            {filtered.length===0&&<p className="arc-empty">Belum ada percakapan untuk filter ini.</p>}
            {filtered.map((item)=>(
              <button key={item.id} className={`arc-contact ${selected===item.id?"is-selected":""}`}
                type="button" onClick={()=>openChat(item.id)}>
                <span className="arc-avatar" aria-hidden="true">{item.full_name?.trim()?.charAt(0)?.toUpperCase()||"?"}</span>
                <span className="arc-contact-text">
                  <strong>{item.full_name}</strong>
                  <small>{item.child_summary || "Permintaan pemulihan kata sandi"}</small>
                  <small className="arc-phone">{item.phone}</small>
                </span>
                <span className="arc-contact-meta">
                  <small>{formatDate(item.last_message_at)}</small>
                  <em data-status={item.status}>{statusLabel[item.status]||item.status}</em>
                  {item.unread>0&&<b>{item.unread}</b>}
                </span>
              </button>
            ))}
          </div>
        </aside>
        <div className="arc-room" aria-label="Isi percakapan">
          {!selected?(
            <div className="arc-placeholder"><span aria-hidden="true">✉</span><strong>Pilih Percakapan</strong>
              <p>Nama wali murid akan muncul di daftar sebelah kiri. Pilih untuk membalas atau memproses permintaan.</p></div>
          ):(
            <>
              <header className="arc-room-head">
                <button className="arc-mobile-back" type="button" onClick={()=>setMobileChat(false)} aria-label="Kembali ke daftar">‹</button>
                <span className="arc-avatar" aria-hidden="true">{current?.full_name?.slice(0,1)||"?"}</span>
                <div><strong>{detail?.name||current?.full_name||"Memuat..."}</strong>
                  <small>{(detail?.students||[]).join(", ")||detail?.phone||current?.phone||""}</small></div>
                <span className="arc-status" data-status={detail?.status}>{statusLabel[detail?.status]||""}</span>
              </header>
              {pending&&(
                <div className="arc-decision-bar">
                  <div><strong>Keputusan Pemulihan</strong><small>Verifikasi pemohon terlebih dahulu melalui nomor terdaftar.</small></div>
                  <div className="arc-decision-actions">
                    <button type="button" className="arc-approve" onClick={()=>setDecision("approve")}>Setujui & Kirim Kode</button>
                    <button type="button" className="arc-reject" onClick={()=>setDecision("reject")}>Tolak</button>
                  </div>
                </div>
              )}
              {detail?.status==="approved" && detail.reviewed_at &&
                detail.code_expired && (
                <div className="arc-decision-bar">
                  <div><strong>Kode pemulihan sudah kedaluwarsa</strong><small>Kode lama tidak dapat digunakan lagi.</small></div>
                  <div className="arc-decision-actions">
                    <button type="button" className="arc-approve" onClick={()=>void reissueCode()} disabled={Boolean(busy)}>Terbitkan Kode Baru</button>
                  </div>
                </div>
              )}
              <div className="arc-messages" role="log" aria-live="polite">
                {!detail&&<p className="arc-empty">Memuat pesan...</p>}
                {(detail?.messages||[]).map((msg)=>(
                  <article key={msg.id} className={`arc-message ${msg.sender==="admin"?"is-admin":"is-user"} ${msg.sender==="code"?"is-code":""}`}>
                    {msg.sender==="code"&&/^[a-z]{4}$/.test(msg.body)?(
                      <><strong>Kode Pemulihan</strong><div className="arc-code">{msg.body}</div>
                        <small>Empat huruf · 14 hari · sekali pakai</small></>
                    ):<p>{msg.body}</p>}
                    <small>{msg.sender==="admin"?"Anda":msg.sender==="user"?"Pemohon":"Sistem"} · {formatDate(msg.created_at)}</small>
                  </article>
                ))}
                {detail?.delete_after&&<p className="arc-expiry">
                  Riwayat akan dihapus pada {fullDate(detail.delete_after)} — 30 hari setelah keputusan Admin.
                </p>}
                <div ref={endRef}/>
              </div>
              {canTalk&&(
                <form className="arc-composer" onSubmit={send}>
                  <input value={draft} onChange={e=>setDraft(e.target.value)} maxLength={600}
                    placeholder="Ketik pesan..." aria-label="Pesan ke pemohon" disabled={Boolean(busy)}/>
                  <button type="submit" disabled={!draft.trim()||Boolean(busy)} aria-label="Kirim pesan">➤</button>
                </form>
              )}
              {!canTalk&&<p className="arc-closed">Percakapan ini telah ditutup dan hanya dapat dibaca.</p>}
            </>
          )}
        </div>
      </div>
      {decision&&(
        <div className="arc-dialog-backdrop" role="presentation">
          <div className="arc-dialog" role="dialog" aria-modal="true" aria-labelledby="arc-dialog-title">
            <h3 id="arc-dialog-title">{decision==="approve"?"Setujui Pemulihan Kata Sandi?":"Tolak Permintaan?"}</h3>
            <p>{decision==="approve"
              ?"Pastikan identitas pemohon telah diperiksa. Sistem akan menerbitkan kode empat huruf dan mengirimnya melalui chat."
              :"Pemohon akan menerima pesan penolakan otomatis melalui chat."}</p>
            <div className="arc-dialog-buttons">
              <button type="button" onClick={()=>setDecision("")} disabled={Boolean(busy)}>Batal</button>
              <button type="button" className={decision==="approve"?"arc-approve":"arc-reject"}
                disabled={Boolean(busy)} onClick={()=>void confirmDecision()}>
                {busy?"Memproses...":decision==="approve"?"Setujui & Kirim":"Ya, Tolak"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
