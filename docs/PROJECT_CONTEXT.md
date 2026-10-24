# Konteks Proyek — Mutabaah Yaumiah MTs Al-Khairiyah

Pembaruan dokumentasi: **19 Oktober 2026**. Dokumen ini merangkum source dan laporan di repository. Tidak ada pemeriksaan remote atau pengujian aplikasi baru pada pekerjaan penyusunan konteks ini. Baca [aturan kerja](../AGENTS.md) sebelum pekerjaan besar.

## Identitas dan sumber kebenaran

- React + Vite + Supabase + Progressive Web App.
- Supabase remote yang diizinkan hanya **vxfpwzevatwucvmeszen**.
- Source lokal terbaru mengungguli proposal dan salinan kode dalam laporan. package.json dan lockfile mengatur dependensi aktual.
- Backend harus diverifikasi aktual sebelum perubahan yang bergantung padanya. Baseline 19 Oktober di bawah adalah historis, bukan pemeriksaan kesehatan langsung.
- Empat panel: Admin, Kepala Madrasah, Wali Kelas, Orang Tua/Wali.

## Struktur dan arsitektur aktual

| Area | Source utama dan tanggung jawab |
| --- | --- |
| Bootstrap dan akses panel | src/main.jsx, src/App.jsx; startup akun, lazy panel, Suspense dan PanelReadyGate |
| Admin | src/pages/AdminDashboard.jsx; halaman siswa, kelas, akun, akademik, rapor, notifikasi dan permohonan |
| Staf | src/pages/TeacherDashboard.jsx memilih PrincipalDashboard atau HomeroomTeacherDashboard berdasarkan role; Kepala Madrasah dan Wali Kelas memiliki panel berbeda |
| Orang Tua/Wali | src/pages/ParentDashboard.jsx, ParentCalendar.jsx, ParentDaily.jsx; anak terkait, tanggal, jawaban, haid dan finalisasi |
| Akun | src/lib/auth.js, appStartup.js; ParentActivation, ForgotPassword, AccountSecurity dan ParentPhoneChange |
| Simpan harian | src/lib/parentDaySaveQueue.js; antrean per akun/siswa/tanggal dan perlindungan pergantian sesi |
| Pembacaan besar | src/lib/pagination.js; batch maksimum 500, halaman umum 50; urutan stabil harus dijamin pemanggil |
| Notifikasi | src/lib/notificationRead.js; AdminNotifications, usePushDevice dan pushDevice |
| PWA | InstallAppSettings, OfflineStartup, PWAUpdateNotice; pwaPlatform/pwaInstall; public/manifest.webmanifest dan public/parent-push-sw.js |
| Visual | useJakartaClock, LoadingAnimation, AuthAmbient, TimeVideoBackground; bank kutipan src/data/islamicQuotes.js dan islamicQuotes.generated.json |
| Backend kanonis | supabase/migrations, supabase/functions, supabase/RPC-AUTHORIZATION-REVIEW.json dan supabase/rollback |

Berkas cadangan, halaman lama yang tidak dirutekan, dist, proposal, dan lampiran kode lengkap adalah referensi historis, bukan otomatis source aktif. project_id lokal pada konfigurasi CLI bukan pengganti ID remote yang diizinkan.

## Fitur dan keputusan yang dipertahankan

- Identitas sekolah, logo asli, desain premium hijau-putih, tata letak, masjid empat waktu WIB, Amiri, loading, progress bar dan bank ayat terpusat dipertahankan.
- Autosave, finalisasi, pilihan tanggal, haid dan pengisian beberapa anak harus tetap konsisten dan terisolasi.
- Impor Excel dan pembacaan melampaui 1.000 baris sudah pernah diperbaiki. Jangan mengubahnya untuk tugas yang tidak terkait. Tetap gunakan pagination server dan batch terurut untuk pembacaan besar.
- QA-02/QA-03 telah dinyatakan lulus dalam riwayat proyek. Halaman Riwayat Perubahan kemudian sengaja dihapus atas keputusan pengguna; audit internal tetap dipertahankan. Jangan memulihkan halaman dari laporan lama.
- Ketahanan notifikasi QA-04: maksimal dua retry tambahan, jeda 500/1.500 ms, hanya kegagalan sementara; bukan 401/403 atau abort disengaja. Pertahankan deduplikasi, penolakan respons usang, jumlah terakhir terverifikasi, dan pembatasan polling tab tersembunyi.
- Hotfix kedipan membuktikan pergeseran tata letak Admin akibat paragraf loading bersyarat saat polling/focus. Itu bukan bukti reload global. Jangan menonaktifkan jam atau animasi untuk dugaan kedipan.
- Menu install-app berlabel **Panduan Aplikasi** terpisah dari pengaturan lain dan tetap tersedia di empat panel, termasuk standalone. Status sudah terpasang boleh tampil; tombol instal tidak tampil ketika terpasang.
- Tidak ada popup, banner, toast instal berulang atau tombol mengambang. Android memakai event instal jika tersedia atau panduan Chrome; iOS/iPadOS memakai panduan Safari Bagikan → Tambahkan ke Layar Utama.
- Persiapan Service Worker/config push harus selesai sebelum aktivasi ditawarkan; kegagalan persiapan memiliki status dan coba lagi. Pertahankan user gesture Safari serta isolasi subscription antar akun.
- Startup offline dibatasi dan memiliki fallback/Coba Lagi, tanpa mengarang identitas akun. Tidak ada reload paksa saat pemulihan atau pembaruan PWA.
- Draf dalam memori tidak menjamin pemulihan setelah tutup/reload. Mutabaah sepenuhnya offline beserta sinkronisasi belum boleh diklaim tersedia.

## Baseline backend historis — 19 Oktober 2026

Status ACTIVE_HEALTHY berasal dari baseline pengguna dan laporan implementasi. Tidak diverifikasi ulang saat penulisan dokumen ini.

| Komponen | Kondisi terakhir yang terdokumentasi |
| --- | --- |
| Migrasi akun aktif/penempatan/ledger | 20261019020413_postqa06_active_accounts_enrollment_qa05 terpasang |
| Migrasi pemilik perangkat/kalender | 20261019022904_postqa06_device_owner_and_calendar_access terpasang |
| Edge Functions | parent-push, admin-push dan parent-reminder-send versi 3 |
| Ledger QA-05 | parent_reminder_deliveries berisi 11 kolom, termasuk claim_token, phase, attempts, lease_until, retry_safe |
| RPC internal pengingat | Lima RPC hanya untuk service_role |
| Kepemilikan perangkat | Dua trigger aktif; kepemilikan endpoint dijaga lintas tabel parent/admin |
| Otorisasi | has_role/is_staff mensyaratkan profil aktif; gate RPC dan RLS diperketat |
| Penempatan | Validasi tanggal historis, tahun ajaran dan enrollment pada jalur penyimpanan/finalisasi/haid |
| Pengingat otomatis | daily_reminder.enabled=false; tetap OFF |
| Scheduler | pg_cron dan pg_net belum aktif; tidak ada Cron pengiriman |

