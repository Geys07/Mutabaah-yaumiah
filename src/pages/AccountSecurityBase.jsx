
import { useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import "./AccountSecurity.css";

const INITIAL_FORM = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
};

function getErrorMessage(error) {
  return error?.message || "Terjadi kesalahan.";
}

function createVerificationClient() {
  return createClient(
    supabase.supabaseUrl,
    supabase.supabaseKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    }
  );
}

export default function AccountSecurity({ account }) {
  const [form, setForm] = useState(INITIAL_FORM);
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  function updateField(field, value) {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));

    setError("");
    setSuccess("");
  }

  function resetForm() {
    setForm(INITIAL_FORM);
    setShowPassword(false);
  }

  async function verifyCurrentPassword(
    email,
    password,
    expectedUserId
  ) {
    const verificationClient =
      createVerificationClient();

    try {
      const { data, error: verifyError } =
        await verificationClient.auth.signInWithPassword({
          email,
          password,
        });

      if (verifyError) {
        throw new Error(
          "Kata sandi saat ini salah atau tidak dapat diverifikasi."
        );
      }

      if (
        !data?.user ||
        data.user.id !== expectedUserId
      ) {
        throw new Error(
          "Verifikasi akun tidak sesuai. Perubahan dibatalkan."
        );
      }

      return true;
    } finally {
      await verificationClient.auth.signOut({
        scope: "local",
      }).catch(() => {});
    }
  }

  async function handleSave(event) {
    event.preventDefault();

    if (saving) return;

    setError("");
    setSuccess("");

    const {
      currentPassword,
      newPassword,
      confirmPassword,
    } = form;

    if (!currentPassword) {
      setError("Masukkan kata sandi saat ini.");
      return;
    }

    if (
      newPassword.length < 10 ||
      newPassword.length > 72
    ) {
      setError(
        "Kata sandi baru harus terdiri dari 10–72 karakter."
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      setError(
        "Konfirmasi kata sandi baru tidak cocok."
      );
      return;
    }

    if (currentPassword === newPassword) {
      setError(
        "Kata sandi baru harus berbeda dari kata sandi lama."
      );
      return;
    }

    setSaving(true);

    try {
      const { data, error: userError } =
        await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      const currentUser = data?.user;

      if (
        !currentUser?.id ||
        !currentUser?.email
      ) {
        throw new Error(
          "Sesi login tidak valid. Silakan keluar dan masuk kembali."
        );
      }

      await verifyCurrentPassword(
        currentUser.email,
        currentPassword,
        currentUser.id
      );

      const { data: sessionData, error: sessionError } =
        await supabase.auth.getUser();

      if (sessionError) {
        throw sessionError;
      }

      if (
        sessionData?.user?.id !== currentUser.id
      ) {
        throw new Error(
          "Sesi akun berubah. Silakan masuk kembali."
        );
      }

      const { error: updateError } =
        await supabase.auth.updateUser({
          password: newPassword,
        });

      if (updateError) {
        throw updateError;
      }

      resetForm();

      setSuccess(
        "Kata sandi berhasil diperbarui."
      );
    } catch (saveError) {
      const message =
        getErrorMessage(saveError);

      if (
        /nonce|reauthentication|reauthenticate/i.test(
          message
        )
      ) {
        setError(
          "Supabase meminta verifikasi tambahan. Periksa pengaturan Secure Password Change di Supabase Auth."
        );
      } else {
        setError(message);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="account-security">
      <div className="account-security-heading">
        <h2>Pengaturan Akun</h2>
      </div>

      <div className="account-security-identity">
        <strong>
          {account?.name || "Pengguna"}
        </strong>

        {account?.phone && (
          <span>{account.phone}</span>
        )}
      </div>

      <form
        className="account-security-form"
        onSubmit={handleSave}
      >
        <h3>Ubah Kata Sandi</h3>

        <label className="account-security-field">
          <span>Kata Sandi Saat Ini</span>

          <input
            type={
              showPassword
                ? "text"
                : "password"
            }
            value={form.currentPassword}
            autoComplete="current-password"
            required
            disabled={saving}
            onChange={(event) =>
              updateField(
                "currentPassword",
                event.target.value
              )
            }
          />
        </label>

        <label className="account-security-field">
          <span>Kata Sandi Baru</span>

          <input
            type={
              showPassword
                ? "text"
                : "password"
            }
            value={form.newPassword}
            minLength={10}
            maxLength={72}
            autoComplete="new-password"
            required
            disabled={saving}
            onChange={(event) =>
              updateField(
                "newPassword",
                event.target.value
              )
            }
          />
        </label>

        <label className="account-security-field">
          <span>Konfirmasi Kata Sandi Baru</span>

          <input
            type={
              showPassword
                ? "text"
                : "password"
            }
            value={form.confirmPassword}
            minLength={10}
            maxLength={72}
            autoComplete="new-password"
            required
            disabled={saving}
            onChange={(event) =>
              updateField(
                "confirmPassword",
                event.target.value
              )
            }
          />
        </label>

        <label className="account-security-check">
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

        {error && (
          <p
            className="account-security-error"
            role="alert"
          >
            {error}
          </p>
        )}

        {success && (
          <p
            className="account-security-success"
            role="status"
          >
            {success}
          </p>
        )}

        <div className="account-security-actions">
          <button
            type="submit"
            disabled={
              saving ||
              !form.currentPassword ||
              !form.newPassword ||
              !form.confirmPassword
            }
          >
            {saving
              ? "Memverifikasi..."
              : "Simpan Kata Sandi"}
          </button>
        </div>
      </form>
    </section>
  );
}
