
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { announceStudentDataChange } from "../lib/studentDataUpdates";
import AppConfirmDialog from "../components/AppConfirmDialog";
import "./StudentFamily.css";

const TYPES = [
  { id: "father", label: "Ayah" },
  { id: "mother", label: "Ibu" },
  { id: "guardian", label: "Wali" },
];

function emptyContacts() {
  return {
    father: { full_name: "", phone: "" },
    mother: { full_name: "", phone: "" },
    guardian: { full_name: "", phone: "" },
  };
}

function normalizePhone(value) {
  const digits = String(value || "").replace(/\D/g, "");

  return digits.startsWith("62")
    ? `0${digits.slice(2)}`
    : digits;
}

function formatExpiry(date) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(date));
}

function prepareCodes(data) {
  const now = new Date().getTime();

  return (data || []).map((item) => ({
    ...item,
    is_active:
      !item.used_at &&
      Number.isFinite(new Date(item.expires_at).getTime()) &&
      new Date(item.expires_at).getTime() > now,
  }));
}

export default function StudentFamily({ student, onClose }) {
  const [contacts, setContacts] = useState(emptyContacts);
  const [savedContacts, setSavedContacts] = useState(
    emptyContacts
  );
  const [codes, setCodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState("");
  const [familyConfirmation, setFamilyConfirmation] = useState(null);
  const [codeReadFailed, setCodeReadFailed] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      try {
        const [contactResult, codeResult] = await Promise.all([
          supabase
            .from("student_family_contacts")
            .select("relationship, full_name, phone")
            .eq("student_id", student.id),

          supabase
            .from("parent_activation_codes")
            .select(
              "relationship, phone, code, expires_at, used_at"
            )
            .eq("student_id", student.id),
        ]);

        if (cancelled) return;

        const queryError =
          contactResult.error || codeResult.error;

        if (queryError) {
          throw queryError;
        }

        const next = emptyContacts();

        for (const item of contactResult.data || []) {
          if (next[item.relationship]) {
            next[item.relationship] = {
              full_name: item.full_name || "",
              phone: item.phone || "",
            };
          }
        }

        setContacts(next);
        setSavedContacts(next);
        setCodes(prepareCodes(codeResult.data));
      } catch (fetchError) {
        if (!cancelled) {
          setError(
            fetchError.message || "Gagal memuat data."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchData();

    return () => {
      cancelled = true;
    };
  }, [student.id]);

  useEffect(() => {
    if (saving || generating || familyConfirmation) return undefined;

    function handleEscape(event) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener(
        "keydown",
        handleEscape
      );
    };
  }, [saving, generating, familyConfirmation, onClose]);

  function changeField(type, field, value) {
    setContacts((previous) => ({
      ...previous,
      [type]: {
        ...previous[type],
        [field]: value,
      },
    }));

    setError("");
    setSuccess("");
  }

  function getValidatedPayload() {
    const payload = emptyContacts();

    for (const type of TYPES) {
      const value = contacts[type.id];

      const name = value.full_name
        .trim()
        .replace(/\s+/g, " ");

      const phone = normalizePhone(value.phone);

      if (
        name &&
        (name.length < 2 || name.length > 150)
      ) {
        throw new Error(
          `Nama ${type.label} tidak valid.`
        );
      }

      if (!name && phone) {
        throw new Error(
          `Nama ${type.label} harus diisi.`
        );
      }

      if (
        phone &&
        !/^08\d{8,11}$/.test(phone)
      ) {
        throw new Error(
          `Nomor HP ${type.label} tidak valid.`
        );
      }

      payload[type.id] = {
        full_name: name,
        phone,
      };
    }

    return payload;
  }

  async function persistContacts(payload,approvedMatches=[]) {
    setSaving(true);
    setError("");
    try {
      // Single server transaction: persist contacts, record consent, then link
      // only confirmed family members to an existing active parent account.
      const { data, error: saveError } = await supabase.rpc(
        "admin_save_parent_family",
        { p_student_id: student.id, p_contacts: payload,
          p_approved_matches: approvedMatches }
      );
      if (saveError) throw saveError;
      if(data?.success !== true) throw new Error("Penyimpanan belum dikonfirmasi server.");
      setFamilyConfirmation(null);
      announceStudentDataChange();
      onClose();
    } catch (problem) {
      setError(problem.message || "Data belum berhasil disimpan.");
    } finally {
      setSaving(false);
    }
  }

  async function saveContacts(event) {
    event.preventDefault();
    if (saving || generating || familyConfirmation) return;
    let payload;
    try {
      payload = getValidatedPayload();
    } catch (problem) {
      setError(problem.message);
      return;
    }
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const {data,error:previewError} = await supabase.rpc(
        "admin_preview_parent_family",
        {p_student_id:student.id,p_contacts:payload}
      );
      if(previewError)throw previewError;
      if(!Array.isArray(data))throw new Error("Konfirmasi keluarga tidak dapat diperiksa.");
      if(data.length){
        setFamilyConfirmation({payload,matches:data});
        return;
      }
      await persistContacts(payload);
    }catch(problem){
      setError(problem.message||"Pemeriksaan nomor HP gagal. Tidak ada perubahan tersimpan.");
    }finally{
      setSaving(false);
    }
  }

  function confirmSameFamily(){
    if(saving||!familyConfirmation)return;
    const {payload,matches}=familyConfirmation;
    const approvals=matches.map(match=>({relationship:match.relationship,phone:match.phone}));
    void persistContacts(payload,approvals);
  }

  const familyDescription=familyConfirmation?.matches.map(item=>{
    const label=TYPES.find(type=>type.id===item.relationship)?.label||"Wali";
    const students=(item.students||[])
      .map(other=>`${other.name} (${other.class_name})`).join(", ");
    const info=students
      ? `Nomor ini sudah tercatat pada siswa ${students}.`
      : "Nomor ini sudah digunakan oleh akun orang tua yang aktif.";
    return `${label} — ${item.phone}\n${info}\nApakah ${student.full_name} satu keluarga dengan siswa/akun tersebut?`;
  }).join("\n\n")||"";

  async function retryReadCodes() {
    if (saving || generating) return;
    setGenerating("refresh");
    setError("");
    try {
      const {data,error:problem}=await supabase
        .from("parent_activation_codes")
        .select("relationship, phone, code, expires_at, used_at")
        .eq("student_id", student.id);
      if (problem) throw problem;
      setCodes(prepareCodes(data));
      setCodeReadFailed(false);
      setSuccess("Kode berhasil dimuat. Simpan kode sebelum menutup halaman.");
    } catch {
      setError("Kode sudah diterbitkan, tetapi belum dapat ditampilkan. Periksa koneksi dan coba Muat Ulang Kode.");
    } finally {
      setGenerating("");
    }
  }

  async function generateCode(type) {
    if (saving || generating || codeReadFailed) return;

    const current = contacts[type];
    const saved = savedContacts[type];

    if (
      !saved.full_name ||
      !saved.phone
    ) {
      setError(
        "Simpan nama dan nomor HP terlebih dahulu."
      );
      return;
    }

    if (
      current.full_name.trim() !== saved.full_name ||
      normalizePhone(current.phone) !== saved.phone
    ) {
      setError(
        "Simpan perubahan kontak terlebih dahulu."
      );
      return;
    }

    setGenerating(type);
    setError("");
    setSuccess("");

    let issued = false;
    try {
      const { error: generateError } = await supabase.rpc(
        "generate_parent_activation_code",
        {
          p_student_id: student.id,
          p_relationship: type,
        }
      );
      if (generateError) throw generateError;
      issued = true;
      announceStudentDataChange();
      setSuccess("Kode berhasil dibuat. Simpan kode sebelum menutup halaman.");

      // Terbitnya kode sudah berhasil. Gagal membaca ulang jangan dianggap
      // gagal menerbitkan: pengulangan bisa mengganti kode yang baru dibuat.
      try {
        const { data, error: reloadError } = await supabase
          .from("parent_activation_codes")
          .select("relationship, phone, code, expires_at, used_at")
          .eq("student_id", student.id);
        if (reloadError) throw reloadError;
        setCodes(prepareCodes(data));
      } catch {
        setCodeReadFailed(true);
        setError("Kode telah dibuat, tetapi tidak dapat ditampilkan karena gangguan koneksi. Tutup lalu buka kembali pengelolaan wali; jangan membuat kode kedua.");
      }
    } catch (generateError) {
      if (!issued) {
        setError(generateError.message || "Gagal membuat kode.");
      }
    } finally {
      setGenerating("");
    }
  }


  const busy = saving || Boolean(generating);

  return (
    <div
      className="family-backdrop"
      onMouseDown={(event) => {
        if (
          event.target === event.currentTarget &&
          !busy
        ) {
          onClose();
        }
      }}
    >
      <section
        className="family-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="family-title"
      >
        <header className="family-header">
          <div>
            <h2 id="family-title">
              Orang Tua / Wali
            </h2>
            <p>{student.full_name}</p>
          </div>

          <button
            type="button"
            className="family-close"
            aria-label="Tutup"
            disabled={busy}
            onClick={onClose}
          >
            ×
          </button>
        </header>

        {loading ? (
          <div className="family-loading">
            Memuat...
          </div>
        ) : (
          <form
            className="family-form"
            onSubmit={saveContacts}
          >
            <div className="family-body">
              {TYPES.map((type) => {
                const contact = contacts[type.id];
                const saved = savedContacts[type.id];

                const code = codes.find(
                  (item) =>
                    item.relationship === type.id
                );

                const isLinked = Boolean(student.linkedContacts?.[type.id]?.account_linked);

                const validCode = Boolean(
                  code?.is_active &&
                  code.phone === saved.phone
                );

                return (
                  <section
                    className="family-section"
                    key={type.id}
                  >
                    <h3>{type.label}</h3>

                    <div className="family-fields">
                      <label>
                        <span>Nama</span>

                        <input
                          value={contact.full_name}
                          maxLength={150}
                          disabled={busy}
                          placeholder={`Nama ${type.label.toLowerCase()}`}
                          onChange={(event) =>
                            changeField(
                              type.id,
                              "full_name",
                              event.target.value
                            )
                          }
                        />
                      </label>

                      <label>
                        <span>Nomor HP</span>

                        <input
                          type="tel"
                          inputMode="tel"
                          value={contact.phone}
                          maxLength={17}
                          disabled={busy}
                          placeholder="08xxxxxxxxxx"
                          onChange={(event) =>
                            changeField(
                              type.id,
                              "phone",
                              event.target.value
                            )
                          }
                        />
                      </label>
                    </div>

                    {saved.full_name && saved.phone && (
                      <div className="family-activation">
                        <div className="family-activation-info">
                          {isLinked ? (
                            <span className="family-linked-note">Akun terhubung</span>
                          ) : validCode ? (
                            <>
                              <strong className="family-code">
                                {code.code}
                              </strong>

                              <span>
                                Berlaku sampai{" "}
                                {formatExpiry(
                                  code.expires_at
                                )}
                              </span>
                            </>
                          ) : (
                            <span>
                              Belum ada kode aktif
                            </span>
                          )}
                        </div>

                        {!isLinked && <button
                          type="button"
                          className="family-secondary"
                          disabled={busy}
                          onClick={() =>
                            codeReadFailed ? retryReadCodes() : generateCode(type.id)
                          }
                        >
                          {generating === type.id || generating === "refresh"
                            ? "Memuat..."
                            : codeReadFailed
                              ? "Muat Ulang Kode"
                              : validCode
                                ? "Kode Baru"
                                : "Buat Kode"}
                        </button>}
                      </div>
                    )}
                  </section>
                );
              })}

              {error && (
                <p
                  className="family-error"
                  role="alert"
                >
                  {error}
                </p>
              )}

              {success && (
                <p
                  className="family-success"
                  role="status"
                >
                  {success}
                </p>
              )}
            </div>

            <footer className="family-footer">
              <button
                type="button"
                className="family-secondary"
                disabled={busy}
                onClick={onClose}
              >
                Tutup
              </button>

              <button
                type="submit"
                className="family-primary"
                disabled={busy}
              >
                {saving
                  ? "Menyimpan..."
                  : "Simpan"}
              </button>
            </footer>
          </form>
        )}
      </section>
      {familyConfirmation&&<AppConfirmDialog
        title="Konfirmasi Nomor HP Keluarga"
        description={familyDescription}
        confirmLabel="Ya, Satu Keluarga" cancelLabel="Tidak, Periksa Nomor"
        busy={saving} error={error}
        onConfirm={confirmSameFamily}
        onCancel={()=>{if(!saving){setFamilyConfirmation(null);setError("");}}}
      />}
    </div>
  );
}
