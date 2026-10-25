import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { edgeFunctionErrorMessage } from "../lib/edgeFunctionError";
import {
  useRecoverySignal, useRecoveryOutbox, createOptimisticMessage,
  combineRecoveryMessages,
} from "../lib/recoveryRealtime.js";
import { Receipt } from "../lib/recoveryRealtime.jsx";
import AppConfirmDialog from "../components/AppConfirmDialog";
import "./AdminRecoveryChats.css";

async function callChat(body) {
  const { data, error } = await supabase.functions.invoke("recovery-chat", { body });
  if (error) {
    throw new Error(await edgeFunctionErrorMessage(
      error, "Chat belum dapat dimuat. Periksa koneksi dan coba Perbarui."
    ));
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
  const [inboxTopic,setInboxTopic]=useState("");
  const {outbox,add:queueMessage,ack:ackMessage,fail:failMessage,retry:retryMessage}=useRecoveryOutbox();
  const [listLoaded,setListLoaded]=useState(false);
  const [selected,setSelected]=useState("");
  const [detail,setDetail]=useState(null);
  const [query,setQuery]=useState("");
  const [statusFilter,setStatusFilter]=useState("all");
  const [draft,setDraft]=useState("");
  const [decision,setDecision]=useState("");
  const [deleteTarget,setDeleteTarget]=useState(null);
  const [confirmReissue,setConfirmReissue]=useState(false);
  const [busy,setBusy]=useState("");
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [mobileChat,setMobileChat]=useState(false);
  const endRef=useRef(null);

  const loadList=useCallback(async()=>{
    try {
      const result=await callChat({action:"admin_list"});
      setTickets(result.tickets || []);
      if(result.realtime_topic) setInboxTopic(result.realtime_topic);
      setError("");
    } catch (problem) {setError(problem.message || "Tidak dapat memuat daftar pemulihan.");}
    finally {setListLoaded(true);}
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

    const visible=()=>{if(!document.hidden)void loadList();};
    window.addEventListener("focus",visible);
    document.addEventListener("visibilitychange",visible);
    return ()=>{mounted=false;window.removeEventListener("focus",visible);document.removeEventListener("visibilitychange",visible);};
  },[loadList]);

  useEffect(()=>{
    if(!selected)return undefined;
    let mounted=true;
    Promise.resolve().then(()=>{if(mounted) void loadDetail(selected);});

    return ()=>{mounted=false;};
  },[selected,loadDetail]);

  useRecoverySignal(inboxTopic, loadList);
  const refreshSelected=useCallback(()=>{
    if(selected)void loadDetail(selected);
  },[selected,loadDetail]);
  useRecoverySignal(detail?.realtime_topic, refreshSelected);
  const shownMessages=combineRecoveryMessages(detail?.messages||[],outbox,selected);
  useEffect(()=>{endRef.current?.scrollIntoView({block:"end"});},[selected,shownMessages.length]);

  const filtered=tickets.filter((ticket)=>{
    const match=(!query||[ticket.full_name,ticket.phone,ticket.child_summary].join(" ").toLowerCase().includes(query.toLowerCase()));
    const statusMatch=statusFilter==="all"||statusFilter==="active" && ["pending","approved","processing"].includes(ticket.status)
      ||statusFilter===ticket.status;
    return match&&statusMatch;
  }).sort((a,b)=>{
    function priority(t) {
      if(["used","rejected","revoked"].includes(t.status)) return 4;
      if(t.unread > 0) return 0;
      if(t.status === "pending") return 1;
      if(t.status === "processing") return 2;
      if(t.status === "approved") return 3;
      return 4;
    }
    return priority(a)-priority(b) ||
      new Date(b.last_message_at).getTime()-new Date(a.last_message_at).getTime();
  });
  const current=tickets.find((item)=>item.id===selected);
  const pending=detail?.status==="pending";
  const canTalk=["pending","approved"].includes(detail?.status);
  const unread=tickets.reduce((n,t)=>n+(t.unread||0),0);

  function openChat(id){
    setSelected(id);setDetail(null);setMobileChat(true);setDecision("");setError("");setNotice("");
  }

  async function transmit(message){
    try {
      const result=await callChat({
        action:"admin_send",ticket_id:message.scope,
        message:message.body,client_id:message.client_id
      });
      ackMessage(message.client_id,result.message||{});
      void loadDetail(message.scope);
      void loadList();
    }catch(problem){
      failMessage(message.client_id);
      setError(problem.message || "Pesan gagal dikirim. Ketuk pesan untuk mengulang.");
    }
  }
  function send(event){
    event.preventDefault();
    if(!selected||!draft.trim()||!canTalk)return;
    const message=createOptimisticMessage("admin",draft.trim(),selected);
    setDraft("");
    setError("");
    queueMessage(message);
    void transmit(message);
  }
  async function deleteChat(ticket) {
    if(!ticket || busy) return;
    if(!["used","rejected","revoked"].includes(ticket.status)){
      setError("Chat masih aktif. Selesaikan atau tolak permohonan sebelum menghapusnya.");
      return;
    }
    setBusy("delete-chat");
    setError("");
    try{
      await callChat({action:"admin_delete_chat",ticket_id:ticket.id});
      setTickets((old)=>old.filter((item)=>item.id!==ticket.id));
      if(selected===ticket.id){
        setSelected("");setDetail(null);setMobileChat(false);setDecision("");
      }
      setDeleteTarget(null);
      setNotice("Percakapan selesai berhasil dihapus.");
      // Tidak perlu menunggu request pemuatan ulang untuk memperbarui layar.
      void loadList();
    }catch(problem){
      setError(problem.message||"Percakapan belum dapat dihapus.");
    }finally{
      setBusy("");
    }
  }

  async function reissueCode(){
    if(!selected||busy)return;
    setBusy("reissue");setError("");
    try{
      const result=await callChat({action:"admin_reissue",ticket_id:selected});
      // Komit backend berhasil: dialog harus langsung menutup.
      setConfirmReissue(false);
      setNotice(result.warning||"Kode baru berhasil dikirim melalui chat.");
      void Promise.allSettled([loadDetail(selected),loadList()]);
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
      // Jangan membuka kembali konfirmasi bila permintaan refresh setelah
      // keputusan berhasil mengalami gangguan jaringan.
      void Promise.allSettled([loadDetail(selected),loadList()]);
    }catch(problem){setError(problem.message || "Keputusan gagal disimpan.");}
    finally{setBusy("");}
  }

  return (
    <section className="arc-root" aria-label="Chat Pemulihan Kata Sandi">
      <header className="arc-page-title">
        <div><h2>Percakapan</h2><p>Balas pesan dan proses pemulihan langsung dari chat.</p></div>
        <button type="button" onClick={()=>void Promise.all([loadList(),selected?loadDetail(selected):null])} disabled={Boolean(busy)}>Perbarui</button>
      </header>
      {error&&<p className="arc-error" role="alert">{error}</p>}
      {notice&&<p className="arc-notice" role="status">{notice}</p>}
      <div className={`arc-layout ${mobileChat ? "is-open" : ""} ${listLoaded && filtered.length === 0 ? "is-empty" : ""}`}>
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
            {filtered.length===0&&<div className="arc-empty-state" role="status">
              <span aria-hidden="true">✉</span>
              <strong>{!listLoaded ? "Memuat percakapan…" : error ? "Belum dapat memuat percakapan" : "Belum ada percakapan"}</strong>
              <p>{!listLoaded ? "Menghubungkan ke layanan pemulihan." : error ? "Gunakan Perbarui untuk mencoba kembali." : "Permintaan baru akan muncul di sini. Anda juga dapat mengganti filter."}</p>
            </div>}
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
                {["used","rejected","revoked"].includes(detail?.status)&&
                  <button type="button" className="arc-delete-chat" disabled={Boolean(busy)}
                    onClick={()=>{setError("");setDeleteTarget(current)}}
                    aria-label="Hapus seluruh percakapan">Hapus Chat</button>}
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
                    <button type="button" className="arc-approve" onClick={()=>{setError("");setConfirmReissue(true)}} disabled={Boolean(busy)}>Terbitkan Kode Baru</button>
                  </div>
                </div>
              )}
              <div className="arc-messages" role="log" aria-live="polite">
                {!detail&&<p className="arc-empty">Memuat pesan...</p>}
                {shownMessages.map((msg)=>(
                  <article key={msg.client_id||msg.id} className={`arc-message ${msg.sender==="admin"?"is-admin":"is-user"} ${msg.sender==="code"?"is-code":""}`}>
                    {msg.sender==="code"&&/^[a-z]{4}$/.test(msg.body)?(
                      <><strong>Kode Pemulihan</strong><div className="arc-code">{msg.body}</div>
                        <small>Empat huruf · 14 hari · sekali pakai</small></>
                    ):<p>{msg.body}</p>}
                    <small className="arc-message-meta">
                      <span>{msg.sender==="admin"?"Anda":msg.sender==="user"?"Pemohon":"Sistem"} · {formatDate(msg.created_at)}</span>
                      {msg.sender==="admin"&&<Receipt message={msg}/>}
                    </small>
                    <div className="arc-message-tools">
                      {msg.local_state==="failed"&&<button type="button"
                        onClick={()=>{retryMessage(msg.client_id);void transmit(msg);}}
                      >Kirim Ulang</button>}

                    </div>
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
                    placeholder="Ketik pesan..." aria-label="Pesan ke pemohon" disabled={!canTalk}/>
                  <button type="submit" disabled={!draft.trim()||!canTalk} aria-label="Kirim pesan">➤</button>
                </form>
              )}
              {!canTalk&&<p className="arc-closed">Percakapan ini telah ditutup dan hanya dapat dibaca.</p>}
            </>
          )}
        </div>
      </div>
      {deleteTarget&&<AppConfirmDialog
        danger title="Hapus Seluruh Percakapan?"
        description={`Seluruh pesan dan kode dalam chat ${deleteTarget.full_name} akan dihapus permanen. Catatan pemulihan akun tetap tersimpan.`}
        confirmLabel="Ya, Hapus Chat" busy={Boolean(busy)} error={error}
        onCancel={()=>{setDeleteTarget(null);setError("")}}
        onConfirm={()=>void deleteChat(deleteTarget)}
      />}
      {confirmReissue&&<AppConfirmDialog
        title="Terbitkan Kode Baru?"
        description="Kode pemulihan lama akan dibatalkan dan diganti. Pengguna menerima kode baru melalui chat."
        confirmLabel="Terbitkan Kode" busy={Boolean(busy)} error={error}
        onCancel={()=>{setConfirmReissue(false);setError("")}}
        onConfirm={()=>void reissueCode()}
      />}
      {decision&&<AppConfirmDialog
        title={decision==="approve"?"Setujui Pemulihan Kata Sandi?":"Tolak Permintaan?"}
        description={decision==="approve"
          ?"Pastikan identitas pemohon sudah diperiksa. Kode pemulihan empat huruf akan dikirim melalui chat."
          :"Pemohon akan menerima pemberitahuan penolakan di chat."}
        danger={decision==="reject"}
        confirmLabel={decision==="approve"?"Setujui & Kirim":"Ya, Tolak"}
        busy={Boolean(busy)} error={error}
        onCancel={()=>{setDecision("");setError("");}}
        onConfirm={()=>void confirmDecision()}
      />}
    </section>
  );
}
