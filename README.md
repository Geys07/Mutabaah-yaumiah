# Mutabaah Yaumiah MTs Al-Khairiyah

Aplikasi React + Vite + Supabase dengan dukungan Progressive Web App untuk Admin, Kepala Madrasah, Wali Kelas, dan Orang Tua/Wali.

## Menjalankan secara lokal

1. Pasang Node.js yang kompatibel dengan versi Vite pada package-lock.json.
2. Jalankan `npm ci`.
3. Salin `.env.example` menjadi `.env.local`, kemudian isi URL dan **publishable key** proyek yang diizinkan. Jangan memasukkan service_role, secret key atau VAPID private key ke frontend.
4. Jalankan `npm run dev`, lalu buka alamat yang ditampilkan Vite.

```sh
npm run lint
npm run build
```

Hasil build berada di `dist/`; folder tersebut tidak disimpan di Git. `npm run preview` hanya untuk memeriksa build lokal, bukan server produksi.

## Konteks dan backend

Baca [AGENTS.md](AGENTS.md) dan [konteks proyek](docs/PROJECT_CONTEXT.md) sebelum mengubah source. Proyek Supabase yang diizinkan adalah `vxfpwzevatwucvmeszen`. Jangan menjalankan migrasi/deployment ulang tanpa membandingkan kondisi backend aktual; lihat [dokumentasi backend](supabase/README.md).

Tidak ada kredensial akun demo dalam repository. Laporan/manifest QA privat, backup, hasil browser, dan file environment tetap lokal. Tautan laporan historis dalam konteks dapat merujuk dokumen lokal yang sengaja tidak dipublikasikan.

Pengingat otomatis tetap OFF sampai disetujui secara eksplisit. Push ke repository tidak merupakan instruksi deployment atau aktivasi Cron. Pengujian push Android/iOS nyata dilakukan terakhir pada perangkat yang diizinkan. Jangan menganggap simulasi desktop sebagai bukti push nyata.

Panduan operasional: [Admin](PANDUAN-ADMIN.md), [backup](PANDUAN-BACKUP-RESTORE.md), dan [insiden/rollback](RUNBOOK-INSIDEN-ROLLBACK.md).
