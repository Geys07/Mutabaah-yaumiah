import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { staffPage } from "../lib/teacherPagination";
import usePagedQuery from "../lib/usePagedQuery";
import Pagination from "../components/Pagination";
import "./TeacherAccounts.css";
import EmptyState from "../components/EmptyState";

const INITIAL_STAFF_PASSWORD = "123456";
const BLANK = {
  full_name: "", username: "", phone: "",
  active: true,
};
function normalizePhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  return digits.startsWith("62") ? `0${digits.slice(2)}` : digits;
}
async function errorMessage(error) {
  if (error?.context) {
    try {
      const data = await error.context.json();
      return data?.error || data?.message || error.message;
    } catch { /* Gunakan pesan default */ }
  }
  if (error?.code === "23505") return "Nama pengguna atau nomor HP sudah dipakai.";
  return error?.message || "Permintaan gagal.";
}

export default function TeacherAccounts({ role = "homeroom_teacher" }) {
  const isPrincipal = role === "principal";
  const roleLabel = isPrincipal ? "Kepala Madrasah" : "Guru";
  const [page,setPage] = useState(0);
  const [search,setSearch] = useState("");
  const [refresh,setRefresh] = useState(0);
  const [modal,setModal] = useState("");
  const [editingId,setEditingId] = useState("");
  const [form,setForm] = useState(BLANK);
  const [saving,setSaving] = useState(false);
  const [formError,setFormError] = useState("");
  const [notice,setNotice] = useState("");
  const load = useCallback((signal) => staffPage(supabase,search,page,signal,role),[search,page,role]);
  const accounts = usePagedQuery(load,page,setPage,200,0,refresh);
  const rows = accounts.data || [];

  const closeModal = useCallback(() => {
    if (saving) return;
    setModal("");
    setEditingId("");
    setForm({ ...BLANK });
    setFormError("");
  }, [saving]);
  useEffect(() => {
    if (!modal) return undefined;
    function escape(e) { if (e.key === "Escape") closeModal(); }
    window.addEventListener("keydown",escape);
    return () => window.removeEventListener("keydown",escape);
  }, [modal,closeModal]);

  function openCreate() {
    setEditingId("");
    setForm({ ...BLANK });
    setFormError("");
    setNotice("");
    setModal("create");
  }
  function openEdit(person) {
    setEditingId(person.user_id);
    setForm({
      full_name: person.full_name || "",
      username: person.username || "",
      phone: person.phone || "",
      active: person.account_status === "active",
    });
    setFormError("");
    setNotice("");
    setModal("edit");
  }
  function updateField(field,value) {
    setForm((old) => ({ ...old, [field]:value }));
    setFormError("");
  }

  async function saveAccount(event) {
    event.preventDefault();
    if (saving) return;
    const name = form.full_name.trim().replace(/\s+/g," ");
    const username = form.username.trim().toLowerCase();
    const phone = normalizePhone(form.phone);
    if (name.length < 2 || name.length > 150) return setFormError("Nama harus 2–150 karakter.");
    if (!/^[a-z][a-z0-9._-]{3,23}$/.test(username) || username === "admin")
      return setFormError("Nama pengguna: 4–24 karakter, diawali huruf, tidak boleh 'admin'.");
    if (phone && !/^08\d{8,11}$/.test(phone))
      return setFormError("Nomor HP opsional, tetapi jika diisi gunakan 08xxxxxxxxxx.");

    setSaving(true);
    setFormError("");
    setNotice("");
    try {
      if (modal === "create") {
        const {data,error} = await supabase.functions.invoke("create-teacher-account", {
          body: { role, full_name:name, username, phone:phone || null, password:INITIAL_STAFF_PASSWORD },
        });
        if (error) throw new Error(await errorMessage(error));
        if (!data?.success) throw new Error(data?.error || "Gagal membuat akun.");
      } else {
        const {error} = await supabase.rpc("manage_staff_account", {
          p_user_id: editingId,
          p_full_name: name,
          p_username: username,
          p_phone: phone || null,
          p_active: form.active,
          p_role: role,
        });
        if (error) throw error;
      }
      setModal("");
      setEditingId("");
      setForm({ ...BLANK });
      setNotice(modal === "create" ? "Akun berhasil dibuat." : "Akun berhasil diperbarui.");
      setRefresh((n) => n + 1);
    } catch(error) { setFormError(await errorMessage(error)); }
    finally { setSaving(false); }
  }

  return (
    <section className="teacher-accounts">
      <header className="teacher-accounts-heading">
        <h2>Akun {roleLabel}</h2>
        <div className="teacher-accounts-toolbar">
          <input type="search" aria-label="Cari akun staf"
            placeholder="Cari nama atau nama pengguna" value={search}
            onChange={(e) => { setPage(0);setSearch(e.target.value); }} />
          <button type="button" className="teacher-accounts-primary" onClick={openCreate}>
            Tambah {roleLabel}
          </button>
        </div>
      </header>
      {notice && <p className="teacher-accounts-success" role="status">{notice}</p>}
      {accounts.error && <p className="teacher-accounts-error" role="alert">{String(accounts.error.message || accounts.error)}</p>}
      {accounts.loading ? <div className="teacher-accounts-empty">Memuat akun…</div>
       : rows.length === 0 ? <EmptyState kind="people" illustration={role === "principal" ? "principal" : "teacher"} title={search ? "Akun tidak ditemukan" : "Belum ada akun"} description={search ? "Coba kata kunci lain." : `Tambahkan akun ${roleLabel} untuk memulai.`} />
       : <div className="teacher-accounts-table-wrap">
           <table>
             <thead><tr><th>Nama</th><th>Nama Pengguna</th><th>Nomor HP</th><th>Status</th><th>Tindakan</th></tr></thead>
             <tbody>
               {rows.map((person) => <tr key={person.user_id}>
                 <td className="teacher-accounts-name">{person.full_name}</td>
                 <td>{person.username || "Belum diatur"}</td>
                 <td>{person.phone || "—"}</td>
                 <td>{person.account_status === "active" ? "Aktif" :
                     person.account_status === "disabled" ? "Nonaktif" : "Menunggu"}</td>
                 <td><button type="button" className="teacher-accounts-secondary"
                     onClick={() => openEdit(person)}>Edit</button></td>
               </tr>)}
             </tbody>
           </table>
         </div>}
      <Pagination page={page} total={accounts.total} loading={accounts.loading} onChange={setPage}/>
      {modal && <div className="teacher-accounts-backdrop"
        onMouseDown={(e) => { if(e.target===e.currentTarget)closeModal(); }}>
        <section className="teacher-accounts-dialog" role="dialog" aria-modal="true"
          aria-labelledby="staff-account-title">
          <h2 id="staff-account-title">{modal === "create" ? "Tambah" : "Edit"} Akun {roleLabel}</h2>
          <form onSubmit={saveAccount}>
            <label className="teacher-accounts-field">
              <span>Nama Lengkap</span>
              <input autoFocus required maxLength={150} disabled={saving}
                value={form.full_name} onChange={(e)=>updateField("full_name",e.target.value)}/>
            </label>
            <label className="teacher-accounts-field">
              <span>Nama Pengguna</span>
              <input type="text" autoComplete="off" autoCapitalize="none" spellCheck={false}
                required minLength={4} maxLength={24} disabled={saving}
                placeholder="contoh: guru_ahmad" value={form.username}
                onChange={(e)=>updateField("username",e.target.value.toLowerCase())}/>
            </label>
            <label className="teacher-accounts-field">
              <span>Nomor HP (opsional)</span>
              <input type="tel" inputMode="numeric" maxLength={17} disabled={saving}
                placeholder="08xxxxxxxxxx" value={form.phone}
                onChange={(e)=>updateField("phone",e.target.value)}/>
            </label>
            {modal === "create" && (
              <p className="teacher-accounts-initial-password" role="note">
                Kata sandi awal otomatis: <strong>123456</strong>. Demi keamanan, segera ganti setelah masuk pertama.
              </p>
            )}
            {modal === "edit" && <label className="teacher-accounts-check">
              <input type="checkbox" checked={form.active} disabled={saving}
                onChange={(e)=>updateField("active",e.target.checked)}/>
              <span>Akun Aktif</span>
            </label>}
            {formError && <p className="teacher-accounts-error" role="alert">{formError}</p>}
            <footer className="teacher-accounts-actions">
              <button className="teacher-accounts-secondary" type="button"
                disabled={saving} onClick={closeModal}>Batal</button>
              <button className="teacher-accounts-primary" type="submit" disabled={saving}>
                {saving ? "Menyimpan…" : modal === "create" ? "Buat Akun" : "Simpan"}
              </button>
            </footer>
          </form>
        </section>
      </div>}
    </section>
  );
}
