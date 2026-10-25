
import { useEffect, useRef, useState } from "react";
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

function cleanName(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function existingContactName(issue) {
  const registeredName = cleanName(issue?.registered_name);
  if (registeredName) return registeredName;

  const contacts = (issue?.students || [])
    .map((item) => ({
      name: cleanName(item.contact_name),
      relationship: item.relationship,
    }))
    .filter((item) => item.name);
  const sameRelationship = contacts.filter(
    (item) => item.relationship === issue?.relationship
  );
  const candidates = sameRelationship.length ? sameRelationship : contacts;
  const counts = new Map();
  for (const item of candidates) {
    counts.set(item.name, (counts.get(item.name) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "id"))[0]?.[0] || "";
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

// Persetujuan mencakup siswa tertentu, bukan sekadar nomor HP.
// Siswa baru yang memakai nomor sama tetap harus dikonfirmasi tersendiri.
function issueApproval(item) {
  return {relationship:item.relationship,phone:item.phone,
    students:(item.students||[]).map(other=>({id:other.id,relationship:other.relationship}))};
}
function approvalCoversIssue(approval,item) {
  return approval.relationship===item.relationship && approval.phone===item.phone &&
    (item.students||[]).every(other=>(approval.students||[]).some(saved=>
      saved.id===other.id && saved.relationship===other.relationship
    ));
}
function combineApprovals(previous,additional) {
  const mapped=new Map();
  for(const entry of [...previous,...additional]){
    const key=entry.relationship+":"+entry.phone;
    const old=mapped.get(key)||{relationship:entry.relationship,phone:entry.phone,students:[]};
    const siblings=[...old.students,...entry.students];
    old.students=siblings.filter((person,index)=>siblings.findIndex(other=>
      other.id===person.id&&other.relationship===person.relationship)===index);
    mapped.set(key,old);
  }
  return [...mapped.values()];
}

export default function StudentFamily({ student, onClose }) {
  const [contacts, setContacts] = useState(emptyContacts);
  const [savedContacts, setSavedContacts] = useState(
    emptyContacts
  );
  const [linkedAccounts, setLinkedAccounts] = useState({});
  const [codes, setCodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState("");
  const [familyConfirmation, setFamilyConfirmation] = useState(null);
  const [approvedFamilyPhones, setApprovedFamilyPhones] = useState([]);
  const [autoFilledNames, setAutoFilledNames] = useState({});
  const previewVersion = useRef(0);
  const phoneLookupTimer = useRef(null);
  const [confirmingFamily, setConfirmingFamily] = useState(false);
  const [codeReadFailed, setCodeReadFailed] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      try {
        const [contactResult, codeResult, linkResult] = await Promise.all([
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

          // Diperlukan juga ketika editor dibuka dari Data Siswa, bukan
          // hanya dari daftar Orang Tua yang sudah memuat status akun.
          supabase.from("student_guardians")
            .select("relationship,profiles!student_guardians_guardian_id_fkey(phone,account_status)")
            .eq("student_id",student.id),
        ]);

        if (cancelled) return;

        const queryError =
          contactResult.error || codeResult.error || linkResult.error;

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

        const links = {};
        for (const row of linkResult.data || []) {
          const profile = row.profiles;
          const phone = normalizePhone(next[row.relationship]?.phone);
          if (phone && normalizePhone(profile?.phone) === phone &&
              profile?.account_status === "active") {
            links[row.relationship] = true;
          }
        }
        setContacts(next);
        setSavedContacts(next);
        setLinkedAccounts(links);
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

  useEffect(() => () => {
    if (phoneLookupTimer.current !== null) window.clearTimeout(phoneLookupTimer.current);
  }, []);

  useEffect(() => {
    if (saving || generating || confirmingFamily || familyConfirmation) return undefined;

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
    previewVersion.current += 1;
    setAutoFilledNames((previous) => ({ ...previous, [type]: false }));
    if(field==="phone"){
      setApprovedFamilyPhones((previous)=>previous.filter(item=>
        item.relationship!==type || item.phone===normalizePhone(value)
      ));
    }
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

  // Periksa otomatis setelah nomor lengkap dan jeda singkat; onBlur menjadi pemeriksaan cadangan.
  // Konfirmasi awal disimpan sampai tombol Simpan ditekan.
  async function checkSharedPhone(type, phoneValue = contacts[type]?.phone) {
    if(saving||generating||confirmingFamily||familyConfirmation||loading)return;
    const current=contacts[type];
    const phone=normalizePhone(phoneValue);
    if(!/^08\d{8,11}$/.test(phone))return;
    // Periksa ulang daftar saudara dari server; mungkin ada saudara baru.
    const version=++previewVersion.current;
    const payload=Object.fromEntries(TYPES.map(item=>[
      item.id,{full_name:contacts[item.id].full_name.trim(),
        phone:item.id===type ? phone : normalizePhone(contacts[item.id].phone)}
    ]));
    try{
      const {data,error:problem}=await supabase.rpc("admin_preview_parent_family",{
        p_student_id:student.id,p_contacts:payload
      });
      if(problem)throw problem;
      if(previewVersion.current!==version)return;
      const matches=(Array.isArray(data)?data:[])
        .filter(item=>item.relationship===type && item.phone===phone);
      const canonicalName=matches.map(existingContactName).find(Boolean);
      if(canonicalName && cleanName(contacts[type]?.full_name)!==canonicalName){
        setContacts(previous=>({...previous,[type]:{...previous[type],full_name:canonicalName}}));
        setAutoFilledNames(previous=>({...previous,[type]:true}));
      }
      const unconfirmed=matches.filter(item=>!approvedFamilyPhones.some(approved=>
        approvalCoversIssue(approved,item)
      ));
      if(unconfirmed.length)setFamilyConfirmation({matches:unconfirmed,payload:null,saveAfter:false});
    }catch{
      // Gangguan pratinjau tidak menghambat pengisian; Simpan memeriksa ulang.
    }
  }

  function scheduleSharedPhoneCheck(type, value) {
    if (phoneLookupTimer.current !== null) {
      window.clearTimeout(phoneLookupTimer.current);
      phoneLookupTimer.current = null;
    }
    const phone = normalizePhone(value);
    if (!/^08\\d{8,11}$/.test(phone)) return;
    phoneLookupTimer.current = window.setTimeout(() => {
      phoneLookupTimer.current = null;
      void checkSharedPhone(type, value);
    }, 550);
  }

  async function autofillSiblingContacts(matches, basePayload) {
    const siblingIds = [...new Set((matches || []).flatMap((issue) =>
      (issue.students || []).map((other) => other.id).filter((id) => id && id !== student.id)
    ))];
    const nextPayload = Object.fromEntries(TYPES.map((type) => [
      type.id, { ...basePayload[type.id] },
    ]));
    const filled = {};
    if (!siblingIds.length) return { payload: nextPayload, filled };

    const { data, error: contactError } = await supabase
      .from("student_family_contacts")
      .select("student_id, relationship, full_name, phone")
      .in("student_id", siblingIds);
    if (contactError) throw contactError;

    for (const type of TYPES) {
      const current = nextPayload[type.id];
      if (normalizePhone(current.phone)) continue;
      const candidates = (data || []).filter((row) =>
        row.relationship === type.id && /^08\\d{8,11}$/.test(normalizePhone(row.phone))
      );
      const phones = [...new Set(candidates.map((row) => normalizePhone(row.phone)))];
      if (phones.length !== 1) continue;
      const phone = phones[0];
      const names = candidates.filter((row) => normalizePhone(row.phone) === phone)
        .map((row) => cleanName(row.full_name)).filter(Boolean);
      const counts = new Map();
      for (const name of names) counts.set(name, (counts.get(name) || 0) + 1);
      const rankedNames = [...counts.entries()].sort((a, b) => b[1] - a[1]);
      if (!rankedNames.length || (rankedNames[1] && rankedNames[1][1] === rankedNames[0][1])) continue;
      const fullName = rankedNames[0][0];
      if (cleanName(current.full_name) && cleanName(current.full_name) !== fullName) continue;
      nextPayload[type.id] = { full_name: fullName, phone };
      filled[type.id] = true;
    }
    return { payload: nextPayload, filled };
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
    previewVersion.current += 1;
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

      const resolvedPayload={...payload};
      const filled={};
      for(const type of TYPES){
        const current=resolvedPayload[type.id];
        if(!current.phone)continue;
        const issue=data.find(item=>item.relationship===type.id&&item.phone===current.phone);
        const canonicalName=issue?existingContactName(issue):"";
        if(canonicalName){
          resolvedPayload[type.id]={...current,full_name:canonicalName};
          filled[type.id]=true;
        }
        if(!resolvedPayload[type.id].full_name){
          throw new Error(`Nama ${type.label} harus diisi. Nomor ini belum memiliki nama wali yang dapat diambil otomatis.`);
        }
      }
      setContacts(previous=>Object.fromEntries(TYPES.map(type=>[
        type.id,{...previous[type.id],full_name:resolvedPayload[type.id].full_name}
      ])));
      setAutoFilledNames(previous=>({...previous,...filled}));

      const remaining=data.filter(item=>!approvedFamilyPhones.some(approval=>
        approvalCoversIssue(approval,item)
      ));
      if(remaining.length){
        setFamilyConfirmation({payload:resolvedPayload,matches:remaining,saveAfter:true});
        return;
      }
      await persistContacts(resolvedPayload,approvedFamilyPhones);
    }catch(problem){
      setError(problem.message||"Pemeriksaan nomor HP gagal. Tidak ada perubahan tersimpan.");
    }finally{
      setSaving(false);
    }
  }

  async function confirmSameFamily(){
    if(saving||confirmingFamily||!familyConfirmation)return;
    const {payload,matches,saveAfter}=familyConfirmation;
    setConfirmingFamily(true);
    setError("");
    try {
      const basePayload = payload || Object.fromEntries(TYPES.map((type) => [
        type.id, { full_name: cleanName(contacts[type.id].full_name), phone: normalizePhone(contacts[type.id].phone) },
      ]));
      const { payload: filledPayload, filled } = await autofillSiblingContacts(matches, basePayload);
      const additional=matches.map(issueApproval);
      const approvals=combineApprovals(approvedFamilyPhones,additional);
      setContacts(previous=>Object.fromEntries(TYPES.map(type=>[
        type.id,{...previous[type.id],...filledPayload[type.id]}
      ])));
      setAutoFilledNames(previous=>({...previous,...filled}));
      if(saveAfter){
        setConfirmingFamily(false);
        await persistContacts(filledPayload,approvals);
      }else{
        setApprovedFamilyPhones(approvals);
        setFamilyConfirmation(null);
        setSuccess(Object.keys(filled).length
          ? "Keluarga dikonfirmasi. Kontak saudara yang cocok sudah diisi otomatis; periksa lalu tekan Simpan."
          : "Hubungan keluarga dikonfirmasi. Periksa data lalu tekan Simpan.");
      }
    } catch (problem) {
      setError(problem.message || "Kontak saudara belum dapat dimuat. Silakan coba lagi.");
    } finally {
      setConfirmingFamily(false);
    }
  }

  const familyDescription=familyConfirmation?.matches.map(item=>{
    const label=TYPES.find(type=>type.id===item.relationship)?.label||"Wali";
    const students=(item.students||[])
      .map(other=>`${other.name} (${other.class_name})`).join(", ");
    const contactName=cleanName(item.registered_name) ||
      cleanName((item.students||[]).find(other=>other.contact_name)?.contact_name);
    const info=students
      ? `Nomor ini sudah tercatat atas nama ${contactName||label} pada siswa ${students}.`
      : `Nomor ini sudah digunakan oleh akun orang tua yang aktif${contactName?` atas nama ${contactName}`:""}.`;
    const question=students
      ? `Apakah ${student.full_name} satu keluarga dengan ${students}?`
      : `Apakah nomor ini milik wali yang sama untuk ${student.full_name}?`;
    return `${label} — ${item.phone}\n${info}\n${question}`;
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


  const busy = saving || Boolean(generating) || confirmingFamily;

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

                const isLinked = Boolean(linkedAccounts[type.id]);

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
                        {autoFilledNames[type.id] && (
                          <small className="family-autofill-note">
                            Nama terisi otomatis dari data wali yang sudah ada.
                          </small>
                        )}
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
                          onChange={(event) => {
                            const value = event.target.value;
                            changeField(type.id, "phone", value);
                            scheduleSharedPhoneCheck(type.id, value);
                          }}
                          onBlur={() => {
                            if (phoneLookupTimer.current !== null) {
                              window.clearTimeout(phoneLookupTimer.current);
                              phoneLookupTimer.current = null;
                            }
                            void checkSharedPhone(type.id, contact.phone);
                          }}
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
        description={familyConfirmation.saveAfter ? familyDescription :
          familyDescription+"\n\nJika benar satu keluarga, lanjutkan mengisi formulir dan tekan Simpan."}
        confirmLabel="Ya, Satu Keluarga" cancelLabel="Tidak, Periksa Nomor"
        busy={saving || confirmingFamily} error={error}
        onConfirm={confirmSameFamily}
        onCancel={()=>{if(!saving){setFamilyConfirmation(null);setError("");}}}
      />}
    </div>
  );
}
