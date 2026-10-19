# Aturan kerja Codex — Mutabaah Yaumiah

## Mulai setiap pekerjaan besar

1. Baca file ini dan [docs/PROJECT_CONTEXT.md](docs/PROJECT_CONTEXT.md).
2. Periksa kode terbaru serta perubahan lokal sebelum merencanakan perubahan.
3. Bandingkan keputusan terdokumentasi dengan implementasi aktual. Kerjakan hanya selisih yang diperlukan.
4. Setelah selesai, perbarui konteks dengan perubahan nyata, bukti pengujian, batas verifikasi, dan pekerjaan berikutnya.

Instruksi pengguna yang berlaku mengungguli panduan repository. Jangan membatalkan keputusan lama secara diam-diam; catat keputusan pengganti beserta alasannya. Dokumentasi ini membantu kesinambungan konteks, bukan pengganti pemeriksaan kode.

## Identitas dan sumber kebenaran

- Proyek: **Mutabaah Yaumiah MTs Al-Khairiyah**.
- Stack: React, Vite, Supabase, Progressive Web App.
- Panel: Admin, Kepala Madrasah, Wali Kelas, Orang Tua/Wali.
- Satu-satunya Supabase remote yang diizinkan: **vxfpwzevatwucvmeszen**.
- Repository lokal terbaru adalah sumber kebenaran kode. Laporan, proposal, salinan kode dalam Markdown, berkas cadangan, ZIP, dan hasil build tidak boleh mengalahkan source terbaru.
- Kondisi backend aktual harus dibaca sebelum pekerjaan yang bergantung pada backend. Baseline historis di dokumen konteks bukan bukti kondisi remote saat ini.
- Jangan mengulang migrasi atau deployment yang sudah terpasang dan benar. Bandingkan definisi, versi, dan riwayat migrasi terlebih dahulu.
- Tugas dokumentasi saja tidak memerlukan akses Supabase.

## Fitur dan desain yang harus dipertahankan

- Desain premium hijau-putih, logo asli sekolah, dan tata letak yang disetujui.
- Ilustrasi masjid empat waktu WIB, animasi loading, font Arab Amiri, progress bar, serta bank kutipan Al-Qur'an terpusat.
- Autosave, finalisasi, pilihan tanggal, kondisi haid, dan pengisian beberapa anak dengan isolasi data yang benar.
- Fitur yang sudah berjalan tidak boleh dihilangkan saat memperbaiki fitur lain. Batasi perubahan pada cakupan tugas.
- Halaman Riwayat Perubahan sengaja dihapus berdasarkan keputusan pengguna; pertahankan audit internal. Jangan membuat ulang halaman tanpa permintaan baru.
- Panduan Aplikasi tetap dapat dibuka pada keempat panel, termasuk saat standalone. Tombol instal hanya ketika tersedia dan belum terpasang; tidak ada ajakan instal otomatis.
- Jangan menonaktifkan jam, animasi, loading, polling, atau mekanisme pembaruan hanya berdasarkan dugaan penyebab gangguan.

## Keamanan dan data

- Jangan menghapus data produksi, membersihkan data uji, mengganti kredensial Admin, atau memakai layanan berbayar tanpa persetujuan eksplisit yang sesuai.
- Lindungi akun Admin asli: identitas, kredensial, profil, hak akses, dan relasinya.
- Data yang mendahului pengujian harus dipertahankan. Penanda uji bukan izin menghapus.
- Bila pembuatan data uji diizinkan, gunakan identitas fiktif dan penanda run yang disepakati; catat ID serta relasi pada manifest terbatas. Jangan mengirim pesan ke nomor nyata.
- Jangan menaruh password, JWT, token, private key, isi rahasia .env, subscription endpoint, atau data pribadi siswa dalam dokumentasi konteks, log publik, maupun laporan.
- Jangan menyimpan respons Supabase pribadi atau kredensial di cache publik PWA. Pertahankan isolasi sesi, role, subscription, dan draf antar akun.
- Jangan memaksa reload saat pembaruan PWA atau menghilangkan draf yang belum tersinkronisasi.
- Pertahankan RLS dan pemeriksaan akun aktif, kepemilikan perangkat, serta penempatan siswa historis yang valid.

