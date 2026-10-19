# Backend terintegrasi pasca-QA06

Project produksi yang diizinkan: vxfpwzevatwucvmeszen. Dua migrasi dalam migrations sudah tercatat di produksi; versi filename diselaraskan dengan hasil MCP agar CLI tidak menganggapnya migrasi baru. Jangan mengulang db push tanpa memeriksa migration history. Tidak ada scheduler.

Functions parent-push/admin-push/reminder sudah versi 3. Parent/admin memakai verify_jwt=true; reminder mempertahankan autentikasi secret server sendiri dan verify_jwt=false. Config lokal tidak menyimpan kredensial. Pengiriman tetap memerlukan env true, setting DB true, confirm_send=true dan jendela WIB. Default dry-run hanya membaca; tidak mengklaim ledger, menghapus perangkat, atau mengirim.

## Tes terarah
Gunakan PostgreSQL lokal ringan di loopback 127.0.0.1:55436, user qa06 superuser fixture, database baru postqa06_fixture. Jangan gunakan nama/address produksi. Siapkan folder bukti privat %TEMP%/CODEX-PASCA-QA06-20261018.
1. Jalankan scripts/postqa06-fixture.sql pada database kosong tersebut. Isinya struktur/fungsi baseline terbaru yang dibaca, RLS dan grants, stub auth.uid/auth.users serta dua trigger audit/haid; tidak mengandung baris produksi atau password. Guard database/port wajib dipertahankan.
2. node --test scripts/postqa06-backend.test.mjs menanam identitas sintetis, mencatat manifest privat dan menguji empat kelompok. Hanya untuk fixture baru; jangan menjalankan ulang seeder pada database berisi data.
3. node --test scripts/postqa06-final.test.mjs scripts/postqa06-compat.test.mjs menguji enam kelompok pada fixture yang sama.
4. node --test scripts/postqa06-edge.test.mjs menguji tiga kelompok source functions terintegrasi dengan IO mock, tanpa push nyata.
5. node --test scripts/postqa06-device-owner.test.mjs menguji empat kelompok dengan PostgreSQL nyata lokal.
6. node --test scripts/postqa06-inactive-role.test.mjs menguji akun nonaktif untuk keempat peran, termasuk Orang Tua yang benar-benar berelasi dengan anak fixture.

postqa06-pg.mjs memakai protokol PostgreSQL text ke alamat/database fixture yang hardcoded, tanpa dukungan password/token/URL remote; ini menghindari overhead proses psql per assertion pada komputer ringan. Bukan Supabase Auth atau Deno emulator. Edge sudah dibangun/dideploy oleh Supabase; pengujian pengiriman nyata tetap tidak dijalankan.

## Operasi
Lihat rollback/README.md. Rollback tidak dijalankan. Tidak boleh menghapus ledger/subscription untuk mengatasi konflik. Registrasi lintas akun ditolak 409; akun/peran nonaktif ditolak 403. Trigger kedua tabel memakai lock endpoint yang sama untuk menutup race, bukan sekadar pengecekan sebelum upsert. Tidak ada daftar provider khusus Android: endpoint HTTPS standar Apple tetap diterima.

RPC-AUTHORIZATION-REVIEW.json menjelaskan pengecualian helper dan jalur definer, termasuk helper kalender yang sekarang internal. Tidak ada pencabutan EXECUTE massal terhadap has_role/is_staff atau trigger lama.
