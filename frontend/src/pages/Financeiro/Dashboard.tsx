import { useQuery } from "@tanstack/react-query";
import { apiFetch, fmtBRL } from "@/lib/api";
import { TrendingUp, TrendingDown, Wallet, Calendar } from "lucide-react";
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

interface ProjectionPoint {
  mes: string;
  receita: number;
  despesa: number;
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

const MONTH_NAMES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
const PIE_COLORS = ["#C8DA2D","#4ade80","#60a5fa","#f87171","#a78bfa","#fb923c","#34d399","#818cf8","#f472b6","#facc15"];

function formatMes(mes: string) {
  const [y, m] = mes.split("-");
  return `${MONTH_NAMES[parseInt(m) - 1]}/${y.slice(2)}`;
}

function fmtK(v: number) {
  if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(0)}k`;
  return v.toFixed(0);
}

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

const chartStyle = {
  contentStyle: {
    background: "hsl(var(--card))",
    border: "1px solid hsl(var(--border))",
    borderRadius: 8,
    fontSize: 12,
  },
  labelStyle: { color: "hsl(var(--foreground))" },
};

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
  const final = projection[projection.length - 1];
  const deltaFinal = (final?.saldo ?? 0) - saldo_atual;
  const totalDespesas = distribuicao_despesas.reduce((s, d) => s + d.valor, 0);

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
          label="Receita Mensal"
          value={fmtBRL(cur?.receita ?? 0)}
          valueColor="text-green-400"
        />
        <KpiCard
          icon={<TrendingDown size={14} />}
          label="Despesa Mensal"
          value={fmtBRL(cur?.despesa ?? 0)}
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

      {/* Projection Chart */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-5">
          Projeção de Caixa — próximos 6 meses
        </h2>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={projection} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis
              dataKey="mes"
              tickFormatter={formatMes}
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={fmtK}
            />
            <Tooltip
              {...chartStyle}
              formatter={(value: number, name: string) => [
                fmtBRL(value),
                name === "receita" ? "Receita" : name === "despesa" ? "Despesa" : "Saldo",
              ]}
              labelFormatter={formatMes}
            />
            <Legend
              formatter={(v) =>
                v === "receita" ? "Receita" : v === "despesa" ? "Despesa" : "Saldo projetado"
              }
              wrapperStyle={{ fontSize: 12 }}
            />
            <Bar dataKey="receita" fill="#4ade80" opacity={0.75} radius={[3, 3, 0, 0]} />
            <Bar dataKey="despesa" fill="#f87171" opacity={0.75} radius={[3, 3, 0, 0]} />
            <Line
              dataKey="saldo"
              stroke="#C8DA2D"
              strokeWidth={2.5}
              dot={{ r: 4, fill: "#C8DA2D", strokeWidth: 0 }}
              type="monotone"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Bottom row: expense distribution + monthly balance */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* Pie + legend */}
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
                    {...chartStyle}
                    formatter={(v: number) => [fmtBRL(v)]}
                  />
                </PieChart>
              </div>
              <div className="space-y-2">
                {distribuicao_despesas.map((d, i) => (
                  <div key={d.categoria} className="flex items-center gap-2">
                    <div
                      className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                      style={{ background: PIE_COLORS[i % PIE_COLORS.length] }}
                    />
                    <span className="text-sm flex-1 text-foreground truncate">{d.categoria}</span>
                    <span className="text-sm font-medium text-foreground">{fmtBRL(d.valor)}</span>
                    <span className="text-xs text-muted-foreground w-9 text-right">
                      {totalDespesas > 0 ? ((d.valor / totalDespesas) * 100).toFixed(0) : 0}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Horizontal bar: receita - despesa per month */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-5">
            Saldo Líquido Mensal
          </h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart
              layout="vertical"
              data={projection.map((p) => ({
                mes: formatMes(p.mes),
                liquido: parseFloat((p.receita - p.despesa).toFixed(2)),
              }))}
              margin={{ top: 0, right: 12, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
              <XAxis
                type="number"
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={fmtK}
              />
              <YAxis
                type="category"
                dataKey="mes"
                width={52}
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                {...chartStyle}
                formatter={(v: number) => [fmtBRL(v), "Saldo líquido"]}
              />
              <Bar
                dataKey="liquido"
                radius={[0, 4, 4, 0]}
                fill="#C8DA2D"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
