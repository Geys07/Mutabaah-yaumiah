
import verifiedVerses from "./islamicQuotes.generated.json";

// BANK KUTIPAN MUTABAAH YAUMIAH
// Satu sumber untuk loading dan Panel Orang Tua.
// Data utama tetap berasal dari JSON lokal proyek.

const fallbackQuotes = [
  {
    id: "94:5",
    arabic: "فَإِنَّ مَعَ الْعُسْرِ يُسْرًا",
    translation: "Maka sesungguhnya beserta kesulitan ada kemudahan.",
    source: "QS. Asy-Syarh: 5",
  },
  {
    id: "94:6",
    arabic: "إِنَّ مَعَ الْعُسْرِ يُسْرًا",
    translation: "Sesungguhnya beserta kesulitan ada kemudahan.",
    source: "QS. Asy-Syarh: 6",
  },
  {
    id: "94:8",
    arabic: "وَإِلَىٰ رَبِّكَ فَارْغَبْ",
    translation: "Dan hanya kepada Tuhanmulah engkau berharap.",
    source: "QS. Asy-Syarh: 8",
  },
  {
    id: "20:114",
    arabic: "رَبِّ زِدْنِي عِلْمًا",
    translation: "Ya Tuhanku, tambahkanlah ilmu kepadaku.",
    source: "QS. Taha: 114",
  },
  {
    id: "2:153",
    arabic: "إِنَّ اللَّهَ مَعَ الصَّابِرِينَ",
    translation: "Sesungguhnya Allah beserta orang-orang yang sabar.",
    source: "QS. Al-Baqarah: 153",
  },
  {
    id: "17:23",
    arabic: "وَبِالْوَالِدَيْنِ إِحْسَانًا",
    translation: "Dan berbuat baiklah kepada kedua orang tua.",
    source: "QS. Al-Isra: 23",
  },
  {
    id: "2:152",
    arabic: "فَاذْكُرُونِي أَذْكُرْكُمْ",
    translation: "Maka ingatlah kepada-Ku, Aku pun akan ingat kepadamu.",
    source: "QS. Al-Baqarah: 152",
  },
  {
    id: "17:32",
    arabic: "وَلَا تَقْرَبُوا الزِّنَىٰ",
    translation: "Dan janganlah kamu mendekati zina.",
    source: "QS. Al-Isra: 32",
  },
  {
    id: "2:83",
    arabic: "وَقُولُوا لِلنَّاسِ حُسْنًا",
    translation: "Dan bertuturkatalah yang baik kepada manusia.",
    source: "QS. Al-Baqarah: 83",
  },
  {
    id: "17:37",
    arabic: "وَلَا تَمْشِ فِي الْأَرْضِ مَرَحًا",
    translation: "Dan janganlah engkau berjalan di bumi dengan sombong.",
    source: "QS. Al-Isra: 37",
  },
];

function normalizeQuotes(quotes) {
  const ids = new Set();
  const result = [];

  for (const quote of quotes) {
    if (!quote || typeof quote !== "object") {
      continue;
    }

    const id = String(quote.id || "").trim();
    const arabic = String(quote.arabic || "").trim();
    const translation = String(quote.translation || "").trim();
    const source = String(quote.source || "").trim();

    if (
      !id ||
      !arabic ||
      !translation ||
      !source ||
      ids.has(id)
    ) {
      continue;
    }

    ids.add(id);

    result.push({
      id,
      arabic,
      translation,
      source,
    });
  }

  return result;
}

// Seluruh bank tersedia untuk ayat harian.
export const islamicQuotes = normalizeQuotes([
  ...(Array.isArray(verifiedVerses) ? verifiedVerses : []),
  ...fallbackQuotes,
]);

// Khusus loading, pilih kutipan yang cukup ringkas.
// Tujuannya agar kartu ayat tidak membutuhkan scrollbar.
//
// Ayat harian di Panel Orang Tua tetap menggunakan
// SELURUH bank, tanpa pembatasan panjang ini.

const loadingQuotes = islamicQuotes.filter((quote) => {
  return (
    quote.arabic.length <= 58 &&
    quote.translation.length <= 125
  );
});

const activeLoadingQuotes =
  loadingQuotes.length > 0 ? loadingQuotes : islamicQuotes;

// Menyimpan riwayat kutipan loading di browser.
const STORAGE_KEY = "mutabaah_recent_quotes_v2";

function readHistory(validIds) {
  try {
    const saved = JSON.parse(
      window.localStorage.getItem(STORAGE_KEY) || "[]"
    );

    if (!Array.isArray(saved)) {
      return [];
    }

    return [...new Set(saved)].filter((id) =>
      validIds.has(id)
    );
  } catch {
    return [];
  }
}

function saveHistory(history) {
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(history)
    );
  } catch {
    // Aplikasi tetap berjalan apabila storage dibatasi.
  }
}

// LOADING ANIMATION
// Satu ayat acak setiap sesi pembukaan aplikasi.
// Tidak mengulang sebelum kumpulan loading habis.
export function getRandomQuote() {
  if (activeLoadingQuotes.length === 0) {
    return null;
  }

  const ids = new Set(
    activeLoadingQuotes.map((quote) => quote.id)
  );

  let history = readHistory(ids);
  const used = new Set(history);

  let available = activeLoadingQuotes.filter(
    (quote) => !used.has(quote.id)
  );

  if (available.length === 0) {
    history = [];
    available = activeLoadingQuotes;
  }

  const index = Math.floor(
    Math.random() * available.length
  );

  const selected = available[index];

  history.push(selected.id);
  saveHistory(history);

  return selected;
}

// PANEL ORANG TUA
// Mengacak urutan bank secara deterministik.
// Hasilnya sama pada semua perangkat/pengguna.

function createDailyOrder(quotes) {
  const result = [...quotes];
  let seed = 0x52a17c39;

  for (
    let index = result.length - 1;
    index > 0;
    index -= 1
  ) {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;

    const other = (seed >>> 0) % (index + 1);

    [result[index], result[other]] = [
      result[other],
      result[index],
    ];
  }

  return result;
}

const dailyOrder = createDailyOrder(islamicQuotes);

const MILLIS_PER_DAY = 24 * 60 * 60 * 1000;

const jakartaDateFormatter = new Intl.DateTimeFormat(
  "en-GB",
  {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }
);

function getJakartaDate(now = new Date()) {
  const parts = Object.fromEntries(
    jakartaDateFormatter
      .formatToParts(now)
      .map(({ type, value }) => [type, value])
  );

  return `${parts.year}-${parts.month}-${parts.day}`;
}

// Satu ayat per tanggal WIB.
// Semua orang tua mendapat ayat yang sama.
// Tidak berulang sampai seluruh bank digunakan.

export function getDailyQuote(
  jakartaDay = getJakartaDate()
) {
  if (dailyOrder.length === 0) {
    return null;
  }

  const match =
    /^(\d{4})-(\d{2})-(\d{2})$/.exec(jakartaDay);

  if (!match) {
    return dailyOrder[0];
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const utc = Date.UTC(year, month - 1, day);
  const checked = new Date(utc);

  if (
    checked.getUTCFullYear() !== year ||
    checked.getUTCMonth() !== month - 1 ||
    checked.getUTCDate() !== day
  ) {
    return dailyOrder[0];
  }

  const dayNumber = Math.floor(
    utc / MILLIS_PER_DAY
  );

  const anchor = Math.floor(
    Date.UTC(2026, 0, 1) / MILLIS_PER_DAY
  );

  const count = dailyOrder.length;

  const index =
    ((dayNumber - anchor) % count + count) % count;

  return dailyOrder[index];
}
