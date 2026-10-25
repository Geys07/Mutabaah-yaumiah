import { useCallback, useEffect, useState } from "react";

import { supabase } from "../lib/supabase";
import { fetchAll, PAGE_SIZE } from "../lib/pagination";
import usePagedQuery from "../lib/usePagedQuery";
import Pagination from "../components/Pagination";
import EmptyState from "../components/EmptyState";
import AppConfirmDialog from "../components/AppConfirmDialog";

const TEMPLATE_FILENAME = "rapor-mutabaah-template.docx";
const WORD_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function getTemplateUrl() {
  const base = import.meta.env.BASE_URL || "/";
  const folder = base.endsWith("/") ? base : `${base}/`;
  return `${folder}${TEMPLATE_FILENAME}`;
}
const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const WP = "http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing";
const GROUPS = ["Ibadah", "Al-Qur’an", "Akhlak", "Kemandirian", "Kebiasaan Baik"];
const LABELS = { A: "Sangat Baik", B: "Baik", C: "Cukup", D: "Perlu Bimbingan" };
// Semua kegiatan tambahan dibaca dinamis dari Supabase.
// Termasuk kegiatan Ramadan yang berlaku pada semester rapor.
function bonusEntries(student) {
  return (Array.isArray(student.bonuses) ? student.bonuses : [])
    .filter((item) => item && typeof item.title === "string" && item.title.trim())
    .map((item) => ({
      title: String(item.title).trim(),
      achieved: Number(item.achieved ?? item.count) || 0,
    }));
}

function safe(value, fallback = "") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function num(value) {
  const result = Number(value);
  return Number.isFinite(result) ? result : 0;
}

function pct(value) {
  if (value === null || value === undefined) return "—";
  return `${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 }).format(num(value))}%`;
}

