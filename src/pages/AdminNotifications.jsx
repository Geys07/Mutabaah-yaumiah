
import {
  useCallback,
  useEffect,
  useState,
} from "react";
import { supabase } from "../lib/supabase";
import { PAGE_SIZE } from "../lib/pagination";
import { readNotification, notificationGroup } from "../lib/notificationRead";
import useNotificationRead from "../hooks/useNotificationRead";
import Pagination from "../components/Pagination";
import EmptyState from "../components/EmptyState";
import AppConfirmDialog from "../components/AppConfirmDialog";
import "./AdminNotifications.css";

const STATUS_TEXT = {
  pending: "Menunggu",
  approved: "Disetujui",
  processing: "Diproses",
  rejected: "Ditolak",
  used: "Selesai",
  revoked: "Dicabut",
};

const ROLE_TEXT = {
  admin: "Admin",
  principal: "Kepala Sekolah",
  homeroom_teacher: "Wali Kelas",
  parent: "Orang Tua",
};

const DECISION_TEXT = {
  approve: "Setujui Permintaan?",
  reject: "Tolak Permintaan?",
  revoke: "Cabut Kode?",
  reissue: "Terbitkan Kode Baru?",
  cancel_stuck: "Tutup Proses Bermasalah?",
};

function getRoleText(value) {
  if (!value) return "Pengguna";

  return String(value)
    .split(",")
    .map(
      (role) =>
        ROLE_TEXT[role.trim()] || role.trim()
    )
    .join(", ");
}

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(date);
}

async function getFunctionError(error) {
  if (error?.context) {
    try {
      const result = await error.context.json();

      return (
        result?.error ||
        result?.message ||
        error.message
      );
    } catch {
      return (
        error.message ||
        "Permintaan gagal diproses."
      );
    }
  }

  return (
    error?.message ||
    "Permintaan gagal diproses."
  );
}

async function invokeAction(requestId, decision) {
  const supportActions = [
    "reissue",
    "cancel_stuck",
  ];

  const isSupport =
    supportActions.includes(decision);

  const functionName = isSupport
    ? "recovery-admin"
    : "password-recovery";

  const body = isSupport
    ? {
        action: decision,
        request_id: requestId,
      }
    : {
        action: "review",
        request_id: requestId,
        decision,
      };

  const { data, error } =
    await supabase.functions.invoke(
      functionName,
      { body }
    );

  if (error) {
    throw new Error(
      await getFunctionError(error)
    );
  }

  if (!data?.success) {
    throw new Error(
      data?.error ||
      "Permintaan gagal diproses."
    );
  }

  return data;
}

