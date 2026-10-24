import { useState } from "react";
import AdminPushSettings from "../components/AdminPushSettings";
import AdminPhoneRequests from "./AdminPhoneRequests";
import AdminNoticeInbox from "./AdminNoticeInbox";
import AdminReminderSettings from "./AdminReminderSettings";
import "./SectionTabs.css";

// Chat merupakan halaman tersendiri. Tidak membuat tab kosong berisi tombol kedua.
const TABS = [
  { id: "chats", title: "Chat Pemulihan Kata Sandi", shortcut: true },
  { id: "inbox", title: "Kotak Masuk" },
  { id: "reminder", title: "Pengingat 20.00" },
  { id: "phone", title: "Perubahan Nomor" },
  { id: "push", title: "Notifikasi Perangkat" },
];

export default function AdminNotificationSections({
  notificationChanged,
  onOpenRecoveryChats,
}) {
  const [section, setSection] = useState("inbox");

  function openSection(tab) {
    if (tab.shortcut) {
      onOpenRecoveryChats?.();
      return;
    }
    setSection(tab.id);
  }

  return (
    <div className="section-workspace section-notifications">
      <nav className="section-tabs" aria-label="Bagian Notifikasi Admin">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={[
              section === tab.id ? "is-active" : "",
              tab.shortcut ? "is-chat-link" : "",
            ].filter(Boolean).join(" ")}
            aria-current={!tab.shortcut && section === tab.id ? "page" : undefined}
            onClick={() => openSection(tab)}
          >
            {tab.shortcut && <span className="section-chat-icon" aria-hidden="true">✉</span>}
            <span>{tab.title}</span>
            {tab.shortcut && <span className="section-chat-arrow" aria-hidden="true">›</span>}
          </button>
        ))}
      </nav>

      {section === "inbox" && (
        <AdminNoticeInbox
          onChanged={notificationChanged}
          onOpenRequest={(source) => {
            if (source === "phone") setSection("phone");
            else onOpenRecoveryChats?.();
          }}
        />
      )}
      {section === "reminder" && (
        <AdminReminderSettings
          onChanged={notificationChanged}
          onPreview={() => setSection("inbox")}
        />
      )}
      {section === "phone" && (
        <AdminPhoneRequests onChanged={notificationChanged} />
      )}
      {section === "push" && <AdminPushSettings />}
    </div>
  );
}