function fileSafe(value) {
  return safe(value, "rapor").replace(/[\\/:*?"<>|]/g, "-").replace(/\s+/g, "-");
}

function gradeFor(percentage, grading) {
  if (percentage === null || percentage === undefined) return "—";
  const score = num(percentage);
  if (score >= num(grading.grade_a_min)) return "A";
  if (score >= num(grading.grade_b_min)) return "B";
  if (score >= num(grading.grade_c_min)) return "C";
  return "D";
}

function formatSchoolName(value) {
  const original = safe(value, "AL-KHAIRIYAH");
  const name = original
    .replace(/^MADRASAH\s+TSANAWIYAH\s*/i, "")
    .replace(/^M\.?\s*T\.?\s*S\.?\s*/i, "")
    .replace(/^MADRASAH\s+/i, "")
    .trim();

  return `MADRASAH TSANAWIYAH ${name || "AL-KHAIRIYAH"}`.toLocaleUpperCase("id-ID");
}

function formatPeriod(period, currentClass) {
  const label = safe(period?.label);
  const year = safe(currentClass?.academic_year) ||
    label.match(/20\d{2}\s*\/\s*20\d{2}/)?.[0]?.replace(/\s/g, "") || "";
  const semester = /(?:semester\s*2|genap)/i.test(label)
    ? "GENAP"
    : "GANJIL";
  return `SEMESTER ${semester}${year ? ` TAHUN AJARAN ${year}` : ""}`;
}

function formatIssuanceDate(semesterEnd, now = new Date()) {
  const endDate = safe(semesterEnd);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(endDate);
  if (!match) return "";

  const endYear = Number(match[1]);
  const endMonth = Number(match[2]);
  const endDay = Number(match[3]);
  const end = new Date(Date.UTC(endYear, endMonth - 1, endDay, 12));

  if (
    end.getUTCFullYear() !== endYear ||
    end.getUTCMonth() !== endMonth - 1 ||
    end.getUTCDate() !== endDay
  ) {
    return "";
  }

  // Gunakan tanggal kalender Jakarta, bukan zona waktu komputer pengguna.
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) return "";

  const todayJakarta = `${year}-${month}-${day}`;
  const issuanceISO = todayJakarta <= endDate ? todayJakarta : endDate;
  const [issueYear, issueMonth, issueDay] = issuanceISO.split("-").map(Number);
  const issuanceDate = new Date(Date.UTC(issueYear, issueMonth - 1, issueDay, 12));

  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(issuanceDate);
}

// SHA-256 digunakan untuk membandingkan ISI rapor, bukan tanggal pengunduhan.
// Template/logo berbeda menghasilkan sidik isi yang berbeda.
async function sha256Hex(content) {
  if (!globalThis.crypto?.subtle) {
    throw new Error("Browser tidak mendukung verifikasi isi arsip. Gunakan HTTPS atau localhost.");
  }
  const bytes = typeof content === "string" ? new TextEncoder().encode(content) : content;
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function normalizedActivity(item) {
  return {
    group: safe(item.group),
    title: safe(item.title),
    target: item.target === null || item.target === undefined ? null : num(item.target),
    percentage: item.percentage === null || item.percentage === undefined ? null : num(item.percentage),
    possible: num(item.possible),
    achieved: num(item.achieved),
  };
}

async function reportContentFingerprint(students, context, grading, templateHash, logoHash) {
  // Jangan sertakan context.date: unduh berulang pada hari berbeda
  // tidak perlu menghasilkan arsip ganda apabila data penilaian tetap sama.
  const payload = {
    schema: "mutabaah-report-content-v1",
    templateHash,
    logoHash,
    school: {
      name: safe(context.schoolName),
      address: safe(context.schoolAddress),
      period: safe(context.periodLabel),
      className: safe(context.className),
      teacherName: safe(context.teacherName),
      signingLocation: safe(context.signingLocation),
    },
    gradeRules: [num(grading.grade_a_min), num(grading.grade_b_min), num(grading.grade_c_min)],
    students: students.map((student) => ({
      id: safe(student.id),
      name: safe(student.name),
      nis: safe(student.nis),
      percentage: student.percentage === null || student.percentage === undefined
        ? null : num(student.percentage),
      grade: safe(student.grade),
      kkm: safe(student.kkm),
      note: safe(student.note),
      activities: combinedActivities(student.activities).map(normalizedActivity),
      bonuses: bonusEntries(student).map(({title,achieved}) => [title,achieved]),
      notes: notesFor(student),
    })).sort((a, b) => a.id.localeCompare(b.id)),
  };
  return sha256Hex(JSON.stringify(payload));
}

function combinedActivities(raw) {
  const source = Array.isArray(raw) ? raw : [];
  const prayerCodes = new Set(["subuh", "dzuhur", "zuhur", "ashar", "asar", "maghrib", "magrib", "isya"]);
  const prayers = source.filter((item) =>
    prayerCodes.has(safe(item.code).toLowerCase()) ||
    /^(salat|shalat)\s+(subuh|zuhur|dzuhur|asar|ashar|magrib|maghrib|isya)$/i.test(safe(item.title))
  );
  const used = new Set(prayers.map((item) => item.id));
  const result = [];

  if (prayers.length) {
    const possible = prayers.reduce((sum, item) => sum + num(item.possible), 0);
    const achieved = prayers.reduce((sum, item) => sum + num(item.achieved), 0);
    result.push({
      id: "salat-lima-waktu", group: "Ibadah", title: "Salat Lima Waktu",
      possible, achieved,
      target: possible
        ? prayers.reduce((sum, item) => sum + num(item.target) * num(item.possible), 0) / possible
        : null,
      percentage: possible ? achieved * 100 / possible : null,
    });
  }

  for (const item of source) {
    if (used.has(item.id)) continue;
    result.push({
      id: item.id,
      group: item.group,
      title: item.code === "sedekah" ? "Sedekah Jumat" : item.title,
      possible: num(item.possible),
      achieved: num(item.achieved),
      target: item.target,
      percentage: item.percentage,
    });
  }
  return GROUPS.flatMap((group) => result.filter((item) => item.group === group));
}

// Pembagian halaman diputuskan sebelum Word dan cetak dibuat.
// Nilai ini konservatif agar kelompok, catatan, dan tanda tangan tidak terpotong.
function groupActivityData(student) {
  const activities = combinedActivities(student.activities);
  return GROUPS.map((name) => ({
    name,
    items: activities.filter((item) => item.group === name),
  })).filter((group) => group.items.length > 0);
}

function estimatedItemHeight(item) {
  const title = safe(item.title);
  const detail = safe(item.percentage === null ? "Tidak berlaku" : "Perlu ditingkatkan");
  const wrap = Math.max(
    Math.ceil(title.length / 42),
    Math.ceil(detail.length / 24),
    1
  );
  return 1 + Math.max(0, wrap - 1) * 0.9;
}

function groupPageHeight(groups) {
  return groups.reduce((total, group) =>
    total + 0.9 + group.items.reduce((sum, item) => sum + estimatedItemHeight(item), 0), 0);
}

function extraNoteHeight(student) {
  const notes = notesFor(student);
  return Math.max(0, Math.ceil((safe(student.note).length - 170) / 85)) * 1.0 +
    Math.max(0, Math.ceil((notes.summary.length - 165) / 95)) * 0.8 +
    Math.max(0, Math.ceil((notes.parent.length - 170) / 95)) * 0.65;
}

function sliceGroupsByActivity(groups, count) {
  let remaining = count;
  const before = [];
  const after = [];
  for (const group of groups) {
    if (remaining <= 0) {
      after.push({ ...group, items: [...group.items] });
    } else if (remaining >= group.items.length) {
      before.push({ ...group, items: [...group.items] });
      remaining -= group.items.length;
    } else {
      before.push({ ...group, items: group.items.slice(0, remaining) });
      after.push({ ...group, items: group.items.slice(remaining) });
      remaining = 0;
    }
  }
  return [before, after];
}

function planStudentPages(student) {
  const groups = groupActivityData(student);
  const noteExtra = extraNoteHeight(student);
  // Satu halaman memuat kop lengkap, catatan, dan tanda tangan.
  const singleCapacity = Math.max(11, 18.5 - noteExtra);
  if (!groups.length || groupPageHeight(groups) <= singleCapacity) {
    return [groups];
  }

  const totalItems = groups.reduce((sum, group) => sum + group.items.length, 0);
  const firstCapacity = 25.5;
  const lastCapacity = Math.max(10, 19.5 - noteExtra);
  // Prioritas: dua halaman dan tidak membelah satu kelompok.
  const candidates = [];
  for (let count = 1; count < totalItems; count += 1) {
    const [first, last] = sliceGroupsByActivity(groups, count);
    const firstSize = groupPageHeight(first);
    const lastSize = groupPageHeight(last);
    if (firstSize > firstCapacity || lastSize > lastCapacity) continue;
    const sameGroupSplit = first[first.length - 1]?.name === last[0]?.name;
    const score = (sameGroupSplit ? 100 : 0) +
      Math.abs(firstSize - Math.min(firstCapacity - 1, groupPageHeight(groups) * 0.56)) * 1.4 +
      Math.max(0, lastSize - lastCapacity + 2) * 1.2;
    candidates.push({ score, pages: [first, last] });
  }
  candidates.sort((a, b) => a.score - b.score);
  if (candidates.length) return candidates[0].pages;

  // Apabila data luar biasa panjang, pertahankan seluruh kegiatan dengan
  // menambah halaman lanjutan; jangan potong atau hilangkan data.
  const pages = [];
  let remaining = groups;
  while (remaining.reduce((sum, group) => sum + group.items.length, 0) > 0) {
    if (groupPageHeight(remaining) <= lastCapacity) {
      pages.push(remaining);
      break;
    }
    const capacity = pages.length === 0 ? firstCapacity : 26.5;
    const itemCount = remaining.reduce((sum, group) => sum + group.items.length, 0);
    let best = null;
    for (let count = 1; count < itemCount; count += 1) {
      const [part, rest] = sliceGroupsByActivity(remaining, count);
      const size = groupPageHeight(part);
      if (size > capacity) continue;
      const splittingGroup = part[part.length - 1]?.name === rest[0]?.name;
      const score = (splittingGroup ? 25 : 0) + (capacity - size);
      if (!best || score < best.score) best = { score, part, rest };
    }
    if (!best) {
      const [part, rest] = sliceGroupsByActivity(remaining, 1);
      pages.push(part);
      remaining = rest;
      continue;
    }
    pages.push(best.part);
    remaining = best.rest;
  }
  return pages;
}

function remark(item, grading) {
  if (item.possible === 0) return "Tidak berlaku";
  if (num(item.percentage) < num(item.target)) return "Perlu ditingkatkan";
  return LABELS[gradeFor(item.percentage, grading)] || "—";
}

function notesFor(student) {
  const missed = combinedActivities(student.activities).filter(
    (item) => item.possible > 0 && num(item.percentage) < num(item.target)
  );
  if (!missed.length) {
    return {
      summary: "Pertahankan pembiasaan baik dan capaian Mutabaah Yaumiah.",
      parent: "Terima kasih atas pendampingan orang tua/wali dalam kegiatan Mutabaah Yaumiah.",
    };
  }
  return {
    summary: `Kegiatan yang perlu ditingkatkan: ${missed.slice(0, 4).map((item) => item.title).join(", ")}${missed.length > 4 ? ", dan lainnya" : ""}.`,
    parent: "Mohon terus mendampingi ananda agar kegiatan yang belum mencapai target semakin baik.",
  };
}


function childrenOf(element, localName) {
  return Array.from(element.children).filter(
    (node) => node.namespaceURI === W && node.localName === localName
  );
}

function allOf(element, localName) {
  return Array.from(element.getElementsByTagNameNS(W, localName));
}

function replaceText(element, value) {
  const texts = allOf(element, "t");
  if (!texts.length) throw new Error("Struktur teks template tidak dikenali.");
  texts[0].textContent = String(value ?? "");
  texts[0].setAttributeNS("http://www.w3.org/XML/1998/namespace", "xml:space", "preserve");
  for (const node of texts.slice(1)) node.textContent = "";
}

function setCell(row, index, value) {
  const cells = childrenOf(row, "tc");
  if (!cells[index]) throw new Error("Jumlah kolom template rapor tidak sesuai.");
  replaceText(cells[index], value);
}

function setParagraph(element, index, value) {
  const paragraphs = childrenOf(element, "p");
  if (!paragraphs[index]) throw new Error("Paragraf template tidak sesuai.");
  replaceText(paragraphs[index], value);
}

function rowsOf(table) {
  return childrenOf(table, "tr");
}

function makeDetails(table, groups, grading) {
  const existing = rowsOf(table);
  if (existing.length < 3) throw new Error("Tabel kegiatan dalam template tidak lengkap.");
  const groupPrototype = existing[1].cloneNode(true);
  const activityPrototype = existing[2].cloneNode(true);
  for (const row of existing.slice(1)) table.removeChild(row);
  for (const group of groups) {
    if (!group.items.length) continue;
    const groupRow = groupPrototype.cloneNode(true);
    setCell(groupRow, 0, group.name);
    table.appendChild(groupRow);
    for (const item of group.items) {
      const row = activityPrototype.cloneNode(true);
      setCell(row, 0, item.title);
      setCell(row, 1, pct(item.target));
      setCell(row, 2, pct(item.percentage));
      setCell(row, 3, item.possible > 0 ? gradeFor(item.percentage, grading) : "—");
      setCell(row, 4, remark(item, grading));
      table.appendChild(row);
    }
  }
}

function firstPageBreak(paragraph, xml) {
  let properties = childrenOf(paragraph, "pPr")[0];
  if (!properties) {
    properties = xml.createElementNS(W, "w:pPr");
    paragraph.insertBefore(properties, paragraph.firstChild);
  }
  const newPage = xml.createElementNS(W, "w:pageBreakBefore");
  newPage.setAttributeNS(W, "w:val", "1");
  properties.appendChild(newPage);
}

function setUniquePictureIds(node, nextId) {
  const drawings = Array.from(node.getElementsByTagNameNS(WP, "docPr"));
  for (const drawing of drawings) {
    drawing.setAttribute("id", String(nextId()));
  }
}

function fillStudentPage(blocks, student, context, grading, groups) {
  const paragraphs = blocks.filter((node) => node.namespaceURI === W && node.localName === "p");
  const tables = blocks.filter((node) => node.namespaceURI === W && node.localName === "tbl");
  // Template manual terbaru menggabungkan Ringkasan dan Catatan menjadi
  // satu tabel (total lima tabel). Versi lama enam tabel tetap dapat dibaca.
  if (![5, 6].includes(tables.length) || paragraphs.length < 10) {
    throw new Error(
      `Struktur template tidak sesuai: ditemukan ${tables.length} tabel, ` +
      "sedangkan desain Mutabaah menggunakan lima tabel utama. " +
      "Gunakan template DOCX terbaru yang disediakan."
    );
  }

  replaceText(paragraphs[0], context.schoolName);
  if (context.schoolAddress) replaceText(paragraphs[2], context.schoolAddress);
  const periodParagraph = paragraphs.find((p) => allOf(p, "t").some((t) =>
    /SEMESTER\s+(GANJIL|GENAP)/i.test(t.textContent || "")
  ));
  if (periodParagraph) replaceText(periodParagraph, context.periodLabel);

  const identity = rowsOf(tables[0]);
  setCell(identity[0], 1, student.name);
  setCell(identity[0], 3, pct(student.percentage));
  setCell(identity[1], 1, student.nis || "—");
  setCell(identity[1], 3, student.grade || "—");
  setCell(identity[2], 1, context.className);
  setCell(identity[2], 3, safe(student.kkm, "—"));
  setCell(identity[3], 1, context.teacherName || "Belum ditetapkan");

  makeDetails(tables[1], groups, grading);
  const bonusTable = tables[2];
  const bonusRows = rowsOf(bonusTable);
  const bonusPrototype = bonusRows[0];
  for (const row of bonusRows.slice(1)) bonusTable.removeChild(row);
  const bonuses = bonusEntries(student);
  // Pertahankan empat kolom template Word; tambahkan baris bila diperlukan.
  const entries = bonuses.length ? bonuses : [{title:"Belum ada kegiatan tambahan",achieved:0}];
  for (let offset = 0; offset < entries.length; offset += 4) {
    const row = offset === 0 ? bonusPrototype : bonusPrototype.cloneNode(true);
    for (let cell = 0; cell < 4; cell += 1) {
      const item = entries[offset + cell];
      setCell(row, cell, item ? `${item.title}: ${item.achieved} kali` : "");
    }
    if (offset > 0) bonusTable.appendChild(row);
  }

  const notes = notesFor(student);
  setCell(rowsOf(tables[3])[0], 0, notes.summary);
  // Template baru: tabel keempat memuat Ringkasan (baris 1)
  // dan dua Catatan berdampingan (baris 2).
  // Template lama: Catatan berada pada tabel kelima sendiri.
  const noteRow = tables.length === 5 ? rowsOf(tables[3])[1] : rowsOf(tables[4])[0];
  if (!noteRow) throw new Error("Bagian Catatan pada template tidak ditemukan.");
  const noteCells = childrenOf(noteRow, "tc");
  if (noteCells.length !== 2) throw new Error("Bagian Catatan harus memiliki dua kolom.");
  setParagraph(noteCells[0], 1, notes.parent);
  setParagraph(noteCells[1], 1, student.note || "");

  const signatures = rowsOf(tables[tables.length - 1]);
  setParagraph(childrenOf(signatures[0], "tc")[1], 0, `${context.signingLocation}, ${context.date}`);
  setCell(signatures[2], 1, context.teacherName || "(........................................)");
}

function cloneStudentBlocks(base, student, context, grading, pageGroups, pageIndex, totalPages, xml) {
  const first = pageIndex === 0;
  const last = pageIndex === totalPages - 1;
  const blocks = base.map((node) => node.cloneNode(true));
  // Mula-mula isi seluruh field dengan fungsi yang sama untuk semua halaman.
  fillStudentPage(blocks, student, context, grading, pageGroups);
  if (totalPages === 1) return blocks;

  if (first) {
    // Halaman pertama hanya berisi kop, identitas, dan capaian kelompok awal.
    const head = blocks.slice(0, 10);
    const continuation = blocks[10].cloneNode(true);
    replaceText(continuation, "CAPAIAN KEGIATAN BERLANJUT DI HALAMAN 2");
    head.push(continuation);
    return head;
  }

  // Halaman lanjutan mempertahankan gaya paragraf, tabel, dan watermark asli.
  const title = blocks[4].cloneNode(true);
  replaceText(title, "RAPOR MUTABAAH YAUMIAH — LANJUTAN");
  firstPageBreak(title, xml);
  const subtitle = blocks[5].cloneNode(true);
  replaceText(subtitle,
    `${student.name} | ${context.className} | ${context.periodLabel}`);
  const detailHeading = blocks[8].cloneNode(true);
  replaceText(detailHeading, "CAPAIAN KEGIATAN (LANJUTAN)");
  const continuationBlocks = [title, subtitle, detailHeading, blocks[9]];
  if (!last) {
    const next = blocks[10].cloneNode(true);
    replaceText(next, `CAPAIAN KEGIATAN BERLANJUT DI HALAMAN ${pageIndex + 2}`);
    continuationBlocks.push(next);
  } else {
    // Apresiasi, ringkasan, catatan dan tempat TTD hanya di lembar terakhir.
    // Hindari paragraf kosong ekstra setelah tanda tangan di template baru.
    const lastBlock = blocks[blocks.length - 1];
    const hasBlankTail = lastBlock?.namespaceURI === W && lastBlock?.localName === "p" &&
      allOf(lastBlock, "t").every((text) => !safe(text.textContent));
    continuationBlocks.push(...blocks.slice(10, hasBlankTail ? -1 : undefined));
  }
  return continuationBlocks;
}

async function loadTemplate() {
  const templateUrl = getTemplateUrl();
  let response;

  try {
    response = await fetch(templateUrl, {
      method: "GET",
      cache: "no-store",
      headers: { Accept: WORD_MIME },
    });
  } catch (error) {
    throw new Error(
      `Tidak dapat mengambil template dari ${templateUrl}. ` +
      `Pastikan server Vite berjalan. Detail: ${error.message}`,
      { cause: error }
    );
  }

  if (!response.ok) {
    throw new Error(
      `Template tidak ditemukan (${response.status}). ` +
      `Simpan ${TEMPLATE_FILENAME} di folder public proyek. ` +
      `Alamat yang diperiksa: ${templateUrl}`
    );
  }

  const bytes = await response.arrayBuffer();
  const header = new Uint8Array(bytes, 0, Math.min(bytes.byteLength, 8));
  const isZip =
    header.length >= 4 &&
    header[0] === 0x50 &&
    header[1] === 0x4b &&
    ((header[2] === 0x03 && header[3] === 0x04) ||
      (header[2] === 0x05 && header[3] === 0x06) ||
      (header[2] === 0x07 && header[3] === 0x08));

  if (!isZip) {
    const contentType = response.headers.get("content-type") || "tidak diketahui";
    const decoded = new TextDecoder("utf-8").decode(
      new Uint8Array(bytes.slice(0, 250))
    );
    const isHtml =
      /html/i.test(contentType) ||
      /<!doctype html|<html|<head/i.test(decoded);
    throw new Error(
      isHtml
        ? `Server mengirim halaman HTML, bukan template Word (${templateUrl}). ` +
          `Biasanya file ${TEMPLATE_FILENAME} belum diletakkan di folder public ` +
          `atau nama filenya salah. Buka alamat tersebut di browser untuk mengecek.`
        : `Berkas dari ${templateUrl} bukan DOCX yang valid ` +
          `(${bytes.byteLength} byte, tipe ${contentType}). ` +
          `Salin ulang template Word asli ke folder public.`
    );
  }

  try {
    const { default: JSZip } = await import("jszip");
    const zip = await JSZip.loadAsync(bytes, { checkCRC32: true });
    if (!zip.file("word/document.xml") || !zip.file("[Content_Types].xml")) {
      throw new Error("Struktur Word di dalam template tidak lengkap.");
    }
    if (
      !zip.file("word/media/image1.png") ||
      !zip.file("word/media/image2.png") ||
      !zip.file("word/media/image3.png")
    ) {
      throw new Error("Template tidak memiliki kedua logo dan watermark yang diperlukan.");
    }
    return { zip, templateHash: await sha256Hex(bytes) };
  } catch (error) {
    throw new Error(
      `Template ditemukan tetapi rusak atau tidak cocok. ` +
      `Unduh ulang ${TEMPLATE_FILENAME}. Detail: ${error.message}`,
      { cause: error }
    );
  }
}

async function schoolLogoPng(url) {
  if (!url) throw new Error("Logo sekolah belum tersedia di menu Identitas Sekolah.");
  const response = await fetch(url);
  if (!response.ok) throw new Error("Logo sekolah gagal dibaca dari penyimpanan.");
  const sourceBlob = await response.blob();
  // Hash logo dari byte ASLI di Supabase, bukan hasil konversi Canvas.
  // Cara ini konsisten sekalipun laporan dibuat lewat browser yang berbeda.
  const sourceHash = await sha256Hex(await sourceBlob.arrayBuffer());
  const image = await createImageBitmap(sourceBlob);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 600;
    canvas.height = 600;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Browser tidak dapat memproses logo sekolah.");
    const scale = Math.min(560 / image.width, 560 / image.height);
    const width = image.width * scale;
    const height = image.height * scale;
    context.drawImage(image, (600 - width) / 2, (600 - height) / 2, width, height);
    const png = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!png) throw new Error("Gagal membuat gambar logo sekolah.");
    return { data: await png.arrayBuffer(), sourceHash };
  } finally {
    image.close?.();
  }
}

