import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import "./LiveDashboardCharts.css";

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
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyNotice, setHistoryNotice] = useState("");

  const rowsSignature = useMemo(
    () => classRows.map((row) => [
      row.class_id,
      row.class_name,
      row.total,
      row.finalized,
      row.draft,
      row.unfilled,
      row.failed ? 1 : 0,
    ].join(":")).join("|"),
    [classRows]
  );

  const rows = useMemo(
    () => classRows.filter((row) => row && row.class_id && !row.failed),
    [classRows]
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
    const dateList = Array.from({ length: 7 }, (_, index) =>
      daysBefore(date, 6 - index)
    );
    const requests = [];
    const results = new Map(dateList.map((day) => [
      day,
      { date: day, submitted: 0, notSubmitted: 0, total: 0, complete: true },
    ]));

    for (const day of dateList) {
      for (const row of rows) {
        if (day === date) {
          const target = results.get(day);
          target.submitted += Number(row.finalized) || 0;
          target.total += Number(row.total) || 0;
          target.notSubmitted += Math.max(
            0,
            (Number(row.total) || 0) - (Number(row.finalized) || 0)
          );
        } else {
          requests.push({ day, row });
        }
      }
    }

    async function loadHistory() {
      setHistoryLoading(true);
      setHistoryNotice("");
      setHistory([]);

      for (let offset = 0; offset < requests.length; offset += 4) {
        const batch = requests.slice(offset, offset + 4);
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
      setHistoryNotice(
        all.some((item) => !item.complete)
          ? "Sebagian riwayat tidak berhasil dimuat; hari tersebut ditandai tanpa angka."
          : ""
      );
      setHistoryLoading(false);
    }

    void loadHistory();
    return () => { cancelled = true; };
  }, [date, refreshKey, rowsSignature, rows]);

  const validHistory = history.filter((item) => item.complete);
  const historyMax = Math.max(
    1,
    ...validHistory.flatMap((item) => [item.submitted, item.notSubmitted])
  );
  const axisMid = Math.ceil(historyMax / 2);
  const sortedRows = [...rows].sort((a, b) => {
    const aPercent = a.total ? a.finalized / a.total : 0;
    const bPercent = b.total ? b.finalized / b.total : 0;
    return aPercent - bPercent || String(a.class_name).localeCompare(String(b.class_name), "id");
  });

  return (
    <div className={`live-dashboard live-dashboard-${mode}`}>
      <section className="live-dashboard-hero" aria-label="Ketercapaian pengisian">
        <div className="live-dashboard-hero-copy">
          <span className="live-dashboard-eyebrow"><span className="live-live-dot" /> PEMANTAUAN LANGSUNG</span>
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
              <p>Ketuk kelas untuk membuka rincian jika tersedia.</p>
            </div>
            <span className="live-chart-icon" aria-hidden="true">↔</span>
          </div>
          <Legend />
          {rows.length === 0 ? (
            <EmptyChart>Belum ada data kelas untuk ditampilkan.</EmptyChart>
          ) : (
            <div className="live-class-bars">
              {rows.map((row) => {
                const total = Number(row.total) || 0;
                const submitted = Number(row.finalized) || 0;
                const pending = Math.max(0, total - submitted);
                const submitWidth = total ? (submitted / total) * 100 : 0;
                const pendingWidth = total ? (pending / total) * 100 : 0;
                const content = (
                  <>
                    <span className="live-class-bar-label">{row.class_name || "Kelas"}</span>
                    <span className="live-class-bar-track" title={`Sudah disubmit: ${submitted}; belum disubmit: ${pending}`}>
                      <span className="live-bar-submitted" style={{ width: `${submitWidth}%` }} />
                      <span className="live-bar-pending" style={{ width: `${pendingWidth}%` }} />
                    </span>
                    <span className="live-class-bar-count">{submitted}/{total}</span>
                  </>
                );
                return onSelectClass ? (
                  <button
                    type="button"
                    className="live-class-bar-row is-action"
                    key={row.class_id}
                    onClick={() => onSelectClass(row.class_id)}
                    aria-label={`Buka rincian kelas ${row.class_name}, ${submitted} dari ${total} sudah disubmit`}
                  >{content}</button>
                ) : (
                  <div className="live-class-bar-row" key={row.class_id}>{content}</div>
                );
              })}
            </div>
          )}
        </section>

        {!isClass && (
          <section className="live-chart-panel live-chart-progress-panel">
            <div className="live-chart-heading">
              <div>
                <h3>Progres ketercapaian kelas</h3>
                <p>Urutan dari kelas dengan progres terendah.</p>
              </div>
              <span className="live-chart-icon" aria-hidden="true">%</span>
            </div>
            {sortedRows.length === 0 ? (
              <EmptyChart>Progres kelas akan muncul setelah data tersedia.</EmptyChart>
            ) : (
              <div className="live-progress-list">
                {sortedRows.map((row) => {
                  const total = Number(row.total) || 0;
                  const submitted = Number(row.finalized) || 0;
                  const value = total ? Math.round((submitted / total) * 100) : 0;
                  const content = (
                    <>
                      <span>{row.class_name || "Kelas"}</span>
                      <strong>{value}%</strong>
                      <span className="live-progress-track"><span style={{ width: `${value}%` }} /></span>
                      <small>{submitted} dari {total} siswa</small>
                    </>
                  );
                  return onSelectClass ? (
                    <button type="button" className="live-progress-row is-action" key={row.class_id} onClick={() => onSelectClass(row.class_id)}>{content}</button>
                  ) : (
                    <div className="live-progress-row" key={row.class_id}>{content}</div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        <section className="live-chart-panel live-chart-history-panel">
          <div className="live-chart-heading">
            <div>
              <h3>Riwayat pengisian 7 hari</h3>
              <p>Jumlah siswa per hari berdasarkan status sebenarnya.</p>
            </div>
            <span className="live-chart-icon" aria-hidden="true">7d</span>
          </div>
          <Legend />
          {historyLoading ? (
            <EmptyChart>Memuat riwayat pengisian…</EmptyChart>
          ) : validHistory.length === 0 ? (
            <EmptyChart>Riwayat belum tersedia. Grafik tidak menggunakan data simulasi.</EmptyChart>
          ) : (
            <div className="live-history-chart">
              <div className="live-history-axis" aria-hidden="true">
                <span>{historyMax}</span>
                <span>{axisMid}</span>
                <span>0</span>
              </div>
              <div className="live-history-plot">
                <div className="live-history-grid" aria-hidden="true"><i /><i /><i /></div>
                {history.map((item) => (
                  <div className={`live-history-day${item.complete ? "" : " is-incomplete"}`} key={item.date} title={item.complete ? `${dateLabel(item.date, { day: "numeric", month: "long" })}: ${item.submitted} sudah, ${item.notSubmitted} belum` : "Data hari ini tidak lengkap"}>
                    {item.complete ? (
                      <div className="live-history-bars">
                        <span className="live-history-submitted" style={{ height: `${(item.submitted / historyMax) * 100}%` }} />
                        <span className="live-history-pending" style={{ height: `${(item.notSubmitted / historyMax) * 100}%` }} />
                      </div>
                    ) : <span className="live-history-gap">—</span>}
                    <small>{dateLabel(item.date, { day: "numeric", month: "short" })}</small>
                  </div>
                ))}
              </div>
            </div>
          )}
          {historyNotice && <p className="live-chart-note" role="status">{historyNotice}</p>}
        </section>
      </div>
    </div>
  );
}