export default function AdminNotifications({
  onPendingCountChange,
  onRefreshCounts,
  pendingCount = null,
  suspended = false,
}) {
  const [page, setPage] = useState(0);
  const [filter, setFilter] = useState("pending");
  const [busyId, setBusyId] = useState("");
  const [confirmation, setConfirmation] =
    useState(null);
  const [issuedCode, setIssuedCode] =
    useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);

  const readRequests = useCallback(async (signal) => {
    const [result, processing] = await notificationGroup([
      readNotification((requestSignal) => {
        let query = supabase.rpc("list_password_reset_requests", {}, { count: "exact" });
        if (filter !== "all") query = query.eq("status", filter);
        return query.order("requested_at", { ascending: false }).order("id")
          .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1).abortSignal(requestSignal);
      }, signal),
      readNotification((requestSignal) => supabase.rpc(
        "list_password_reset_requests", {}, { count: "exact", head: true }
      ).eq("status", "processing").abortSignal(requestSignal), signal),
    ]);
    if (!Array.isArray(result.data) || typeof result.count !== "number" ||
        typeof processing.count !== "number") throw new Error("Daftar notifikasi belum tersedia.");
    return { rows: result.data, total: result.count, processing: processing.count };
  }, [filter, page]);
  const listKey = JSON.stringify([filter, page]);
  const reader = useNotificationRead(listKey, readRequests, !suspended);
  const loading = reader.loading;
  const loadRequests = reader.refresh;
  const total = reader.current ? reader.data?.total ?? null : null;
  const processingCount = reader.data?.processing ?? null;
  const visibleItems = reader.current ? reader.data?.rows || [] : [];
  useEffect(() => {
    if (total === null || page === 0 || page * PAGE_SIZE < total) return undefined;
    const timer = window.setTimeout(() => setPage(Math.max(0, Math.ceil(total / PAGE_SIZE) - 1)), 0);
    return () => window.clearTimeout(timer);
  }, [page, total]);

  function askConfirmation(item, decision) {
    setConfirmation({
      id: item.id,
      name: item.full_name || "Pengguna",
      decision,
    });

    setError("");
    setMessage("");
  }

  async function processDecision() {
    if (!confirmation || busyId) return;

    const {
      id,
      name,
      decision,
    } = confirmation;

    setBusyId(id);
    setError("");
    setMessage("");
    let savedByServer = false;

    try {
      const result = await invokeAction(
        id,
        decision
      );
      savedByServer = true;

      if (
        decision === "approve" ||
        decision === "reissue"
      ) {
        if (
          !/^[a-z]{4}$/.test(
            result.code || ""
          )
        ) {
          throw new Error(
            "Permintaan telah diproses, tetapi kode tidak diterima. Jangan mengulangi persetujuan atau penerbitan sebelum memeriksa status terbaru."
          );
        }

        setIssuedCode({
          requestId: id,
          name,
          code: result.code,
        });

        setCopied(false);
      } else {
        const messages = {
          reject: "Permintaan berhasil ditolak.",
          revoke: "Kode pemulihan berhasil dicabut.",
          cancel_stuck:
            "Proses bermasalah berhasil ditutup.",
        };

        setMessage(
          messages[decision] ||
          result.message ||
          "Permintaan berhasil diproses."
        );
      }

      // Only dismiss after server confirmed success. Refresh failures are
      // displayed separately; never invite a duplicate approval/reissue.
      setConfirmation(null);
      await loadRequests({ force: true, replace: true });
      onPendingCountChange?.();
    } catch (processError) {
      if (savedByServer) setConfirmation(null);

      setError(
        processError.message ||
        "Gagal memproses permintaan."
      );

      await loadRequests({ force: true, replace: true });
      onPendingCountChange?.();
    } finally {
      setBusyId("");
    }
  }

  async function copyCode() {
    if (!issuedCode?.code) return;

    try {
      await navigator.clipboard.writeText(
        issuedCode.code
      );

      setCopied(true);
      setMessage("Kode berhasil disalin.");
      setError("");
    } catch {
      setError(
        "Gagal menyalin otomatis. Pilih kode lalu salin secara manual."
      );
    }
  }

  function closeCode() {
    setIssuedCode(null);
    setCopied(false);
    setMessage("");
  }

  function actionButtons(item) {
    if (item.status === "pending") {
      return (
        <div className="notification-actions">
          <button
            type="button"
            className="notification-approve-button"
            disabled={Boolean(busyId)}
            onClick={() =>
              askConfirmation(item, "approve")
            }
          >
            Setujui
          </button>

          <button
            type="button"
            className="notification-outline-button"
            disabled={Boolean(busyId)}
            onClick={() =>
              askConfirmation(item, "reject")
            }
          >
            Tolak
          </button>
        </div>
      );
    }

    if (item.status === "approved") {
      return (
        <div className="notification-actions">
          <button
            type="button"
            className="notification-approve-button"
            disabled={Boolean(busyId)}
            onClick={() =>
              askConfirmation(item, "reissue")
            }
          >
            Terbitkan Kode Baru
          </button>

          <button
            type="button"
            className="notification-outline-button"
            disabled={Boolean(busyId)}
            onClick={() =>
              askConfirmation(item, "revoke")
            }
          >
            Cabut Kode
          </button>
        </div>
      );
    }

    if (item.status === "processing") {
      return (
        <div className="notification-actions">
          <button
            type="button"
            className="notification-outline-button"
            disabled={Boolean(busyId)}
            onClick={() =>
              askConfirmation(
                item,
                "cancel_stuck"
              )
            }
          >
            Tutup Proses Bermasalah
          </button>
        </div>
      );
    }

    return null;
  }

  return (
    <section className="admin-notifications">
      <header className="admin-notifications-heading">
        <div>
          <h2>Notifikasi</h2>
          <span>
            Permintaan Lupa Kata Sandi
          </span>
        </div>

        <button
          type="button"
          className="notification-outline-button"
          disabled={loading || Boolean(busyId)}
          onClick={() => {
            void loadRequests({ force: true });
            void onRefreshCounts?.();
          }}
        >
          Muat Ulang
        </button>
      </header>

      <div
        className="notification-filters"
        role="group"
        aria-label="Filter permintaan"
      >
        <button
          type="button"
          className={
            filter === "pending"
              ? "active"
              : ""
          }
          onClick={() =>
            { setPage(0); setFilter("pending"); }
          }
        >
          Menunggu ({pendingCount ?? "—"})
        </button>

        <button
          type="button"
          className={
            filter === "processing"
              ? "active"
              : ""
          }
          onClick={() =>
            { setPage(0); setFilter("processing"); }
          }
        >
          Diproses ({processingCount ?? "—"})
        </button>

        <button
          type="button"
          className={
            filter === "approved"
              ? "active"
              : ""
          }
          onClick={() =>
            { setPage(0); setFilter("approved"); }
          }
        >
          Disetujui
        </button>

        <button
          type="button"
          className={
            filter === "all"
              ? "active"
              : ""
          }
          onClick={() =>
            { setPage(0); setFilter("all"); }
          }
        >
          Semua
        </button>
      </div>

      {reader.error && (
        <p className="notification-error" role="alert">
          Notifikasi belum diperbarui. Gunakan Muat Ulang.
        </p>
      )}

      {error && (
        <p
          className="notification-error"
          role="alert"
        >
          {error}
        </p>
      )}

      {message && (
        <p
          className="notification-success"
          role="status"
        >
          {message}
        </p>
      )}

      {loading && reader.current && (
        <p role="status">Memperbarui notifikasi…</p>
      )}
      {loading && !reader.current ? (
        <div className="notification-empty">
          Memuat...
        </div>
      ) : !reader.current ? (
        <div className="notification-empty">Daftar belum tersedia.</div>
      ) : visibleItems.length === 0 ? (
        <EmptyState kind="notice" illustration="notification" title="Tidak ada permintaan" description="Permintaan baru akan ditampilkan di sini." />
      ) : (
        <div className="notification-list">
          {visibleItems.map((item) => (
            <article
              className="notification-item"
              key={item.id}
            >
              <div className="notification-item-main">
                <div className="notification-avatar">
                  {(item.full_name || "P")
                    .charAt(0)
                    .toUpperCase()}
                </div>

                <div className="notification-item-info">
                  <strong>
                    {item.full_name}
                  </strong>

                  <span>
                    {getRoleText(
                      item.account_type
                    )}
                  </span>

                  <span>
                    {item.phone_masked}
                  </span>

                  <small>
                    {formatDate(
                      item.requested_at
                    )}
                  </small>
                </div>

                <span
                  className={
                    `notification-status ` +
                    `notification-status-${item.status}`
                  }
                >
                  {STATUS_TEXT[item.status] ||
                    item.status}
                </span>
              </div>

              {actionButtons(item)}
            </article>
          ))}
        </div>
      )}

      {total !== null && <Pagination page={page} total={total} loading={loading || Boolean(busyId)} onChange={setPage} />}

      {confirmation && (
        <AppConfirmDialog
          title={DECISION_TEXT[confirmation.decision] || "Konfirmasi"}
          description={
            confirmation.name + "\n\n" +
            (confirmation.decision === "approve"
              ? "Pastikan identitas pemohon telah diverifikasi sebelum menyetujui."
              : confirmation.decision === "reissue"
                ? "Kode sebelumnya langsung dibatalkan. Pastikan kode baru diberikan kepada pemilik akun."
                : confirmation.decision === "cancel_stuck"
                  ? "Periksa lebih dahulu apakah pengguna berhasil mengganti kata sandi. Menutup proses ini tidak mengembalikan kata sandi lama."
                  : confirmation.decision === "revoke"
                    ? "Kode pemulihan yang masih berlaku akan dicabut."
                    : "Pemohon akan menerima keputusan penolakan."
            )
          }
          danger={["reject","revoke","cancel_stuck"].includes(confirmation.decision)}
          confirmLabel="Ya, Konfirmasi"
          busy={Boolean(busyId)}
          error={error}
          onCancel={()=>{setConfirmation(null);setError("");}}
          onConfirm={()=>void processDecision()}
        />
      )}

      {issuedCode && (
        <div className="notification-modal-backdrop">
          <section
            className="notification-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="notification-code-title"
          >
            <h3 id="notification-code-title">
              Kode Pemulihan
            </h3>

            <p>{issuedCode.name}</p>

            <div className="notification-issued-code">
              {issuedCode.code}
            </div>

            <p className="notification-verification-note">
              Salin kode sebelum menutup jendela.
              Kode tidak dapat ditampilkan kembali.
            </p>

            <div className="notification-modal-actions">
              <button
                type="button"
                className="notification-outline-button"
                onClick={closeCode}
              >
                Tutup
              </button>

              <button
                type="button"
                className="notification-approve-button"
                onClick={copyCode}
              >
                {copied
                  ? "Salin Lagi"
                  : "Salin Kode"}
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