Lima RPC internal: list_parent_reminder_targets_page, parent_reminder_pending_qa05, claim_parent_reminder_qa05, begin_parent_reminder_qa05, finish_parent_reminder_qa05. Jangan membuka akses klien authenticated/anon ke RPC internal ini.

Pengamanan yang tercatat:

- Pemeriksaan aktif pada helper role dan RPC SECURITY DEFINER relevan; gate rapor yang sudah ada dipertahankan. Kebijakan aktif tambahan mencakup tahun ajaran, semester, kelas, kegiatan dan pembacaan permohonan nomor HP.
- submit_parent_mutabaah_day, save_parent_mutabaah_day, save_mutabaah_day dan set_parent_mutabaah_haid memeriksa satu penempatan yang valid pada tanggal terkait serta batas tahun ajaran. Koreksi historis valid dan siswa kembali tetap didukung; batas 30 hari WIB dipertahankan.
- enforce_push_subscription_owner_qa06 dengan postqa06_parent_device_owner dan postqa06_admin_device_owner melindungi pemilik/role aktif serta konflik endpoint. Tidak ada pemindahan subscription diam-diam.
- Akses klien ke mutabaah_ramadan_date_allowed dicabut secara terarah karena kebocoran informasi keberadaan jawaban; akses internal yang diperlukan dipertahankan.
- Pengiriman memerlukan pengaman berlapis: env pengiriman aktif, konfigurasi DB aktif, confirm_send, dan jendela 20.00–20.15 WIB. Dry-run tidak mengirim, membuat claim, atau menghapus perangkat.
- Masih ada tujuh catatan katalog definer anonim untuk helper role/trigger; jangan melakukan pencabutan massal yang merusak dependensi.

Laporan implementasi mencatat 30 tabel public dengan RLS, total 253 baris dan hash data pembanding tetap, satu Admin aktif, ledger kosong, serta nol konflik endpoint pada saat pemeriksaan. Angka ini adalah snapshot historis, **bukan jumlah yang wajib tetap pada pekerjaan mendatang**. Jangan menyalin identitas akun atau data siswa ke konteks ini.

Proposal QA-06 yang menyatakan backend belum dipasang sudah digantikan laporan implementasi 19 Oktober. Sebelum tindakan baru, bandingkan migrasi dan definisi aktual; jangan mengulang deployment.

## Bukti pengujian dan batas klaim

| Bukti terdokumentasi | Cakupan dan batas |
| --- | --- |
| QA-06 lokal | 30 pengujian Node top-level; 13 skenario ParentDaily mock; alur UI ke PostgreSQL native dengan Auth simulasi |
| Antarmuka | Empat panel pada 390/1280 px dan panduan Orang Tua 320 px; bukan perangkat fisik |
| Pagination | Fixture 1.305 baris dengan batch 500/500/305/0; tidak membuat 1.305 akun produksi |
| Akademik | Fixture native untuk penempatan, kembali, kenaikan/kelulusan, Ramadan, penilaian dan metadata arsip; tidak menyatakan semua alur cloud nyata lulus |
| Backup | Dump/restore fixture 25 tabel; bukan pemulihan penuh produksi Auth/Storage |
| Pasca-QA06 | 14 pengujian terarah: 6 native/kompatibilitas, 3 Edge dengan IO mock, 4 kepemilikan perangkat, 1 akun nonaktif lintas empat role |
| Produksi saat implementasi | Readback definisi/hash migrasi dan Edge Functions serta pemeriksaan read-only; bukan uji push HP nyata |
| Lint/build | Tercatat lulus pada laporan sebelumnya; tidak dijalankan ulang untuk tugas dokumentasi ini |

QA-06 awal berstatus parsial dalam cakupan keseluruhan. Pemasangan backend selanjutnya menyelesaikan backlog yang tercatat di laporan pasca-QA06, tetapi tidak mengubah mock menjadi bukti pengiriman nyata atau pengujian perangkat fisik.

Peringatan ukuran bank ayat sekitar 500 KB tercatat sebelumnya. Jangan menghapus/mengganti bank kutipan untuk menghilangkan warning tanpa tugas dan bukti yang sesuai.

## PWA, cache dan persistensi

- Manifest menggunakan id/start_url/scope root dan display standalone, ikon 192/512 serta maskable; ikon harus tetap memakai aset asli sekolah. Audit aset sebelum perubahan; jangan membuat logo pengganti.
- Standalone dideteksi dengan kemampuan browser dan fallback iOS. Tab Safari biasa tidak boleh menawarkan aktivasi push seolah mendukungnya; pandu instal Home Screen bila diperlukan.
- Dukungan Web Push iOS/iPadOS ditargetkan pada Home Screen Web App 16.4+ sesuai feature detection. Tidak membutuhkan akun Apple Developer atau aplikasi native.
- Shell offline tidak boleh menyimpan respons Supabase pribadi, JWT, password atau data siswa dalam cache publik.
- Aktivasi normal ditargetkan satu tindakan pengguna setelah persiapan selesai. Uji desktop/mock tidak membuktikan subscribe, background delivery, atau layar terkunci pada HP.
- Jangan menghilangkan draf demi pembaruan Service Worker. Pemulihan sesi tetap tunduk pada validitas sesi dan pemeriksaan akun server, bukan status akun yang dikarang saat offline.

## Manifest dan penyimpanan bukti

- Run pengujian: **CODEX-UJI-20261016**.
- [MANIFEST-QA06.json](../MANIFEST-QA06.json) dan [MANIFEST-IMPLEMENTASI-PASCA-QA06.json](../MANIFEST-IMPLEMENTASI-PASCA-QA06.json) mencatat fixture lokal dan menyatakan tidak ada baris remote baru dalam pekerjaan tersebut.
- ID fixture lokal bukan target pembersihan produksi. Data uji lama dari tahap lain tetap harus dipertahankan sampai ada izin pembersihan eksplisit dan pencocokan manifest.
- Tidak ada password, token, endpoint subscription atau inventaris pribadi yang perlu disalin ke dokumen ini.
- Sebagian bukti historis tersimpan di folder sementara Windows di luar repository; mungkin tidak tersedia pada Mobile/checkout lain. Laporkan ketidaktersediaan, jangan mengarang hasil atau menyalin rahasia.
- Fixture PostgreSQL bukan emulator lengkap Supabase Auth. Jangan menjalankan ulang seeder stateful secara membabi buta; ikuti panduan fixture dan pastikan target lokal terisolasi.

## Pekerjaan berikutnya dan batasannya

