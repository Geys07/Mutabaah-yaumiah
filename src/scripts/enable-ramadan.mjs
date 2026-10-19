
import {
  readFileSync,
  writeFileSync,
  existsSync,
} from "node:fs";

import { resolve } from "node:path";

const files = [
  {
    name: "src/pages/Activities.jsx",

    token:
      '<div className="activities-page">',

    importLine:
      'import RamadanSettings from "./RamadanSettings";\n',

    insert:
      '<div className="activities-page">\n' +
      '      <RamadanSettings />',

    marker:
      "<RamadanSettings />",
  },

  {
    name: "src/pages/ParentDaily.jsx",

    token:
      "const CATEGORY_NAMES = {",

    importLine:
      'import { loadParentActivities } from "../lib/loadParentActivities";\n',

    insert:
      'const CATEGORY_NAMES = {\n' +
      '  ramadan: "Kegiatan Khusus Ramadan",',

    marker:
      "loadParentActivities(selectedDate)",
  },
];

const jobs = [];

for (const spec of files) {
  const pathname = resolve(spec.name);

  if (!existsSync(pathname)) {
    throw new Error(
      `File tidak ditemukan: ${spec.name}`
    );
  }

  let source = readFileSync(
    pathname,
    "utf8"
  ).replace(/\r\n/g, "\n");

  if (source.includes(spec.marker)) {
    console.log(
      `${spec.name}: Ramadan sudah terpasang, dilewati`
    );

    continue;
  }

  if (!source.includes(spec.token)) {
    throw new Error(
      `Struktur berubah: ${spec.name}`
    );
  }

  if (spec.name.includes("ParentDaily")) {
    const start = source.indexOf(
      '          supabase\n' +
      '            .from("mutabaah_activities")'
    );

    const end =
      start < 0
        ? -1
        : source.indexOf(
            '            .order("title"),',
            start
          );

    if (start < 0 || end < 0) {
      throw new Error(
        "Query ParentDaily tidak cocok. " +
        "Tidak ada file yang diubah."
      );
    }

    source =
      source.slice(0, start) +
      "          loadParentActivities(selectedDate)," +
      source.slice(
        end + '            .order("title"),'.length
      );
  }

  source =
    spec.importLine +
    source.replace(
      spec.token,
      spec.insert
    );

  jobs.push({
    pathname,
    name: spec.name,
    source,
  });
}

for (const job of jobs) {
  // Cadangan kode sebelum pemasangan Ramadan.
  writeFileSync(
    job.pathname + ".sebelum-ramadan.txt",
    readFileSync(job.pathname)
  );

  writeFileSync(
    job.pathname,
    job.source,
    "utf8"
  );

  console.log(
    `${job.name}: terpasang (cadangan tersedia)`
  );
}
