import { useState } from "react";
import AdminPushSettings from "../components/AdminPushSettings";
import AdminPhoneRequests from "./AdminPhoneRequests";
import AdminNoticeInbox from "./AdminNoticeInbox";
import AdminReminderSettings from "./AdminReminderSettings";
import "./SectionTabs.css";

const TABS = [
  { id: "inbox", title: "Kotak Masuk" },
  { id: "reminder", title: "Pengingat 20.00" },
  { id: "chats", title: "Pemulihan Kata Sandi" },
  { id: "phone", title: "Perubahan Nomor" },
  { id: "push", title: "Notifikasi Perangkat" },
];

export default function AdminNotificationSections({
  notificationChanged,
  onOpenRecoveryChats,
}) {
  const [section, setSection] = useState("inbox");
  return (
    <div className="section-workspace">
      <nav className="section-tabs" aria-label="Bagian Notifikasi Admin">
        {TABS.map((tab) => (
          <button key={tab.id} type="button"
            className={section === tab.id ? "is-active" : ""}
            aria-current={section === tab.id ? "page" : undefined}
            onClick={() => setSection(tab.id)}>
            {tab.title}
          </button>
        ))}
      </nav>
      {section === "inbox" && (
        <AdminNoticeInbox
          onChanged={notificationChanged}
          onOpenRequest={(source) => { if(source === "phone")setSection("phone");else onOpenRecoveryChats?.(); }}
        />
      )}
      {section === "reminder" && (
        <AdminReminderSettings
          onChanged={notificationChanged}
          onPreview={() => setSection("inbox")}
        />
      )}
      {section === "chats" && (
        <div className="section-workspace">
          <p>Permintaan pemulihan kata sandi ditangani di halaman chat khusus Admin.</p>
          <button type="button" className="admin-primary-button" onClick={() => onOpenRecoveryChats?.()}>Buka Chat Pemulihan Kata Sandi</button>
        </div>
      )}
      {section === "phone" && (
        <AdminPhoneRequests onChanged={notificationChanged} />
      )}
      {section === "push" && <AdminPushSettings />}
    </div>
  );
}
