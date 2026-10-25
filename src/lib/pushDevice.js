import { supabase } from "./supabase";
import { pushSupportMessage } from "./pwaPlatform";
import { pushErrorMessage } from "./pushErrors";

// Ownership metadata only: never store endpoint keys or auth credentials here.
const OWNER_KEY = "mutabaah-push-owner-v2";
const OPT_IN_KEY = (kind, id) => `mutabaah-push-opt-in-v1:${kind}:${id}`;
export function prefersPushDevice(kind, id) {
  return Boolean(id) && localStorage.getItem(OPT_IN_KEY(kind,id)) === "1";
}
export const PUSH_DEVICE_EVENT = "mutabaah-parent-push-updated";
let queue = Promise.resolve();
const base = (import.meta.env.BASE_URL || "/").replace(/\/?$/, "/");

export function pushAvailable() {
  return !pushSupportMessage();
}
function serial(operation) {
  const next = queue.catch(() => {}).then(operation);
  queue = next.catch(() => {});
  return next;
}
function owner() {
  try { return JSON.parse(localStorage.getItem(OWNER_KEY) || "null"); }
  catch { return null; }
}
async function currentId() {
  const { data, error } = await bounded(supabase.auth.getUser());
  if (error || !data?.user) return "";
  return data.user.id;
}
async function assertAccount(id) {
  if (!id || await currentId() !== id) throw new Error("Sesi berubah. Silakan coba lagi.");
}
function bounded(promise, message = "Koneksi terlalu lama. Silakan coba lagi.") {
  let timer;
  return Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(message)), 15000); })]).finally(() => clearTimeout(timer));
}
async function registration(create = false) {
  let result = await bounded(navigator.serviceWorker.getRegistration(base));
  const expected = new URL(base + "parent-push-sw.js", location.origin).href;
  const active = result?.active?.scriptURL || result?.waiting?.scriptURL;
  if (active && active !== expected) throw new Error("Service Worker lain sudah terpasang.");
  if (!result && create) result = await bounded(navigator.serviceWorker.register(expected, { scope: base }));
  if (result && result.scope !== new URL(base, location.origin).href) throw new Error("Scope Service Worker tidak sesuai aplikasi.");
  return result;
}
async function readyRegistration() {
  const reg = await registration(true);
  const ready = reg?.active?.state === "activated" ? reg : await bounded(
    navigator.serviceWorker.ready,
    "Service Worker belum siap. Periksa koneksi lalu coba siapkan kembali."
  );
  const expected = new URL(base + "parent-push-sw.js", location.origin).href;
  if (ready.scope !== new URL(base, location.origin).href || ready.active?.scriptURL !== expected || ready.active?.state !== "activated") {
    throw new Error("Service Worker aplikasi belum aktif atau scope tidak sesuai.");
  }
  return ready;
}
async function localOff() {
  if (!pushAvailable()) return;
  const reg = await registration();
  const sub = await reg?.pushManager.getSubscription();
  const changed = Boolean(sub || owner());
  if (sub) {
    await sub.unsubscribe();
    if (await reg.pushManager.getSubscription()) throw new Error("Notifikasi perangkat belum dapat dinonaktifkan.");
  }
  localStorage.removeItem(OWNER_KEY);
  if (changed) window.dispatchEvent(new Event(PUSH_DEVICE_EVENT));
}
export async function invokePush(kind, action, values = {}) {
  const { data, error } = await bounded(supabase.functions.invoke(kind + "-push", { body: { action, ...values } }));
  if (error) throw new Error(pushErrorMessage(error, action));
  if (data?.error) throw new Error("Notifikasi belum dapat diproses. Coba lagi.");
  return data;
}
function decode(key) {
  const fixed = key.replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(fixed.padEnd(Math.ceil(fixed.length / 4) * 4, "=")), c => c.charCodeAt(0));
}
export function reconcilePushAccount(id) {
  return serial(async () => {
    const current = owner();
    // Jangan membatalkan langganan yang masih ada hanya karena metadata
    // sementara belum tersedia saat PWA dibuka lagi.
    if (pushAvailable() && current && (!id || current.id !== id)) await localOff();
  });
}
export function detachPushDevice() { return serial(localOff); }
export function checkPushDevice(kind, id, refresh = false) {
  return serial(async () => {
    if (!pushAvailable()) return false;
    const binding = owner();
    if (!id) return false;
    // Jika benar-benar berganti akun, jangan biarkan akun baru menerima push
    // akun sebelumnya. Metadata yang hilang bukan bukti pergantian akun.
    if (binding && (binding.id !== id || binding.kind !== kind)) {
      await localOff();
      return false;
    }
    await assertAccount(id);
    const reg = await registration();
    const sub = await reg?.pushManager.getSubscription();
    if (!sub || Notification.permission !== "granted") return false;
    // Server mengonfirmasi kepemilikan endpoint: hanya user berizin dapat
    // mendaftarkan kembali endpoint miliknya, tanpa meminta izin OS ulang.
    if (!binding || refresh) {
      await invokePush(kind, "subscribe", { subscription: sub.toJSON() });
      if (await currentId() !== id) return false;
      localStorage.setItem(OWNER_KEY, JSON.stringify({ kind, id }));
      localStorage.setItem(OPT_IN_KEY(kind,id), "1");
      localStorage.setItem(OPT_IN_KEY(kind,id), "1");
    }
    return true;
  });
}
// Prepare on settings/prompt mount, never ask permission here. Safari needs
// subscribe() reached from the gesture, not after auth/config/network awaits.
export function preparePushDevice(kind, id) {
  return serial(async () => {
    if (!pushAvailable()) throw new Error(pushSupportMessage());
    await assertAccount(id);
    const binding = owner();
    if (binding && (binding.id !== id || binding.kind !== kind)) await localOff();
    const [reg, config] = await Promise.all([readyRegistration(), invokePush(kind, "config")]);
    if (!config?.public_key) throw new Error("Kunci Web Push belum disiapkan.");
    const sub = await bounded(reg.pushManager.getSubscription());
    await assertAccount(id);
    return { kind, id, reg, sub, key: decode(config.public_key) };
  });
}
export async function enablePushDevice(kind, id, prepared) {
  if (!pushAvailable()) throw new Error(pushSupportMessage());
  if (Notification.permission === "denied") throw new Error("Notifikasi diblokir. Izinkan melalui pengaturan browser/perangkat.");
  if (!prepared || prepared.kind !== kind || prepared.id !== id || prepared.reg.active?.state !== "activated") {
    throw new Error("Notifikasi belum siap. Siapkan kembali lalu tekan Aktifkan.");
  }
  // No awaited auth/network/queue before either gesture-sensitive browser API.
  // For default permission, subscribe immediately in the permission continuation.
  const subscribe = () => {
    let expired = false;
    const pending = Promise.resolve(prepared.sub || prepared.reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: prepared.key }));
    // A timeout cannot cancel the browser API. Remove a late subscription so
    // it cannot remain detached from its account/backend registration.
    void pending.then(sub => { if (expired) void sub.unsubscribe().catch(() => {}); }, () => {});
    return bounded(pending, "Pendaftaran perangkat terlalu lama. Coba lagi tanpa memuat ulang.")
      .catch(error => { expired = true; throw error; });
  };
  const subscription = Notification.permission === "granted"
    ? subscribe()
    : Notification.requestPermission().then(permission => {
      if (permission !== "granted") throw new Error("Izin notifikasi belum diberikan. Anda bisa mengaktifkannya nanti.");
      return subscribe();
    });
  const sub = await subscription;
  return serial(async () => {
    try {
      await assertAccount(id);
      await invokePush(kind, "subscribe", { subscription: sub.toJSON() });
      await assertAccount(id);
      localStorage.setItem(OWNER_KEY, JSON.stringify({ kind, id }));
      localStorage.setItem(OPT_IN_KEY(kind,id), "1");
    } catch (error) {
      await sub.unsubscribe().catch(() => {});
      if (owner()?.id === id && owner()?.kind === kind) localStorage.removeItem(OWNER_KEY);
      throw error;
    }
    window.dispatchEvent(new Event(PUSH_DEVICE_EVENT));
    return true;
  });
}
export function disablePushDevice(kind, id) {
  return serial(async () => {
    await assertAccount(id);
    const binding = owner();
    if (binding?.id !== id || binding?.kind !== kind) { await localOff(); return; }
    const reg = await registration();
    const sub = await reg?.pushManager.getSubscription();
    // Stop delivery locally first, even if the network is offline. A stale server
    // record is harmless after unsubscribe and is pruned on a later 404/410.
    await localOff();
    localStorage.removeItem(OPT_IN_KEY(kind,id));
    if (sub) await invokePush(kind, "unsubscribe", { endpoint: sub.endpoint });
  });
}
