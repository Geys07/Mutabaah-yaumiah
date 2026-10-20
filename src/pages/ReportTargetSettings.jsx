
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

const GROUPS = [
  "Ibadah",
  "Al-Qur’an",
  "Akhlak",
  "Kemandirian",
  "Kebiasaan Baik",
];

const GROUP_COLORS = {
  Ibadah: {
    background: "#e5f4ea",
    color: "#176341",
  },
  "Al-Qur’an": {
    background: "#e2efff",
    color: "#215eaa",
  },
  Akhlak: {
    background: "#fff2cf",
    color: "#8b6419",
  },
  Kemandirian: {
    background: "#fff0df",
    color: "#9d5b22",
  },
  "Kebiasaan Baik": {
    background: "#e8f4e7",
    color: "#397841",
  },
};

const css = {
  panel: {
    background: "var(--sa-card, #ffffff)",
    border: "1px solid var(--sa-line, #e5ebe7)",
    borderRadius: 12,
    padding: 20,
  },
  title: {
    color: "var(--sa-ink, #173c2e)",
    fontSize: 18,
    margin: 0,
  },
  description: {
    fontSize: 13,
    color: "var(--sa-muted, #687a70)",
    lineHeight: 1.6,
    margin: "6px 0 20px",
  },
  tabs: {
    display: "flex",
    flexWrap: "wrap",
    gap: 7,
    marginBottom: 18,
  },
  tableWrap: {
    overflowX: "auto",
    border: "1px solid var(--sa-line, #e7eee9)",
    borderRadius: 9,
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: 13,
  },
  th: {
    padding: "12px 10px",
    background: "var(--sa-soft, #f5f8f6)",
    color: "var(--sa-ink, #344b3d)",
    fontWeight: 600,
    textAlign: "left",
    borderBottom: "1px solid var(--sa-line, #e1e9e3)",
  },
  td: {
    padding: "10px",
    borderBottom: "1px solid var(--sa-line, #edf1ee)",
    color: "var(--sa-ink, #26382d)",
  },
  select: {
    border: "1px solid var(--sa-line, #d8e4dc)",
    borderRadius: 7,
    padding: "7px 9px",
    background: "var(--sa-card, #ffffff)",
    fontSize: 12,
    width: "100%",
    minWidth: 132,
  },
  input: {
    width: 75,
    padding: "7px 8px",
    border: "1px solid var(--sa-line, #d8e4dc)",
    borderRadius: 7,
    fontSize: 13,
    textAlign: "center",
  },
  save: {
    background: "var(--sa-accent, #14744e)",
    color: "#fff",
    border: 0,
    borderRadius: 8,
    padding: "11px 22px",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
  },
};

function getError(error) {
  return error?.message || "Terjadi kesalahan.";
}

function isValidTarget(value) {
  if (String(value).trim() === "") return false;

  const number = Number(value);

  return (
    Number.isFinite(number) &&
    number >= 0 &&
    number <= 100
  );
}

function normalizeRows(data) {
  if (!Array.isArray(data)) return [];

  return data.map((item) => ({
    id: item.id,
    title: String(item.title || ""),
    category: String(item.category || ""),
    report_group: GROUPS.includes(
      item.report_group
    )
      ? item.report_group
      : "Kebiasaan Baik",
    target: String(item.target ?? 80),
    sort_order: Number(item.sort_order) || 0,
  }));
}