async function makeClassDocx(students, context, grading, logoUrl) {
  const [template, logoAsset] = await Promise.all([loadTemplate(), schoolLogoPng(logoUrl)]);
  const zip = template.zip;
  const logo = logoAsset.data;
  const contentFingerprint = await reportContentFingerprint(
    students, context, grading, template.templateHash, logoAsset.sourceHash
  );
  const documentFile = zip.file("word/document.xml");
  if (!documentFile) throw new Error("Dokumen template tidak lengkap.");
  const xmlString = await documentFile.async("string");
  const xml = new DOMParser().parseFromString(xmlString, "application/xml");
  if (xml.getElementsByTagName("parsererror").length) throw new Error("XML template tidak valid.");
  const body = xml.getElementsByTagNameNS(W, "body")[0];
  if (!body) throw new Error("Isi dokumen template tidak ditemukan.");
  const section = childrenOf(body, "sectPr")[0];
  if (!section) throw new Error("Pengaturan halaman template tidak ditemukan.");
  const original = Array.from(body.children).filter((node) => node !== section);
  for (const node of original) body.removeChild(node);

  let pictureId = 500;
  for (const [index, student] of students.entries()) {
    const pages = planStudentPages(student);
    for (const [pageIndex, groups] of pages.entries()) {
      const blocks = cloneStudentBlocks(original, student, context, grading,
        groups, pageIndex, pages.length, xml);
      // Siswa baru harus memulai halaman baru, sedangkan halaman lanjutan
      // sudah diberi pageBreakBefore di judul LANJUTAN.
      if (index > 0 && pageIndex === 0) {
        const firstParagraph = blocks.find((node) =>
          node.namespaceURI === W && node.localName === "p");
        if (firstParagraph) firstPageBreak(firstParagraph, xml);
      }
      for (const node of blocks) {
        setUniquePictureIds(node, () => ++pictureId);
        body.insertBefore(node, section);
      }
    }
  }

  zip.file("word/document.xml", new XMLSerializer().serializeToString(xml));
  // File template yang disetujui telah diperiksa:
  // image2.png = logo Kemenag hijau (kiri); JANGAN DIUBAH.
  // image1.png = logo sekolah (kanan) yang diisi dari Identitas Sekolah.
  // image3.png = watermark di header Word, menggunakan logo sekolah.
  zip.file("word/media/image1.png", logo);
  zip.file("word/media/image3.png", logo);
  const kemenagBase64 = await zip.file("word/media/image2.png").async("base64");
  const schoolBase64 = bufferToBase64(logo);
  const blob = await zip.generateAsync({
    type: "blob",
    mimeType: WORD_MIME,
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
  return { blob, kemenagBase64, schoolBase64, contentFingerprint };
}


const ARCHIVE_BUCKET = "mutabaah-report-archives";

function jakartaDateISO(at = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Jakarta",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).formatToParts(at);
  const field = (name) => parts.find((part) => part.type === name)?.value || "";
  return `${field("year")}-${field("month")}-${field("day")}`;
}

function issuedOnISO(semester) {
  const end = safe(semester?.ends_on);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(end)) return "";
  const [y, m, d] = end.split("-").map(Number);
  const parsed = new Date(Date.UTC(y, m - 1, d));
  if (parsed.getUTCFullYear() !== y || parsed.getUTCMonth() !== m - 1 || parsed.getUTCDate() !== d) return "";
  const today = jakartaDateISO();
  return today <= end ? today : end;
}

function defaultSemester(rows) {
  const today = jakartaDateISO();
  const active = rows.find((s) => safe(s.starts_on) <= today && today <= safe(s.ends_on));
  if (active) return active;
  const finished = rows.filter((s) => safe(s.ends_on) < today);
  if (finished.length) return finished[0];
  return rows[rows.length - 1] || null;
}

function bufferToBase64(buffer) {
  const input = new Uint8Array(buffer);
  let binary = "";
  for (let index = 0; index < input.length; index += 8192) {
    binary += String.fromCharCode(...input.subarray(index, index + 8192));
  }
  return btoa(binary);
}

function htmlEscape(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);
}

