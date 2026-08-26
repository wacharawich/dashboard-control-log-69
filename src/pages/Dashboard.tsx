import { DataTable } from "@/components/dashboard/data-table";
import { FilterCombobox } from "@/components/dashboard/filter-combobox";
import { AgencyBars, PriceBars } from "@/components/dashboard/terminal-charts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSheetData } from "@/hooks/use-sheet-data";
import { exportCSV, exportPDF } from "@/lib/export";
import {
  DIMENSIONS,
  DIMENSION_MAP,
  filterRows,
  fmtBaht,
  fmtCompact,
  fmtDateTime,
  fmtNum,
  groupBySum,
  isoToThai,
  topGroups,
  uniqueValues,
  type FilterKey,
  type Filters,
  type Group,
  type Option,
} from "@/lib/sheet";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { AlertTriangle, ChevronDown, Download, FileDown, FileText, RefreshCw, X } from "lucide-react";
import { useMemo, useState } from "react";

const SHEET_REF = "sheet://1UtSyr…NRxcw";

const PLAN_ORDER = ["ในแผน", "นอกแผน", "ทดแทน"] as const;
const PLAN_COLORS: Record<string, string> = {
  "ในแผน": "#2f6f4f",
  "นอกแผน": "#a16207",
  "ทดแทน": "#7a8a7f",
};

