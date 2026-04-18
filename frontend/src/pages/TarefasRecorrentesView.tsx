import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Pencil, ChevronLeft, ChevronRight, Check, Settings } from "lucide-react";
import { apiFetch, currentMes, mesLabel } from "@/lib/api";
import type { TarefaRecorrente, TarefaRecorrenteOcorrencia, Frente, CategoriaItem } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

function addMonths(mes: string, delta: number): string {
  const [y, m] = mes.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const DIAS_SEMANA = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const MESES_PT = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const PRIORIDADE_COR: Record<string, string> = { alta: "#f87171", media: "#fbbf24", baixa: "#60a5fa" };

function fmtDataAlvo(data: string) {
  const d = new Date(data + "T00:00:00");
  const dias = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];
  const meses = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  return `${dias[d.getDay()]}, ${d.getDate()} ${meses[d.getMonth()]}`;
}

interface RecForm {
  titulo: string;
  descricao: string;
  frente_id: string;
  categoria: string;
  prioridade: "alta" | "media" | "baixa";
  frequencia: "diaria" | "semanal" | "mensal" | "anual";
  dias_semana: number[];
  dia_mes: string;
  mes: string;
}

const emptyForm = (): RecForm => ({
  titulo: "", descricao: "", frente_id: "", categoria: "",
  prioridade: "media", frequencia: "diaria", dias_semana: [], dia_mes: "", mes: "",
});