function formatShortDate(value) {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(safe(value))
    ? new Date(`${value}T12:00:00Z`)
    : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta",
  }).format(date);
}

function archiveReadableTitle(classRow, semesterRow) {
  const className = safe(classRow?.class_name, "Kelas");
  const term = Number(semesterRow?.term) ||
    Number(safe(semesterRow?.label).match(/semester\s*(\d)/i)?.[1]) || 1;
  const yearText = safe(classRow?.academic_year) ||
    safe(semesterRow?.label) ||
    (semesterRow?.start_year ? `${semesterRow.start_year}/${Number(semesterRow.start_year) + 1}` : "");
  const match = yearText.match(/(20\d{2})\s*\/\s*(20\d{2})/);
  const yearLabel = match
    ? `${match[1].slice(-2)}/${match[2].slice(-2)}`
    : safe(yearText, "—");
  return `Rapor Mutabaah ${className} Semester ${term} Tahun ${yearLabel}`;
}

function formatArchivedAt(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
    timeZone: "Asia/Jakarta",
  }).format(date) + " WIB";
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 15000);
}

function printablePages(student, context, grading, assets) {
  const pages = planStudentPages(student);
  const notes = notesFor(student);
  const identityRows = [
    ["Nama", safe(student.name), "Rata-rata Capaian", pct(student.percentage)],
    ["NIS", safe(student.nis, "—"), "Grade Keseluruhan", safe(student.grade, "—")],
    ["Kelas", context.className, "KKM", safe(student.kkm, "—")],
    ["Wali Kelas", context.teacherName || "Belum ditetapkan", "", ""],
  ];
  return pages.map((groups, index) => {
    const isFirst = index === 0;
    const isLast = index === pages.length - 1;
    const rows = groups.flatMap((group) => [
      `<tr class="group"><td colspan="5">${htmlEscape(group.name)}</td></tr>`,
      ...group.items.map((item) => `<tr>
        <td>${htmlEscape(item.title)}</td>
        <td class="center">${htmlEscape(pct(item.target))}</td>
        <td class="center">${htmlEscape(pct(item.percentage))}</td>
        <td class="center">${htmlEscape(item.possible > 0 ? gradeFor(item.percentage, grading) : "—")}</td>
        <td>${htmlEscape(remark(item, grading))}</td>
      </tr>`),
    ]).join("");
    const header = isFirst ? `<header class="letterhead">
        <img alt="Logo Kemenag" src="data:image/png;base64,${assets.kemenagBase64}">
        <div class="school">
          <h1>${htmlEscape(context.schoolName)}</h1>
          <strong>TERAKREDITASI “A”</strong>
          <small>${htmlEscape(context.schoolAddress || "Kp. Kalijurang RT 006 RW 02 Kecamatan Purwasari Kabupaten Karawang 41377")}</small>
        </div>
        <img alt="Logo Sekolah" src="data:image/png;base64,${assets.schoolBase64}">
      </header>
      <div class="doc-title"><strong>RAPOR MUTABAAH YAUMIAH</strong><span>${htmlEscape(context.periodLabel)}</span></div>
      <table class="identity"><tbody>${identityRows.map((r) => `<tr>
        <td class="label">${htmlEscape(r[0])}</td><td class="value">${htmlEscape(r[1])}</td>
        <td class="label">${htmlEscape(r[2])}</td><td class="value">${htmlEscape(r[3])}</td>
      </tr>`).join("")}</tbody></table>` : `<div class="doc-title continued">
        <strong>RAPOR MUTABAAH YAUMIAH — LANJUTAN</strong>
        <span>${htmlEscape(student.name)} | ${htmlEscape(context.className)} | ${htmlEscape(context.periodLabel)}</span>
      </div>`;
    const afterDetails = isLast ? `<h2>APRESIASI KEGIATAN TAMBAHAN</h2>
      <div class="bonus">${bonusEntries(student).map((entry) => `<div>${htmlEscape(entry.title)}: ${entry.achieved} kali</div>`).join("") || "Belum ada kegiatan tambahan"}</div>
      <h2>RINGKASAN DAN CATATAN</h2>
      <div class="summary-notes">
        <div class="summary">${htmlEscape(notes.summary)}</div>
        <div class="notes">
          <div><strong>CATATAN UNTUK ORANG TUA/WALI</strong><p>${htmlEscape(notes.parent)}</p></div>
          <div><strong>CATATAN WALI KELAS</strong><p>${htmlEscape(student.note || "")}</p></div>
        </div>
      </div>` : `<p class="continued-notice">CAPAIAN KEGIATAN BERLANJUT DI HALAMAN ${index + 2}</p>`;
    const signatures = isLast ? `<footer class="signatures">
      <div>Orang Tua/Wali<div class="sign-area"></div>(........................................)</div>
      <div>Karawang, ${htmlEscape(context.date)}<div>Wali Kelas</div><div class="sign-area"></div>
        ${htmlEscape(context.teacherName || "(........................................)")}</div>
    </footer>` : "";
    return `<section class="sheet">
      <img class="watermark" alt="" src="data:image/png;base64,${assets.schoolBase64}">
      <div class="content">${header}
        <h2>CAPAIAN KEGIATAN${isFirst ? "" : " (LANJUTAN)"}</h2>
        <table class="details"><thead><tr><th>Kegiatan</th><th>Target</th><th>Capaian</th><th>Grade</th><th>Keterangan</th></tr></thead><tbody>${rows}</tbody></table>
        ${afterDetails}
      </div>${signatures}
    </section>`;
  }).join("");
}

