# Backup pertama Mutabaah Yaumiah

Project yang benar: **vxfpwzevatwucvmeszen**. Tidak perlu menaikkan paket atau membuat branch untuk mengikuti persiapan ini.

1. Simpan salinan Storage yang sudah dibuat di folder privat permanen di luar repository, lalu buat salinan kedua di media lain. Lokasi Temp dan hasil pemeriksaan tercantum pada [laporan tahap 1–3](LAPORAN-LANJUTAN-TAHAP-1-3-20261019.md). Jangan mengunggah folder tersebut ke repository; isinya dapat memuat rapor/data pribadi. `private-inventory.json` diperlukan untuk mengembalikan nama berkas bernomor.
2. Buka dashboard Supabase dan pastikan Project ID tersebut. Periksa halaman **Database → Backups** untuk fasilitas unduhan yang tersedia pada akun. Jangan menekan Restore ke proyek aktif. Jangan membeli add-on atau membuat proyek baru untuk memaksakan tes.
3. Jika unduhan backup tidak tersedia, gunakan prosedur ekspor manual resmi dengan akses database yang dikelola pemilik. Informasi koneksi ada pada tombol **Connect**. Password dimasukkan hanya pada alat lokal yang sah; jangan kirim ke chat, menaruhnya di source/command line, atau meresetnya hanya untuk pengujian. Akses aplikasi Admin/MCP SELECT tidak menggantikan kredensial backup database.
4. Paket database harus mencakup data aplikasi, cakupan Auth yang benar, fungsi, RLS, trigger, constraints dan grants. Ekspor CSV tabel siswa saja belum cukup. Konfigurasi Auth, Edge Functions dan rahasianya ditangani terpisah secara privat; dump metadata Storage tidak berisi byte object.
5. Simpan file database di luar repository. Catat versi alat/server, waktu ekspor, Project ID, ukuran, SHA-256 dan hasil pemeriksaan daftar isi. Jangan menyalin isi Auth, kode aktivasi, JWT atau rahasia ke laporan umum.
6. Setelah paket tersedia, berikan **lokasi folder saja** untuk melanjutkan verifikasi/restore ke lingkungan lokal terisolasi yang sesuai. Tidak mengimpor ke produksi, tidak memakai --clean pada database aktif, dan tidak mengaktifkan pengingat/Cron/push.
7. Sesudah restore, bandingkan hash/jumlah data serta definisi/izin; uji layanan login dan object Storage pada lingkungan terisolasi. Restore fixture PostgreSQL atau menyalin byte file saja belum membuktikan pemulihan layanan Supabase lengkap.

Belum ada dump database/Auth produksi yang dibuat tahap ini. Salinan Storage aktual ada, tetapi perlu dipindahkan dari Temp ke penyimpanan permanen. RTO/RPO produksi belum ditetapkan atau diukur.

Dokumentasi resmi: [backup database](https://supabase.com/docs/guides/platform/backups), [backup/restore antarlingkungan](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore), [restore platform ke lingkungan sendiri](https://supabase.com/docs/guides/self-hosting/restore-from-platform). Tinjau bagian cakupan Auth/Storage dan penyesuaian versi sebelum eksekusi; panduan ini bukan perintah deployment atau pembelian layanan.
