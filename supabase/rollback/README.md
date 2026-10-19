# Rollback pasca-QA06

Tidak dijalankan otomatis. Jangan menghapus kolom/baris ledger atau subscription untuk rollback. Pengingat tetap OFF; jangan membuat Cron atau melakukan pengiriman percobaan.

1. Verifikasi project vxfpwzevatwucvmeszen dan status enabled=false. Ambil definisi dan hash terbaru sebelum intervensi.
2. Utamakan fix-forward. SQL postqa06.sql mengembalikan hanya delta tahap ini, mempertahankan guard laporan/penempatan yang sudah ada sebelum tahap ini, tetapi membuka kembali celah pada RPC tambahan; gunakan hanya untuk insiden nyata yang telah ditinjau.
3. Rollback mempertahankan lima kolom dan seluruh data ledger. EXECUTE lima RPC internal dicabut dari service_role sehingga sender baru fail-closed. Jangan mengaktifkannya kembali tanpa review.
4. Source Edge sebelum tahap ini tersimpan privat di folder bukti edges-before.json/edge-before. Bila perlu, deploy ulang source yang telah ditinjau dengan verify_jwt parent/admin=true dan reminder=false. Jangan menghapus env atau guard fail-closed versi 2.
5. Bandingkan hash data, Admin aktif, grants, kebijakan, enabled=false dan ledger setelah rollback. Tidak perlu mengubah password atau identitas Admin.
6. Jangan menjalankan SQL rollback melalui browser/client; gunakan operasi migrasi resmi yang disetujui.
