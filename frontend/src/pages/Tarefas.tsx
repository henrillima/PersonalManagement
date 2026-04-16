import { useState, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, GripVertical } from "lucide-react";
import { apiFetch } from "@/lib/api";
import type { Tarefa, Frente, TarefaStatus, Prioridade } from "@/types";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// ── Column definitions ────────────────────────────────────────────────────────

const COLUMNS: { id: TarefaStatus; label: string; bg: string }[] = [
  { id: "todo",        label: "A Fazer",      bg: "bg-slate-50 dark:bg-slate-800/50" },
  { id: "in_progress", label: "Em Andamento", bg: "bg-blue-50 dark:bg-blue-950/30"  },
  { id: "done",        label: "Concluído",    bg: "bg-green-50 dark:bg-green-950/30" },
  { id: "blocked",     label: "Bloqueado",    bg: "bg-red-50 dark:bg-red-950/30"   },
];

const PRIORIDADES: { value: Prioridade; label: string; cor: string }[] = [
  { value: "alta",  label: "Alta",  cor: "#f87171" },
  { value: "media", label: "Média", cor: "#fbbf24" },
  { value: "baixa", label: "Baixa", cor: "#60a5fa" },
];

const STATUS_ACTIONS: Record<TarefaStatus, { label: string; next: TarefaStatus }[]> = {
  todo:        [{ label: "Iniciar",  next: "in_progress" }, { label: "Bloquear", next: "blocked" }],
  in_progress: [{ label: "Concluir", next: "done"        }, { label: "Bloquear", next: "blocked" }],
  done:        [{ label: "Reabrir",  next: "todo"        }],
  blocked:     [{ label: "Retomar",  next: "in_progress" }, { label: "Concluir", next: "done"   }],
};

// ── Form ──────────────────────────────────────────────────────────────────────

interface TarefaForm {
  titulo: string;
  descricao: string;
  frente_id: string;
  prioridade: Prioridade;
  status: TarefaStatus;
  data_limite: string;
  observacao: string;
}

const emptyForm = (): TarefaForm => ({
  titulo: "", descricao: "", frente_id: "", prioridade: "media",
  status: "todo", data_limite: "", observacao: "",
});