export default function Dashboard() {
  const { rows, meta, syncing, error, loaded, sync } = useSheetData();
  const [filters, setFilters] = useState<Filters>({});
  const [groupBy, setGroupBy] = useState<FilterKey>("monthKey");
  const [exporting, setExporting] = useState<"csv" | "pdf" | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const optionLists = useMemo(() => {
    const lists = {} as Record<FilterKey, Option[]>;
    for (const dim of DIMENSIONS) {
      lists[dim.key] = uniqueValues(filterRows(rows, filters, dim.key), dim.key);
    }
    return lists;
  }, [rows, filters]);

  const filtered = useMemo(() => filterRows(rows, filters), [rows, filters]);

  const total = useMemo(
    () => filtered.reduce((sum, r) => sum + r.price, 0),
    [filtered],
  );
  const agencyCount = useMemo(
    () => new Set(filtered.map((r) => r.agency)).size,
    [filtered],
  );
  const avg = filtered.length > 0 ? total / filtered.length : 0;

  const mainGroups = useMemo(
    () => groupBySum(filtered, groupBy).slice(0, 12),
    [filtered, groupBy],
  );

  // TOP 10 per dimension for section 04 (horizontal bars)
  const topTenByDim = useMemo(() => {
    const keys: FilterKey[] = [
      "mission",
      "workGroup",
      "agency",
      "item",
      "category",
      "type",
    ];
    return keys.map((key) => ({
      key,
      dim: DIMENSION_MAP[key],
      groups: groupBySum(filtered, key).slice(0, 10),
    }));
  }, [filtered]);

  const planTypeStats = useMemo(() => {
    const byName = new Map(groupBySum(filtered, "planType").map((g) => [g.name, g]));
    return PLAN_ORDER.map(
      (name) => byName.get(name) ?? { name, sum: 0, count: 0 },
    );
  }, [filtered]);

  const activeEntries = (Object.entries(filters) as [FilterKey, string[]][]).filter(
    ([, values]) => values && values.length > 0,
  );
  const range = filters.dateRange;
  const rangeActive = !!(range?.from || range?.to);
  const activeCount = activeEntries.length + (rangeActive ? 1 : 0);

  const setFilter = (key: FilterKey, value: string[]) =>
    setFilters((prev) => {
      const next = { ...prev };
      if (value.length === 0) delete next[key];
      else next[key] = value;
      return next;
    });
  const removeFilterValue = (key: FilterKey, value: string) =>
    setFilters((prev) => {
      const next = { ...prev };
      const rest = (next[key] ?? []).filter((v) => v !== value);
      if (rest.length === 0) delete next[key];
      else next[key] = rest;
      return next;
    });
  const resetFilters = () => setFilters({});
  const setDateRange = (from: string, to: string) =>
    setFilters((prev) => {
      const next = { ...prev };
      if (from || to) {
        next.dateRange = { from: from || undefined, to: to || undefined };
      } else {
        delete next.dateRange;
      }
      return next;
    });

  const handleExport = async (format: "csv" | "pdf") => {
    setExporting(format);
    setExportError(null);
    try {
      if (format === "csv") {
        exportCSV(filtered);
      } else {
        await exportPDF(filtered, { total, agencyCount, filters });
      }
    } catch (e) {
      setExportError(
        e instanceof Error ? e.message : "เกิดข้อผิดพลาดระหว่างการสร้างไฟล์",
      );
    } finally {
      setExporting(null);
    }
  };

  const groupDim = DIMENSION_MAP[groupBy];

  return (
    <main className="min-h-screen bg-background text-foreground">
      {/* top status bar */}
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-md border border-primary/30 bg-primary/10 font-mono text-[13px] font-bold text-primary">
              $_ 
            </div>
            <div className="leading-tight">
              <p className="text-sm font-semibold tracking-tight">
                ราคาเสนอ<span className="text-primary">/</span>terminal
              </p>
              <p className="font-mono text-[10px] text-muted-foreground">
                {SHEET_REF} · sheet99
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <StatusPill syncing={syncing} error={error} loaded={loaded} rowCount={rows.length} syncedAt={meta?.syncedAt ?? null} />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 text-[12px]"
                  disabled={exporting !== null || filtered.length === 0}
                >
                  <Download className="size-3.5" />
                  {exporting ? "กำลังสร้าง…" : "Export"}
                  <ChevronDown className="size-3 opacity-60" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60">
                <DropdownMenuItem
                  disabled={exporting !== null}
                  onSelect={() => void handleExport("csv")}
                  className="gap-2.5 py-2.5"
                >
                  <FileDown className="size-4 text-primary" />
                  <div className="flex flex-col">
                    <span className="text-[13px]">Export CSV</span>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      ทุกแถวที่ถูกกรอง ({fmtNum(filtered.length)})
                    </span>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={exporting !== null}
                  onSelect={() => void handleExport("pdf")}
                  className="gap-2.5 py-2.5"
                >
                  <FileText className="size-4 text-primary" />
                  <div className="flex flex-col">
                    <span className="text-[13px]">Export PDF</span>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      รายงาน A4 · แสดงสูงสุด 400 แถวแรก
                    </span>
                  </div>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-[12px]"
              onClick={() => void sync(true)}
              disabled={syncing}
            >
              <RefreshCw className={cn("size-3.5", syncing && "animate-spin")} />
              {syncing ? "กำลังซิงก์…" : "ซิงก์ใหม่"}
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6">
        {error && (
          <div className="flex items-center gap-3 rounded-md border border-amber-600/40 bg-amber-500/10 px-4 py-3 text-[13px] text-amber-900">
            <AlertTriangle className="size-4 shrink-0 text-amber-700" />
            <span className="flex-1">
              ไม่สามารถโหลดข้อมูลจาก Google Sheets ได้ — {error}
            </span>
            <Button variant="outline" size="sm" className="h-7 text-[12px]" onClick={() => void sync(true)}>
              ลองอีกครั้ง
            </Button>
          </div>
        )}

        {exportError && (
          <div className="flex items-center gap-3 rounded-md border border-amber-600/40 bg-amber-500/10 px-4 py-3 text-[13px] text-amber-900">
            <AlertTriangle className="size-4 shrink-0 text-amber-700" />
            <span className="flex-1">Export ล้มเหลว — {exportError}</span>
            <button
              type="button"
              onClick={() => setExportError(null)}
              className="rounded-sm p-1 text-amber-800 transition-colors hover:bg-amber-500/20"
              aria-label="ปิด"
            >
              <X className="size-4" />
            </button>
          </div>
        )}

        {/* 01 — filters */}
        <SectionHeader index="01" code="FILTERS" title="ตัวกรองข้อมูล" />
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="rounded-md border border-border/80 bg-card p-4 sm:p-5"
        >
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {DIMENSIONS.map((dim) => (
              <FilterCombobox
                key={dim.key}
                dim={dim}
                value={filters[dim.key] ?? []}
                options={optionLists[dim.key]}
                onChange={(v) => setFilter(dim.key, v)}
              />
            ))}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-border/60 pt-3">
            <span className="font-mono text-[10px] font-semibold tracking-[0.14em] text-muted-foreground">
              [DAT]
            </span>
            <span className="text-[11px] font-medium text-foreground/80">ช่วงเวลา</span>
            <input
              type="date"
              aria-label="จากวันที่"
              value={range?.from ?? ""}
              onChange={(e) => setDateRange(e.target.value, range?.to ?? "")}
              className="h-8 rounded-md border border-input bg-card px-2 font-mono text-[11.5px] text-foreground shadow-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
            />
            <span className="font-mono text-[11px] text-muted-foreground">→</span>
            <input
              type="date"
              aria-label="ถึงวันที่"
              value={range?.to ?? ""}
              onChange={(e) => setDateRange(range?.from ?? "", e.target.value)}
              className="h-8 rounded-md border border-input bg-card px-2 font-mono text-[11.5px] text-foreground shadow-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
            />
            {rangeActive && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-[11.5px] text-muted-foreground hover:text-foreground"
                onClick={() => setDateRange("", "")}
              >
                ล้างช่วงเวลา
              </Button>
            )}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border/60 pt-3">
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              active <span className={activeCount > 0 ? "text-primary" : ""}>{activeCount}</span>/10
            </span>
            {activeEntries.map(([key, values]) =>
              values.map((value) => (
                <button
                  key={`${key}:${value}`}
                  type="button"
                  onClick={() => removeFilterValue(key, value)}
                  className="group flex items-center gap-1.5 rounded-sm border border-primary/30 bg-primary/5 px-2 py-1 text-[11.5px] text-primary transition-colors hover:bg-primary/10"
                >
                  <span className="font-mono text-[9px] font-semibold tracking-wider">
                    {DIMENSION_MAP[key].code}
                  </span>
                  <span className="max-w-[180px] truncate">{value}</span>
                  <X className="size-3 opacity-60 group-hover:opacity-100" />
                </button>
              )),
            )}
            {rangeActive && (
              <button
                type="button"
                onClick={() => setDateRange("", "")}
                className="group flex items-center gap-1.5 rounded-sm border border-primary/30 bg-primary/5 px-2 py-1 text-[11.5px] text-primary transition-colors hover:bg-primary/10"
              >
                <span className="font-mono text-[9px] font-semibold tracking-wider">DAT</span>
                <span className="max-w-[220px] truncate">
                  {range?.from ? isoToThai(range.from) : "…"} →{" "}
                  {range?.to ? isoToThai(range.to) : "…"}
                </span>
                <X className="size-3 opacity-60 group-hover:opacity-100" />
              </button>
            )}
            {activeCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-[11.5px] text-muted-foreground hover:text-foreground"
                onClick={resetFilters}
              >
                ล้างทั้งหมด
              </Button>
            )}
          </div>
        </motion.div>

        {/* 02 — KPIs */}
        <SectionHeader index="02" code="SUMMARY" title="ภาพรวม" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiCard label="$ total" value={fmtBaht(total)} caption={`จาก ${fmtNum(filtered.length)} รายการ`} />
          <KpiCard label="$ records" value={fmtNum(filtered.length)} caption={loaded ? `ทั้งหมด ${fmtNum(rows.length)} รายการ` : "…"} />
          <KpiCard label="$ agencies" value={fmtNum(agencyCount)} caption="หน่วยงานที่เกี่ยวข้อง" />
          <KpiCard label="$ avg/row" value={fmtBaht(avg)} caption="ค่าเฉลี่ยต่อรายการ" />
        </div>

        {/* 03 — main chart */}
        <SectionHeader index="03" code="PRICE" title="ยอดรวมราคาเสนอ" />
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.05 }}
        >
          <Card className="gap-0 border-border/80 py-5 shadow-none">
            <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 px-5">
              <div>
                <CardTitle className="text-[15px] font-medium">
                  ยอดรวมราคาเสนอ จำแนกตาม <span className="text-primary">{groupDim.label}</span>
                </CardTitle>
                <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                  group by {groupDim.code} · top {mainGroups.length} · {fmtCompact(total)}
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {DIMENSIONS.map((dim) => (
                  <button
                    key={dim.key}
                    type="button"
                    onClick={() => setGroupBy(dim.key)}
                    className={cn(
                      "rounded-sm border px-2 py-1 font-mono text-[10px] tracking-wide transition-colors",
                      groupBy === dim.key
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-primary",
                    )}
                  >
                    {dim.code}
                  </button>
                ))}
              </div>
            </CardHeader>
            <CardContent className="px-5">
              {mainGroups.length === 0 ? (
                <EmptyChart label="ไม่มีข้อมูลที่ตรงกับตัวกรองปัจจุบัน" />
              ) : (
                <PriceBars groups={mainGroups} total={total} />
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* 04 — top 10 per dimension */}
        <div className="grid gap-4 lg:grid-cols-2">

          {topTenByDim.map(({ key, dim, groups }, i) => (
            <motion.div
              key={key}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.08 + i * 0.04 }}
            >
              <Card className="h-full gap-0 border-border/80 py-5 shadow-none">
                <CardHeader className="px-5">
                  <CardTitle className="text-[15px] font-medium">
                    TOP 10 {dim.label}
                  </CardTitle>
                  <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                    group by {dim.code} · sum ราคาเสนอ · top {groups.length}
                  </p>
                </CardHeader>
                <CardContent className="px-5">
                  {groups.length === 0 ? (
                    <EmptyChart label="ไม่มีข้อมูล" />
                  ) : (
                    <AgencyBars groups={groups} />
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* 05 — plan types */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.2 }}
        >
          <Card className="gap-0 border-border/80 py-5 shadow-none">
            <CardHeader className="px-5">
              <CardTitle className="text-[15px] font-medium">สถิติแยกตามประเภทแผน</CardTitle>
              <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                group by PLN · ในแผน / นอกแผน / ทดแทน · sum ราคาเสนอ
              </p>
            </CardHeader>
            <CardContent className="px-5">
              <PlanTypeBreakdown stats={planTypeStats} total={total} />
            </CardContent>
          </Card>
        </motion.div>

        {/* 05 — data table */}
        <SectionHeader index="05" code="ROWS" title="ข้อมูลทั้งหมด" />
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.2 }}
        >
          <Card className="gap-0 border-border/80 py-5 shadow-none">
            <CardContent className="px-5">
              <DataTable rows={filtered} />
            </CardContent>
          </Card>
        </motion.div>

        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-5 pb-2 font-mono text-[10.5px] text-muted-foreground">
          <span>ราคาเสนอ/terminal · interactive data dashboard</span>
          <span>
            {SHEET_REF} · sheet99 · อัปเดตล่าสุด{" "}
            {loaded && !syncing ? fmtDateTime(meta?.syncedAt) : "…"}
          </span>
        </footer>
      </div>
    </main>
  );
}