## Pengingat dan pengujian perangkat

- **Pengingat otomatis pukul 20.00 WIB tetap OFF sampai disetujui secara eksplisit.**
- Jangan mengaktifkan daily_reminder, Cron pengiriman, atau mengirim push nyata berdasarkan izin umum untuk bekerja.
- Pengujian Web Push pada HP Android/iPhone adalah **tahap paling akhir**, setelah pemeriksaan lokal dan backend yang relevan selesai.
- Gunakan perangkat uji yang diizinkan dan HTTPS untuk pengujian HP nyata. Localhost komputer bukan alamat HTTPS HP.
- Desktop, emulasi mobile, mock, dan fixture tidak membuktikan penerimaan push nyata, layar terkunci, atau kompatibilitas perangkat fisik.
- Jika perangkat nyata tidak tersedia, tandai **BELUM TERVERIFIKASI**. Jangan mengklaim mutabaah sepenuhnya offline bila penyimpanan dan sinkronisasinya belum terbukti didukung.

## Implementasi, pengujian, dan laporan

- Gunakan panduan bahasa Indonesia yang sederhana dan langkah demi langkah saat diperlukan.
- Perubahan kode harus disertai **kode lengkap setiap file yang berubah, siap replace**, bukan hanya patch. Jangan mengganti source lengkap yang diminta dengan ZIP.
- Periksa perubahan lokal pengguna; jangan menimpa pekerjaan di luar cakupan.
- Jalankan pengujian yang relevan dengan perubahan. Untuk perubahan aplikasi, jalankan npm run lint dan npm run build jika lingkungan memungkinkan; laporkan kegagalan atau penghalangnya dengan tepat.
- Bedakan pemeriksaan source, fixture/mock, database lokal terisolasi, remote read-only, dan pengujian end-to-end nyata.
- Laporkan file yang berubah, perilaku yang berubah, pengujian yang benar-benar dijalankan, hasilnya, dan hal yang belum terverifikasi. Jangan menyamakan lint/build lulus dengan fitur lulus end-to-end.
- Jangan mengulang seluruh QA yang telah selesai bila tugas hanya meminta perbaikan terbatas.
- Jangan mengakali penolakan pemeriksaan keselamatan. Jelaskan tindakan yang belum terpasang dan penyebabnya.

## Pemeliharaan konteks lintas klien

- Simpan keputusan, status terverifikasi, dan pekerjaan berikutnya di docs/PROJECT_CONTEXT.md; aturan tetap di file ini.
- Beri tanggal dan lingkup bukti. Tandai status historis yang telah digantikan agar proposal lama tidak dijalankan ulang.
- Tautkan laporan/manifest asli; jangan menyalin rahasia atau inventaris siswa ke konteks umum.
- Codex Mobile dan VS Code perlu menggunakan repository serta revisi terbaru yang sama. Kedua file ini tidak menyinkronkan perubahan lokal, sesi browser, atau kredensial secara otomatis.
- Jangan melakukan commit, push, atau deployment semata-mata untuk sinkronisasi dokumentasi tanpa instruksi yang sesuai.

## Pembersihan yang sudah diizinkan

Pada 19 Oktober 2026 pengguna memberikan izin khusus untuk menghapus seluruh data uji CODEX-UJI-20261016 serta satu pasangan siswa/orang tua awal, sambil melindungi Admin dan data sistem. Pembersihan satu kali tersebut telah dijalankan dan diverifikasi; lihat catatan terbaru PROJECT_CONTEXT. Izin historis ini bukan izin menghapus data nyata yang dimasukkan setelahnya atau menjalankan ulang skrip pembersihan. Laporan/manifest privat dan skrip operasional sekali pakai tidak dipublikasikan ke GitHub.
