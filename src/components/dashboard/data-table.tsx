import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ceToBe, fmtBaht, fmtNum, type SheetRow } from "@/lib/sheet";
import { cn } from "@/lib/utils";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const PAGE_SIZE = 12;

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
  | "price";
type SortDir = "asc" | "desc";

const COLUMNS: { key: SortField; label: string; className?: string; align?: "right" }[] = [
  { key: "regNo", label: "เลขทะเบียนคุม", className: "font-mono text-[11.5px]" },
  { key: "date", label: "เดือน", className: "text-[12px]" },
  { key: "mission", label: "กลุ่มภารกิจ" },
  { key: "workGroup", label: "กลุ่มงาน" },
  { key: "agency", label: "หน่วยงาน" },
  { key: "item", label: "รายการ" },
  { key: "category", label: "หมวด" },
  { key: "type", label: "ประเภท" },
  { key: "planType", label: "ประเภทแผน" },
  { key: "price", label: "ราคาเสนอ", align: "right" },
];

function compareField(field: SortField, a: SheetRow, b: SheetRow, dir: SortDir): number {
  let cmp: number;
  switch (field) {
    case "price":
      cmp = a.price - b.price;
      break;
    case "regNo":
      cmp = a.regNo.localeCompare(b.regNo);
      break;
    case "date":
      // monthOrder comes from Convex parse — chronological key for the เดือน column
      cmp = a.monthOrder - b.monthOrder || a.date.localeCompare(b.date);
      break;
    default:
      cmp = String(a[field] ?? "").localeCompare(String(b[field] ?? ""), "th");
  }
  return dir === "asc" ? cmp : -cmp;
}

export function DataTable({ rows }: { rows: SheetRow[] }) {
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<{ field: SortField; dir: SortDir }>({
    field: "price",
    dir: "desc",
  });

  const toggleSort = (field: SortField) =>
    setSort((prev) =>
      prev.field === field
        ? { field, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { field, dir: "asc" },
    );

  // reset to first page when filtered dataset or sort column/direction changes
  useEffect(() => {
    setPage(1);
  }, [rows, sort]);

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
      </p>

      <div className="overflow-x-auto rounded-md border border-border bg-card">
        <Table className="min-w-[1080px]">
          <TableHeader>
            <TableRow className="border-border/70 hover:bg-transparent">
              {COLUMNS.map((col) => {
                const active = sort.field === col.key;
                return (
                  <TableHead
                    key={col.key}
                    className={cn(
                      "group cursor-pointer select-none bg-muted/40 font-mono text-[10px] font-semibold uppercase tracking-wider transition-colors hover:bg-muted/70 hover:text-foreground",
                      active ? "text-primary" : "text-muted-foreground",
                      col.align === "right" && "text-right",
                      col.className,
                    )}
                    onClick={() => toggleSort(col.key)}
                  >
                    <span className="inline-flex items-center gap-1">
                      {col.label}
                      <span className="inline-flex shrink-0 opacity-40 transition-opacity group-hover:opacity-80">
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
                    {ceToBe(row.date)}
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
