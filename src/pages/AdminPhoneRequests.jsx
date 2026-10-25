import { useCallback, useState } from "react";
import { supabase } from "../lib/supabase";
import { PAGE_SIZE } from "../lib/pagination";
import usePagedQuery from "../lib/usePagedQuery";
import Pagination from "../components/Pagination";
import "./ParentPhoneChange.css";

// Seluruh identitas berasal dari relasi yang sudah dilindungi RLS Admin.
// Satu query per halaman mencegah permintaan N+1 dan menjaga pagination.
const PHONE_REQUEST_SELECT = [
  "id,old_phone,new_phone,created_at,status,guardian_id,",
  "guardian:profiles!parent_phone_change_requests_guardian_id_fkey(",
  "full_name,",
  "student_guardians(",
  "relationship,",
  "student:students!student_guardians_student_id_fkey(",
  "id,full_name,student_enrollments(",
  "starts_on,ends_on,class:classes!student_enrollments_class_id_fkey(name)",
  ")",
  ")",
  ")",
  ")",
].join("");

const RELATIONSHIP_LABELS = {
  father: "Ayah",
  mother: "Ibu",
  guardian: "Wali",
};

function guardianName(item) {
  return item.guardian?.full_name?.trim() || "Nama wali belum tersedia";
}

function linkedStudents(item) {
  const relations = item.guardian?.student_guardians || [];
  return relations
    .filter((relation) => relation.student?.id)
    .map(({ student, relationship }) => {
      const enrollment = (student.student_enrollments || [])
        .filter((entry) => !entry.ends_on && entry.class?.name)
        .sort((a, b) => (b.starts_on || "").localeCompare(a.starts_on || ""))[0];

      return {
        id: student.id,
        name: student.full_name?.trim() || "Nama siswa belum tersedia",
        className: enrollment?.class?.name || "",
        relationship: RELATIONSHIP_LABELS[relationship] || "Wali",
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "id"));
}

function formatRequestDate(value) {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(new Date(value));
}

function RelatedStudents({ students }) {
  return students.length ? (
    <ul className="phone-request-student-list">
      {students.map((student) => (
        <li key={student.id}>
          {student.name}
          {student.className && <span> · Kelas {student.className}</span>}
          <span className="phone-request-relationship"> ({student.relationship})</span>
        </li>
      ))}
    </ul>
  ) : (
    <span className="phone-request-unknown">
      Data siswa yang terhubung belum tersedia. Periksa identitas wali sebelum menyetujui.
    </span>
  );
}

export default function AdminPhoneRequests({ onChanged }) {
  const [page, setPage] = useState(0);
  const [refresh, setRefresh] = useState(0);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState("");
  const [dialog, setDialog] = useState(null);

  const query = useCallback((signal) => supabase.from("parent_phone_change_requests")
    .select(PHONE_REQUEST_SELECT, { count: "exact" })
    .eq("status", "pending").order("created_at", { ascending: false }).order("id")
    .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1).abortSignal(signal), [page]);

  const phonePage = usePagedQuery(query, page, setPage, 0, 30000, refresh);
  const requests = phonePage.data;

  async function load() {
    setRefresh((value) => value + 1);
    onChanged?.();
  }

  async function decide() {
    if (!dialog || busy) return;
    setBusy(dialog.id);
    setError("");
    setMessage("");
    try {
      const { data, error: problem } = await supabase.functions.invoke("parent-phone-change", {
        body: { action: "review", request_id: dialog.id, approve: dialog.approve },
      });
      if (problem) {
        let detail = problem.message;
        try { detail = (await problem.context?.json())?.error || detail; } catch { /* bukan JSON */ }
        throw new Error(detail);
      }
      if (!data?.success) throw new Error(data?.error || "Keputusan gagal disimpan.");
      setMessage(dialog.approve ? "Nomor HP wali berhasil diganti." : "Permohonan ditolak.");
      setDialog(null);
      await load();
    } catch (caught) {
      setError(caught.message || "Gagal memproses permohonan.");
    } finally {
      setBusy("");
    }
  }

  const pending = requests.filter((item) => item.status === "pending");

  return (
    <section className="phone-panel">
      <h2>Permohonan Ganti Nomor HP</h2>
      <p>Periksa identitas wali, siswa terkait, dan kedua nomor sebelum memberikan keputusan.</p>

      {phonePage.loading ? (
        <p>Memuat permohonan...</p>
      ) : pending.length === 0 ? (
        <p>Belum ada permohonan menunggu persetujuan.</p>
      ) : (
        <div className="phone-request-list">
          {pending.map((item) => {
            const students = linkedStudents(item);
            return (
              <article className="phone-request" key={item.id}>
                <div className="phone-request-info">
                  <div className="phone-request-identity">
                    <span className="phone-field-label">Nama wali murid</span>
                    <strong className="phone-request-name">{guardianName(item)}</strong>
                  </div>
                  <div className="phone-request-students">
                    <span className="phone-field-label">Siswa terkait</span>
                    <RelatedStudents students={students} />
                  </div>
                  <div className="phone-request-phones">
                    <div>
                      <span className="phone-field-label">Nomor lama</span>
                      <strong>{item.old_phone}</strong>
                    </div>
                    <span className="phone-request-arrow" aria-hidden="true">→</span>
                    <div>
                      <span className="phone-field-label">Nomor baru</span>
                      <strong>{item.new_phone}</strong>
                    </div>
                  </div>
                  <small>Diajukan {formatRequestDate(item.created_at)} WIB</small>
                </div>
                {error && <p className="phone-error" role="alert">{error}</p>}
            <div className="phone-actions">
                  <button type="button" disabled={Boolean(busy)} onClick={() => setDialog({ ...item, approve: false })}>Tolak</button>
                  <button type="button" disabled={Boolean(busy)} onClick={() => setDialog({ ...item, approve: true })}>Setujui</button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <Pagination page={page} total={phonePage.total} loading={phonePage.loading || Boolean(busy)} onChange={setPage} />
      {phonePage.error && <p role="alert" className="phone-error">{phonePage.error}</p>}
      {message && <p role="status" className="phone-success">{message}</p>}
      {error && <p role="alert" className="phone-error">{error}</p>}

      {dialog && (
        <div className="phone-overlay">
          <div className="phone-dialog" role="dialog" aria-modal="true" aria-labelledby="phone-title">
            <h3 id="phone-title">{dialog.approve ? "Setujui perubahan?" : "Tolak perubahan?"}</h3>
            <div className="phone-dialog-summary">
              <span className="phone-field-label">Nama wali murid</span>
              <strong>{guardianName(dialog)}</strong>
              <span className="phone-field-label">Siswa terkait</span>
              <RelatedStudents students={linkedStudents(dialog)} />
              <div><span>Nomor lama:</span> <strong>{dialog.old_phone}</strong></div>
              <div><span>Nomor baru:</span> <strong>{dialog.new_phone}</strong></div>
            </div>
            {dialog.approve && (
              <p className="phone-verification-note">
                Pastikan identitas wali dan siswa sesuai sebelum nomor login diganti.
              </p>
            )}
            <div className="phone-actions">
              <button type="button" disabled={Boolean(busy)} onClick={() => setDialog(null)}>Batal</button>
              <button type="button" autoFocus disabled={Boolean(busy)} onClick={() => void decide()}>
                {busy ? "Memproses…" : "Ya, Konfirmasi"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
