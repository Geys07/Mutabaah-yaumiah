
import {
  useEffect,
  useMemo,
  useState,
} from "react";
import { supabase } from "../lib/supabase";
import { listenStudentDataChanges } from "../lib/studentDataUpdates";
import "./ParentCalendar.css";

const WEEKDAYS = [
  "Sen",
  "Sel",
  "Rab",
  "Kam",
  "Jum",
  "Sab",
  "Min",
];

const COLORS = {
  finalized: {
    background: "#e0f3e7",
    color: "#155e3b",
    border: "#96d1ad",
  },
  draft: {
    background: "#fff4d6",
    color: "#875a10",
    border: "#e8ca75",
  },
  unfilled: {
    background: "#f2f4f3",
    color: "#67746d",
    border: "#e0e5e1",
  },
};

function jakartaToday() {
  const parts = new Intl.DateTimeFormat(
    "en-GB",
    {
      timeZone: "Asia/Jakarta",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }
  ).formatToParts(new Date());

  const values = Object.fromEntries(
    parts.map((part) => [
      part.type,
      part.value,
    ])
  );

  return `${values.year}-${values.month}-${values.day}`;
}

function monthStart(value) {
  return `${value.slice(0, 7)}-01`;
}

function moveMonth(value, amount) {
  const [year, month] = value
    .split("-")
    .map(Number);

  const date = new Date(
    Date.UTC(year, month - 1 + amount, 1)
  );

  return (
    date.toISOString().slice(0, 7) +
    "-01"
  );
}

function monthLabel(value) {
  return new Intl.DateTimeFormat(
    "id-ID",
    {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }
  ).format(
    new Date(`${value}T12:00:00Z`)
  );
}