1. Sebelum tugas backend baru, lakukan pemeriksaan read-only aktual pada project yang diizinkan; bedakan kondisi baru dari snapshot ini. Tidak ada alasan melakukan migrasi ulang hanya karena proposal lama tersedia.
2. Lengkapi pengujian cloud Auth/login/logout, pemulihan dan permohonan perubahan nomor HP secara terkendali bila diminta; jangan mengubah kredensial Admin asli.
3. Verifikasi rendering rapor DOCX/A4 terbaru, matriks target/bobot, akses objek Storage privat, serta kebutuhan penyimpanan foto. Keberhasilan metadata fixture belum membuktikan semua objek cloud.
4. Uji restore produksi lengkap Auth/Storage, RTO/RPO dan kuota/egress hosting bila diotorisasi. Restore fixture tidak cukup sebagai bukti pemulihan produksi.
5. Uji pembaruan PWA nyata dengan draf belum tersinkronisasi, performa perangkat rendah dan safe-area. Gangguan kedipan global perlu reproduksi terukur bila masih muncul.
6. Catatan historis dua siswa aktif tanpa wali memerlukan penanganan Admin lewat alur yang sah; jangan membuat relasi atau menaruh identitasnya dalam konteks umum.
7. **Tahap paling akhir:** pengujian fisik Android Chrome dan iOS/iPadOS Safari: instal, standalone, izin ditolak/diaktifkan, push aplikasi tertutup/layar terkunci, offline, logout/login dan upgrade. Gunakan HTTPS serta perangkat uji yang disetujui. Status saat ini **BELUM TERVERIFIKASI** pada perangkat nyata.

Persetujuan push uji tidak otomatis mengizinkan pengingat terjadwal. Pengingat 20.00 WIB tetap OFF; tidak ada pembersihan data otomatis.

## Rujukan utama dan urutan keputusan

- [Laporan implementasi pasca-QA06](../LAPORAN-IMPLEMENTASI-PASCA-QA06.md): pemasangan aktual 19 Oktober, hash dan bukti terarah; menggantikan status proposal belum terpasang.
- [Dokumentasi Supabase](../supabase/README.md), [tinjauan otorisasi RPC](../supabase/RPC-AUTHORIZATION-REVIEW.json), dan folder supabase/rollback: source/backend serta prosedur rollback yang harus ditinjau sebelum digunakan.
- [QA-06 final](../LAPORAN-QA06-FINAL.md): matriks historis dan batas pengujian lokal; bukan perintah menjalankan ulang seluruh QA.
- [Penyempurnaan PWA](../LAPORAN-PENYEMPURNAAN-PWA.md): panduan tetap tersedia, persiapan push dan fallback offline; menggantikan kekurangan yang dicatat laporan PWA sebelumnya.
- [Perbaikan Push/PWA](../LAPORAN-PERBAIKAN-PUSH-PWA.md) dan [hotfix kedipan](../LAPORAN-HOTFIX-KEDIPAN.md): bukti serta keputusan sebelumnya dengan cakupan masing-masing.
- [Panduan Admin](../PANDUAN-ADMIN.md), [backup/restore](../PANDUAN-BACKUP-RESTORE.md), [runbook insiden](../RUNBOOK-INSIDEN-ROLLBACK.md), [kuota gratis](../CHECKLIST-KUOTA-GRATIS.md), [panduan pengujian QA06](../scripts/QA06-TESTS.md).

## Pemeliharaan dan serah-terima

Pada setiap pekerjaan besar: baca kedua dokumen, bandingkan dengan source, kerjakan perubahan yang diperlukan, lalu catat tanggal, file/perilaku yang berubah, lingkungan pengujian, hasil aktual, keterbatasan dan langkah berikutnya. Tambahkan keputusan pengganti dengan alasan; jangan membuang sejarah yang masih relevan.

Mobile dan VS Code harus memakai repository/revisi terbaru yang sama. File ini tidak otomatis memindahkan source lokal, sesi browser atau kredensial. Jangan melakukan commit/push tanpa instruksi yang sesuai.

### Catatan 19 Oktober 2026 — dokumentasi permanen

AGENTS.md dan docs/PROJECT_CONTEXT.md sebelumnya tidak ada, lalu dibuat dari source, laporan dan ringkasan manifest yang tersedia. Hanya dokumentasi konteks yang berubah. Tidak mengakses Supabase remote, mengubah fitur/data/Edge Functions, melakukan deployment, atau menjalankan ulang QA/lint/build. Baseline backend dan hasil tes di atas tetap berlabel historis.

### Catatan 19 Oktober 2026 — lanjutan pengujian akun

Lihat [laporan lanjutan akun](../LAPORAN-LANJUTAN-AKUN-PASCA-QA06.md). Pemeriksaan MCP read-only baru mengonfirmasi ACTIVE_HEALTHY, dua migrasi terpasang, tiga Edge push/pengirim versi 3, daily_reminder.enabled=false, serta tidak adanya ekstensi pg_cron/pg_net. Ini pembacaan aktual pada tahap tersebut, bukan jaminan kondisi selamanya.

Pengujian akun end-to-end masih TERHALANG: Playwright MCP tidak tersedia, inventaris browser kosong, dan in-app browser tidak tersedia. Vite berhasil dijalankan pada loopback port 5173; HTTP root 200, tetapi render UI/sesi login belum terverifikasi. Tidak membuat atau mengubah akun/data; manifest tidak mendapat ID baru. Tidak menjalankan lint/build karena source aplikasi tidak berubah.

Temuan aktual untuk pekerjaan berikutnya:

- parent-phone-change v1 dapat langsung mengirim push ke Admin setelah permohonan berhasil dan menghapus subscription 404/410; daily_reminder OFF tidak menonaktifkan jalur ini. Pengujian positif ditunda sampai penerima/lingkungan uji terisolasi dan sesuai keputusan pengujian HP terakhir. Tidak ada push yang dikirim tahap ini.
- list_password_reset_requests masih memiliki LIMIT 300, sedangkan UI melakukan filter/count/range di luar RPC. Potensi pemotongan daftar perlu uji fixture dan perbaikan terpisah; belum membuat ratusan permintaan atau mengubah SQL.
- Grant lima RPC internal akun diperiksa service_role-only; pembaca permintaan memeriksa Admin aktif. Ini bukti metadata/source, belum pengujian akses dengan sesi pengguna nyata.

### Catatan 19 Oktober 2026 — browser pulih dan akun diuji end-to-end

Penghalang browser pada catatan sebelumnya telah teratasi: Playwright MCP tersedia dan dashboard Admin dapat dibuka. [Laporan lanjutan akun](../LAPORAN-LANJUTAN-AKUN-PASCA-QA06.md) kini memuat hasil cloud nyata, bukan hanya pemeriksaan source.

