
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { fetchAll } from "../lib/pagination";
import "./Activities.css";
import "./ActivitiesDynamic.css";
import RamadanSettings from "./RamadanSettings";

const CATEGORIES = [
  { value: "shalat", label: "Salat", group: "Ibadah" },
  { value: "alquran", label: "Al-Qur'an", group: "Al-Qur’an" },
  { value: "dzikir", label: "Zikir dan Doa", group: "Ibadah" },
  { value: "puasa", label: "Puasa", group: "Ibadah" },
  { value: "akhlak", label: "Akhlak", group: "Akhlak" },
  {
    value: "kebiasaan",
    label: "Kebiasaan",
    group: "Kebiasaan Baik",
  },
];

const HAID_RULES = [
  { value: "normal", label: "Tetap diisi" },
  { value: "exempt", label: "Dikecualikan saat haid" },
  {
    value: "configurable",
    label: "Ikuti kebijakan Al-Qur'an",
  },
];

const REPORT_GROUPS = [
  "Ibadah",
  "Al-Qur’an",
  "Akhlak",
  "Kemandirian",
  "Kebiasaan Baik",
];

const WEEKDAYS = [
  { id: 1, short: "Sen", name: "Senin" },
  { id: 2, short: "Sel", name: "Selasa" },
  { id: 3, short: "Rab", name: "Rabu" },
  { id: 4, short: "Kam", name: "Kamis" },
  { id: 5, short: "Jum", name: "Jumat" },
  { id: 6, short: "Sab", name: "Sabtu" },
  { id: 7, short: "Min", name: "Minggu" },
];

function defaultHaidRule(category) {
  if (
    category === "shalat" ||
    category === "puasa"
  ) {
    return "exempt";
  }

  if (category === "alquran") {
    return "configurable";
  }

  return "normal";
}

function newActivity(order) {
  return {
    id: null,
    title: "",
    category: "kebiasaan",
    sort_order: order,
    is_active: true,
    haid_rule: "normal",
    scoring_mode: "required",
    report_group: "Kebiasaan Baik",
    allowed_weekdays: [1, 2, 3, 4, 5, 6, 7],
  };
}

function errorText(error) {
  if (error?.code === "23505") {
    return "Kode kegiatan sudah terdaftar.";
  }

  return (
    error?.message ||
    "Terjadi kesalahan. Silakan coba lagi."
  );
}

function jakartaToday() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jakarta",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).formatToParts(new Date());

  const p = Object.fromEntries(
    parts.map((x) => [x.type, x.value])
  );

  return `${p.year}-${p.month}-${p.day}`;
}

function monthStart(today) {
  return `${today.slice(0, 7)}-01`;
}

function weekdaysLabel(days) {
  if (
    !Array.isArray(days) ||
    days.length === 0 ||
    days.length === 7
  ) {
    return "Setiap hari";
  }

  return [...days]
    .sort((a, b) => a - b)
    .map(
      (id) =>
        WEEKDAYS.find(
          (day) => day.id === Number(id)
        )?.short
    )
    .filter(Boolean)
    .join(", ");
}