function tarefaToForm(t: Tarefa): TarefaForm {
  return {
    titulo: t.titulo, descricao: t.descricao ?? "",
    frente_id: t.frente_id ?? "", prioridade: t.prioridade,
    status: t.status, data_limite: t.data_limite ?? "", observacao: t.observacao ?? "",
  };
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Tarefas() {
  const qc = useQueryClient();

  const [frenteFilter, setFrenteFilter] = useState("all");
  const [priorFilter, setPriorFilter]   = useState<Prioridade | "all">("all");

  const [taskOpen, setTaskOpen]   = useState(false);
  const [editing, setEditing]     = useState<Tarefa | null>(null);
  const [form, setForm]           = useState<TarefaForm>(emptyForm());

  const [frenteOpen, setFrenteOpen] = useState(false);
  const [frenteNome, setFrenteNome] = useState("");
  const [frenteCor, setFrenteCor]   = useState("#C8DA2D");

  // Drag-and-drop
  const [dragId, setDragId]     = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<TarefaStatus | null>(null);
  const dragCounters            = useRef<Partial<Record<TarefaStatus, number>>>({});

  // ── Queries ──────────────────────────────────────────────────────────────

  const { data: frentes = [], isLoading: lF } = useQuery<Frente[]>({
    queryKey: ["frentes"],
    queryFn: () => apiFetch("/api/v1/frentes"),
  });

  const { data: tarefas = [], isLoading: lT } = useQuery<Tarefa[]>({
    queryKey: ["tarefas"],
    queryFn: () => apiFetch("/api/v1/tarefas"),
  });

  // ── Mutations ────────────────────────────────────────────────────────────

  const invalidate = () => qc.invalidateQueries({ queryKey: ["tarefas"] });

  const createTarefa = useMutation({
    mutationFn: (d: object) => apiFetch("/api/v1/tarefas", { method: "POST", body: JSON.stringify(d) }),
    onSuccess: () => { invalidate(); setTaskOpen(false); },
  });

  const updateTarefa = useMutation({
    mutationFn: ({ id, d }: { id: string; d: object }) =>
      apiFetch(`/api/v1/tarefas/${id}`, { method: "PATCH", body: JSON.stringify(d) }),
    onSuccess: () => { invalidate(); setTaskOpen(false); },
  });

  const deleteTarefa = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/v1/tarefas/${id}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });

  const createFrente = useMutation({
    mutationFn: (d: object) => apiFetch("/api/v1/frentes", { method: "POST", body: JSON.stringify(d) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["frentes"] });
      setFrenteOpen(false); setFrenteNome(""); setFrenteCor("#C8DA2D");
    },
  });

  // ── Filtered ─────────────────────────────────────────────────────────────

  const visible = useMemo(() => tarefas.filter((t) => {
    if (frenteFilter !== "all" && (t.frente_id ?? "") !== frenteFilter) return false;
    if (priorFilter !== "all" && t.prioridade !== priorFilter) return false;
    return true;
  }), [tarefas, frenteFilter, priorFilter]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  function openCreate() { setEditing(null); setForm(emptyForm()); setTaskOpen(true); }
  function openEdit(t: Tarefa) { setEditing(t); setForm(tarefaToForm(t)); setTaskOpen(true); }

  function handleSave() {
    if (!form.titulo.trim()) return;
    const payload = {
      titulo: form.titulo,
      descricao: form.descricao || undefined,
      frente_id: form.frente_id || undefined,
      prioridade: form.prioridade,
      status: form.status,
      data_limite: form.data_limite || undefined,
      observacao: form.observacao || undefined,
    };
    if (editing) updateTarefa.mutate({ id: editing.id, d: payload });
    else createTarefa.mutate(payload);
  }

  function quickStatus(t: Tarefa, next: TarefaStatus) {
    updateTarefa.mutate({ id: t.id, d: { status: next } });
  }

  function handleDragEnter(colId: TarefaStatus) {
    dragCounters.current[colId] = (dragCounters.current[colId] ?? 0) + 1;
    setDragOver(colId);
  }

  function handleDragLeave(colId: TarefaStatus) {
    dragCounters.current[colId] = (dragCounters.current[colId] ?? 1) - 1;
    if ((dragCounters.current[colId] ?? 0) <= 0) {
      dragCounters.current[colId] = 0;
      setDragOver((prev) => (prev === colId ? null : prev));
    }
  }

  function handleDrop(colId: TarefaStatus) {
    dragCounters.current[colId] = 0;
    setDragOver(null);
    if (!dragId) return;
    const t = tarefas.find((x) => x.id === dragId);
    if (t && t.status !== colId) updateTarefa.mutate({ id: t.id, d: { status: colId } });
    setDragId(null);
  }

  const busy = lF || lT;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Tarefas</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {tarefas.filter((t) => !t.concluida && t.status !== "done").length} pendentes · {frentes.length} frentes
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setFrenteOpen(true)}>
            <Plus size={14} className="mr-1" /> Nova Frente
          </Button>
          <Button
            size="sm"
            onClick={openCreate}
            className="bg-[#C8DA2D] text-[#0C1923] hover:bg-[#d4e640]"
          >
            <Plus size={14} className="mr-1" /> Nova Tarefa
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-1.5 flex-wrap">
        <FilterPill active={frenteFilter === "all"} onClick={() => setFrenteFilter("all")}>
          Todas as frentes
        </FilterPill>
        {frentes.map((f) => (
          <FilterPill
            key={f.id} active={frenteFilter === f.id} color={f.cor}
            onClick={() => setFrenteFilter(frenteFilter === f.id ? "all" : f.id)}
          >
            {f.nome}
          </FilterPill>
        ))}
        <span className="w-px bg-border self-stretch mx-1" />
        <FilterPill active={priorFilter === "all"} onClick={() => setPriorFilter("all")}>
          Todas prioridades
        </FilterPill>
        {PRIORIDADES.map((p) => (
          <FilterPill
            key={p.value} active={priorFilter === p.value} color={p.cor}
            onClick={() => setPriorFilter(priorFilter === p.value ? "all" : p.value)}
          >
            {p.label}
          </FilterPill>
        ))}
      </div>

      {/* Kanban */}
      {busy ? (
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          {COLUMNS.map((col) => (
            <div key={col.id} className="space-y-2">
              <Skeleton className="h-9 rounded-lg" />
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          {COLUMNS.map((col) => {
            const colItems = visible.filter((t) => t.status === col.id);
            const isOver   = dragOver === col.id && dragId !== null;
            return (
              <div
                key={col.id}
                className={cn(
                  "flex flex-col gap-2 min-h-[55vh] rounded-lg p-1 transition-all",
                  isOver && "ring-2 ring-[#C8DA2D] bg-[#C8DA2D]/5"
                )}
                onDragOver={(e) => e.preventDefault()}
                onDragEnter={() => handleDragEnter(col.id)}
                onDragLeave={() => handleDragLeave(col.id)}
                onDrop={() => handleDrop(col.id)}
              >
                <div className={cn("flex items-center justify-between px-3 py-2 rounded-lg shrink-0", col.bg)}>
                  <span className="text-sm font-semibold">{col.label}</span>
                  <span className="text-xs text-muted-foreground bg-background/60 px-1.5 py-0.5 rounded-full font-medium">
                    {colItems.length}
                  </span>
                </div>

                {colItems.map((t) => (
                  <TarefaCard
                    key={t.id}
                    tarefa={t}
                    isDragging={dragId === t.id}
                    onDragStart={() => setDragId(t.id)}
                    onDragEnd={() => { setDragId(null); setDragOver(null); dragCounters.current = {}; }}
                    onEdit={() => openEdit(t)}
                    onDelete={() => deleteTarefa.mutate(t.id)}
                    onStatus={(next) => quickStatus(t, next)}
                  />
                ))}

                {isOver && colItems.length === 0 && (
                  <div className="flex items-center justify-center h-14 rounded-lg border-2 border-dashed border-[#C8DA2D]/50 text-xs text-[#C8DA2D]/70">
                    Soltar aqui
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Task Dialog */}
      <Dialog open={taskOpen} onOpenChange={setTaskOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Tarefa" : "Nova Tarefa"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div>
              <Label>Título *</Label>
              <Input
                value={form.titulo}
                onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))}
                placeholder="Descreva a tarefa..."
                className="mt-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Prioridade</Label>
                <Select
                  value={form.prioridade}
                  onValueChange={(v) => setForm((f) => ({ ...f, prioridade: v as Prioridade }))}
                >
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRIORIDADES.map((p) => (
                      <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) => setForm((f) => ({ ...f, status: v as TarefaStatus }))}
                >
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todo">A Fazer</SelectItem>
                    <SelectItem value="in_progress">Em Andamento</SelectItem>
                    <SelectItem value="done">Concluído</SelectItem>
                    <SelectItem value="blocked">Bloqueado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Frente</Label>
                <Select
                  value={form.frente_id || "none"}
                  onValueChange={(v) => setForm((f) => ({ ...f, frente_id: v === "none" ? "" : v }))}
                >
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Sem frente" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem frente</SelectItem>
                    {frentes.map((fr) => (
                      <SelectItem key={fr.id} value={fr.id}>{fr.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Data limite</Label>
                <Input
                  type="date"
                  value={form.data_limite}
                  onChange={(e) => setForm((f) => ({ ...f, data_limite: e.target.value }))}
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <Label>Descrição</Label>
              <Textarea
                value={form.descricao}
                onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
                placeholder="Detalhes da tarefa..."
                rows={3}
                className="mt-1"
              />
            </div>

            <div>
              <Label>Observações</Label>
              <Textarea
                value={form.observacao}
                onChange={(e) => setForm((f) => ({ ...f, observacao: e.target.value }))}
                placeholder="Notas adicionais..."
                rows={2}
                className="mt-1"
              />
            </div>

            {editing && (
              <div className="pt-2 border-t">
                <Button
                  variant="ghost" size="sm"
                  className="text-red-500 hover:text-red-600 hover:bg-red-50"
                  onClick={() => { deleteTarefa.mutate(editing.id); setTaskOpen(false); }}
                >
                  <Trash2 size={14} className="mr-1" /> Excluir tarefa
                </Button>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTaskOpen(false)}>Cancelar</Button>
            <Button
              onClick={handleSave}
              disabled={!form.titulo.trim() || createTarefa.isPending || updateTarefa.isPending}
              className="bg-[#C8DA2D] text-[#0C1923] hover:bg-[#d4e640]"
            >
              {editing ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Frente Dialog */}
      <Dialog open={frenteOpen} onOpenChange={setFrenteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Nova Frente</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Nome</Label>
              <Input
                value={frenteNome}
                onChange={(e) => setFrenteNome(e.target.value)}
                placeholder="Ex: Pessoal, Estudos, ITA..."
                className="mt-1"
              />
            </div>
            <div>
              <Label>Cor</Label>
              <div className="flex items-center gap-3 mt-1">
                <input
                  type="color"
                  value={frenteCor}
                  onChange={(e) => setFrenteCor(e.target.value)}
                  className="w-10 h-10 rounded-md border cursor-pointer"
                />
                <span className="text-sm text-muted-foreground font-mono">{frenteCor}</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFrenteOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => createFrente.mutate({ nome: frenteNome, cor: frenteCor })}
              disabled={!frenteNome.trim() || createFrente.isPending}
              className="bg-[#C8DA2D] text-[#0C1923] hover:bg-[#d4e640]"
            >
              Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── FilterPill ────────────────────────────────────────────────────────────────

function FilterPill({ active, color, onClick, children }: {
  active: boolean; color?: string; onClick: () => void; children: React.ReactNode;
}) {
  const style = active && color ? { backgroundColor: color + "30", color, borderColor: color } : undefined;
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
        active && !color
          ? "bg-[#0C1923] text-white border-[#0C1923]"
          : "bg-background border-border hover:border-foreground/40"
      )}
      style={style}
    >
      {children}
    </button>
  );
}

// ── TarefaCard ────────────────────────────────────────────────────────────────

function TarefaCard({ tarefa, isDragging, onDragStart, onDragEnd, onEdit, onDelete, onStatus }: {
  tarefa: Tarefa;
  isDragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onStatus: (next: TarefaStatus) => void;
}) {
  const prioridade = PRIORIDADES.find((p) => p.value === tarefa.prioridade);

  return (
    <div
      draggable
      onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; onDragStart(); }}
      onDragEnd={onDragEnd}
      onClick={onEdit}
      className={cn(
        "bg-card border rounded-xl p-3 cursor-grab active:cursor-grabbing group",
        "hover:border-[#C8DA2D]/60 hover:shadow-sm transition-all select-none",
        isDragging && "opacity-40 scale-95"
      )}
    >
      <div className="flex items-start gap-1.5">
        <GripVertical size={12} className="text-muted-foreground/40 mt-0.5 shrink-0 group-hover:text-muted-foreground/70" />
        <div className="flex-1 min-w-0">
          {/* Badges */}
          <div className="flex flex-wrap gap-1 mb-1.5">
            {prioridade && (
              <span
                className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                style={{ backgroundColor: prioridade.cor + "25", color: prioridade.cor }}
              >
                {prioridade.label}
              </span>
            )}
            {tarefa.frente_nome && (
              <span
                className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                style={{
                  backgroundColor: (tarefa.frente_cor ?? "#94a3b8") + "25",
                  color: tarefa.frente_cor ?? "#94a3b8",
                }}
              >
                {tarefa.frente_nome}
              </span>
            )}
          </div>

          <p className="text-sm font-medium leading-snug">{tarefa.titulo}</p>

          {tarefa.data_limite && (
            <p className="text-[10px] text-muted-foreground mt-1">
              📅 {new Date(tarefa.data_limite + "T00:00:00").toLocaleDateString("pt-BR")}
            </p>
          )}

          <div className="flex items-center justify-between mt-2" onClick={(e) => e.stopPropagation()}>
            <div className="flex gap-1 flex-wrap">
              {STATUS_ACTIONS[tarefa.status]?.map(({ label, next }) => (
                <button
                  key={next}
                  onClick={() => onStatus(next)}
                  className="text-[10px] px-2 py-0.5 rounded-full border border-border hover:border-[#C8DA2D] hover:bg-[#C8DA2D]/10 transition-colors"
                >
                  {label}
                </button>
              ))}
            </div>
            <button
              onClick={onDelete}
              className="p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-red-500"
            >
              <Trash2 size={12} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
