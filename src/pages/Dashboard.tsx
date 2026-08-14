import { FilterCombobox } from "@/components/dashboard/filter-combobox";
import { DataTable } from "@/components/dashboard/data-table";
import { AgencyBars, PriceBars, ShareDonut } from "@/components/dashboard/terminal-charts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useSheetData } from "@/hooks/use-sheet-data";
import {
  DIMENSIONS,
  DIMENSION_MAP,
  filterRows,
  fmtBaht,
  fmtCompact,
  fmtDateTime,
  fmtNum,
  groupBySum,
  topGroups,
  uniqueValues,
  type FilterKey,
  type Filters,
  type Option,
} from "@/lib/sheet";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { AlertTriangle, RefreshCw, X } from "lucide-react";
import { useMemo, useState } from "react";

const SHEET_REF = "sheet://1UtSyr…NRxcw";

export default function Dashboard() {
  const { rows, meta, syncing, error, loaded, sync } = useSheetData();
  const [filters, setFilters] = useState<Filters>({});
  const [groupBy, setGroupBy] = useState<FilterKey>("monthKey");

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
  const categoryGroups = useMemo(
    () => topGroups(groupBySum(filtered, "category"), 7),
    [filtered],
  );
  const agencyGroups = useMemo(
    () => groupBySum(filtered, "agency").slice(0, 8),
    [filtered],
  );

  const activeEntries = (Object.entries(filters) as [FilterKey, string][]).filter(
    ([, value]) => value !== "" && value !== undefined,
  );
  const activeCount = activeEntries.length;

  const setFilter = (key: FilterKey, value: string) =>
    setFilters((prev) => ({ ...prev, [key]: value }));
  const resetFilters = () => setFilters({});

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
                value={filters[dim.key] ?? ""}
                options={optionLists[dim.key]}
                onChange={(v) => setFilter(dim.key, v)}
              />
            ))}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border/60 pt-3">
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              active <span className={activeCount > 0 ? "text-primary" : ""}>{activeCount}</span>/8
            </span>
            {activeEntries.map(([key, value]) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key, "")}
                className="group flex items-center gap-1.5 rounded-sm border border-primary/30 bg-primary/5 px-2 py-1 text-[11.5px] text-primary transition-colors hover:bg-primary/10"
              >
                <span className="font-mono text-[9px] font-semibold tracking-wider">
                  {DIMENSION_MAP[key].code}
                </span>
                <span className="max-w-[180px] truncate">{value}</span>
                <X className="size-3 opacity-60 group-hover:opacity-100" />
              </button>
            ))}
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

        {/* 04 — secondary charts */}
        <div className="grid gap-4 lg:grid-cols-5">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.1 }}
            className="lg:col-span-2"
          >
            <Card className="h-full gap-0 border-border/80 py-5 shadow-none">
              <CardHeader className="px-5">
                <CardTitle className="text-[15px] font-medium">สัดส่วนตามหมวด</CardTitle>
                <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                  group by CAT · share of total
                </p>
              </CardHeader>
              <CardContent className="px-5">
                {categoryGroups.length === 0 ? (
                  <EmptyChart label="ไม่มีข้อมูล" />
                ) : (
                  <ShareDonut groups={categoryGroups} total={total} />
                )}
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.15 }}
            className="lg:col-span-3"
          >
            <Card className="h-full gap-0 border-border/80 py-5 shadow-none">
              <CardHeader className="px-5">
                <CardTitle className="text-[15px] font-medium">TOP 8 หน่วยงาน</CardTitle>
                <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                  group by AGT · sum ราคาเสนอ
                </p>
              </CardHeader>
              <CardContent className="px-5">
                {agencyGroups.length === 0 ? (
                  <EmptyChart label="ไม่มีข้อมูล" />
                ) : (
                  <AgencyBars groups={agencyGroups} />
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>

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

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="flex h-56 flex-col items-center justify-center gap-2 text-muted-foreground">
      <span className="font-mono text-[22px] opacity-40">∅</span>
      <p className="text-[12.5px]">{label}</p>
    </div>
  );
}
