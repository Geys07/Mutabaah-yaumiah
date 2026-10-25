import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import DashboardBarChart from "./DashboardBarChart";
import "./LiveDashboardCharts.css";

const SUBMITTED_COLOR = "#27865b";
const PENDING_COLOR = "#d3a13c";
const MUTED_COLOR = "#748176";

function daysBefore(value, count) {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - count);
  return date.toISOString().slice(0, 10);
}

function dateLabel(value, options = { day: "numeric", month: "short" }) {
  return new Intl.DateTimeFormat("id-ID", {
    ...options,
    timeZone: "UTC",
  }).format(new Date(`${value}T12:00:00Z`));
}

function countStatuses(rows) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const submitted = safeRows.filter((row) => row.status === "finalized").length;
  return {
    total: safeRows.length,
    submitted,
    notSubmitted: safeRows.length - submitted,
  };
}

function Legend() {
  return (
    <div className="live-chart-legend" aria-label="Keterangan status">
      <span><i className="live-legend-dot is-submitted" />Sudah disubmit</span>
      <span><i className="live-legend-dot is-pending" />Belum disubmit</span>
    </div>
  );
}

function EmptyChart({ children }) {
  return <div className="live-chart-empty" role="status">{children}</div>;
}

export default function LiveDashboardCharts({
  classRows = [],
  date,
  refreshKey = 0,
  mode = "school",
  onSelectClass,
}) {
  const [periodDays, setPeriodDays] = useState(7);
  const [history, setHistory] = useState([]);
  const [historyWindow, setHistoryWindow] = useState(0);
  const [historyNotice, setHistoryNotice] = useState("");

  const rowsSignature = classRows.map((row) => [
    row.class_id,
    row.class_name,
    row.total,
    row.finalized,
    row.draft,
    row.unfilled,
    row.failed ? 1 : 0,
  ].join(":")).join("|");

  const rows = useMemo(
    () => classRows.filter((row) => row && row.class_id && !row.failed),
    // rowsSignature represents all fields used by this filter and chart data.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rowsSignature]
  );

  const summary = useMemo(() => rows.reduce((total, row) => {
    total.students += Number(row.total) || 0;
    total.submitted += Number(row.finalized) || 0;
    return total;
  }, { students: 0, submitted: 0 }), [rows]);

  const completion = summary.students
    ? Math.round((summary.submitted / summary.students) * 100)
    : 0;
  const notSubmitted = Math.max(0, summary.students - summary.submitted);
  const isClass = mode === "class";
  const title = isClass
    ? "Ketercapaian kelas"
    : mode === "admin"
      ? "Ketercapaian pengisian hari ini"
      : "Ketercapaian pengisian";

  useEffect(() => {
    if (!date || rows.length === 0) return undefined;

    let cancelled = false;
    const dateList = Array.from({ length: periodDays }, (_, index) =>
      daysBefore(date, periodDays - index - 1)
    );
    const results = new Map(dateList.map((day) => [
      day,
      { date: day, submitted: 0, notSubmitted: 0, total: 0, complete: true },
    ]));
    const requests = [];

    for (const day of dateList) {
      const target = results.get(day);
      if (day === date) {
        target.submitted = rows.reduce((sum, row) => sum + (Number(row.finalized) || 0), 0);
        target.total = rows.reduce((sum, row) => sum + (Number(row.total) || 0), 0);
        target.notSubmitted = Math.max(0, target.total - target.submitted);
      } else {
        for (const row of rows) requests.push({ day, row });
      }
    }

    async function loadHistory() {
      setHistoryNotice("");
      for (let offset = 0; offset < requests.length; offset += 6) {
        const batch = requests.slice(offset, offset + 6);
        const responses = await Promise.all(batch.map(async ({ day, row }) => {
          try {
            const { data, error } = await supabase.rpc(
              "get_mutabaah_class_day_status",
              { p_class_id: row.class_id, p_date: day }
            );
            if (error) throw error;
            if (!Array.isArray(data)) throw new Error("Format riwayat tidak valid.");
            return { day, counts: countStatuses(data), failed: false };
          } catch {
            return { day, failed: true };
          }
        }));

        if (cancelled) return;
        for (const response of responses) {
          const target = results.get(response.day);
          if (response.failed) {
            target.complete = false;
            continue;
          }
          target.submitted += response.counts.submitted;
          target.notSubmitted += response.counts.notSubmitted;
          target.total += response.counts.total;
        }
      }

      if (cancelled) return;
      const all = [...results.values()];
      setHistory(all);
      setHistoryWindow(periodDays);
      setHistoryNotice(
        all.some((item) => !item.complete)
          ? "Sebagian riwayat gagal dimuat; tanggal tersebut dibiarkan kosong."
          : ""
      );
    }

    void loadHistory();
    return () => { cancelled = true; };
  }, [date, periodDays, refreshKey, rows]);

  const sortedRows = useMemo(
    () => [...rows].sort((a, b) => {
      const aPercent = a.total ? a.finalized / a.total : 0;
      const bPercent = b.total ? b.finalized / b.total : 0;
      return aPercent - bPercent || String(a.class_name).localeCompare(String(b.class_name), "id");
    }),
    [rows]
  );

  const comparisonData = useMemo(() => {
    if (isClass) {
      return {
        labels: ["Sudah disubmit", "Belum disubmit"],
        datasets: [{
          label: "Jumlah siswa",
          data: [summary.submitted, notSubmitted],
          backgroundColor: [SUBMITTED_COLOR, PENDING_COLOR],
          borderRadius: 7,
          borderSkipped: false,
          barThickness: 26,
        }],
      };
    }
    return {
      labels: rows.map((row) => row.class_name || "Kelas"),
      datasets: [
        {
          label: "Sudah disubmit",
          data: rows.map((row) => Number(row.finalized) || 0),
          backgroundColor: SUBMITTED_COLOR,
          borderRadius: 6,
          borderSkipped: false,
          barThickness: 17,
        },
        {
          label: "Belum disubmit",
          data: rows.map((row) => Math.max(0, (Number(row.total) || 0) - (Number(row.finalized) || 0))),
          backgroundColor: PENDING_COLOR,
          borderRadius: 6,
          borderSkipped: false,
          barThickness: 17,
        },
      ],
    };
  }, [isClass, rows, summary.submitted, notSubmitted]);

  const comparisonOptions = useMemo(() => ({
    indexAxis: "y",
    scales: {
      x: {
        beginAtZero: true,
        stacked: !isClass,
        ticks: { precision: 0, color: MUTED_COLOR, font: { size: 10 } },
        grid: { color: "rgba(116,129,118,0.14)", drawBorder: false },
      },
      y: {
        stacked: !isClass,
        ticks: { color: MUTED_COLOR, font: { size: 11 } },
        grid: { display: false, drawBorder: false },
      },
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (context) => `${context.dataset.label}: ${Number(context.raw || 0).toLocaleString("id-ID")} siswa`,
        },
      },
    },
  }), [isClass]);

  const progressData = useMemo(() => ({
    labels: sortedRows.map((row) => row.class_name || "Kelas"),
    datasets: [{
      label: "Ketercapaian",
      data: sortedRows.map((row) => row.total
        ? Math.round((Number(row.finalized || 0) / Number(row.total)) * 100)
        : 0),
      backgroundColor: "#398f62",
      borderRadius: 7,
      borderSkipped: false,
      barThickness: 15,
    }],
  }), [sortedRows]);

  const progressOptions = useMemo(() => ({
    indexAxis: "y",
    scales: {
      x: {
        beginAtZero: true,
        max: 100,
        ticks: { color: MUTED_COLOR, callback: (value) => `${value}%`, font: { size: 10 } },
        grid: { color: "rgba(116,129,118,0.14)", drawBorder: false },
      },
      y: {
        ticks: { color: MUTED_COLOR, font: { size: 11 } },
        grid: { display: false, drawBorder: false },
      },
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (context) => `${context.raw}% ketercapaian`,
        },
      },
    },
  }), []);

  const historyData = useMemo(() => {
    const completeHistory = historyWindow === periodDays ? history : [];
    return {
      labels: completeHistory.map((item) => dateLabel(item.date, { day: "numeric", month: "short" })),
      datasets: [
        {
          label: "Sudah disubmit",
          data: completeHistory.map((item) => item.complete ? item.submitted : null),
          backgroundColor: SUBMITTED_COLOR,
          borderRadius: 5,
          borderSkipped: false,
          barPercentage: 0.78,
          categoryPercentage: 0.72,
        },
        {
          label: "Belum disubmit",
          data: completeHistory.map((item) => item.complete ? item.notSubmitted : null),
          backgroundColor: PENDING_COLOR,
          borderRadius: 5,
          borderSkipped: false,
          barPercentage: 0.78,
          categoryPercentage: 0.72,
        },
      ],
    };
  }, [history, historyWindow, periodDays]);

  const historyOptions = useMemo(() => ({
    scales: {
      x: {
        stacked: true,
        ticks: {
          color: MUTED_COLOR,
          maxRotation: 0,
          autoSkip: true,
          maxTicksLimit: periodDays === 30 ? 10 : 7,
          font: { size: 10 },
        },
        grid: { display: false, drawBorder: false },
      },
      y: {
        stacked: true,
        beginAtZero: true,
        ticks: { precision: 0, color: MUTED_COLOR, font: { size: 10 } },
        grid: { color: "rgba(116,129,118,0.14)", drawBorder: false },
      },
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          title: (items) => items[0]?.label || "",
          label: (context) => `${context.dataset.label}: ${Number(context.raw || 0).toLocaleString("id-ID")} siswa`,
        },
      },
    },
  }), [periodDays]);

  const historyReady = historyWindow === periodDays && history.length === periodDays;
  const validHistoryCount = historyReady ? history.filter((item) => item.complete).length : 0;

  return (
    <div className={`live-dashboard live-dashboard-${mode}`}>
      <section className="live-dashboard-hero" aria-label="Ketercapaian pengisian">
        <div className="live-dashboard-hero-copy">
          <span className="live-dashboard-eyebrow">RINGKASAN MUTABAAH</span>
          <h3>{title}</h3>
          <div className="live-dashboard-percent">{completion}<span>%</span></div>
          <div className="live-dashboard-progress" role="progressbar" aria-label={title} aria-valuemin={0} aria-valuemax={100} aria-valuenow={completion}>
            <span style={{ width: `${completion}%` }} />
          </div>
          <p>{summary.submitted.toLocaleString("id-ID")} dari {summary.students.toLocaleString("id-ID")} siswa sudah disubmit</p>
        </div>
        <div className="live-dashboard-hero-stats">
          <div>
            <span>Sudah disubmit</span>
            <strong>{summary.submitted.toLocaleString("id-ID")}</strong>
          </div>
          <div>
            <span>Belum disubmit</span>
            <strong>{notSubmitted.toLocaleString("id-ID")}</strong>
          </div>
          <small>{isClass ? (rows[0]?.class_name || "Kelas saya") : mode === "admin" ? `${summary.students.toLocaleString("id-ID")} siswa aktif dalam rekap · ${dateLabel(date, { day: "numeric", month: "long", year: "numeric" })}` : dateLabel(date, { day: "numeric", month: "long", year: "numeric" })}</small>
        </div>
      </section>

      <div className="live-dashboard-charts">
        <section className="live-chart-panel live-chart-comparison">
          <div className="live-chart-heading">
            <div>
              <h3>{isClass ? "Status pengisian kelas" : "Perbandingan pengisian per kelas"}</h3>
              <p>{isClass ? "Jumlah siswa menurut status submit." : "Pilih kelas untuk membuka rincian jika tersedia."}</p>
            </div>
          </div>
          <Legend />
          {rows.length === 0 ? (
            <EmptyChart>Belum ada data untuk ditampilkan.</EmptyChart>
          ) : (
            <DashboardBarChart
              data={comparisonData}
              options={comparisonOptions}
              height={Math.max(145, rows.length * 37)}
              label={isClass ? "Grafik status pengisian kelas" : "Grafik perbandingan pengisian per kelas"}
              onItemClick={isClass ? undefined : (index) => onSelectClass?.(rows[index]?.class_id)}
            />
          )}
        </section>

        {!isClass && (
          <section className="live-chart-panel live-chart-progress-panel">
            <div className="live-chart-heading">
              <div>
                <h3>Progres ketercapaian kelas</h3>
                <p>Urutan dari ketercapaian terendah.</p>
              </div>
            </div>
            {sortedRows.length === 0 ? (
              <EmptyChart>Progres kelas akan muncul setelah data tersedia.</EmptyChart>
            ) : (
              <DashboardBarChart
                data={progressData}
                options={progressOptions}
                height={Math.max(145, sortedRows.length * 36)}
                label="Grafik progres ketercapaian kelas"
                onItemClick={(index) => onSelectClass?.(sortedRows[index]?.class_id)}
              />
            )}
          </section>
        )}

        <section className="live-chart-panel live-chart-history-panel">
          <div className="live-chart-heading live-history-heading">
            <div>
              <h3>Riwayat pengisian</h3>
              <p>Jumlah siswa per hari berdasarkan status sebenarnya.</p>
            </div>
            <div className="live-period-toggle" role="group" aria-label="Periode riwayat pengisian">
              <button type="button" aria-pressed={periodDays === 7} className={periodDays === 7 ? "is-active" : ""} onClick={() => setPeriodDays(7)}>7 hari</button>
              <button type="button" aria-pressed={periodDays === 30} className={periodDays === 30 ? "is-active" : ""} onClick={() => setPeriodDays(30)}>1 bulan</button>
            </div>
          </div>
          <Legend />
          {!historyReady ? (
            <EmptyChart>Memuat riwayat pengisian…</EmptyChart>
          ) : validHistoryCount === 0 ? (
            <EmptyChart>Riwayat tidak tersedia untuk periode ini. Grafik tidak menggunakan data simulasi.</EmptyChart>
          ) : (
            <DashboardBarChart
              data={historyData}
              options={historyOptions}
              height={periodDays === 30 ? 260 : 220}
              label={`Grafik riwayat pengisian ${periodDays === 30 ? "satu bulan" : "tujuh hari"}`}
            />
          )}
          {historyNotice && <p className="live-chart-note" role="status">{historyNotice}</p>}
        </section>
      </div>
    </div>
  );
}
