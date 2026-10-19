import { SCHOOL_LOGO_URL } from "../lib/branding";
import TimeVideoBackground from "./TimeVideoBackground";
import "./LoadingAnimation.css";

const FALLBACK_QUOTE = {
  arabic: "وَقُلْ رَبِّ زِدْنِي عِلْمًا",
  translation:
    "Dan katakanlah, 'Ya Tuhanku, tambahkanlah ilmu kepadaku.'",
  source: "QS. Taha: 114",
};

export default function LoadingAnimation({
  school,
  quote,
  progress = 0,
  message = "Menyiapkan aplikasi...",
}) {
  const numericProgress = Number(progress);

  const value = Number.isFinite(numericProgress)
    ? Math.max(0, Math.min(100, numericProgress))
    : 0;

  const shownQuote =
    quote?.arabic &&
    quote?.translation &&
    quote?.source
      ? quote
      : FALLBACK_QUOTE;

  return (
    <main
      className="mut-load-page"
      aria-busy={value < 100}
    >
      <TimeVideoBackground className="mut-live-landscape" />

      {/* Gradasi bawah yang sudah disetujui tetap dipertahankan. */}
      <div
        className="mut-live-bottom-fade"
        aria-hidden="true"
      />

      <header className="mut-live-brand">
        <img
          src={school?.logoUrl || SCHOOL_LOGO_URL}
          alt={`Logo ${school?.name || "MTs Al-Khairiyah"}`}
          className="mut-live-logo"
          width="90"
          height="90"
          fetchPriority="high"
        />

        <h1>
          {school?.appName?.trim() || "Mutabaah Yaumiah"}
        </h1>

        <p>
          {school?.name?.trim() || "MTs Al-Khairiyah"}
        </p>
      </header>

      <div className="mut-live-bottom">
        <section
          className="mut-live-progress"
          aria-label="Progres aplikasi"
        >
          <div className="mut-live-progress-row">
            <div
              className="mut-live-track"
              role="progressbar"
              aria-label="Progres memuat aplikasi"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(value)}
            >
              <div
                className="mut-live-fill"
                style={{ width: `${value}%` }}
              />
            </div>

            <span className="mut-live-percent">
              {Math.round(value)}%
            </span>
          </div>

          <p
            className="mut-live-message"
            role="status"
            aria-live="polite"
          >
            {message}
          </p>

          <p className="mut-live-caption">
            {value >= 100
              ? "Aplikasi siap digunakan"
              : "Mohon tunggu sebentar..."}
          </p>
        </section>

        <section
          className="mut-live-quote"
          aria-label="Kutipan Al-Qur'an"
        >
          <p
            className="mut-live-arabic"
            lang="ar"
            dir="rtl"
          >
            {shownQuote.arabic}
          </p>

          <p className="mut-live-translation">
            “{shownQuote.translation}”
          </p>

          <p className="mut-live-source">
            {shownQuote.source}
          </p>
        </section>
      </div>
    </main>
  );
}