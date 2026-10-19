# Panduan Admin QA-06

## Koneksi dan pengisian

- Jumlah notifikasi bertanda belum diperbarui bukan angka terbaru. Gunakan Muat Ulang setelah koneksi pulih; jangan menganggap kegagalan server sebagai nol permintaan.
- Bila pembukaan aplikasi gagal, gunakan Coba Lagi setelah online. Jangan menghapus penyimpanan browser atau memasang ulang saat ada draf belum tersimpan.
- Draf gagal simpan tetap dapat dipulihkan selama sesi browser yang sama ketika kembali ke anak/tanggal tersebut. Pilih Simpan Draf. Finalisasi yang belum terkonfirmasi harus dicoba melalui Selesaikan Pengisian, bukan dianggap sudah final.
- Pemulihan di memori bukan jaminan draf bertahan setelah tab ditutup atau perangkat mati. Pastikan pesan tersimpan tampil sebelum menutup aplikasi. Pengisian penuh offline belum didukung.
- Pengisian dibatasi 30 tanggal terakhir termasuk hari ini berdasarkan WIB. Periksa tanggal perangkat bila tampilan tidak sesuai; backend tetap menjadi pengendali izin.

## Akun dan siswa

- Gunakan alur resmi aktivasi/reset password. Jangan membagikan kode aktivasi, password atau token lewat laporan QA.
- Dua siswa aktif belum terhubung ke wali: `450a8faf-b2c2-47c5-b03c-d255f9fb8125` dan `4c20812f-c064-41cf-a3b9-0a2235eb3706`. Cari ID melalui panel Admin atau pembacaan internal yang sah; verifikasi kontak keluarga dengan sekolah sebelum membuat kode. Jangan mengarang wali.
- Data `CODEX-UJI-20261016` dipertahankan. Tidak ada izin pembersihan dari QA-06.
- Akun nonaktif tidak boleh diandalkan hanya pada tampilan frontend. Review keamanan QA-06 mencatat kebutuhan pemeriksaan aktif pada seluruh jalur backend.

## PWA dan pemberitahuan

- Buka Panduan Aplikasi dari Pengaturan/Profil. Pada iOS gunakan Safari dan Tambahkan ke Layar Utama. Tombol instal otomatis hanya tersedia bila browser mendukungnya.
- Jika persiapan notifikasi gagal, pilih percobaan ulang persiapan. Aktivasi hanya melalui tindakan pengguna. Jangan mengirim push produksi untuk mencoba perangkat.
- Pengingat otomatis wajib tetap OFF. Jangan memasang proposal SQL/Edge atau scheduler hanya karena tes fixture lulus.
- Tutup seluruh jendela aplikasi hanya setelah draf tersimpan bila hendak memakai versi baru. Pembaruan tidak boleh memaksa reload.

## Rapor dan tahun ajaran

Sebelum penerbitan/kenaikan kelas, buat backup yang telah diuji restore, periksa periode, daftar siswa dan kelas tujuan, lalu tinjau pratinjau. Jangan memakai data nyata untuk latihan kenaikan kelas, kelulusan, keluar/kembali, perubahan Ramadan atau arsip. Arsip lama wajib dipertahankan.

Saat melapor gangguan, sertakan waktu WIB, peran, menu, langkah dan pesan aman. Hindari nama siswa, nomor HP, endpoint push, screenshot kredensial dan data Auth. Gunakan ID internal hanya pada saluran Admin berwenang.

Jika kegiatan belum terbuka setelah 15 detik, gunakan Muat Ulang. Jika penyimpanan masih menunggu konfirmasi server, jangan menganggap gagal atau menutup pengisian; aplikasi mempertahankan antrean agar retry tidak mendahului penyimpanan lama. Pergantian akun membuang draf memori akun sebelumnya untuk mencegah kebocoran antar akun.
