/**
 * Bank kutipan Al-Qur'an offline untuk aplikasi Mutabaah Yaumiah.
 * Jalankan sekali saat ada internet:
 *   node scripts/generate-islamic-quotes.mjs
 *
 * Kode ini mengunduh sumber TERBUKA (bukan saat aplikasi dibuka),
 * menyeleksi ayat pendek bertema pembiasaan baik, lalu menyimpan
 * JSON lokal dalam src/data/islamicQuotes.generated.json.
 *
 * Sumber data Arab + terjemahan Indonesia:
 *   https://github.com/rioastamal/quran-json
 *   data terjemahan dari Al-Qur'an Kemenag RI.
 *
 * Tidak menggunakan API key, Supabase, atau dependensi tambahan.
 * Untuk Node.js 18 atau yang lebih baru.
 */
import process from "node:process";
import { writeFile, rename } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { setTimeout as sleep } from "node:timers/promises";

const RAW_SOURCE =
  "https://raw.githubusercontent.com/rioastamal/quran-json/master/surah";
const OUTPUT = new URL("../src/data/islamicQuotes.generated.json", import.meta.url);
const TEMP_OUTPUT = new URL("../src/data/islamicQuotes.generated.tmp", import.meta.url);
const MAX_QUOTES = 1500;
const MAX_CONCURRENT = 6;
const RETRIES = 4;

// Tema yang cocok untuk anak madrasah dan refleksi harian.
const ENCOURAGING = new RegExp(
  [
    "allah", "tuhan", "beriman", "keimanan", "iman", "kebajikan",
    "kebaikan", "berbuat baik", "orang baik", "amal saleh",
    "kesabaran", "bersabar", "sabar", "kesabaran", "bersyukur", "syukur",
    "nikmat", "rahmat", "kasih sayang", "penyayang", "pemurah",
    "pengampun", "ampunan", "bertobat", "bertaubat", "pertolongan",
    "menolong", "membantu", "memberi", "sedekah", "infak",
    "doa", "berdoa", "berharap", "tawakal", "bertawakal",
    "petunjuk", "jalan yang lurus", "ilmu", "belajar", "bacalah",
    "membaca", "mendidik", "orang tua", "ibumu", "ayahmu",
    "bertakwa", "takwa", "kebenaran", "kejujuran", "jujur", "adil",
    "bersaudara", "persaudaraan", "berdamai", "damai", "memaafkan",
    "memaaf", "maaf", "menjaga", "memelihara", "melindungi",
    "bahagia", "kebahagiaan", "keberuntungan", "beruntung",
    "salat", "shalat", "ibadah", "beribadah", "berzikir", "mengingat",
    "sejahtera", "surga", "kemudahan", "memudahkan", "rezeki",
    "berkata baik", "perkataan yang baik", "sopan", "lemah lembut",
    "kebersihan", "bersih", "waktu", "pelajaran", "peringatan",
  ].join("|"),
  "i"
);

// Hindari kutipan yang berisi ancaman atau topik keras dalam layar muat.
const EXCLUDED = new RegExp(
  [
    "neraka", "azab", "siksa", "disiksa", "siksaan", "membunuh",
    "pembunuhan", "terbunuh", "memerangi", "perang", "peperangan",
    "kafir", "kemunafikan", "munafik", "celakalah", "kehancuran",
    "zina", "dosa besar", "hukuman", "dihukum", "api yang menyala",
  ].join("|"),
  "i"
);

function cleaned(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function validateAndConvert(surah, surahNumber) {
  const rawSurah = surah?.[String(surahNumber)];
  if (!rawSurah || !rawSurah.text || !rawSurah.translations?.id?.text) {
    throw new Error(`Struktur ayat surah ${surahNumber} tidak sesuai sumber.`);
  }

  const surahName = cleaned(rawSurah.name_latin) || `Surah ${surahNumber}`;
  const result = [];

  for (const [verseStr, arabicRaw] of Object.entries(rawSurah.text)) {
    const verse = Number(verseStr);
    const arabic = cleaned(arabicRaw);
    const translation = cleaned(rawSurah.translations.id.text[verseStr]);

    if (!Number.isInteger(verse) || verse < 1) continue;
    if (arabic.length < 16 || arabic.length > 180) continue;
    if (translation.length < 25 || translation.length > 180) continue;
    if (!ENCOURAGING.test(translation) || EXCLUDED.test(translation)) continue;

    result.push({
      id: `${surahNumber}:${verse}`,
      arabic,
      translation,
      source: `QS. ${surahName}: ${verse}`,
    });
  }

  return result;
}

async function fetchSurah(number) {
  const url = `${RAW_SOURCE}/${number}.json`;
  let lastError;

  for (let attempt = 1; attempt <= RETRIES; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(30000),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} pada surah ${number}`);
      }

      const data = await response.json();
      return validateAndConvert(data, number);
    } catch (error) {
      lastError = error;
      if (attempt < RETRIES) await sleep(700 * attempt);
    }
  }

  throw new Error(`Gagal mengambil Surah ${number}`, { cause: lastError });
}

function deduplicateAndBalance(bySurah) {
  // Mengutamakan pemerataan surah, supaya pesan di layar muat bervariasi.
  const usedTranslations = new Set();
  const selected = [];
  let offset = 0;

  while (selected.length < MAX_QUOTES) {
    let any = false;

    for (const quotes of bySurah) {
      if (offset >= quotes.length) continue;
      any = true;

      const item = quotes[offset];
      const normalized = item.translation
        .toLocaleLowerCase("id-ID")
        .replace(/[^\p{L}\p{N}]+/gu, "");

      if (usedTranslations.has(normalized)) continue;
      usedTranslations.add(normalized);
      selected.push(item);
      if (selected.length >= MAX_QUOTES) break;
    }

    if (!any) break;
    offset += 1;
  }

  return selected;
}

async function run() {
  if (Number(process.versions.node.split(".")[0]) < 18) {
    throw new Error("Gunakan Node.js versi 18 atau lebih baru.");
  }

  const all = Array.from({ length: 114 }, (_, index) => index + 1);
  const chunks = [];

  for (let index = 0; index < all.length; index += MAX_CONCURRENT) {
    const numbers = all.slice(index, index + MAX_CONCURRENT);
    const output = await Promise.all(numbers.map(fetchSurah));
    chunks.push(...output);
    process.stdout.write(
      `\rMembaca Al-Qur'an: ${Math.min(index + MAX_CONCURRENT, all.length)}/114 surah`
    );
  }

  const quotes = deduplicateAndBalance(chunks);
  if (quotes.length < 100) {
    throw new Error(
      `Baru mendapat ${quotes.length} kutipan; data kurang lengkap. ` +
      "File bank lama tidak diganti. Silakan coba lagi."
    );
  }

  await writeFile(TEMP_OUTPUT, `${JSON.stringify(quotes, null, 2)}\n`, "utf8");
  await rename(TEMP_OUTPUT, OUTPUT);
  process.stdout.write("\n");
  process.stdout.write(
    `Selesai: ${quotes.length} kutipan bersumber dari Al-Qur'an.\n` +
      `Tersimpan secara offline di src/data/islamicQuotes.generated.json\n`
  );
}

run().catch((error) => {
  process.stderr.write(
    `\nGagal memperbarui bank kutipan: ${error.message}\n` +
      "Bank lama tetap bisa digunakan. Periksa koneksi internet lalu coba lagi.\n"
  );
  process.exitCode = 1;
});
