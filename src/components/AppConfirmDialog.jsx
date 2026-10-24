import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { getJakartaClock, getTimeTheme } from "../lib/jakartaTheme";
import "./AppConfirmDialog.css";

export default function AppConfirmDialog({
  title, description, confirmLabel="Konfirmasi", cancelLabel="Batal",
  busy=false, danger=false, error="", onConfirm, onCancel,
}) {
  const titleId=useId();
  const detailId=useId();
  const cancelRef=useRef(null);
  const theme=getTimeTheme(getJakartaClock().hour).key;
  useEffect(()=>{
    cancelRef.current?.focus();
    function keydown(event){
      if(event.key==="Escape"&&!busy){event.preventDefault();onCancel?.();}
    }
    window.addEventListener("keydown",keydown);
    return()=>window.removeEventListener("keydown",keydown);
  },[busy,onCancel]);
  return createPortal(
    <div className="app-confirm-overlay" data-time-theme={theme}
      role="presentation" onMouseDown={event=>{
        if(event.target===event.currentTarget&&!busy)onCancel?.();
      }}>
      <section className="app-confirm-dialog" role="alertdialog" aria-modal="true"
        aria-labelledby={titleId} aria-describedby={detailId}>
        <div className="app-confirm-mark" aria-hidden="true">{danger?"!":"?"}</div>
        <h2 id={titleId}>{title}</h2>
        <p id={detailId}>{description}</p>
        {error&&<p className="app-confirm-error" role="alert">{error}</p>}
        <footer>
          <button type="button" ref={cancelRef} disabled={busy}
            onClick={onCancel}>{cancelLabel}</button>
          <button type="button" className={danger?"is-danger":"is-primary"}
            disabled={busy} onClick={onConfirm}>
            {busy?"Memproses…":confirmLabel}
          </button>
        </footer>
      </section>
    </div>,document.body
  );
}