- Pemulihan Wali 3 melalui permintaan, persetujuan Admin dan redeem berhasil; kode used ditolak saat dicoba ulang. Password akun uji tersebut berubah secara sengaja melalui alur resmi, tanpa mengubah identitas/role.
- Login salah ditolak, login benar berhasil, logout kembali ke login dan reload mempertahankan sesi. Sesi Admin asli tetap aktif pada konteks terpisah.
- Satu siswa/kontak/akun wali baru dibuat untuk uji aktivasi, dengan marker run yang sama. Aktivasi, relasi anak yang tepat, penolakan kode used, perubahan password melalui Profil serta penolakan password lama berhasil diuji.
- Client Orang Tua tidak menerima data pemulihan Admin atau siswa milik wali lain; RPC persetujuan Admin ditolak 42501. Ini tidak menggantikan pengujian semua role/nonaktif pada cloud.
- Baseline profil/role Admin, app_settings, sembilan siswa lama dan delapan role lama identik. Tidak ada source/config/backend deployment berubah, push nyata atau pembersihan. Pengingat tetap OFF.
- [Manifest tambahan akun](../MANIFEST-QA-AKUN-20261019.json) mencatat ID/relasi baru dan perubahan akun uji. Manifest historis dipertahankan. Rahasia tidak dicatat.
- Profil diperiksa pada 390/1280 px tanpa overflow. Popup ajakan push muncul otomatis setelah login dan dipilih Nanti saja; berbeda dari ajakan instal PWA. Console Admin mencatat gangguan koneksi pada dua pembaca notifikasi, lalu pembacaan berhasil; akar jaringan belum terbukti.

Status keseluruhan akun tetap PARSIAL: perubahan nomor HP positif ditunda karena efek pengiriman push nyata, dan cabang kedaluwarsa/konkurensi/reject/revoke/reissue serta semua role cloud belum diuji dalam tahap ini. Lint/build tidak diulang karena source tidak berubah. Pengujian perangkat fisik tetap paling akhir.

### Catatan 19 Oktober 2026 — pagination pemulihan diperbaiki

[Laporan pagination pemulihan](../LAPORAN-PAGINATION-PEMULIHAN.md) menggantikan status temuan LIMIT 300 yang belum diperbaiki pada catatan akun di atas. Pemeriksaan remote aktual mengonfirmasi batas tersebut, lalu migrasi baru **20261019072131_password_reset_requests_pagination** diterapkan hanya pada project yang diizinkan. LIMIT internal dihapus; urutan ID ditambahkan. Signature, masking, gate Admin aktif dan ACL tetap dipertahankan. Tidak mengubah source frontend atau mengulang migrasi lama. Nama versi lokal diselaraskan dengan riwayat MCP remote agar tidak terjadi migrasi duplikat.

Bukti: satu tes Node SQL native dengan 1.305 permintaan fiktif dalam schema/transaksi terisolasi pada postqa06_fixture:55436. Versi lama membaca 300 dan menyembunyikan processing; versi baru membaca 1.305 melalui 27 halaman tanpa ID ganda, pending 350, processing 50 dan halaman terakhir 5. Masking dan penolakan gate non-Admin/nonaktif diuji memakai stub Auth lokal. Semua fixture di-ROLLBACK. npm run lint dan npm run build lulus. Definisi remote cocok dengan body source lokal; ACL tetap, anon tidak memiliki EXECUTE, tanpa sesi mengembalikan nol baris. Hash tiga baris permintaan cloud sebelum/sesudah identik; bukan checksum seluruh database. Security advisors sebelum/sesudah memiliki kategori/jumlah sama, termasuk catatan historis yang belum diselesaikan.

Berkas baru: migrasi tersebut, supabase/rollback/password_reset_requests_pagination.sql, scripts/password-reset-pagination.test.mjs, dan laporan. Konteks ini ditambah; dist lokal dihasilkan ulang oleh build, tanpa deployment frontend. Tidak membuat data uji cloud, mengubah kredensial, mengirim push, melakukan pembersihan atau commit/push. daily_reminder.enabled=false pada readback akhir.

Batas: pagination >300 belum diuji lewat browser/PostgREST cloud; fixture Auth bukan bukti semua role cloud. Git status tidak tersedia karena folder tidak dikenali sebagai repository Git. Berikutnya tetap cabang akun kedaluwarsa/konkurensi/reject/revoke/reissue dan role cloud secara terkendali, lalu rapor/Storage/PWA sesuai daftar di atas. Perubahan nomor HP positif harus mengisolasi efek push; HP fisik tetap tahap terakhir.

### Catatan 19 Oktober 2026 — cabang akun diuji pada fixture terisolasi

[Laporan cabang akun](../LAPORAN-CABANG-AKUN-20261019.md) mencatat **17 tes lulus: 11 PostgreSQL native lokal dan 6 handler Edge dengan IO mock**. Source remote aktual dibaca read-only: password-recovery v3, recovery-admin v1 dan tujuh definisi SQL; snapshot disimpan di scripts/fixtures/account-recovery-20261019.json khusus pengujian, bukan source deployment kanonis. Hash tujuh definisi SQL cocok pada readback akhir. ACL empat RPC internal tetap service_role/postgres; pengingat harian false. Tidak ada mutasi akun/data/config remote, deployment, push atau pembersihan.

Cakupan lokal: claim serentak satu pemenang, lima kode salah serentak mencabut kode, pemilik token finalisasi, retry setelah p_success=false, reissue/reset attempts dan penolakan hash lama, race reissue/revoke dengan claim, cancel-stuck, aktivasi expired tanpa perubahan parsial, aktivasi serentak dan replay, serta penolakan role authenticated lokal. Mock handler mencakup reject/revoke, approve serentak, reissue, gate Admin aktif dan cancel-stuck. Stub Auth, tabel minimum/ACL fixture dan mock Edge tidak menggantikan Supabase Auth/RLS/PostgREST atau sesi cloud nyata.

Temuan kebijakan: **aktivasi memiliki expires_at; pemulihan password saat ini tidak memiliki TTL**. Kode approved berumur 365 hari tetap dapat diklaim pada fixture. Ini karakterisasi implementasi, bukan klaim expired pemulihan lulus atau persetujuan kebijakan tanpa TTL. Keputusan batas waktu kode pemulihan perlu ditentukan terpisah; tidak diubah diam-diam.

Berkas baru: scripts/account-recovery-branches.test.mjs, snapshot source fixture, scripts/fixtures/account-recovery-local-run.json dan laporan. Manifest mempertahankan tiga schema fixture lokal beserta ID/relasi sintetis dari run harness; bukan target pembersihan produksi. Satu kegagalan izin penyiapan fixture dan satu kesalahan sintaks harness diperbaiki; versi final 17/17 lulus. Source aplikasi/dependensi tidak berubah, sehingga lint/build tidak diulang; hasil tahap sebelumnya tetap terpisah. Git status tetap gagal karena folder bukan repository Git yang dikenali.

Status akun keseluruhan tetap PARSIAL: cabang ini belum diuji melalui browser/cloud Auth nyata, seluruh role cloud belum lengkap, nomor HP positif masih memerlukan isolasi efek push. Berikutnya evaluasi keputusan TTL, lengkapi bukti cloud secara terkendali, lalu rapor/Storage/PWA sesuai backlog. HP fisik tetap tahap terakhir dan pengingat 20.00 WIB tetap OFF.

### Keputusan pengguna 19 Oktober 2026 — kode pemulihan tanpa kedaluwarsa waktu

