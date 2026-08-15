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
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
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

/** Generate a paginated A4 PDF report of the filtered rows (Prompt font embedded). */
export async function exportPDF(
  rows: SheetRow[],
  ctx: { total: number; agencyCount: number; filters: Filters },
): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  doc.addFileToVFS("Prompt-Regular.ttf", await fetchFontBase64());
  doc.addFont("Prompt-Regular.ttf", "Prompt", "normal");
  doc.setFont("Prompt");

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 14;
  const sorted = [...rows].sort((a, b) => b.price - a.price);
  const shown = sorted.slice(0, MAX_PDF_ROWS);

  // header band
  doc.setFillColor(47, 111, 79);
  doc.rect(0, 0, pageW, 26, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(15);
  doc.text("ราคาเสนอ/terminal — รายงานข้อมูล", margin, 12);
  doc.setFontSize(8.5);
  doc.text("sheet://1UtSyr…NRxcw · sheet99 · อัปเดตล่าสุดจาก Google Sheets", margin, 20);

  // summary block
  doc.setTextColor(38, 60, 49);
  doc.setFontSize(10.5);
  doc.text("สรุปข้อมูล", margin, 35);
  const activeFilters = (Object.entries(ctx.filters) as [keyof Filters, string][]).filter(
    ([, value]) => value !== "" && value !== undefined,
  );
  const metaLines = [
    `สร้างเมื่อ: ${new Date().toLocaleString("th-TH", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })}`,
    `ยอดรวมราคาเสนอ: ${fmtBaht(ctx.total)}`,
    `จำนวนรายการ: ${fmtNum(rows.length)} รายการ`,
    `จำนวนหน่วยงาน: ${fmtNum(ctx.agencyCount)} หน่วยงาน`,
    activeFilters.length > 0
      ? `ตัวกรอง: ${activeFilters
          .map(([key, value]) => `${DIMENSION_MAP[key].code}: ${value}`)
          .join("  ·  ")}`
      : "ตัวกรอง: ไม่มี (แสดงข้อมูลทั้งหมด)",
  ];
  doc.setFontSize(9);
  metaLines.forEach((line, i) => {
    doc.text(line, margin, 42 + i * 5.5);
  });
  const afterMeta = 42 + metaLines.length * 5.5 + 6;

  // data table
  const trunc = (s: string, n: number) => (s.length > n ? `${s.slice(0, n)}…` : s);
  autoTable(doc, {
    startY: afterMeta,
    margin: { left: margin, right: margin, top: 32, bottom: 16 },
    head: [EXPORT_HEADERS as unknown as string[]],
    body: shown.map((row) => [
      row.regNo,
      row.date,
      trunc(row.mission, 18),
      trunc(row.workGroup, 16),
      trunc(row.agency, 16),
      trunc(row.item, 30),
      trunc(row.category, 16),
      trunc(row.type, 14),
      row.planType || "—",
      fmtBaht(row.price),
    ]),
    styles: {
      font: "Prompt",
      fontSize: 7,
      cellPadding: 1.4,
      textColor: [45, 55, 50],
      lineColor: [212, 208, 192],
      lineWidth: 0.15,
      overflow: "linebreak",
    },
    headStyles: {
      fillColor: [47, 111, 79],
      textColor: [255, 255, 255],
      fontStyle: "normal",
      fontSize: 7,
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
      doc.text(`หน้า ${page}`, pageW - margin, pageH - 8, { align: "right" });
      doc.text("ราคาเสนอ/terminal", margin, pageH - 8);
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
