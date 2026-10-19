import { useEffect, useState } from "react";
import { SCHOOL_LOGO_URL } from "../lib/branding";
import "./OfflineStartup.css";

export default function OfflineStartup({ onRetry }) {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return <main className="offline-startup">
    <section aria-labelledby="offline-startup-title">
      <img src={SCHOOL_LOGO_URL} alt="Logo sekolah" width="72" height="72" />
      <p className="offline-brand">Mutabaah Yaumiah</p>
      <h1 id="offline-startup-title">{online ? "Aplikasi belum dapat dibuka" : "Anda sedang offline"}</h1>
      <p>Akun belum dapat diperiksa dengan aman. Data pribadi tidak ditampilkan.</p>
      <p role="status">{online ? "Perangkat terhubung. Tekan Coba Lagi untuk memeriksa koneksi ke server." : "Sambungkan perangkat ke internet, lalu tekan Coba Lagi."}</p>
      <button type="button" onClick={onRetry}>Coba Lagi</button>
      <p className="offline-note">Pengisian dan sinkronisasi Mutabaah memerlukan koneksi internet. Pemulihan ini tidak menghapus draf atau memuat ulang halaman secara paksa.</p>
    </section>
  </main>;
}
