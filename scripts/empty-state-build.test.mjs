import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const categories = [
  ["01-data-siswa", "data-siswa"],
  ["02-akun-guru", "akun-guru"],
  ["03-kepala-madrasah", "kepala-madrasah"],
  ["04-orang-tua-wali", "orang-tua-wali"],
  ["05-notifikasi", "notifikasi"],
  ["06-laporan-wajib", "laporan-wajib"],
  ["08-rapor-mutabaah", "rapor-mutabaah"],
  ["10-data-kelas", "data-kelas"],
];
const periods = ["pagi", "siang", "sore", "malam"];

test("production output contains all 32 empty-state WebP images", async () => {
  let verified = 0;
  for (const [folder, name] of categories) {
    for (const period of periods) {
      const filepath = join(process.cwd(), "dist", "empty-states", folder, `${name}-${period}.webp`);
      const bytes = await readFile(filepath);
      assert.ok(bytes.length > 1000, `Missing or undersized: ${filepath}`);
      assert.equal(bytes.toString("ascii", 0, 4), "RIFF", filepath);
      assert.equal(bytes.toString("ascii", 8, 12), "WEBP", filepath);
      verified += 1;
    }
  }
  assert.equal(verified, 32);
  const files = await readdir(join(process.cwd(), "dist", "empty-states"), { recursive: true });
  assert.equal(files.filter((name) => name.endsWith(".webp")).length, 32);
});
