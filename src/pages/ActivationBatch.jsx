import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import AppConfirmDialog from "../components/AppConfirmDialog";
import "./ActivationBatch.css";

const LABEL = {
  ready: "Perlu dibuat",
  active: "Kode aktif",
  linked: "Akun terhubung",
  needs_link: "Akun sudah ada",
  incomplete: "Kontak belum lengkap",
};
const RELATIONSHIP = { father: "Ayah", mother: "Ibu", guardian: "Wali" };

function errorText(error) {
  return error?.message || "Permintaan belum berhasil. Coba lagi.";
}

function ActivationBatchPanel({ isTeacher = false }) {
  const [classes, setClasses] = useState([]);
  const [classId, setClassId] = useState("");
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [loadingRows, setLoadingRows] = useState(false);
  const [rows, setRows] = useState([]);
  const [refresh, setRefresh] = useState(0);
  const [busy, setBusy] = useState(false);
  const [confirmAll, setConfirmAll] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let alive = true;
    async function loadClasses() {
      try {
        const { data, error: queryError } = await supabase.rpc("get_mutabaah_accessible_classes");
        if (queryError) throw queryError;
        if (!alive) return;
        const unique = [...new Map((data || []).map((item) => [item.class_id, item])).values()];
        setClasses(unique);
        setClassId(isTeacher ? (unique[0]?.class_id || "") : "all");
      } catch (caught) {
        if (alive) setError(errorText(caught));
      } finally {
        if (alive) setLoadingClasses(false);
      }
    }
    void loadClasses();
    return () => { alive = false; };
  }, [isTeacher]);

  const loadRows = useCallback(async (signal) => {
    const request = supabase.rpc("list_parent_activation_batch", {
      p_class_id: classId === "all" ? null : classId,
    });
    const { data, error: queryError } = await (signal ? request.abortSignal(signal) : request);
    if (queryError) throw queryError;
    if (!Array.isArray(data)) throw new Error("Format daftar aktivasi tidak sesuai.");
    if (data.length >= 1000) {
      throw new Error("Daftar terlalu panjang. Pilih satu kelas agar data tidak terpotong.");
    }
    return data;
  }, [classId]);

  useEffect(() => {
    if (!classId || loadingClasses) return undefined;
    let alive = true;
    const controller = new AbortController();
    const start = window.setTimeout(() => {
      void (async () => {
        setLoadingRows(true);
        setError("");
        try {
          const result = await loadRows(controller.signal);
          if (alive) setRows(result);
        } catch (caught) {
          if (alive && !controller.signal.aborted) {
            setError(errorText(caught));
            setRows([]);
          }
        } finally {
          if (alive) setLoadingRows(false);
        }
      })();
    }, 0);
    return () => {
      alive = false;
      controller.abort();
      window.clearTimeout(start);
    };
  }, [classId, loadingClasses, loadRows, refresh]);

  const summary = useMemo(() => rows.reduce((counts, item) => {
    if (item.code_state in counts) counts[item.code_state] += 1;
    return counts;
  }, { ready: 0, active: 0, linked: 0, needs_link: 0, incomplete: 0 }), [rows]);

  const displayedClasses = useMemo(() => {
    const groups = new Map();
    for (const item of rows) {
      if (item.code_state === "incomplete" || item.code_state === "linked") continue;
      const className = item.class_name || "Tanpa Kelas";
      if (!groups.has(className)) groups.set(className, []);
      groups.get(className).push(item);
    }
    const collator = new Intl.Collator("id",{numeric:true,sensitivity:"base"});
    return [...groups.entries()].sort((a,b)=>collator.compare(a[0],b[0]));
  }, [rows]);
  const selectedClass = classes.find((item) => item.class_id === classId)?.class_name || "semua-kelas";
  const buttonsDisabled = loadingRows || busy || loadingClasses;
  const readyCount = summary.ready;
  const printableCount = summary.active;

  async function issue(student = null) {
    if (busy || loadingRows || !classId) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const { data, error: problem } = await supabase.rpc("issue_parent_activation_batch", {
        p_class_id: classId === "all" ? null : classId,
        p_student_id: student?.student_id || null,
        p_relationship: student?.relationship || null,
      });
      if (problem) throw problem;
      if (!data || typeof data.created !== "number") {
        throw new Error("Hasil pembuatan kode tidak dikenali.");
      }
      const latest = await loadRows();
      setRows(latest);
      setConfirmAll(false);
      setNotice(data.created > 0
        ? String(data.created) + " kode baru dibuat. Kode valid sebelumnya tetap dipertahankan."
        : "Tidak ada kode baru yang diperlukan. Kode valid dan akun aktif tidak berubah.");
      setRefresh((old) => old + 1);
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setBusy(false);
    }
  }

  async function downloadPdf() {
    if (buttonsDisabled || !classId) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      // Baca ulang dari server sebelum mencetak: kode yang telah dipakai tidak ikut tercetak.
      const latest = await loadRows();
      setRows(latest);
      const { downloadActivationCardsPdf } = await import("../lib/activationCardsPdf");
      const total = await downloadActivationCardsPdf(latest, selectedClass);
      setNotice(String(total) + " kartu disiapkan dalam PDF A4 (12 kartu per halaman).");
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="activation-batch" aria-label="Aktivasi akun orang tua">
      <div className="activation-batch-heading">
        <div>
          <h2>Aktivasi Orang Tua</h2>
          <p>Periksa kode yang sudah tersedia, buat yang masih diperlukan, lalu cetak kartu untuk dibagikan.</p>
        </div>
        <span className="activation-batch-size">12 kartu / A4</span>
      </div>

      <div className="activation-batch-controls">
        <label>
          <span>Kelas</span>
          <select
            value={classId}
            disabled={loadingClasses || busy}
            onChange={(event) => {
              setRows([]);
              setError("");
              setNotice("");
              setClassId(event.target.value);
            }}
          >
            {!isTeacher && <option value="all">Semua kelas</option>}
            {isTeacher && !classes.length && <option value="">Belum ada kelas</option>}
            {classes.map((item) => (
              <option value={item.class_id} key={item.class_id}>
                {item.class_name} · {item.academic_year}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="activation-batch-ghost"
          disabled={buttonsDisabled || !classId}
          onClick={() => setRefresh((old) => old + 1)}
        >Periksa Kode</button>
      </div>

      <div className="activation-batch-summary" aria-label="Ringkasan aktivasi">
        <div><strong>{summary.ready}</strong><span>Perlu kode</span></div>
        <div><strong>{summary.active}</strong><span>Kode aktif</span></div>
        <div><strong>{summary.linked}</strong><span>Akun terhubung</span></div>
        <div><strong>{summary.needs_link}</strong><span>Akun perlu dihubungkan</span></div>
      </div>

      <div className="activation-batch-actions">
        <button type="button" className="activation-batch-primary" disabled={buttonsDisabled || !readyCount}
          onClick={() => setConfirmAll(true)}
        >Buat Kode Massal ({readyCount})</button>
        <button type="button" className="activation-batch-ghost" disabled={buttonsDisabled || !printableCount}
          onClick={() => void downloadPdf()}
        >Unduh Kartu Aktivasi (PDF)</button>
      </div>
      <p className="activation-batch-help">
        Kode aktif tidak diganti. Akun yang sudah aktif dilewati. QR pada seluruh kartu sama;
        setelah memindai, pilih <strong>Aktivasi Akun</strong> di situs Mutabaah.
      </p>
      {loadingRows && <p className="activation-batch-help" role="status">Memeriksa data aktivasi...</p>}
      {busy && <p className="activation-batch-help" role="status">Memproses permintaan...</p>}
      {error && <p className="activation-batch-error" role="alert">{error}</p>}
      {notice && <p className="activation-batch-success" role="status">{notice}</p>}

      {!loadingRows && !loadingClasses && displayedClasses.length === 0 ? (
        <p className="activation-batch-empty">
          {classId ? "Tidak ada kode yang perlu dibuat atau dikelola di kelas ini." : "Wali kelas belum memiliki penugasan kelas."}
        </p>
      ) : (
        <div className="activation-batch-table-wrap">
          <table className="activation-batch-table">
            <thead>
              <tr>
                <th>Siswa / Kelas</th>
                <th>Orang Tua / Wali</th>
                <th>Kode</th>
                <th>Status</th>
                <th>Tindakan</th>
              </tr>
            </thead>
              {displayedClasses.map(([groupName, groupRows]) => (
                <tbody key={groupName}>
                  <tr className="activation-batch-class-heading"><th colSpan={5} scope="rowgroup">{groupName}</th></tr>
                  {groupRows.map((item) => (
                <tr key={item.student_id + "-" + item.relationship}>
                  <td><strong>{item.student_name}</strong><small>{item.class_name}</small></td>
                  <td>{item.contact_name}<small>{RELATIONSHIP[item.relationship] || "Wali"} · {item.phone || "Belum ada nomor HP"}</small></td>
                  <td>{item.code_state === "active" ? (
                    <strong className="activation-batch-code">{item.activation_code}</strong>
                  ) : "—"}</td>
                  <td><span className={"activation-batch-state state-" + item.code_state}>
                    {LABEL[item.code_state] || "Periksa"}
                  </span></td>
                  <td>{item.code_state === "ready" ? (
                    <button type="button" className="activation-batch-row-button"
                      disabled={buttonsDisabled} onClick={() => void issue(item)}
                    >Buat Kode</button>
                  ) : item.code_state === "needs_link" ? (
                    <small>Akun perlu dihubungkan ke siswa</small>
                  ) : "—"}</td>
                </tr>
                  ))}
                </tbody>
              ))}
          </table>
        </div>
      )}

      {confirmAll && <AppConfirmDialog
        title={`Buat ${readyCount} Kode Aktivasi?`}
        description="Hanya kontak yang membutuhkan kode akan diproses. Kode yang masih valid dan akun aktif tidak berubah."
        confirmLabel="Ya, Buat Kode" busy={busy} error={error}
        onCancel={()=>{setConfirmAll(false);setError("");}}
        onConfirm={()=>void issue()}
      />}
    </section>
  );
}

export default function ActivationBatch({ isTeacher = false }) {
  const [open, setOpen] = useState(Boolean(isTeacher));
  return (
    <div className="activation-batch-shell">
      {!isTeacher && <button className="activation-batch-toggle" type="button"
        aria-expanded={open} onClick={()=>setOpen(previous=>!previous)}>
        <span>Aktivasi Akun Massal</span>
        <small>{open ? "Tutup pengelolaan kode" : "Buka untuk membuat atau mencetak kode"}</small>
        <span className="activation-batch-chevron" aria-hidden="true">{open ? "⌃" : "⌄"}</span>
      </button>}
      {open && <ActivationBatchPanel isTeacher={isTeacher}/>}
    </div>
  );
}
