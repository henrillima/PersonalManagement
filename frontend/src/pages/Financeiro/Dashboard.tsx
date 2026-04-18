import { useQuery } from "@tanstack/react-query";
import { apiFetch, fmtBRL } from "@/lib/api";
import { TrendingUp, TrendingDown, Wallet, Calendar, Info } from "lucide-react";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  PieChart,
  Pie,
  Cell,
} from "recharts";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ProjectionPoint {
  mes: string;
  // Entradas
  rec_receita: number;
  pont_receita: number;
  terceiros: number;
  // Saídas
  rec_despesa: number;
  pont_despesa: number;
  dividas: number;
  faturas_val: number;
  custo_vida_val: number;
  // Saldo acumulado
  saldo: number;
}

interface DistItem {
  categoria: string;
  valor: number;
}

interface DashData {
  saldo_atual: number;
  projection: ProjectionPoint[];
  distribuicao_despesas: DistItem[];
}

function fetchDashboard() {
  return apiFetch<DashData>("/api/v1/financeiro-dashboard");
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const MONTH_NAMES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
const PIE_COLORS = ["#C8DA2D","#4ade80","#60a5fa","#f87171","#a78bfa","#fb923c","#34d399","#818cf8","#f472b6","#facc15"];

function formatMes(mes: string) {
  const p = mes.split("-");
  return `${MONTH_NAMES[parseInt(p[1]) - 1]}/${p[0].slice(2)}`;
}

function fmtK(v: number) {
  if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(0)}k`;
  return String(Math.round(v));
}

const CHART_STYLE = {
  contentStyle: {
    background: "hsl(var(--card))",
    border: "1px solid hsl(var(--border))",
    borderRadius: 8,
    fontSize: 12,
  },
};

const LABEL_MAP: Record<string, string> = {
  rec_receita:   "Rec. Fixas",
  pont_receita:  "Rec. Pontuais",
  terceiros:     "A Receber",
  rec_despesa:   "Desp. Fixas",
  pont_despesa:  "Desp. Pontuais",
  dividas:       "Dívidas",
  faturas_val:   "Faturas Cartão",
  custo_vida_val:"Custo de Vida",
  saldo:         "Saldo projetado",
};

// ── Sub-components ────────────────────────────────────────────────────────────

interface KpiCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  valueColor?: string;
}

function KpiCard({ icon, label, value, sub, valueColor }: KpiCardProps) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-2">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-xs font-medium uppercase tracking-wider">{label}</span>
      </div>
      <span className={`text-2xl font-bold ${valueColor ?? "text-foreground"}`}>{value}</span>
      {sub && <span className="text-muted-foreground text-xs">{sub}</span>}
    </div>
  );
}

// ── Custom Tooltip ─────────────────────────────────────────────────────────────

function ProjectionTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;

  const ENTRADA_KEYS = ["rec_receita", "pont_receita", "terceiros"];
  const SAIDA_KEYS   = ["rec_despesa", "pont_despesa", "dividas", "faturas_val", "custo_vida_val"];

  const entradas = payload.filter((p: any) => ENTRADA_KEYS.includes(p.dataKey) && p.value > 0);
  const saidas   = payload.filter((p: any) => SAIDA_KEYS.includes(p.dataKey) && p.value > 0);
  const saldo    = payload.find((p: any) => p.dataKey === "saldo");

  return (
    <div className="bg-card border border-border rounded-lg p-3 shadow-lg text-xs min-w-[200px]">
      <p className="font-semibold text-foreground mb-2">{typeof label === "string" ? formatMes(label) : label}</p>

      {entradas.length > 0 && (
        <div className="mb-2">
          <p className="text-muted-foreground font-medium mb-1">Entradas</p>
          {entradas.map((p: any) => (
            <div key={p.dataKey} className="flex justify-between gap-4">
              <span style={{ color: p.fill }}>● {LABEL_MAP[p.dataKey] ?? p.dataKey}</span>
              <span className="font-medium">{fmtBRL(p.value)}</span>
            </div>
          ))}
        </div>
      )}

      {saidas.length > 0 && (
        <div className="mb-2">
          <p className="text-muted-foreground font-medium mb-1">Saídas</p>
          {saidas.map((p: any) => (
            <div key={p.dataKey} className="flex justify-between gap-4">
              <span style={{ color: p.fill }}>● {LABEL_MAP[p.dataKey] ?? p.dataKey}</span>
              <span className="font-medium">{fmtBRL(p.value)}</span>
            </div>
          ))}
        </div>
      )}

      {saldo && (
        <div className="border-t border-border pt-2 flex justify-between gap-4">
          <span className="text-[#C8DA2D] font-semibold">Saldo</span>
          <span className={`font-bold ${saldo.value >= 0 ? "text-green-400" : "text-red-400"}`}>
            {fmtBRL(saldo.value)}
          </span>
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function FinanceiroDashboard() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["financeiro-dashboard"],
    queryFn: fetchDashboard,
  });

  if (isLoading) {
    return <div className="text-muted-foreground text-sm py-16 text-center">Carregando dashboard…</div>;
  }

  if (isError || !data) {
    return (
      <div className="text-muted-foreground text-sm py-16 text-center">
        Não foi possível carregar os dados. Verifique se há caixa registrado.
      </div>
    );
  }

  const { saldo_atual, projection, distribuicao_despesas } = data;

  const cur = projection[0];
  const curReceita = (cur?.rec_receita ?? 0) + (cur?.pont_receita ?? 0) + (cur?.terceiros ?? 0);
  const curDespesa = (cur?.rec_despesa ?? 0) + (cur?.pont_despesa ?? 0) + (cur?.dividas ?? 0) + (cur?.faturas_val ?? 0) + (cur?.custo_vida_val ?? 0);
  const final      = projection[projection.length - 1];
  const deltaFinal = (final?.saldo ?? 0) - saldo_atual;
  const totalDistribuicao = distribuicao_despesas.reduce((s, d) => s + d.valor, 0);

  const axisProps = {
    tick: { fontSize: 11, fill: "hsl(var(--muted-foreground))" },
    axisLine: false as const,
    tickLine: false as const,
  };

  return (
    <div className="space-y-6">

      {/* KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          icon={<Wallet size={14} />}
          label="Saldo Atual"
          value={fmtBRL(saldo_atual)}
          valueColor="text-[#C8DA2D]"
        />
        <KpiCard
          icon={<TrendingUp size={14} />}
          label="Entradas Mensais"
          value={fmtBRL(curReceita)}
          valueColor="text-green-400"
        />
        <KpiCard
          icon={<TrendingDown size={14} />}
          label="Saídas Mensais"
          value={fmtBRL(curDespesa)}
          sub="fixas + faturas + custo de vida"
          valueColor="text-red-400"
        />
        <KpiCard
          icon={<Calendar size={14} />}
          label="Saldo em 6 meses"
          value={fmtBRL(final?.saldo ?? 0)}
          valueColor={(final?.saldo ?? 0) >= 0 ? "text-green-400" : "text-red-400"}
          sub={`${deltaFinal >= 0 ? "+" : ""}${fmtBRL(deltaFinal)} vs hoje`}
        />
      </div>

      {/* Model explanation */}
      <div className="flex items-start gap-2 bg-muted/40 border border-border rounded-xl px-4 py-3 text-xs text-muted-foreground">
        <Info size={13} className="shrink-0 mt-0.5 text-[#C8DA2D]" />
        <span>
          <strong className="text-foreground">Modelo de projeção:</strong> Despesas fixas = recorrentes + pontuais que não passam por cartão.
          Faturas cartão = pagamento total da fatura mensal. Custo de vida = orçamento de gastos variáveis.
          Evite lançar em recorrentes itens que já vão para a fatura — isso geraria dupla contagem.
        </span>
      </div>

      {/* Projection Chart — stacked bars */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="mb-5">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Projeção de Caixa — próximos 6 meses
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Verde empilhado = entradas por fonte · Vermelho/laranja empilhado = saídas por tipo · Linha amarela = saldo projetado
          </p>
        </div>
        <ResponsiveContainer width="100%" height={340}>
          <ComposedChart data={projection} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis dataKey="mes" tickFormatter={formatMes} {...axisProps} />
            <YAxis {...axisProps} tickFormatter={fmtK} />
            <Tooltip content={<ProjectionTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
              formatter={(v) => LABEL_MAP[v] ?? v}
            />

            {/* Entradas — green shades (stacked) */}
            <Bar dataKey="rec_receita"  stackId="in" fill="#4ade80" name="rec_receita" />
            <Bar dataKey="pont_receita" stackId="in" fill="#86efac" name="pont_receita" />
            <Bar dataKey="terceiros"    stackId="in" fill="#34d399" name="terceiros"    radius={[3,3,0,0]} />

            {/* Saídas — red/orange shades (stacked) */}
            <Bar dataKey="rec_despesa"   stackId="out" fill="#f87171" name="rec_despesa" />
            <Bar dataKey="pont_despesa"  stackId="out" fill="#fca5a5" name="pont_despesa" />
            <Bar dataKey="dividas"       stackId="out" fill="#ef4444" name="dividas" />
            <Bar dataKey="faturas_val"   stackId="out" fill="#dc2626" name="faturas_val" />
            <Bar dataKey="custo_vida_val" stackId="out" fill="#f97316" name="custo_vida_val" radius={[3,3,0,0]} />

            {/* Saldo acumulado */}
            <Line
              dataKey="saldo"
              name="saldo"
              stroke="#C8DA2D"
              strokeWidth={2.5}
              dot={{ r: 4, fill: "#C8DA2D", strokeWidth: 0 }}
              type="monotone"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Bottom row */}
      <div className="grid lg:grid-cols-2 gap-4">

        {/* Expense distribution pie */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-5">
            Distribuição de Despesas (mês atual)
          </h2>
          {distribuicao_despesas.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-10">
              Nenhuma despesa registrada para este mês
            </p>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="flex justify-center">
                <PieChart width={200} height={200}>
                  <Pie
                    data={distribuicao_despesas}
                    dataKey="valor"
                    nameKey="categoria"
                    cx="50%"
                    cy="50%"
                    outerRadius={88}
                    innerRadius={48}
                  >
                    {distribuicao_despesas.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    {...CHART_STYLE}
                    formatter={(v: number) => [fmtBRL(v)]}
                  />
                </PieChart>
              </div>
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {distribuicao_despesas.map((d, i) => (
                  <div key={d.categoria} className="flex items-center gap-2">
                    <div
                      className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                      style={{ background: PIE_COLORS[i % PIE_COLORS.length] }}
                    />
                    <span className="text-sm flex-1 text-foreground truncate">{d.categoria}</span>
                    <span className="text-sm font-medium text-foreground">{fmtBRL(d.valor)}</span>
                    <span className="text-xs text-muted-foreground w-9 text-right">
                      {totalDistribuicao > 0 ? ((d.valor / totalDistribuicao) * 100).toFixed(0) : 0}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Monthly net liquid */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-5">
            Saldo Líquido Mensal
          </h2>
          <ResponsiveContainer width="100%" height={270}>
            <BarChart
              layout="vertical"
              data={projection.map((p) => ({
                mes: formatMes(p.mes),
                liquido: parseFloat(
                  (
                    p.rec_receita + p.pont_receita + p.terceiros
                    - p.rec_despesa - p.pont_despesa - p.dividas - p.faturas_val - p.custo_vida_val
                  ).toFixed(2)
                ),
              }))}
              margin={{ top: 0, right: 12, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
              <XAxis type="number" {...axisProps} tickFormatter={fmtK} />
              <YAxis type="category" dataKey="mes" width={52} {...axisProps} />
              <Tooltip
                {...CHART_STYLE}
                formatter={(v: number) => [fmtBRL(v), "Saldo líquido"]}
              />
              <Bar dataKey="liquido" radius={[0, 4, 4, 0]}>
                {projection.map((p, i) => {
                  const liq = p.rec_receita + p.pont_receita + p.terceiros
                    - p.rec_despesa - p.pont_despesa - p.dividas - p.faturas_val - p.custo_vida_val;
                  return <Cell key={i} fill={liq >= 0 ? "#C8DA2D" : "#ef4444"} />;
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