Pengguna menetapkan kode pemulihan password tidak memiliki masa kedaluwarsa waktu agar wali sempat membukanya. Setelah pemulihan berhasil, kode wajib tidak dapat dipakai lagi. Ini menggantikan status keputusan TTL yang masih terbuka pada catatan cabang akun di atas. Implementasi tanpa TTL dipertahankan; status used menolak penggunaan ulang, dibuktikan pada pengujian cloud historis dan fixture terbaru sesuai lingkup masing-masing. Reissue, revoke dan batas percobaan salah tetap berlaku. Keputusan ini khusus kode pemulihan, tidak mengubah expires_at kode aktivasi.

Pengguna kemudian mengizinkan pengujian akun cloud lanjutan dengan memakai akun uji lama atau membuat akun fiktif baru. Perlindungan Admin asli, manifest run CODEX-UJI-20261016, larangan pembersihan, isolasi efek push nomor HP dan pengingat harian OFF tetap berlaku. Pada persiapan tahap ini backend ACTIVE_HEALTHY, tujuh akun berpenanda uji aktif ditemukan, dan empat RPC internal pemulihan tetap service_role-only. Vite di loopback port 5173 merespons HTTP 200. Browser pengujian berhasil membuka formulir login setelah pemulihan koneksi; sesi Admin lama tidak tersedia pada tab baru. Login Admin oleh pengguna sedang diperlukan sebelum pengujian review melalui UI dapat diteruskan. Belum ada mutasi cloud pada persiapan ini; jangan menafsirkan preflight sebagai hasil E2E baru.

### Catatan 19 Oktober 2026 — rapor Storage dan review akun cloud

Sesi Admin tersedia saat dibuka ulang melalui Playwright; penghalang login pada catatan persiapan di atas sudah teratasi untuk tahap ini. [Laporan rapor/Storage](../LAPORAN-UJI-RAPOR-STORAGE-20261019.md) mencatat uji cloud nyata, bukti dan batasnya. Backend ACTIVE_HEALTHY.

- VIII B hanya satu siswa simulasi: nilai 13/39 = 33,33%, D, KKM 70. Hitung ulang independen cocok. Unduh DOCX, arsip privat, unduh arsip dan deduplikasi berhasil; satu arsip baru, arsip lama tidak diubah.
- Cetak HTML asli aplikasi menghasilkan satu halaman A4 yang sudah diraster dan diperiksa visual. DOCX native belum terverifikasi: soffice.exe tidak tersedia. Struktur/isi DOCX saja tidak membuktikan layout Word.
- BUG BARU QA-RAPOR-SEMESTER-01: ganti semester lalu kembali ke semester aktif menampilkan data tetapi menyembunyikan Unduh/Cetak. Server can-write masih true. changeSemester mereset canCreate sedangkan efek izin hanya bergantung classId. Belum diperbaiki; jangan menyatakan rapor lulus penuh. Memilih ulang kelas memulihkan tombol.
- Anonim/Orang Tua tidak memperoleh file privat; pembaca rapor kelas menolak Orang Tua. Role staf cloud/matriks seluruh konfigurasi masih belum lengkap. Mobile 390 px tanpa overflow.
- Cabang akun cloud Tolak, Cabut, Terbitkan Kode Baru kini berhasil pada akun Wali Aktivasi QA-AKUN: kode lama setelah reissue ditolak 400, kode baru diterima 200. Tiga permintaan baru berakhir rejected/revoked/used. Password hanya akun uji dipulihkan agar dapat menguji akses Orang Tua. Race/cancel-stuck cloud tetap belum diuji.
- [Manifest tambahan rapor/Storage](../MANIFEST-QA-RAPOR-STORAGE-20261019.json) mencatat arsip/objek dan tiga permintaan. Tidak menyimpan rahasia atau membersihkan data. Hash semua siswa, profil Admin, pengaturan, grading dan metadata tiga arsip lama identik dengan baseline tahap ini.

Tidak mengubah source aplikasi/SQL/RLS/Edge Functions/template/logo atau melakukan deployment. Helper inspeksi lokal dan bukti artefak ditambahkan; kode helper lengkap ada di laporan. Lint/build tidak diulang karena source aplikasi tidak berubah. Pengingat tetap false. Prioritas berikutnya perbaikan bug semester dalam tugas implementasi yang diizinkan dan verifikasi Word, lalu backlog PWA/backup/kapasitas. HP/push tetap terakhir.

### Catatan 19 Oktober 2026 — implementasi lanjutan dan Ramadan

Pengguna mengizinkan memperbaiki bug dan menyelesaikan implementasi tersisa. [Laporan implementasi lanjutan](../LAPORAN-IMPLEMENTASI-LANJUTAN-QA-RAMADAN.md) menggantikan status bug semester belum diperbaiki di atas. `ReportCards.jsx` kini mempertahankan izin kelas ketika semester berubah; pemeriksaan server tetap berlaku. Playwright Admin nyata membuktikan tombol Unduh/Cetak pulih setelah kembali dari semester mendatang, tanpa memilih ulang kelas.

Kekurangan PWA yang terbukti juga diperbaiki: worker output build sebelumnya identik dengan sumber ber-versi tetap. Plugin `scripts/pwa-build.mjs` kini memberikan revisi deterministik sesuai isi bundle/worker melalui `vite.config.js`. Sumber worker publik, cache privacy dan perilaku menunggu klien lama dipertahankan; tidak menambah reload/skipWaiting. Uji dua rilis dengan worker native pada fixture loopback membuktikan worker B menunggu, draf teks sintetis tetap ada, nol navigasi otomatis dan shell B terbuka offline setelah klien A ditutup. Ini bukan bukti Mutabaah sepenuhnya offline atau uji HP fisik.

Rapor Ramadan sudah terimplementasi pada backend/frontend aktual; tidak mengubah SQL/template. Tes definisi produksi yang disalin ke transaksi PostgreSQL lokal mencakup tujuh kegiatan Ramadan, haid, finalisasi, enrollment/semester, historis dan gate Auth stub. Semua fixture di-ROLLBACK. Playwright terisolasi membuktikan tujuh judul Ramadan + empat bonus biasa pada DOCX/cetak, deduplikasi, kelas ditolak dan 390 px tanpa overflow; nol request Supabase. PDF HTML satu A4 diraster/diperiksa. Render Word native tetap BELUM TERVERIFIKASI.

Lint/build lulus; empat tes Node terkait worker/Ramadan/queue lulus. Peringatan chunk bank ayat tetap dicatat. Tidak mengulang migrasi/backend yang sudah terpasang. Remote hanya SELECT/metadata; hash settings/grading/students/archives identik sebelum/sesudah, daily_reminder false, periode Ramadan nol. Tidak membuat ID remote, push, deployment atau pembersihan. [Manifest tahap ini](../MANIFEST-IMPLEMENTASI-QA-RAMADAN-20261019.json) dan [kode lengkap](../KODE-LENGKAP-IMPLEMENTASI-QA-RAMADAN.md) menyimpan daftar/hash source dan bukti tanpa rahasia.

