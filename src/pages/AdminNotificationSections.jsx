import { useState } from "react";
import AdminPushSettings from "../components/AdminPushSettings";
import AdminPhoneRequests from "./AdminPhoneRequests";
import AdminNotifications from "./AdminNotifications";
import "./SectionTabs.css";

const TABS = [
  { id: "requests", title: "Permintaan Akun" },
  { id: "phone", title: "Perubahan Nomor" },
  { id: "push", title: "Notifikasi Push" },
];

export default function AdminNotificationSections({
  passwordPendingCount,
  notificationChanged,
  loadPendingCount,
  loggingOut,
}) {
  const [section, setSection] = useState("requests");
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
      <div hidden={section !== "requests"}>
        <AdminNotifications
          pendingCount={passwordPendingCount}
          onPendingCountChange={notificationChanged}
          onRefreshCounts={loadPendingCount}
          suspended={loggingOut}
        />
      </div>
      <div hidden={section !== "phone"}>
        <AdminPhoneRequests onChanged={notificationChanged} />
      </div>
      <div hidden={section !== "push"}>
        <AdminPushSettings />
      </div>
    </div>
  );
}
