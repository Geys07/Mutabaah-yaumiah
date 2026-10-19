
import {
  readFileSync,
  writeFileSync,
  existsSync,
} from "node:fs";

import { join } from "node:path";

const filename = join(
  process.cwd(),
  "src/pages/ReportCards.jsx"
);

if (!existsSync(filename)) {
  throw new Error(
    "Jalankan dari folder utama proyek Mutabaah."
  );
}

let code = readFileSync(filename, "utf8")
  .replace(/\r\n/g, "\n");

if (
  code.includes("function bonusItems(student)") &&
  code.includes("function makeBonusTable(")
) {
  console.log(
    "Rapor bonus dinamis sudah terpasang."
  );
  process.exit(0);
}

const oldNames =
  'const BONUS_NAMES = ["Rawatib", "Duha", "Tahajud", "Puasa Sunah"];';

if (!code.includes(oldNames)) {
  throw new Error(
    "Versi ReportCards.jsx berbeda dari ZIP (4). " +
    "Belum ada perubahan."
  );
}

const backup =
  filename + ".backup-sebelum-bonus.txt";

if (!existsSync(backup)) {
  writeFileSync(backup, code, "utf8");
}

function replaceOnce(oldText, newText, name) {
  const start = code.indexOf(oldText);

  if (
    start < 0 ||
    code.indexOf(
      oldText,
      start + oldText.length
    ) !== -1
  ) {
    throw new Error(
      `Bagian ${name} tidak ditemukan secara unik. ` +
      "Perubahan dibatalkan."
    );
  }

  code = code.replace(oldText, newText);
}

function replaceBetween(
  startMark,
  endMark,
  replacement,
  name
) {
  const i = code.indexOf(startMark);

  const j = i < 0
    ? -1
    : code.indexOf(
        endMark,
        i + startMark.length
      );

  if (i < 0 || j < 0) {
    throw new Error(
      `Bagian ${name} tidak ditemukan. ` +
      "Perubahan dibatalkan."
    );
  }

  code =
    code.slice(0, i) +
    replacement +
    "\n\n" +
    code.slice(j);
}

const helpers = `
// Nama pendek bawaan tetap seperti rapor asli.
function bonusDisplayName(title) {
  const value = safe(title);

  if (/^(?:shalat|salat)\\s+(?:sunah\\s+)?rawatib$/i.test(value))
    return "Rawatib";

  if (/^(?:shalat|salat)\\s+(?:sunah\\s+)?(?:duha|dhuha)$/i.test(value))
    return "Duha";

  if (/^(?:shalat|salat)\\s+(?:sunah\\s+)?tahajud$/i.test(value))
    return "Tahajud";

  return value;
}

function bonusItems(student) {
  const source = Array.isArray(student.bonuses)
    ? student.bonuses
    : [];

  const result = [];
  const seen = new Set();

  for (const item of source) {
    const title = safe(item?.title);

    if (!title) continue;

    const id = safe(item?.id) ||
      title.toLocaleLowerCase("id-ID");

    if (seen.has(id)) continue;

    seen.add(id);

    result.push({
      title: bonusDisplayName(title),
      original: title,
      count: Math.max(
        0,
        Math.trunc(num(item?.achieved))
      ),
    });
  }

  return result;
}

function bonusCells(student) {
  const items = bonusItems(student);

  return items.length
    ? items.map(
        (item) =>
          item.title + ": " +
          item.count + " kali"
      )
    : ["Belum ada kegiatan tambahan"];
}

function bonusExtraHeight(student) {
  return Math.max(
    0,
    Math.ceil(
      bonusCells(student).length / 4
    ) - 1
  ) * 1.15;
}
`;

replaceOnce(
  oldNames,
  helpers,
  "helper bonus"
);

replaceOnce(
  "bonuses: BONUS_NAMES.map((title) => [title, bonusCount(student, title)]),",
  "bonuses: bonusItems(student).map((item) => [item.original, item.count]),",
  "fingerprint bonus"
);

replaceOnce(
  "Math.max(0, Math.ceil((notes.parent.length - 170) / 95)) * 0.65;",
  "Math.max(0, Math.ceil((notes.parent.length - 170) / 95)) * 0.65 +\n    bonusExtraHeight(student);",
  "estimasi halaman"
);

replaceBetween(
  "function bonusCount(student, keyword) {",
  "function childrenOf(",
  `function makeBonusTable(table, student) {
    const oldRows = rowsOf(table);

    if (
      !oldRows.length ||
      childrenOf(oldRows[0], "tc").length !== 4
    ) {
      throw new Error(
        "Tabel apresiasi harus tetap empat kolom sesuai template asli."
      );
    }

    const prototype = oldRows[0].cloneNode(true);
    const cells = bonusCells(student);

    const rowCount = Math.max(
      1,
      Math.ceil(cells.length / 4)
    );

    for (const row of oldRows) {
      table.removeChild(row);
    }

    for (let i = 0; i < rowCount; i++) {
      const row = prototype.cloneNode(true);

      for (let col = 0; col < 4; col++) {
        setCell(
          row,
          col,
          cells[i * 4 + col] || ""
        );
      }

      table.appendChild(row);
    }
  }`,
  "render Word"
);

replaceOnce(
  '  const bonusRow = rowsOf(tables[2])[0];\n  BONUS_NAMES.forEach((name, index) => setCell(bonusRow, index,\n    `${name}: ${bonusCount(student, name)} kali`));',
  "  makeBonusTable(tables[2], student);",
  "isi tabel bonus Word"
);

replaceOnce(
  '    const afterDetails = isLast ? `<h2>APRESIASI KEGIATAN TAMBAHAN</h2>',
  '    const bonusLabels = bonusCells(student);\n    const bonusSlots = Math.max(4, Math.ceil(bonusLabels.length / 4) * 4);\n    const afterDetails = isLast ? `<h2>APRESIASI KEGIATAN TAMBAHAN</h2>',
  "susunan HTML bonus"
);

replaceOnce(
  '${BONUS_NAMES.map((name) => `<div>${htmlEscape(name)}: ${bonusCount(student, name)} kali</div>`).join("")}',
  '${Array.from({ length: bonusSlots }, (_, index) => `<div>${htmlEscape(bonusLabels[index] || "")}</div>`).join("")}',
  "kolom HTML bonus"
);

replaceOnce(
  "      .bonus div:last-child { border: 0; }",
  "      .bonus div:nth-child(4n) { border-right: 0; }\n      .bonus div:nth-child(n+5) { border-top: .25pt solid #999; }",
  "garis baris tambahan"
);

if (
  code.includes("BONUS_NAMES") ||
  code.includes("bonusCount(")
) {
  throw new Error(
    "Masih ada kode bonus statis. " +
    "File asli tidak diubah."
  );
}

writeFileSync(
  filename,
  code,
  "utf8"
);

console.log(
  "Berhasil: kegiatan Tambahan sekarang dinamis."
);

console.log(
  "Desain DOCX dan seluruh fungsi arsip tetap."
);

console.log("Cadangan:", backup);
