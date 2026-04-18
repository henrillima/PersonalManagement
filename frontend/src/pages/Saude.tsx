import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus, Trash2, Settings, Sparkles, Save,
  Activity, Scale, Flame, Dumbbell, Target, ChevronLeft, ChevronRight,
} from "lucide-react";
import { apiFetch, fmtDate } from "@/lib/api";
import type { SaudePerfil, PesoEntry, DietaEntry, TreinoEntry } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  AreaChart, Area, BarChart, Bar, ComposedChart, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, CartesianGrid,
} from "recharts";

// ── Constants ──────────────────────────────────────────────────────────────────

const FATOR_LABELS = [
  "1 - Sedentário", "2 - Levemente ativo", "3 - Moderadamente ativo",
  "4 - Muito ativo", "5 - Extremamente ativo",
];
const FATORES = [1.2, 1.375, 1.55, 1.725, 1.9];

const REFEICOES = [
  "Café da manhã", "Lanche da manhã", "Almoço", "Lanche da tarde",
  "Jantar", "Ceia", "Pré-treino", "Pós-treino",
];

const TODAY = new Date().toISOString().slice(0, 10);

// ── Helpers ────────────────────────────────────────────────────────────────────

function imcCategoria(imc: number): { label: string; color: string } {
  if (imc < 18.5) return { label: "Abaixo do peso", color: "#60a5fa" };
  if (imc < 25)   return { label: "Normal",          color: "#C8DA2D" };
  if (imc < 30)   return { label: "Sobrepeso",       color: "#fb923c" };
  return               { label: "Obesidade",          color: "#ef4444" };
}

function fmtShortDate(s: string) {
  const parts = s.split("-");
  return `${parts[2]}/${parts[1]}`;
}

