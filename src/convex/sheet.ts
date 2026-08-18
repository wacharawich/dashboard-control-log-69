import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";
import { Infer, v } from "convex/values";
import { action, mutation, query } from "./_generated/server";
import { sheetRowValidator } from "./schema";

type SheetRow = Infer<typeof sheetRowValidator>;

const SHEET_ID = "1UtSyrAUOXdtRiztXbN4ntobPeS0fMErUrAIeK4NRxcw";
const SHEET_NAME = "sheet99";
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${SHEET_NAME}`;
const HEADER_FIRST_CELL = "เลขทะเบียนคุม";
// keep each stored document comfortably under Convex's ~1MB value limit
const CHUNK_SIZE = 1800;
// re-fetch from Google at most every 10 minutes unless forced
const FRESH_MS = 10 * 60 * 1000;

const THAI_MONTHS = [
  "ม.ค.",
  "ก.พ.",
  "มี.ค.",
  "เม.ย.",
  "พ.ค.",
  "มิ.ย.",
  "ก.ค.",
  "ส.ค.",
  "ก.ย.",
  "ต.ค.",
  "พ.ย.",
  "ธ.ค.",
];

/** ค่าที่อนุญาตสำหรับคอลัมน์ K สถานะ */
export const STATUS_OPTIONS = ["เสนอ", "อนุมัติ", "ไม่อนุมัติ", "รอปรับแผน"] as const;

/** Minimal RFC-4180-ish CSV parser (handles quoted fields, escaped quotes, newlines). */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
    } else if (ch !== "\r") {
      field += ch;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function parsePrice(raw: string): number | null {
  const cleaned = raw.replace(/[, ]/g, "").trim();
  if (cleaned === "") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/** "19 ก.ย. 2025" -> { monthKey: "ก.ย. 2025", monthOrder: 2025*12 + 8 } */
function normalizeMonth(raw: string): { monthKey: string; monthOrder: number } {
  const m = raw.trim().match(/^(\d{1,2})\s+(\S+)\s+(\d{4})$/);
  if (m) {
    const idx = THAI_MONTHS.indexOf(m[2]);
    const year = Number(m[3]);
    if (idx >= 0 && Number.isFinite(year)) {
      return { monthKey: `${m[2]} ${year}`, monthOrder: year * 12 + idx };
    }
  }
  return { monthKey: raw.trim() || "(ไม่มีข้อมูล)", monthOrder: Number.MAX_SAFE_INTEGER };
}

function toRow(cells: string[]): SheetRow | null {
  if (cells.length < 9) return null;
  const c = cells.map((x) => x.trim());
  const price = parsePrice(c[8]);
  if (price === null) return null;
  const { monthKey, monthOrder } = normalizeMonth(c[1]);
  return {
    regNo: c[0],
    date: c[1],
    monthKey,
    monthOrder,
    mission: c[2],
    workGroup: c[3],
    agency: c[4],
    item: c[5],
    category: c[6],
    type: c[7],
    price,
    planType: c[9] ?? "", // ประเภทแผน (column J)
    status: c[10] ?? "", // สถานะ (column K)
  };
}

/**
 * Fetch the public Google Sheet, parse it, and cache the rows in Convex.
 * Skips the network call when a fresh copy already exists (unless force: true).
 */
export const syncSheetData = action({
  args: { force: v.optional(v.boolean()) },
  handler: async (
    ctx,
    { force },
  ): Promise<{ synced: boolean; rowCount: number; syncedAt: number }> => {
    const existing = await ctx.runQuery(internal.sheetInternal.getMetaInternal);
    if (!force && existing && Date.now() - existing.syncedAt < FRESH_MS) {
      return {
        synced: false,
        rowCount: existing.rowCount,
        syncedAt: existing.syncedAt,
      };
    }

    const res = await fetch(CSV_URL);
    if (!res.ok) {
      throw new Error(`Google Sheets ตอบกลับด้วยสถานะ ${res.status}`);
    }
    const text = await res.text();
    const raw = parseCsv(text);

    const start = raw[0]?.[0]?.trim() === HEADER_FIRST_CELL ? 1 : 0;
    const rows: SheetRow[] = [];
    for (let i = start; i < raw.length; i++) {
      const row = toRow(raw[i]);
      if (row) rows.push(row);
    }
    if (rows.length === 0) {
      throw new Error(`ไม่พบข้อมูลในชีต "${SHEET_NAME}"`);
    }

    const chunks: { chunkIndex: number; rows: SheetRow[] }[] = [];
    for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
      chunks.push({
        chunkIndex: chunks.length,
        rows: rows.slice(i, i + CHUNK_SIZE),
      });
    }

    await ctx.runMutation(internal.sheetInternal.clearDataInternal);
    for (const chunk of chunks) {
      await ctx.runMutation(internal.sheetInternal.insertChunkInternal, chunk);
    }
    const syncedAt = Date.now();
    await ctx.runMutation(internal.sheetInternal.insertMetaInternal, {
      syncedAt,
      rowCount: rows.length,
    });

    return { synced: true, rowCount: rows.length, syncedAt };
  },
});

/** All cached rows (chunked) plus sync metadata. */
export const getSheetData = query({
  handler: async (ctx) => {
    const [chunks, metas] = await Promise.all([
      ctx.db.query("sheetChunk").collect(),
      ctx.db.query("sheetMeta").collect(),
    ]);
    chunks.sort((a, b) => a.chunkIndex - b.chunkIndex);
    const meta = metas[0];
    return {
      chunks: chunks.map((c) => ({ chunkIndex: c.chunkIndex, rows: c.rows })),
      meta: meta ? { syncedAt: meta.syncedAt, rowCount: meta.rowCount } : null,
    };
  },
});

/** Manual refresh entry point — wipes and re-imports unconditionally. */
export const refreshSheetData = mutation({
  handler: async (ctx) => {
    await ctx.runMutation(internal.sheetInternal.clearDataInternal);
  },
});

/**
 * อัปเดตสถานะ (คอลัมน์ K) ของรายการหนึ่งใน Google Sheet.
 *
 * เส้นทาง: เว็บแอป → Convex action → POST ไปยัง Web App ของ Apps Script
 * (ต้องตั้งค่า APPS_SCRIPT_WEB_APP_URL ในหน้า Keys/API keys ด้วย URL ที่ได้จาก
 * Deploy > New deployment > Web app) → Apps Script เขียนลงชีต แล้ว Convex
 * patch ข้อมูลที่แคชไว้ให้สะท้อนผลทันทีโดยไม่ต้องรอ re-sync.
 */
export const updateStatus = action({
  args: { regNo: v.string(), status: v.string() },
  handler: async (ctx, { regNo, status }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error("กรุณาเข้าสู่ระบบก่อนแก้ไขสถานะ");
    }

    if (!(STATUS_OPTIONS as readonly string[]).includes(status)) {
      throw new Error(
        `สถานะ "${status}" ไม่ถูกต้อง (ต้องเป็น ${STATUS_OPTIONS.join(" / ")})`,
      );
    }
    if (!regNo.trim()) {
      throw new Error("ไม่พบเลขทะเบียนคุมของรายการนี้");
    }

    const appUrl = process.env.APPS_SCRIPT_WEB_APP_URL;
    if (!appUrl) {
      throw new Error(
        "ยังไม่ได้ตั้งค่า APPS_SCRIPT_WEB_APP_URL — deploy Web App ของ Apps Script แล้ววาง URL ในหน้า Keys/API keys (คีย์ชื่อ APPS_SCRIPT_WEB_APP_URL) แล้วลองอีกครั้ง",
      );
    }

    const res = await fetch(appUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ regNo: regNo.trim(), status }),
    });
    let data: { ok?: boolean; error?: string } | null = null;
    try {
      data = (await res.json()) as { ok?: boolean; error?: string } | null;
    } catch {
      data = null;
    }
    if (!res.ok) {
      throw new Error(data?.error ?? `Google Apps Script ตอบกลับด้วยสถานะ ${res.status}`);
    }
    if (!data || data.ok !== true) {
      throw new Error(data?.error ?? "Google Apps Script ไม่ยืนยันการอัปเดตสถานะ");
    }

    await ctx.runMutation(internal.sheetInternal.setStatusInternal, {
      regNo: regNo.trim(),
      status,
    });
    return { ok: true as const, status };
  },
});