Backlog yang memerlukan bukti tambahan: render Word, matriks role/race cloud terkendali dan perubahan nomor HP dengan push diisolasi, backup/restore privat Auth/Storage, kapasitas hosting/perangkat rendah; Android/iOS nyata via HTTPS tetap paling akhir. Kalender Ramadan produksi belum dikonfigurasi, bukan diisi otomatis untuk menguji. Tidak menyatakan semua QA lulus universal; proposal lama tidak mengalahkan backend terpasang. Kode pemulihan tanpa TTL tetap keputusan pengguna; halaman riwayat tetap sengaja tidak dibuat ulang.

### Catatan 19 Oktober 2026 — nomor 2–5 akses, pemulihan, backup dan kapasitas

Keputusan terbaru pengguna: verifikasi rapor Word ditunda sampai sebelum uji HP. Fokus sekarang akses peran, pemulihan akun, backup/restore dan kapasitas; tidak melanjutkan HP/push. [Laporan rinci](../LAPORAN-AKSES-PEMULIHAN-BACKUP-KAPASITAS-20261019.md) mencatat bukti dan batas.

Cloud aktual: Admin dan Orang Tua uji membuktikan isolasi siswa/permintaan Admin; RPC claim internal menolak semua sesi aplikasi 42501. Satu guru uji baru dibuat melalui alur resmi lalu dinonaktifkan; sesi yang sudah terbit berubah is_staff true menjadi false, tanpa akses siswa/kelas/permintaan. Anonim tidak memperoleh siswa dan RPC kelas ditolak. Sesi Kepala Madrasah uji cloud belum tersedia; penugasan positif guru diuji lokal, bukan mengubah penugasan operasional. Hash tiga gate lokal cocok dengan body produksi saat pemeriksaan.

Bug baru yang terbukti: Wali Kelas tanpa kelas terus loading karena loadingReport awal true dan efek berhenti ketika classId kosong. HomeroomTeacherDashboard.jsx diperbaiki terbatas: loading awal false, menjadi true saat loadReport dijalankan. Playwright source aktual dengan mock mengonfirmasi pesan tanpa kelas dan kelas kosong; desain/izin/backend tetap.

Satu permintaan pemulihan baru pada Orang Tua uji diuji cloud: dua approve serentak menghasilkan 200/409; dua revoke serentak 200/409; cancel-stuck pada status yang tidak sesuai 409. Status akhir revoked, tidak dihapus, password tidak diganti. Cancel-stuck positif cloud belum diuji dengan sengaja merusak Auth. 17 tes pemulihan SQL/handler lokal kembali lulus. Saat alat browser berganti sempat about:blank, sesi Admin pulih dari penyimpanan browser setelah localhost dibuka, tanpa membaca token/reset kredensial.

Latihan backup baru: dump/restore database sintetis postqa06_fixture ke database unik lokal; 60 tabel/hash, fungsi, RLS dan constraints cocok, sumber tetap identik. Dua tes backup lulus termasuk deteksi kerusakan/salinan byte berkas sintetis. Bukti privat di Temp, bukan backup produksi; layanan Auth/Storage API asli belum dipulihkan. Akses paket backup privat masih diperlukan untuk membuktikan restore penuh.

Kapasitas: SQL 1.305 permintaan/27 halaman dan 32 baca concurrency 4 lulus; p50 482 ms/p95 835 ms termasuk overhead psql lokal. Playwright 1.305 siswa memori menguji awal/tengah/akhir, pencarian setelah baris 1.000, filter, pembaca ekspor lengkap, loading/error dan filter cepat; tanpa request remote/akun massal. Ini bukan uji MAU/egress/hosting atau HP lambat. Total Node 22 lulus pada perintah terpisah; lint/build lulus. Warning chunk ayat dan plugin timings tetap dicatat.

Tidak mengubah data siswa/arsip/config/Admin: hash lingkup tersebut dan empat app_settings identik sebelum/sesudah. daily_reminder tetap false, pg_cron/pg_net tidak aktif. [Manifest tambahan](../MANIFEST-QA-2-5-20261019.json) menyimpan ID guru/permintaan baru dan database fixture yang dipertahankan; tanpa rahasia/pembersihan/deployment. [Kode lengkap](../KODE-LENGKAP-QA-2-5-20261019.md) memuat source/helper penuh. Status keseluruhan tetap PARSIAL untuk matriks cloud lengkap, cancel-stuck positif cloud, backup Auth/Storage produksi dan kapasitas hosting nyata. Rapor Word kemudian, HP fisik paling akhir.

### Catatan 19 Oktober 2026 — lanjutan tahap 1–3 dan keputusan rapor

Pengguna menyatakan rapor Word sudah pernah diperiksa dan sesuai; pemeriksaan tambahan rapor ditunda sampai diperlukan setelah deployment. Ini hasil pengguna, bukan tes Word baru oleh Codex. Menggantikan prioritas verifikasi Word sebagai penghalang melanjutkan tahap ini. HP/push tetap paling akhir.

[Laporan tahap 1–3](../LAPORAN-LANJUTAN-TAHAP-1-3-20261019.md) menambah bukti nyata, bukan mengulang 22 tes sebelumnya. Akun Kepala Madrasah uji baru dibuat melalui factory guru resmi, lalu principal ditambahkan oleh sesi Admin melalui Data API/RLS; role homeroom_teacher bawaan dipertahankan untuk mematuhi larangan menghapus data. Sebelum principal akun membaca nol kelas, sesudahnya lima kelas; panel principal terbuka dan detail VIII B satu siswa tampil. Ini akun principal multirole, bukan klaim pengujian principal tunggal.

Guru uji dari manifest QA-2-5 diaktifkan kembali, password dipulihkan melalui request/approve/redeem resmi (permintaan baru used), login berhasil, lalu penugasan VIII B baru dibuat setelah memastikan tidak ada penugasan lama dan semua siswa kelas berpenanda uji. Penugasan lama VIII A tetap sama. Guru membaca hanya VIII B/satu siswa dan ditolak dari kelas lain. Principal dan guru ditolak HTTP 403 untuk pembuatan akun/persetujuan pemulihan khusus Admin; daftar pemulihan Admin kosong. Keduanya diuji disabled sementara dengan sesi yang sama: nol siswa/kelas, is_staff false, laporan ditolak Akun tidak aktif. Status akhir kedua akun active; akun/relasi tidak dihapus. Seluruh ID dicatat pada [manifest tambahan](../MANIFEST-TAHAP-1-3-20261019.json).

Pengguna menyatakan backup privat belum diketahui; dianggap belum ada. Salinan Storage aktual kini berhasil dibuat: 5 object/3.838.617 byte, salinan restore-check dengan SHA-256 cocok. Berkas dan inventaris privat berada di Temp CODEX-PRIVATE-STORAGE-BACKUP-20261019 di luar repository; ini bukan penyimpanan permanen/offsite dan perlu dipindahkan ke media privat. Unduhan SDK memakai sesi Admin, tidak membaca/menyalin token ke log atau meneruskan kredensial ke penerima loopback. Tidak menulis Storage remote. Satu tes Node penerima lulus untuk origin, inventaris tidak lengkap, duplikasi dan integritas byte. Restore layanan Storage/database/Auth produksi tetap BELUM TERVERIFIKASI; belum ada dump database/Auth atau stack pemulihan lengkap. [Panduan backup pertama](../PANDUAN-BACKUP-PERTAMA.md) menjelaskan persyaratan berikutnya tanpa meminta rahasia di chat.

