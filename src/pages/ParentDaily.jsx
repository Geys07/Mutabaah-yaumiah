
import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { supabase } from "../lib/supabase";
import { loadParentActivities } from "../lib/loadParentActivities";
import "./ParentDaily.css";
import { enqueueParentDaySave, waitForParentDaySave, readUnsavedParentDay, captureParentDayOwner, isParentDayOwnerCurrent, subscribeParentDaySession } from "../lib/parentDaySaveQueue";

const CATEGORY_NAMES = {
  ramadan: "Kegiatan Khusus Ramadan",
  shalat: "Salat",
  alquran: "Al-Qur'an",
  dzikir: "Zikir dan Doa",
  puasa: "Puasa",
  akhlak: "Akhlak",
  kebiasaan: "Kebiasaan Baik",
};

function jakartaToday() {
  const values = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Jakarta",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    })
      .formatToParts(new Date())
      .map((entry) => [
        entry.type,
        entry.value,
      ])
  );

  return `${values.year}-${values.month}-${values.day}`;
}

function addDays(date, number) {
  const result = new Date(`${date}T12:00:00Z`);
  result.setUTCDate(
    result.getUTCDate() + number
  );
  return result.toISOString().slice(0, 10);
}

function isoWeekday(isoDate) {
  const weekday = new Date(
    `${isoDate}T12:00:00Z`
  ).getUTCDay();

  return weekday === 0 ? 7 : weekday;
}

function isExcluded(
  activity,
  isHaid,
  quranExempt,
  weekday
) {
  const weekdays = Array.isArray(
    activity.allowed_weekdays
  )
    ? activity.allowed_weekdays
    : [];

  if (
    weekdays.length > 0 &&
    !weekdays.map(Number).includes(weekday)
  ) {
    return true;
  }

  if (!isHaid) return false;

  if (activity.haid_rule === "exempt") {
    return true;
  }

  return (
    activity.haid_rule === "configurable" &&
    quranExempt
  );
}

const modalBackdrop = {
  position: "fixed",
  inset: 0,
  zIndex: 210,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 16,
  background: "rgba(12,39,30,.60)",
};

const modalCard = {
  width: "min(100%,420px)",
  borderRadius: 18,
  background: "var(--mut-ui-glass,#fff)",
  padding: 23,
  boxShadow:
    "0 18px 55px rgba(0,38,25,.25)",
  color: "var(--mut-ui-text,#20382c)",
};

function buildDayPayload(studentId, selectedDate, snapshot, finalize) {
    const weekday = isoWeekday(selectedDate);
    const isHaid = snapshot.haid.is_female && snapshot.haid.is_haid;
    return {
      p_student_id: studentId,
      p_date: selectedDate,
      p_is_haid: Boolean(isHaid),
      p_answers: snapshot.activities
        .filter((activity) => !isExcluded(
          activity, isHaid, snapshot.haid.quran_exempt_when_haid, weekday
        ) && typeof snapshot.answers[activity.id] === "boolean")
        .map((activity) => ({
          activity_id: activity.id, completed: snapshot.answers[activity.id],
        })),
      p_finalize: finalize,
    };
  }


