import { cn } from "@/lib/utils";
import { fmtBaht, fmtCompact, fmtNum, type Group } from "@/lib/sheet";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export const PALETTE = [
  "#2f6f4f",
  "#3d7f5a",
  "#4f916a",
  "#6aa682",
  "#8bbd9d",
  "#aecfba",
  "#c9d8cd",
  "#7aa98a",
];
export const AMBER = "#a16207";
export const GRID = "#e6e2d3";

const truncate = (s: string, n: number) => (s.length > n ? `${s.slice(0, n)}…` : s);

function TermTooltip({
  active,
  payload,
  label,
  total,
  suffix,
}: {
  active?: boolean;
  payload?: { payload: Group }[];
  label?: string;
  total: number;
  suffix?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const g = payload[0].payload;
  const share = total > 0 ? ((g.sum / total) * 100).toFixed(1) : "0.0";
  return (
    <div className="rounded-md border border-border bg-card px-3 py-2 shadow-sm">
      <p className="max-w-[240px] text-[11px] font-medium text-foreground">
        {label ?? g.name}
      </p>
      <p className="mt-1 font-mono text-[11px] text-primary">
        {fmtBaht(g.sum)}
        {suffix ? ` ${suffix}` : ""}
      </p>
      <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
        {fmtNum(g.count)} รายการ · {share}% ของยอดรวม
      </p>
    </div>
  );
}

/** Vertical bars — sum of ราคาเสนอ per group. Max bar highlighted in amber. */
export function PriceBars({ groups, total }: { groups: Group[]; total: number }) {
  const maxIndex = groups.reduce(
    (max, g, i) => (g.sum > groups[max].sum ? i : max),
    0,
  );
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={groups} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
          <CartesianGrid vertical={false} stroke={GRID} strokeDasharray="3 3" />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 10.5, fill: "#6b6f5f", fontFamily: "Prompt" }}
            tickLine={false}
            axisLine={{ stroke: GRID }}
            interval={0}
            angle={-24}
            textAnchor="end"
            height={58}
            tickFormatter={(v: string) => truncate(v, 16)}
          />
          <YAxis
            tickFormatter={(v: number) => fmtCompact(v)}
            tick={{ fontSize: 10, fill: "#6b6f5f", fontFamily: "JetBrains Mono, monospace" }}
            tickLine={false}
            axisLine={false}
            width={56}
          />
          <Tooltip
            cursor={{ fill: "oklch(0.93 0.012 95 / 0.5)" }}
            content={<TermTooltip total={total} />}
          />
          <Bar dataKey="sum" radius={[3, 3, 0, 0]} maxBarSize={44}>
            {groups.map((g, i) => (
              <Cell key={g.name} fill={i === maxIndex ? AMBER : PALETTE[0]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Donut — share of ราคาเสนอ across groups (top N + อื่นๆ). */
export function ShareDonut({ groups, total }: { groups: Group[]; total: number }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="h-48 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={groups}
              dataKey="sum"
              nameKey="name"
              innerRadius="62%"
              outerRadius="88%"
              paddingAngle={2}
              cornerRadius={3}
              strokeWidth={0}
            >
              {groups.map((g, i) => (
                <Cell key={g.name} fill={i < PALETTE.length ? PALETTE[i] : AMBER} />
              ))}
            </Pie>
            <Tooltip content={<TermTooltip total={total} />} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="space-y-1.5">
        {groups.map((g, i) => {
          const share = total > 0 ? ((g.sum / total) * 100).toFixed(1) : "0.0";
          return (
            <li key={g.name} className="flex items-center gap-2 text-[12px]">
              <span
                className="size-2 shrink-0 rounded-[2px]"
                style={{ backgroundColor: i < PALETTE.length ? PALETTE[i] : AMBER }}
              />
              <span className="min-w-0 flex-1 truncate text-foreground/85">{g.name}</span>
              <span className="shrink-0 font-mono text-[10.5px] text-muted-foreground">
                {share}%
              </span>
              <span className="shrink-0 font-mono text-[10.5px] text-primary tabular-nums">
                {fmtCompact(g.sum)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Horizontal bars — top agencies by sum of ราคาเสนอ. */
export function AgencyBars({ groups }: { groups: Group[] }) {
  const maxIndex = groups.reduce(
    (max, g, i) => (g.sum > groups[max].sum ? i : max),
    0,
  );
  const height = Math.max(220, groups.length * 34 + 24);
  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={groups}
          layout="vertical"
          margin={{ top: 4, right: 12, left: 4, bottom: 4 }}
        >
          <CartesianGrid horizontal={false} stroke={GRID} strokeDasharray="3 3" />
          <XAxis
            type="number"
            tickFormatter={(v: number) => fmtCompact(v)}
            tick={{ fontSize: 10, fill: "#6b6f5f", fontFamily: "JetBrains Mono, monospace" }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={128}
            tick={{ fontSize: 10.5, fill: "#56594d", fontFamily: "Prompt" }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: string) => truncate(v, 17)}
          />
          <Tooltip cursor={{ fill: "oklch(0.93 0.012 95 / 0.5)" }} content={<TermTooltip total={0} />} />
          <Bar dataKey="sum" radius={[0, 3, 3, 0]} maxBarSize={18} barSize={16}>
            {groups.map((g, i) => (
              <Cell
                key={g.name}
                fill={i === maxIndex ? AMBER : PALETTE[i % PALETTE.length]}
                className={cn("transition-opacity hover:opacity-80")}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