function printDocumentHTML(students, context, grading, assets) {
  return `<!doctype html><html lang="id"><head><meta charset="UTF-8"><title>Rapor Mutabaah ${htmlEscape(context.className)}</title>
    <style>
      @page { size: A4 portrait; margin: 20mm; }
      * { box-sizing: border-box; }
      html, body { padding: 0; margin: 0; color: #111; background: white; font-family: Arial, sans-serif; }
      .sheet { position: relative; width: 170mm; min-height: 0; display: block;
        page-break-after: always; break-after: page; }
      .sheet:last-child { page-break-after: auto; break-after: auto; }
      .content { position: relative; z-index: 1; }
      .watermark { position: absolute; z-index: 0; top: 67mm; left: 26mm; width: 118mm; height: 125mm;
        opacity: .11; object-fit: contain; }
      .letterhead { display: grid; grid-template-columns: 19mm 1fr 19mm; gap: 3mm; align-items: center;
        text-align: center; padding-bottom: 2.4mm; border-bottom: 1mm double #444; }
      .letterhead img { width: 18mm; height: 18mm; object-fit: contain; }
      .letterhead h1 { font-size: 13pt; font-weight: 700; margin: 0 0 1mm; }
      .letterhead strong { display:block; font-size: 10pt; }
      .letterhead small { display:block; font-size: 7pt; line-height: 1.2; margin-top:1mm; }
      .doc-title { display: grid; text-align: center; margin: 3mm 0 2.4mm; gap: 1.2mm; }
      .doc-title strong { font-size: 12pt; } .doc-title span { font-size: 10pt; font-weight: 600; }
      .doc-title.continued { margin-top: 3mm; margin-bottom: 5mm; }
      .doc-title.continued strong { font-size: 12pt; }
      .doc-title.continued span { font-size: 9pt; }
      .continued-notice { font-size: 8pt; font-weight: bold; margin: 3mm 0 0; }
      .identity { width: 100%; border-collapse: collapse; font-size: 9pt; margin: 0 0 3mm; }
      .identity td { padding: .7mm .9mm; vertical-align: top; }
      .identity td.label { width: 20%; } .identity td.value { font-weight: 600; width: 30%; }
      h2 { font-size: 9.5pt; margin: 2mm 0 1mm; font-weight: 700; }
      .details { border-collapse: collapse; width: 100%; table-layout: fixed; font-size: 8.4pt; }
      .details th, .details td { border: .25pt solid #999; padding: .65mm 1.6mm; vertical-align: middle; }
      .details th { background: #eee; font-weight: bold; }
      .details th:first-child { width: 42%; text-align: left; }
      .details th:nth-child(2), .details th:nth-child(3) { width: 12%; }
      .details th:nth-child(4) { width: 9%; }
      .details th:nth-child(5) { width: 25%; text-align: left; }
      .details tr.group td { background: #ededed; font-weight: bold; text-align: center; }
      .details td.center { text-align: center; }
      tr { break-inside: avoid; page-break-inside: avoid; }
      .details thead { display: table-header-group; }
      .details tr.group { break-after: avoid; page-break-after: avoid; }
      .notes, .signatures { break-inside: avoid; page-break-inside: avoid; }
      .bonus { display: grid; grid-template-columns: repeat(4, 1fr); border: .25pt solid #999; }
      .bonus div { padding: 1.2mm .6mm; text-align: center; font-size: 8pt; border-right: .25pt solid #999; }
      .bonus div:last-child { border: 0; }
      /* Mengikuti template terbaru: ringkasan dan kedua catatan satu tabel. */
      .summary-notes { border: .25pt solid #999; }
      .summary { border-bottom: .25pt solid #999; padding: 2mm 2.4mm; font-size: 8.7pt; line-height: 1.35; }
      .notes { display: grid; grid-template-columns: 1fr 1fr; margin-top: 0; }
      .notes > div { padding: 2.3mm; min-height: 14mm; font-size: 8.5pt; line-height: 1.35; }
      .notes > div:first-child { border-right: .25pt solid #999; }
      .notes strong { font-size: 8.8pt; } .notes p { margin: 1.4mm 0 0; }
      .signatures { position: relative; z-index: 1; margin-top: 2mm; display: grid; grid-template-columns: 1fr 1fr;
        text-align: center; font-size: 9.3pt; padding-top: 5mm; }
      .signatures .sign-area { height: 13mm; }
    </style></head><body>${students.map((s) => printablePages(s, context, grading, assets)).join("")}</body></html>`;
}

