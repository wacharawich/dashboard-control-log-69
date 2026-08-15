import type { Doc } from "@/convex/_generated/dataModel";

// Re-export the row shape coming from Convex codegen (sheetRowValidator)
export type SheetRow = Doc<"sheetChunk">["rows"][number];

/** The filterable/groupable dimensions from the sheet columns. */
export type FilterKey =
  | "regNo"
  | "monthKey"
  | "mission"
  | "workGroup"
  | "agency"
  | "item"
  | "category"
  | "type"
  | "planType";

// multiple values can be selected per dimension (empty array = no filter)
export type Filters = Partial<Record<FilterKey, string[]>>;

export interface Dimension {
  key: FilterKey;
  label: string;
  code: string;
  desc: string;
}

export const DIMENSIONS: Dimension[] = [
  { key: "regNo", label: "เลขทะเบียนคุม", code: "REG", desc: "จำแนกตามเลขทะเบียนคุมแต่ละรายการ" },
  { key: "monthKey", label: "เดือน", code: "MON", desc: "จำแนกตามเดือนที่บันทึกข้อมูล" },
  { key: "mission", label: "กลุ่มภารกิจ", code: "MIS", desc: "จำแนกตามกลุ่มภารกิจของหน่วยงาน" },
  { key: "workGroup", label: "กลุ่มงาน", code: "WRK", desc: "จำแนกตามกลุ่มงานภายในหน่วยงาน" },
  { key: "agency", label: "หน่วยงาน", code: "AGT", desc: "จำแนกตามหน่วยงานที่เสนอราคา" },
  { key: "item", label: "รายการ", code: "ITM", desc: "จำแนกตามรายการพัสดุ/บริการ" },
  { key: "category", label: "หมวด", code: "CAT", desc: "จำแนกตามหมวดรายจ่าย" },
  { key: "type", label: "ประเภท", code: "TYP", desc: "จำแนกตามประเภทรายจ่าย" },
  { key: "planType", label: "ประเภทแผน", code: "PLN", desc: "จำแนกตามประเภทแผน (ในแผน/นอกแผน/ทดแทน)" },
];

export const DIMENSION_MAP: Record<FilterKey, Dimension> = Object.fromEntries(
  DIMENSIONS.map((d) => [d.key, d]),
) as Record<FilterKey, Dimension>;

/** Apply the active filters to a row set. Pass excludeKey to ignore one dimension (for option lists). */
export function filterRows(
  rows: SheetRow[],
  filters: Filters,
  excludeKey?: FilterKey,
): SheetRow[] {
  const keys = Object.keys(filters) as FilterKey[];
  if (keys.length === 0) return rows;
  return rows.filter((row) =>
    keys.every((key) => {
      if (key === excludeKey) return true;
      const values = filters[key];
      return !values || values.length === 0 || values.includes(row[key]);
    }),
  );
}

export interface Option {
  value: string;
  count: number;
}

/** Distinct values (with row counts) for a dimension, sorted. */
export function uniqueValues(rows: SheetRow[], key: FilterKey): Option[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const value = row[key];
    if (value === "") continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  const options = [...counts.entries()].map(([value, count]) => ({ value, count }));
  if (key === "monthKey") {
    // chronological order for months
    options.sort((a, b) => monthOrderOf(a.value) - monthOrderOf(b.value));
  } else {
    options.sort((a, b) => a.value.localeCompare(b.value, "th"));
  }
  return options;
}

function monthOrderOf(monthKey: string): number {
  const m = monthKey.match(/^(\S+)\s+(\d{4})$/);
  if (!m) return Number.MAX_SAFE_INTEGER;
  const idx = [
    "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
    "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
  ].indexOf(m[1]);
  return Number(m[2]) * 12 + (idx >= 0 ? idx : 0);
}

export interface Group {
  name: string;
  sum: number;
  count: number;
}

/** Group rows by a dimension, summing ราคาเสนอ. Sorted by sum desc. */
export function groupBySum(rows: SheetRow[], key: FilterKey): Group[] {
  const map = new Map<string, Group>();
  for (const row of rows) {
    const name = row[key] || "(ไม่มีข้อมูล)";
    const existing = map.get(name);
    if (existing) {
      existing.sum += row.price;
      existing.count += 1;
    } else {
      map.set(name, { name, sum: row.price, count: 1 });
    }
  }
  const groups = [...map.values()];
  groups.sort((a, b) => b.sum - a.sum);
  if (key === "monthKey") {
    groups.sort((a, b) => monthOrderOf(a.name) - monthOrderOf(b.name));
  }
  return groups;
}

/** Collapse everything past the top N into a single "อื่นๆ" bucket. */
export function topGroups(groups: Group[], n: number): Group[] {
  if (groups.length <= n) return groups;
  const top = groups.slice(0, n);
  const rest = groups.slice(n);
  top.push({
    name: "อื่นๆ",
    sum: rest.reduce((acc, g) => acc + g.sum, 0),
    count: rest.reduce((acc, g) => acc + g.count, 0),
  });
  return top;
}

// ----- formatting -----

const nf0 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const nfCompact = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

export const fmtBaht = (n: number) => `฿${nf0.format(n)}`;
export const fmtNum = (n: number) => nf0.format(n);
export const fmtCompact = (n: number) => `฿${nfCompact.format(n)}`;

export function fmtDateTime(ts: number | null | undefined): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
