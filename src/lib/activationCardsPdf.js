// PDF dibuat lokal di perangkat petugas, tanpa mengunggah kode ke server.
// QR semua kartu sama: membuka halaman awal aplikasi (pilih Aktivasi Akun).
const RELATIONSHIP = { father: "Ayah", mother: "Ibu", guardian: "Wali" };
const CARDS_PER_PAGE = 12;
const MARGIN_MM = 9;
const GAP_MM = 3;
const CARD_WIDTH_MM = (210 - MARGIN_MM * 2 - GAP_MM * 2) / 3;
const CARD_HEIGHT_MM = (297 - MARGIN_MM * 2 - GAP_MM * 3) / 4;

function dateLabel(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta", day: "numeric", month: "short", year: "numeric",
  }).format(date);
}

function fitText(doc, value, x, y, width, maxSize = 8, minSize = 6.2) {
  const valueText = String(value || "—").replace(/\s+/g, " ").trim();
  doc.setFont("helvetica", "normal");
  let size = maxSize;
  doc.setFontSize(size);
  while (size > minSize && doc.getTextWidth(valueText) > width) {
    size = Math.max(minSize, size - 0.3);
    doc.setFontSize(size);
  }
  if (doc.getTextWidth(valueText) <= width) {
    doc.text(valueText, x, y);
    return;
  }
  let shortened = valueText;
  while (shortened.length > 1 && doc.getTextWidth(shortened + "...") > width) {
    shortened = shortened.slice(0, -1);
  }
  doc.text(shortened + "...", x, y);
}

function textAt(doc, value, x, y, size = 7, weight = "normal", color = [37, 60, 46]) {
  doc.setFont("helvetica", weight);
  doc.setFontSize(size);
  doc.setTextColor(...color);
  doc.text(String(value), x, y);
}

function drawCard(doc, item, qrData, x, y) {
  const w = CARD_WIDTH_MM;
  const h = CARD_HEIGHT_MM;
  doc.setDrawColor(182, 192, 184);
  doc.setLineWidth(0.25);
  doc.setLineDashPattern([1.3, 1.1], 0);
  doc.rect(x, y, w, h);
  doc.setLineDashPattern([], 0);

  doc.setFillColor(232, 242, 235);
  doc.rect(x + 0.35, y + 0.35, w - 0.7, 10.0, "F");
  textAt(doc, "MTs AL-KHAIRIYAH", x + 3.6, y + 4.7, 7.1, "bold", [22, 82, 56]);
  textAt(doc, "KARTU AKTIVASI AKUN", x + 3.6, y + 8, 5.8, "normal", [70, 103, 81]);

  textAt(doc, "SISWA", x + 3.6, y + 14.0, 5.3, "normal", [109, 122, 113]);
  fitText(doc, item.student_name, x + 3.6, y + 18.0, w - 7.2, 8.2, 6.4);
  textAt(doc, "KELAS", x + 3.6, y + 22.4, 5.3, "normal", [109, 122, 113]);
  fitText(doc, item.class_name || "—", x + 3.6, y + 26.1, w - 7.2, 7.5, 6.3);
  textAt(doc, "ORANG TUA / WALI", x + 3.6, y + 30.5, 5.3, "normal", [109, 122, 113]);
  fitText(doc, item.contact_name + " (" + (RELATIONSHIP[item.relationship] || "Wali") + ")", x + 3.6, y + 34.2, w - 7.2, 7.2, 6.1);
  fitText(doc, item.phone || "—", x + 3.6, y + 38.0, w - 7.2, 6.7, 6.1);

  doc.setFillColor(238, 246, 239);
  doc.roundedRect(x + 3.6, y + 42.0, 32.4, 15.5, 1.6, 1.6, "F");
  textAt(doc, "KODE AKTIVASI", x + 6.0, y + 46.3, 5.3, "normal", [89, 120, 100]);
  textAt(doc, item.activation_code, x + 6, y + 54.1, 15.2, "bold", [24, 75, 51]);

  // QR umum menyertakan quiet zone putih di dalam bitmap.
  doc.addImage(qrData, "PNG", x + w - 23.0, y + 40.0, 19.4, 19.4, undefined, "FAST");
  textAt(doc, "Scan QR", x + w - 20.3, y + 61.0, 5.7, "normal", [72, 98, 79]);
  textAt(doc, "Berlaku s.d. " + dateLabel(item.expires_at), x + 3.6, y + h - 5.9, 5.9, "normal", [91, 108, 95]);
  textAt(doc, "Sekali pakai - pilih Aktivasi Akun", x + 3.6, y + h - 2.8, 5.2, "normal", [91, 108, 95]);
}

async function loadGeneralQr() {
  const path = import.meta.env.BASE_URL + "activation/qr-umum.png";
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) throw new Error("Gagal mengambil QR aktivasi. Periksa koneksi.");
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const file = new FileReader();
    file.onload = () => resolve(file.result);
    file.onerror = () => reject(new Error("Gagal membaca gambar QR."));
    file.readAsDataURL(blob);
  });
}

export async function downloadActivationCardsPdf(rows, selectedClass = "semua-kelas") {
  const cards = rows.filter(
    (row) => row.code_state === "active" && /^[a-z]{4}$/.test(row.activation_code || "")
  );
  if (cards.length === 0) throw new Error("Belum ada kode aktif yang dapat dicetak.");
  cards.sort((a, b) =>
    (a.class_name || "").localeCompare(b.class_name || "", "id") ||
    (a.student_name || "").localeCompare(b.student_name || "", "id") ||
    (a.relationship || "").localeCompare(b.relationship || "", "id")
  );
  const [{ jsPDF }, qr] = await Promise.all([import("jspdf"), loadGeneralQr()]);
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
  for (let index = 0; index < cards.length; index += 1) {
    if (index && index % CARDS_PER_PAGE === 0) doc.addPage();
    const offset = index % CARDS_PER_PAGE;
    drawCard(
      doc, cards[index], qr,
      MARGIN_MM + (offset % 3) * (CARD_WIDTH_MM + GAP_MM),
      MARGIN_MM + Math.floor(offset / 3) * (CARD_HEIGHT_MM + GAP_MM)
    );
  }
  const safeClass = String(selectedClass || "semua-kelas")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "semua-kelas";
  doc.save("kartu-aktivasi-" + safeClass + ".pdf");
  return cards.length;
}

export const ACTIVATION_CARD_LAYOUT = {
  columns: 3, rows: 4, cardsPerPage: CARDS_PER_PAGE,
  widthMm: CARD_WIDTH_MM, heightMm: CARD_HEIGHT_MM,
};
