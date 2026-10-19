# Reproduksi QA-06

Seluruh fixture SQL hanya untuk PostgreSQL lokal port 55436 database qa06_fixture. Tidak memakai Supabase produksi. PostgreSQL 18 dan Node tersedia lokal; tidak perlu Docker. Simpan folder bukti privat %TEMP%/CODEX-QA06-20261018 terlebih dahulu.

## Tes tanpa database
Jalankan `node --test scripts/qa06-regression.test.mjs`. Runner ini benar-benar memanggil empat fungsi tes QA-05 yang diekspor, serta dua kelompok regresi baru. Menjalankan modul QA-05 sebagai file node:test saja sebelumnya tidak menjalankan assertion ekspornya.

## Database terisolasi
Gunakan cluster kosong khusus QA, user qa06, port 55436, trust hanya loopback dan jangan membuka jaringan. Guard nama database/port ada pada fixture dan runner. Urutan yang dipakai:
1. scripts/qa06-postgres-fixture.sql.
2. Proposal asli supabase-proposals/qa05/review-and-apply.sql, lalu fixture jam lokal untuk pengujian 20.00 WIB. Versi asli diuji terlebih dahulu.
3. qa06-postgres.test.mjs (6 tes).
4. qa06-mutabaah-fixture.sql lalu qa06-mutabaah.test.mjs (7).
5. qa06-academic-fixture.sql lalu qa06-academic.test.mjs (4).
6. qa06-activation-fixture.sql lalu qa06-activation.test.mjs (1).
7. qa06-grading-fixture.sql lalu qa06-grading.test.mjs (2).
8. qa06-pagination.test.mjs (1), qa06-enrollment.test.mjs (1), qa06-load.test.mjs (1).
9. qa06-backup.test.mjs (1) terakhir. Memerlukan nama restore kosong; jangan menghapus database lama demi menjalankan ulang.

Jalankan setiap runner dengan node --test secara berurutan. Suite stateful tidak untuk dieksekusi paralel. Fixture minimum memakai prosrc RPC/trigger terpilih; auth.uid dan auth.users adalah stub lokal. Ini bukan runtime Supabase Auth, PostgREST atau Deno. Jam akademik memakai setting qa06.clock pada salinan fixture saja. Proposal enrollment diterapkan lokal oleh tes terakhir, jadi baseline mutabaah harus diuji sebelumnya atau pada cluster baru.

Dump akhir qa06-fixture-complete.dump di folder bukti dapat dipakai memeriksa keadaan akhir, bukan menjalankan ulang urutan baseline yang stateful. Seluruh fixture dan dump dipertahankan.

## Playwright
qa06-ui.playwright.mjs dijalankan melalui Playwright MCP browser_run_code_unsafe filename, membutuhkan Vite fixture 127.0.0.1:5174. Supabase dimock; 13 skenario termasuk timeout 15 detik, FIFO, draf memori dan pergantian akun.
qa05-ui-fixture.playwright.mjs memakai localhost:5173, seluruh push dimock.
qa06-ui-postgres.playwright.mjs memakai halaman fixture lokal dan akun UUID sintetis. Atur page.__qa06SqlStudent dan tanggal valid terlebih dahulu. Ambil payload dari page.__qa06Sql.pending, jalankan executeFixtureRequests pada qa06-ui-postgres-bridge.mjs lewat alat Node, lalu fulfill route. Jembatan ini tidak membuka listener dan hanya menerima RPC whitelist ke database fixture.
Untuk bridge lambat antaralat, pause jam Playwright agar keterlambatan alat tidak dianggap timeout aplikasi; pengujian timeout aplikasi dilakukan terpisah dengan jam berjalan.
Jangan memindahkan alur ini ke browser/sesi Admin asli.

## Batas bukti
30 tes top-level lulus dalam rangkaian. UI mock, UI ke fungsi PostgreSQL lokal dan pemeriksaan remote read-only dilaporkan terpisah. Jangan menyebut fixture sebagai bukti seluruh backend produksi lulus. Push fisik, real Auth recovery, render DOCX terbaru, backup penuh produksi dan upgrade PWA nyata tetap belum terverifikasi.
