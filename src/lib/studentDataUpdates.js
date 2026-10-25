import { useEffect, useState } from "react";
import { supabase } from "./supabase";

// These are user-facing school records. Credentials, recovery chats, push
// subscriptions, and delivery ledgers deliberately stay out of this stream.
const LIVE_TABLES = [
  "academic_years",
  "admin_notice_inbox",
  "app_settings",
  "classes",
  "homeroom_assignments",
  "mutabaah_activities",
  "mutabaah_day_conditions",
  "mutabaah_day_submissions",
  "mutabaah_entries",
  "mutabaah_entry_history",
  "mutabaah_promotion_runs",
  "mutabaah_ramadan_activity_links",
  "mutabaah_ramadan_periods",
  "mutabaah_report_archives",
  "mutabaah_report_grading",
  "parent_activation_codes",
  "parent_daily_notice_reads",
  "parent_phone_change_requests",
  "profiles",
  "school_identity",
  "semesters",
  "student_enrollments",
  "student_family_contacts",
  "student_guardians",
  "students",
  "user_roles",
];

const EVENT_NAME = "mutabaah:student-data-changed";
const CHANNEL_NAME = "mutabaah-school-data-live-v2";
const listeners = new Set();
let realtimeChannel = null;
let fallbackTimer = null;
let notifyTimer = null;

function notifyListeners() {
  if (notifyTimer !== null) return;
  notifyTimer = window.setTimeout(() => {
    notifyTimer = null;
    for (const listener of [...listeners]) {
      try { listener(); } catch { /* One view must not break other refreshes. */ }
    }
  }, 100);
}

function startRealtime() {
  if (realtimeChannel || typeof window === "undefined") return;

  let channel = supabase.channel(CHANNEL_NAME);
  for (const table of LIVE_TABLES) {
    channel = channel.on(
      "postgres_changes",
      { event: "*", schema: "public", table },
      notifyListeners
    );
  }
  realtimeChannel = channel.subscribe();

  // Fallback for a temporary Realtime disconnect or a browser sleep/wake.
  fallbackTimer = window.setInterval(() => {
    if (!document.hidden) notifyListeners();
  }, 45000);
}

function stopRealtime() {
  if (fallbackTimer !== null) {
    window.clearInterval(fallbackTimer);
    fallbackTimer = null;
  }
  if (notifyTimer !== null) {
    window.clearTimeout(notifyTimer);
    notifyTimer = null;
  }
  if (realtimeChannel) {
    const current = realtimeChannel;
    realtimeChannel = null;
    void supabase.removeChannel(current);
  }
}

export function announceStudentDataChange() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(EVENT_NAME));
  if ("BroadcastChannel" in window) {
    const channel = new BroadcastChannel(CHANNEL_NAME);
    channel.postMessage("refresh");
    channel.close();
  }
}

export function listenStudentDataChanges(callback) {
  if (typeof window === "undefined") return () => {};
  listeners.add(callback);
  if (listeners.size === 1) startRealtime();

  const onChange = () => notifyListeners();
  const onFocus = () => {
    if (!document.hidden) notifyListeners();
  };
  window.addEventListener(EVENT_NAME, onChange);
  window.addEventListener("focus", onFocus);
  document.addEventListener("visibilitychange", onFocus);

  let browserChannel;
  if ("BroadcastChannel" in window) {
    browserChannel = new BroadcastChannel(CHANNEL_NAME);
    browserChannel.addEventListener("message", onChange);
  }

  return () => {
    listeners.delete(callback);
    window.removeEventListener(EVENT_NAME, onChange);
    window.removeEventListener("focus", onFocus);
    document.removeEventListener("visibilitychange", onFocus);
    if (browserChannel) {
      browserChannel.removeEventListener("message", onChange);
      browserChannel.close();
    }
    if (listeners.size === 0) stopRealtime();
  };
}

export function useLiveDataRevision(enabled = true) {
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!enabled) return undefined;
    return listenStudentDataChanges(() => setRevision((value) => value + 1));
  }, [enabled]);
  return revision;
}
