
import { useEffect, useMemo, useState } from "react";



import { supabase } from "../lib/supabase";
import { listenStudentDataChanges } from "../lib/studentDataUpdates";
import useStudentSearch from "../lib/useStudentSearch";
import useDisplayPage from "../lib/useDisplayPage";
import Pagination from "../components/Pagination";
import { fetchAll } from "../lib/pagination";
import "./MonthlyReports.css";
import "./SectionTabs.css";
import EmptyState from "../components/EmptyState";

function jakartaToday() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value])
  );

  return `${values.year}-${values.month}-${values.day}`;
}

function monthLabel(value) {
  return new Intl.DateTimeFormat("id-ID", {
    month: "long",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  }).format(new Date(`${value}-01T12:00:00+07:00`));
}

function percentage(value, total) {
  const denominator = Number(total);
  if (!denominator) return 0;

  return Math.min(
    100,
    Math.round(
      (Number(value || 0) / denominator) * 100
    )
  );
}

function safeFileName(value) {
  return String(value || "kelas")
    .replace(/[\\/:*?"<>|]/g, "-")
    .trim();
}

function countBonus(student, id) {
  const found = (student.bonuses || []).find(
    (bonus) => bonus.id === id
  );
  return Number(found?.count) || 0;
}

function bonusTotal(student) {
  return (student.bonuses || []).reduce(
    (total, bonus) =>
      total + (Number(bonus.count) || 0),
    0
  );
}

const REQUIRED_HEADERS = [
  "No",
  "Nama Siswa",
  "NIS",
  "Hari Terdaftar",
  "Final",
  "Draf",
  "Belum Diisi",
  "Ya (Final)",
  "Tidak (Final)",
  "Terisi",
  "Total Wajib",
  "Keterisian Wajib (%)",
  "Capaian Wajib (%)",
];

function requiredRow(item, index) {
  return [
    index + 1,
    item.name,
    item.nis || "",
    Number(item.days || 0),
    Number(item.finalized_days || 0),
    Number(item.draft_days || 0),
    Number(item.unfilled_days || 0),
    Number(item.yes_count || 0),
    Number(item.no_count || 0),
    Number(item.filled_count || 0),
    Number(item.expected_count || 0),
    percentage(
      item.filled_count,
      item.expected_count
    ),
    percentage(
      item.yes_count,
      item.expected_count
    ),
  ];
}

export default function MonthlyReports() {
  const [today] = useState(jakartaToday);
  const [month, setMonth] = useState(
    () => jakartaToday().slice(0, 7)
  );

  const [classes, setClasses] = useState([]);
  const [classId, setClassId] = useState("");
  const [students, setStudents] = useState([]);
  const [bonusTypes, setBonusTypes] = useState([]);
  const [search, setSearch] = useState("");
  const [reportSection, setReportSection] = useState("required");

  const [loadingClasses, setLoadingClasses] =
    useState(true);
  const [loadingReport, setLoadingReport] =
    useState(true);

  const [exporting, setExporting] = useState("");
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);

  useEffect(() => listenStudentDataChanges(() => {
    if (!document.hidden) setRefresh((value) => value + 1);
  }), []);

  useEffect(() => {
    let cancelled = false;

    async function loadClasses() {
      try {
        const {
          data,
          error: problem,
        } = await fetchAll(() => supabase.rpc(
          "get_mutabaah_accessible_classes"
        ).order("academic_year", { ascending: false }).order("grade").order("class_name"), ["class_id"]);

        if (problem) throw problem;
        if (cancelled) return;

        const rows = Array.isArray(data)
          ? data
          : [];

        setClasses(rows);

        if (rows.length === 0) {
          setLoadingReport(false);
        }

        setClassId((previous) =>
          rows.some(
            (item) =>
              item.class_id === previous
          )
            ? previous
            : rows[0]?.class_id || ""
        );

        setError("");
      } catch (caught) {
        if (!cancelled) {
          setError(
            caught.message ||
            "Gagal memuat kelas."
          );
          setLoadingReport(false);
        }
      } finally {
        if (!cancelled) {
          setLoadingClasses(false);
        }
      }
    }

    void loadClasses();

    return () => {
      cancelled = true;
    };
  }, [refresh]);

  useEffect(() => {
    if (!classId || !month) {
      return undefined;
    }

    let cancelled = false;

    async function loadReports() {
      try {
        const start = `${month}-01`;

        const finish =
          month === today.slice(0, 7)
            ? today
            : new Date(
                Date.UTC(
                  Number(month.slice(0, 4)),
                  Number(month.slice(5, 7)),
                  0
                )
              )
                .toISOString()
                .slice(0, 10);

        const [
          required,
          statuses,
          bonuses,
        ] = await Promise.all([
          supabase.rpc(
            "get_mutabaah_monthly_required_report",
            {
              p_class_id: classId,
              p_month: start,
            }
          ),

          supabase.rpc(
            "get_mutabaah_class_month_status",
            {
              p_class_id: classId,
              p_month: start,
            }
          ),

          supabase.rpc(
            "get_mutabaah_bonus_counts",
            {
              p_class_id: classId,
              p_start_date: start,
              p_end_date: finish,
            }
          ),
        ]);

        for (const result of [
          required,
          statuses,
          bonuses,
        ]) {
          if (result.error) {
            throw result.error;
          }
        }

        if (cancelled) return;

        const statusMap = new Map(
          (
            Array.isArray(statuses.data)
              ? statuses.data
              : []
          ).map(
            (item) => [item.id, item]
          )
        );

        const bonusMap = new Map(
          (
            Array.isArray(bonuses.data)
              ? bonuses.data
              : []
          ).map(
            (item) => [
              item.id,
              item.bonuses || [],
            ]
          )
        );

        const distinctBonuses = new Map();

        for (
          const row of
          (
            Array.isArray(bonuses.data)
              ? bonuses.data
              : []
          )
        ) {
          for (const item of row.bonuses || []) {
            if (
              item.id &&
              !distinctBonuses.has(item.id)
            ) {
              distinctBonuses.set(item.id, {
                id: item.id,
                title: item.title,
              });
            }
          }
        }

        setBonusTypes([
          ...distinctBonuses.values(),
        ]);

        setStudents(
          (
            Array.isArray(required.data)
              ? required.data
              : []
          ).map((item) => ({
            ...item,

            finalized_days: Number(
              statusMap.get(item.id)
                ?.finalized_days || 0
            ),

            draft_days: Number(
              statusMap.get(item.id)
                ?.draft_days || 0
            ),

            unfilled_days: Number(
              statusMap.get(item.id)
                ?.unfilled_days || 0
            ),

            bonuses:
              bonusMap.get(item.id) || [],
          }))
        );

        setError("");
      } catch (caught) {
        if (!cancelled) {
          setStudents([]);
          setBonusTypes([]);

          setError(
            caught.message ||
            "Gagal memuat laporan bulanan."
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingReport(false);
        }
      }
    }

    void loadReports();

    return () => {
      cancelled = true;
    };
  }, [
    classId,
    month,
    refresh,
    today,
  ]);

  const selectedClass = classes.find(
    (item) =>
      item.class_id === classId
  );

  const searchResult = useStudentSearch(search, classId);
  const filtered = useMemo(() => {
    if (!search.trim()) return students;
    const ids = new Set(searchResult.data.map((row) => row.student_id));
    return students.filter((student) => ids.has(student.id));
  }, [students, search, searchResult.data]);
  const display = useDisplayPage(filtered);

  const summary = useMemo(
    () =>
      filtered.reduce(
        (sum, item) => ({
          finalized:
            sum.finalized +
            Number(item.finalized_days || 0),

          draft:
            sum.draft +
            Number(item.draft_days || 0),

          unfilled:
            sum.unfilled +
            Number(item.unfilled_days || 0),

          yes:
            sum.yes +
            Number(item.yes_count || 0),

          no:
            sum.no +
            Number(item.no_count || 0),

          filled:
            sum.filled +
            Number(item.filled_count || 0),

          expected:
            sum.expected +
            Number(item.expected_count || 0),

          bonus:
            sum.bonus +
            bonusTotal(item),
        }),
        {
          finalized: 0,
          draft: 0,
          unfilled: 0,
          yes: 0,
          no: 0,
          filled: 0,
          expected: 0,
          bonus: 0,
        }
      ),
    [filtered]
  );

  const canExport =
    Boolean(selectedClass) &&
    filtered.length > 0 &&
    !searchResult.loading && !searchResult.error &&
    !loadingClasses &&
    !loadingReport &&
    !exporting &&
    !error;

  function changeClass(value) {
    display.setPage(0);
    setClassId(value);
    setStudents([]);
    setBonusTypes([]);
    setError("");
    setLoadingReport(Boolean(value));
  }

  function changeMonth(value) {
    display.setPage(0);
    if (
      !value ||
      value > today.slice(0, 7)
    ) {
      return;
    }

    setMonth(value);
    setStudents([]);
    setBonusTypes([]);
    setError("");
    setLoadingReport(Boolean(classId));
  }

  function reload() {
    if (
      !classId ||
      loadingReport
    ) {
      return;
    }

    setLoadingReport(true);
    setRefresh(
      (current) => current + 1
    );
  }

  function exportFilename(extension) {
    return (
      `laporan-mutabaah-` +
      `${safeFileName(selectedClass?.class_name)}` +
      `-${month}.${extension}`
    );
  }

  function totalRequiredRow() {
    return [
      "",
      "TOTAL KELAS",
      "",
      "",
      summary.finalized,
      summary.draft,
      summary.unfilled,
      summary.yes,
      summary.no,
      summary.filled,
      summary.expected,
      percentage(
        summary.filled,
        summary.expected
      ),
      percentage(
        summary.yes,
        summary.expected
      ),
    ];
  }

  function bonusSheetRows() {
    return [
      [
        "REKAP KEGIATAN TAMBAHAN — JUMLAH KALI",
      ],

      ["Kelas", selectedClass.class_name],
      [
        "Tahun ajaran",
        selectedClass.academic_year,
      ],
      ["Bulan", monthLabel(month)],

      [
        "Ketentuan",
        "Jawaban Ya pada pengisian Final; maksimal satu kali per hari",
      ],

      [],

      [
        "No",
        "Nama Siswa",
        "NIS",
        ...bonusTypes.map(
          (bonus) => bonus.title
        ),
        "Total Tambahan",
      ],

      ...filtered.map(
        (student, index) => [
          index + 1,
          student.name,
          student.nis || "",

          ...bonusTypes.map(
            (bonus) =>
              countBonus(
                student,
                bonus.id
              )
          ),

          bonusTotal(student),
        ]
      ),

      [],

      [
        "",
        "TOTAL KELAS",
        "",

        ...bonusTypes.map(
          (bonus) =>
            filtered.reduce(
              (total, student) =>
                total +
                countBonus(
                  student,
                  bonus.id
                ),
              0
            )
        ),

        summary.bonus,
      ],
    ];
  }

  async function downloadExcel() {
    if (!canExport) return;

    setExporting("excel");
    setError("");

    try {
      const XLSX = await import("xlsx");
      const requiredData = [
        [
          "LAPORAN MUTABAAH BULANAN — KEGIATAN WAJIB",
        ],

        ["Kelas", selectedClass.class_name],

        [
          "Tahun Ajaran",
          selectedClass.academic_year,
        ],

        ["Bulan", monthLabel(month)],

        [
          "Keterangan",
          "Capaian Ya hanya dihitung dari hari yang Final",
        ],

        [],

        REQUIRED_HEADERS,

        ...filtered.map(
          requiredRow
        ),

        [],

        totalRequiredRow(),
      ];

      const requiredSheet =
        XLSX.utils.aoa_to_sheet(
          requiredData
        );

      requiredSheet["!cols"] = [
        { wch: 7 },
        { wch: 32 },
        { wch: 18 },

        ...Array.from(
          { length: 10 },
          () => ({ wch: 17 })
        ),
      ];

      const bonusSheet =
        XLSX.utils.aoa_to_sheet(
          bonusSheetRows()
        );

      bonusSheet["!cols"] = [
        { wch: 7 },
        { wch: 32 },
        { wch: 18 },

        ...bonusTypes.map(
          () => ({ wch: 22 })
        ),

        { wch: 18 },
      ];

      const workbook =
        XLSX.utils.book_new();

      XLSX.utils.book_append_sheet(
        workbook,
        requiredSheet,
        "Kegiatan Wajib"
      );

      XLSX.utils.book_append_sheet(
        workbook,
        bonusSheet,
        "Kegiatan Tambahan"
      );

      XLSX.writeFile(
        workbook,
        exportFilename("xlsx"),
        { compression: true }
      );
    } catch (caught) {
      setError(
        caught.message ||
        "Gagal mengunduh laporan Excel."
      );
    } finally {
      setExporting("");
    }
  }

  async function downloadPDF() {
    if (!canExport) return;

    setExporting("pdf");
    setError("");

    try {
      const [{ jsPDF }, { default: autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
      const pdf = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4",
      });

      pdf.setFont(
        "helvetica",
        "bold"
      );

      pdf.setFontSize(13);

      pdf.text(
        "LAPORAN MUTABAAH — KEGIATAN WAJIB",
        12,
        16
      );

      pdf.setFont(
        "helvetica",
        "normal"
      );

      pdf.setFontSize(9);

      pdf.text(
        `Kelas: ${selectedClass.class_name}`,
        12,
        23
      );

      pdf.text(
        `Tahun Ajaran: ${selectedClass.academic_year}`,
        12,
        28
      );

      pdf.text(
        `Bulan: ${monthLabel(month)}`,
        12,
        33
      );

      autoTable(pdf, {
        startY: 39,

        head: [[
          "No",
          "Nama Siswa",
          "NIS",
          "Hari",
          "Final",
          "Draf",
          "Belum",
          "Ya",
          "Tidak",
          "Terisi",
          "Total Wajib",
          "Isi %",
          "Capaian %",
        ]],

        body: [
          ...filtered.map(
            requiredRow
          ),
          totalRequiredRow(),
        ],

        theme: "grid",

        margin: {
          left: 9,
          right: 9,
        },

        styles: {
          font: "helvetica",
          fontSize: 6.5,
          cellPadding: 1.8,
          valign: "middle",
          overflow: "linebreak",
        },

        headStyles: {
          fillColor: [23, 83, 59],
          textColor: [255, 255, 255],
          fontStyle: "bold",
        },

        alternateRowStyles: {
          fillColor: [247, 250, 247],
        },

        columnStyles: {
          0: { cellWidth: 8 },
          1: { cellWidth: 46 },
          2: { cellWidth: 24 },
        },
      });

      pdf.addPage();

      pdf.setFont(
        "helvetica",
        "bold"
      );

      pdf.setFontSize(13);

      pdf.text(
        "REKAP MUTABAAH — KEGIATAN TAMBAHAN",
        12,
        16
      );

      pdf.setFont(
        "helvetica",
        "normal"
      );

      pdf.setFontSize(9);

      pdf.text(
        `Kelas: ${selectedClass.class_name}    |    Bulan: ${monthLabel(month)}`,
        12,
        24
      );

      pdf.text(
        "Hitungan: Ya pada pengisian Final, maksimal 1 kali per kegiatan per hari.",
        12,
        30
      );

      const bonusPdfRows =
        filtered.flatMap(
          (student) =>
            bonusTypes.length
              ? bonusTypes.map(
                  (bonus) => [
                    student.name,
                    student.nis || "—",
                    bonus.title,

                    String(
                      countBonus(
                        student,
                        bonus.id
                      )
                    ),
                  ]
                )
              : [[
                  student.name,
                  student.nis || "—",
                  "Tidak ada kegiatan Tambahan",
                  "0",
                ]]
        );

      autoTable(pdf, {
        startY: 36,

        head: [[
          "Nama Siswa",
          "NIS",
          "Kegiatan Tambahan",
          "Jumlah (kali)",
        ]],

        body: bonusPdfRows,
        theme: "grid",

        margin: {
          left: 12,
          right: 12,
        },

        styles: {
          font: "helvetica",
          fontSize: 8,
          cellPadding: 2.2,
          valign: "middle",
        },

        headStyles: {
          fillColor: [23, 83, 59],
          textColor: [255, 255, 255],
        },

        alternateRowStyles: {
          fillColor: [247, 250, 247],
        },

        columnStyles: {
          0: { cellWidth: 80 },
          1: { cellWidth: 32 },
          3: { cellWidth: 29 },
        },
      });

      pdf.save(
        exportFilename("pdf")
      );
    } catch (caught) {
      setError(
        caught.message ||
        "Gagal mengunduh laporan PDF."
      );
    } finally {
      setExporting("");
    }
  }

  return (
    <section className="monthly-report">
      <div className="monthly-report-heading">
        <h2>
          Laporan Mutabaah Bulanan
        </h2>

        <button
          type="button"
          className="monthly-report-secondary"
          disabled={
            loadingReport ||
            !classId
          }
          onClick={reload}
        >
          Muat Ulang
        </button>
      </div>

      <div className="monthly-report-filters">
        <label>
          <span>Kelas</span>

          <select
            value={classId}
            disabled={loadingClasses}
            onChange={(event) =>
              changeClass(
                event.target.value
              )
            }
          >
            {classes.length === 0 && (
              <option value="">
                Belum ada kelas
              </option>
            )}

            {classes.map(
              (item) => (
                <option
                  key={item.class_id}
                  value={item.class_id}
                >
                  {item.class_name} ·{" "}
                  {item.academic_year}
                </option>
              )
            )}
          </select>
        </label>

        <label>
          <span>Bulan</span>

          <input
            type="month"
            value={month}
            max={today.slice(0, 7)}
            onChange={(event) =>
              changeMonth(
                event.target.value
              )
            }
          />
        </label>

        <label>
          <span>Cari Siswa</span>

          <input
            type="search"
            value={search}
            placeholder="Nama atau NIS"
            onChange={(event) =>
              { display.setPage(0); setSearch(event.target.value); }
            }
          />
        </label>
      </div>

      {(error || searchResult.error) && (
        <p
          className="monthly-report-error"
          role="alert"
        >
          {error}
        </p>
      )}

      <nav className="section-tabs" aria-label="Jenis laporan Mutabaah" style={{margin:"14px 0"}}>
        <button type="button" className={reportSection==="required"?"is-active":""} aria-current={reportSection==="required"?"page":undefined} onClick={()=>setReportSection("required")}>Kegiatan Wajib</button>
        <button type="button" className={reportSection==="bonus"?"is-active":""} aria-current={reportSection==="bonus"?"page":undefined} onClick={()=>setReportSection("bonus")}>Kegiatan Tambahan</button>
      </nav>
      {reportSection==="required" && (<>
      <div className="monthly-report-subheading">
        <strong>Kegiatan Wajib · {monthLabel(month)}</strong>

        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          <button
            type="button"
            className="monthly-report-download"
            disabled={!canExport}
            onClick={() =>
              void downloadExcel()
            }
          >
            {exporting === "excel"
              ? "Memproses..."
              : "Unduh Excel"}
          </button>

          <button
            type="button"
            className="monthly-report-download"
            disabled={!canExport}
            onClick={() =>
              void downloadPDF()
            }
          >
            {exporting === "pdf"
              ? "Memproses..."
              : "Unduh PDF"}
          </button>
        </div>
      </div>

      {loadingClasses || loadingReport || searchResult.loading ? (
        <div className="monthly-report-empty">
          Memuat laporan...
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState kind="report" illustration="report" title="Belum ada data laporan" description="Pilih kelas atau bulan lain, atau tunggu data tersedia." />
      ) : (
        <div className="monthly-report-table-wrap">
          <table>
            <thead>
              <tr>
                <th>No.</th>
                <th>Nama Siswa</th>
                <th>NIS</th>
                <th>Hari</th>
                <th>Final</th>
                <th>Draf</th>
                <th>Belum Diisi</th>
                <th>Ya (Final)</th>
                <th>Tidak (Final)</th>
                <th>Terisi</th>
                <th>Keterisian Wajib</th>
                <th>Capaian Wajib</th>
              </tr>
            </thead>

            <tbody>
              {display.rows.map(
                (item, index) => (
                  <tr key={item.id}>
                    <td>{index + 1}</td>

                    <td className="monthly-report-name">
                      {item.name}
                    </td>

                    <td>
                      {item.nis || "—"}
                    </td>

                    <td>
                      {item.days}
                    </td>

                    <td>
                      {item.finalized_days}
                    </td>

                    <td>
                      {item.draft_days}
                    </td>

                    <td>
                      {item.unfilled_days}
                    </td>

                    <td>
                      {item.yes_count}
                    </td>

                    <td>
                      {item.no_count}
                    </td>

                    <td>
                      {item.filled_count}/
                      {item.expected_count}
                    </td>

                    <td>
                      {percentage(
                        item.filled_count,
                        item.expected_count
                      )}
                      %
                    </td>

                    <td>
                      {percentage(
                        item.yes_count,
                        item.expected_count
                      )}
                      %
                    </td>
                  </tr>
                )
              )}

              <tr className="monthly-report-total">
                <td colSpan={4}>
                  Total Kelas
                </td>

                <td>
                  {summary.finalized}
                </td>

                <td>
                  {summary.draft}
                </td>

                <td>
                  {summary.unfilled}
                </td>

                <td>
                  {summary.yes}
                </td>

                <td>
                  {summary.no}
                </td>

                <td>
                  {summary.filled}/
                  {summary.expected}
                </td>

                <td>
                  {percentage(
                    summary.filled,
                    summary.expected
                  )}
                  %
                </td>

                <td>
                  {percentage(
                    summary.yes,
                    summary.expected
                  )}
                  %
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      </>)}
      {reportSection==="bonus" && (<>
      <div className="monthly-report-subheading" style={{marginTop:12}}>
        <strong>
          Kegiatan Tambahan · Jumlah kali
        </strong>
      </div>

      {loadingClasses || loadingReport || searchResult.loading ? (
        <div className="monthly-report-empty">
          Memuat rekap Tambahan...
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState kind="report" illustration="report" title="Belum ada data laporan" description="Pilih kelas atau bulan lain, atau tunggu data tersedia." />
      ) : bonusTypes.length === 0 ? (
        <EmptyState kind="report" illustration="extra-report" title="Belum ada kegiatan Tambahan" description="Kegiatan Tambahan yang aktif akan ditampilkan di sini." />
      ) : (
        <div className="monthly-report-table-wrap">
          <table>
            <thead>
              <tr>
                <th>No.</th>
                <th>Nama Siswa</th>

                {bonusTypes.map(
                  (bonus) => (
                    <th key={bonus.id}>
                      {bonus.title}
                    </th>
                  )
                )}

                <th>Total</th>
              </tr>
            </thead>

            <tbody>
              {display.rows.map(
                (item, index) => (
                  <tr key={item.id}>
                    <td>
                      {index + 1}
                    </td>

                    <td className="monthly-report-name">
                      {item.name}
                    </td>

                    {bonusTypes.map(
                      (bonus) => (
                        <td key={bonus.id}>
                          {countBonus(
                            item,
                            bonus.id
                          )}
                        </td>
                      )
                    )}

                    <td>
                      <strong>
                        {bonusTotal(item)}
                      </strong>
                    </td>
                  </tr>
                )
              )}

              <tr className="monthly-report-total">
                <td colSpan={2}>
                  Total Kelas
                </td>

                {bonusTypes.map(
                  (bonus) => (
                    <td key={bonus.id}>
                      {filtered.reduce(
                        (sum, item) =>
                          sum +
                          countBonus(
                            item,
                            bonus.id
                          ),
                        0
                      )}
                    </td>
                  )
                )}

                <td>
                  <strong>
                    {summary.bonus}
                  </strong>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
      </>)}
      <Pagination page={display.page} total={filtered.length} loading={loadingReport || searchResult.loading} onChange={display.setPage} />
    </section>
  );
}
