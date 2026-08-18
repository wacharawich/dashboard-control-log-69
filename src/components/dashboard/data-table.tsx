import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { fmtBaht, fmtNum, type SheetRow } from "@/lib/sheet";
import { cn } from "@/lib/utils";
import { useAction } from "convex/react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

const PAGE_SIZE = 12;

/** ค่าที่อนุญาตสำหรับคอลัมน์ K สถานะ (ต้องตรงกับในชีต) */
const STATUS_OPTIONS = ["เสนอ", "อนุมัติ", "ไม่อนุมัติ", "รอปรับแผน"];

const STATUS_STYLES: Record<string, string> = {
  เสนอ: "border-primary/40 bg-primary/5 text-primary",
  อนุมัติ: "border-emerald-600/40 bg-emerald-500/10 text-emerald-800",
  ไม่อนุมัติ: "border-red-600/40 bg-red-500/10 text-red-800",
  "รอปรับแผน": "border-amber-600/40 bg-amber-500/10 text-amber-800",
};

type SortDirection = "asc" | "desc";
type SortField =
  | "regNo"
  | "date"
  | "mission"
  | "workGroup"
  | "agency"
  | "item"
  | "category"
  | "type"
  | "planType"
  | "status"
  | "price";

interface SortState {
  field: SortField;
  dir: SortDirection;
}

const COLUMNS: {
  key: SortField;
  label: string;
  className?: string;
  align?: "left" | "right";
}[] = [
  { key: "regNo", label: "เลขทะเบียนคุม", className: "font-mono text-[11.5px]" },
  { key: "date", label: "เดือน", className: "text-[12px]" },
  { key: "mission", label: "กลุ่มภารกิจ" },
  { key: "workGroup", label: "กลุ่มงาน" },
  { key: "agency", label: "หน่วยงาน" },
  { key: "item", label: "รายการ" },
  { key: "category", label: "หมวด" },
  { key: "type", label: "ประเภท" },
  { key: "planType", label: "ประเภทแผน" },
  { key: "status", label: "สถานะ" },
  { key: "price", label: "ราคาเสนอ", align: "right" },
];

/** Thai month names → sortable order */
function monthOrderOf(date: string): number {
  const m = date.match(/^(\d{1,2})\s+(\S+)\s+(\d{4})$/);
  if (!m) return 0;
  const idx = [
    "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
    "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
  ].indexOf(m[2]);
  return Number(m[3]) * 100 + (idx >= 0 ? idx : 0);
}

function compareField(
  field: SortField,
  a: SheetRow,
  b: SheetRow,
  dir: SortDirection,
): number {
  let cmp = 0;
  switch (field) {
    case "price":
      cmp = a.price - b.price;
      break;
    case "regNo":
      cmp = a.regNo.localeCompare(b.regNo);
      break;
    case "date":
      cmp = monthOrderOf(a.date) - monthOrderOf(b.date) || a.date.localeCompare(b.date);
      break;
    case "mission":
      cmp = a.mission.localeCompare(b.mission, "th");
      break;
    case "workGroup":
      cmp = a.workGroup.localeCompare(b.workGroup, "th");
      break;
    case "agency":
      cmp = a.agency.localeCompare(b.agency, "th");
      break;
    case "item":
      cmp = a.item.localeCompare(b.item, "th");
      break;
    case "category":
      cmp = a.category.localeCompare(b.category, "th");
      break;
    case "type":
      cmp = a.type.localeCompare(b.type, "th");
      break;
    case "planType":
      cmp = (a.planType || "").localeCompare(b.planType || "", "th");
      break;
    case "status":
      cmp = (a.status || "").localeCompare(b.status || "", "th");
      break;
  }
  return dir === "asc" ? cmp : -cmp;
}

