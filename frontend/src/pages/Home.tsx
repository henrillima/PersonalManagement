import { useQuery } from "@tanstack/react-query";
import { apiFetch, fmtBRL, fmtDate } from "@/lib/api";
import type { HomeResumo, TarefaResumo, DespesaResumo, EventoAgenda } from "@/types";
import { cn } from "@/lib/utils";
import { AlertTriangle, CalendarDays, Wallet, ArrowRight, CalendarClock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router-dom";

const PRIORIDADE_COR: Record<string, string> = {
  alta:  "text-red-400 bg-red-400/10 border-red-400/20",
  media: "text-amber-400 bg-amber-400/10 border-amber-400/20",
  baixa: "text-blue-400 bg-blue-400/10 border-blue-400/20",
};

const PRIORIDADE_LABEL: Record<string, string> = {
  alta: "Alta", media: "Média", baixa: "Baixa",
};

const STATUS_LABEL: Record<string, string> = {
  todo: "A Fazer", in_progress: "Em Andamento", done: "Concluído", blocked: "Bloqueado",
};

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

function todayLabel(): string {
  return new Date().toLocaleDateString("pt-BR", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}

export default function Home() {
  const navigate = useNavigate();

  const { data, isLoading } = useQuery<HomeResumo>({
    queryKey: ["home-resumo"],
    queryFn: () => apiFetch("/api/v1/home/resumo"),
    refetchInterval: 60_000,
  });

  const hoje = new Date().toISOString().slice(0, 10);
  const { data: agendaHoje = [] } = useQuery<EventoAgenda[]>({
    queryKey: ["agenda-hoje"],
    queryFn: async () => {
      const evs = await apiFetch<EventoAgenda[]>("/api/v1/agenda");
      return evs.filter(ev => ev.start.startsWith(hoje)).sort((a, b) => a.start.localeCompare(b.start));
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  if (isLoading) return <HomeSkeleton />;

  const resumo = data ?? {
    saldo_total: 0,
    saldo_por_banco: [],
    caixa_data: null,
    tarefas_semana: [],
    tarefas_atrasadas: [],
    proximas_despesas: [],
  };

  return (
    <div className="space-y-7">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold">
          {greeting()}, Henri
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5 capitalize">{todayLabel()}</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard
          label="Saldo Total"
          value={fmtBRL(resumo.saldo_total)}
          sub={resumo.caixa_data ? `Atualizado em ${fmtDate(resumo.caixa_data)}` : "Nenhum lançamento"}
          onClick={() => navigate("/financeiro/caixa")}
        />
        <KpiCard
          label="Tarefas da Semana"
          value={String(resumo.tarefas_semana.length)}
          sub={`${resumo.tarefas_atrasadas.length} atrasada${resumo.tarefas_atrasadas.length !== 1 ? "s" : ""}`}
          alert={resumo.tarefas_atrasadas.length > 0}
          onClick={() => navigate("/tarefas")}
        />
        <KpiCard
          label="Próximas Despesas"
          value={fmtBRL(resumo.proximas_despesas.reduce((s, d) => s + d.valor, 0))}
          sub={`${resumo.proximas_despesas.length} lançamento${resumo.proximas_despesas.length !== 1 ? "s" : ""} nos próximos 30 dias`}
          onClick={() => navigate("/financeiro/pontuais")}
        />
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Tarefas em atraso */}
        {resumo.tarefas_atrasadas.length > 0 && (
          <section className="bg-red-500/5 border border-red-500/20 rounded-xl p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-red-400 mb-3">
              <AlertTriangle size={15} />
              Atrasadas ({resumo.tarefas_atrasadas.length})
            </h2>
            <div className="space-y-2">
              {resumo.tarefas_atrasadas.map((t) => (
                <TarefaItem key={t.id} tarefa={t} />
              ))}
            </div>
          </section>
        )}

        {/* Tarefas da semana */}
        <section className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <CalendarDays size={15} className="text-[#C8DA2D]" />
              Tarefas da semana
            </h2>
            <button
              onClick={() => navigate("/tarefas")}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
            >
              Ver todas <ArrowRight size={12} />
            </button>
          </div>
          {resumo.tarefas_semana.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Nenhuma tarefa para esta semana.
            </p>
          ) : (
            <div className="space-y-2">
              {resumo.tarefas_semana.slice(0, 8).map((t) => (
                <TarefaItem key={t.id} tarefa={t} />
              ))}
            </div>
          )}
        </section>

        {/* Próximas despesas */}
        <section className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <Wallet size={15} className="text-[#C8DA2D]" />
              Próximas despesas (30 dias)
            </h2>
            <button
              onClick={() => navigate("/financeiro/pontuais")}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
            >
              Ver todas <ArrowRight size={12} />
            </button>
          </div>
          {resumo.proximas_despesas.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Nenhuma despesa nos próximos 30 dias.
            </p>
          ) : (
            <div className="space-y-2">
              {resumo.proximas_despesas.map((d, i) => (
                <DespesaItem key={i} despesa={d} />
              ))}
            </div>
          )}
        </section>

        {/* Agenda do dia */}
        <section className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <CalendarClock size={15} className="text-[#C8DA2D]" />
              Agenda de hoje
            </h2>
            <button
              onClick={() => navigate("/rotina")}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
            >
              Ver agenda <ArrowRight size={12} />
            </button>
          </div>
          {agendaHoje.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Sem compromissos hoje.</p>
          ) : (
            <div className="space-y-2">
              {agendaHoje.map(ev => (
                <AgendaItem key={ev.id} evento={ev} />
              ))}
            </div>
          )}
        </section>

        {/* Saldo por conta */}
        {resumo.saldo_por_banco.length > 0 && (
          <section className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold">Saldo por conta</h2>
              <button
                onClick={() => navigate("/financeiro/caixa")}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
              >
                Atualizar <ArrowRight size={12} />
              </button>
            </div>
            <div className="space-y-2">
              {resumo.saldo_por_banco.map((b) => (
                <div key={b.nome} className="flex items-center justify-between py-1.5">
                  <span className="text-sm text-muted-foreground">{b.nome}</span>
                  <span className="text-sm font-medium tabular-nums">{fmtBRL(b.valor)}</span>
                </div>
              ))}
              <div className="flex items-center justify-between py-1.5 border-t border-border mt-1">
                <span className="text-sm font-semibold">Total</span>
                <span className="text-sm font-semibold text-[#C8DA2D] tabular-nums">
                  {fmtBRL(resumo.saldo_total)}
                </span>
              </div>
            </div>
          </section>
        )}

      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function KpiCard({
  label, value, sub, alert, onClick,
}: {
  label: string; value: string; sub: string; alert?: boolean; onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "bg-card border rounded-xl p-5 transition-all",
        onClick && "cursor-pointer hover:border-[#C8DA2D]/40 hover:shadow-sm",
        alert && "border-red-500/30"
      )}
    >
      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
      <p className={cn("text-2xl font-bold mt-1 tabular-nums", alert && "text-red-400")}>{value}</p>
      <p className="text-xs text-muted-foreground mt-1">{sub}</p>
    </div>
  );
}

function TarefaItem({ tarefa }: { tarefa: TarefaResumo }) {
  return (
    <div className="flex items-start gap-3 py-1.5">
      <span
        className={cn(
          "shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded border mt-0.5",
          PRIORIDADE_COR[tarefa.prioridade]
        )}
      >
        {PRIORIDADE_LABEL[tarefa.prioridade]}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm leading-snug truncate">{tarefa.titulo}</p>
        <div className="flex items-center gap-2 mt-0.5">
          {tarefa.frente_nome && (
            <span
              className="text-[10px] px-1.5 py-0.5 rounded font-medium"
              style={{
                backgroundColor: (tarefa.frente_cor ?? "#94a3b8") + "25",
                color: tarefa.frente_cor ?? "#94a3b8",
              }}
            >
              {tarefa.frente_nome}
            </span>
          )}
          {tarefa.data_limite && (
            <span className="text-[10px] text-muted-foreground">
              {fmtDate(tarefa.data_limite)}
            </span>
          )}
          <span className="text-[10px] text-muted-foreground">{STATUS_LABEL[tarefa.status]}</span>
        </div>
      </div>
    </div>
  );
}

function DespesaItem({ despesa }: { despesa: DespesaResumo }) {
  return (
    <div className="flex items-center justify-between py-1.5 gap-4">
      <div className="flex-1 min-w-0">
        <p className="text-sm truncate">{despesa.descricao}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[10px] text-muted-foreground">{despesa.categoria}</span>
          <span className="text-[10px] text-muted-foreground">{fmtDate(despesa.data)}</span>
          <span className={cn(
            "text-[10px] px-1.5 py-0.5 rounded",
            despesa.tipo === "recorrente"
              ? "bg-blue-400/10 text-blue-400"
              : "bg-amber-400/10 text-amber-400"
          )}>
            {despesa.tipo === "recorrente" ? "Recorrente" : "Pontual"}
          </span>
        </div>
      </div>
      <span className="text-sm font-medium tabular-nums shrink-0 text-red-400">
        -{fmtBRL(despesa.valor)}
      </span>
    </div>
  );
}

function AgendaItem({ evento }: { evento: EventoAgenda }) {
  const start = new Date(evento.start);
  const end   = new Date(evento.end);
  const fmt   = (d: Date) => `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
  return (
    <div className="flex items-start gap-3 py-1.5">
      <span className="shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-600 text-white mt-0.5 tabular-nums">
        {fmt(start)}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm leading-snug truncate">{evento.title}</p>
        <p className="text-[10px] text-muted-foreground mt-0.5">{fmt(start)} – {fmt(end)}</p>
      </div>
    </div>
  );
}

function HomeSkeleton() {
  return (
    <div className="space-y-7">
      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-64" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[...Array(2)].map((_, i) => <Skeleton key={i} className="h-64 rounded-xl" />)}
      </div>
    </div>
  );
}