function SectionHeader({ index, code, title }: { index: string; code: string; title: string }) {
  return (
    <div className="flex items-baseline gap-3">
      <span className="font-mono text-[11px] font-semibold tracking-[0.16em] text-primary">
        // {index}
      </span>
      <span className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground">
        {code}
      </span>
      <h2 className="text-[15px] font-medium">{title}</h2>
    </div>
  );
}

function StatusPill({
  syncing,
  error,
  loaded,
  rowCount,
  syncedAt,
}: {
  syncing: boolean;
  error: string | null;
  loaded: boolean;
  rowCount: number;
  syncedAt: number | null;
}) {
  const dot = error ? "bg-red-600" : syncing ? "bg-amber-600 animate-pulse" : "bg-primary";
  const label = error
    ? "sync failed"
    : syncing
      ? "กำลังซิงก์ข้อมูล…"
      : loaded
        ? `synced · ${fmtNum(rowCount)} rows · ${fmtDateTime(syncedAt)}`
        : "connecting…";
  return (
    <div className="flex items-center gap-2 rounded-md border border-border/70 bg-card px-2.5 py-1.5">
      <span className={cn("size-2 rounded-full", dot)} />
      <span className="font-mono text-[11px] text-muted-foreground">{label}</span>
    </div>
  );
}

