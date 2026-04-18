import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { addDays, addWeeks, subWeeks, startOfWeek, isSameDay, format } from "date-fns";
import {
  ChevronLeft, ChevronRight, Plus, Calendar, Clock,
  AlertCircle, Trash2, Archive, Wallet, Check,
} from "lucide-react";
import { apiFetch, fmtBRL, fmtDate } from "@/lib/api";
import type {
  EventoAgenda, Tarefa, FluxoPontual, FluxoRecorrente,
  Frente, CategoriaItem, Prioridade, TarefaStatus, Terceiro, FaturaCartao,
  TarefaRecorrenteOcorrencia,
} from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

// ── Constants ──────────────────────────────────────────────────────────────────

const DIAS_SEMANA = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const PRIO_COR: Record<string, string>   = { alta: "#ef4444", media: "#f59e0b", baixa: "#60a5fa" };
const PRIO_LABEL: Record<string, string> = { alta: "Alta",    media: "Média",   baixa: "Baixa"   };

const PRIORIDADES: { value: Prioridade; label: string }[] = [
  { value: "alta", label: "Alta" }, { value: "media", label: "Média" }, { value: "baixa", label: "Baixa" },
];
const STATUSES: { value: TarefaStatus; label: string }[] = [
  { value: "todo", label: "A Fazer" }, { value: "in_progress", label: "Em Andamento" },
  { value: "done", label: "Concluído" }, { value: "blocked", label: "Bloqueado" },
];

const TODAY_STR = new Date().toISOString().slice(0, 10);

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtWeekLabel(start: Date) {
  const end = addDays(start, 6);
  return `${start.getDate()} ${MESES[start.getMonth()]} – ${end.getDate()} ${MESES[end.getMonth()]} ${end.getFullYear()}`;
}