function DailyEditor({
  studentId,
  selectedDate,
  maxDate,
  onSaved,
  onFinalized,
}) {
  const [activities, setActivities] =
    useState([]);

  const [answers, setAnswers] = useState({});

  const [haidInfo, setHaidInfo] = useState({
    is_female: false,
    is_haid: false,
    quran_exempt_when_haid: false,
  });

  const [dayStatus, setDayStatus] =
    useState("draft");

  const [loading, setLoading] =
    useState(true);

  const [loadFailed, setLoadFailed] = useState(false);
  const [loadRevision, setLoadRevision] = useState(0);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  const [message, setMessage] =
    useState("");

  const [confirmOpen, setConfirmOpen] =
    useState(false);

  const [finalizing, setFinalizing] = useState(false);
  const [finalizeFailed, setFinalizeFailed] = useState(false);

  const requestId = useRef(0);
  const editorOwner = useRef(null);
  const finalizingRef = useRef(false);
  const finalAttempt = useRef(false);
  const alive = useRef(false);
  const draft = useRef(null);
  const version = useRef(0);
  const queuedVersion = useRef(0);
  const dirty = useRef(false);
  const timer = useRef(null);
  const savePromise = useRef(null);
  const callbacks = useRef({ onSaved, onFinalized });

  useEffect(() => { callbacks.current = { onSaved, onFinalized }; }, [onSaved, onFinalized]);


  useEffect(() => subscribeParentDaySession(() => {
    requestId.current += 1;
    window.clearTimeout(timer.current);
    alive.current = false;
    editorOwner.current = null;
    draft.current = null;
    dirty.current = false;
    version.current = 0;
    queuedVersion.current = -1;
    savePromise.current = null;
    finalizingRef.current = false;
    finalAttempt.current = false;
    setAnswers({});
    setActivities([]);
    setSaving(false);
    setFinalizing(false);
    setFinalizeFailed(false);
    setConfirmOpen(false);
    setLoading(false);
    setLoadFailed(true);
    setMessage("");
    setError("Sesi akun berubah. Buka kembali pengisian dengan akun yang aktif.");
  }), []);

  const today = jakartaToday();
  const earliestDate = addDays(today, -29);

  const editable =
    Boolean(studentId && selectedDate) &&
    selectedDate >= earliestDate &&
    selectedDate <= today &&
    (!maxDate || selectedDate <= maxDate);

  useEffect(() => {
    if (!studentId || !selectedDate) {
      return undefined;
    }

    let cancelled = false;
    let readTimer;
    alive.current = true;
    const id = ++requestId.current;

    async function load() {
      setLoading(true);
      setLoadFailed(false);

      try {
        const [activityResult, stateResult, unsaved, binding] = await Promise.race([
          (async () => {
            const bound = await captureParentDayOwner();
            if (cancelled || id !== requestId.current) return [null, null, null, bound];
            editorOwner.current = bound;
            await waitForParentDaySave(studentId, selectedDate, bound);
            const [activities, state] = await Promise.all([
              loadParentActivities(selectedDate),
              supabase.rpc("get_parent_mutabaah_day_state", {
                p_student_id: studentId, p_date: selectedDate,
              }),
            ]);
            const retained = await readUnsavedParentDay(studentId, selectedDate, bound);
            return [activities, state, retained, bound];
          })(),
          new Promise((_, reject) => {
            readTimer = window.setTimeout(() => reject(new Error(
              "Pemuatan kegiatan terlalu lama. Periksa koneksi lalu muat ulang."
            )), 15000);
          }),
        ]);

        if (
          cancelled ||
          id !== requestId.current || !isParentDayOwnerCurrent(binding)
        ) {
          return;
        }

        if (activityResult.error) {
          throw activityResult.error;
        }

        if (stateResult.error) {
          throw stateResult.error;
        }

        const state = unsaved ? {
          ...(stateResult.data || {}), answers: unsaved.p_answers,
          is_haid: unsaved.p_is_haid, status: "draft",
        } : stateResult.data || {};
        if (unsaved) {
          dirty.current = true;
          version.current += 1;
          queuedVersion.current = -1;
          finalAttempt.current = unsaved.p_finalize;
          setFinalizeFailed(unsaved.p_finalize);
          setMessage(unsaved.p_finalize
            ? "Finalisasi sebelumnya belum dikonfirmasi. Coba Selesaikan Pengisian kembali."
            : "Draf sebelumnya belum tersimpan. Gunakan Simpan Draf untuk mencoba lagi.");
        }
        const nextAnswers = {};

        for (const item of state.answers || []) {
          if (
            typeof item.completed === "boolean"
          ) {
            nextAnswers[item.activity_id] =
              item.completed;
          }
        }

        draft.current = {
          answers: nextAnswers,
          activities: activityResult.data || [],
          haid: {
            is_female: state.is_female === true,
            is_haid: state.is_haid === true,
            quran_exempt_when_haid: state.quran_exempt_when_haid === true,
          },
        };
        setAnswers(nextAnswers);
        setActivities(activityResult.data || []);

        setHaidInfo({
          is_female: state.is_female === true,
          is_haid: state.is_haid === true,
          quran_exempt_when_haid:
            state.quran_exempt_when_haid === true,
        });

        setDayStatus(
          state.status === "finalized"
            ? "finalized"
            : "draft"
        );

        setError("");
      } catch (caught) {
        if (
          !cancelled &&
          id === requestId.current
        ) {
          setLoadFailed(true);
          setError(
            caught?.message ||
              "Gagal memuat Mutabaah."
          );
        }
      } finally {
        window.clearTimeout(readTimer);
        if (
          !cancelled &&
          id === requestId.current
        ) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
      window.clearTimeout(readTimer);
      alive.current = false;
      window.clearTimeout(timer.current);
      // Persist the latest old scope on navigation, never the new student's/date's state.
      if (dirty.current && !finalizingRef.current && !finalAttempt.current && queuedVersion.current < version.current && draft.current) {
        void enqueueParentDaySave(buildDayPayload(studentId, selectedDate, draft.current, false), editorOwner.current).catch(() => {});
      }
      requestId.current += 1;
    };
  }, [
    studentId,
    selectedDate,
    loadRevision,
  ]);

  useEffect(() => {
    if (!confirmOpen) return undefined;

    function onKey(event) {
      if (
        event.key === "Escape" &&
        !finalizingRef.current
      ) {
        setConfirmOpen(false);
      }
    }

    window.addEventListener("keydown", onKey);

    return () =>
      window.removeEventListener(
        "keydown",
        onKey
      );
  }, [confirmOpen]);

  const visibleActivities = useMemo(() => {
    const weekday = isoWeekday(selectedDate);

    return activities.filter(
      (activity) =>
        !isExcluded(
          activity,
          haidInfo.is_female &&
            haidInfo.is_haid,
          haidInfo.quran_exempt_when_haid,
          weekday
        )
    );
  }, [
    activities,
    haidInfo,
    selectedDate,
  ]);

  const groups = useMemo(() => {
    const result = new Map();

    for (const activity of visibleActivities) {
      const category =
        activity.category || "lainnya";

      if (!result.has(category)) {
        result.set(category, {
          title:
            CATEGORY_NAMES[category] ||
            "Lainnya",
          items: [],
        });
      }

      result
        .get(category)
        .items.push(activity);
    }

    return [...result.entries()];
  }, [visibleActivities]);

  const filledCount = visibleActivities.filter(
    (activity) =>
      typeof answers[activity.id] === "boolean"
  ).length;

  const emptyCount =
    visibleActivities.length - filledCount;

  const haidExcludedCount = activities.filter(
    (activity) =>
      activity.allowed_weekdays
        ?.map(Number)
        .includes(isoWeekday(selectedDate)) &&
      isExcluded(
        activity,
        haidInfo.is_female &&
          haidInfo.is_haid,
        haidInfo.quran_exempt_when_haid,
        isoWeekday(selectedDate)
      )
  ).length;

  function scheduleSave(next) {
    finalAttempt.current = false;
    setFinalizeFailed(false);
    draft.current = next;
    version.current += 1;
    dirty.current = true;
    setError("");
    setMessage("Menunggu penyimpanan otomatis…");
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => { void saveDay(false); }, 800);
  }

  function changeAnswer(activityId, value) {
    if (!editable || finalizingRef.current || !draft.current) return;
    const next = { ...draft.current.answers };
    if (next[activityId] === value) delete next[activityId];
    else next[activityId] = value;
    setAnswers(next);
    scheduleSave({ ...draft.current, answers: next });
  }

  function changeHaid(value) {
    if (!editable || finalizingRef.current || !draft.current ||
        draft.current.haid.is_haid === value) return;
    const nextAnswers = { ...draft.current.answers };
    const haid = { ...draft.current.haid, is_haid: value };
    if (value) {
      for (const activity of draft.current.activities) {
        if (isExcluded(activity, true, haid.quran_exempt_when_haid, isoWeekday(selectedDate))) {
          delete nextAnswers[activity.id];
        }
      }
    }
    setAnswers(nextAnswers);
    setHaidInfo(haid);
    scheduleSave({ ...draft.current, answers: nextAnswers, haid });
  }

  async function saveDay(finalize) {
    if (loading || !editable || !draft.current || finalizingRef.current) return;
    if (!finalize && (!dirty.current || finalAttempt.current)) return;
    if (!finalize && queuedVersion.current === version.current && savePromise.current) {
      return savePromise.current.catch(() => {});
    }
    window.clearTimeout(timer.current);
    const savedVersion = version.current;
    const payload = buildDayPayload(studentId, selectedDate, draft.current, finalize);
    if (finalize) {
      finalAttempt.current = true;
      setFinalizeFailed(false);
      finalizingRef.current = true;
      setFinalizing(true);
      // Tetap tampilkan dialog saat menunggu respons server; jika gagal
      // pengguna dapat mencoba lagi, tanpa kehilangan seluruh jawabannya.
    }
    queuedVersion.current = savedVersion;
    setSaving(true);
    setError("");
    setMessage(finalize ? "Menyelesaikan pengisian…" : "Menyimpan draf…");
    const binding = editorOwner.current;
    const task = enqueueParentDaySave(payload, binding);
    savePromise.current = task;
    const pendingNotice = window.setTimeout(() => {
      if (alive.current && savePromise.current === task && isParentDayOwnerCurrent(binding)) {
        setMessage("");
        setError(finalize
          ? "Finalisasi masih menunggu konfirmasi server. Jangan tutup pengisian."
          : "Draf masih menunggu konfirmasi server. Jangan tutup pengisian.");
      }
    }, 15000);
    try {
      const data = await task;
      if (finalize) finalAttempt.current = false;
      if (!alive.current || !isParentDayOwnerCurrent(binding)) return;
      setDayStatus(finalize ? "finalized" : "draft");
      if (savedVersion === version.current) {
        setError("");
        dirty.current = false;
        setMessage(finalize
          ? Number(data.auto_filled || 0) > 0
            ? "Berhasil difinalisasi. " + data.auto_filled + " jawaban yang kosong dicatat sebagai Tidak."
            : "Mutabaah berhasil difinalisasi."
          : "Draf tersimpan otomatis.");
      }
      callbacks.current.onSaved?.();
      window.dispatchEvent(new Event("mutabaah:saved"));
      if (finalize) {
        // Hydrate auto-filled answers only while editing is locked.
        const { data: state, error: readError } = await supabase.rpc(
          "get_parent_mutabaah_day_state", { p_student_id: studentId, p_date: selectedDate }
        );
        if (readError && alive.current && isParentDayOwnerCurrent(binding)) {
          setError("Finalisasi sudah tersimpan, tetapi jawaban belum dapat dimuat ulang. Buka kembali halaman ini.");
        }
        if (!readError && alive.current && isParentDayOwnerCurrent(binding)) {
          const next = {};
          for (const item of state?.answers || []) {
            if (typeof item.completed === "boolean") next[item.activity_id] = item.completed;
          }
          draft.current = { ...draft.current, answers: next };
          setAnswers(next);
        }
        setConfirmOpen(false);
        callbacks.current.onFinalized?.();
      }
    } catch (caught) {
      if (alive.current && isParentDayOwnerCurrent(binding) && savedVersion === version.current) {
        dirty.current = true;
        if (finalize) setFinalizeFailed(true);
        queuedVersion.current = -1;
        setMessage("");
        setError((finalize ? "Finalisasi belum dapat dikonfirmasi. Gunakan Selesaikan Pengisian untuk mencoba lagi. " : "Draf belum tersimpan. ") +
          (caught?.message || "Periksa koneksi lalu coba lagi."));
      }
    } finally {
      window.clearTimeout(pendingNotice);
      if (savePromise.current === task) {
        savePromise.current = null;
        if (alive.current) setSaving(false);
      }
      if (finalize && isParentDayOwnerCurrent(binding)) {
        finalizingRef.current = false;
        if (alive.current) setFinalizing(false);
      }
    }
  }

  useEffect(() => {
    function retryOnline() {
      if (dirty.current && !finalizingRef.current && !finalAttempt.current) void saveDay(false);
    }
    window.addEventListener("online", retryOnline);
    return () => window.removeEventListener("online", retryOnline);
  });

  if (!studentId) return null;

  if (loading) {
    return (
      <div className="daily-loading">
        Memuat kegiatan...
      </div>
    );
  }

  if (loadFailed) return (
    <div className="daily-error" role="alert">
      <p>{error || "Kegiatan belum dapat dimuat."}</p>
      <button type="button" className="daily-save" onClick={() => setLoadRevision(value => value + 1)}>
        Muat Ulang
      </button>
    </div>
  );

  return (
    <div className="daily-root">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <strong
          style={{
            color: "#176144",
            fontSize: 13,
          }}
        >
          {dayStatus === "finalized"
            ? "Sudah Difinalisasi"
            : "Draf"}
        </strong>

        {dayStatus === "finalized" &&
          editable && (
            <small
              style={{
                color: "#60796b",
              }}
            >
              Dapat diedit kembali
            </small>
          )}
      </div>

      {haidInfo.is_female && (
        <section className="daily-group">
          <h2>Kondisi Ibadah</h2>

          <div className="daily-item">
            <span className="daily-item-title">
              Sedang haid
            </span>

            <div
              className="daily-choices"
              role="group"
              aria-label="Kondisi haid"
            >
              <button
                type="button"
                className={
                  haidInfo.is_haid
                    ? "selected yes"
                    : ""
                }
                aria-pressed={haidInfo.is_haid}
                disabled={!editable || finalizing}
                onClick={() =>
                  changeHaid(true)
                }
              >
                Ya
              </button>

              <button
                type="button"
                className={
                  !haidInfo.is_haid
                    ? "selected no"
                    : ""
                }
                aria-pressed={
                  !haidInfo.is_haid
                }
                disabled={!editable || finalizing}
                onClick={() =>
                  changeHaid(false)
                }
              >
                Tidak
              </button>
            </div>
          </div>

          {haidInfo.is_haid &&
            haidExcludedCount > 0 && (
              <p
                style={{
                  margin: "8px 0 0",
                  fontSize: 12,
                  color: "#687d70",
                }}
              >
                {haidExcludedCount} kegiatan
                tidak perlu diisi saat haid.
              </p>
            )}
        </section>
      )}

      <div className="daily-progress">
        <strong>
          {filledCount}/{visibleActivities.length}
        </strong>
        <span>Terisi</span>
      </div>

      {groups.map(([category, group]) => (
        <section
          className="daily-group"
          key={category}
        >
          <h2>{group.title}</h2>

          <div className="daily-items">
            {group.items.map((activity) => {
              const answer =
                answers[activity.id];

              const label =
                activity.code === "sedekah"
                  ? "Sedekah Jumat"
                  : activity.title;

              return (
                <div
                  className="daily-item"
                  key={activity.id}
                >
                  <span className="daily-item-title">
                    {label}

                    {activity.scoring_mode ===
                      "bonus" && (
                      <small
                        style={{
                          display: "block",
                          color: "#7b927f",
                          fontSize: 10,
                        }}
                      >
                        Kegiatan tambahan
                      </small>
                    )}
                  </span>

                  <div
                    className="daily-choices"
                    role="group"
                    aria-label={label}
                  >
                    {[true, false].map(
                      (value) => (
                        <button
                          type="button"
                          key={String(value)}
                          className={
                            answer === value
                              ? `selected ${
                                  value
                                    ? "yes"
                                    : "no"
                                }`
                              : ""
                          }
                          aria-pressed={
                            answer === value
                          }
                          disabled={
                            !editable || finalizing
                          }
                          onClick={() =>
                            changeAnswer(
                              activity.id,
                              value
                            )
                          }
                        >
                          {value ? "Ya" : "Tidak"}
                        </button>
                      )
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}

      {!visibleActivities.length && (
        <p className="daily-loading">
          Tidak ada kegiatan yang perlu diisi.
        </p>
      )}

      {!editable && (
        <p className="daily-error">
          Tanggal ini di luar batas
          pengisian/edit 30 hari terakhir.
        </p>
      )}

      {error && (
        <p className="daily-error" role="alert">
          {error}
        </p>
      )}

      {message && (
        <p className="daily-success" role="status">
          {message}
        </p>
      )}

      {visibleActivities.length > 0 &&
        editable && (
          <div
            className="daily-footer"
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 10,
            }}
          >
            <button
              type="button"
              className="daily-save"
              disabled={saving || finalizing || finalizeFailed}
              onClick={() =>
                void saveDay(false)
              }
              style={{
                flex: "1 1 135px",
                background: "#e7f2eb",
                color: "#185c40",
              }}
            >
              {saving
                ? "Menyimpan..."
                : error && !finalizeFailed ? "Coba Simpan Draf" : "Simpan Draf"}
            </button>

            <button
              type="button"
              className="daily-save"
              disabled={finalizing}
              onClick={() =>
                setConfirmOpen(true)
              }
              style={{
                flex: "1 1 135px",
              }}
            >
              {finalizing
                ? "Memproses..."
                : "Selesaikan Pengisian"}
            </button>
          </div>
        )}

      {confirmOpen && (
        <div
          style={modalBackdrop}
          role="presentation"
          onMouseDown={(event) => {
            if (
              event.target ===
                event.currentTarget &&
              !finalizing
            ) {
              setConfirmOpen(false);
            }
          }}
        >
          <section
            style={modalCard}
            role="dialog"
            aria-modal="true"
            aria-labelledby="finalize-title"
          >
            <h3
              id="finalize-title"
              style={{
                fontSize: 18,
                color: "var(--mut-ui-accent,#175d42)",
                margin: "0 0 12px",
              }}
            >
              Finalisasi Mutabaah
            </h3>

            <p
              style={{
                margin: "0 0 20px",
                fontSize: 13,
                lineHeight: 1.65,
                color: "var(--mut-ui-muted,#526b5b)",
              }}
            >
              {emptyCount > 0
                ? `Ada ${emptyCount} kegiatan yang belum dijawab. Jawaban yang kosong akan dicatat sebagai Tidak. Lanjutkan?`
                : "Simpan dan finalisasi pengisian Mutabaah untuk tanggal ini?"}
            </p>

            {error&&<p role="alert" style={{color:"#a33c43",fontSize:12,lineHeight:1.55}}>{error}</p>}
            <div
              style={{
                display: "flex",
                gap: 10,
                justifyContent: "flex-end",
              }}
            >
              <button
                type="button"
                disabled={finalizing}
                onClick={() =>
                  setConfirmOpen(false)
                }
                style={{
                  padding: "11px 15px",
                  background: "var(--mut-ui-soft,#f4f8f5)",
                  border:
                    "1px solid #c9dfd0",
                  borderRadius: 9,
                  color: "var(--mut-ui-text,#25553a)",
                }}
              >
                Batal
              </button>

              <button
                type="button"
                disabled={finalizing}
                onClick={() =>
                  void saveDay(true)
                }
                style={{
                  padding: "11px 16px",
                  border: 0,
                  borderRadius: 9,
                  background: "var(--mut-ui-accent,#087e5d)",
                  color: "white",
                  fontWeight: 700,
                }}
              >
                {finalizing
                  ? "Memproses..."
                  : "Ya, Finalisasi"}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

export default function ParentDaily(props) {
  return <DailyEditor key={props.studentId + ":" + props.selectedDate} {...props} />;
}
