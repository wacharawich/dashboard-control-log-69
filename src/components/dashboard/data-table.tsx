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
import { AlertTriangle, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
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

type SortKey = "price-desc" | "price-asc" | "regNo" | "date" | "agency";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "price-desc", label: "ราคาเสนอ ▾ (มาก → น้อย)" },
  { value: "price-asc", label: "ราคาเสนอ ▴ (น้อย → มาก)" },
  { value: "date", label: "เดือน (ใหม่ล่าสุด)" },
  { value: "regNo", label: "เลขทะเบียนคุม" },
  { value: "agency", label: "หน่วยงาน (ก–ฮ)" },
];

const COLUMNS = [
  { key: "regNo", label: "เลขทะเบียนคุม", className: "font-mono text-[11.5px]" },
  { key: "date", label: "เดือน", className: "text-[12px] whitespace-nowrap" },
  { key: "mission", label: "กลุ่มภารกิจ" },
  { key: "workGroup", label: "กลุ่มงาน" },
  { key: "agency", label: "หน่วยงาน" },
  { key: "item", label: "รายการ" },
  { key: "category", label: "หมวด" },
  { key: "type", label: "ประเภท" },
  { key: "planType", label: "ประเภทแผน" },
  { key: "status", label: "สถานะ" },
  { key: "price", label: "ราคาเสนอ" },
] as const;

export function DataTable({ rows }: { rows: SheetRow[] }) {
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<SortKey>("price-desc");
  const updateStatus = useAction(api.sheet.updateStatus);
  // key = เลขทะเบียนคุม, value = สถานะการบันทึกปัจจุบันของแถวนั้น
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
      // ลบสถานะ error หลัง 3.5 วินาที (Select จะกลับไปเป็นค่าจริงจาก Convex เอง)
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

  // reset to the first page whenever the filtered dataset changes
  useEffect(() => {
    setPage(1);
  }, [rows]);

  const sorted = useMemo(() => {
    const copy = [...rows];
    switch (sort) {
      case "price-desc":
        copy.sort((a, b) => b.price - a.price);
        break;
      case "price-asc":
        copy.sort((a, b) => a.price - b.price);
        break;
      case "regNo":
        copy.sort((a, b) => a.regNo.localeCompare(b.regNo));
        break;
      case "date":
        copy.sort(
          (a, b) => monthOrderOf(b.date) - monthOrderOf(a.date) || b.date.localeCompare(a.date),
        );
        break;
      case "agency":
        copy.sort((a, b) => a.agency.localeCompare(b.agency, "th"));
        break;
    }
    return copy;
  }, [rows, sort]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const start = (safePage - 1) * PAGE_SIZE;
  const pageRows = sorted.slice(start, start + PAGE_SIZE);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="font-mono text-[11px] text-muted-foreground">
          rows <span className="text-primary">{fmtNum(sorted.length)}</span>{" "}
          / {fmtNum(rows.length)} ผ่านตัวกรอง
        </p>
        <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
          <SelectTrigger size="sm" className="h-8 w-[220px] text-[12px]">
            <SelectValue placeholder="เรียงตาม" />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value} className="text-[12px]">
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-x-auto rounded-md border border-border bg-card">
        <Table className="min-w-[1160px]">
          <TableHeader>
            <TableRow className="border-border/70 hover:bg-transparent">
              {COLUMNS.map((col) => (
                <TableHead
                  key={col.key}
                  className="bg-muted/40 font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  {col.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageRows.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={COLUMNS.length} className="h-24 text-center text-[13px] text-muted-foreground">
                  ไม่พบรายการที่ตรงกับตัวกรอง
                </TableCell>
              </TableRow>
            ) : (
              pageRows.map((row, i) => (
                <TableRow key={`${row.regNo}-${i}`} className="border-border/50">
                  <TableCell className="whitespace-nowrap font-mono text-[11.5px] text-foreground/90">
                    {row.regNo}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-[12px]">
                    {row.date}
                  </TableCell>
                  <TableCell className="max-w-[160px] truncate text-[12px]" title={row.mission}>
                    {row.mission}
                  </TableCell>
                  <TableCell className="max-w-[140px] truncate text-[12px]" title={row.workGroup}>
                    {row.workGroup}
                  </TableCell>
                  <TableCell className="max-w-[140px] truncate text-[12px]" title={row.agency}>
                    {row.agency}
                  </TableCell>
                  <TableCell className="max-w-[220px] truncate text-[12px]" title={row.item}>
                    {row.item}
                  </TableCell>
                  <TableCell className="max-w-[150px] truncate text-[12px]" title={row.category}>
                    {row.category}
                  </TableCell>
                  <TableCell className="max-w-[150px] truncate text-[12px]" title={row.type}>
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

function monthOrderOf(date: string): number {
  const m = date.match(/^(\d{1,2})\s+(\S+)\s+(\d{4})$/);
  if (!m) return 0;
  const idx = [
    "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
    "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
  ].indexOf(m[2]);
  return Number(m[3]) * 100 + (idx >= 0 ? idx : 0);
}
