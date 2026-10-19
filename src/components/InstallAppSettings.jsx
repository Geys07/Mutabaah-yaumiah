import { useState } from "react";
import useInstallStatus from "../hooks/useInstallStatus";
import { isAppleMobile } from "../lib/pwaPlatform";
import { promptInstall } from "../lib/pwaInstall";
import "./InstallAppSettings.css";

export default function InstallAppSettings() {
  const { standalone, installed, canPrompt } = useInstallStatus();
  const [guide, setGuide] = useState(() => isAppleMobile() ? "ios" : "android");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function install() {
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      const result = await promptInstall();
      if (result === "dismissed") setMessage("Pemasangan dibatalkan. Panduan manual tetap tersedia.");
      else if (result === "accepted") setMessage("Permintaan pemasangan diterima. Ikuti proses pada perangkat Anda.");
    } catch { setMessage("Pemasangan belum dapat dimulai. Gunakan panduan menu Chrome di bawah."); }
    finally { setBusy(false); }
  }
  return <section className="install-settings" aria-labelledby="install-app-title">
    <h1 id="install-app-title">Panduan Aplikasi</h1>
    <p>Buka Mutabaah Yaumiah dengan mudah dari Layar Utama.</p>
    {(standalone || installed) && <p className="install-status" role="status">Aplikasi sudah terpasang.</p>}
    <div className="install-guide-tabs" role="group" aria-label="Panduan perangkat">
      <button type="button" aria-pressed={guide === "ios"} onClick={() => setGuide("ios")}>iPhone / iPad</button>
      <button type="button" aria-pressed={guide === "android"} onClick={() => setGuide("android")}>Android</button>
    </div>
    {guide === "ios" ? <div>
      <h2>iPhone dan iPad</h2>
      <ol>
        <li>Buka Mutabaah Yaumiah melalui Safari.</li>
        <li>Ketuk Bagikan, atau menu halaman lalu Bagikan sesuai versi Safari.</li>
        <li>Pilih Tambahkan ke Layar Utama.</li>
        <li>Pilih Buka sebagai Aplikasi jika tersedia, kemudian ketuk Tambah.</li>
        <li>Buka aplikasi dari ikon Layar Utama.</li>
        <li>Aktifkan notifikasi dari pengaturan aplikasi jika perangkat mendukung.</li>
      </ol>
      <p>Jika Tambahkan ke Layar Utama belum terlihat, cari melalui Edit Tindakan pada menu Bagikan, jika tersedia.</p>
      <p>Web Push memerlukan iOS/iPadOS 16.4 atau lebih baru dan aplikasi yang dibuka dari Layar Utama.</p>
    </div> : <div>
      <h2>Android dengan Chrome</h2>
      {canPrompt && <button type="button" className="install-primary" disabled={busy} onClick={() => void install()}>{busy ? "Memproses…" : "Pasang Aplikasi"}</button>}
      <ol>
        <li>Buka Mutabaah Yaumiah melalui Google Chrome.</li>
        <li>Ketuk menu tiga titik di pojok browser.</li>
        <li>Pilih Instal aplikasi atau Tambahkan ke layar utama, sesuai pilihan yang tersedia.</li>
        <li>Ikuti petunjuk, lalu buka dari ikon aplikasi.</li>
      </ol>
      <p>Jika tombol pemasangan belum tersedia, gunakan menu Chrome. Pada komputer, pilihan instal dapat tersedia di menu atau bilah alamat browser.</p>
    </div>}
    {message && <p role="status">{message}</p>}
    {!standalone && !installed && <p className="install-note">Status pemasangan di luar jendela aplikasi ini belum dapat dipastikan. Jika sudah memasang, buka melalui ikon Layar Utama.</p>}
  </section>;
}
