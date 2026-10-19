import { isStandalone } from "./pwaPlatform";

let installEvent = null;
let installed = false;
let snapshot;
const listeners = new Set();
function read() {
  const standalone = isStandalone();
  const next = { standalone, installed, canPrompt: Boolean(installEvent) && !standalone && !installed };
  if (!snapshot || Object.keys(next).some(key => next[key] !== snapshot[key])) snapshot = next;
  return snapshot;
}
function notify() { read(); listeners.forEach(listener => listener()); }
window.addEventListener("beforeinstallprompt", event => {
  event.preventDefault();
  installEvent = event;
  notify();
});
window.addEventListener("appinstalled", () => {
  installed = true;
  installEvent = null;
  notify();
});
const displayMode = window.matchMedia?.("(display-mode: standalone)");
displayMode?.addEventListener?.("change", notify);
window.addEventListener("pageshow", notify);
export function getInstallSnapshot() { return read(); }
export function subscribeInstall(listener) { listeners.add(listener); return () => listeners.delete(listener); }
export async function promptInstall() {
  const event = installEvent;
  if (!event || isStandalone() || installed) return null;
  // Consume before awaiting: rapid clicks cannot reuse a one-shot event.
  installEvent = null;
  notify();
  await event.prompt();
  return (await event.userChoice)?.outcome || null;
}
