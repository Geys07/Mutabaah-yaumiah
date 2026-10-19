# Backup dan restore QA-06

Project yang diizinkan: `vxfpwzevatwucvmeszen`. Status: dump dan restore fixture PostgreSQL lokal berhasil diuji. Backup database/Auth lengkap dan pemulihan layanan Supabase Storage BELUM TERVERIFIKASI. Salinan lima berkas Storage aktual beserta pemeriksaan hash berhasil dibuat pada lanjutan 19 Oktober 2026; lihat catatan terbaru di bawah. Snapshot hash QA bukan backup yang dapat direstore.

## Backup ringan dan gratis

1. Gunakan komputer Admin yang aman dan alat PostgreSQL resmi (`pg_dump`, `pg_restore`, `psql`) yang kompatibel dengan versi server. Docker tidak diperlukan. Periksa `--help` dan versi alat sebelum digunakan.
2. Ambil alamat koneksi dari dashboard proyek yang benar. Masukkan password lewat prompt atau pengelola kredensial; jangan menaruhnya pada command line, source, chat, atau laporan.
3. Simpan dump format custom di folder privat di luar source, misalnya folder backup terenkripsi dengan akses terbatas. Database mengandung data pribadi, kode aktivasi dan data Auth; jangan unggah ke repositori.
4. Untuk backup aplikasi, inventaris schema `public`, Auth, kebijakan, fungsi, trigger, grants, ekstensi dan metadata Storage. Backup schema `public` saja tidak cukup untuk memulihkan login. Rencana ekspor Auth harus mengikuti prosedur Supabase dan hak akses yang tersedia.
5. Ekspor object Storage secara terpisah menggunakan akses yang sah. Dump database tidak mencakup isi berkas Storage. Simpan inventaris path, ukuran dan SHA-256 secara privat. Logo tetap asli; arsip rapor tidak boleh dibuat publik.
6. Catat versi server/alat, waktu WIB/UTC, project ID, jumlah baris per tabel, SHA-256 dump, ukuran, hasil `pg_restore --list`, serta inventaris object. Jangan mencatat token atau password.
7. Simpan sedikitnya dua salinan privat pada media berbeda. Setelah backup pengujian, tetap simpan backup terakhir yang telah lolos restore. Retensi ditentukan Admin berdasarkan kebutuhan sekolah dan kapasitas media.

## Verifikasi dan restore

- Periksa exit code, ukuran bukan nol, checksum, daftar isi dump dan cakupan schema. Keberhasilan membuat file belum membuktikan restore berhasil.
- Restore HANYA ke database lokal kosong/terisolasi yang terverifikasi bukan produksi, dengan nama dan kredensial terpisah. Nonaktifkan pengiriman push, Cron dan koneksi keluar. Jangan gunakan `--clean` terhadap produksi.
- Siapkan dependensi Supabase/Auth/Storage yang diperlukan sesuai prosedur resmi. Database PostgreSQL kosong tidak otomatis mempunyai semua komponen Supabase.
- Setelah restore: bandingkan jumlah dan hash data, relasi, constraints, RLS, trigger, fungsi/grants; uji login fixture, isolasi peran, draf/finalisasi, arsip, dan object Storage. Pastikan reminder tetap OFF.
- Catat durasi restore dan kehilangan data maksimum yang dapat diterima berdasarkan interval backup. Nilai RTO/RPO belum diukur pada QA-06.

Restore fixture lokal dilakukan dengan PostgreSQL 18 pada 127.0.0.1:55436, tanpa Docker atau layanan berbayar. Pengujian membandingkan hash isi 25 tabel, definisi fungsi/grants dan kebijakan. Fixture berisi dependensi terpilih dan auth.users minimal, sehingga bukan bukti pemulihan penuh Supabase. Dump, checksum dan hasil lengkap disimpan privat di folder Temp CODEX-QA06-20261018. Tidak ada ekspor data pribadi produksi. Backup produksi masih memerlukan akses backup yang dikelola Admin dan prosedur pemulihan Auth serta object Storage.

Rujukan: https://supabase.com/docs/guides/platform/backups

## Bukti tambahan 19 Oktober 2026

Latihan `scripts/backup-restore-isolated.test.mjs` berhasil memulihkan fixture backend terbaru pada loopback ke database baru unik: 60 tabel/hash baris, definisi fungsi, RLS dan constraints cocok, sumber tidak berubah. Dump 438.478 byte dan durasi restore sekitar 3,343 detik adalah hasil mesin lokal, bukan RTO produksi. Uji berkas sintetis terpisah mendeteksi kerusakan melalui checksum dan memulihkan byte yang benar.

Ini tidak menggantikan status backup produksi BELUM TERVERIFIKASI. Tidak menguji login layanan Auth maupun transfer Storage API, tidak mengekspor rahasia produksi, dan tidak membuat project baru. Detail/hash/batas ada pada [laporan nomor 2–5](LAPORAN-AKSES-PEMULIHAN-BACKUP-KAPASITAS-20261019.md). Paket backup privat serta lingkungan pemulihan lengkap masih diperlukan untuk uji produksi yang sah.

## Lanjutan: salinan berkas Storage produksi aktual

Pada tahap 1–3, Admin berhasil mengunduh lima object nyata (3.838.617 byte) dari dua bucket. Seluruhnya disimpan di folder Temp privat di luar repository, disalin ke restore-check dan dibandingkan SHA-256 dengan hasil cocok. Inventaris privat memetakan berkas bernomor ke nama asli; jangan memindahkannya ke source atau membagikannya secara publik. Tidak ada upload/overwrite/delete remote atau perubahan logo.

Ini menggantikan status belum adanya salinan byte Storage, tetapi tidak membuktikan restore layanan Storage, dump database atau pemulihan Auth. Lokasi/batas ada pada [laporan tahap 1–3](LAPORAN-LANJUTAN-TAHAP-1-3-20261019.md). Salinan Temp perlu dipindahkan ke penyimpanan privat permanen dan salinan kedua; ikuti [panduan backup pertama](PANDUAN-BACKUP-PERTAMA.md). Pengguna belum memiliki paket backup database yang dapat dipakai untuk tes penuh.
