
import { useEffect, useMemo, useState } from "react";
import { readSheet } from "read-excel-file/browser";

import { supabase } from "../lib/supabase";
import "./StudentImport.css";

const HEADERS = [
  "Nama Siswa",
  "Kelas",
  "NIS",
  "NISN",
  "Jenis Kelamin",
];

function clean(value) {
  return String(value ?? "").trim();
}

function normalize(value) {
  return clean(value)
    .replace(/\s+/g, " ")
    .toUpperCase();
}

function genderValue(value) {
  const text = normalize(value);

  if (["L", "LAKI-LAKI", "LAKI LAKI"].includes(text)) {
    return "male";
  }

  if (["P", "PEREMPUAN"].includes(text)) {
    return "female";
  }

  return text ? "invalid" : "";
}

async function downloadTemplate(classes) {
  const XLSX = await import("xlsx");
  const exampleA = classes?.[0]?.name || "VII A";
  const exampleB = classes?.[1]?.name || exampleA;

  const data = [
    HEADERS,
    ["Ahmad Fauzan", exampleA, "26001", "0123456789", "L"],
    ["Siti Aisyah", exampleB, "26002", "0123456790", "P"],
  ];

  const sheet = XLSX.utils.aoa_to_sheet(data);

  sheet["!cols"] = [
    { wch: 30 },
    { wch: 15 },
    { wch: 17 },
    { wch: 19 },
    { wch: 18 },
  ];

  // Pertahankan NIS dan NISN sebagai teks
  // agar angka nol di depan tidak hilang.
  for (const address of Object.keys(sheet)) {
    if (
      address.startsWith("C") ||
      address.startsWith("D")
    ) {
      const cell = sheet[address];

      if (cell && !address.endsWith("1")) {
        cell.t = "s";
        cell.v = String(cell.v);
      }
    }
  }

  const workbook = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(
    workbook,
    sheet,
    "Siswa"
  );

  XLSX.writeFile(
    workbook,
    "template-impor-siswa.xlsx",
    { bookType: "xlsx" }
  );
}

