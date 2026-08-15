import { DIMENSION_MAP, fmtBaht, fmtNum, type Filters, type SheetRow } from "@/lib/sheet";

// Prompt-Regular TTF (Thai + Latin) served with CORS enabled — used to render
// Thai text correctly inside the jsPDF report (built-in PDF fonts have no Thai).
const PROMPT_TTF_URLS = [
  "https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/prompt/Prompt-Regular.ttf",
  "https://raw.githubusercontent.com/google/fonts/main/ofl/prompt/Prompt-Regular.ttf",
];

const EXPORT_HEADERS = [
  "เลขทะเบียนคุม",
  "เดือน",
  "กลุ่มภารกิจ",
  "กลุ่มงาน",
  "หน่วยงาน",
  "รายการ",
  "หมวด",
  "ประเภท",
  "ประเภทแผน",
  "ราคาเสนอ",
] as const;

// keep the PDF report fast — first N rows of the filtered set
const MAX_PDF_ROWS = 400;

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

async function fetchFontBase64(): Promise<string> {
  let lastError: unknown = null;
  for (const url of PROMPT_TTF_URLS) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return arrayBufferToBase64(await res.arrayBuffer());
    } catch (e) {
      lastError = e;
    }
  }
  const msg = lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(`โหลดฟอนต์สำหรับ PDF ไม่สำเร็จ (${msg})`);
}

function csvField(value: string | number): string {
  const s = String(value);
  return /[\",\n]/.test(s) ? `"${s.replace(/\"/g, '"\"')}"` : s;
}

function dateStamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Download the currently filtered rows as a UTF-8 CSV (BOM so Excel reads Thai correctly). */
export function exportCSV(rows: SheetRow[]): void {
  const sorted = [...rows].sort((a, b) => b.price - a.price);
  const lines: string[] = [EXPORT_HEADERS.join(",")];
  for (const row of sorted) {
    lines.push(
      [
        row.regNo,
        row.date,
        row.mission,
        row.workGroup,
        row.agency,
        row.item,
        row.category,
        row.type,
        row.planType,
        row.price,
      ]
        .map(csvField)
        .join(","),
    );
  }
  const blob = new Blob(["\uFEFF" + lines.join("\r\n")], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `ราคาเสนอ_${dateStamp()}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Wrap a long string onto multiple lines, breaking only at the "  ·  " separators. */
function wrapFilters(text: string, maxChars: number): string[] {
  const parts = text.split("  ·  ");
  const lines: string[] = [];
  let current = "";
  for (const part of parts) {
    const candidate = current ? `${current}  ·  ${part}` : part;
    if (candidate.length > maxChars && current) {
      lines.push(current);
      current = part;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/**
 * Generate an A4 landscape PDF report of the filtered rows (Prompt font embedded).
 * Landscape keeps every table row on a single line, cutting the page count down.
 */
export async function exportPDF(
  rows: SheetRow[],
  ctx: { total: number; agencyCount: number; filters: Filters },
): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape" });
  doc.addFileToVFS("Prompt-Regular.ttf", await fetchFontBase64());
  doc.addFont("Prompt-Regular.ttf", "Prompt", "normal");
  doc.setFont("Prompt");

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 14;
  const sorted = [...rows].sort((a, b) => b.price - a.price);
  const shown = sorted.slice(0, MAX_PDF_ROWS);

  // header band
  const created = `สร้างเมื่อ: ${new Date().toLocaleString("th-TH", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })}`;
  doc.setFillColor(47, 111, 79);
  doc.rect(0, 0, pageW, 22, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.text("ราคาเสนอ/terminal — รายงานข้อมูล", margin, 10);
  doc.setFontSize(8);
  doc.text("sheet://1UtSyr…NRxcw · sheet99 · อัปเดตล่าสุดจาก Google Sheets", margin, 17);
  doc.text(created, pageW - margin, 10, { align: "right" });

  // summary — single compact row (landscape has room for everything on one line)
  doc.setTextColor(38, 60, 49);
  doc.setFontSize(9);
  const activeFilters = (Object.entries(ctx.filters) as [keyof Filters, string][]).filter(
    ([, value]) => value !== "" && value !== undefined,
  );
  doc.text(
    `ยอดรวม: ${fmtBaht(ctx.total)}  ·  รายการ: ${fmtNum(rows.length)}  ·  หน่วยงาน: ${fmtNum(ctx.agencyCount)}  ·  แสดง: ${fmtNum(shown.length)} แถว${rows.length > MAX_PDF_ROWS ? ` จาก ${fmtNum(rows.length)}` : ""}`,
    margin,
    32,
  );

  // filters — wrapped onto extra lines only when the list is long
  let tableStart = 38;
  if (activeFilters.length > 0) {
    const filterText = activeFilters
      .map(([key, value]) => `${DIMENSION_MAP[key].code}: ${value}`)
      .join("  ·  ");
    const maxChars = Math.floor((pageW - margin * 2) / 3.1);
    const lines = wrapFilters(`ตัวกรอง: ${filterText}`, maxChars);
    doc.setFontSize(8.5);
    doc.setTextColor(90, 100, 88);
    lines.forEach((line, i) => {
      doc.text(line, margin, 38 + i * 5);
    });
    tableStart = 38 + lines.length * 5 + 3;
  }

  // data table — wide columns + ellipsize keep every row on a single line
  const trunc = (s: string, n: number) => (s.length > n ? `${s.slice(0, n)}…` : s);
  autoTable(doc, {
    startY: tableStart,
    margin: { left: margin, right: margin, top: 26, bottom: 12 },
    head: [EXPORT_HEADERS as unknown as string[]],
    body: shown.map((row) => [
      row.regNo,
      row.date,
      trunc(row.mission, 26),
      trunc(row.workGroup, 24),
      trunc(row.agency, 24),
      trunc(row.item, 42),
      trunc(row.category, 20),
      trunc(row.type, 18),
      row.planType || "—",
      fmtBaht(row.price),
    ]),
    styles: {
      font: "Prompt",
      fontSize: 7.5,
      cellPadding: 1.2,
      textColor: [45, 55, 50],
      lineColor: [212, 208, 192],
      lineWidth: 0.15,
      overflow: "ellipsize",
    },
    headStyles: {
      fillColor: [47, 111, 79],
      textColor: [255, 255, 255],
      fontStyle: "normal",
      fontSize: 7.5,
      halign: "left",
    },
    alternateRowStyles: { fillColor: [244, 242, 234] },
    columnStyles: {
      9: { halign: "right" },
    },
    didDrawPage: () => {
      const page = doc.getNumberOfPages();
      doc.setFontSize(8);
      doc.setTextColor(130, 135, 120);
      doc.text(`หน้า ${page}`, pageW - margin, pageH - 7, { align: "right" });
      doc.text("ราคาเสนอ/terminal", margin, pageH - 7);
    },
  });

  if (rows.length > MAX_PDF_ROWS) {
    // autoTable v5 sets doc.lastAutoTable at runtime (types don't declare it)
    const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable
      .finalY;
    doc.setFontSize(8);
    doc.setTextColor(130, 135, 120);
    doc.text(
      `แสดง ${fmtNum(MAX_PDF_ROWS)} แถวแรกจาก ${fmtNum(rows.length)} แถว (ส่งออก CSV เพื่อรับข้อมูลครบทั้งหมด)`,
      margin,
      finalY + 6,
    );
  }

  doc.save(`ราคาเสนอ_${dateStamp()}.pdf`);
}