function formatDay(date) {
  const year = date.getFullYear();

  const month = String(
    date.getMonth() + 1
  ).padStart(2, "0");

  const day = String(
    date.getDate()
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getDayStatus(status) {
  if (status === "finalized") {
    return "finalized";
  }
  if (status === "draft") {
    return "draft";
  }
  return "unfilled";
}

function statusText(status) {
  if (status === "finalized") {
    return "Final";
  }
  if (status === "draft") {
    return "Draf";
  }
  return "Belum Diisi";
}

export default function ParentCalendar({
  studentId,
  selectedDate,
  onSelectDate,
  maxDate,
  minEditableDate,
}) {
  const [month, setMonth] = useState(
    () =>
      monthStart(
        selectedDate || jakartaToday()
      )
  );

  const [summary, setSummary] =
    useState([]);

  const [statuses, setStatuses] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [revision, setRevision] =
    useState(0);

  const lastDate =
    maxDate || jakartaToday();

  const earliestMonth = moveMonth(
    monthStart(lastDate),
    -23
  );

  useEffect(() => {
    if (!studentId) return undefined;

    let cancelled = false;

    async function loadMonth() {
      try {
        const [
          summaryResult,
          statusResult,
        ] = await Promise.all([
          supabase.rpc(
            "get_parent_mutabaah_month",
            {
              p_student_id: studentId,
              p_month: month,
            }
          ),

          supabase.rpc(
            "get_parent_mutabaah_month_status",
            {
              p_student_id: studentId,
              p_month: month,
            }
          ),
        ]);

        if (cancelled) return;

        if (summaryResult.error) {
          throw summaryResult.error;
        }

        if (statusResult.error) {
          throw statusResult.error;
        }

        setSummary(
          Array.isArray(summaryResult.data)
            ? summaryResult.data
            : []
        );

        setStatuses(
          Array.isArray(statusResult.data)
            ? statusResult.data
            : []
        );

        setError("");
      } catch (loadError) {
        if (!cancelled) {
          setSummary([]);
          setStatuses([]);

          setError(
            loadError.message ||
              "Gagal memuat kalender."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadMonth();

    return () => {
      cancelled = true;
    };
  }, [
    studentId,
    month,
    revision,
    selectedDate,
  ]);

  useEffect(() => {
    function refreshCalendar() {
      setRevision(
        (previous) => previous + 1
      );
    }

    window.addEventListener(
      "focus",
      refreshCalendar
    );

    window.addEventListener(
      "mutabaah:saved",
      refreshCalendar
    );
    const stopListening = listenStudentDataChanges(refreshCalendar);

    return () => {
      stopListening();
      window.removeEventListener(
        "focus",
        refreshCalendar
      );

      window.removeEventListener(
        "mutabaah:saved",
        refreshCalendar
      );
    };
  }, []);

  const days = useMemo(() => {
    const first = new Date(
      `${month}T12:00:00`
    );

    const year = first.getFullYear();
    const monthIndex = first.getMonth();

    const numberOfDays = new Date(
      year,
      monthIndex + 1,
      0
    ).getDate();

    const offset =
      (first.getDay() + 6) % 7;

    const result = Array(
      offset
    ).fill(null);

    for (
      let number = 1;
      number <= numberOfDays;
      number += 1
    ) {
      result.push(
        formatDay(
          new Date(
            year,
            monthIndex,
            number,
            12
          )
        )
      );
    }

    while (
      result.length % 7 !== 0
    ) {
      result.push(null);
    }

    return result;
  }, [month]);

  const reportMap = useMemo(
    () =>
      new Map(
        summary.map((item) => [
          item.date,
          item,
        ])
      ),
    [summary]
  );

  const statusMap = useMemo(
    () =>
      new Map(
        statuses.map((item) => [
          item.date,
          item.status,
        ])
      ),
    [statuses]
  );

  function changeMonth(offset) {
    const next = moveMonth(
      month,
      offset
    );

    if (
      next < earliestMonth ||
      next > monthStart(lastDate)
    ) {
      return;
    }

    setLoading(true);
    setMonth(next);
  }

  return (
    <section className="parent-calendar">
      <div className="parent-calendar-heading">
        <button
          type="button"
          aria-label="Bulan sebelumnya"
          disabled={
            month <= earliestMonth
          }
          onClick={() =>
            changeMonth(-1)
          }
        >
          ‹
        </button>

        <h2>
          {monthLabel(month)}
        </h2>

        <button
          type="button"
          aria-label="Bulan berikutnya"
          disabled={
            month >= monthStart(lastDate)
          }
          onClick={() =>
            changeMonth(1)
          }
        >
          ›
        </button>
      </div>

      <div className="parent-calendar-grid">
        {WEEKDAYS.map((day) => (
          <div
            key={day}
            className="parent-calendar-weekday"
          >
            {day}
          </div>
        ))}

        {days.map((date, index) => {
          if (!date) {
            return (
              <div
                key={`blank-${index}`}
                className="parent-calendar-blank"
              />
            );
          }

          const isFuture =
            date > lastDate;

          const isOutOfEditRange =
            Boolean(
              minEditableDate &&
                date < minEditableDate
            );

          const isSelected =
            date === selectedDate;

          const report =
            reportMap.get(date);

          const status = getDayStatus(
            statusMap.get(date)
          );

          const style = COLORS[status];

          return (
            <button
              key={date}
              type="button"
              disabled={
                isFuture ||
                isOutOfEditRange
              }
              aria-label={`${date}, ${statusText(status)}${
                isOutOfEditRange
                  ? ", di luar batas pengeditan"
                  : ""
              }`}
              aria-pressed={isSelected}
              title={
                isOutOfEditRange
                  ? "Hanya 30 hari terakhir yang dapat diisi atau diedit"
                  : statusText(status)
              }
              className={[
                "parent-calendar-day",
                isSelected
                  ? "selected"
                  : "",
                status === "finalized"
                  ? "complete"
                  : "",
                status === "draft"
                  ? "partial"
                  : "",
              ]
                .filter(Boolean)
                .join(" ")}
              style={{
                background: style.background,
                color: style.color,
                borderColor: isSelected
                  ? "#a37c2d"
                  : style.border,
                borderWidth:
                  isSelected ? 2 : 1,
                opacity:
                  isFuture ||
                  isOutOfEditRange
                    ? 0.45
                    : 1,
              }}
              onClick={() =>
                onSelectDate?.(date)
              }
            >
              <span>
                {Number(
                  date.slice(-2)
                )}
              </span>

              {status !== "unfilled" && (
                <small>
                  {status === "finalized"
                    ? "Final"
                    : report
                      ? `${report.filled}/${report.total}`
                      : "Draf"}
                </small>
              )}
            </button>
          );
        })}
      </div>

      <div
        style={{
          display: "flex",
          gap: 14,
          flexWrap: "wrap",
          marginTop: 14,
          fontSize: 12,
        }}
      >
        {[
          ["unfilled", "Belum Diisi"],
          ["draft", "Draf"],
          ["finalized", "Final"],
        ].map(([status, label]) => (
          <span
            key={status}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span
              aria-hidden="true"
              style={{
                width: 10,
                height: 10,
                borderRadius: 3,
                background:
                  COLORS[status].background,
                border: `1px solid ${
                  COLORS[status].border
                }`,
              }}
            />
            {label}
          </span>
        ))}
      </div>

      {loading && (
        <p className="parent-calendar-status">
          Memuat...
        </p>
      )}

      {error && (
        <p
          className="parent-calendar-error"
          role="alert"
        >
          {error}
        </p>
      )}
    </section>
  );
}
