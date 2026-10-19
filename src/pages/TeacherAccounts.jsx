
import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { teacherPage } from "../lib/teacherPagination";
import usePagedQuery from "../lib/usePagedQuery";
import Pagination from "../components/Pagination";
import "./TeacherAccounts.css";

function normalizePhone(value) {
  const digits = String(value || "").replace(/\D/g, "");

  if (digits.startsWith("62")) {
    return `0${digits.slice(2)}`;
  }

  return digits;
}

async function getFunctionError(error) {
  if (error?.context) {
    try {
      const response = await error.context.json();
      return response?.error || response?.message || error.message;
    } catch {
      return error?.message || "Terjadi kesalahan server.";
    }
  }

  return error?.message || "Terjadi kesalahan server.";
}

const EMPTY_FORM = {
  full_name: "",
  phone: "",
  password: "",
  confirm_password: "",
  active: true,
};

export default function TeacherAccounts() {
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");

  const [refresh, setRefresh] = useState(0);

  const [modal, setModal] = useState("");
  const [editingId, setEditingId] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);

  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback((signal) => teacherPage(supabase, search, page, signal), [search, page]);
  const accountPage = usePagedQuery(load, page, setPage, 200, 0, refresh);
  const availableAccounts = accountPage.data;
  const loading = accountPage.loading;

  const closeModal = useCallback(() => {
    if (saving) return;

    setModal("");
    setEditingId("");
    setForm({ ...EMPTY_FORM });
    setFormError("");
    setShowPassword(false);
  }, [saving]);

  useEffect(() => {
    if (!modal) return undefined;

    function onKeyDown(event) {
      if (event.key === "Escape" && !saving) {
        closeModal();
      }
    }

    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [modal, saving, closeModal]);

  function openCreate() {
    setEditingId("");
    setModal("create");
    setForm({ ...EMPTY_FORM });
    setShowPassword(false);
    setFormError("");
    setError("");
    setNotice("");
  }

  function openEdit(profile) {
    setEditingId(profile.user_id);
    setModal("edit");
    setForm({
      full_name: profile.full_name || "",
      phone: profile.phone || "",
      password: "",
      confirm_password: "",
      active: profile.account_status === "active",
    });
    setFormError("");
    setError("");
    setNotice("");
  }


  function updateField(field, value) {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));
    setFormError("");
  }

  function reloadAccounts() {
    setError("");
    setRefresh((previous) => previous + 1);
  }

  async function handleCreate(name, phone) {
    const { data, error: invokeError } =
      await supabase.functions.invoke(
        "create-teacher-account",
        {
          body: {
            full_name: name,
            phone,
            password: form.password,
          },
        }
      );

    if (invokeError) {
      throw new Error(await getFunctionError(invokeError));
    }

    if (!data?.success) {
      throw new Error(
        data?.error || "Gagal membuat akun guru."
      );
    }

    return data;
  }

  async function handleEdit(name, phone) {
    const { error: saveError } = await supabase.rpc(
      "manage_existing_teacher",
      {
        p_user_id: editingId,
        p_full_name: name,
        p_phone: phone,
        p_active: form.active,
      }
    );

    if (saveError) {
      throw saveError;
    }
  }

  async function saveAccount(event) {
    event.preventDefault();

    if (saving) return;

    const name = form.full_name
      .trim()
      .replace(/\s+/g, " ");

    const phone = normalizePhone(form.phone);

    if (name.length < 2 || name.length > 150) {
      setFormError("Nama harus terdiri dari 2–150 karakter.");
      return;
    }

    if (!/^08\d{8,11}$/.test(phone)) {
      setFormError(
        "Nomor HP harus menggunakan format 08xxxxxxxxxx."
      );
      return;
    }

    if (modal === "create") {
      if (
        form.password.length < 10 ||
        form.password.length > 72
      ) {
        setFormError(
          "Kata sandi harus terdiri dari 10–72 karakter."
        );
        return;
      }

      if (form.password !== form.confirm_password) {
        setFormError("Konfirmasi kata sandi tidak cocok.");
        return;
      }
    }

    setSaving(true);
    setFormError("");
    setNotice("");

    try {
      if (modal === "create") {
        await handleCreate(name, phone);
      } else {
        await handleEdit(name, phone);
      }

      setModal("");
      setEditingId("");
      setForm({ ...EMPTY_FORM });
      setShowPassword(false);

      setNotice(
        modal === "create"
          ? "Akun guru berhasil dibuat."
          : "Akun guru berhasil diperbarui."
      );

      reloadAccounts();
    } catch (saveError) {
      setFormError(
        saveError.message || "Gagal menyimpan akun guru."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="teacher-accounts">
      <header className="teacher-accounts-heading">
        <h2>Akun Guru</h2>

        <div className="teacher-accounts-toolbar">
          <input
            type="search"
            value={search}
            placeholder="Cari guru atau nomor HP"
            aria-label="Cari guru"
            onChange={(event) => { setPage(0); setSearch(event.target.value); }}
          />

          <button
            type="button"
            className="teacher-accounts-primary"
            onClick={openCreate}
          >
            Tambah Guru
          </button>
        </div>
      </header>

      {notice && (
        <p
          className="teacher-accounts-success"
          role="status"
        >
          {notice}
        </p>
      )}

      {(error || accountPage.error) && (
        <p
          className="teacher-accounts-error"
          role="alert"
        >
          {error || accountPage.error}
        </p>
      )}

      {loading ? (
        <div className="teacher-accounts-empty">
          Memuat...
        </div>
      ) : availableAccounts.length === 0 ? (
        <div className="teacher-accounts-empty">
          Belum ada akun guru.
        </div>
      ) : (
        <div className="teacher-accounts-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nama Guru</th>
                <th>Nomor HP</th>
                <th>Peran</th>
                <th>Status</th>
                <th>Tindakan</th>
              </tr>
            </thead>

            <tbody>
              {availableAccounts.map((profile) => (
                <tr key={profile.user_id}>
                  <td className="teacher-accounts-name">
                    {profile.full_name}
                  </td>

                  <td>{profile.phone || "—"}</td>

                  <td>
                    {profile.isTeacher
                      ? "Wali Kelas"
                      : "Belum Ditentukan"}
                  </td>

                  <td>
                    {profile.account_status === "active"
                      ? "Aktif"
                      : profile.account_status === "disabled"
                        ? "Nonaktif"
                        : "Menunggu"}
                  </td>

                  <td>
                    <button
                      type="button"
                      className="teacher-accounts-secondary"
                      onClick={() => openEdit(profile)}
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination page={page} total={accountPage.total} loading={loading} onChange={setPage} />

      {modal && (
        <div
          className="teacher-accounts-backdrop"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget &&
              !saving
            ) {
              closeModal();
            }
          }}
        >
          <section
            className="teacher-accounts-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="teacher-account-title"
          >
            <h2 id="teacher-account-title">
              {modal === "create"
                ? "Tambah Akun Guru"
                : "Edit Akun Guru"}
            </h2>

            <form onSubmit={saveAccount}>
              <label className="teacher-accounts-field">
                <span>Nama Lengkap</span>

                <input
                  autoFocus
                  required
                  maxLength={150}
                  value={form.full_name}
                  disabled={saving}
                  onChange={(event) =>
                    updateField(
                      "full_name",
                      event.target.value
                    )
                  }
                />
              </label>

              <label className="teacher-accounts-field">
                <span>Nomor HP</span>

                <input
                  type="tel"
                  required
                  maxLength={17}
                  value={form.phone}
                  disabled={saving}
                  placeholder="08xxxxxxxxxx"
                  onChange={(event) =>
                    updateField(
                      "phone",
                      event.target.value
                    )
                  }
                />
              </label>

              {modal === "create" && (
                <>
                  <label className="teacher-accounts-field">
                    <span>Kata Sandi Awal</span>

                    <input
                      type={
                        showPassword
                          ? "text"
                          : "password"
                      }
                      required
                      minLength={10}
                      maxLength={72}
                      autoComplete="new-password"
                      value={form.password}
                      disabled={saving}
                      onChange={(event) =>
                        updateField(
                          "password",
                          event.target.value
                        )
                      }
                    />
                  </label>

                  <label className="teacher-accounts-field">
                    <span>Ulangi Kata Sandi</span>

                    <input
                      type={
                        showPassword
                          ? "text"
                          : "password"
                      }
                      required
                      minLength={10}
                      maxLength={72}
                      autoComplete="new-password"
                      value={form.confirm_password}
                      disabled={saving}
                      onChange={(event) =>
                        updateField(
                          "confirm_password",
                          event.target.value
                        )
                      }
                    />
                  </label>

                  <label className="teacher-accounts-check">
                    <input
                      type="checkbox"
                      checked={showPassword}
                      disabled={saving}
                      onChange={(event) =>
                        setShowPassword(
                          event.target.checked
                        )
                      }
                    />
                    <span>Tampilkan kata sandi</span>
                  </label>
                </>
              )}

              {modal === "edit" && (
                <label className="teacher-accounts-check">
                  <input
                    type="checkbox"
                    checked={form.active}
                    disabled={saving}
                    onChange={(event) =>
                      updateField(
                        "active",
                        event.target.checked
                      )
                    }
                  />
                  <span>Akun Aktif</span>
                </label>
              )}

              {formError && (
                <p
                  className="teacher-accounts-error"
                  role="alert"
                >
                  {formError}
                </p>
              )}

              <footer className="teacher-accounts-actions">
                <button
                  type="button"
                  className="teacher-accounts-secondary"
                  disabled={saving}
                  onClick={closeModal}
                >
                  Batal
                </button>

                <button
                  type="submit"
                  className="teacher-accounts-primary"
                  disabled={saving}
                >
                  {saving
                    ? "Menyimpan..."
                    : modal === "create"
                      ? "Buat Akun"
                      : "Simpan"}
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}
    </section>
  );
}
