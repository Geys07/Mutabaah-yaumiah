
import { useState } from "react";
import { supabase } from "../lib/supabase";
import "./ParentActivation.css";

const EMPTY = {
  phone: "",
  code: "",
  password: "",
  confirm_password: "",
};

function normalizePhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  return digits.startsWith("62")
    ? `0${digits.slice(2)}`
    : digits;
}

async function getServiceError(error) {
  if (error?.context) {
    try {
      const response = await error.context.json();
      return (
        response?.error ||
        response?.message ||
        error.message
      );
    } catch {
      return (
        error?.message ||
        "Tidak dapat terhubung ke server."
      );
    }
  }

  return (
    error?.message ||
    "Tidak dapat terhubung ke server."
  );
}

export default function ParentActivation({
  onBack,
  onSuccess,
}) {
  const [form, setForm] = useState(EMPTY);
  const [showPassword, setShowPassword] =
    useState(false);
  const [submitting, setSubmitting] =
    useState(false);
  const [error, setError] = useState("");

  function update(name, value) {
    setForm((old) => ({
      ...old,
      [name]: value,
    }));
    setError("");
  }

  async function submit(event) {
    event.preventDefault();
    if (submitting) return;

    const phone = normalizePhone(form.phone);
    const code = form.code.trim().toLowerCase();

    if (!/^08[0-9]{8,11}$/.test(phone)) {
      setError(
        "Gunakan nomor HP terdaftar dengan format 08xxxxxxxxxx."
      );
      return;
    }

    if (!/^[a-z]{4}$/.test(code)) {
      setError(
        "Kode aktivasi harus terdiri atas 4 huruf."
      );
      return;
    }

    if (
      form.password.length < 10 ||
      form.password.length > 72
    ) {
      setError(
        "Kata sandi harus terdiri dari 10–72 karakter."
      );
      return;
    }

    if (form.password !== form.confirm_password) {
      setError("Konfirmasi kata sandi tidak cocok.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const { data, error: requestError } =
        await supabase.functions.invoke(
          "activate-parent",
          {
            body: {
              // Parameter kompatibilitas untuk layanan lama.
              // Nama profil sebenarnya diambil server
              // dari master kontak keluarga siswa.
              full_name: "Orang Tua",
              phone,
              code,
              password: form.password,
            },
          }
        );

      if (requestError) {
        throw new Error(
          await getServiceError(requestError),
          { cause: requestError }
        );
      }

      if (!data?.success) {
        throw new Error(
          data?.error || "Aktivasi akun gagal."
        );
      }

      setForm(EMPTY);

      onSuccess?.(
        "Akun berhasil diaktifkan. Silakan masuk dengan nomor HP dan kata sandi."
      );
    } catch (caught) {
      setError(
        caught?.message ||
        "Aktivasi gagal. Silakan coba kembali."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section
      className="activation-root"
      aria-labelledby="activation-title"
    >
      <div className="activation-heading">
        <h2 id="activation-title">
          Aktivasi Orang Tua
        </h2>
      </div>

      <form onSubmit={submit}>
        <p
          style={{
            margin: "0 0 2px",
            color: "#567463",
            fontSize: 12,
            lineHeight: 1.55,
          }}
        >
          Nama orang tua otomatis mengikuti
          data keluarga siswa yang sudah
          terdaftar di madrasah.
        </p>

        <label className="activation-field">
          <span>Nomor HP terdaftar</span>
          <input
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="08xxxxxxxxxx"
            required
            maxLength={17}
            value={form.phone}
            disabled={submitting}
            onChange={(event) =>
              update("phone", event.target.value)
            }
          />
        </label>

        <label className="activation-field">
          <span>Kode Aktivasi</span>
          <input
            type="text"
            autoCapitalize="none"
            autoComplete="off"
            spellCheck={false}
            placeholder="4 huruf"
            required
            maxLength={4}
            value={form.code}
            disabled={submitting}
            onChange={(event) =>
              update(
                "code",
                event.target.value
                  .toLowerCase()
                  .replace(/[^a-z]/g, "")
                  .slice(0, 4)
              )
            }
          />
        </label>

        <label className="activation-field">
          <span>Buat Kata Sandi</span>
          <input
            type={
              showPassword ? "text" : "password"
            }
            autoComplete="new-password"
            required
            minLength={10}
            maxLength={72}
            value={form.password}
            disabled={submitting}
            onChange={(event) =>
              update("password", event.target.value)
            }
          />
        </label>

        <label className="activation-field">
          <span>Ulangi Kata Sandi</span>
          <input
            type={
              showPassword ? "text" : "password"
            }
            autoComplete="new-password"
            required
            minLength={10}
            maxLength={72}
            value={form.confirm_password}
            disabled={submitting}
            onChange={(event) =>
              update(
                "confirm_password",
                event.target.value
              )
            }
          />
        </label>

        <label className="activation-checkbox">
          <input
            type="checkbox"
            checked={showPassword}
            disabled={submitting}
            onChange={(event) =>
              setShowPassword(event.target.checked)
            }
          />
          <span>Tampilkan kata sandi</span>
        </label>

        {error && (
          <p className="activation-error" role="alert">
            {error}
          </p>
        )}

        <button
          className="activation-submit"
          type="submit"
          disabled={submitting}
        >
          {submitting
            ? "Mengaktifkan..."
            : "Aktifkan Akun"}
        </button>

        <button
          className="activation-back"
          type="button"
          disabled={submitting}
          onClick={onBack}
        >
          Kembali ke Login
        </button>
      </form>
    </section>
  );
}