export function DataTable({ rows }: { rows: SheetRow[] }) {
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<SortState>({ field: "price", dir: "desc" });
  const updateStatus = useAction(api.sheet.updateStatus);
  const [pending, setPending] = useState<Record<string, "saving" | "error">>({});

  const handleStatusChange = async (regNo: string, status: string) => {
    setPending((prev) => ({ ...prev, [regNo]: "saving" }));
    try {
      await updateStatus({ regNo, status });
      setPending((prev) => {
        const next = { ...prev };
        delete next[regNo];
        return next;
      });
      toast.success(`สถานะ ${regNo} → ${status} บันทึกลง Google Sheets แล้ว`);
    } catch (e) {
      setPending((prev) => ({ ...prev, [regNo]: "error" }));
      window.setTimeout(() => {
        setPending((prev) => {
          const next = { ...prev };
          delete next[regNo];
          return next;
        });
      }, 3500);
      toast.error(
        e instanceof Error
          ? e.message
          : `อัปเดตสถานะ ${regNo} ไม่สำเร็จ — ลองใหม่อีกครั้ง`,
      );
      console.error("อัปเดตสถานะไม่สำเร็จ", regNo, e);
    }
  };

  const toggleSort = (field: SortField) => {
    setSort((prev) =>
      prev.field === field
        ? { field, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { field, dir: "asc" },
    );
  };

  // reset page when filtered dataset changes
  useEffect(() => {
    setPage(1);
  }, [rows]);

  const sorted = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => compareField(sort.field, a, b, sort.dir));
    return copy;
  }, [rows, sort]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const start = (safePage - 1) * PAGE_SIZE;
  const pageRows = sorted.slice(start, start + PAGE_SIZE);

  return (
    <div className="flex flex-col gap-4">
      <p className="font-mono text-[11px] text-muted-foreground">
        rows <span className="text-primary">{fmtNum(sorted.length)}</span>{" "}
        / {fmtNum(rows.length)} ผ่านตัวกรอง
        <span className="ml-3 text-muted-foreground/60">
          · เลือกหัวข้อเพื่อเรียงลำดับ
        </span>
      </p>

      <div className="overflow-x-auto rounded-md border border-border bg-card">
        <Table className="min-w-[1160px]">
          <TableHeader>
            <TableRow className="border-border/70 hover:bg-transparent">
              {COLUMNS.map((col) => {
                const active = sort.field === col.key;
                return (
                  <TableHead
                    key={col.key}
                    className={cn(
                      "group cursor-pointer select-none bg-muted/40 font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground",
                      active && "bg-primary/5 text-primary hover:bg-primary/10",
                      col.align === "right" && "text-right",
                    )}
                    onClick={() => toggleSort(col.key)}
                  >
                    <span className="inline-flex items-center gap-1">
                      {col.label}
                      <span className="inline-flex shrink-0 opacity-40 group-hover:opacity-80 transition-opacity">
                        {active ? (
                          sort.dir === "asc" ? (
                            <ArrowUp className="size-3" />
                          ) : (
                            <ArrowDown className="size-3" />
                          )
                        ) : (
                          <ArrowUpDown className="size-3" />
                        )}
                      </span>
                    </span>
                  </TableHead>
                );
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageRows.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={COLUMNS.length}
                  className="h-24 text-center text-[13px] text-muted-foreground"
                >
                  ไม่พบรายการที่ตรงกับตัวกรอง
                </TableCell>
              </TableRow>
            ) : (
              pageRows.map((row, i) => (
                <TableRow
                  key={`${row.regNo}-${i}`}
                  className="border-border/50"
                >
                  <TableCell className="whitespace-nowrap font-mono text-[11.5px] text-foreground/90">
                    {row.regNo}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-[12px]">
                    {row.date}
                  </TableCell>
                  <TableCell
                    className="max-w-[160px] truncate text-[12px]"
                    title={row.mission}
                  >
                    {row.mission}
                  </TableCell>
                  <TableCell
                    className="max-w-[140px] truncate text-[12px]"
                    title={row.workGroup}
                  >
                    {row.workGroup}
                  </TableCell>
                  <TableCell
                    className="max-w-[140px] truncate text-[12px]"
                    title={row.agency}
                  >
                    {row.agency}
                  </TableCell>
                  <TableCell
                    className="max-w-[220px] truncate text-[12px]"
                    title={row.item}
                  >
                    {row.item}
                  </TableCell>
                  <TableCell
                    className="max-w-[150px] truncate text-[12px]"
                    title={row.category}
                  >
                    {row.category}
                  </TableCell>
                  <TableCell
                    className="max-w-[150px] truncate text-[12px]"
                    title={row.type}
                  >
                    {row.type}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-[12px]">
                    {row.planType || "—"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <StatusSelect
                      regNo={row.regNo}
                      value={row.status}
                      pending={pending[row.regNo]}
                      onSelect={handleStatusChange}
                    />
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-right font-mono text-[12px] font-medium tabular-nums text-primary">
                    {fmtBaht(row.price)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="font-mono text-[11px] text-muted-foreground">
          {sorted.length === 0
            ? "0 รายการ"
            : `แสดง ${fmtNum(start + 1)}–${fmtNum(Math.min(start + PAGE_SIZE, sorted.length))} จาก ${fmtNum(sorted.length)} รายการ`}
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1 px-2.5 text-[12px]"
            disabled={safePage <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft className="size-3.5" />
            ก่อนหน้า
          </Button>
          <span className="font-mono text-[11px] text-muted-foreground">
            {safePage} / {pageCount}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1 px-2.5 text-[12px]"
            disabled={safePage >= pageCount}
            onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
          >
            ถัดไป
            <ChevronRight className="size-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function StatusSelect({
  regNo,
  value,
  pending,
  onSelect,
}: {
  regNo: string;
  value: string;
  pending?: "saving" | "error";
  onSelect: (regNo: string, status: string) => void;
}) {
  if (pending === "saving") {
    return (
      <span className="inline-flex h-7 items-center gap-1.5 rounded-sm border border-border/70 bg-muted/40 px-2 font-mono text-[10.5px] text-muted-foreground">
        <Loader2 className="size-3 animate-spin" />
        saving
      </span>
    );
  }
  if (pending === "error") {
    return (
      <span className="inline-flex h-7 items-center gap-1.5 rounded-sm border border-red-600/40 bg-red-500/10 px-2 font-mono text-[10.5px] text-red-800">
        <AlertTriangle className="size-3" />
        ล้มเหลว — ลองใหม่
      </span>
    );
  }
  return (
    <Select
      value={value || undefined}
      onValueChange={(v) => onSelect(regNo, v)}
    >
      <SelectTrigger
        size="sm"
        className={cn(
          "h-7 w-[118px] text-[12px]",
          value ? STATUS_STYLES[value] ?? "" : "text-muted-foreground",
        )}
      >
        <SelectValue placeholder="—" />
      </SelectTrigger>
      <SelectContent>
        {STATUS_OPTIONS.map((opt) => (
          <SelectItem key={opt} value={opt} className="text-[12.5px]">
            {opt}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