export default function Activities() {
  const [tab, setTab] = useState("master");

  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);

  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [changingId, setChangingId] = useState("");

  const [categoryFilter, setCategoryFilter] =
    useState("all");

  const [modeFilter, setModeFilter] =
    useState("all");

  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState("");

  const [quranExempt, setQuranExempt] =
    useState(false);

  const [savingPolicy, setSavingPolicy] =
    useState(false);

  const [classes, setClasses] = useState([]);
  const [classId, setClassId] = useState("");

  const [startDate, setStartDate] = useState(
    () => monthStart(jakartaToday())
  );

  const [endDate, setEndDate] =
    useState(jakartaToday);

  const [bonusRows, setBonusRows] =
    useState(null);

  const [loadingBonus, setLoadingBonus] =
    useState(false);

  const [bonusError, setBonusError] =
    useState("");

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const [
          list,
          policy,
          classList,
        ] = await Promise.all([
          supabase
            .from("mutabaah_activities")
            .select(
              "id,code,title,category,sort_order,is_active,haid_rule,scoring_mode,allowed_weekdays,report_group"
            )
            .neq("category", "ramadan")
            .order("sort_order")
            .order("title"),

          supabase.rpc(
            "get_mutabaah_haid_policy"
          ),

          fetchAll(() => supabase.rpc(
            "get_mutabaah_accessible_classes"
          ).order("academic_year", { ascending: false }).order("grade").order("class_name"), ["class_id"]),
        ]);

        for (const result of [
          list,
          policy,
          classList,
        ]) {
          if (result.error) {
            throw result.error;
          }
        }

        if (!active) return;

        setActivities(
          Array.isArray(list.data)
            ? list.data
            : []
        );

        setQuranExempt(
          policy.data
            ?.quran_exempt_when_haid === true
        );

        const available =
          Array.isArray(classList.data)
            ? classList.data
            : [];

        setClasses(available);

        setClassId((previous) =>
          available.some(
            (row) =>
              row.class_id === previous
          )
            ? previous
            : available[0]?.class_id || ""
        );

        setError("");
      } catch (caught) {
        if (active) {
          setError(errorText(caught));
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [revision]);

  useEffect(() => {
    if (!form || saving) {
      return undefined;
    }

    function handleKey(event) {
      if (event.key === "Escape") {
        setForm(null);
        setFormError("");
      }
    }

    window.addEventListener(
      "keydown",
      handleKey
    );

    return () => {
      window.removeEventListener(
        "keydown",
        handleKey
      );
    };
  }, [form, saving]);

  const filtered = useMemo(() => {
    const word =
      search.trim().toLowerCase();

    return activities.filter(
      (item) =>
        (
          categoryFilter === "all" ||
          item.category === categoryFilter
        ) &&
        (
          modeFilter === "all" ||
          (item.scoring_mode || "required") ===
            modeFilter
        ) &&
        (
          !word ||
          item.title.toLowerCase().includes(word)
        )
    );
  }, [
    activities,
    categoryFilter,
    modeFilter,
    search,
  ]);

  const grouped = useMemo(
    () =>
      CATEGORIES.map((group) => ({
        ...group,
        items: filtered.filter(
          (item) =>
            item.category === group.value
        ),
      })).filter(
        (group) => group.items.length
      ),
    [filtered]
  );

  const counts = useMemo(
    () => ({
      active: activities.filter(
        (item) => item.is_active
      ).length,

      required: activities.filter(
        (item) =>
          item.is_active &&
          item.scoring_mode !== "bonus"
      ).length,

      bonus: activities.filter(
        (item) =>
          item.is_active &&
          item.scoring_mode === "bonus"
      ).length,
    }),
    [activities]
  );

  function reload() {
    setLoading(true);

    setRevision(
      (value) => value + 1
    );
  }

  function openAdd() {
    const max = activities.reduce(
      (n, a) =>
        Math.max(
          n,
          Number(a.sort_order) || 0
        ),
      0
    );

    setForm(newActivity(max + 10));
    setFormError("");
    setNotice("");
  }

  function openEdit(activity) {
    setForm({
      id: activity.id,
      title: activity.title,
      category: activity.category,
      sort_order: activity.sort_order,
      is_active: activity.is_active,

      haid_rule:
        activity.haid_rule || "normal",

      scoring_mode:
        activity.scoring_mode === "bonus"
          ? "bonus"
          : "required",

      report_group:
        REPORT_GROUPS.includes(
          activity.report_group
        )
          ? activity.report_group
          : (
              CATEGORIES.find(
                (category) =>
                  category.value ===
                  activity.category
              )?.group ||
              "Kebiasaan Baik"
            ),

      allowed_weekdays:
        Array.isArray(
          activity.allowed_weekdays
        )
          ? activity.allowed_weekdays.map(
              Number
            )
          : [1, 2, 3, 4, 5, 6, 7],

      originalMode:
        activity.scoring_mode === "bonus"
          ? "bonus"
          : "required",
    });

    setFormError("");
    setNotice("");
  }

  function setField(name, value) {
    setForm((previous) => ({
      ...previous,

      [name]: value,

      ...(
        name === "category"
          ? {
              haid_rule:
                defaultHaidRule(value),

              report_group:
                CATEGORIES.find(
                  (cat) =>
                    cat.value === value
                )?.group ||
                "Kebiasaan Baik",
            }
          : {}
      ),
    }));

    setFormError("");
  }

  function toggleDay(day) {
    setForm((previous) => {
      const selected = new Set(
        previous.allowed_weekdays
      );

      if (selected.has(day)) {
        selected.delete(day);
      } else {
        selected.add(day);
      }

      return {
        ...previous,

        allowed_weekdays: [
          ...selected,
        ].sort((a, b) => a - b),
      };
    });

    setFormError("");
  }

  async function submit(event) {
    event.preventDefault();

    if (!form || saving) return;

    const title = form.title
      .trim()
      .replace(/\s+/g, " ");

    const sort = Number(
      form.sort_order
    );

    if (
      title.length < 2 ||
      title.length > 120
    ) {
      setFormError(
        "Nama kegiatan harus 2–120 karakter."
      );
      return;
    }

    if (
      !Number.isSafeInteger(sort) ||
      sort < 0 ||
      sort > 100000
    ) {
      setFormError(
        "Urutan harus bilangan bulat antara 0–100000."
      );
      return;
    }

    if (
      !CATEGORIES.some(
        (item) =>
          item.value === form.category
      )
    ) {
      setFormError(
        "Kategori belum dipilih."
      );
      return;
    }

    if (
      !HAID_RULES.some(
        (item) =>
          item.value === form.haid_rule
      )
    ) {
      setFormError(
        "Aturan haid tidak valid."
      );
      return;
    }

    if (
      !REPORT_GROUPS.includes(
        form.report_group
      )
    ) {
      setFormError(
        "Kelompok rapor tidak valid."
      );
      return;
    }

    if (
      !["required", "bonus"].includes(
        form.scoring_mode
      )
    ) {
      setFormError(
        "Jenis penilaian tidak valid."
      );
      return;
    }

    if (
      !form.allowed_weekdays.length ||
      form.allowed_weekdays.some(
        (n) =>
          !WEEKDAYS.some(
            (d) => d.id === n
          )
      )
    ) {
      setFormError(
        "Pilih minimal satu hari berlaku."
      );
      return;
    }

    setSaving(true);
    setFormError("");
    setNotice("");

    try {
      // Jangan mengubah jenis penilaian jika
      // kegiatan mempunyai riwayat pengisian.
      if (
        form.id &&
        form.originalMode !==
          form.scoring_mode
      ) {
        const {
          count,
          error: countError,
        } = await supabase
          .from("mutabaah_entries")
          .select(
            "student_id",
            {
              head: true,
              count: "exact",
            }
          )
          .eq(
            "activity_id",
            form.id
          );

        if (countError) {
          throw countError;
        }

        if (count > 0) {
          throw new Error(
            "Kegiatan ini sudah memiliki riwayat pengisian. " +
            "Jenis penilaian tidak bisa diubah. " +
            "Nonaktifkan kegiatan ini lalu buat kegiatan " +
            "baru dengan jenis yang diinginkan."
          );
        }
      }

      const payload = {
        title,
        category: form.category,
        sort_order: sort,
        is_active:
          Boolean(form.is_active),
        haid_rule: form.haid_rule,
        scoring_mode:
          form.scoring_mode,

        allowed_weekdays: [
          ...form.allowed_weekdays,
        ].sort((a, b) => a - b),

        report_group:
          form.report_group,
      };

      const result = form.id
        ? await supabase
            .from("mutabaah_activities")
            .update(payload)
            .eq("id", form.id)

        : await supabase
            .from("mutabaah_activities")
            .insert({
              ...payload,

              code:
                `custom_${crypto
                  .randomUUID()
                  .replace(/-/g, "")}`,
            });

      if (result.error) {
        throw result.error;
      }

      setForm(null);

      setNotice(
        "Kegiatan berhasil disimpan dan " +
        "akan mengikuti formulir orang tua."
      );

      reload();
    } catch (caught) {
      setFormError(
        errorText(caught)
      );
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(activity) {
    if (changingId) return;

    setChangingId(activity.id);
    setError("");
    setNotice("");

    try {
      const {
        error: problem,
      } = await supabase
        .from("mutabaah_activities")
        .update({
          is_active:
            !activity.is_active,
        })
        .eq("id", activity.id);

      if (problem) {
        throw problem;
      }

      setActivities(
        (previous) =>
          previous.map(
            (item) =>
              item.id === activity.id
                ? {
                    ...item,
                    is_active:
                      !item.is_active,
                  }
                : item
          )
      );

      setNotice(
        activity.is_active
          ? "Kegiatan dinonaktifkan dari form. " +
            "Riwayat pengisian tidak dihapus."
          : "Kegiatan kembali aktif di formulir."
      );
    } catch (caught) {
      setError(
        errorText(caught)
      );
    } finally {
      setChangingId("");
    }
  }

  async function toggleQuranPolicy() {
    if (savingPolicy) return;

    setSavingPolicy(true);
    setError("");
    setNotice("");

    try {
      const {
        error: problem,
      } = await supabase.rpc(
        "set_mutabaah_haid_policy",
        {
          p_quran_exempt:
            !quranExempt,
        }
      );

      if (problem) {
        throw problem;
      }

      setQuranExempt(
        (value) => !value
      );

      setNotice(
        "Kebijakan haid berhasil disimpan."
      );
    } catch (caught) {
      setError(
        errorText(caught)
      );
    } finally {
      setSavingPolicy(false);
    }
  }

  async function loadBonus() {
    if (
      !classId ||
      !startDate ||
      !endDate ||
      loadingBonus
    ) {
      return;
    }

    if (startDate > endDate) {
      setBonusError(
        "Tanggal mulai tidak boleh melebihi tanggal akhir."
      );
      return;
    }

    if (endDate > jakartaToday()) {
      setBonusError(
        "Tanggal akhir tidak boleh melebihi hari ini."
      );
      return;
    }

    const days =
      (
        new Date(
          `${endDate}T12:00:00Z`
        ) -
        new Date(
          `${startDate}T12:00:00Z`
        )
      ) / 86400000;

    if (days > 366) {
      setBonusError(
        "Rentang maksimal 367 hari inklusif."
      );
      return;
    }

    setLoadingBonus(true);
    setBonusError("");
    setBonusRows(null);

    try {
      const {
        data,
        error: problem,
      } = await supabase.rpc(
        "get_mutabaah_bonus_counts",
        {
          p_class_id: classId,
          p_start_date: startDate,
          p_end_date: endDate,
        }
      );

      if (problem) {
        throw problem;
      }

      setBonusRows(
        Array.isArray(data)
          ? data
          : []
      );
    } catch (caught) {
      setBonusError(
        errorText(caught)
      );
    } finally {
      setLoadingBonus(false);
    }
  }

  const bonusNames =
    bonusRows?.[0]?.bonuses || [];

  return (
    <div className="activities-page">
      <RamadanSettings />
      <section className="activities-panel">
        <header className="activities-heading">
          <div>
            <h2>
              Kegiatan & Form Mutabaah
            </h2>

            <p className="activities-intro">
              Kelola kegiatan yang muncul
              pada pengisian orang tua.
            </p>
          </div>

          {tab === "master" && (
            <button
              className="activities-primary"
              type="button"
              disabled={loading}
              onClick={openAdd}
            >
              + Tambah Kegiatan
            </button>
          )}
        </header>

        <nav
          className="activities-tabs"
          aria-label="Menu kegiatan Mutabaah"
        >
          <button
            type="button"
            className={
              tab === "master"
                ? "is-active"
                : ""
            }
            onClick={() =>
              setTab("master")
            }
          >
            Daftar Kegiatan
          </button>

          <button
            type="button"
            className={
              tab === "bonus"
                ? "is-active"
                : ""
            }
            onClick={() =>
              setTab("bonus")
            }
          >
            Rekap Tambahan
          </button>
        </nav>

        {tab === "master" && (
          <>
            <div className="activities-summary">
              <span>
                <strong>
                  {counts.active}
                </strong>
                Aktif
              </span>

              <span>
                <strong>
                  {counts.required}
                </strong>
                Wajib
              </span>

              <span>
                <strong>
                  {counts.bonus}
                </strong>
                Tambahan
              </span>
            </div>

            <section className="activities-policy">
              <strong>
                Kebijakan Saat Haid
              </strong>

              <label>
                <input
                  type="checkbox"
                  checked={quranExempt}
                  disabled={
                    savingPolicy ||
                    loading
                  }
                  onChange={() =>
                    void toggleQuranPolicy()
                  }
                />

                <span>
                  Kecualikan tilawah,
                  murajaah, dan hafalan
                  Al-Qur'an saat haid
                </span>
              </label>
            </section>

            <div className="activities-filters activities-filters-dynamic">
              <label>
                <span>Kategori</span>

                <select
                  value={categoryFilter}
                  onChange={(e) =>
                    setCategoryFilter(
                      e.target.value
                    )
                  }
                >
                  <option value="all">
                    Semua kategori
                  </option>

                  {CATEGORIES.map((c) => (
                    <option
                      key={c.value}
                      value={c.value}
                    >
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>Jenis</span>

                <select
                  value={modeFilter}
                  onChange={(e) =>
                    setModeFilter(
                      e.target.value
                    )
                  }
                >
                  <option value="all">
                    Semua jenis
                  </option>
                  <option value="required">
                    Wajib
                  </option>
                  <option value="bonus">
                    Tambahan
                  </option>
                </select>
              </label>

              <label>
                <span>Cari kegiatan</span>

                <input
                  type="search"
                  value={search}
                  placeholder="Nama kegiatan"
                  onChange={(e) =>
                    setSearch(
                      e.target.value
                    )
                  }
                />
              </label>
            </div>

            {notice && (
              <p
                className="activities-success"
                role="status"
              >
                {notice}
              </p>
            )}

            {error && (
              <p
                className="activities-error"
                role="alert"
              >
                {error}
              </p>
            )}

            {loading ? (
              <div className="activities-empty">
                Memuat kegiatan...
              </div>
            ) : grouped.length === 0 ? (
              <div className="activities-empty">
                Tidak ada kegiatan
                yang cocok.
              </div>
            ) : (
              <div className="activities-groups">
                {grouped.map((group) => (
                  <section
                    className="activities-group"
                    key={group.value}
                  >
                    <h3>{group.label}</h3>

                    <div className="activities-table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>Urutan</th>
                            <th>Kegiatan</th>
                            <th>Jenis</th>
                            <th>Hari berlaku</th>
                            <th>Aturan haid</th>
                            <th>Status</th>
                            <th>Tindakan</th>
                          </tr>
                        </thead>

                        <tbody>
                          {group.items.map(
                            (activity) => (
                              <tr
                                key={activity.id}
                              >
                                <td>
                                  {activity.sort_order}
                                </td>

                                <td className="activities-name">
                                  {activity.title}
                                </td>

                                <td>
                                  <span
                                    className={
                                      `activities-badge ${
                                        activity.scoring_mode ===
                                        "bonus"
                                          ? "is-bonus"
                                          : "is-required"
                                      }`
                                    }
                                  >
                                    {activity.scoring_mode ===
                                    "bonus"
                                      ? "Tambahan"
                                      : "Wajib"}
                                  </span>
                                </td>

                                <td>
                                  {weekdaysLabel(
                                    activity.allowed_weekdays
                                  )}
                                </td>

                                <td>
                                  {HAID_RULES.find(
                                    (x) =>
                                      x.value ===
                                      activity.haid_rule
                                  )?.label ||
                                    "Tetap diisi"}
                                </td>

                                <td>
                                  {activity.is_active
                                    ? "Aktif"
                                    : "Nonaktif"}
                                </td>

                                <td>
                                  <div className="activities-actions">
                                    <button
                                      type="button"
                                      disabled={
                                        Boolean(
                                          changingId
                                        )
                                      }
                                      onClick={() =>
                                        openEdit(
                                          activity
                                        )
                                      }
                                    >
                                      Edit
                                    </button>

                                    <button
                                      type="button"
                                      disabled={
                                        Boolean(
                                          changingId
                                        )
                                      }
                                      onClick={() =>
                                        void toggleStatus(
                                          activity
                                        )
                                      }
                                    >
                                      {activity.is_active
                                        ? "Nonaktifkan"
                                        : "Aktifkan"}
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            )
                          )}
                        </tbody>
                      </table>
                    </div>
                  </section>
                ))}
              </div>
            )}
          </>
        )}

        {tab === "bonus" && (
          <section className="activities-bonus-recap">
            <p>
              Kegiatan Tambahan dihitung
              dari jawaban <strong>Ya</strong>
              {" "}yang sudah{" "}
              <strong>Final</strong>.
              Satu kegiatan maksimal
              satu kali per hari,
              tanpa persentase atau grade.
            </p>

            <div className="activities-bonus-filters">
              <label>
                Kelas

                <select
                  value={classId}
                  onChange={(e) => {
                    setClassId(
                      e.target.value
                    );
                    setBonusRows(null);
                  }}
                >
                  {!classes.length && (
                    <option value="">
                      Belum ada kelas
                    </option>
                  )}

                  {classes.map((c) => (
                    <option
                      value={c.class_id}
                      key={c.class_id}
                    >
                      {c.class_name} ·{" "}
                      {c.academic_year}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Dari tanggal

                <input
                  type="date"
                  value={startDate}
                  max={endDate}
                  onChange={(e) => {
                    setStartDate(
                      e.target.value
                    );
                    setBonusRows(null);
                  }}
                />
              </label>

              <label>
                Sampai tanggal

                <input
                  type="date"
                  value={endDate}
                  min={startDate}
                  max={jakartaToday()}
                  onChange={(e) => {
                    setEndDate(
                      e.target.value
                    );
                    setBonusRows(null);
                  }}
                />
              </label>

              <button
                type="button"
                className="activities-primary"
                disabled={
                  !classId ||
                  loadingBonus
                }
                onClick={() =>
                  void loadBonus()
                }
              >
                {loadingBonus
                  ? "Menghitung..."
                  : "Tampilkan Rekap"}
              </button>
            </div>

            {bonusError && (
              <p
                role="alert"
                className="activities-error"
              >
                {bonusError}
              </p>
            )}

            {bonusRows !== null && (
              bonusRows.length === 0 ? (
                <div className="activities-empty">
                  Belum ada siswa
                  pada rentang ini.
                </div>
              ) : (
                <div className="activities-table-wrap activities-bonus-table">
                  <table>
                    <thead>
                      <tr>
                        <th>No</th>
                        <th>Nama siswa</th>
                        <th>NIS</th>

                        {bonusNames.map(
                          (a) => (
                            <th key={a.id}>
                              {a.title}
                            </th>
                          )
                        )}

                        <th>Jumlah</th>
                      </tr>
                    </thead>

                    <tbody>
                      {bonusRows.map(
                        (
                          student,
                          index
                        ) => (
                          <tr
                            key={student.id}
                          >
                            <td>
                              {index + 1}
                            </td>

                            <td className="activities-name">
                              {student.name}
                            </td>

                            <td>
                              {student.nis ||
                                "—"}
                            </td>

                            {(
                              student.bonuses ||
                              []
                            ).map(
                              (b) => (
                                <td
                                  key={b.id}
                                >
                                  {Number(
                                    b.count
                                  ) || 0}
                                </td>
                              )
                            )}

                            <td>
                              <strong>
                                {(
                                  student.bonuses ||
                                  []
                                ).reduce(
                                  (
                                    n,
                                    b
                                  ) =>
                                    n +
                                    (
                                      Number(
                                        b.count
                                      ) || 0
                                    ),
                                  0
                                )}
                              </strong>
                            </td>
                          </tr>
                        )
                      )}
                    </tbody>
                  </table>
                </div>
              )
            )}
          </section>
        )}
      </section>

      {form && (
        <div
          className="activities-backdrop"
          onMouseDown={(e) => {
            if (
              e.target ===
                e.currentTarget &&
              !saving
            ) {
              setForm(null);
            }
          }}
        >
          <section
            className="activities-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="activity-form-title"
          >
            <header>
              <h2 id="activity-form-title">
                {form.id
                  ? "Edit Kegiatan"
                  : "Tambah Kegiatan"}
              </h2>
            </header>

            <form onSubmit={submit}>
              <div className="activities-form-body">
                <label className="activities-full">
                  <span>
                    Nama Kegiatan
                  </span>

                  <input
                    autoFocus
                    required
                    maxLength={120}
                    value={form.title}
                    disabled={saving}
                    onChange={(e) =>
                      setField(
                        "title",
                        e.target.value
                      )
                    }
                  />
                </label>

                <label>
                  <span>
                    Kategori
                  </span>

                  <select
                    value={form.category}
                    disabled={saving}
                    onChange={(e) =>
                      setField(
                        "category",
                        e.target.value
                      )
                    }
                  >
                    {CATEGORIES.map(
                      (c) => (
                        <option
                          key={c.value}
                          value={c.value}
                        >
                          {c.label}
                        </option>
                      )
                    )}
                  </select>
                </label>

                <label>
                  <span>
                    Jenis Penilaian
                  </span>

                  <select
                    value={form.scoring_mode}
                    disabled={saving}
                    onChange={(e) =>
                      setField(
                        "scoring_mode",
                        e.target.value
                      )
                    }
                  >
                    <option value="required">
                      Wajib · masuk nilai/grade
                    </option>

                    <option value="bonus">
                      Tambahan · hitung kali
                    </option>
                  </select>
                </label>

                <label>
                  <span>
                    Urutan
                  </span>

                  <input
                    type="number"
                    min={0}
                    max={100000}
                    required
                    value={form.sort_order}
                    disabled={saving}
                    onChange={(e) =>
                      setField(
                        "sort_order",
                        e.target.value
                      )
                    }
                  />
                </label>

                {form.scoring_mode ===
                  "required" && (
                  <label>
                    <span>
                      Kelompok di Rapor
                    </span>

                    <select
                      value={form.report_group}
                      disabled={saving}
                      onChange={(e) =>
                        setField(
                          "report_group",
                          e.target.value
                        )
                      }
                    >
                      {REPORT_GROUPS.map(
                        (g) => (
                          <option
                            key={g}
                            value={g}
                          >
                            {g}
                          </option>
                        )
                      )}
                    </select>
                  </label>
                )}

                <fieldset className="activities-full activities-weekdays">
                  <legend>
                    Hari berlaku
                  </legend>

                  <div>
                    {WEEKDAYS.map(
                      (day) => (
                        <label key={day.id}>
                          <input
                            type="checkbox"
                            checked={
                              form.allowed_weekdays.includes(
                                day.id
                              )
                            }
                            disabled={saving}
                            onChange={() =>
                              toggleDay(
                                day.id
                              )
                            }
                          />

                          {day.short}
                        </label>
                      )
                    )}
                  </div>

                  <small>
                    Kegiatan hanya muncul
                    pada hari yang dipilih.
                  </small>
                </fieldset>

                <label className="activities-full">
                  <span>
                    Aturan saat haid
                  </span>

                  <select
                    value={form.haid_rule}
                    disabled={saving}
                    onChange={(e) =>
                      setField(
                        "haid_rule",
                        e.target.value
                      )
                    }
                  >
                    {HAID_RULES.map(
                      (rule) => (
                        <option
                          key={rule.value}
                          value={rule.value}
                        >
                          {rule.label}
                        </option>
                      )
                    )}
                  </select>
                </label>

                <label className="activities-check">
                  <input
                    type="checkbox"
                    checked={form.is_active}
                    disabled={saving}
                    onChange={(e) =>
                      setField(
                        "is_active",
                        e.target.checked
                      )
                    }
                  />

                  <span>
                    Tampilkan dalam
                    formulir orang tua
                  </span>
                </label>

                <p className="activities-full activities-form-help">
                  {form.scoring_mode ===
                    "bonus"
                    ? "Tambahan: satu pilihan Ya/Tidak per hari. " +
                      "Jawaban Ya dihitung 1 kali jika hari " +
                      "tersebut sudah Final. Tidak masuk " +
                      "persentase, target, atau grade."

                    : "Wajib: kegiatan masuk penilaian " +
                      "persentase, target, dan grade Mutabaah."}
                </p>

                {formError && (
                  <p
                    className="activities-error"
                    role="alert"
                  >
                    {formError}
                  </p>
                )}
              </div>

              <footer className="activities-dialog-footer">
                <button
                  className="activities-secondary"
                  type="button"
                  disabled={saving}
                  onClick={() =>
                    setForm(null)
                  }
                >
                  Batal
                </button>

                <button
                  className="activities-primary"
                  type="submit"
                  disabled={saving}
                >
                  {saving
                    ? "Menyimpan..."
                    : "Simpan Kegiatan"}
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
