
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "./index.css";
import "./styles/comfort-motion.css";
import "./styles/time-theme.css";
import "./styles/quran-typography.css";

import App from "./App.jsx";

import PWAUpdateNotice from "./components/PWAUpdateNotice";

import ParentNotificationGate from
  "./components/ParentNotificationControls";

/* Tema seluruh aplikasi, diimpor paling akhir. */
import "./styles/mutabaah-unified-theme.css";
import "./styles/staff-formal-layout.css";
import "./styles/staff-formal-details.css";
import "./styles/staff-module-refresh.css";

const jakartaHour = new Intl.DateTimeFormat(
  "en-GB",
  {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    hourCycle: "h23",
  }
);

function updateTimeTheme() {
  const hour = Number(
    jakartaHour.format(new Date())
  );

  const theme =
    hour >= 4 && hour < 11
      ? "pagi"
      : hour >= 11 && hour < 15
        ? "siang"
        : hour >= 15 && hour < 18
          ? "sore"
          : "malam";

  document.documentElement.dataset.timeTheme =
    theme;
}

updateTimeTheme();

window.setInterval(
  updateTimeTheme,
  15000
);

window.addEventListener(
  "focus",
  updateTimeTheme
);

document.addEventListener(
  "visibilitychange",
  () => {
    if (!document.hidden) {
      updateTimeTheme();
    }
  }
);

createRoot(
  document.getElementById("root")
).render(
  <StrictMode>
    <App />
    <ParentNotificationGate />
    <PWAUpdateNotice />
  </StrictMode>
);