function addDays(dateStr: string, n: number) {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

// ── Main ───────────────────────────────────────────────────────────────────────

export default function Saude() {
  const qc = useQueryClient();

  const [perfilOpen, setPerfilOpen] = useState(false);
  const [pesoOpen, setPesoOpen]     = useState(false);
  const [dietaOpen, setDietaOpen]   = useState(false);
  const [treinoOpen, setTreinoOpen] = useState(false);

  const [perfilForm, setPerfilForm] = useState({
    idade: "", altura: "", sexo: "M", fator_idx: "3",
    deficit_kcal: "300", meta_proteina_g_kg: "1.8", meta_peso: "",
  });
  const [pesoForm, setPesoForm]     = useState({ data: TODAY, peso: "" });
  const [dietaForm, setDietaForm]   = useState({ data: TODAY, refeicao: "Almoço", descricao: "" });
  const [treinoForm, setTreinoForm] = useState({ data: TODAY, descricao: "" });
  const [dietaDate, setDietaDate]   = useState(TODAY);

  // ── Queries ──────────────────────────────────────────────────────────────────

  const { data: perfil, isLoading: lPerfil } = useQuery<SaudePerfil>({
    queryKey: ["saude-perfil"],
    queryFn: () => apiFetch("/api/v1/saude/perfil"),
  });

  const { data: pesos = [], isLoading: lPesos } = useQuery<PesoEntry[]>({
    queryKey: ["saude-peso"],
    queryFn: () => apiFetch("/api/v1/saude/peso"),
  });

  const { data: dieta = [], isLoading: lDieta } = useQuery<DietaEntry[]>({
    queryKey: ["saude-dieta"],
    queryFn: () => apiFetch("/api/v1/saude/dieta"),
  });

  const { data: treinos = [], isLoading: lTreino } = useQuery<TreinoEntry[]>({
    queryKey: ["saude-treino"],
    queryFn: () => apiFetch("/api/v1/saude/treino"),
  });

  // ── Mutations ─────────────────────────────────────────────────────────────────

  const upsertPerfil = useMutation({
    mutationFn: (d: object) => apiFetch("/api/v1/saude/perfil", { method: "PUT", body: JSON.stringify(d) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["saude-perfil"] }); setPerfilOpen(false); },
  });

  const createPeso = useMutation({
    mutationFn: (d: object) => apiFetch("/api/v1/saude/peso", { method: "POST", body: JSON.stringify(d) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["saude-peso"] }); setPesoOpen(false); },
  });

  const deletePeso = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/v1/saude/peso/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["saude-peso"] }),
  });

  const analisarDieta = useMutation({
    mutationFn: (d: object) => apiFetch("/api/v1/saude/dieta/analisar", { method: "POST", body: JSON.stringify(d) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["saude-dieta"] });
      setDietaOpen(false);
      setDietaForm({ data: TODAY, refeicao: "Almoço", descricao: "" });
    },
  });

  const deleteDieta = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/v1/saude/dieta/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["saude-dieta"] }),
  });

  const analisarTreino = useMutation({
    mutationFn: (d: object) => apiFetch("/api/v1/saude/treino/analisar", { method: "POST", body: JSON.stringify(d) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["saude-treino"] });
      setTreinoOpen(false);
      setTreinoForm({ data: TODAY, descricao: "" });
    },
  });

  const deleteTreino = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/v1/saude/treino/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["saude-treino"] }),
  });

  // ── Computed ──────────────────────────────────────────────────────────────────

  const ultimoPeso = pesos[0];

  const { tmb, tdee, metaKcal, metaProtg, imc, imcInfo } = useMemo(() => {
    if (!perfil?.idade || !perfil?.altura || !ultimoPeso?.peso) {
      return { tmb: null, tdee: null, metaKcal: null, metaProtg: null, imc: null, imcInfo: null };
    }
    const peso = ultimoPeso.peso;
    const calcTmb = perfil.sexo === "F"
      ? 10 * peso + 6.25 * perfil.altura - 5 * perfil.idade - 161
      : 10 * peso + 6.25 * perfil.altura - 5 * perfil.idade + 5;
    const fator  = FATORES[(perfil.fator_idx ?? 3) - 1] ?? 1.55;
    const calcTdee = calcTmb * fator;
    const deficit  = perfil.deficit_kcal ?? 300;
    const calcMeta = Math.round(calcTdee - deficit);
    const calcProt = Math.round(peso * (perfil.meta_proteina_g_kg ?? 1.8));
    const calcImc  = peso / ((perfil.altura / 100) ** 2);
    return {
      tmb: Math.round(calcTmb), tdee: Math.round(calcTdee),
      metaKcal: calcMeta, metaProtg: calcProt,
      imc: calcImc, imcInfo: imcCategoria(calcImc),
    };
  }, [perfil, ultimoPeso]);

  // IMC reference lines expressed as kg values (for current height)
  const imcRefs = useMemo(() => {
    if (!perfil?.altura) return null;
    const h = perfil.altura / 100;
    return {
      baixo:     parseFloat((18.5 * h * h).toFixed(1)),
      normal:    parseFloat((25.0 * h * h).toFixed(1)),
      sobrepeso: parseFloat((30.0 * h * h).toFixed(1)),
    };
  }, [perfil?.altura]);

  // Today's nutrition
  const dietaHoje    = useMemo(() => dieta.filter(d => d.data === TODAY), [dieta]);
  const calHoje      = dietaHoje.reduce((s, d) => s + (d.calorias  ?? 0), 0);
  const protHoje     = dietaHoje.reduce((s, d) => s + (d.proteina  ?? 0), 0);
  const carbHoje     = dietaHoje.reduce((s, d) => s + (d.carboidrato ?? 0), 0);
  const gordHoje     = dietaHoje.reduce((s, d) => s + (d.gordura   ?? 0), 0);
  const treinosHoje  = useMemo(() => treinos.filter(t => t.data === TODAY), [treinos]);
  const gastoHoje    = treinosHoje.reduce((s, t) => s + (t.gasto_calorico ?? 0), 0);
  const liquidoHoje  = calHoje - gastoHoje;
  const saldoVsMeta  = metaKcal != null ? liquidoHoje - metaKcal : null;

  // Dieta tab (selected date)
  const dietaDia = useMemo(() => dieta.filter(d => d.data === dietaDate), [dieta, dietaDate]);
  const calDia   = dietaDia.reduce((s, d) => s + (d.calorias    ?? 0), 0);
  const protDia  = dietaDia.reduce((s, d) => s + (d.proteina    ?? 0), 0);
  const carbDia  = dietaDia.reduce((s, d) => s + (d.carboidrato ?? 0), 0);
  const gordDia  = dietaDia.reduce((s, d) => s + (d.gordura     ?? 0), 0);

  // Peso chart with IMC per entry
  const chartPeso = useMemo(() => {
    if (!perfil?.altura) return [];
    return [...pesos].reverse().map(p => ({
      data: p.data,
      peso: p.peso,
      imc: parseFloat((p.peso / ((perfil.altura! / 100) ** 2)).toFixed(1)),
    }));
  }, [pesos, perfil?.altura]);

  // Calorie + workout history (last 30 days)
  const chartCalorias = useMemo(() => {
    const calByDate = dieta.reduce((acc, d) => {
      acc[d.data] = (acc[d.data] ?? 0) + (d.calorias ?? 0);
      return acc;
    }, {} as Record<string, number>);
    const gastoByDate = treinos.reduce((acc, t) => {
      acc[t.data] = (acc[t.data] ?? 0) + (t.gasto_calorico ?? 0);
      return acc;
    }, {} as Record<string, number>);
    return Array.from({ length: 30 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (29 - i));
      const key = d.toISOString().slice(0, 10);
      const cal   = calByDate[key]   ?? null;
      const gasto = gastoByDate[key] ?? 0;
      return {
        label: fmtShortDate(key),
        calorias: cal,
        liquido: cal !== null ? cal - gasto : null,
      };
    });
  }, [dieta, treinos]);

  const hasPerfil = !!(perfil?.idade && perfil?.altura && ultimoPeso);

  // ── Helpers ───────────────────────────────────────────────────────────────────

  function openPerfil() {
    setPerfilForm({
      idade:               String(perfil?.idade ?? ""),
      altura:              String(perfil?.altura ?? ""),
      sexo:                perfil?.sexo ?? "M",
      fator_idx:           String(perfil?.fator_idx ?? 3),
      deficit_kcal:        String(perfil?.deficit_kcal ?? 300),
      meta_proteina_g_kg:  String(perfil?.meta_proteina_g_kg ?? 1.8),
      meta_peso:           String(perfil?.meta_peso ?? ""),
    });
    setPerfilOpen(true);
  }

  function navDietaDate(delta: number) {
    const next = addDays(dietaDate, delta);
    if (next <= TODAY) setDietaDate(next);
  }

  if (lPerfil) return <Skeleton className="h-64 rounded-xl" />;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Saúde & Corpo</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {ultimoPeso
              ? `${ultimoPeso.peso} kg · ${fmtDate(ultimoPeso.data)}`
              : "Configure seu perfil para ver métricas"}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={openPerfil}>
            <Settings size={14} className="mr-1" /> Perfil & Metas
          </Button>
          <Button variant="outline" size="sm" onClick={() => setPesoOpen(true)}>
            <Scale size={14} className="mr-1" /> Peso
          </Button>
          <Button variant="outline" size="sm" onClick={() => setTreinoOpen(true)}>
            <Dumbbell size={14} className="mr-1" /> Treino
          </Button>
          <Button size="sm" onClick={() => setDietaOpen(true)}
            className="bg-[#C8DA2D] text-[#0C1923] hover:bg-[#d4e640]">
            <Plus size={14} className="mr-1" /> Refeição
          </Button>
        </div>
      </div>

      {/* ── Setup banner ── */}
      {!hasPerfil && (
        <div className="bg-card border border-border rounded-xl p-6 text-center space-y-3">
          <p className="text-sm text-muted-foreground">
            Configure seu perfil para calcular IMC, TMB e metas calóricas personalizadas.
          </p>
          <Button size="sm" onClick={openPerfil}
            className="bg-[#C8DA2D] text-[#0C1923] hover:bg-[#d4e640]">
            <Settings size={14} className="mr-1" /> Configurar Perfil
          </Button>
        </div>
      )}

      {/* ── KPI strip ── */}
      {hasPerfil && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <KpiChip icon={<Activity size={13} />} label="IMC"
            value={imc!.toFixed(1)} sub={imcInfo!.label} color={imcInfo!.color} />
          <KpiChip icon={<Flame size={13} />} label="TMB"
            value={`${tmb!.toLocaleString()} kcal`} sub="Taxa metabólica basal" />
          <KpiChip icon={<Activity size={13} />} label="TDEE"
            value={`${tdee!.toLocaleString()} kcal`} sub="Gasto total diário" />
          <KpiChip icon={<Target size={13} />} label="Meta calórica"
            value={`${metaKcal!.toLocaleString()} kcal`}
            sub={`Déficit ${perfil?.deficit_kcal ?? 300} kcal`} color="#C8DA2D" />
          <KpiChip icon={<Dumbbell size={13} />} label="Meta proteína"
            value={`${metaProtg!}g`}
            sub={`${perfil?.meta_proteina_g_kg ?? 1.8}g/kg · ${ultimoPeso!.peso}kg`} />
          {perfil?.meta_peso ? (
            <KpiChip icon={<Scale size={13} />} label="Meta de peso"
              value={`${perfil.meta_peso} kg`}
              sub={`Faltam ${(ultimoPeso!.peso - perfil.meta_peso).toFixed(1)} kg`} />
          ) : (
            <KpiChip icon={<Scale size={13} />} label="Peso atual"
              value={`${ultimoPeso!.peso} kg`}
              sub={fmtDate(ultimoPeso!.data)} />
          )}
        </div>
      )}

      {/* ── Dashboard: today + peso chart ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Today card */}
        <section className="bg-card border border-border rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Flame size={14} className="text-[#C8DA2D]" />
            Hoje · {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "short" })}
          </h3>

          {/* Caloric progress */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-baseline">
              <span className="text-xs text-muted-foreground">Calorias consumidas</span>
              <span className="text-sm font-bold tabular-nums">
                {calHoje.toLocaleString()}{metaKcal ? ` / ${metaKcal.toLocaleString()}` : ""} kcal
              </span>
            </div>
            {metaKcal ? (
              <>
                <div className="h-2.5 bg-border rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{
                    width: `${Math.min((calHoje / metaKcal) * 100, 100)}%`,
                    backgroundColor: calHoje > metaKcal ? "#ef4444" : "#C8DA2D",
                  }} />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {calHoje > metaKcal
                    ? `+${(calHoje - metaKcal).toLocaleString()} kcal acima da meta`
                    : `${(metaKcal - calHoje).toLocaleString()} kcal restantes`}
                </p>
              </>
            ) : (
              <div className="h-2.5 bg-border rounded-full overflow-hidden">
                <div className="h-full rounded-full bg-[#C8DA2D]/50" style={{ width: calHoje > 0 ? "40%" : "0%" }} />
              </div>
            )}
          </div>

          {/* Macros */}
          <div className="grid grid-cols-3 gap-2">
            <MacroCard label="Proteína" value={protHoje} meta={metaProtg ?? undefined} unit="g" color="#60a5fa" />
            <MacroCard label="Carboidrato" value={carbHoje} unit="g" color="#f59e0b" />
            <MacroCard label="Gordura"  value={gordHoje} unit="g" color="#f87171" />
          </div>

          {/* Treinos do dia */}
          {treinosHoje.length > 0 && (
            <div className="border-t border-border pt-3 space-y-1.5">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Treinos do dia</p>
              {treinosHoje.map(t => (
                <div key={t.id} className="flex items-center gap-2 text-sm">
                  <Dumbbell size={12} className="text-amber-400 shrink-0" />
                  <span className="flex-1 truncate text-xs">{t.descricao}</span>
                  {t.gasto_calorico != null && (
                    <span className="text-amber-400 font-medium shrink-0 text-xs">−{t.gasto_calorico} kcal</span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Balanço líquido */}
          {metaKcal != null && (calHoje > 0 || gastoHoje > 0) && (
            <div className="border-t border-border pt-3 flex items-center justify-between gap-2">
              <div>
                <p className="text-xs text-muted-foreground">Balanço líquido do dia</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {calHoje} − {gastoHoje} (treino) = {liquidoHoje} kcal · meta {metaKcal}
                </p>
              </div>
              <div className="text-right">
                <span className={cn(
                  "text-xl font-bold tabular-nums",
                  saldoVsMeta! <= 0 ? "text-[#C8DA2D]" : "text-red-400"
                )}>
                  {saldoVsMeta! > 0 ? "+" : ""}{saldoVsMeta}
                </span>
                <p className="text-[10px] text-muted-foreground">kcal vs meta</p>
              </div>
            </div>
          )}

          {calHoje === 0 && treinosHoje.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-3">
              Nenhum dado registrado hoje.
            </p>
          )}
        </section>

        {/* Peso + IMC chart */}
        <section className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Scale size={14} className="text-[#C8DA2D]" />
              Evolução do peso & IMC
            </h3>
            {imc && imcInfo && (
              <span className="text-xs font-semibold px-2 py-1 rounded-full"
                style={{ backgroundColor: imcInfo.color + "20", color: imcInfo.color }}>
                IMC {imc.toFixed(1)} · {imcInfo.label}
              </span>
            )}
          </div>

          {lPesos ? <Skeleton className="h-52" /> : chartPeso.length < 2 ? (
            <div className="flex items-center justify-center h-52 text-sm text-muted-foreground text-center px-4">
              Registre ao menos 2 pesagens para visualizar a evolução.
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <ComposedChart data={chartPeso} margin={{ right: 30 }}>
                  <defs>
                    <linearGradient id="pesoGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#C8DA2D" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#C8DA2D" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="data" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} tickFormatter={fmtShortDate} />
                  <YAxis yAxisId="peso" tick={{ fontSize: 9 }} tickLine={false} axisLine={false}
                    domain={["auto", "auto"]} unit=" kg" width={44} />
                  <YAxis yAxisId="imc" orientation="right" tick={{ fontSize: 9 }} tickLine={false}
                    axisLine={false} domain={["auto", "auto"]} width={28}
                    tickFormatter={(v) => v.toFixed(1)} />
                  <Tooltip
                    contentStyle={{ background: "#0f1923", border: "1px solid #334155", borderRadius: 8, fontSize: 12 }}
                    formatter={(v: number, name: string) =>
                      name === "peso" ? [`${v} kg`, "Peso"] : [`${Number(v).toFixed(1)}`, "IMC"]
                    }
                    labelFormatter={fmtDate}
                  />
                  {imcRefs && (
                    <>
                      <ReferenceLine yAxisId="peso" y={imcRefs.baixo}    stroke="#60a5fa" strokeDasharray="4 4" strokeOpacity={0.5} label={{ value: "IMC 18.5", fontSize: 8, fill: "#60a5fa", position: "insideTopLeft" }} />
                      <ReferenceLine yAxisId="peso" y={imcRefs.normal}   stroke="#C8DA2D" strokeDasharray="4 4" strokeOpacity={0.5} label={{ value: "IMC 25",   fontSize: 8, fill: "#C8DA2D", position: "insideTopLeft" }} />
                      <ReferenceLine yAxisId="peso" y={imcRefs.sobrepeso} stroke="#fb923c" strokeDasharray="4 4" strokeOpacity={0.5} label={{ value: "IMC 30",   fontSize: 8, fill: "#fb923c", position: "insideTopLeft" }} />
                    </>
                  )}
                  <Area yAxisId="peso" type="monotone" dataKey="peso" stroke="#C8DA2D"
                    fill="url(#pesoGrad)" strokeWidth={2} dot={false} />
                  <Line yAxisId="imc" type="monotone" dataKey="imc" stroke="#94a3b8"
                    strokeWidth={1.5} dot={false} strokeDasharray="3 3" />
                </ComposedChart>
              </ResponsiveContainer>
              <div className="flex gap-4 mt-1 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <span className="w-3 h-0.5 bg-[#C8DA2D] inline-block" /> Peso (kg)
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-0.5 bg-slate-400 inline-block border-dashed" /> IMC (eixo direito)
                </span>
              </div>
            </>
          )}
        </section>
      </div>

      {/* ── Caloric history (30 days) ── */}
      {chartCalorias.some(d => d.calorias !== null) && (
        <section className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold mb-1">Histórico calórico · 30 dias</h3>
          <p className="text-xs text-muted-foreground mb-4">
            Barras amarelas = consumido · Barras azuis = balanço líquido (−gasto treino) · Linha = meta
          </p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={chartCalorias} barSize={8} barGap={1}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="label" tick={{ fontSize: 8 }} tickLine={false} axisLine={false} interval={4} />
              <YAxis tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{ background: "#0f1923", border: "1px solid #334155", borderRadius: 8, fontSize: 12 }}
                formatter={(v: number, name: string) => [
                  v != null ? `${v.toLocaleString()} kcal` : "—",
                  name === "calorias" ? "Consumido" : "Líquido",
                ]}
              />
              {metaKcal && (
                <ReferenceLine y={metaKcal} stroke="#C8DA2D" strokeDasharray="6 3" strokeOpacity={0.8}
                  label={{ value: `Meta: ${metaKcal}`, fontSize: 9, fill: "#C8DA2D", position: "insideTopRight" }} />
              )}
              <Bar dataKey="calorias" fill="#C8DA2D" fillOpacity={0.75} radius={[2, 2, 0, 0]} />
              <Bar dataKey="liquido"  fill="#60a5fa" fillOpacity={0.55} radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </section>
      )}

      {/* ── Detail tabs ── */}
      <Tabs defaultValue="dieta">
        <TabsList className="mb-4">
          <TabsTrigger value="dieta">Dieta</TabsTrigger>
          <TabsTrigger value="treino">Treinos</TabsTrigger>
          <TabsTrigger value="peso">Histórico de peso</TabsTrigger>
        </TabsList>

        {/* Dieta tab */}
        <TabsContent value="dieta" className="space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => navDietaDate(-1)}
              className="p-1.5 rounded-lg border border-border hover:bg-muted transition-colors">
              <ChevronLeft size={15} />
            </button>
            <input type="date" value={dietaDate} max={TODAY}
              onChange={e => setDietaDate(e.target.value)}
              className="text-sm border border-border rounded-lg px-3 py-1.5 bg-background" />
            <button onClick={() => navDietaDate(1)} disabled={dietaDate >= TODAY}
              className="p-1.5 rounded-lg border border-border hover:bg-muted transition-colors disabled:opacity-30">
              <ChevronRight size={15} />
            </button>
            {dietaDate !== TODAY && (
              <button onClick={() => setDietaDate(TODAY)}
                className="px-3 py-1.5 text-xs rounded-lg border border-border hover:bg-muted transition-colors">
                Hoje
              </button>
            )}
            <div className="ml-auto flex gap-3 text-sm flex-wrap">
              <span className="text-muted-foreground">Cal: <strong className="text-foreground">{calDia}</strong></span>
              <span className="text-blue-400">Prot: <strong>{protDia.toFixed(0)}g</strong></span>
              <span className="text-amber-400">Carb: <strong>{carbDia.toFixed(0)}g</strong></span>
              <span className="text-red-400">Gord: <strong>{gordDia.toFixed(0)}g</strong></span>
            </div>
            <Button size="sm"
              onClick={() => { setDietaForm(f => ({ ...f, data: dietaDate })); setDietaOpen(true); }}
              className="bg-[#C8DA2D] text-[#0C1923] hover:bg-[#d4e640]">
              <Plus size={14} className="mr-1" /> Refeição
            </Button>
          </div>

          {metaKcal && calDia > 0 && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Progresso calórico do dia</span>
                <span>{Math.round((calDia / metaKcal) * 100)}%</span>
              </div>
              <div className="h-2 bg-border rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{
                  width: `${Math.min((calDia / metaKcal) * 100, 100)}%`,
                  backgroundColor: calDia > metaKcal ? "#ef4444" : "#C8DA2D",
                }} />
              </div>
            </div>
          )}

          {lDieta ? <Skeleton className="h-32 rounded-xl" /> : dietaDia.length === 0 ? (
            <div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground text-sm">
              Nenhuma refeição registrada neste dia.
            </div>
          ) : (
            <div className="space-y-1">
              {dietaDia.map(d => (
                <div key={d.id} className="flex items-center gap-3 bg-card border border-border rounded-lg px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{d.refeicao}: <span className="font-normal">{d.descricao}</span></p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      <span className="text-foreground font-medium">{d.calorias} kcal</span>
                      {" · "}<span className="text-blue-400">{d.proteina}g prot</span>
                      {" · "}<span className="text-amber-400">{d.carboidrato}g carb</span>
                      {" · "}<span className="text-red-400">{d.gordura}g gord</span>
                    </p>
                  </div>
                  <button onClick={() => deleteDieta.mutate(d.id)}
                    className="text-muted-foreground hover:text-red-500 transition-colors shrink-0">
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Treinos tab */}
        <TabsContent value="treino" className="space-y-4">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setTreinoOpen(true)}
              className="bg-[#C8DA2D] text-[#0C1923] hover:bg-[#d4e640]">
              <Plus size={14} className="mr-1" /> Registrar Treino
            </Button>
          </div>

          {lTreino ? <Skeleton className="h-32 rounded-xl" /> : treinos.length === 0 ? (
            <div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground text-sm">
              Nenhum treino registrado.
            </div>
          ) : (
            <div className="space-y-1">
              {treinos.slice(0, 30).map(t => (
                <div key={t.id} className="flex items-center gap-3 bg-card border border-border rounded-lg px-4 py-3">
                  <span className="text-sm text-muted-foreground shrink-0 tabular-nums">{fmtDate(t.data)}</span>
                  <p className="flex-1 text-sm">{t.descricao}</p>
                  {t.gasto_calorico != null && (
                    <span className="text-sm font-medium text-amber-400 shrink-0">−{t.gasto_calorico} kcal</span>
                  )}
                  <button onClick={() => deleteTreino.mutate(t.id)}
                    className="text-muted-foreground hover:text-red-500 transition-colors shrink-0">
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Peso histórico tab */}
        <TabsContent value="peso" className="space-y-4">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setPesoOpen(true)}
              className="bg-[#C8DA2D] text-[#0C1923] hover:bg-[#d4e640]">
              <Plus size={14} className="mr-1" /> Registrar Peso
            </Button>
          </div>

          {lPesos ? <Skeleton className="h-32 rounded-xl" /> : (
            <div className="space-y-1">
              {pesos.slice(0, 30).map(p => {
                const pesoImc = perfil?.altura ? p.peso / ((perfil.altura / 100) ** 2) : null;
                const info    = pesoImc ? imcCategoria(pesoImc) : null;
                return (
                  <div key={p.id} className="flex items-center gap-3 bg-card border border-border rounded-lg px-4 py-3">
                    <span className="text-sm text-muted-foreground tabular-nums">{fmtDate(p.data)}</span>
                    <span className="flex-1 text-sm font-medium tabular-nums">{p.peso} kg</span>
                    {pesoImc && info && (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: info.color + "20", color: info.color }}>
                        IMC {pesoImc.toFixed(1)}
                      </span>
                    )}
                    <button onClick={() => deletePeso.mutate(p.id)}
                      className="text-muted-foreground hover:text-red-500 transition-colors">
                      <Trash2 size={13} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ── Dialogs ─────────────────────────────────────────────────────────────── */}

      {/* Perfil & Metas */}
      <Dialog open={perfilOpen} onOpenChange={setPerfilOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Perfil & Metas</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Dados corporais</p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Idade</Label>
                <Input type="number" value={perfilForm.idade}
                  onChange={e => setPerfilForm(f => ({ ...f, idade: e.target.value }))}
                  placeholder="25" className="mt-1" />
              </div>
              <div>
                <Label>Altura (cm)</Label>
                <Input type="number" value={perfilForm.altura}
                  onChange={e => setPerfilForm(f => ({ ...f, altura: e.target.value }))}
                  placeholder="175" className="mt-1" />
              </div>
              <div>
                <Label>Sexo</Label>
                <Select value={perfilForm.sexo} onValueChange={v => setPerfilForm(f => ({ ...f, sexo: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="M">Masculino</SelectItem>
                    <SelectItem value="F">Feminino</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Nível de atividade física</Label>
              <Select value={perfilForm.fator_idx} onValueChange={v => setPerfilForm(f => ({ ...f, fator_idx: v }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FATOR_LABELS.map((l, i) => (
                    <SelectItem key={i + 1} value={String(i + 1)}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="border-t border-border pt-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Metas</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Déficit calórico (kcal)</Label>
                  <Input type="number" value={perfilForm.deficit_kcal}
                    onChange={e => setPerfilForm(f => ({ ...f, deficit_kcal: e.target.value }))}
                    placeholder="300" className="mt-1" />
                  <p className="text-[10px] text-muted-foreground mt-1">Subtraído do TDEE. Padrão: 300</p>
                </div>
                <div>
                  <Label>Proteína (g/kg de peso)</Label>
                  <Input type="number" step="0.1" value={perfilForm.meta_proteina_g_kg}
                    onChange={e => setPerfilForm(f => ({ ...f, meta_proteina_g_kg: e.target.value }))}
                    placeholder="1.8" className="mt-1" />
                  <p className="text-[10px] text-muted-foreground mt-1">Recomendado: 1.6–2.2 g/kg</p>
                </div>
              </div>
              <div className="mt-3">
                <Label>Meta de peso (kg) — opcional</Label>
                <Input type="number" step="0.1" value={perfilForm.meta_peso}
                  onChange={e => setPerfilForm(f => ({ ...f, meta_peso: e.target.value }))}
                  placeholder="Ex: 72.0" className="mt-1" />
              </div>
            </div>

            {/* Live preview */}
            {perfilForm.altura && perfilForm.idade && ultimoPeso && (
              <div className="bg-muted/30 rounded-lg p-3 text-xs space-y-1">
                {(() => {
                  const h = parseFloat(perfilForm.altura) / 100;
                  const p = ultimoPeso.peso;
                  const calcTmb = perfilForm.sexo === "F"
                    ? 10 * p + 6.25 * parseFloat(perfilForm.altura) - 5 * parseInt(perfilForm.idade) - 161
                    : 10 * p + 6.25 * parseFloat(perfilForm.altura) - 5 * parseInt(perfilForm.idade) + 5;
                  const f = FATORES[parseInt(perfilForm.fator_idx) - 1] ?? 1.55;
                  const calcTdee = calcTmb * f;
                  const def = parseInt(perfilForm.deficit_kcal) || 300;
                  const calcImc = p / (h * h);
                  const info = imcCategoria(calcImc);
                  return (
                    <>
                      <p className="font-semibold text-foreground">Prévia com seu peso atual ({p} kg):</p>
                      <p>TMB: <strong>{Math.round(calcTmb)} kcal</strong> · TDEE: <strong>{Math.round(calcTdee)} kcal</strong></p>
                      <p>Meta calórica: <strong className="text-[#C8DA2D]">{Math.round(calcTdee - def)} kcal/dia</strong></p>
                      <p>IMC: <strong style={{ color: info.color }}>{calcImc.toFixed(1)} — {info.label}</strong></p>
                    </>
                  );
                })()}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPerfilOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => upsertPerfil.mutate({
                idade:               parseInt(perfilForm.idade)              || undefined,
                altura:              parseFloat(perfilForm.altura)           || undefined,
                sexo:                perfilForm.sexo,
                fator_idx:           parseInt(perfilForm.fator_idx),
                deficit_kcal:        parseInt(perfilForm.deficit_kcal)       || 300,
                meta_proteina_g_kg:  parseFloat(perfilForm.meta_proteina_g_kg) || 1.8,
                meta_peso:           parseFloat(perfilForm.meta_peso)        || undefined,
              })}
              disabled={upsertPerfil.isPending}
              className="bg-[#C8DA2D] text-[#0C1923] hover:bg-[#d4e640]"
            >
              <Save size={14} className="mr-1" /> Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Peso */}
      <Dialog open={pesoOpen} onOpenChange={setPesoOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Registrar Peso</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Data</Label>
              <Input type="date" value={pesoForm.data}
                onChange={e => setPesoForm(f => ({ ...f, data: e.target.value }))} className="mt-1" />
            </div>
            <div>
              <Label>Peso (kg)</Label>
              <Input type="number" step="0.1" value={pesoForm.peso}
                onChange={e => setPesoForm(f => ({ ...f, peso: e.target.value }))}
                placeholder="70.5" className="mt-1" />
            </div>
            {pesoForm.peso && perfil?.altura && (() => {
              const p = parseFloat(pesoForm.peso);
              if (!p || isNaN(p)) return null;
              const calcImc = p / ((perfil.altura / 100) ** 2);
              const info = imcCategoria(calcImc);
              return (
                <p className="text-xs font-medium" style={{ color: info.color }}>
                  IMC estimado: {calcImc.toFixed(1)} — {info.label}
                </p>
              );
            })()}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPesoOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => createPeso.mutate({ data: pesoForm.data, peso: parseFloat(pesoForm.peso) })}
              disabled={!pesoForm.peso || createPeso.isPending}
              className="bg-[#C8DA2D] text-[#0C1923] hover:bg-[#d4e640]">
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dieta */}
      <Dialog open={dietaOpen} onOpenChange={(o) => { setDietaOpen(o); if (!o) setDietaForm({ data: TODAY, refeicao: "Almoço", descricao: "" }); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles size={16} className="text-[#C8DA2D]" /> Registrar Refeição
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Data</Label>
                <Input type="date" value={dietaForm.data}
                  onChange={e => setDietaForm(f => ({ ...f, data: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <Label>Refeição</Label>
                <Select value={dietaForm.refeicao} onValueChange={v => setDietaForm(f => ({ ...f, refeicao: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {REFEICOES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>O que você comeu?</Label>
              <Textarea value={dietaForm.descricao}
                onChange={e => setDietaForm(f => ({ ...f, descricao: e.target.value }))}
                placeholder="Ex: 150g de frango grelhado, 100g de arroz branco, salada à vontade."
                className="mt-1 resize-none" rows={3} />
            </div>
            <p className="text-xs text-muted-foreground">
              A IA (GPT-4o mini) vai estimar automaticamente calorias, proteínas, carboidratos e gorduras.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDietaOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => analisarDieta.mutate({ data: dietaForm.data, refeicao: dietaForm.refeicao, descricao: dietaForm.descricao })}
              disabled={!dietaForm.descricao.trim() || analisarDieta.isPending}
              className="bg-[#C8DA2D] text-[#0C1923] hover:bg-[#d4e640] gap-2">
              {analisarDieta.isPending
                ? <><span className="animate-spin inline-block w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full" /> Analisando...</>
                : <><Sparkles size={14} /> Analisar e Salvar</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Treino */}
      <Dialog open={treinoOpen} onOpenChange={(o) => { setTreinoOpen(o); if (!o) setTreinoForm({ data: TODAY, descricao: "" }); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles size={16} className="text-[#C8DA2D]" /> Registrar Treino
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Data</Label>
              <Input type="date" value={treinoForm.data}
                onChange={e => setTreinoForm(f => ({ ...f, data: e.target.value }))} className="mt-1" />
            </div>
            <div>
              <Label>O que você treinou?</Label>
              <Textarea value={treinoForm.descricao}
                onChange={e => setTreinoForm(f => ({ ...f, descricao: e.target.value }))}
                placeholder="Ex: Musculação — costas e bíceps, 1h15. Barra fixa 4x10, remada curvada 4x12, rosca direta 3x12."
                className="mt-1 resize-none" rows={3} />
            </div>
            <p className="text-xs text-muted-foreground">
              A IA vai estimar o gasto calórico com base no seu peso atual ({ultimoPeso?.peso ?? 70} kg).
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTreinoOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => analisarTreino.mutate({ data: treinoForm.data, descricao: treinoForm.descricao, peso_atual: ultimoPeso?.peso })}
              disabled={!treinoForm.descricao.trim() || analisarTreino.isPending}
              className="bg-[#C8DA2D] text-[#0C1923] hover:bg-[#d4e640] gap-2">
              {analisarTreino.isPending
                ? <><span className="animate-spin inline-block w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full" /> Estimando...</>
                : <><Sparkles size={14} /> Estimar e Salvar</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function KpiChip({ icon, label, value, sub, color }: {
  icon: React.ReactNode; label: string; value: string; sub: string; color?: string;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-3">
      <div className="flex items-center gap-1.5 mb-1" style={{ color: color ?? "#94a3b8" }}>
        {icon}
        <span className="text-[9px] font-semibold uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-sm font-bold tabular-nums leading-tight" style={{ color: color ?? undefined }}>
        {value}
      </p>
      <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{sub}</p>
    </div>
  );
}

function MacroCard({ label, value, meta, unit, color }: {
  label: string; value: number; meta?: number; unit: string; color: string;
}) {
  const pct = meta ? Math.min((value / meta) * 100, 100) : null;
  return (
    <div className="bg-muted/30 rounded-lg p-2.5">
      <p className="text-[10px] text-muted-foreground mb-1">{label}</p>
      <p className="text-sm font-bold tabular-nums" style={{ color }}>
        {value.toFixed(0)}{unit}
      </p>
      {meta && <p className="text-[9px] text-muted-foreground">/ {meta}{unit}</p>}
      {pct !== null && (
        <div className="h-1 bg-border rounded-full overflow-hidden mt-1.5">
          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
        </div>
      )}
    </div>
  );
}
