import { Button } from "@/components/ui/button";
import { useSheetData } from "@/hooks/use-sheet-data";
import {
  ceToBe,
  DIMENSIONS,
  fmtCompact,
  fmtDateTime,
  fmtNum,
  groupBySum,
  type SheetRow,
} from "@/lib/sheet";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { ArrowRight, ExternalLink } from "lucide-react";
import { useMemo } from "react";
import { Link } from "react-router";

const SHEET_URL =
  "https://docs.google.com/spreadsheets/d/1UtSyrAUOXdtRiztXbN4ntobPeS0fMErUrAIeK4NRxcw/edit";

const fadeUp = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
};

export default function Landing() {
  const { rows, meta, loaded } = useSheetData();

  const total = useMemo(() => rows.reduce((s, r) => s + r.price, 0), [rows]);
  const agencyCount = useMemo(() => new Set(rows.map((r) => r.agency)).size, [rows]);
  const monthCount = useMemo(() => new Set(rows.map((r) => r.monthKey)).size, [rows]);

  return (
    <main className="min-h-screen bg-background text-foreground">
      {/* nav */}
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-md border border-primary/30 bg-primary/10 font-mono text-[13px] font-bold text-primary">
            $_
          </div>
          <span className="text-sm font-semibold tracking-tight">
            ราคาเสนอ<span className="text-primary">/</span>terminal
          </span>
        </div>
        <Button variant="outline" size="sm" className="h-8 gap-1.5 text-[12.5px]" asChild>
          <Link to="/dashboard">
            เปิดแดชบอร์ด
            <ArrowRight className="size-3.5" />
          </Link>
        </Button>
      </nav>

      {/* hero */}
      <div className="bg-grid border-y border-border/60">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 sm:px-6 lg:grid-cols-2 lg:py-20">
          <motion.div {...fadeUp} transition={{ duration: 0.5 }}>
            <span className="inline-flex items-center gap-2 rounded-sm border border-primary/30 bg-primary/5 px-2.5 py-1 font-mono text-[11px] text-primary">
              <span className="size-1.5 rounded-full bg-primary" />
              $ open price-analysis --live
            </span>
            <h1 className="mt-5 text-[34px] font-semibold leading-[1.2] tracking-tight sm:text-[42px]">
              วิเคราะห์
              <br />
              <span className="text-primary">ราคาเสนอ</span> ในโหมดเทอร์มินัล
            </h1>
            <p className="mt-5 max-w-md text-[14.5px] leading-relaxed text-muted-foreground">
              แดชบอร์ดข้อมูลราคาเสนอจาก Google Sheets — กรองได้ 9 มิติ ตั้งแต่เลขทะเบียนคุม
              ไปจนถึงหมวด ประเภท และประเภทแผน พร้อมกราฟที่อัปเดตทันทีเมื่อเลือกข้อมูล
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Button size="lg" className="gap-2 px-6" asChild>
                <Link to="/dashboard">
                  เปิดแดชบอร์ด
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="gap-2 px-5" asChild>
                <a href={SHEET_URL} target="_blank" rel="noopener noreferrer">
                  ดู Google Sheets
                  <ExternalLink className="size-4" />
                </a>
              </Button>
            </div>
            <p className="mt-5 font-mono text-[10.5px] text-muted-foreground">
              <span className={cn("inline-block size-1.5 rounded-full", loaded ? "bg-primary" : "bg-amber-600 animate-pulse")} />{" "}
              {loaded
                ? `live · ${fmtNum(rows.length)} rows · synced ${fmtDateTime(meta?.syncedAt)}`
                : "connecting to sheet99…"}
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.12 }}
          >
            <TerminalMock rows={rows} />
          </motion.div>
        </div>
      </div>

      {/* live stats */}
      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCell label="$ records" value={loaded ? fmtNum(rows.length) : "—"} hint="แถวข้อมูลทั้งหมด" />
          <StatCell label="$ sum" value={loaded ? fmtCompact(total) : "—"} hint="ยอดรวมราคาเสนอ" />
          <StatCell label="$ agencies" value={loaded ? fmtNum(agencyCount) : "—"} hint="หน่วยงานที่เกี่ยวข้อง" />
          <StatCell label="$ months" value={loaded ? fmtNum(monthCount) : "—"} hint="เดือนที่บันทึกข้อมูล" />
        </div>
      </section>

      {/* dimensions */}
      <section className="mx-auto max-w-6xl px-4 pb-14 sm:px-6">
        <SectionLabel index="01" code="DIMENSIONS" title="โหมดวิเคราะห์ 9 มิติ" />
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {DIMENSIONS.map((dim, i) => (
            <motion.div
              key={dim.key}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.35, delay: i * 0.04 }}
            >
              <Link
                to="/dashboard"
                className="group block h-full rounded-md border border-border/80 bg-card p-4 transition-colors hover:border-primary/50"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] font-semibold tracking-[0.14em] text-primary">
                    [{dim.code}]
                  </span>
                  <ArrowRight className="size-3.5 text-muted-foreground opacity-0 transition-all group-hover:translate-x-0.5 group-hover:text-primary group-hover:opacity-100" />
                </div>
                <p className="mt-3 text-[14px] font-medium">{dim.label}</p>
                <p className="mt-1 text-[11.5px] leading-relaxed text-muted-foreground">
                  {dim.desc}
                </p>
              </Link>
            </motion.div>
          ))}
        </div>
      </section>

      {/* how it works */}
      <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
        <SectionLabel index="02" code="PIPELINE" title="ข้อมูลทำงานอย่างไร" />
        <div className="mt-5 grid gap-3 lg:grid-cols-3">
          {[
            {
              n: "01",
              cmd: "$ load sheet99",
              title: "เชื่อมต่อ Google Sheets",
              desc: "อ่านข้อมูลราคาเสนอจากชีต sheet99 แบบสาธารณะผ่าน Convex action แล้วแคชไว้",
            },
            {
              n: "02",
              cmd: "$ parse 10 columns",
              title: "แปลงเป็นชุดข้อมูล",
              desc: "จับคู่คอลัมน์ A–J ให้เป็นโครงสร้างสำหรับวิเคราะห์ พร้อมทำความสะอาดราคาเสนอ",
            },
            {
              n: "03",
              cmd: "$ filter --dim 9",
              title: "กรองและดูกราฟแบบสด",
              desc: "เลือกตัวกรองด้านบน ข้อมูล กราฟ และตารางด้านล่างจะอัปเดตอัตโนมัติทันที",
            },
          ].map((step, i) => (
            <motion.div
              key={step.n}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.35, delay: i * 0.06 }}
              className="rounded-md border border-border/80 bg-card p-5"
            >
              <div className="flex items-baseline justify-between">
                <span className="font-mono text-[22px] font-semibold text-primary/25">{step.n}</span>
                <span className="font-mono text-[10.5px] text-primary">{step.cmd}</span>
              </div>
              <p className="mt-3 text-[14px] font-medium">{step.title}</p>
              <p className="mt-1.5 text-[12px] leading-relaxed text-muted-foreground">
                {step.desc}
              </p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border/60">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-5 px-4 py-16 text-center sm:px-6">
          <h2 className="text-[26px] font-semibold tracking-tight sm:text-[30px]">
            พร้อมวิเคราะห์ข้อมูลแล้วหรือยัง?
          </h2>
          <p className="max-w-md text-[13.5px] text-muted-foreground">
            เปิดแดชบอร์ดแล้วเริ่มกรองได้ทันที — ไม่ต้องสมัคร ไม่ต้องตั้งค่าอะไร
          </p>
          <Button size="lg" className="gap-2 px-7" asChild>
            <Link to="/dashboard">
              เปิดแดชบอร์ด
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </section>

      {/* footer */}
      <footer className="border-t border-border/60">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-5 font-mono text-[10.5px] text-muted-foreground sm:px-6">
          <span>ราคาเสนอ/terminal · interactive data dashboard</span>
          <span>sheet://1UtSyr…NRxcw · sheet99</span>
        </div>
      </footer>
    </main>
  );
}

