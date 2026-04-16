import {
  format,
  subDays,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
} from "date-fns";
import { cn } from "@/lib/utils";

interface Props {
  inicio: string; // yyyy-MM-dd
  fim: string;    // yyyy-MM-dd
  onChangeInicio: (v: string) => void;
  onChangeFim: (v: string) => void;
  className?: string;
}

type PresetFn = () => [string, string];

const fmt = (d: Date) => format(d, "yyyy-MM-dd");

const MESES_PT = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

const PRESETS: { label: string; fn: PresetFn }[] = [
  {
    label: "Hoje",
    fn: () => { const t = new Date(); return [fmt(t), fmt(t)]; },
  },
  {
    label: "Esta semana",
    fn: () => {
      const t = new Date();
      return [fmt(startOfWeek(t, { weekStartsOn: 1 })), fmt(endOfWeek(t, { weekStartsOn: 1 }))];
    },
  },
  {
    label: "Este mês",
    fn: () => { const t = new Date(); return [fmt(startOfMonth(t)), fmt(endOfMonth(t))]; },
  },
  {
    label: "Últ. 30 dias",
    fn: () => { const t = new Date(); return [fmt(subDays(t, 29)), fmt(t)]; },
  },
  {
    label: "Mês passado",
    fn: () => {
      const prev = subMonths(new Date(), 1);
      return [fmt(startOfMonth(prev)), fmt(endOfMonth(prev))];
    },
  },
];

// Mês mínimo permitido: março/2026 (antes disso os sistemas não estavam integrados)
const MIN_MONTH = "2026-03-01";

// Last 13 months as quick-pick grid (current month first) — filtered to >= MIN_MONTH
const MONTH_GRID = Array.from({ length: 13 }, (_, i) => {
  const d = subMonths(new Date(), i);
  return {
    label: `${MESES_PT[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`,
    s: fmt(startOfMonth(d)),
    e: fmt(endOfMonth(d)),
  };
}).filter((m) => m.s >= MIN_MONTH);

export function DateRangePicker({
  inicio,
  fim,
  onChangeInicio,
  onChangeFim,
  className,
}: Props) {
  const activePreset = PRESETS.find(({ fn }) => {
    const [s, e] = fn();
    return s === inicio && e === fim;
  })?.label ?? null;

  const activeMonth = MONTH_GRID.find((m) => m.s === inicio && m.e === fim)?.label ?? null;

  return (
    <div className={cn("flex flex-col items-end gap-2", className)}>
      {/* Quick presets */}
      <div className="flex flex-wrap gap-1 justify-end">
        {PRESETS.map(({ label, fn }) => (
          <button
            key={label}
            type="button"
            onClick={() => { const [s, e] = fn(); onChangeInicio(s); onChangeFim(e); }}
            className={cn(
              "px-2.5 py-1 rounded-md text-xs font-medium border transition-colors",
              activePreset === label
                ? "bg-[#C8DA2D] text-[#0C1923] border-[#C8DA2D]"
                : "border-border bg-background text-muted-foreground hover:text-foreground hover:border-foreground/30"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Month grid */}
      <div className="flex flex-wrap gap-1 justify-end">
        {MONTH_GRID.map((m) => (
          <button
            key={m.s}
            type="button"
            onClick={() => { onChangeInicio(m.s); onChangeFim(m.e); }}
            className={cn(
              "px-2 py-0.5 rounded text-[11px] font-medium border transition-colors",
              activeMonth === m.label
                ? "bg-[#0C1923] text-[#C8DA2D] border-[#0C1923]"
                : "border-border bg-background text-muted-foreground hover:text-foreground hover:border-foreground/30"
            )}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Manual date inputs */}
      <div className="flex items-center gap-2 text-sm">
        <input
          type="date"
          value={inicio}
          onChange={(e) => onChangeInicio(e.target.value)}
          className="border rounded-md px-2 py-1.5 bg-background text-sm"
        />
        <span className="text-muted-foreground">→</span>
        <input
          type="date"
          value={fim}
          onChange={(e) => onChangeFim(e.target.value)}
          className="border rounded-md px-2 py-1.5 bg-background text-sm"
        />
      </div>
    </div>
  );
}