function KpiCard({
  label,
  value,
  caption,
}: {
  label: string;
  value: string;
  caption: string;
}) {
  return (
    <div className="rounded-md border border-border/80 bg-card p-4">
      <p className="font-mono text-[10px] tracking-[0.14em] text-muted-foreground">{label}</p>
      <p className="mt-2 truncate font-mono text-[22px] font-semibold tabular-nums text-foreground">
        {value}
      </p>
      <p className="mt-1 truncate text-[11px] text-muted-foreground">{caption}</p>
    </div>
  );
}

function PlanTypeBreakdown({ stats, total }: { stats: Group[]; total: number }) {
  const max = Math.max(1, ...stats.map((s) => s.sum));
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {stats.map((s) => {
        const share = total > 0 ? (s.sum / total) * 100 : 0;
        const color = PLAN_COLORS[s.name] ?? "#8bbd9d";
        return (
          <div key={s.name} className="rounded-md border border-border/80 bg-background/60 p-4">
            <div className="flex items-center gap-2">
              <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
              <p className="text-[13px] font-medium">{s.name}</p>
            </div>
            <p className="mt-3 truncate font-mono text-[20px] font-semibold tabular-nums text-foreground">
              {fmtBaht(s.sum)}
            </p>
            <p className="mt-1 font-mono text-[10.5px] text-muted-foreground">
              {fmtNum(s.count)} รายการ · {share.toFixed(1)}% ของยอดรวม
            </p>
            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.max(2, (s.sum / max) * 100)}%`,
                  backgroundColor: color,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="flex h-56 flex-col items-center justify-center gap-2 text-muted-foreground">
      <span className="font-mono text-[22px] opacity-40">∅</span>
      <p className="text-[12.5px]">{label}</p>
    </div>
  );
}