export default function StudentImport({
  academicYearId,
  classes,
  onClose,
  onImported,
}) {
  const [rows, setRows] = useState([]);
  const [fileName, setFileName] = useState("");
  const [reading, setReading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (importing) return undefined;

    function handleEscape(event) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener(
      "keydown",
      handleEscape
    );

    return () => {
      window.removeEventListener(
        "keydown",
        handleEscape
      );
    };
  }, [importing, onClose]);

  const classMap = useMemo(
    () =>
      new Map(
        classes.map((item) => [
          normalize(item.name),
          item.id,
        ])
      ),
    [classes]
  );

  const invalidCount = useMemo(
    () =>
      rows.filter(
        (row) => row.issues.length > 0
      ).length,
    [rows]
  );

  async function readFile(event) {
    const file = event.target.files?.[0];

    event.target.value = "";

    if (!file) return;

    setRows([]);
    setResult(null);
    setError("");
    setFileName("");

    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      setError("Gunakan file Excel berformat .xlsx.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("Ukuran file maksimal 5 MB.");
      return;
    }

    setReading(true);

    try {
      // read-excel-file versi 9:
      // readSheet() mengembalikan array baris
      // dari worksheet pertama.
      const sheet = await readSheet(file);

      if (
        !Array.isArray(sheet) ||
        !sheet.length ||
        !Array.isArray(sheet[0])
      ) {
        throw new Error(
          "File Excel kosong atau struktur worksheet tidak valid."
        );
      }

      const header = sheet[0].map(normalize);

      const columnIndexes = HEADERS.map(
        (name) => header.indexOf(normalize(name))
      );

      if (columnIndexes.some((index) => index < 0)) {
        throw new Error(
          `Kolom wajib: ${HEADERS.join(", ")}.`
        );
      }

      const parsed = [];

      const usedNis = new Set();
      const usedNisn = new Set();
      const usedNames = new Set();

      for (let i = 1; i < sheet.length; i += 1) {
        const cells = sheet[i];

        if (
          !Array.isArray(cells) ||
          cells.every((cell) => !clean(cell))
        ) {
          continue;
        }

        const values = columnIndexes.map(
          (index) => clean(cells[index])
        );

        const [
          name,
          className,
          nis,
          nisn,
          genderText,
        ] = values;

        const classId = classMap.get(
          normalize(className)
        );

        const gender = genderValue(genderText);
        const issues = [];

        if (name.length < 2 || name.length > 150) {
          issues.push("Nama tidak valid");
        }

        if (!classId) {
          issues.push("Kelas tidak ditemukan");
        }

        if (nis.length > 30 || nisn.length > 30) {
          issues.push("NIS/NISN terlalu panjang");
        }

        if (gender === "invalid") {
          issues.push("Jenis kelamin tidak valid");
        }

        if (nis && usedNis.has(nis)) {
          issues.push("NIS ganda");
        }

        if (nisn && usedNisn.has(nisn)) {
          issues.push("NISN ganda");
        }

        const normalizedName = normalize(name);

        if (usedNames.has(normalizedName)) {
          issues.push(
            "Nama berulang, perlu pemeriksaan"
          );
        }

        if (nis) usedNis.add(nis);
        if (nisn) usedNisn.add(nisn);

        usedNames.add(normalizedName);

        parsed.push({
          rowNumber: i + 1,
          name,
          className,
          classId,
          nis,
          nisn,
          gender:
            gender === "invalid" ? "" : gender,
          issues,
        });
      }

      if (!parsed.length) {
        throw new Error(
          "Tidak ditemukan data siswa."
        );
      }

      if (parsed.length > 500) {
        throw new Error(
          "Maksimal 500 siswa untuk satu kali impor."
        );
      }

      setFileName(file.name);
      setRows(parsed);
    } catch (readError) {
      setError(
        readError.message ||
          "File Excel gagal dibaca."
      );
    } finally {
      setReading(false);
    }
  }

  async function handleImport() {
    if (
      importing ||
      reading ||
      !rows.length ||
      result
    ) {
      return;
    }

    if (invalidCount > 0) {
      setError(
        "Perbaiki semua baris bermasalah sebelum mengimpor."
      );
      return;
    }

    setImporting(true);
    setError("");

    try {
      const payload = rows.map((row) => ({
        full_name: row.name,
        class_id: row.classId,
        nis: row.nis || null,
        nisn: row.nisn || null,
        gender: row.gender || null,
      }));

      const {
        data,
        error: importError,
      } = await supabase.rpc(
        "import_students_atomic",
        {
          p_academic_year_id: academicYearId,
          p_rows: payload,
        }
      );

      if (importError) {
        throw importError;
      }

      setResult({
        total: Number(data),
      });

      onImported();
    } catch (importError) {
      setError(
        importError.message ||
          "Impor gagal. Tidak ada data dari file ini yang disimpan."
      );
    } finally {
      setImporting(false);
    }
  }

  return (
    <div
      className="student-import-backdrop"
      onMouseDown={(event) => {
        if (
          event.target === event.currentTarget &&
          !importing
        ) {
          onClose();
        }
      }}
    >
      <section
        className="student-import-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="student-import-title"
      >
        <header className="student-import-header">
          <div>
            <h2 id="student-import-title">
              Impor Data Siswa
            </h2>

          </div>

          <button
            type="button"
            className="student-import-close"
            aria-label="Tutup"
            disabled={importing}
            onClick={onClose}
          >
            ×
          </button>
        </header>

        <div className="student-import-body">
          <div className="student-import-top">
            <button
              type="button"
              className="student-import-secondary"
              disabled={importing}
              onClick={() => { void downloadTemplate(classes).catch((caught) => setError(caught.message || "Gagal mengunduh template.")); }}
            >
              Unduh Template
            </button>

            <label className="student-import-file">
              <span>
                Pilih File Excel (.xlsx)
              </span>

              <input
                type="file"
                accept=".xlsx"
                disabled={reading || importing}
                onChange={readFile}
              />
            </label>
          </div>

          <p className="student-import-help">Formatkan NIS dan NISN sebagai Teks agar nol di awal tidak hilang.</p>

          {reading && (
            <p>Membaca file Excel...</p>
          )}

          {fileName && (
            <p className="student-import-help">
              File: {fileName}
            </p>
          )}

          {error && (
            <p
              className="student-import-error"
              role="alert"
            >
              {error}
            </p>
          )}

          {rows.length > 0 && (
            <>
              <div className="student-import-summary">
                <strong>
                  {rows.length} baris siswa
                </strong>

                <span>
                  {invalidCount > 0
                    ? `${invalidCount} baris bermasalah`
                    : "Semua baris lolos pemeriksaan format"}
                </span>
              </div>

              <div className="student-import-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Baris</th>
                      <th>Nama</th>
                      <th>Kelas</th>
                      <th>NIS</th>
                      <th>NISN</th>
                      <th>Status</th>
                    </tr>
                  </thead>

                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.rowNumber}>
                        <td>{row.rowNumber}</td>
                        <td>{row.name}</td>
                        <td>{row.className}</td>
                        <td>{row.nis || "—"}</td>
                        <td>{row.nisn || "—"}</td>

                        <td>
                          {row.issues.length
                            ? row.issues.join("; ")
                            : "Siap diperiksa server"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p className="student-import-help">Jika ada konflik, impor dibatalkan tanpa mengubah data lama.</p>
            </>
          )}

          {importing && (
            <p className="student-import-progress">
              Memeriksa dan menyimpan data...
            </p>
          )}

          {result && (
            <div
              className="student-import-result"
              role="status"
            >
              <strong>Impor Berhasil</strong>

              <p>
                {result.total} siswa berhasil disimpan.
                Seluruh baris diproses dalam satu
                transaksi.
              </p>
            </div>
          )}
        </div>

        <footer className="student-import-footer">
          <button
            type="button"
            className="student-import-secondary"
            disabled={importing}
            onClick={onClose}
          >
            {result ? "Selesai" : "Batal"}
          </button>

          <button
            type="button"
            className="student-import-primary"
            disabled={
              reading ||
              importing ||
              !rows.length ||
              invalidCount > 0 ||
              Boolean(result)
            }
            onClick={handleImport}
          >
            {importing
              ? "Memproses..."
              : "Impor Semua Siswa"}
          </button>
        </footer>
      </section>
    </div>
  );
}