function printClassHTML(students, context, grading, assets) {
  return new Promise((resolve, reject) => {
    const iframe = document.createElement("iframe");
    iframe.title = "Dokumen cetak rapor satu kelas";
    iframe.setAttribute("aria-hidden", "true");
    iframe.style.cssText = "position:fixed;left:-2000px;top:0;width:794px;height:1123px;border:0;opacity:0;pointer-events:none";
    let removed = false;
    const cleanup = () => {
      if (removed) return;
      removed = true;
      iframe.remove();
    };

    iframe.onload = () => {
      (async () => {
        const printWindow = iframe.contentWindow;
        const printDoc = iframe.contentDocument;
        if (!printWindow || !printDoc) throw new Error("Jendela cetak tidak tersedia.");
        await Promise.all(Array.from(printDoc.images).map((img) => {
          if (img.complete) return Promise.resolve();
          return new Promise((done) => {
            img.addEventListener("load", done, { once: true });
            img.addEventListener("error", done, { once: true });
          });
        }));
        if (printDoc.fonts?.ready) await printDoc.fonts.ready;
        printWindow.addEventListener("afterprint", cleanup, { once: true });
        printWindow.focus();
        printWindow.print();
        window.setTimeout(cleanup, 60000);
        resolve();
      })().catch((error) => {
        cleanup();
        reject(error);
      });
    };

    iframe.onerror = () => {
      cleanup();
      reject(new Error("Browser gagal menyiapkan halaman cetak."));
    };

    document.body.appendChild(iframe);
    iframe.srcdoc = printDocumentHTML(students, context, grading, assets);
  });
}

