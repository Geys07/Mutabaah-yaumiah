import { useState } from "react";
import AdminPushSettings from "../components/AdminPushSettings";
import AdminPhoneRequests from "./AdminPhoneRequests";
import AdminNotifications from "./AdminNotifications";
import AdminNoticeInbox from "./AdminNoticeInbox";
import AdminReminderSettings from "./AdminReminderSettings";
import "./SectionTabs.css";

const TABS = [
  { id: "inbox", title: "Kotak Masuk" },
  { id: "reminder", title: "Pengingat 20.00" },
  { id: "requests", title: "Permintaan Akun" },
  { id: "phone", title: "Perubahan Nomor" },
  { id: "push", title: "Notifikasi Perangkat" },
];

export default function AdminNotificationSections({
  passwordPendingCount,
  notificationChanged,
  loadPendingCount,
  loggingOut,
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
          onOpenRequest={(source) => setSection(source === "phone" ? "phone" : "requests")}
        />
      )}
      {section === "reminder" && (
        <AdminReminderSettings
          onChanged={notificationChanged}
          onPreview={() => setSection("inbox")}
        />
      )}
      {section === "requests" && (
        <AdminNotifications
          pendingCount={passwordPendingCount}
          onPendingCountChange={notificationChanged}
          onRefreshCounts={loadPendingCount}
          suspended={loggingOut}
        />
      )}
      {section === "phone" && (
        <AdminPhoneRequests onChanged={notificationChanged} />
      )}
      {section === "push" && <AdminPushSettings />}
    </div>
  );
}