function fmtHora(d: Date) {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function isOverdue(t: Tarefa) {
  return t.status !== "done" && !!t.data_limite && t.data_limite < TODAY_STR;
}

// ── Main ───────────────────────────────────────────────────────────────────────

export default function Rotina() {
  const qc = useQueryClient();

  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));

  // Dialogs
  const [criarOpen, setCriarOpen]           = useState(false);
  const [selectedEvento, setSelectedEvento] = useState<EventoAgenda | null>(null);
  const [editingTarefa, setEditingTarefa]   = useState<Tarefa | null>(null);

  // New event form
  const [fTitulo, setFTitulo]   = useState("");
  const [fDataIni, setFDataIni] = useState(format(new Date(), "yyyy-MM-dd"));
  const [fHoraIni, setFHoraIni] = useState("09:00");
  const [fDataFim, setFDataFim] = useState(format(new Date(), "yyyy-MM-dd"));
  const [fHoraFim, setFHoraFim] = useState("10:00");
  const [fDesc, setFDesc]       = useState("");
  const [fGuests, setFGuests]   = useState("");

  // Task edit form
  const [tForm, setTForm] = useState({
    titulo: "", descricao: "", categoria: "", frente_id: "",
    prioridade: "media" as Prioridade, status: "todo" as TarefaStatus,
    data_limite: "", observacao: "",
  });

  const today = new Date();
  const days  = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  // ── Queries ───────────────────────────────────────────────────────────────────

  const { data: eventos = [], isError: isErrorAgenda } = useQuery<EventoAgenda[]>({
    queryKey: ["agenda"],
    queryFn:  () => apiFetch("/api/v1/agenda"),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const { data: tarefas = [] } = useQuery<Tarefa[]>({
    queryKey: ["tarefas"],
    queryFn:  () => apiFetch("/api/v1/tarefas"),
    staleTime: 2 * 60 * 1000,
  });

  const { data: recorrentes = [] } = useQuery<FluxoRecorrente[]>({
    queryKey: ["fluxos-recorrentes"],
    queryFn:  () => apiFetch("/api/v1/recorrentes"),
    staleTime: 10 * 60 * 1000,
    retry: false,
  });

  const { data: pontuais = [] } = useQuery<FluxoPontual[]>({
    queryKey: ["fluxos-pontuais"],
    queryFn:  () => apiFetch("/api/v1/pontuais"),
    staleTime: 10 * 60 * 1000,
    retry: false,
  });

  const { data: terceiros = [] } = useQuery<Terceiro[]>({
    queryKey: ["terceiros"],
    queryFn:  () => apiFetch("/api/v1/terceiros"),
    staleTime: 10 * 60 * 1000,
    retry: false,
  });

  const { data: cartoes = [] } = useQuery<FaturaCartao[]>({
    queryKey: ["faturas-cartoes"],
    queryFn:  () => apiFetch("/api/v1/faturas/cartoes"),
    staleTime: 60 * 60 * 1000,
    retry: false,
  });

  const { data: frentes = [] } = useQuery<Frente[]>({
    queryKey: ["frentes"],
    queryFn:  () => apiFetch("/api/v1/frentes"),
    staleTime: 10 * 60 * 1000,
  });

  const { data: categorias = [] } = useQuery<CategoriaItem[]>({
    queryKey: ["categorias"],
    queryFn:  () => apiFetch("/api/v1/categorias"),
    staleTime: 10 * 60 * 1000,
  });

  // Months covered by the current week (1 or 2)
  const weekMonths = useMemo(() => {
    const s = new Set<string>();
    days.forEach(d => s.add(format(d, "yyyy-MM")));
    return [...s];
  }, [days]);

  const { data: recOcorrencias1 = [] } = useQuery<TarefaRecorrenteOcorrencia[]>({
    queryKey: ["tarefas-rec-ocorrencias", weekMonths[0]],
    queryFn:  () => apiFetch(`/api/v1/tarefas-recorrentes/ocorrencias?mes=${weekMonths[0]}`),
    staleTime: 2 * 60 * 1000,
    retry: false,
  });

  const { data: recOcorrencias2 = [] } = useQuery<TarefaRecorrenteOcorrencia[]>({
    queryKey: ["tarefas-rec-ocorrencias", weekMonths[1] ?? ""],
    queryFn:  () => apiFetch(`/api/v1/tarefas-recorrentes/ocorrencias?mes=${weekMonths[1]}`),
    enabled:  weekMonths.length > 1,
    staleTime: 2 * 60 * 1000,
    retry: false,
  });

  const recOcorrencias = useMemo(
    () => [...recOcorrencias1, ...recOcorrencias2],
    [recOcorrencias1, recOcorrencias2]
  );

  // ── Mutations ─────────────────────────────────────────────────────────────────

  const createEvento = useMutation({
    mutationFn: (d: object) => apiFetch("/api/v1/agenda", { method: "POST", body: JSON.stringify(d) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agenda"] });
      setCriarOpen(false);
      setFTitulo(""); setFDesc(""); setFGuests("");
    },
  });

  const updateTarefa = useMutation({
    mutationFn: ({ id, d }: { id: string; d: object }) =>
      apiFetch(`/api/v1/tarefas/${id}`, { method: "PATCH", body: JSON.stringify(d) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tarefas"] });
      qc.invalidateQueries({ queryKey: ["home-resumo"] });
      setEditingTarefa(null);
    },
  });

  const deleteTarefa = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/v1/tarefas/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tarefas"] });
      setEditingTarefa(null);
    },
  });

  const toggleOcorrencia = useMutation({
    mutationFn: ({ id, concluida }: { id: string; concluida: boolean }) =>
      apiFetch(`/api/v1/tarefas-recorrentes/ocorrencias/${id}`, {
        method: "PATCH", body: JSON.stringify({ concluida }),
      }),
    onMutate: ({ id, concluida }) => {
      for (const mes of weekMonths) {
        qc.setQueryData<TarefaRecorrenteOcorrencia[]>(["tarefas-rec-ocorrencias", mes], (old = []) =>
          old.map(o => o.id === id ? { ...o, concluida } : o)
        );
      }
    },
    onSettled: () => {
      weekMonths.forEach(mes => qc.invalidateQueries({ queryKey: ["tarefas-rec-ocorrencias", mes] }));
    },
  });

  // ── Per-day helpers ───────────────────────────────────────────────────────────

  function eventosForDay(day: Date) {
    return eventos
      .filter(ev => { try { return isSameDay(new Date(ev.start), day); } catch { return false; } })
      .sort((a, b) => a.start.localeCompare(b.start));
  }

  function tarefasForDay(day: Date) {
    const dayStr = format(day, "yyyy-MM-dd");
    return tarefas
      .filter(t => !t.arquivado && t.status !== "done" && t.data_limite === dayStr)
      .sort((a, b) => {
        if (isOverdue(a) && !isOverdue(b)) return -1;
        if (!isOverdue(a) && isOverdue(b)) return 1;
        const ord = { alta: 0, media: 1, baixa: 2 };
        return (ord[a.prioridade] ?? 1) - (ord[b.prioridade] ?? 1);
      });
  }

  type FluxoItem = { id: string; descricao: string; valor: number; categoria: string; tipo_fluxo: "pontual" | "recorrente"; isReceita: boolean };

  function fluxosForDay(day: Date): FluxoItem[] {
    const dayNum   = day.getDate();
    const monthStr = format(day, "yyyy-MM");

    const pts = pontuais
      .filter(p => p.dia === dayNum && p.mes_alvo === monthStr)
      .map(p => ({ id: p.id, descricao: p.descricao, valor: p.valor, categoria: p.categoria, tipo_fluxo: "pontual" as const, isReceita: p.tipo === "Receita" }));

    const recs = recorrentes
      .filter(r => r.dia === dayNum && r.inicio <= monthStr && (!r.fim || r.fim >= monthStr))
      .map(r => ({ id: r.id, descricao: r.descricao, valor: r.valor, categoria: r.categoria, tipo_fluxo: "recorrente" as const, isReceita: r.tipo === "Receita" }));

    return [...pts, ...recs];
  }

  type TerceiroItem = { id: string; pessoa: string; descricao: string; valor: number; recebido: boolean };

  function terceirosForDay(day: Date): TerceiroItem[] {
    const dayNum   = day.getDate();
    const monthStr = format(day, "yyyy-MM");
    return terceiros
      .filter(t => t.dia === dayNum && t.mes_alvo === monthStr)
      .map(t => ({ id: t.id, pessoa: t.pessoa, descricao: t.descricao, valor: t.valor, recebido: t.recebido }));
  }

  function tarefasRecorrentesForDay(day: Date): TarefaRecorrenteOcorrencia[] {
    const dayStr = format(day, "yyyy-MM-dd");
    return recOcorrencias.filter(o => o.data_alvo === dayStr);
  }

  type FatVencItem = { cartao: string };

  function faturaVencimentosForDay(day: Date): FatVencItem[] {
    const dayNum = day.getDate();
    return cartoes
      .filter(c => c.vencimento === dayNum)
      .map(c => ({ cartao: c.cartao }));
  }

  // ── Task edit dialog helpers ───────────────────────────────────────────────────

  function openEditTarefa(t: Tarefa) {
    setTForm({
      titulo: t.titulo, descricao: t.descricao ?? "",
      categoria: t.categoria, frente_id: t.frente_id ?? "",
      prioridade: t.prioridade, status: t.status,
      data_limite: t.data_limite ?? "", observacao: t.observacao ?? "",
    });
    setEditingTarefa(t);
  }

  function handleSaveTarefa() {
    if (!editingTarefa || !tForm.titulo.trim()) return;
    updateTarefa.mutate({ id: editingTarefa.id, d: {
      titulo: tForm.titulo,
      descricao: tForm.descricao || undefined,
      categoria: tForm.categoria,
      frente_id: tForm.frente_id || undefined,
      prioridade: tForm.prioridade,
      status: tForm.status,
      data_limite: tForm.data_limite || undefined,
      observacao: tForm.observacao || undefined,
    }});
  }

  function openCreate(day?: Date) {
    const d = day ? format(day, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd");
    setFDataIni(d); setFDataFim(d); setFHoraIni("09:00"); setFHoraFim("10:00");
    setFTitulo(""); setFDesc(""); setFGuests("");
    setCriarOpen(true);
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Semana</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Compromissos, tarefas e pagamentos em um só lugar</p>
        </div>
        <Button onClick={() => openCreate()} className="bg-[#C8DA2D] text-[#0C1923] hover:bg-[#d4e640]">
          <Plus size={14} className="mr-1" /> Novo Compromisso
        </Button>
      </div>

      {/* Week navigation */}
      <div className="flex items-center gap-2">
        <button onClick={() => setWeekStart(w => subWeeks(w, 1))}
          className="p-1.5 rounded-lg border border-border hover:bg-muted transition-colors">
          <ChevronLeft size={16} />
        </button>
        <span className="text-sm font-medium min-w-[190px] text-center">{fmtWeekLabel(weekStart)}</span>
        <button onClick={() => setWeekStart(w => addWeeks(w, 1))}
          className="p-1.5 rounded-lg border border-border hover:bg-muted transition-colors">
          <ChevronRight size={16} />
        </button>
        <button onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}
          className="ml-2 px-3 py-1.5 text-xs rounded-lg border border-border hover:bg-muted transition-colors">
          Hoje
        </button>
        <div className="ml-auto flex gap-3 text-xs text-muted-foreground flex-wrap justify-end">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-blue-600 inline-block shrink-0" /> Compromisso
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-card border border-border inline-block shrink-0" /> Tarefa
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-green-500/20 border border-green-500/30 inline-block shrink-0" /> Receita
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-red-500/20 border border-red-500/30 inline-block shrink-0" /> Despesa
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-teal-500/20 border border-teal-500/30 inline-block shrink-0" /> A Receber
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-purple-500/20 border border-purple-500/30 inline-block shrink-0" /> Fatura
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-indigo-500/20 border border-indigo-500/30 inline-block shrink-0" /> Rotina
          </span>
        </div>
      </div>

      {/* Calendar error */}
      {isErrorAgenda && (
        <div className="flex items-center gap-2 text-sm text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded-xl px-4 py-3">
          <AlertCircle size={15} /> Não foi possível carregar a agenda do Google Calendar.
        </div>
      )}

      {/* 7-column week grid */}
      <div className="overflow-x-auto pb-4">
        <div className="grid grid-cols-7 gap-2 min-w-[700px]">
          {days.map((day, i) => {
            const isToday     = isSameDay(day, today);
            const dayEvs      = eventosForDay(day);
            const dayTarefas  = tarefasForDay(day);
            const dayFluxos   = fluxosForDay(day);
            const dayTercs    = terceirosForDay(day);
            const dayFatVenc  = faturaVencimentosForDay(day);
            const dayRotinas  = tarefasRecorrentesForDay(day);
            const totalItems  = dayEvs.length + dayTarefas.length + dayFluxos.length + dayTercs.length + dayFatVenc.length + dayRotinas.length;

            return (
              <div key={i} className="flex flex-col gap-1.5">

                {/* Day header */}
                <button
                  onClick={() => openCreate(day)}
                  className={cn(
                    "flex flex-col items-center py-2.5 px-1 rounded-xl border transition-all hover:bg-muted/50",
                    isToday
                      ? "bg-[#C8DA2D]/10 border-[#C8DA2D]/40 shadow-sm"
                      : "border-border"
                  )}
                >
                  <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-widest">
                    {DIAS_SEMANA[i]}
                  </span>
                  <span className={cn(
                    "text-xl font-bold leading-tight mt-0.5",
                    isToday ? "text-[#C8DA2D]" : "text-foreground"
                  )}>
                    {day.getDate()}
                  </span>
                  <span className="text-[9px] text-muted-foreground">{MESES[day.getMonth()]}</span>
                  {totalItems > 0 && (
                    <span className={cn(
                      "mt-1 text-[9px] font-semibold px-1.5 py-0.5 rounded-full",
                      isToday ? "bg-[#C8DA2D]/20 text-[#C8DA2D]" : "bg-muted text-muted-foreground"
                    )}>
                      {totalItems}
                    </span>
                  )}
                </button>

                {/* Cards */}
                <div className="flex flex-col gap-1">

                  {/* Events */}
                  {dayEvs.map(ev => (
                    <EventoCard key={ev.id} evento={ev} onClick={() => setSelectedEvento(ev)} />
                  ))}

                  {/* Tasks */}
                  {dayTarefas.map(t => (
                    <TarefaCard key={t.id} tarefa={t} onClick={() => openEditTarefa(t)} />
                  ))}

                  {/* Financial flows (receitas + despesas) */}
                  {dayFluxos.map(f => f.isReceita
                    ? <ReceitaCard key={f.id} fluxo={f} />
                    : <DespesaCard key={f.id} despesa={f} />
                  )}

                  {/* Terceiros (a receber) */}
                  {dayTercs.map(t => (
                    <TerceiroCard key={t.id} terceiro={t} />
                  ))}

                  {/* Fatura vencimentos */}
                  {dayFatVenc.map(f => (
                    <FaturaVencCard key={f.cartao} item={f} />
                  ))}

                  {/* Tarefas recorrentes */}
                  {dayRotinas.map(o => (
                    <TarefaRecorrenteCard
                      key={o.id}
                      ocorrencia={o}
                      onToggle={() => toggleOcorrencia.mutate({ id: o.id, concluida: !o.concluida })}
                    />
                  ))}

                  {/* Empty */}
                  {totalItems === 0 && (
                    <div className="h-12 rounded-lg border border-dashed border-border/30" />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Dialogs ─────────────────────────────────────────────────────────────── */}

      {/* Event detail */}
      <Dialog open={!!selectedEvento} onOpenChange={() => setSelectedEvento(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar size={16} className="text-[#C8DA2D]" />
              {selectedEvento?.title}
            </DialogTitle>
          </DialogHeader>
          {selectedEvento && (
            <div className="space-y-2 py-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock size={14} />
                <span>
                  {fmtHora(new Date(selectedEvento.start))} – {fmtHora(new Date(selectedEvento.end))}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {fmtDate(selectedEvento.start.slice(0, 10))}
              </p>
              {selectedEvento.description && (
                <p className="text-sm text-muted-foreground mt-1">{selectedEvento.description}</p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedEvento(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New event */}
      <Dialog open={criarOpen} onOpenChange={setCriarOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Novo Compromisso</DialogTitle></DialogHeader>
          <div className="space-y-4 py-1">
            <div>
              <Label>Título *</Label>
              <Input value={fTitulo} onChange={e => setFTitulo(e.target.value)}
                placeholder="Ex: Reunião com cliente" className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Data início</Label>
                <Input type="date" value={fDataIni} onChange={e => setFDataIni(e.target.value)} className="mt-1" />
              </div>
              <div><Label>Hora início</Label>
                <Input type="time" value={fHoraIni} onChange={e => setFHoraIni(e.target.value)} className="mt-1" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Data fim</Label>
                <Input type="date" value={fDataFim} onChange={e => setFDataFim(e.target.value)} className="mt-1" />
              </div>
              <div><Label>Hora fim</Label>
                <Input type="time" value={fHoraFim} onChange={e => setFHoraFim(e.target.value)} className="mt-1" />
              </div>
            </div>
            <div>
              <Label>Descrição / Link</Label>
              <Textarea value={fDesc} onChange={e => setFDesc(e.target.value)} rows={2} className="mt-1" />
            </div>
            <div>
              <Label>Convidados (e-mails, separados por vírgula)</Label>
              <Input value={fGuests} onChange={e => setFGuests(e.target.value)}
                placeholder="email@exemplo.com, ..." className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCriarOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => createEvento.mutate({
                title: fTitulo, start: `${fDataIni}T${fHoraIni}:00`,
                end: `${fDataFim}T${fHoraFim}:00`,
                description: fDesc || undefined, guests: fGuests || undefined,
              })}
              disabled={!fTitulo.trim() || createEvento.isPending}
              className="bg-[#C8DA2D] text-[#0C1923] hover:bg-[#d4e640]">
              {createEvento.isPending ? "Sincronizando..." : "Sincronizar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Task edit dialog */}
      <Dialog open={!!editingTarefa} onOpenChange={(o) => { if (!o) setEditingTarefa(null); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Tarefa</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div>
              <Label>Título *</Label>
              <Input value={tForm.titulo} onChange={e => setTForm(f => ({ ...f, titulo: e.target.value }))}
                placeholder="Título da tarefa..." className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Categoria</Label>
                <Select value={tForm.categoria}
                  onValueChange={v => setTForm(f => ({ ...f, categoria: v, frente_id: "" }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {categorias.map(c => (
                      <SelectItem key={c.id} value={c.nome}>{c.emoji} {c.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Prioridade</Label>
                <Select value={tForm.prioridade} onValueChange={v => setTForm(f => ({ ...f, prioridade: v as Prioridade }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRIORIDADES.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Status</Label>
                <Select value={tForm.status} onValueChange={v => setTForm(f => ({ ...f, status: v as TarefaStatus }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Projeto</Label>
                <Select value={tForm.frente_id || "none"}
                  onValueChange={v => setTForm(f => ({ ...f, frente_id: v === "none" ? "" : v }))}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Sem projeto" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem projeto</SelectItem>
                    {frentes
                      .filter(fr => fr.categoria === tForm.categoria)
                      .map(fr => <SelectItem key={fr.id} value={fr.id}>{fr.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Data limite</Label>
              <Input type="date" value={tForm.data_limite}
                onChange={e => setTForm(f => ({ ...f, data_limite: e.target.value }))} className="mt-1" />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea value={tForm.descricao}
                onChange={e => setTForm(f => ({ ...f, descricao: e.target.value }))} rows={3} className="mt-1" />
            </div>
            <div>
              <Label>Observações</Label>
              <Textarea value={tForm.observacao}
                onChange={e => setTForm(f => ({ ...f, observacao: e.target.value }))} rows={2} className="mt-1" />
            </div>

            {/* Actions */}
            <div className="pt-2 border-t border-border flex items-center justify-between">
              <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-600 hover:bg-red-50"
                onClick={() => editingTarefa && deleteTarefa.mutate(editingTarefa.id)}>
                <Trash2 size={14} className="mr-1" /> Excluir
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" size="sm"
                  onClick={() => editingTarefa && updateTarefa.mutate({
                    id: editingTarefa.id, d: { arquivado: true, tipo_arquivo: "engavetada" }
                  })}>
                  <Clock size={13} className="mr-1" /> Engavetar
                </Button>
                <Button variant="outline" size="sm"
                  onClick={() => editingTarefa && updateTarefa.mutate({
                    id: editingTarefa.id, d: { arquivado: true, tipo_arquivo: "arquivo" }
                  })}>
                  <Archive size={13} className="mr-1" /> Arquivar
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingTarefa(null)}>Cancelar</Button>
            <Button
              onClick={handleSaveTarefa}
              disabled={!tForm.titulo.trim() || updateTarefa.isPending}
              className="bg-[#C8DA2D] text-[#0C1923] hover:bg-[#d4e640]">
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}

// ── Card sub-components ────────────────────────────────────────────────────────

function EventoCard({ evento, onClick }: { evento: EventoAgenda; onClick: () => void }) {
  let timeLabel = "";
  let endLabel  = "";
  try {
    const s = new Date(evento.start);
    const e = new Date(evento.end);
    timeLabel = `${String(s.getHours()).padStart(2,"0")}:${String(s.getMinutes()).padStart(2,"0")}`;
    endLabel  = `${String(e.getHours()).padStart(2,"0")}:${String(e.getMinutes()).padStart(2,"0")}`;
  } catch {}

  return (
    <div onClick={onClick}
      className="bg-blue-600 border border-blue-700 rounded-lg px-2 py-1.5 cursor-pointer hover:bg-blue-500 transition-colors shadow-sm">
      <p className="text-[10px] text-blue-100/80 tabular-nums leading-none mb-0.5">
        {timeLabel}{endLabel ? ` – ${endLabel}` : ""}
      </p>
      <p className="text-xs font-semibold text-white truncate leading-snug">{evento.title}</p>
    </div>
  );
}

function TarefaCard({ tarefa, onClick }: { tarefa: Tarefa; onClick: () => void }) {
  const overdue = isOverdue(tarefa);
  const cor     = PRIO_COR[tarefa.prioridade] ?? "#94a3b8";

  return (
    <div onClick={onClick} className={cn(
      "bg-card border rounded-lg px-2 py-1.5 cursor-pointer transition-all hover:shadow-sm group",
      overdue ? "border-red-500/50 bg-red-500/5 hover:border-red-500/70" : "border-border hover:border-[#C8DA2D]/60"
    )}>
      {overdue && (
        <p className="text-[9px] font-bold text-red-400 leading-none mb-0.5">⚠ Atrasada</p>
      )}
      <p className="text-xs font-medium truncate leading-snug">{tarefa.titulo}</p>
      <div className="flex gap-1 mt-1 flex-wrap">
        <span className="text-[9px] font-semibold px-1 py-0.5 rounded shrink-0"
          style={{ backgroundColor: cor + "25", color: cor }}>
          {PRIO_LABEL[tarefa.prioridade]}
        </span>
        {tarefa.frente_nome && (
          <span className="text-[9px] px-1 py-0.5 rounded font-medium shrink-0"
            style={{
              backgroundColor: (tarefa.frente_cor ?? "#94a3b8") + "25",
              color: tarefa.frente_cor ?? "#94a3b8",
            }}>
            {tarefa.frente_nome}
          </span>
        )}
        {tarefa.categoria && (
          <span className="text-[9px] px-1 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
            {tarefa.categoria}
          </span>
        )}
      </div>
    </div>
  );
}

function DespesaCard({ despesa }: {
  despesa: { id: string; descricao: string; valor: number; categoria: string; tipo_fluxo: string };
}) {
  return (
    <div className="bg-red-500/8 border border-red-500/20 rounded-lg px-2 py-1.5">
      <div className="flex items-baseline justify-between gap-1 mb-0.5">
        <span className="text-[9px] text-muted-foreground truncate">{despesa.categoria}</span>
        <span className="text-[10px] font-bold text-red-400 shrink-0 tabular-nums">
          <Wallet size={9} className="inline mr-0.5" />
          {fmtBRL(despesa.valor)}
        </span>
      </div>
      <p className="text-xs truncate leading-snug">{despesa.descricao}</p>
      <p className="text-[9px] text-muted-foreground mt-0.5">
        {despesa.tipo_fluxo === "recorrente" ? "Recorrente" : "Pontual"}
      </p>
    </div>
  );
}

function ReceitaCard({ fluxo }: {
  fluxo: { id: string; descricao: string; valor: number; categoria: string; tipo_fluxo: string };
}) {
  return (
    <div className="bg-green-500/8 border border-green-500/20 rounded-lg px-2 py-1.5">
      <div className="flex items-baseline justify-between gap-1 mb-0.5">
        <span className="text-[9px] text-muted-foreground truncate">{fluxo.categoria}</span>
        <span className="text-[10px] font-bold text-green-400 shrink-0 tabular-nums">
          +{fmtBRL(fluxo.valor)}
        </span>
      </div>
      <p className="text-xs truncate leading-snug">{fluxo.descricao}</p>
      <p className="text-[9px] text-muted-foreground mt-0.5">
        {fluxo.tipo_fluxo === "recorrente" ? "Recorrente" : "Pontual"}
      </p>
    </div>
  );
}

function TerceiroCard({ terceiro }: {
  terceiro: { id: string; pessoa: string; descricao: string; valor: number; recebido: boolean };
}) {
  return (
    <div className={cn(
      "border rounded-lg px-2 py-1.5",
      terceiro.recebido
        ? "bg-teal-500/5 border-teal-500/10 opacity-50"
        : "bg-teal-500/8 border-teal-500/20"
    )}>
      <div className="flex items-baseline justify-between gap-1 mb-0.5">
        <span className="text-[9px] text-teal-400 font-semibold truncate">{terceiro.pessoa}</span>
        <span className="text-[10px] font-bold text-teal-400 shrink-0 tabular-nums">
          +{fmtBRL(terceiro.valor)}
        </span>
      </div>
      <p className="text-xs truncate leading-snug">{terceiro.descricao}</p>
      <p className="text-[9px] text-muted-foreground mt-0.5">
        {terceiro.recebido ? "✓ Recebido" : "A receber"}
      </p>
    </div>
  );
}

function FaturaVencCard({ item }: { item: { cartao: string } }) {
  return (
    <div className="bg-purple-500/8 border border-purple-500/20 rounded-lg px-2 py-1.5">
      <p className="text-[9px] text-purple-400 font-semibold leading-none mb-0.5">💳 Fatura vence</p>
      <p className="text-xs font-medium truncate leading-snug">{item.cartao}</p>
    </div>
  );
}

function TarefaRecorrenteCard({ ocorrencia, onToggle }: {
  ocorrencia: TarefaRecorrenteOcorrencia;
  onToggle: () => void;
}) {
  const cor = ({ alta: "#f87171", media: "#fbbf24", baixa: "#60a5fa" } as Record<string, string>)[ocorrencia.prioridade] ?? "#94a3b8";
  return (
    <div className={cn(
      "border rounded-lg px-2 py-1.5 transition-colors",
      ocorrencia.concluida
        ? "bg-green-500/5 border-green-500/15 opacity-60"
        : "bg-indigo-500/8 border-indigo-500/20"
    )}>
      <div className="flex items-center gap-1.5">
        <button
          onClick={onToggle}
          className={cn(
            "w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 transition-all",
            ocorrencia.concluida
              ? "bg-green-500 border-green-500"
              : "border-indigo-400/60 hover:border-green-500"
          )}
        >
          {ocorrencia.concluida && <Check size={8} className="text-white" strokeWidth={3} />}
        </button>
        <p className={cn(
          "text-xs font-medium truncate leading-snug flex-1",
          ocorrencia.concluida && "line-through text-muted-foreground"
        )}>
          {ocorrencia.titulo}
        </p>
      </div>
      {ocorrencia.frente_nome && (
        <p className="text-[9px] mt-0.5 ml-5 truncate"
          style={{ color: ocorrencia.frente_cor ?? "#94a3b8" }}>
          {ocorrencia.frente_nome}
        </p>
      )}
      <p className="text-[9px] text-indigo-400/70 mt-0.5 ml-5">🔁 Rotina</p>
      {ocorrencia.prioridade !== "media" && (
        <span className="inline-block ml-5 text-[8px] font-semibold px-1 py-0.5 rounded mt-0.5"
          style={{ backgroundColor: cor + "25", color: cor }}>
          {ocorrencia.prioridade}
        </span>
      )}
    </div>
  );
}
