import { useState } from "react";
import useJakartaClock from "../hooks/useJakartaClock";
import { getTimeTheme } from "../lib/jakartaTheme";
import "./EmptyState.css";
const ILLUSTRATION_FILES = {
  student: "01-data-siswa/data-siswa",
  teacher: "02-akun-guru/akun-guru",
  principal: "03-kepala-madrasah/kepala-madrasah",
  parent: "04-orang-tua-wali/orang-tua-wali",
  notification: "05-notifikasi/notifikasi",
  report: "06-laporan-wajib/laporan-wajib",
  "extra-report": "06-laporan-wajib/laporan-wajib",
  "report-card": "08-rapor-mutabaah/rapor-mutabaah",
  class: "10-data-kelas/data-kelas",
};

// Jika aset belum tersedia, SVG lama tetap menjadi cadangan.
export default function EmptyState({ title, description, kind = "document", illustration }) {
  const clock = useJakartaClock();
  const theme = getTimeTheme(clock.hour).key;
  const [failedImage, setFailedImage] = useState(null);
  const asset = ILLUSTRATION_FILES[illustration];
  const imageSrc = asset
    ? `${import.meta.env.BASE_URL}empty-states/${asset}-${theme}.webp`
    : null;
  const showImage = Boolean(imageSrc && failedImage !== imageSrc);

  return <div className="my-empty-state" role="status">
    {showImage ? (
      <img
        className="my-empty-state-image"
        src={imageSrc}
        alt=""
        aria-hidden="true"
        loading="lazy"
        decoding="async"
        width="220"
        height="165"
        onError={() => setFailedImage(imageSrc)}
      />
    ) : (
      <svg viewBox="0 0 160 106" width="128" height="85" aria-hidden="true" focusable="false">
      <ellipse cx="80" cy="96" rx="65" ry="8" fill="currentColor" opacity=".07"/>
      <path d="M30 82C14 58 31 19 61 17c14-21 49-7 58 9 32 0 36 45 10 60Z" fill="currentColor" opacity=".06"/>
      <path d="M52 17h45l18 18v47a7 7 0 0 1-7 7H52a7 7 0 0 1-7-7V24a7 7 0 0 1 7-7Z" fill="currentColor" opacity=".14" stroke="currentColor" strokeWidth="2"/>
      <path d="M97 18v19h18" fill="none" stroke="currentColor" strokeWidth="2" opacity=".45"/>
      {kind==="student" ? <><circle cx="79" cy="46" r="13" fill="currentColor" opacity=".52"/><path d="M52 78c1-27 53-27 54 0" fill="none" stroke="currentColor" strokeWidth="9" strokeLinecap="round" opacity=".54"/><path d="M63 33q16-17 32 0" fill="none" stroke="currentColor" strokeWidth="7" opacity=".6"/></> : kind==="report" ? <><path d="M57 75V62m16 13V50m16 25V42m16 33V55" stroke="currentColor" strokeWidth="8" strokeLinecap="round" opacity=".6"/></> : kind==="school" ? <><path d="m52 50 28-21 28 21v30H52Z" fill="currentColor" opacity=".28"/><path d="M73 80V60h15v20" fill="none" stroke="currentColor" strokeWidth="5" opacity=".55"/></> : kind==="notice" ? <><rect x="55" y="45" width="48" height="28" rx="6" fill="currentColor" opacity=".25"/><path d="M60 53h37M60 62h24" stroke="currentColor" strokeWidth="4" opacity=".65"/></> : kind==="people" ? <>
        <circle cx="72" cy="49" r="11" fill="currentColor" opacity=".6"/>
        <path d="M52 76c0-23 40-23 40 0" fill="none" stroke="currentColor" strokeWidth="8" strokeLinecap="round" opacity=".6"/>
        <circle cx="99" cy="57" r="7" fill="currentColor" opacity=".3"/>
      </> : <path d="M58 48h42M58 60h37M58 72h25" stroke="currentColor" opacity=".65" strokeWidth="5" strokeLinecap="round"/>}
      <path d="m21 42 4-7 4 7 7 4-7 4-4 7-4-7-7-4Z" fill="currentColor" opacity=".22"/>
      <path d="m128 63 3-5 3 5 5 3-5 3-3 5-3-5-5-3Z" fill="currentColor" opacity=".3"/>
      </svg>
    )}
    <strong>{title}</strong>
    {description && <p>{description}</p>}
  </div>;
}
