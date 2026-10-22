// Service Worker bersama: PWA ringan + push notifikasi.
// Tidak pernah mencache jawaban Mutabaah, token, atau API Supabase.
const VERSION = "mutabaah-pwa-v7-amal-harian-black-20261022";
const STATIC_CACHE = `${VERSION}-public`;
const SHELL = ["/", "/manifest.webmanifest", "/favicon.svg", "/logo-sekolah-loading.png", "/pwa/icon-192.png", "/pwa/icon-512.png", "/notification/amal-harian-status-v1.png"];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(STATIC_CACHE);
    const manifest = await fetch(new URL("pwa-assets.json", self.registration.scope), { cache: "no-store" });
    // Vite dev server has no generated asset list. Production emits it at build.
    const assets = manifest.ok && (manifest.headers.get("content-type") || "").includes("json") ? await manifest.json() : [];
    const safeAssets = assets.filter(name => typeof name === "string" && /^assets\/[\w.-]+\.(js|css)$/.test(name));
    await cache.addAll([...SHELL, ...safeAssets.map(name => new URL(name, self.registration.scope).href)]);
  })());
  // Jangan skipWaiting otomatis agar draf yang sedang diisi tidak terganggu.
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const all = await caches.keys();
    await Promise.all(all.filter((name) => name.startsWith("mutabaah-pwa-") && name !== STATIC_CACHE).map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

// Legacy clients may still send SKIP_WAITING. Do not activate on that message:
// their open forms may not have synced. Wait until all old clients are closed.

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/") || url.pathname.includes("/functions/") || url.pathname.startsWith("/auth/")) return;
  // Vite development modules are mutable and can reference different React
  // versions after re-optimization. Never cache them as production assets.
  if (/^\/(?:src|node_modules|@vite|@react-refresh|@fs|@id)(?:\/|$)/.test(url.pathname)) return;
  // HTML hanya shell publik. Jangan simpan halaman respons yang dipersonalisasi.
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(async () => (await caches.match("/")) || Response.error()));
    return;
  }
  const isStatic = /\.(?:js|css|svg|png|webp|woff2?|ico)$/.test(url.pathname);
  if (!isStatic) return;
  event.respondWith((async () => {
    const cache = await caches.open(STATIC_CACHE);
    const isEmptyStateWebP = /\/empty-states\/.*\.webp$/.test(url.pathname);
    const isValidWebP = (response) => /^image\/webp(?:\s*;|$)/i.test(response.headers.get("content-type") || "");
    const saved = await cache.match(request);
    // Hosting SPA bisa mengembalikan HTML 200 untuk gambar yang belum ada.
    // Jangan pernah memakai HTML yang terlanjur tersimpan sebagai WebP.
    if (saved && (!isEmptyStateWebP || isValidWebP(saved))) return saved;
    if (saved && isEmptyStateWebP) await cache.delete(request);
    const response = await fetch(request);
    if (response.ok && response.type === "basic" && (!isEmptyStateWebP || isValidWebP(response))) {
      // Jangan cache respons HTML atau JSON dengan URL berakhiran .webp.
      await cache.put(request, response.clone());
    }
    return response;
  })());
});

self.addEventListener("push", (event) => {
  event.waitUntil((async () => {
    let payload = {};
    try { payload = event.data?.json() || {}; } catch { /* teks cadangan */ }
    const scope = self.registration.scope;
    const icon = new URL("logo-sekolah-loading.png", scope).href;
    // Badge hitam "Amal Harian" mengikuti desain yang disetujui.
    // Ikon status bar tetap dibatasi ukuran fisik oleh Android.
    const badge = new URL("notification/amal-harian-status-v1.png", scope).href;
    await self.registration.showNotification(payload.title || "Mutabaah Yaumiah", {
      body: payload.body || "Ada pemberitahuan Mutabaah.", icon, badge,
      tag: payload.tag || "mutabaah-harian", renotify: false,
      data: {url: scope}
    });
  })());
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const url = self.registration.scope;
    const windows = await self.clients.matchAll({type:"window",includeUncontrolled:true});
    for (const client of windows) {
      if (new URL(client.url).origin === self.location.origin) {
        await client.focus();
        return;
      }
    }
    await self.clients.openWindow(url);
  })());
});