Build produksi yang sudah tersedia diuji melalui preview loopback: desktop login terlihat 12.334 ms, mobile simulasi CPU 4x/latency150 ms/download200.000 B/s 16.253 ms, nol pageerror/overflow. Hasil mencakup splash pembacaan ayat 10–18 detik dan kutipan acak; bukan perbandingan kecepatan murni, bukan HP fisik/kapasitas hosting. Preview dan receiver dihentikan. Paket Free terkonfirmasi; penggunaan bulanan/MAU/egress/hosting nyata belum diukur.

Source aplikasi/build config tidak berubah; lint/build tidak dijalankan ulang dan hasil lama tidak dilabel ulang sebagai baru. Helper/kode lengkap, laporan dan konteks ditambahkan. Hash siswa/arsip/profil Admin/app_settings identik sebelum/sesudah; reminder false, pg_cron/pg_net tidak aktif. Tidak melakukan deployment, migrasi, push nyata, perubahan logo atau pembersihan. Cancel-stuck positif cloud tetap belum diuji karena tidak ada permintaan uji processing; tidak memanipulasi timestamp/Auth untuk memaksakan insiden. Berikutnya backup database/Auth privat dan pengukuran setelah hosting tersedia; jangan mengulang tugas akses staf yang sudah memiliki bukti baru tanpa alasan.

### Keputusan dan hasil 19 Oktober 2026 — pembersihan sebelum data nyata, publikasi GitHub

Pengguna secara eksplisit mengizinkan pembersihan semua data uji run CODEX-UJI-20261016 serta satu pasangan siswa/orang tua sebelum QA-01, dan meminta source dipush ke Geys07/Mutabaah-yaumiah. Ini menggantikan larangan pembersihan untuk cohort yang disebutkan, bukan izin menghapus data nyata di masa depan. Jangan menjalankan ulang skrip operasional cleanup atau menganggap ID akun uji historis masih tersedia.

Inventaris membuktikan hanya ada sembilan siswa berpenanda uji dan satu siswa awal dengan orang tua yang terhubung; sepuluh akun non-Admin menjadi target. Pemeriksaan transaksi dengan ROLLBACK lulus sebelum eksekusi. Empat arsip diverifikasi terhadap backup byte privat dan dihapus melalui Storage API, lalu data/database dan akun Auth target dihapus dalam transaksi dengan guard Admin, relasi dan checksum sistem. Tidak membaca/menyalin password, hash kredensial atau token. Tidak menonaktifkan audit trigger; data audit uji dihapus bersama cohort sesuai izin.

Readback akhir: Auth/profil/role masing-masing satu (Admin aktif); siswa, enrollment, relasi wali, penugasan wali kelas, jawaban, kondisi, finalisasi, audit uji, arsip, kontak/kode aktivasi, permintaan pemulihan dan perubahan HP nol. Logo Storage satu dan perangkat Admin satu tetap ada. Data sistem 17 kegiatan, 5 kelas, 1 tahun ajaran, 2 semester, identitas/penilaian/app_settings dipertahankan; checksum gabungannya identik, demikian pula definisi fungsi/grants dan kebijakan RLS. Sesi/identity Auth non-Admin nol; dua sesi uji lama tidak memperoleh siswa/kelas sesudah pembersihan. Pengingat tetap false. Rate-limit dan log teknis layanan tidak dibersihkan massal.

Hasil QA terdahulu tetap bukti historis pada cohort yang kini sudah dihapus, bukan data yang boleh diciptakan ulang otomatis. Backup byte arsip tetap privat di luar repository; backup database/Auth penuh masih belum dibuat. Rapor Word sudah dinyatakan sesuai oleh pengguna dan pemeriksaan tambahan ditunda; uji HP/push tetap terakhir.

Repository tujuan bersifat publik dan awalnya kosong. .gitignore diperketat; .env, ZIP, salinan source lama, laporan/manifest privat, skrip cleanup serta artefak browser tetap lokal. README dan .env.example menjelaskan penggunaan tanpa kredensial. Tautan laporan/manifest historis dalam dokumen ini hanya tersedia pada workspace yang menyimpan dokumen privat tersebut; tidak semua tautan merupakan file publik GitHub. Source lokal tetap kanonis; migrasi terpasang tidak boleh diulang hanya karena repository baru. Status commit/push diverifikasi pada serah-terima tugas, bukan diasumsikan dari pembuatan remote.

Pemeriksaan pra-publikasi: npm run lint dan npm run build dijalankan kembali dan lulus, 427 modul; warning chunk bank ayat sekitar 500,25 kB dan plugin timings tetap dicatat. Scanner indeks awal memeriksa 283 file tanpa temuan pola kredensial/path privat. Tidak ada source fitur/desain yang diubah untuk publikasi ini; label demo pada template DOCX sumber yang disetujui tetap dipertahankan, bukan arsip pribadi yang diekspor.

### Catatan 20 Oktober 2026 — source berhasil dipublikasikan

Push pertama berhasil ke **https://github.com/Geys07/Mutabaah-yaumiah**, branch main. SHA remote main diverifikasi sama dengan commit awal lokal **2ff1eb493c09d83aec978ab4026e431b10f3f320**; working tree bersih setelah push. Repository publik; pemeriksaan git ls-files mengonfirmasi .env.local, laporan/manifest privat, skrip cleanup dan artefak browser tidak terlacak. Catatan ini merupakan pembaruan dokumentasi sesudah verifikasi commit awal, bukan perubahan fitur/deployment.

Untuk pekerjaan berikutnya: gunakan revisi terbaru repository, pertahankan Admin dan data sistem, serta lindungi semua data nyata yang dimasukkan setelah pembersihan yang sudah selesai. Akun/ID uji historis telah dihapus dan tidak boleh diasumsikan masih tersedia. Pengingat otomatis tetap OFF. Backup privat database/Auth lengkap dan penyimpanan backup permanen masih pekerjaan berikutnya; push source bukan backup database atau deployment aplikasi. Uji HP/push tetap terakhir sesuai izin perangkat yang relevan.


## 21 Oktober 2026 — Pengaturan pengingat 20.00 dan kotak masuk admin