function SectionLabel({ index, code, title }: { index: string; code: string; title: string }) {
  return (
    <div className="flex items-baseline gap-3">
      <span className="font-mono text-[11px] font-semibold tracking-[0.16em] text-primary">
        // {index}
      </span>
      <span className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground">
        {code}
      </span>
      <h2 className="text-[17px] font-medium">{title}</h2>
    </div>
  );
}

function StatCell({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-md border border-border/80 bg-card px-4 py-4">
      <p className="font-mono text-[10px] tracking-[0.14em] text-muted-foreground">{label}</p>
      <p className="mt-1.5 font-mono text-[24px] font-semibold tabular-nums text-foreground">
        {value}
      </p>
      <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>
    </div>
  );
}

function TerminalMock({ rows }: { rows: SheetRow[] }) {
  const months = useMemo(() => groupBySum(rows, "monthKey").slice(0, 6), [rows]);
  const max = months[0]?.sum ?? 1;
  const BAR = 24;

  return (
    <div className="overflow-hidden rounded-md border border-border/80 bg-card shadow-sm">
      <div className="flex items-center gap-1.5 border-b border-border/70 px-4 py-2.5">
        <span className="size-2.5 rounded-full bg-amber-600/70" />
        <span className="size-2.5 rounded-full bg-amber-600/40" />
        <span className="size-2.5 rounded-full bg-primary/60" />
        <span className="ml-2 font-mono text-[11px] text-muted-foreground">
          ราคาเสนอ — sheet99.csv
        </span>
      </div>
      <div className="space-y-1.5 p-4 font-mono text-[11px] leading-relaxed">
        <p>
          <span className="text-primary">$</span> load sheet://1UtSyr…NRxcw{" "}
          <span className="text-muted-foreground">--sheet sheet99</span>
        </p>
        <p className="text-muted-foreground">
          {"  → "}
          {rows.length > 0 ? `${fmtNum(rows.length)} rows` : "fetching…"} · 10 cols · parse ok
        </p>
        <p>
          <span className="text-primary">$</span> group by เดือน{" "}
          <span className="text-muted-foreground">--top 6 --sort sum</span>
        </p>
        <div className="py-1">
          {months.length === 0
            ? [0, 1, 2, 3].map((i) => (
                <p key={i} className="text-muted-foreground/60">
                  {"  "}
                  {"░".repeat(BAR)}
                </p>
              ))
            : months.map((m) => {
                const bars = Math.max(2, Math.round((m.sum / max) * BAR));
                return (
                  <p key={m.name} className="whitespace-pre text-foreground/85">
                    {"  "}
                    <span className="text-primary">
                      {"█".repeat(bars)}
                      {"░".repeat(Math.max(0, BAR - bars))}
                    </span>
                    <span className="ml-2 text-muted-foreground">{ceToBe(m.name)}</span>
                    <span className="ml-1.5 text-primary/90">{fmtCompact(m.sum)}</span>
                  </p>
                );
              })}
        </div>
        <p className="pt-1">
          <span className="text-primary">$</span> status <span className="text-primary">● synced</span>
          <span className="terminal-caret" />
        </p>
      </div>
    </div>
  );
}