export default function ReportTargetSettings() {
  const [items, setItems] = useState([]);
  const [originalItems, setOriginalItems] =
    useState([]);

  const [activeGroup, setActiveGroup] =
    useState("Semua");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadTargets = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const { data, error: queryError } =
        await supabase.rpc(
          "get_mutabaah_report_targets"
        );

      if (queryError) throw queryError;

      const rows = normalizeRows(data);

      setItems(rows);
      setOriginalItems(rows);
    } catch (loadError) {
      setError(getError(loadError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadTargets();
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [loadTargets]);

  const visibleItems = useMemo(() => {
    const filtered =
      activeGroup === "Semua"
        ? items
        : items.filter(
            (item) =>
              item.report_group === activeGroup
          );

    return [...filtered].sort(
      (a, b) =>
        a.sort_order - b.sort_order ||
        a.title.localeCompare(b.title, "id")
    );
  }, [items, activeGroup]);

  const modified = useMemo(() => {
    if (items.length !== originalItems.length) {
      return true;
    }

    const previous = new Map(
      originalItems.map((item) => [
        item.id,
        item,
      ])
    );

    return items.some((item) => {
      const old = previous.get(item.id);

      return (
        !old ||
        old.report_group !== item.report_group ||
        Number(old.target) !== Number(item.target)
      );
    });
  }, [items, originalItems]);

  function updateItem(id, field, value) {
    setItems((previous) =>
      previous.map((item) =>
        item.id === id
          ? {
              ...item,
              [field]: value,
            }
          : item
      )
    );

    setError("");
    setMessage("");
  }

  async function handleSave(event) {
    event.preventDefault();

    if (saving || loading || !modified) return;

    const invalid = items.find(
      (item) =>
        !isValidTarget(item.target) ||
        !GROUPS.includes(item.report_group)
    );

    if (invalid) {
      setError(
        `Periksa target dan kelompok kegiatan: ${invalid.title}. ` +
          "Target harus berada antara 0–100%."
      );
      return;
    }

    const original = new Map(
      originalItems.map((item) => [
        item.id,
        item,
      ])
    );

    const changedItems = items.filter((item) => {
      const old = original.get(item.id);

      return (
        !old ||
        old.report_group !== item.report_group ||
        Number(old.target) !== Number(item.target)
      );
    });

    if (!changedItems.length) return;

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const payload = changedItems.map((item) => ({
        id: item.id,
        target: Number(item.target),
        report_group: item.report_group,
      }));

      const { error: saveError } =
        await supabase.rpc(
          "save_mutabaah_report_targets",
          {
            p_items: payload,
          }
        );

      if (saveError) throw saveError;

      setOriginalItems(
        items.map((item) => ({ ...item }))
      );

      setMessage(
        "Target dan kelompok kegiatan berhasil disimpan."
      );
    } catch (saveError) {
      setError(getError(saveError));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section style={css.panel}>
      <header>
        <h2 style={css.title}>
          Pengaturan Target Kegiatan
        </h2>

        
      </header>

      <form onSubmit={handleSave}>
        <div
          style={{
            marginBottom: 10,
            fontSize: 13,
            fontWeight: 600,
            color: "#344b3d",
          }}
        >
          Pilih Kelompok
        </div>

        <div className="report-target-group-tabs" style={css.tabs}>
          {["Semua", ...GROUPS].map((group) => {
            const selected =
              activeGroup === group;

            return (
              <button
                key={group}
                type="button"
                onClick={() =>
                  setActiveGroup(group)
                }
                aria-pressed={selected}
                style={{
                  border: selected
                    ? "1px solid #14744e"
                    : "1px solid #e2e9e4",
                  background: selected
                    ? "#14744e"
                    : "#f8faf8",
                  color: selected
                    ? "#ffffff"
                    : "#526158",
                  borderRadius: 7,
                  padding: "8px 12px",
                  fontSize: 12,
                  fontWeight: selected
                    ? 600
                    : 400,
                  cursor: "pointer",
                }}
              >
                {group}
              </button>
            );
          })}
        </div>

        {error && (
          <p
            role="alert"
            className="admin-error"
          >
            {error}
          </p>
        )}

        {message && (
          <p
            role="status"
            className="admin-success"
          >
            {message}
          </p>
        )}

        {loading ? (
          <p>Memuat kegiatan...</p>
        ) : items.length === 0 ? (
          <p style={css.description}>
            Belum ada kegiatan aktif.
          </p>
        ) : (
          <div className="report-target-table-wrap" style={css.tableWrap}>
            <table className="report-target-table" style={css.table}>
              <thead>
                <tr>
                  <th style={css.th}>No.</th>
                  <th style={css.th}>Kegiatan</th>
                  <th style={css.th}>Kelompok</th>
                  <th style={css.th}>Target (%)</th>
                </tr>
              </thead>

              <tbody>
                {visibleItems.map((item, index) => {
                  const color =
                    GROUP_COLORS[
                      item.report_group
                    ] || GROUP_COLORS.Ibadah;

                  return (
                    <tr className="report-target-row" key={item.id}>
                      <td className="report-target-number" style={css.td}>
                        {index + 1}
                      </td>

                      <td
                        className="report-target-name"
                        style={{
                          ...css.td,
                          minWidth: 160,
                        }}
                      >
                        {item.title}
                      </td>

                      <td className="report-target-group" style={css.td}>
                        <select
                          value={item.report_group}
                          disabled={saving}
                          onChange={(event) =>
                            updateItem(
                              item.id,
                              "report_group",
                              event.target.value
                            )
                          }
                          aria-label={
                            `Kelompok ${item.title}`
                          }
                          style={{
                            ...css.select,
                            background:
                              color.background,
                            color: color.color,
                          }}
                        >
                          {GROUPS.map((group) => (
                            <option
                              key={group}
                              value={group}
                            >
                              {group}
                            </option>
                          ))}
                        </select>
                      </td>

                      <td className="report-target-value" style={css.td}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 7,
                          }}
                        >
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.01"
                            required
                            disabled={saving}
                            value={item.target}
                            onChange={(event) =>
                              updateItem(
                                item.id,
                                "target",
                                event.target.value
                              )
                            }
                            aria-label={
                              `Target ${item.title}`
                            }
                            style={css.input}
                          />

                          <span
                            style={{
                              fontSize: 12,
                              color: "#69786e",
                            }}
                          >
                            %
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!loading && items.length > 0 && (
          <div className="report-target-actions">
            <button
              type="button"
              className="admin-secondary-button report-target-cancel"
              disabled={saving || !modified}
              onClick={() => {
                setItems(
                  originalItems.map((item) => ({
                    ...item,
                  }))
                );
                setError("");
                setMessage("");
              }}
            >
              Batalkan Perubahan
            </button>

            <button
              type="submit"
              className="report-target-save"
              disabled={saving || !modified}
              style={{
                ...css.save,
                opacity:
                  saving || !modified
                    ? 0.55
                    : 1,
              }}
            >
              {saving
                ? "Menyimpan..."
                : "Simpan Pengaturan"}
            </button>
          </div>
        )}
      </form>
    </section>
  );
}
