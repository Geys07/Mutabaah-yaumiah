
import { useState } from "react";
import { supabase } from "../lib/supabase";
import "./ForgotPassword.css";

const INITIAL_FORM = {
  phone: "",
  code: "",
  password: "",
  confirmPassword: "",
};

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
      const body = await error.context.json();

      if (body?.error) return body.error;
      if (body?.message) return body.message;
    } catch {
      // Gunakan pesan kesalahan standar.
    }
  }

  return (
    error?.message ||
    "Tidak dapat menghubungi server."
  );
}

export default function ForgotPassword({
  onBack,
  onSuccess,
}) {
  const [mode, setMode] = useState("request");
  const [form, setForm] = useState(INITIAL_FORM);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  function updateField(field, value) {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));

    setError("");
    setMessage("");
  }

  function changeMode(nextMode) {
    if (submitting) return;

    setMode(nextMode);
    setError("");
    setMessage("");

    setForm((previous) => ({
      ...previous,
      code: "",
      password: "",
      confirmPassword: "",
    }));

    setShowPassword(false);
  }

  async function callRecovery(body) {
    const { data, error: invokeError } =
      await supabase.functions.invoke(
        "password-recovery",
        {
          body,
        }
      );

    if (invokeError) {
      throw new Error(
        await getFunctionError(invokeError)
      );
    }

    if (!data?.success) {
      throw new Error(
        data?.error || "Permintaan gagal diproses."
      );
    }

    return data;
  }

  async function handleRequest(event) {
    event.preventDefault();

    if (submitting) return;

    const phone = normalizePhone(form.phone);

    if (!/^08\d{8,11}$/.test(phone)) {
      setError(
        "Masukkan nomor HP dengan format 08xxxxxxxxxx."
      );
      return;
    }

    setSubmitting(true);
    setError("");
    setMessage("");

    try {
      await callRecovery({
        action: "request",
        phone,
      });

      setForm((previous) => ({
        ...previous,
        phone,
      }));

      setMode("redeem");

      setMessage(
        "Permintaan telah dikirim jika nomor HP terdaftar. Hubungi admin sekolah untuk memperoleh kode pemulihan setelah permintaan disetujui."
      );
    } catch (requestError) {
      setError(
        requestError.message ||
        "Gagal mengirim permintaan."
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRedeem(event) {
    event.preventDefault();

    if (submitting) return;

    const phone = normalizePhone(form.phone);
    const code = form.code.trim().toLowerCase();

    if (!/^08\d{8,11}$/.test(phone)) {
      setError(
        "Masukkan nomor HP dengan format 08xxxxxxxxxx."
      );
      return;
    }

    if (!/^[a-z]{4}$/.test(code)) {
      setError(
        "Kode pemulihan harus terdiri dari 4 huruf."
      );
      return;
    }

    if (
      form.password.length < 10 ||
      form.password.length > 72
    ) {
      setError(
        "Kata sandi baru harus terdiri dari 10–72 karakter."
      );
      return;
    }

    if (
      form.password !== form.confirmPassword
    ) {
      setError(
        "Konfirmasi kata sandi tidak cocok."
      );
      return;
    }

    setSubmitting(true);
    setError("");
    setMessage("");

    try {
      await callRecovery({
        action: "redeem",
        phone,
        code,
        password: form.password,
      });

      setForm(INITIAL_FORM);

      onSuccess?.(
        "Kata sandi berhasil diganti. Silakan masuk dengan kata sandi baru."
      );
    } catch (redeemError) {
      setError(
        redeemError.message ||
        "Gagal mengganti kata sandi."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section
      className="forgot-password"
      aria-labelledby="forgot-password-title"
    >
      <div className="forgot-password-heading">
        <h2 id="forgot-password-title">
          Lupa Kata Sandi
        </h2>
      </div>

      <div
        className="forgot-password-tabs"
        role="group"
        aria-label="Tahap pemulihan akun"
      >
        <button
          type="button"
          className={
            mode === "request" ? "active" : ""
          }
          disabled={submitting}
          onClick={() => changeMode("request")}
        >
          Ajukan Pemulihan
        </button>

        <button
          type="button"
          className={
            mode === "redeem" ? "active" : ""
          }
          disabled={submitting}
          onClick={() => changeMode("redeem")}
        >
          Gunakan Kode
        </button>
      </div>

      <form
        onSubmit={
          mode === "request"
            ? handleRequest
            : handleRedeem
        }
        className="forgot-password-form"
      >
        <label className="forgot-password-field">
          <span>Nomor HP</span>

          <input
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="08xxxxxxxxxx"
            value={form.phone}
            maxLength={17}
            required
            disabled={submitting}
            onChange={(event) =>
              updateField(
                "phone",
                event.target.value
              )
            }
          />
        </label>

        {mode === "redeem" && (
          <>
            <label className="forgot-password-field">
              <span>Kode Pemulihan</span>

              <input
                type="text"
                inputMode="text"
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                placeholder="4 huruf"
                maxLength={4}
                required
                value={form.code}
                disabled={submitting}
                onChange={(event) =>
                  updateField(
                    "code",
                    event.target.value
                      .toLowerCase()
                      .replace(/[^a-z]/g, "")
                      .slice(0, 4)
                  )
                }
              />
            </label>

            <label className="forgot-password-field">
              <span>Kata Sandi Baru</span>

              <input
                type={
                  showPassword
                    ? "text"
                    : "password"
                }
                autoComplete="new-password"
                minLength={10}
                maxLength={72}
                required
                value={form.password}
                disabled={submitting}
                onChange={(event) =>
                  updateField(
                    "password",
                    event.target.value
                  )
                }
              />
            </label>

            <label className="forgot-password-field">
              <span>Konfirmasi Kata Sandi Baru</span>

              <input
                type={
                  showPassword
                    ? "text"
                    : "password"
                }
                autoComplete="new-password"
                minLength={10}
                maxLength={72}
                required
                value={form.confirmPassword}
                disabled={submitting}
                onChange={(event) =>
                  updateField(
                    "confirmPassword",
                    event.target.value
                  )
                }
              />
            </label>

            <label className="forgot-password-show">
              <input
                type="checkbox"
                checked={showPassword}
                disabled={submitting}
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

        {message && (
          <p
            className="forgot-password-message"
            role="status"
          >
            {message}
          </p>
        )}

        {error && (
          <p
            className="forgot-password-error"
            role="alert"
          >
            {error}
          </p>
        )}

        <button
          type="submit"
          className="forgot-password-submit"
          disabled={submitting}
        >
          {submitting
            ? "Memproses..."
            : mode === "request"
              ? "Kirim Permintaan"
              : "Simpan Kata Sandi Baru"}
        </button>

        <button
          type="button"
          className="forgot-password-back"
          disabled={submitting}
          onClick={onBack}
        >
          Kembali ke Login
        </button>
      </form>
    </section>
  );
}