export default function TarefasRecorrentesView() {
  const qc = useQueryClient();
  const [mes, setMes] = useState(currentMes());
  const [manageOpen, setManageOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<TarefaRecorrente | null>(null);
  const [form, setForm] = useState<RecForm>(emptyForm());

  const { data: ocorrencias = [], isLoading } = useQuery<TarefaRecorrenteOcorrencia[]>({
    queryKey: ["tarefas-rec-ocorrencias", mes],
    queryFn: () => apiFetch(`/api/v1/tarefas-recorrentes/ocorrencias?mes=${mes}`),
  });

  const { data: templates = [] } = useQuery<TarefaRecorrente[]>({
    queryKey: ["tarefas-recorrentes"],
    queryFn: () => apiFetch("/api/v1/tarefas-recorrentes"),
  });

  const { data: frentes = [] } = useQuery<Frente[]>({
    queryKey: ["frentes"],
    queryFn: () => apiFetch("/api/v1/frentes"),
  });

  const { data: categorias = [] } = useQuery<CategoriaItem[]>({
    queryKey: ["categorias"],
    queryFn: () => apiFetch("/api/v1/categorias"),
  });

  const invalidateOcorrencias = () => qc.invalidateQueries({ queryKey: ["tarefas-rec-ocorrencias", mes] });
  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["tarefas-recorrentes"] });
    invalidateOcorrencias();
  };

  const toggleOcorrencia = useMutation({
    mutationFn: ({ id, concluida }: { id: string; concluida: boolean }) =>
      apiFetch(`/api/v1/tarefas-recorrentes/ocorrencias/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ concluida }),
      }),
    onMutate: async ({ id, concluida }) => {
      await qc.cancelQueries({ queryKey: ["tarefas-rec-ocorrencias", mes] });
      const prev = qc.getQueryData<TarefaRecorrenteOcorrencia[]>(["tarefas-rec-ocorrencias", mes]);
      qc.setQueryData<TarefaRecorrenteOcorrencia[]>(["tarefas-rec-ocorrencias", mes], (old = []) =>
        old.map((o) => o.id === id ? { ...o, concluida } : o)
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["tarefas-rec-ocorrencias", mes], ctx.prev);
    },
    onSettled: invalidateOcorrencias,
  });

  const createTemplate = useMutation({
    mutationFn: (d: object) => apiFetch("/api/v1/tarefas-recorrentes", { method: "POST", body: JSON.stringify(d) }),
    onSuccess: () => { invalidateAll(); setFormOpen(false); },
  });

  const updateTemplate = useMutation({
    mutationFn: ({ id, d }: { id: string; d: object }) =>
      apiFetch(`/api/v1/tarefas-recorrentes/${id}`, { method: "PATCH", body: JSON.stringify(d) }),
    onSuccess: () => { invalidateAll(); setFormOpen(false); },
  });

  const deleteTemplate = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/v1/tarefas-recorrentes/${id}`, { method: "DELETE" }),
    onSuccess: invalidateAll,
  });

  const toggleAtivo = useMutation({
    mutationFn: ({ id, ativo }: { id: string; ativo: boolean }) =>
      apiFetch(`/api/v1/tarefas-recorrentes/${id}`, { method: "PATCH", body: JSON.stringify({ ativo }) }),
    onSuccess: invalidateAll,
  });

  function openCreate() { setEditing(null); setForm(emptyForm()); setFormOpen(true); }

  function openEdit(t: TarefaRecorrente) {
    setEditing(t);
    setForm({
      titulo: t.titulo, descricao: t.descricao ?? "", frente_id: t.frente_id ?? "",
      categoria: t.categoria, prioridade: t.prioridade, frequencia: t.frequencia,
      dias_semana: t.dias_semana ?? [], dia_mes: t.dia_mes ? String(t.dia_mes) : "",
      mes: t.mes ? String(t.mes) : "",
    });
    setFormOpen(true);
  }

  function handleSave() {
    const payload: Record<string, unknown> = {
      titulo: form.titulo,
      categoria: form.categoria || "Geral",
      prioridade: form.prioridade,
      frequencia: form.frequencia,
      frente_id: form.frente_id || undefined,
      descricao: form.descricao || undefined,
    };
    if (form.frequencia === "semanal") payload.dias_semana = form.dias_semana;
    if (form.frequencia === "mensal" || form.frequencia === "anual") {
      const d = parseInt(form.dia_mes);
      if (d) payload.dia_mes = d;
    }
    if (form.frequencia === "anual") {
      const m = parseInt(form.mes);
      if (m) payload.mes = m;
    }
    if (editing) updateTemplate.mutate({ id: editing.id, d: payload });
    else createTemplate.mutate(payload);
  }

  const grouped = useMemo(() => {
    const g: Record<string, TarefaRecorrenteOcorrencia[]> = {};
    for (const o of ocorrencias) {
      if (!g[o.data_alvo]) g[o.data_alvo] = [];
      g[o.data_alvo].push(o);
    }
    return g;
  }, [ocorrencias]);

  const sortedDates = Object.keys(grouped).sort();
  const total = ocorrencias.length;
  const concluidas = ocorrencias.filter((o) => o.concluida).length;

  function freqLabel(t: TarefaRecorrente) {
    if (t.frequencia === "diaria") return "Diária";
    if (t.frequencia === "semanal") {
      const dias = (t.dias_semana ?? []).map((d) => DIAS_SEMANA[d]).join(", ");
      return `Semanal: ${dias || "—"}`;
    }
    if (t.frequencia === "mensal") return `Mensal: dia ${t.dia_mes ?? "—"}`;
    if (t.frequencia === "anual") return `Anual: ${t.dia_mes}/${t.mes}`;
    return t.frequencia;
  }

  if (isLoading) return <Skeleton className="h-64 rounded-xl" />;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={() => setMes(addMonths(mes, -1))} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
          <ChevronLeft size={16} />
        </button>
        <span className="text-sm font-semibold w-20 text-center">{mesLabel(mes)}</span>
        <button onClick={() => setMes(addMonths(mes, 1))} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
          <ChevronRight size={16} />
        </button>

        {total > 0 && (
          <span className="text-sm text-muted-foreground">
            <span className={cn("font-semibold", concluidas === total ? "text-green-400" : "text-foreground")}>
              {concluidas}
            </span>/{total} concluídas
          </span>
        )}

        <div className="flex-1" />
        <Button variant="outline" size="sm" onClick={() => setManageOpen(true)}>
          <Settings size={14} className="mr-1" /> Gerenciar Regras
        </Button>
      </div>

      {/* Progress bar */}
      {total > 0 && (
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-green-500 rounded-full transition-all"
            style={{ width: `${(concluidas / total) * 100}%` }}
          />
        </div>
      )}

      {/* Occurrences grouped by day */}
      {sortedDates.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-10 text-center text-muted-foreground text-sm">
          <p>Nenhuma rotina ativa em {mesLabel(mes)}.</p>
          <p className="text-xs mt-1">Crie regras clicando em "Gerenciar Regras".</p>
        </div>
      ) : (
        <div className="space-y-4">
          {sortedDates.map((data) => (
            <div key={data}>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                {fmtDataAlvo(data)}
              </p>
              <div className="space-y-1.5">
                {grouped[data].map((o) => (
                  <div
                    key={o.id}
                    className={cn(
                      "flex items-center gap-3 bg-card border rounded-lg px-4 py-2.5 transition-colors",
                      o.concluida ? "border-green-500/20 bg-green-500/5" : "border-border"
                    )}
                  >
                    <button
                      onClick={() => toggleOcorrencia.mutate({ id: o.id, concluida: !o.concluida })}
                      className={cn(
                        "w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all",
                        o.concluida
                          ? "bg-green-500 border-green-500"
                          : "border-muted-foreground/30 hover:border-green-500"
                      )}
                    >
                      {o.concluida && <Check size={10} className="text-white" strokeWidth={3} />}
                    </button>

                    <p className={cn("text-sm font-medium flex-1 truncate", o.concluida && "line-through text-muted-foreground")}>
                      {o.titulo}
                    </p>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {o.frente_nome && (
                        <span
                          className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                          style={{ backgroundColor: (o.frente_cor ?? "#94a3b8") + "25", color: o.frente_cor ?? "#94a3b8" }}
                        >
                          {o.frente_nome}
                        </span>
                      )}
                      <span
                        className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                        style={{
                          backgroundColor: (PRIORIDADE_COR[o.prioridade] ?? "#94a3b8") + "25",
                          color: PRIORIDADE_COR[o.prioridade] ?? "#94a3b8",
                        }}
                      >
                        {o.prioridade}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Manage Rules Dialog */}
      <Dialog open={manageOpen} onOpenChange={setManageOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Gerenciar Regras Recorrentes</DialogTitle></DialogHeader>
          <div className="space-y-1.5 max-h-96 overflow-y-auto py-2 pr-1">
            {templates.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Nenhuma regra criada ainda.</p>
            ) : (
              templates.map((t) => (
                <div
                  key={t.id}
                  className={cn(
                    "flex items-center gap-3 border rounded-lg px-3 py-2.5 transition-opacity",
                    !t.ativo && "opacity-50"
                  )}
                >
                  <button
                    onClick={() => toggleAtivo.mutate({ id: t.id, ativo: !t.ativo })}
                    className={cn(
                      "w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all",
                      t.ativo ? "bg-[#C8DA2D] border-[#C8DA2D]" : "border-muted-foreground/40"
                    )}
                  >
                    {t.ativo && <Check size={10} className="text-[#0C1923]" strokeWidth={3} />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{t.titulo}</p>
                    <p className="text-xs text-muted-foreground">{freqLabel(t)} · {t.categoria}</p>
                  </div>
                  <button
                    onClick={() => { openEdit(t); setManageOpen(false); }}
                    className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    onClick={() => deleteTemplate.mutate(t.id)}
                    className="p-1 text-muted-foreground hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))
            )}
          </div>
          <DialogFooter>
            <Button
              onClick={() => { setManageOpen(false); openCreate(); }}
              className="bg-[#C8DA2D] text-[#0C1923] hover:bg-[#d4e640]"
            >
              <Plus size={14} className="mr-1" /> Nova Regra
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create / Edit Template Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Regra" : "Nova Regra Recorrente"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Título</Label>
              <Input
                value={form.titulo}
                onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))}
                placeholder="Ex: Exercício matinal, Meditação..."
                className="mt-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Projeto (opcional)</Label>
                <Select
                  value={form.frente_id || "__none__"}
                  onValueChange={(v) => setForm((f) => ({ ...f, frente_id: v === "__none__" ? "" : v }))}
                >
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Nenhum" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Nenhum</SelectItem>
                    {frentes.map((fr) => <SelectItem key={fr.id} value={fr.id}>{fr.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Prioridade</Label>
                <Select value={form.prioridade} onValueChange={(v) => setForm((f) => ({ ...f, prioridade: v as "alta" | "media" | "baixa" }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="alta">Alta</SelectItem>
                    <SelectItem value="media">Média</SelectItem>
                    <SelectItem value="baixa">Baixa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Categoria</Label>
              <Select value={form.categoria} onValueChange={(v) => setForm((f) => ({ ...f, categoria: v }))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {categorias.map((c) => (
                    <SelectItem key={c.id} value={c.nome}>{c.emoji} {c.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Frequência</Label>
              <Select
                value={form.frequencia}
                onValueChange={(v) => setForm((f) => ({ ...f, frequencia: v as RecForm["frequencia"], dias_semana: [] }))}
              >
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="diaria">Diária</SelectItem>
                  <SelectItem value="semanal">Semanal</SelectItem>
                  <SelectItem value="mensal">Mensal</SelectItem>
                  <SelectItem value="anual">Anual</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {form.frequencia === "semanal" && (
              <div>
                <Label>Dias da semana</Label>
                <div className="flex gap-1.5 mt-1 flex-wrap">
                  {DIAS_SEMANA.map((d, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          dias_semana: f.dias_semana.includes(i)
                            ? f.dias_semana.filter((x) => x !== i)
                            : [...f.dias_semana, i],
                        }))
                      }
                      className={cn(
                        "px-2.5 py-1 text-xs rounded-full border transition-colors",
                        form.dias_semana.includes(i)
                          ? "bg-[#C8DA2D] text-[#0C1923] border-[#C8DA2D] font-semibold"
                          : "border-border text-muted-foreground hover:border-foreground"
                      )}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {(form.frequencia === "mensal" || form.frequencia === "anual") && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Dia do mês</Label>
                  <Input
                    type="number"
                    min={1}
                    max={31}
                    value={form.dia_mes}
                    onChange={(e) => setForm((f) => ({ ...f, dia_mes: e.target.value }))}
                    className="mt-1"
                  />
                </div>
                {form.frequencia === "anual" && (
                  <div>
                    <Label>Mês</Label>
                    <Select value={form.mes} onValueChange={(v) => setForm((f) => ({ ...f, mes: v }))}>
                      <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        {MESES_PT.map((m, i) => (
                          <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>Cancelar</Button>
            <Button
              onClick={handleSave}
              disabled={!form.titulo.trim() || createTemplate.isPending || updateTemplate.isPending}
              className="bg-[#C8DA2D] text-[#0C1923] hover:bg-[#d4e640]"
            >
              {editing ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
