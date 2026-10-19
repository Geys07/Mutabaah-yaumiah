# Checklist kuota gratis QA-06

Tidak ada layanan berbayar, branch, Cron, atau pengiriman push dibuat pada QA-06. Penggunaan aktual dashboard billing/hosting BELUM TERVERIFIKASI. Batas paket dapat berubah; baca dashboard akun saat pemeriksaan, jangan mengandalkan angka lama.

| Pemeriksaan rutin | Bukti yang dicatat tanpa rahasia |
|---|---|
| Database dan pertumbuhan audit | Ukuran database, tabel terbesar, pertumbuhan bulanan; audit tidak dihapus otomatis |
| Storage | Total byte/logo/arsip, file terbesar, egress; arsip tetap privat |
| Auth | Pengguna aktif bulanan, error/rate limit, status paket |
| Edge Functions | Invocation, error, durasi dan egress; jangan mencatat payload/subscription |
| Hosting | Bandwidth, build minutes, file count, batas gratis provider yang benar |
| PWA | Total precache, ukuran bundle, transfer awal; video/header/font diperiksa terpisah |
| Backup lokal | Kapasitas media, checksum, salinan kedua dan tanggal restore terakhir |

Admin memeriksa mingguan dan sebelum rilis. Tetapkan ambang internal 70% untuk review dan 85% untuk tindakan penghematan yang ditinjau; ini bukan batas resmi Supabase. Saat mendekati batas, cari sumber pertumbuhan dan optimalkan query/pagination/cache aset publik. Jangan meningkatkan paket atau menghapus audit/arsip/data siswa otomatis.

SQL READ-ONLY yang dapat ditinjau Admin:

```sql
select pg_size_pretty(pg_database_size(current_database()));
select relname, pg_size_pretty(pg_total_relation_size(relid))
from pg_catalog.pg_statio_user_tables
order by pg_total_relation_size(relid) desc limit 10;
```

Untuk batas resmi gunakan dashboard proyek `vxfpwzevatwucvmeszen` dan https://supabase.com/docs/guides/platform/manage-your-usage. Hosting belum diidentifikasi; jangan mengarang provider atau kuotanya.
