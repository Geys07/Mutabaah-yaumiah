import JSZip from "jszip";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve, sep } from "node:path";

const root = process.cwd();
const packagePath = join(root, "public", "empty-state-assets.zip");
const destination = resolve(root, "public", "empty-states");

// ZIP cukup ditempatkan di public/empty-state-assets.zip.
// Tidak perlu mengunggah 32 WebP satu per satu.
const categories = {
  "01-data-siswa": "data-siswa",
  "02-akun-guru": "akun-guru",
  "03-kepala-madrasah": "kepala-madrasah",
  "04-orang-tua-wali": "orang-tua-wali",
  "05-notifikasi": "notifikasi",
  "06-laporan-wajib": "laporan-wajib",
  "08-rapor-mutabaah": "rapor-mutabaah",
  "10-data-kelas": "data-kelas",
};
const periods = ["pagi", "siang", "sore", "malam"];

let bytes;
try {
  bytes = await readFile(packagePath);
} catch (error) {
  if (error?.code === "ENOENT") {
    console.log("ZIP empty state belum dipasang; komponen memakai SVG cadangan.");
    process.exit(0);
  }
  throw error;
}

const archive = await JSZip.loadAsync(bytes, { checkCRC32: true });
const verified = [];
for (const [folder, category] of Object.entries(categories)) {
  for (const period of periods) {
    const filename = `public/empty-states/${folder}/${category}-${period}.webp`;
    const file = archive.file(filename);
    if (!file) throw new Error(`Ilustrasi tidak ada dalam ZIP: ${filename}`);

    const image = await file.async("nodebuffer");
    if (
      image.length < 16 ||
      image.toString("ascii", 0, 4) !== "RIFF" ||
      image.toString("ascii", 8, 12) !== "WEBP"
    ) {
      throw new Error(`Bukan WebP valid: ${filename}`);
    }
    const target = resolve(root, filename);
    if (!target.startsWith(destination + sep)) {
      throw new Error("Lokasi ilustrasi tidak aman.");
    }
    verified.push({ target, image });
  }
}

// Semua file diverifikasi terlebih dahulu, baru mengganti aset lama.
await rm(destination, { recursive: true, force: true });
for (const { target, image } of verified) {
  await mkdir(resolve(target, ".."), { recursive: true });
  await writeFile(target, image);
}
console.log(`Terpasang ${verified.length} ilustrasi empty state untuk empat tema WIB.`);
