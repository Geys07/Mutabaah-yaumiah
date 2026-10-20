# Panduan hosting gratis, pemasangan PWA, dan Web Push

Proyek: Mutabaah Yaumiah MTs Al-Khairiyah. Diperiksa 20 Oktober 2026.

> **Kebijakan:** Hosting boleh disiapkan sebelum tes ponsel, tetapi pengingat otomatis 20.00 WIB dan pengiriman Web Push nyata wajib tetap OFF sampai pengguna menyetujuinya.

## A. Hosting React Vite di Cloudflare Pages

1. Pastikan branch `main` memuat source dan build lokal lulus: `npm ci`, `npm run lint`, `npm run build`.
2. Buka [Cloudflare Dashboard](https://dash.cloudflare.com/), daftar/login akun gratis.
3. Buka **Workers & Pages → Create application → Pages → Import an existing Git repository** (tampilan menu bisa berubah).
4. Hubungkan GitHub. Pilih hanya repository `Geys07/Mutabaah-yaumiah` bila memungkinkan.
5. Pengaturan:
   - Branch produksi: `main`.
   - Framework: React (Vite) atau Vite.
   - Build command: `npm run build`.
   - Build output directory: `dist`.
   - Root directory: `/` (akar repository).
   - Node.js: build image v3 Node 22 sudah cocok untuk Vite 8; jika perlu, gunakan `NODE_VERSION=22`.
6. Tambahkan environment variables pada **build/production**:
   - `VITE_SUPABASE_URL`: URL asli proyek Supabase (format `https://PROJECT_REF.supabase.co`).
   - `VITE_SUPABASE_PUBLISHABLE_KEY`: publishable key dari Supabase Dashboard.
   - **Jangan** memasukkan `service_role`, API secret, kunci privat VAPID atau `PARENT_REMINDER_SECRET` ke variabel yang dimulai `VITE_`.
7. Jalankan deploy. Catat URL HTTPS `https://nama-proyek.pages.dev` yang diberikan Cloudflare.
8. Buka URL tersebut dalam mode privat dan periksa login, logo, loading, navigasi, tanggal WIB dan arsip tanpa menyentuh data produksi untuk fixture. Tidak ada perubahan database otomatis akibat deploy.
9. Bila login/redirect menggunakan URL produksi, periksa **Supabase → Authentication → URL Configuration**. Ubah hanya URL yang diperlukan dan pertahankan alamat localhost/redirect resmi yang memang dipakai.
10. Uji keberadaan aset: `/manifest.webmanifest`, `/pwa/icon-192.png`, `/pwa/icon-512.png`, `/parent-push-sw.js`, `/pwa-assets.json`. Pastikan alamat Service Worker benar-benar memberi JavaScript, bukan HTML fallback.
11. Jangan membuat berkas `404.html` di root tanpa alasan: Cloudflare Pages menyediakan fallback SPA otomatis jika tidak ada berkas 404 di tingkat root. Jangan menambahkan catch-all redirect yang mengembalikan HTML untuk aset JavaScript dan manifest.

Deploy baru branch `main` umumnya otomatis memicu build Pages baru. Preview branch/PR mendapat alamat terpisah; jangan menggunakan preview untuk pendaftaran Web Push akun nyata tanpa memperhitungkan perbedaan origin dan izin perangkat.

## B. Cara memasang PWA Android

1. Buka **Google Chrome** pada Android (gunakan URL HTTPS Pages yang sudah aktif).
2. Pilih menu **⋮** → **Install app / Pasang aplikasi**. Jika yang tampil **Tambahkan ke Layar Utama**, ikuti petunjuk.
3. Konfirmasi. Ikon **Mutabaah** muncul di layar utama atau daftar aplikasi.
4. Buka dari ikon tersebut, bukan tab lama. Masuk dengan akun sesuai peran.
5. Di panel buka **Pengaturan → Panduan Aplikasi** untuk petunjuk bawaan.
6. Aktivasi notifikasi dilakukan **terpisah**, hanya pada tahap pengujian ponsel terakhir. Ketuk tombol aktivasi dengan sadar dan izinkan notifikasi Android ketika sudah tiba tahap itu.

Jika opsi Install app tidak muncul, pastikan URL HTTPS, manifest dan Service Worker benar, dan aplikasi belum terpasang. Menu dapat berbeda antarperangkat.

## C. Cara memasang PWA iPhone/iPad

1. Pastikan iOS/iPadOS 16.4+ jika membutuhkan Web Push.
2. Buka HTTPS aplikasi melalui **Safari**.
3. Ketuk ikon **Bagikan / Share** (pada versi Safari baru mungkin melalui tombol menu halaman → Bagikan).
4. Pilih **Tambahkan ke Layar Utama / Add to Home Screen**. Jika tidak tampak, gulir hingga bawah atau atur menu Bagikan.
5. Jika ada pilihan **Buka sebagai Aplikasi / Open as Web App**, aktifkan.
6. Ketuk **Tambah / Add**.
7. Buka lewat ikon Mutabaah di Layar Utama, bukan melalui tab Safari.
8. Masuk dengan akun sesuai peran. Pengaturan → Panduan Aplikasi tetap tersedia.
9. **Jangan** aktifkan Web Push sebelum tahap uji ponsel terakhir. Kelak, izin harus diminta dengan ketukan tombol langsung dari aplikasi yang terpasang; bukan otomatis di halaman Safari.

Bila notifikasi nanti tidak muncul, periksa Pengaturan iPhone → Notifikasi → Mutabaah, mode Fokus, dan kondisi perizinan PWA. Tidak memerlukan biaya Apple Developer Program untuk Web Push standar.

## D. Pengingat 20.00 WIB — belum diaktifkan

- PWA di-hosting pada Cloudflare Pages, sedangkan payload Web Push dikirim oleh Supabase Edge Function `parent-reminder-send`.
- Untuk penjadwalan gratis kelak, pilih **Supabase Cron** (`pg_cron` + `pg_net` + Vault), atau **Cloudflare Workers Cron** (Worker memanggil Edge Function dengan secret yang disimpan sebagai Worker Secret).
- 20.00 WIB = 13.00 UTC. Jadwal yang dijalankan platform bukan janji ketepatan sampai detik tertentu.
- Edge Function versi 3 sudah memiliki fail-closed, pemeriksaan tanggal/jendela, `confirm_send`, status DB dan ledger deduplikasi.
- **Saat ini:** `daily_reminder.enabled=false`, tidak ada Cron, tidak boleh membuat secret penjadwal yang diletakkan dalam repository publik.
- Jangan aktifkan scheduler sebelum uji fisik Android/iOS terakhir dan persetujuan eksplisit pengguna. Setelah disetujui, gunakan tes penerima terbatas dan dokumentasikan rollback; jangan menganggap dry-run sebagai bukti push diterima.

## E. Periksa sebelum digunakan orang tua

- Ketersediaan HTTPS, resolusi Android dan iPhone, icon, install mode, CORS jika ada error, manifest dan Service Worker.
- Login dan role empat panel; tidak ada data lintas keluarga/kelas.
- Koreksi dan finalisasi harian; backup database/Auth/Storage privat sebelum operasi nyata.
- Pastikan tidak ada rahasia dalam GitHub Public, build log, atau env `VITE_`.
- Jaga pengingat tetap OFF sampai rangkaian tes HP.

Rujukan resmi:
- https://developers.cloudflare.com/pages/framework-guides/deploy-a-react-site/
- https://developers.cloudflare.com/pages/configuration/build-image/
- https://developers.cloudflare.com/workers/configuration/cron-triggers/
- https://supabase.com/docs/guides/functions/schedule-functions
- https://support.google.com/chrome/answer/9658361
- https://support.apple.com/guide/iphone/open-as-web-app-iphea86e5236/27/ios/27
- https://webkit.org/blog/13878/
