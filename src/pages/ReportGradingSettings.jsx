
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

const DEFAULT_VALUES = {
  grade_a_min: "90",
  grade_b_min: "80",
  grade_c_min: "70",
  kkm: "70",
};

const FIELDS = [
  { key: "grade_a_min", label: "Batas minimal A" },
  { key: "grade_b_min", label: "Batas minimal B" },
  { key: "grade_c_min", label: "Batas minimal C" },
  { key: "kkm", label: "KKM" },
];

export default function ReportGradingSettings() {
  const [values, setValues] = useState(DEFAULT_VALUES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadSettings() {
      try {
        const { data, error: queryError } =
          await supabase.rpc(
            "get_mutabaah_report_grading"
          );

        if (queryError) {
          throw queryError;
        }

        if (cancelled) return;

        if (data) {
          setValues({
            grade_a_min: String(
              data.grade_a_min ?? 90
            ),
            grade_b_min: String(
              data.grade_b_min ?? 80
            ),
            grade_c_min: String(
              data.grade_c_min ?? 70
            ),
            kkm: String(data.kkm ?? 70),
          });
        }

        setError("");
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError.message ||
              "Gagal memuat pengaturan rapor."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadSettings();

    return () => {
      cancelled = true;
    };
  }, []);

  function updateField(field, value) {
    setValues((previous) => ({
      ...previous,
      [field]: value,
    }));

    setError("");
    setNotice("");
  }

  async function handleSave(event) {
    event.preventDefault();

    if (saving || loading) return;

    const a = Number(values.grade_a_min);
    const b = Number(values.grade_b_min);
    const c = Number(values.grade_c_min);
    const kkm = Number(values.kkm);

    const empty = Object.values(values).some(
      (value) => String(value).trim() === ""
    );

    const valid =
      !empty &&
      [a, b, c, kkm].every(Number.isFinite) &&
      a <= 100 &&
      a > b &&
      b > c &&
      c >= 0 &&
      kkm >= 0 &&
      kkm <= 100;

    if (!valid) {
      setError(
        "Batas grade harus berurutan A > B > C, " +
          "dengan nilai 0–100. KKM juga harus " +
          "berada antara 0–100."
      );
      setNotice("");
      return;
    }

    setSaving(true);
    setError("");
    setNotice("");

    try {
      const { error: saveError } =
        await supabase.rpc(
          "set_mutabaah_report_grading",
          {
            p_a: a,
            p_b: b,
            p_c: c,
            p_kkm: kkm,
          }
        );

      if (saveError) {
        throw saveError;
      }

      setNotice(
        "Pengaturan grade dan KKM " +
          "berhasil disimpan."
      );
    } catch (saveError) {
      setError(
        saveError.message ||
          "Gagal menyimpan pengaturan."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section
      className="admin-panel"
      style={{ marginBottom: 18 }}
    >
      <div className="admin-section-heading">
        <h3>Nilai dan Grade Rapor</h3>
      </div>

      <form onSubmit={handleSave}>
        <div className="identity-grid">
          {FIELDS.map((field) => (
            <label
              className="admin-field"
              key={field.key}
            >
              <span>{field.label}</span>

              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                required
                disabled={loading || saving}
                value={values[field.key]}
                onChange={(event) =>
                  updateField(
                    field.key,
                    event.target.value
                  )
                }
              />
            </label>
          ))}
        </div>

        <p style={{ fontSize: 12, color: "#66766d", lineHeight: 1.6 }}>KKM menentukan ketuntasan dan tidak mengubah grade.</p>

        {error && (
          <p
            className="admin-error"
            role="alert"
          >
            {error}
          </p>
        )}

        {notice && (
          <p
            className="admin-success"
            role="status"
          >
            {notice}
          </p>
        )}

        <button
          type="submit"
          className="admin-primary-button"
          disabled={loading || saving}
        >
          {loading
            ? "Memuat..."
            : saving
              ? "Menyimpan..."
              : "Simpan Pengaturan Nilai"}
        </button>
      </form>
    </section>
  );
}
