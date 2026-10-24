import { receiptFor } from "./recoveryRealtime.js";
import "../styles/recovery-chat-receipts.css";

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