- Permintaan pengguna: sakelar aktif/nonaktif pengingat otomatis pukul 20.00 WIB, tombol contoh notifikasi hanya ke admin, hapus satu notifikasi, tandai dibaca semua, hapus yang sudah dibaca, desain responsif. Permintaan akun/nomor tidak boleh ikut terhapus saat pesan dihapus.
- Implementasi backend yang sudah **diterapkan langsung** pada proyek Supabase `vxfpwzevatwucvmeszen`: migrasi `admin_reminder_controls_inbox`, tabel `admin_notice_inbox` RLS admin-pemilik, `reminder_delivery_readiness` yang hanya bisa ditandai siap oleh backend, tiga RPC khusus admin aktif (`admin_reminder_status`, `admin_reminder_set_enabled`, `admin_reminder_preview`) serta event inbox untuk permintaan pemulihan akun/nomor yang BARU masuk. Peristiwa lama tidak ditulis ulang. Izin UPDATE tabel pesan terbatas pada kolom `read_at`.
- Readback setelah migrasi: `daily_reminder` tetap `{\"enabled\":false,\"time\":\"20:00\",\"timezone\":\"Asia/Jakarta\"}`; `reminder_delivery_readiness.transport_ready=false`; tabel inbox awal nol. Tidak ada Cron aktif. Tidak mengaktifkan pengiriman, menghubungi wali, memanipulasi identitas, atau membuat pesan uji di akun admin nyata.
- Kesiapan server adalah syarat ON: penjadwal `cron.job` dengan nama `mutabaah_parent_reminder_2000_wib`, jadwal `0 13 * * *` (UTC), perintah ke `parent-reminder-send` DAN `reminder_delivery_readiness.transport_ready=true` yang diisi setelah konfigurasi Edge, secret, VAPID, endpoint pengiriman, serta pengujian nyata berhasil. Fungsi Edge `parent-reminder-send` tetap mensyaratkan `PARENT_REMINDER_ENABLED=true` dan setting DB. Belum ada secret / Cron yang dibuat pada tahap ini. Tombol ON terkunci dengan alasan jika belum siap; tombol OFF tetap tersedia jika pernah aktif. Tidak boleh menyatakan pengiriman berfungsi hanya karena status UI berubah.
- Tombol **Kirim Push Contoh ke Perangkat Ini** melakukan pengiriman Web Push nyata hanya ke langganan perangkat milik admin yang terautentikasi melalui tindakan `admin-push:test_reminder_push`. Server memeriksa akun admin aktif, kepemilikan endpoint, kunci VAPID server, dan cooldown 30 detik. Setelah penyedia push menerima pesan, RPC `admin_reminder_preview` menambahkan salinan ke Kotak Masuk Admin. Jika izin/langganan belum aktif di perangkat, tombol mengarahkan admin untuk mengaktifkan Notifikasi Perangkat. Contoh tidak mengirim ke wali murid dan tidak mengubah pengingat otomatis 20.00 WIB.
- Pengiriman push contoh nyata ke ponsel admin **belum diuji secara langsung**: hasil lint/build atau respons penyedia push tidak menjamin notifikasi ditampilkan perangkat. Pengingat wali murid tetap OFF.
- Frontend: `AdminNotificationSections` memakai tab Kotak Masuk/Pengingat 20.00/Permintaan Akun/Perubahan Nomor/Notifikasi Perangkat. Kotak masuk memiliki filter semua/belum dibaca/sudah dibaca, pesan individual, konfirmasi hapus semua yang telah dibaca. Ikon lonceng menjumlah notifikasi inbox belum dibaca dan permintaan pending, sedangkan hitungan kartu dashboard permintaan tetap terpisah. Tab responsif horizontal scroll di layar kecil.
- Sisa validasi: hasil CI lint/build/tes regresi GitHub dan verifikasi tampilan PWA Android/iOS; QA notifikasi perangkat nyata dan pengiriman wali tetap tahap terakhir. Jangan mengaktifkan scheduler sebelum semua prasyarat diverifikasi dan persetujuan eksplisit operasi pengiriman diberikan.


## 22 Oktober 2026 — Kesiapan penjadwal pengingat dan identitas topbar
- Identitas **Mutabaah Yaumiah** di topbar panel staf pada HP ditampilkan lebih jelas, dan nama aplikasi di sidebar diperbesar tanpa mengubah judul halaman maupun fungsi menu.
- Supabase produksi `vxfpwzevatwucvmeszen` kini memiliki `pg_cron` dan `pg_net`; job `mutabaah_parent_reminder_2000_wib` memakai `0 13 * * *` berdasarkan zona waktu Cron GMT (20.00 WIB) dan hanya memanggil `parent-reminder-send` ketika `daily_reminder.enabled=true` serta `reminder_delivery_readiness.transport_ready=true`.
- Secret scheduler dibuat acak langsung di **Supabase Vault**, bukan ditulis di source, .env frontend, atau isi perintah Cron. RPC `verify_parent_reminder_secret(text)` hanya diberi EXECUTE ke `service_role`. Edge Function `parent-reminder-send` versi 4 memeriksa secret dari Vault, jam 20.00–20.15 WIB, konfirmasi pengiriman, status admin, dan kesiapan transport sebelum push kepada wali. Mekanisme klaim pengiriman untuk mencegah duplikasi tetap dipakai.
- Migrasi sudah diterapkan di database dengan versi **20261021230353** dan sumber GitHub diselaraskan ke nama versi itu.
- Tes health-check aman via pg_net menghasilkan HTTP **200** dengan `success=true, health_check=true, transport_ready=true, sends_to_parents=false`. Setelah hasil tersebut dan pengecekan Cron/Vault/izin RPC, `reminder_delivery_readiness.transport_ready` disetel menjadi true. Pengujian ini **tidak mengirim push kepada wali** dan tidak sama dengan bukti push wali sudah diterima.
- Pengaturan `app_settings.daily_reminder.enabled` tetap **false (OFF)**. Kontrol ON diserahkan kepada admin melalui panel dan harus diaktifkan setelah data siswa/wali siap. Saat OFF, SQL Cron tidak membuat permintaan HTTP.
- Saat audit awal, langganan `parent_push_subscriptions` masih nol: pengiriman ke perangkat wali perlu diuji ketika wali dan perangkatnya sudah terdaftar. Tidak ada pengiriman otomatis kepada wali pada proses pemasangan ini.

## 24 Oktober 2026 — Identitas wali pada permohonan ganti nomor

- Pengguna melaporkan bahwa kartu admin **Permohonan Ganti Nomor HP** sebelumnya hanya berisi dua nomor dan waktu pengajuan, tanpa identitas pemohon.
- Pemeriksaan skema remote read-only di proyek resmi memastikan `parent_phone_change_requests.guardian_id` memiliki FK ke `profiles.user_id`, dan siswa terkait dapat dibaca melalui `student_guardians` → `students` → `student_enrollments` → `classes`. RLS sudah memberikan akses pembacaan yang diperlukan kepada Admin aktif. Tidak ada perubahan database, akun, nomor, atau status permohonan.
- Kartu dan popup konfirmasi Admin kini memuat nama wali murid, nama siswa terkait beserta kelas aktif bila ada, label nomor lama/baru, serta waktu WIB. Jika relasi identitas belum lengkap, UI menampilkan peringatan eksplisit, bukan menebak nama.
- Pemanggilan Edge Function `parent-phone-change` dengan aksi review, tombol setujui/tolak, pagination, interval polling, dan halaman ganti nomor orang tua tidak berubah.
- Pengujian source ditambahkan; CI lint/build/regresi dan verifikasi visual di PWA Android harus diperiksa. Jangan mengirim push atau menyetujui/menolak pengajuan produksi sebagai langkah tes otomatis.
