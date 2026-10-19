# Runbook insiden dan rollback QA-06

## Tindakan awal

1. Catat waktu WIB/UTC, versi aplikasi, menu/peran terdampak dan kode error aman. Jangan menyalin JWT, password, HP, endpoint push atau payload siswa ke log umum.
2. Bila terindikasi salah akses, hentikan alur terdampak dan eskalasi kepada Admin berwenang. Frontend saja bukan pengaman RLS. Pembatasan server perlu review dependensi dan persetujuan terpisah.
3. Reminder tetap OFF. Jangan mengaktifkan Cron, mengirim canary atau mengulangi kiriman dengan hasil tidak pasti. Catat ledger secara READ-ONLY; jangan menghapus klaim untuk memaksa retry.
4. Jangan menghapus cache/data browser atau reload paksa jika draf belum tersimpan. Pastikan status penyimpanan dan minta pengguna mempertahankan tab.

## Rollback kode lokal

Snapshot sebelum edit berada di `%TEMP%/CODEX-QA06-20261018/snapshot`; `baseline.json` mencatat hash. Folder ini bukan backup database. Karena workspace belum mempunyai riwayat Git yang terverifikasi, jangan menjalankan reset/clean massal.

Bandingkan file yang diubah QA-06 dengan source sekarang. Simpan salinan source saat ini, lalu pulihkan hanya file yang disetujui dan belum mengandung perubahan pengguna berikutnya. Jalankan tes queue, reminder, lint/build dan UI terkait. Jangan menyalin seluruh laporan kode lama ke workspace sebagai baseline.

Tidak ada deployment atau migrasi remote QA-06, sehingga tidak ada rollback remote yang perlu dijalankan oleh pekerjaan ini. Jika proposal kelak diterapkan, rollback harus disusun terhadap baseline server saat itu, diuji di lingkungan terisolasi, dan tidak menghapus ledger/audit/arsip. Jangan mengembalikan reminder versi 2 ke versi 1.

## Pemulihan data

Ikuti PANDUAN-BACKUP-RESTORE.md. Restore pertama selalu terisolasi, validasi relasi dan hash, kemudian susun rencana pemulihan terpilih. Jangan restore dump lama langsung di atas produksi atau menghapus data yang dibuat setelah backup.

## Penutupan insiden

Catat dampak terverifikasi, dugaan yang belum terbukti, tindakan, bukti tes, dan persetujuan. Uji isolasi akun, draft/finalized, pengaturan reminder OFF, arsip, serta versi Service Worker. Beri status BELUM TERVERIFIKASI untuk bagian tanpa bukti.
