
import {
  readFileSync,
  writeFileSync,
  existsSync,
} from "node:fs";

import { resolve } from "node:path";

const file = resolve(
  "src/pages/ParentDaily.jsx"
);

const backup = resolve(
  "src/pages/ParentDaily.sebelum-perbaikan-haid.txt"
);

if (!existsSync(file)) {
  throw new Error(
    "Buka terminal di folder utama proyek Mutabaah Yaumiah."
  );
}

const original = readFileSync(file, "utf8");
const lineEnding = original.includes("\r\n")
  ? "\r\n"
  : "\n";

const source = original.replace(/\r\n/g, "\n");

const marker =
  "// Bersihkan jawaban kegiatan yang dikecualikan ketika mulai haid.";

if (source.includes(marker)) {
  console.log(
    "Perbaikan haid sudah terpasang. Tidak ada perubahan kedua."
  );
  process.exit(0);
}

const anchor = `    setHaidInfo((previous) => ({
      ...previous,
      is_haid: value,
    }));`;

const first = source.indexOf(anchor);
const second = source.indexOf(
  anchor,
  first + 1
);

if (
  first < 0 ||
  second >= 0 ||
  !source
    .slice(Math.max(0, first - 220), first)
    .includes("function changeHaid(value)")
) {
  throw new Error(
    "Struktur changeHaid berbeda. File tidak diubah; " +
    "kirim ParentDaily.jsx terbaru untuk diperiksa."
  );
}

const replacement = `    ${marker}
    if (value) {
      const weekday = isoWeekday(selectedDate);

      setAnswers((previous) => {
        const next = { ...previous };

        for (const activity of activities) {
          if (
            isExcluded(
              activity,
              true,
              haidInfo.quran_exempt_when_haid,
              weekday
            )
          ) {
            delete next[activity.id];
          }
        }

        return next;
      });
    }

${anchor}`;

if (!existsSync(backup)) {
  writeFileSync(backup, original, "utf8");
}

writeFileSync(
  file,
  source
    .replace(anchor, replacement)
    .replace(/\n/g, lineEnding),
  "utf8"
);

console.log(
  "Berhasil: jawaban yang dikecualikan " +
  "dibersihkan saat Haid: Ya."
);

console.log("Cadangan:", backup);
