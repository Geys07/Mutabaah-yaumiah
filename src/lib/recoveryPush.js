// Langganan Push untuk chat pemulihan (tanpa login).
// Izin Notification adalah izin aplikasi, bukan per-halaman/tiket.
// Tidak pernah meminta izin otomatis: hanya tombol yang boleh memanggil requestPermission.
const inFlight = new Map();
const base = (import.meta.env.BASE_URL || "/").replace(/\/?$/, "/");

export function recoveryPushPermission() {
  if (typeof window === "undefined" || !window.isSecureContext ||
      !("serviceWorker" in navigator) || !("PushManager" in window) ||
      !("Notification" in window)) return "unsupported";
  return Notification.permission;
}

function decodeVapid(key) {
  const normalized = String(key).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(
    atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=")),
    (char) => char.charCodeAt(0),
  );
}

async function activeWorker() {
  const expected = new URL(base + "parent-push-sw.js", location.origin).href;
  const scope = new URL(base, location.origin).href;
  let reg = await navigator.serviceWorker.getRegistration(base);
  const currentScript = reg?.active?.scriptURL || reg?.waiting?.scriptURL;
  if (currentScript && currentScript !== expected)
    throw new Error("Service Worker aplikasi tidak sesuai.");

  if (!reg) reg = await navigator.serviceWorker.register(expected, { scope: base });
  if (reg.scope !== scope) throw new Error("Scope notifikasi tidak sesuai aplikasi.");

  const ready = reg.active?.state === "activated"
    ? reg : await navigator.serviceWorker.ready;
  if (ready.scope !== scope || ready.active?.scriptURL !== expected)
    throw new Error("Notifikasi aplikasi belum siap.");

  return ready;
}

// Aman dipanggil beberapa kali akibat refresh/focus/React StrictMode.
// Hanya satu POST langganan per tiket yang sedang berlangsung.
export function connectRecoveryChatPush(token, invoke) {
  if (recoveryPushPermission() !== "granted")
    return Promise.resolve(false);
  if (!/^[0-9a-f]{64}$/.test(String(token)))
    return Promise.reject(new Error("Tiket percakapan tidak valid."));

  const active = inFlight.get(token);
  if (active) return active;

  const operation = (async () => {
    const worker = await activeWorker();
    let subscription = await worker.pushManager.getSubscription();
    if (!subscription) {
      const config = await invoke("recovery-chat", { action: "push_config" });
      if (!config.public_key) throw new Error("Konfigurasi notifikasi belum tersedia.");
      subscription = await worker.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: decodeVapid(config.public_key),
      });
    }
    // Izin aplikasi ≠ berlangganan pada tiket: sinkronkan diam-diam ke server.
    // Server melakukan upsert dengan endpoint unik dan memvalidasi token tiket.
    await invoke("recovery-chat", {
      action: "my_subscribe", token, subscription: subscription.toJSON(),
    });
    return true;
  })().finally(() => {
    if (inFlight.get(token) === operation) inFlight.delete(token);
  });
  inFlight.set(token, operation);
  return operation;
}