export default function ReportCards({ school }) {
  const [classes, setClasses] = useState([]);
  const [classId, setClassId] = useState("");
  const [periods, setPeriods] = useState([]);
  const [semesterId, setSemesterId] = useState("");
  const [students, setStudents] = useState([]);
  const [signatures, setSignatures] = useState({});
  const [grading, setGrading] = useState(null);
  const [archivePage, setArchivePage] = useState(0);
  const [archiveRefresh, setArchiveRefresh] = useState(0);
  const [canCreate, setCanCreate] = useState(false);
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [loadingPeriods, setLoadingPeriods] = useState(false);
  const [loadingReport, setLoadingReport] = useState(false);

  const [processing, setProcessing] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [deleteTarget,setDeleteTarget]=useState(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    async function getClasses() {
      try {
        const { data, error: problem } = await fetchAll(() => supabase.rpc("get_mutabaah_accessible_classes").order("academic_year", { ascending: false }).order("grade").order("class_name"), ["class_id"]);
        if (problem) throw problem;
        if (!alive) return;
        const rows = Array.isArray(data) ? data : [];
        const today = jakartaDateISO();
        const [year, month] = today.split("-").map(Number);
        const startYear = month >= 7 ? year : year - 1;
        const activeYear = `${startYear}/${startYear + 1}`;
        setClasses(rows);
        setClassId((rows.find((row) => row.academic_year === activeYear) || rows[0])?.class_id || "");
      } catch (caught) {
        if (alive) setError(caught.message || "Gagal memuat daftar kelas.");
      } finally {
        if (alive) setLoadingClasses(false);
      }
    }
    void getClasses();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!classId) return undefined;
    let alive = true;
    async function getPeriods() {
      try {
        const { data, error: problem } = await supabase.rpc("get_mutabaah_report_periods", { p_class_id: classId });
        if (problem) throw problem;
        if (!alive) return;
        const rows = Array.isArray(data) ? data : [];
        setPeriods(rows);
        setSemesterId(defaultSemester(rows)?.id || "");
      } catch (caught) {
        if (alive) setError(caught.message || "Gagal memuat semester.");
      } finally {
        if (alive) setLoadingPeriods(false);
      }
    }
    void getPeriods();
    return () => { alive = false; };
  }, [classId]);

  const loadArchives = useCallback((signal) => {
    if (!classId || !semesterId) return Promise.resolve({ data: [], count: 0 });
    return supabase.rpc("get_mutabaah_report_archives_v3", { p_class_id: classId, p_semester_id: semesterId }, { count: "exact" })
      .order("created_at", { ascending: false }).order("id")
      .range(archivePage * PAGE_SIZE, (archivePage + 1) * PAGE_SIZE - 1).abortSignal(signal);
  }, [classId, semesterId, archivePage]);
  const archiveResult = usePagedQuery(loadArchives, archivePage, setArchivePage, 200, 0, archiveRefresh);
  const archives = archiveResult.data;
  const loadingArchives = archiveResult.loading;
  const refreshArchives = useCallback(async () => { setArchiveRefresh((value) => value + 1); }, []);
  useEffect(() => {
    if (!classId) return undefined;
    let alive = true;
    supabase.rpc("mutabaah_can_write_report_class", { p_class_id: classId })
      .then(({ data, error }) => { if (alive) { setCanCreate(!error && Boolean(data)); if (error) setError(error.message); } });
    return () => { alive = false; };
  }, [classId]);

  const currentClass = classes.find((item) => item.class_id === classId);
  const currentPeriod = periods.find((item) => item.id === semesterId);
  const context = {
    className: safe(currentClass?.class_name, "—"),
    schoolName: formatSchoolName(signatures.school_name || school?.name),
    schoolAddress: safe(signatures.address || school?.address),
    periodLabel: formatPeriod(currentPeriod, currentClass),
    teacherName: safe(signatures.teacher_name),
    signingLocation: "Karawang",
    date: formatIssuanceDate(currentPeriod?.ends_on),
  };
  const logoUrl = school?.logoUrl || signatures.logo_url || "";

  function changeClass(value) {
    setClassId(value);
    setPeriods([]);
    setSemesterId("");
    setStudents([]);
    setSignatures({});
    setGrading(null);
    setArchivePage(0);
    setCanCreate(false);
    setLoaded(false);
    setLoadingPeriods(Boolean(value));
    setError("");
    setNotice("");
  }

  function changeSemester(value) {
    setSemesterId(value);
    setStudents([]);
    setSignatures({});
    setGrading(null);
    setArchivePage(0);
    // Izin ini melekat pada kelas, bukan semester. Pemeriksaan di server
    // tetap dijalankan saat membuat arsip; jangan hilangkan izin kelas
    // hanya karena filter semester berubah.
    setLoaded(false);
    setError("");
    setNotice("");
  }

  async function loadReport() {
    if (!classId || !semesterId || loadingReport) return;
    setLoadingReport(true);
    setError("");
    setNotice("");
    setStudents([]);
    setLoaded(false);
    try {
      const args = { p_class_id: classId, p_semester_id: semesterId };
      const results = await Promise.all([
        supabase.rpc("get_mutabaah_report_details", args),
        supabase.rpc("get_mutabaah_report_bonus", args),
        supabase.rpc("get_mutabaah_report_signatures", { p_class_id: classId }),
        supabase.rpc("get_mutabaah_report_grading"),
      ]);
      const failed = results.find((result) => result.error);
      if (failed) throw failed.error;
      const bonusMap = new Map((Array.isArray(results[1].data) ? results[1].data : []).map(
        (row) => [row.id, row.bonuses || []]
      ));
      const rows = (Array.isArray(results[0].data) ? results[0].data : []).map((student) => ({
        ...student, bonuses: bonusMap.get(student.id) || [],
      }));
      setStudents(rows);
      setSignatures(results[2].data || {});
      setGrading(results[3].data || {});
      setLoaded(true);
    } catch (caught) {
      setError(caught.message || "Gagal memuat data rapor.");
    } finally {
      setLoadingReport(false);
    }
  }

  async function archiveDocx(blob, issuedOn, fileName, contentFingerprint) {
    const bucket = supabase.storage.from(ARCHIVE_BUCKET);

    // Selalu cek kondisi terbaru dari server, bukan hanya daftar arsip di panel.
    // Hash dibuat dari isi data, aturan nilai, template, dan logo.
    // Tanggal pengunduhan sengaja tidak termasuk dalam hash.
    const { data: existingRows, error: findError } = await supabase.rpc(
      "get_mutabaah_report_archives_v3",
      { p_class_id: classId, p_semester_id: semesterId }
    ).eq("content_fingerprint", contentFingerprint).order("id").range(0, 0);
    if (findError) {
      throw new Error(`Gagal memeriksa arsip yang sudah ada: ${findError.message}`, { cause: findError });
    }
    const rows = Array.isArray(existingRows) ? existingRows : [];
    if (rows.some((entry) => entry.content_fingerprint === contentFingerprint)) {
      return { created: false };
    }

    const id = crypto.randomUUID();
    const path = `${classId}/${semesterId}/${id}.docx`;
    const wordFile = new File([blob], `${id}.docx`, { type: WORD_MIME });
    const { error: uploadError } = await bucket.upload(path, wordFile, {
      contentType: WORD_MIME,
      upsert: false,
      cacheControl: "3600",
    });
    if (uploadError) {
      throw new Error(`Gagal mengunggah arsip rapor: ${uploadError.message}`, { cause: uploadError });
    }

    let created;
    try {
      // Unique constraint di database mencegah dua akun membuat arsip yang
      // sama bersamaan, walaupun keduanya sempat mengunggah file.
      const { data, error: dbError } = await supabase.rpc(
        "register_mutabaah_report_archive_v2",
        {
          p_archive_id: id,
          p_class_id: classId,
          p_semester_id: semesterId,
          p_file_name: fileName,
          p_student_count: students.length,
          p_issued_on: issuedOn,
          p_content_fingerprint: contentFingerprint,
        }
      );
      if (dbError) throw dbError;
      created = data?.created === true;
      if (!created && data?.created !== false) {
        throw new Error("Server tidak memberikan status penyimpanan arsip yang valid.");
      }
    } catch (caught) {
      const { error: cleanupError } = await bucket.remove([path]);
      if (cleanupError) console.warn("File arsip sementara belum dapat dihapus: cleanup_failed");
      throw new Error(`Gagal mencatat arsip rapor: ${caught.message}`, { cause: caught });
    }

    if (!created) {
      // Balapan unggah: arsip identik sudah dicatat oleh pengguna lain.
      // File sementara tidak perlu disimpan dua kali.
      const { error: cleanupError } = await bucket.remove([path]);
      if (cleanupError) console.warn("File arsip sementara belum dapat dihapus: cleanup_failed");
    }
    try {
      await refreshArchives(classId, semesterId);
    } catch {
      console.warn("Daftar arsip belum bisa diperbarui: refresh_failed");
    }
    return { created };
  }

  async function produceReport(mode) {
    if (processing || !students.length || !grading || !canCreate) return;
    const issuedOn = issuedOnISO(currentPeriod);
    if (!issuedOn) {
      setError("Tanggal akhir semester tidak valid. Periksa pengaturan semester.");
      return;
    }
    if (!logoUrl) {
      setError("Logo sekolah belum tersedia. Unggah logo melalui Identitas Sekolah.");
      return;
    }
    setProcessing(mode);
    setNotice("");
    setError("");
    const issuedDate = formatIssuanceDate(currentPeriod?.ends_on, new Date());
    const currentContext = { ...context, date: issuedDate };
    const fileName = `Rapor-Mutabaah-${fileSafe(context.className)}-${fileSafe(currentPeriod?.label)}-${issuedOn}.docx`;
    let archived = false;
    try {
      const prepared = await makeClassDocx(students, currentContext, grading, logoUrl);
      const archiveResult = await archiveDocx(
        prepared.blob, issuedOn, fileName, prepared.contentFingerprint
      );
      archived = true;
      if (mode === "download") {
        // DOCX hasil unduh selalu dibuat baru agar tanggal pengesahan tetap
        // mengikuti tanggal unduhan, walau arsip lama yang identik dipakai ulang.
        downloadBlob(prepared.blob, fileName);
        setNotice(archiveResult.created
          ? "DOCX satu kelas diunduh dan salinannya tersimpan sebagai arsip baru."
          : "DOCX satu kelas diunduh. Data sama dengan arsip sebelumnya, sehingga tidak menambah arsip.");
      } else {
        await printClassHTML(students, currentContext, grading, prepared);
        setNotice(archiveResult.created
          ? "Dialog cetak dibuka dan salinan DOCX tersimpan sebagai arsip baru."
          : "Dialog cetak dibuka. Data sama dengan arsip sebelumnya, sehingga tidak menambah arsip.");
      }
    } catch (caught) {
      setError(`${archived ? "Arsip telah tersimpan. " : ""}${caught.message || "Gagal memproses rapor."}`);
    } finally {
      setProcessing("");
    }
  }

  async function downloadArchive(entry) {
    if (processing) return;
    setProcessing(entry.id);
    setError("");
    setNotice("");
    try {
      const { data, error: problem } = await supabase.storage.from(ARCHIVE_BUCKET).download(entry.storage_path);
      if (problem) throw problem;
      downloadBlob(data, entry.file_name);
    } catch (caught) {
      setError(caught.message || "Gagal mengunduh arsip.");
    } finally {
      setProcessing("");
    }
  }

  async function deleteArchive(entry) {
    if (processing || !entry.can_delete) return;
    const title = archiveReadableTitle(currentClass, currentPeriod);
    setProcessing(`delete:${entry.id}`);
    setError("");
    setNotice("");
    try {
      // Urutan aman: file Storage lebih dulu, baru metadata PostgreSQL.
      // Backend memverifikasi file sudah terhapus sebelum menghapus metadata.
      const { error: storageError } = await supabase.storage
        .from(ARCHIVE_BUCKET)
        .remove([entry.storage_path]);
      if (storageError) {
        throw new Error(`Gagal menghapus file arsip: ${storageError.message}`, {
          cause: storageError,
        });
      }

      const { error: dbError } = await supabase.rpc(
        "delete_mutabaah_report_archive",
        { p_archive_id: entry.id }
      );
      if (dbError) {
        throw new Error(`File terhapus tetapi daftar arsip belum terbarui: ${dbError.message}`, {
          cause: dbError,
        });
      }

      // Storage + PostgreSQL delete already succeeded. Closing must not
      // depend on refreshing the list; a fetch failure is not a delete failure.
      setDeleteTarget(null);
      setNotice(`Arsip ${title} berhasil dihapus permanen.`);
      try {
        await refreshArchives();
      } catch {
        setNotice(`Arsip ${title} berhasil dihapus. Daftar terbaru belum dapat dimuat; perbarui halaman jika masih terlihat.`);
      }
    } catch (caught) {
      setError(caught.message || "Gagal menghapus arsip rapor.");
    } finally {
      setProcessing("");
    }
  }

  return (
    <section className="mut-rapor-page">
      <style>{`
        .mut-rapor-page { background:var(--sa-card,#fff); border:1px solid var(--sa-line,#e1e9e3); border-radius:12px; padding:20px; color:var(--sa-ink,#253d31); }
        .mut-rapor-page h2 { margin:0 0 18px; font-size:19px; color:var(--sa-accent,#17533b); }
        .mut-rapor-filters { display:flex; flex-wrap:wrap; gap:14px; margin-bottom:14px; }
        .mut-rapor-filters label { display:grid; gap:7px; font-size:13px; flex:1 1 190px; }
        .mut-rapor-filters select { width:100%; background:var(--sa-card,#fff); border:1px solid var(--sa-line,#d7e3da); padding:10px 12px; border-radius:8px; color:var(--sa-ink,#253d31); }
        .mut-rapor-button { border:1px solid var(--sa-accent,#176a4a); padding:10px 17px; background:var(--sa-accent,#176a4a); color:#fff; border-radius:8px; font-weight:600; font-size:13px; cursor:pointer; }
        .mut-rapor-button.secondary { background:var(--sa-card,#fff); color:var(--sa-accent,#176a4a); }
        .mut-rapor-button:disabled { opacity:.5; cursor:default; }
        .mut-rapor-actions { display:flex; flex-wrap:wrap; align-items:center; gap:10px; margin-top:20px; }
        .mut-rapor-muted { font-size:13px; color:var(--sa-muted,#687970); }
        .mut-rapor-message { font-size:13px; margin:14px 0 0; line-height:1.5; }
        .mut-rapor-message.error { color:#a32323; }
        .mut-rapor-message.success { color:var(--sa-accent,#12613e); }
        .mut-rapor-archives { margin-top:26px; border-top:1px solid var(--sa-line,#e6ece7); padding-top:18px; }
        .mut-rapor-archives h3 { font-size:15px; margin:0 0 12px; color:var(--sa-ink,#173d2b); }
        .mut-rapor-list { border:1px solid var(--sa-line,#e5ebe7); border-radius:9px; overflow:hidden; }
        .mut-rapor-record { display:flex; flex-wrap:wrap; gap:12px; justify-content:space-between; align-items:center; padding:12px 14px; border-bottom:1px solid var(--sa-line,#edf1ed); }
        .mut-rapor-record:last-child { border-bottom:0; }
        .mut-rapor-record strong { display:block; font-size:13px; color:var(--sa-ink,#253c31); margin-bottom:4px; overflow-wrap:anywhere; }
        .mut-rapor-record small { display:block; color:var(--sa-muted,#6c7f72); font-size:11px; line-height:1.5; }
        .mut-rapor-record button { background:var(--sa-card,#fff); color:var(--sa-accent,#176a4a); border:1px solid var(--sa-line,#b9d2c3); border-radius:8px; padding:8px 12px; font-size:12px; cursor:pointer; }
        .mut-rapor-record button:disabled { opacity:.5; cursor:default; }
        .mut-rapor-record-actions { display:flex; flex-wrap:wrap; gap:8px; align-items:center; }
        .mut-rapor-record button.delete { color:#963434; border-color:#ecc4c4; }
        .mut-rapor-record button.delete:hover:not(:disabled) { background:#fff3f3; }
        @media (max-width:600px) { .mut-rapor-page { padding:14px; } .mut-rapor-actions button { flex:1 1 180px; } }
      `}</style>

      <h2>Rapor Mutabaah</h2>
      <div className="mut-rapor-filters">
        <label>
          Kelas
          <select value={classId} disabled={loadingClasses || loadingReport || Boolean(processing)} onChange={(event) => changeClass(event.target.value)}>
            {!classes.length && <option value="">Belum ada kelas</option>}
            {classes.map((item) => <option key={item.class_id} value={item.class_id}>{item.class_name}</option>)}
          </select>
        </label>
        <label>
          Semester
          <select value={semesterId} disabled={!classId || loadingPeriods || loadingReport || Boolean(processing)} onChange={(event) => changeSemester(event.target.value)}>
            {!periods.length && <option value="">Belum ada semester</option>}
            {periods.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}{item.starts_on <= jakartaDateISO() && jakartaDateISO() <= item.ends_on ? " (Aktif)" : ""}
              </option>
            ))}
          </select>
        </label>
      </div>

      <button className="mut-rapor-button secondary" type="button" disabled={!classId || !semesterId || loadingReport || Boolean(processing)} onClick={() => void loadReport()}>
        {loadingReport ? "Memuat data..." : "Tampilkan Data Rapor"}
      </button>

      {(error || archiveResult.error) && <p className="mut-rapor-message error" role="alert">{error || archiveResult.error}</p>}
      {notice && <p className="mut-rapor-message success" role="status">{notice}</p>}

      {loaded && !students.length && <p className="mut-rapor-muted">Tidak ada siswa pada semester yang dipilih.</p>}

      {loaded && students.length > 0 && (
        <div className="mut-rapor-actions">
          <span className="mut-rapor-muted">{students.length} siswa · satu dokumen untuk seluruh kelas · 1–2 halaman per siswa bila diperlukan</span>
          {canCreate && <>
            <button className="mut-rapor-button" type="button" disabled={Boolean(processing)} onClick={() => void produceReport("download")}>
              {processing === "download" ? "Menyiapkan..." : "Unduh DOCX Satu Kelas"}
            </button>
            <button className="mut-rapor-button secondary" type="button" disabled={Boolean(processing)} onClick={() => void produceReport("print")}>
              {processing === "print" ? "Menyiapkan cetak..." : "Cetak Langsung Satu Kelas"}
            </button>
          </>}
        </div>
      )}

      <div className="mut-rapor-archives">
        <h3>Arsip Rapor</h3>
        <Pagination page={archivePage} total={archiveResult.total} loading={loadingArchives || Boolean(processing)} onChange={setArchivePage} />
        {loadingArchives ? (
          <p className="mut-rapor-muted">Memuat arsip...</p>
        ) : !classId || !semesterId ? (
          <p className="mut-rapor-muted">Pilih kelas dan semester.</p>
        ) : !archives.length ? (
          <EmptyState kind="school" illustration="report-card" title="Belum ada rapor" description="Rapor yang telah diterbitkan akan muncul di arsip semester ini." />
        ) : (
          <div className="mut-rapor-list">
            {archives.map((entry) => (
              <div className="mut-rapor-record" key={entry.id}>
                <div>
                  <strong>{archiveReadableTitle(currentClass, currentPeriod)}</strong>
                  <small>{entry.student_count} siswa · Pengesahan: Karawang, {formatShortDate(entry.issued_on)}</small>
                  <small>Disimpan: {formatArchivedAt(entry.created_at)} · Oleh: {entry.creator_name}</small>
                </div>
                <div className="mut-rapor-record-actions">
                  <button type="button" disabled={Boolean(processing)} onClick={() => void downloadArchive(entry)}>
                    {processing === entry.id ? "Mengunduh..." : "Unduh Arsip"}
                  </button>
                  {entry.can_delete && (
                    <button className="delete" type="button" disabled={Boolean(processing)} onClick={() => {setError("");setDeleteTarget(entry)}}>
                      {processing === `delete:${entry.id}` ? "Menghapus..." : "Hapus Arsip"}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {deleteTarget&&<AppConfirmDialog danger
        title="Hapus Arsip Rapor?"
        description={`Hapus permanen file DOCX dan catatan arsip?\n\n${archiveReadableTitle(currentClass,currentPeriod)}\nDisimpan: ${formatArchivedAt(deleteTarget.created_at)}\nTindakan ini tidak dapat dibatalkan.`}
        confirmLabel="Ya, Hapus Arsip" busy={Boolean(processing)} error={error}
        onCancel={()=>{setDeleteTarget(null);setError("")}}
        onConfirm={()=>void deleteArchive(deleteTarget)}
      />}
    </section>
  );
}
