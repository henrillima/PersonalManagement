import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  DndContext, DragOverlay, closestCenter,
  PointerSensor, useSensor, useSensors, useDroppable,
  type DragStartEvent, type DragOverEvent, type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, useSortable, verticalListSortingStrategy, arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Plus, Trash2, GripVertical, Clock, Archive, RotateCcw,
  Settings, ChevronDown, ChevronRight, Pencil, Check, X,
} from "lucide-react";
import { apiFetch, fmtDate } from "@/lib/api";
import type { Tarefa, Frente, TarefaStatus, Prioridade, CategoriaItem, TarefaRecorrenteOcorrencia } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import TarefasRecorrentesView from "@/pages/TarefasRecorrentesView";

// ── Constants ──────────────────────────────────────────────────────────────────

const TODAY = new Date().toISOString().slice(0, 10);
const MES_ATUAL = new Date().toISOString().slice(0, 7);

const COLUMNS: { id: TarefaStatus; label: string; bg: string }[] = [
  { id: "todo",        label: "A Fazer",      bg: "bg-slate-50 dark:bg-slate-800/50" },
  { id: "in_progress", label: "Em Andamento", bg: "bg-blue-50 dark:bg-blue-950/30"  },
  { id: "done",        label: "Concluído",    bg: "bg-green-50 dark:bg-green-950/30" },
  { id: "blocked",     label: "Bloqueado",    bg: "bg-red-50 dark:bg-red-950/30"    },
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

function isOverdue(t: Tarefa) {
  return t.status !== "done" && !!t.data_limite && t.data_limite < TODAY;
}

// ── Form ───────────────────────────────────────────────────────────────────────

interface TarefaForm {
  titulo: string; descricao: string; frente_id: string;
  categoria: string; prioridade: Prioridade;
  status: TarefaStatus; data_limite: string; observacao: string;
}

const emptyForm = (cat = ""): TarefaForm => ({
  titulo: "", descricao: "", frente_id: "", categoria: cat,
  prioridade: "media", status: "todo", data_limite: "", observacao: "",
});

function tarefaToForm(t: Tarefa): TarefaForm {
  return {
    titulo: t.titulo, descricao: t.descricao ?? "",
    frente_id: t.frente_id ?? "", categoria: t.categoria ?? "",
    prioridade: t.prioridade, status: t.status,
    data_limite: t.data_limite ?? "", observacao: t.observacao ?? "",
  };
}

// ── Main ───────────────────────────────────────────────────────────────────────

export default function Tarefas() {
  const qc = useQueryClient();

  const [catTab, setCatTab]             = useState("");
  const [frenteFilter, setFrenteFilter] = useState("all");
  const [priorFilter, setPriorFilter]   = useState<Prioridade | "all">("all");
  const [taskOpen, setTaskOpen]         = useState(false);
  const [editing, setEditing]           = useState<Tarefa | null>(null);
  const [form, setForm]                 = useState<TarefaForm>(emptyForm());
  const [projetoOpen, setProjetoOpen]   = useState(false);
  const [projetoNome, setProjetoNome]   = useState("");
  const [projetoCor, setProjetoCor]     = useState("#C8DA2D");
  const [projetoCat, setProjetoCat]     = useState("");
  const [catDialogOpen, setCatDialogOpen] = useState(false);
  const [catNome, setCatNome]           = useState("");
  const [catEmoji, setCatEmoji]         = useState("📁");
  const [catCor, setCatCor]             = useState("#94a3b8");
  const [localTasks, setLocalTasks]     = useState<Tarefa[]>([]);
  const [activeTask, setActiveTask]     = useState<Tarefa | null>(null);
  const [manageOpen, setManageOpen]     = useState(false);
  const [recOpenCreate, setRecOpenCreate] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data: categorias = [], isLoading: lC } = useQuery<CategoriaItem[]>({
    queryKey: ["categorias"],
    queryFn: () => apiFetch("/api/v1/categorias"),
  });

  const { data: frentes = [], isLoading: lF } = useQuery<Frente[]>({
    queryKey: ["frentes"],
    queryFn: () => apiFetch("/api/v1/frentes"),
  });

  const { data: tarefas = [], isLoading: lT } = useQuery<Tarefa[]>({
    queryKey: ["tarefas"],
    queryFn: () => apiFetch("/api/v1/tarefas"),
  });

  const { data: arquivadas = [] } = useQuery<Tarefa[]>({
    queryKey: ["tarefas-arquivo"],
    queryFn: () => apiFetch("/api/v1/tarefas?arquivado=true"),
    enabled: catTab === "arquivo",
  });

  const { data: ocorrencias = [] } = useQuery<TarefaRecorrenteOcorrencia[]>({
    queryKey: ["ocorrencias-mes", MES_ATUAL],
    queryFn: () => apiFetch(`/api/v1/tarefas-recorrentes/ocorrencias?mes=${MES_ATUAL}`),
    enabled: catTab !== "arquivo" && catTab !== "recorrentes",
  });

  // Set default tab when categories load
  useEffect(() => {
    if (categorias.length > 0 && !catTab) {
      setCatTab(categorias[0].nome);
      setProjetoCat(categorias[0].nome);
    }
  }, [categorias]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { setLocalTasks(tarefas); }, [tarefas]);

  useEffect(() => {
    setFrenteFilter("all");
    if (catTab && catTab !== "arquivo" && catTab !== "recorrentes") setProjetoCat(catTab);
  }, [catTab]);

  // ── Mutations ──────────────────────────────────────────────────────────────
  const invalidateTarefas = () => {
    qc.invalidateQueries({ queryKey: ["tarefas"] });
    qc.invalidateQueries({ queryKey: ["tarefas-arquivo"] });
  };
  const invalidateFrente = () => qc.invalidateQueries({ queryKey: ["frentes"] });
  const invalidateCat    = () => qc.invalidateQueries({ queryKey: ["categorias"] });

  const createTarefa = useMutation({
    mutationFn: (d: object) => apiFetch("/api/v1/tarefas", { method: "POST", body: JSON.stringify(d) }),
    onSuccess: () => { invalidateTarefas(); setTaskOpen(false); },
  });

  const updateTarefa = useMutation({
    mutationFn: ({ id, d }: { id: string; d: object }) =>
      apiFetch(`/api/v1/tarefas/${id}`, { method: "PATCH", body: JSON.stringify(d) }),
    onSuccess: invalidateTarefas,
  });

  const deleteTarefa = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/v1/tarefas/${id}`, { method: "DELETE" }),
    onSuccess: invalidateTarefas,
  });

  const restaurarMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/v1/tarefas/${id}/restaurar`, { method: "POST" }),
    onSuccess: invalidateTarefas,
  });

  const reorderMutation = useMutation({
    mutationFn: (ids: string[]) =>
      apiFetch("/api/v1/tarefas/reorder", { method: "POST", body: JSON.stringify({ ids }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tarefas"] }),
  });

  const toggleOcorrencia = useMutation({
    mutationFn: ({ id, concluida }: { id: string; concluida: boolean }) =>
      apiFetch(`/api/v1/tarefas-recorrentes/ocorrencias/${id}`, { method: "PATCH", body: JSON.stringify({ concluida }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ocorrencias-mes", MES_ATUAL] }),
  });

  const createProjeto = useMutation({
    mutationFn: (d: object) => apiFetch("/api/v1/frentes", { method: "POST", body: JSON.stringify(d) }),
    onSuccess: () => { invalidateFrente(); setProjetoOpen(false); setProjetoNome(""); setProjetoCor("#C8DA2D"); },
  });

  const updateProjeto = useMutation({
    mutationFn: ({ id, d }: { id: string; d: object }) =>
      apiFetch(`/api/v1/frentes/${id}`, { method: "PATCH", body: JSON.stringify(d) }),
    onSuccess: () => { invalidateFrente(); invalidateTarefas(); },
  });

  const deleteProjeto = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/v1/frentes/${id}`, { method: "DELETE" }),
    onSuccess: () => { invalidateFrente(); invalidateTarefas(); },
  });

  const createCategoria = useMutation({
    mutationFn: (d: object) => apiFetch("/api/v1/categorias", { method: "POST", body: JSON.stringify(d) }),
    onSuccess: () => { invalidateCat(); setCatDialogOpen(false); setCatNome(""); setCatEmoji("📁"); setCatCor("#94a3b8"); },
  });

  const updateCategoria = useMutation({
    mutationFn: ({ id, d }: { id: string; d: object }) =>
      apiFetch(`/api/v1/categorias/${id}`, { method: "PATCH", body: JSON.stringify(d) }),
    onSuccess: invalidateCat,
  });

  const deleteCategoria = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/v1/categorias/${id}`, { method: "DELETE" }),
    onSuccess: invalidateCat,
  });

  // ── Computed ───────────────────────────────────────────────────────────────
  const projetosForTab = useMemo(
    () => (catTab === "arquivo" || catTab === "todas") ? frentes : frentes.filter(f => f.categoria === catTab),
    [frentes, catTab]
  );

  const catTasks = useMemo(
    () => catTab === "todas"
      ? localTasks.filter(t => !t.arquivado)
      : localTasks.filter(t => !t.arquivado && t.categoria === catTab),
    [localTasks, catTab]
  );

  const visible = useMemo(() => catTasks.filter(t => {
    if (frenteFilter !== "all" && (t.frente_id ?? "") !== frenteFilter) return false;
    if (priorFilter  !== "all" && t.prioridade !== priorFilter) return false;
    return true;
  }), [catTasks, frenteFilter, priorFilter]);

  const visibleOcorrencias = useMemo(() => {
    if (catTab === "arquivo" || catTab === "recorrentes") return [];
    return ocorrencias.filter(oc =>
      (catTab === "todas" || oc.categoria === catTab) &&
      (priorFilter === "all" || oc.prioridade === priorFilter)
    );
  }, [ocorrencias, catTab, priorFilter]);

  const getColAll = (s: TarefaStatus) =>
    catTasks.filter(t => t.status === s).sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));

  const getColVisible = (s: TarefaStatus) =>
    visible.filter(t => t.status === s).sort((a, b) => {
      const aO = isOverdue(a);
      const bO = isOverdue(b);
      if (aO && !bO) return -1;
      if (!aO && bO) return 1;
      return (a.ordem ?? 0) - (b.ordem ?? 0);
    });

  // ── DnD handlers ───────────────────────────────────────────────────────────
  function handleDragStart({ active }: DragStartEvent) {
    setActiveTask(localTasks.find(t => t.id === active.id) ?? null);
  }

  function handleDragOver({ active, over }: DragOverEvent) {
    if (!over || active.id === over.id) return;
    const drag = localTasks.find(t => t.id === active.id);
    if (!drag) return;
    const isCol = COLUMNS.some(c => c.id === over.id);
    const overCard = !isCol ? localTasks.find(t => t.id === over.id) : null;
    const newStatus = (isCol ? over.id : overCard?.status) as TarefaStatus | undefined;
    if (newStatus && drag.status !== newStatus) {
      setLocalTasks(prev => prev.map(t => t.id === drag.id ? { ...t, status: newStatus } : t));
    }
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveTask(null);
    if (!over || active.id === over.id) { setLocalTasks(tarefas); return; }

    const activeId = active.id as string;
    const overId   = over.id as string;
    const drag     = localTasks.find(t => t.id === activeId);
    const orig     = tarefas.find(t => t.id === activeId);
    if (!drag || !orig) { setLocalTasks(tarefas); return; }

    const isOverCol   = COLUMNS.some(c => c.id === overId);
    const overCard    = !isOverCol ? localTasks.find(t => t.id === overId) : null;
    const finalStatus = drag.status;
    const crossCol    = orig.status !== finalStatus;

    if (!crossCol && !isOverCol && overCard && activeId !== overId) {
      const col    = getColVisible(finalStatus);
      const oldIdx = col.findIndex(t => t.id === activeId);
      const newIdx = col.findIndex(t => t.id === overId);
      if (oldIdx !== -1 && newIdx !== -1 && oldIdx !== newIdx) {
        const reordered = arrayMove(col, oldIdx, newIdx);
        const ordemMap  = Object.fromEntries(reordered.map((t, i) => [t.id, i]));
        setLocalTasks(prev => prev.map(t =>
          ordemMap[t.id] !== undefined ? { ...t, ordem: ordemMap[t.id] } : t
        ));
        reorderMutation.mutate(reordered.map(t => t.id));
        return;
      }
    }

    if (crossCol) {
      const targetLen = tarefas.filter(t =>
        t.status === finalStatus && !t.arquivado && t.categoria === drag.categoria
      ).length;
      updateTarefa.mutate({ id: activeId, d: { status: finalStatus, ordem: targetLen } });
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  function openCreate() {
    const cat = (catTab === "arquivo" || catTab === "todas") ? (categorias[0]?.nome ?? "") : catTab;
    setEditing(null); setForm(emptyForm(cat)); setTaskOpen(true);
  }
  function openEdit(t: Tarefa) { setEditing(t); setForm(tarefaToForm(t)); setTaskOpen(true); }

  function openNovoProjeto(cat?: string) {
    const c = cat ?? ((catTab === "arquivo" || catTab === "todas") ? (categorias[0]?.nome ?? "") : catTab);
    setProjetoCat(c); setProjetoNome(""); setProjetoCor("#C8DA2D"); setProjetoOpen(true);
  }

  function handleSave() {
    if (!form.titulo.trim()) return;
    const payload = {
      titulo: form.titulo, descricao: form.descricao || undefined,
      frente_id: form.frente_id || undefined, categoria: form.categoria,
      prioridade: form.prioridade, status: form.status,
      data_limite: form.data_limite || undefined, observacao: form.observacao || undefined,
    };
    if (editing) {
      updateTarefa.mutate({ id: editing.id, d: payload }, { onSuccess: () => setTaskOpen(false) });
    } else {
      createTarefa.mutate(payload);
    }
  }

  const engavetar = (t: Tarefa) => updateTarefa.mutate({ id: t.id, d: { arquivado: true, tipo_arquivo: "engavetada" } });
  const arquivar  = (t: Tarefa) => updateTarefa.mutate({ id: t.id, d: { arquivado: true, tipo_arquivo: "arquivo"     } });

  const totalAtivas = localTasks.filter(t => !t.arquivado && t.status !== "done").length;
  const totalAtrasadas = localTasks.filter(t => !t.arquivado && isOverdue(t)).length;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Tarefas</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {totalAtivas} pendentes
            {totalAtrasadas > 0 && (
              <span className="text-red-400 ml-1">· {totalAtrasadas} atrasada{totalAtrasadas !== 1 ? "s" : ""}</span>
            )}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => openNovoProjeto()}>
            <Plus size={14} className="mr-1" /> Novo Projeto
          </Button>
          <Button variant="outline" size="sm" onClick={() => { setCatTab("recorrentes"); setRecOpenCreate(true); }}>
            🔁 Recorrente
          </Button>
          <Button size="sm" onClick={openCreate} className="bg-[#C8DA2D] text-[#0C1923] hover:bg-[#d4e640]">
            <Plus size={14} className="mr-1" /> Nova Tarefa
          </Button>
        </div>
      </div>

      {/* Category tabs */}
      {lC ? (
        <div className="flex gap-2 border-b border-border pb-0">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-9 w-24 rounded" />)}
        </div>
      ) : (
        <div className="flex gap-0 border-b border-border overflow-x-auto">
          <button
            onClick={() => setCatTab("todas")}
            className={cn(
              "px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px whitespace-nowrap shrink-0",
              catTab === "todas"
                ? "border-[#C8DA2D] text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            🗂️ Todas
          </button>
          {categorias.map(cat => (
            <button
              key={cat.nome}
              onClick={() => setCatTab(cat.nome)}
              className={cn(
                "px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px whitespace-nowrap shrink-0",
                catTab === cat.nome
                  ? "border-[#C8DA2D] text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {cat.emoji} {cat.nome}
            </button>
          ))}
          <button
            onClick={() => setCatTab("recorrentes")}
            className={cn(
              "px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px whitespace-nowrap shrink-0",
              catTab === "recorrentes"
                ? "border-[#C8DA2D] text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            🔁 Recorrentes
          </button>
          <button
            onClick={() => setCatTab("arquivo")}
            className={cn(
              "ml-auto px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px whitespace-nowrap shrink-0",
              catTab === "arquivo"
                ? "border-[#C8DA2D] text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            📁 Arquivo{arquivadas.length > 0 ? ` (${arquivadas.length})` : ""}
          </button>
        </div>
      )}

      {catTab === "recorrentes" ? (
        <TarefasRecorrentesView
          openCreateTrigger={recOpenCreate}
          onTriggerHandled={() => setRecOpenCreate(false)}
        />
      ) : catTab === "arquivo" ? (
        <ArquivoView
          arquivadas={arquivadas}
          categorias={categorias}
          onRestaurar={t => restaurarMutation.mutate(t.id)}
          onDelete={id => deleteTarefa.mutate(id)}
        />
      ) : (
        <>
          {/* Filters */}
          <div className="flex gap-1.5 flex-wrap">
            <FilterPill active={frenteFilter === "all"} onClick={() => setFrenteFilter("all")}>Todos os projetos</FilterPill>
            {projetosForTab.map(f => (
              <FilterPill key={f.id} active={frenteFilter === f.id} color={f.cor}
                onClick={() => setFrenteFilter(frenteFilter === f.id ? "all" : f.id)}>
                {f.nome}
              </FilterPill>
            ))}
            <span className="w-px bg-border self-stretch mx-1" />
            <FilterPill active={priorFilter === "all"} onClick={() => setPriorFilter("all")}>Todas prioridades</FilterPill>
            {PRIORIDADES.map(p => (
              <FilterPill key={p.value} active={priorFilter === p.value} color={p.cor}
                onClick={() => setPriorFilter(priorFilter === p.value ? "all" : p.value)}>
                {p.label}
              </FilterPill>
            ))}
          </div>

          {/* Kanban */}
          {(lF || lT) ? (
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
              {COLUMNS.map(col => (
                <div key={col.id} className="space-y-2">
                  <Skeleton className="h-9 rounded-lg" />
                  {[0, 1, 2].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
                </div>
              ))}
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragEnd={handleDragEnd}
            >
              <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
                {COLUMNS.map(col => {
                  const items = getColVisible(col.id);
                  return (
                    <DroppableColumn key={col.id} id={col.id} className="flex flex-col gap-2 min-h-[55vh] rounded-lg p-1">
                      <div className={cn("flex items-center justify-between px-3 py-2 rounded-lg shrink-0", col.bg)}>
                        <span className="text-sm font-semibold">{col.label}</span>
                        <span className="text-xs text-muted-foreground bg-background/60 px-1.5 py-0.5 rounded-full font-medium">
                          {getColAll(col.id).length}
                        </span>
                      </div>
                      <SortableContext items={items.map(t => t.id)} strategy={verticalListSortingStrategy}>
                        {items.map(t => (
                          <SortableCard
                            key={t.id} tarefa={t}
                            isDragging={activeTask?.id === t.id}
                            overdue={isOverdue(t)}
                            showCategoria={catTab === "todas"}
                            onEdit={() => openEdit(t)}
                            onDelete={() => deleteTarefa.mutate(t.id)}
                            onStatus={next => updateTarefa.mutate({ id: t.id, d: { status: next } })}
                            onEngage={() => engavetar(t)}
                            onArchive={() => arquivar(t)}
                          />
                        ))}
                      </SortableContext>
                      {(col.id === "todo" || col.id === "done") && visibleOcorrencias
                        .filter(oc => col.id === "todo" ? !oc.concluida : oc.concluida)
                        .map(oc => (
                          <RecorrenteCard
                            key={`rec-${oc.id}`}
                            oc={oc}
                            showCategoria={catTab === "todas"}
                            onToggle={() => toggleOcorrencia.mutate({ id: oc.id, concluida: !oc.concluida })}
                          />
                        ))}
                      {items.length === 0 && activeTask && (
                        <div className="flex items-center justify-center h-14 rounded-lg border-2 border-dashed border-[#C8DA2D]/30 text-xs text-muted-foreground">
                          Soltar aqui
                        </div>
                      )}
                    </DroppableColumn>
                  );
                })}
              </div>

              <DragOverlay dropAnimation={null}>
                {activeTask && <CardContent tarefa={activeTask} overlay showCategoria={catTab === "todas"} />}
              </DragOverlay>
            </DndContext>
          )}
        </>
      )}

      {/* Task dialog */}
      <Dialog open={taskOpen} onOpenChange={setTaskOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Tarefa" : "Nova Tarefa"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div>
              <Label>Título *</Label>
              <Input value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))}
                placeholder="Descreva a tarefa..." className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Categoria</Label>
                <Select value={form.categoria}
                  onValueChange={v => setForm(f => ({ ...f, categoria: v, frente_id: "" }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {categorias.map(c => <SelectItem key={c.id} value={c.nome}>{c.emoji} {c.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Prioridade</Label>
                <Select value={form.prioridade} onValueChange={v => setForm(f => ({ ...f, prioridade: v as Prioridade }))}>
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
                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v as TarefaStatus }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todo">A Fazer</SelectItem>
                    <SelectItem value="in_progress">Em Andamento</SelectItem>
                    <SelectItem value="done">Concluído</SelectItem>
                    <SelectItem value="blocked">Bloqueado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Projeto</Label>
                <Select value={form.frente_id || "none"}
                  onValueChange={v => setForm(f => ({ ...f, frente_id: v === "none" ? "" : v }))}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Sem projeto" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem projeto</SelectItem>
                    {frentes
                      .filter(fr => fr.categoria === form.categoria)
                      .map(fr => <SelectItem key={fr.id} value={fr.id}>{fr.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Data limite</Label>
              <Input type="date" value={form.data_limite}
                onChange={e => setForm(f => ({ ...f, data_limite: e.target.value }))} className="mt-1" />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea value={form.descricao}
                onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} rows={3} className="mt-1" />
            </div>
            <div>
              <Label>Observações</Label>
              <Textarea value={form.observacao}
                onChange={e => setForm(f => ({ ...f, observacao: e.target.value }))} rows={2} className="mt-1" />
            </div>
            {editing && (
              <div className="pt-2 border-t flex items-center justify-between">
                <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-600 hover:bg-red-50"
                  onClick={() => { deleteTarefa.mutate(editing.id); setTaskOpen(false); }}>
                  <Trash2 size={14} className="mr-1" /> Excluir
                </Button>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => { engavetar(editing); setTaskOpen(false); }}>
                    <Clock size={13} className="mr-1" /> Engavetar
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => { arquivar(editing); setTaskOpen(false); }}>
                    <Archive size={13} className="mr-1" /> Arquivar
                  </Button>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTaskOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave}
              disabled={!form.titulo.trim() || createTarefa.isPending || updateTarefa.isPending}
              className="bg-[#C8DA2D] text-[#0C1923] hover:bg-[#d4e640]">
              {editing ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Projeto dialog */}
      <Dialog open={projetoOpen} onOpenChange={setProjetoOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Novo Projeto</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Categoria</Label>
              <Select value={projetoCat} onValueChange={setProjetoCat}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {categorias.map(c => <SelectItem key={c.id} value={c.nome}>{c.emoji} {c.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Nome</Label>
              <Input value={projetoNome} onChange={e => setProjetoNome(e.target.value)}
                placeholder="Ex: Cálculo, Lazer, Deals..." className="mt-1" />
            </div>
            <div>
              <Label>Cor</Label>
              <div className="flex items-center gap-3 mt-1">
                <input type="color" value={projetoCor} onChange={e => setProjetoCor(e.target.value)}
                  className="w-10 h-10 rounded-md border cursor-pointer" />
                <span className="text-sm text-muted-foreground font-mono">{projetoCor}</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProjetoOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => createProjeto.mutate({ nome: projetoNome, cor: projetoCor, categoria: projetoCat })}
              disabled={!projetoNome.trim() || createProjeto.isPending}
              className="bg-[#C8DA2D] text-[#0C1923] hover:bg-[#d4e640]">
              Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Nova Categoria dialog */}
      <Dialog open={catDialogOpen} onOpenChange={setCatDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Nova Categoria</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-1">
                <Label>Emoji</Label>
                <Input value={catEmoji} onChange={e => setCatEmoji(e.target.value)}
                  maxLength={2} className="mt-1 text-center text-lg" />
              </div>
              <div className="col-span-2">
                <Label>Nome</Label>
                <Input value={catNome} onChange={e => setCatNome(e.target.value)}
                  placeholder="Ex: MadCap, Empresa X..." className="mt-1" />
              </div>
            </div>
            <div>
              <Label>Cor da aba</Label>
              <div className="flex items-center gap-3 mt-1">
                <input type="color" value={catCor} onChange={e => setCatCor(e.target.value)}
                  className="w-10 h-10 rounded-md border cursor-pointer" />
                <span className="text-sm text-muted-foreground font-mono">{catCor}</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCatDialogOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => createCategoria.mutate({ nome: catNome, emoji: catEmoji, cor: catCor })}
              disabled={!catNome.trim() || createCategoria.isPending}
              className="bg-[#C8DA2D] text-[#0C1923] hover:bg-[#d4e640]">
              Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Gerenciar section */}
      <div className="border border-border rounded-xl overflow-hidden">
        <button
          onClick={() => setManageOpen(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium hover:bg-muted/50 transition-colors"
        >
          <div className="flex items-center gap-2 text-muted-foreground">
            <Settings size={14} />
            <span>Gerenciar Categorias &amp; Projetos</span>
          </div>
          {manageOpen
            ? <ChevronDown size={14} className="text-muted-foreground" />
            : <ChevronRight size={14} className="text-muted-foreground" />}
        </button>
        {manageOpen && (
          <div className="border-t border-border">
            <GerenciarCategorias
              categorias={categorias}
              onUpdate={(id, d) => updateCategoria.mutate({ id, d })}
              onDelete={id => deleteCategoria.mutate(id)}
              onNew={() => setCatDialogOpen(true)}
            />
            <GerenciarProjetos
              frentes={frentes}
              categorias={categorias}
              onUpdate={(id, d) => updateProjeto.mutate({ id, d })}
              onDelete={id => deleteProjeto.mutate(id)}
              onNew={cat => openNovoProjeto(cat)}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ── GerenciarCategorias ────────────────────────────────────────────────────────

function GerenciarCategorias({ categorias, onUpdate, onDelete, onNew }: {
  categorias: CategoriaItem[];
  onUpdate: (id: string, d: object) => void;
  onDelete: (id: string) => void;
  onNew: () => void;
}) {
  const [editId, setEditId]     = useState<string | null>(null);
  const [editNome, setEditNome] = useState("");
  const [editEmoji, setEditEmoji] = useState("");
  const [editCor, setEditCor]   = useState("");

  function startEdit(c: CategoriaItem) {
    setEditId(c.id); setEditNome(c.nome); setEditEmoji(c.emoji); setEditCor(c.cor);
  }

  function saveEdit() {
    if (editId) { onUpdate(editId, { nome: editNome, emoji: editEmoji, cor: editCor }); setEditId(null); }
  }

  return (
    <div className="px-4 py-3 border-b border-border">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Categorias</span>
        <button onClick={onNew} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <Plus size={11} /> Adicionar
        </button>
      </div>
      <div className="space-y-1">
        {categorias.map(cat => (
          <div key={cat.id} className="flex items-center gap-2 group py-1">
            {editId === cat.id ? (
              <>
                <Input value={editEmoji} onChange={e => setEditEmoji(e.target.value)} className="w-12 h-7 text-center" maxLength={2} />
                <input type="color" value={editCor} onChange={e => setEditCor(e.target.value)}
                  className="w-6 h-6 rounded cursor-pointer border shrink-0" />
                <Input value={editNome} onChange={e => setEditNome(e.target.value)} className="h-7 text-xs flex-1"
                  onKeyDown={e => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") setEditId(null); }} />
                <button onClick={saveEdit} className="p-1 text-green-500 hover:text-green-600 transition-colors"><Check size={13} /></button>
                <button onClick={() => setEditId(null)} className="p-1 text-muted-foreground hover:text-foreground transition-colors"><X size={13} /></button>
              </>
            ) : (
              <>
                <span className="text-base leading-none">{cat.emoji}</span>
                <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: cat.cor }} />
                <span className="text-sm flex-1">{cat.nome}</span>
                <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => startEdit(cat)} className="p-1 text-muted-foreground hover:text-foreground transition-colors"><Pencil size={11} /></button>
                  <button onClick={() => onDelete(cat.id)} className="p-1 text-muted-foreground hover:text-red-500 transition-colors"><Trash2 size={11} /></button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── GerenciarProjetos ──────────────────────────────────────────────────────────

function GerenciarProjetos({ frentes, categorias, onUpdate, onDelete, onNew }: {
  frentes: Frente[];
  categorias: CategoriaItem[];
  onUpdate: (id: string, d: object) => void;
  onDelete: (id: string) => void;
  onNew: (cat: string) => void;
}) {
  const [editId, setEditId]     = useState<string | null>(null);
  const [editNome, setEditNome] = useState("");
  const [editCor, setEditCor]   = useState("");

  function startEdit(f: Frente) { setEditId(f.id); setEditNome(f.nome); setEditCor(f.cor); }
  function saveEdit() { if (editId) { onUpdate(editId, { nome: editNome, cor: editCor }); setEditId(null); } }

  return (
    <div className="divide-y divide-border">
      {categorias.map(cat => {
        const catProjs = frentes.filter(f => f.categoria === cat.nome);
        return (
          <div key={cat.id} className="px-4 py-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                {cat.emoji} {cat.nome}
              </span>
              <button onClick={() => onNew(cat.nome)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                <Plus size={11} /> Adicionar
              </button>
            </div>
            {catProjs.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">Nenhum projeto criado.</p>
            ) : (
              <div className="space-y-1">
                {catProjs.map(f => (
                  <div key={f.id} className="flex items-center gap-2 group py-1">
                    {editId === f.id ? (
                      <>
                        <input type="color" value={editCor} onChange={e => setEditCor(e.target.value)}
                          className="w-6 h-6 rounded cursor-pointer shrink-0 border" />
                        <Input value={editNome} onChange={e => setEditNome(e.target.value)} className="h-7 text-xs flex-1"
                          onKeyDown={e => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") setEditId(null); }} />
                        <button onClick={saveEdit} className="p-1 text-green-500 hover:text-green-600 transition-colors"><Check size={13} /></button>
                        <button onClick={() => setEditId(null)} className="p-1 text-muted-foreground hover:text-foreground transition-colors"><X size={13} /></button>
                      </>
                    ) : (
                      <>
                        <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: f.cor }} />
                        <span className="text-sm flex-1">{f.nome}</span>
                        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => startEdit(f)} className="p-1 text-muted-foreground hover:text-foreground transition-colors"><Pencil size={11} /></button>
                          <button onClick={() => onDelete(f.id)} className="p-1 text-muted-foreground hover:text-red-500 transition-colors"><Trash2 size={11} /></button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── DroppableColumn ────────────────────────────────────────────────────────────

function DroppableColumn({ id, children, className }: { id: string; children: React.ReactNode; className?: string }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={cn(className, isOver && "ring-2 ring-[#C8DA2D]/40 bg-[#C8DA2D]/5 transition-all")}>
      {children}
    </div>
  );
}

// ── CardContent ───────────────────────────────────────────────────────────────

interface CardContentProps {
  tarefa: Tarefa;
  overlay?: boolean;
  overdue?: boolean;
  showCategoria?: boolean;
  dragListeners?: Record<string, unknown>;
  onEdit?: () => void;
  onDelete?: () => void;
  onStatus?: (next: TarefaStatus) => void;
  onEngage?: () => void;
  onArchive?: () => void;
}

function CardContent({ tarefa, overlay, overdue, showCategoria, dragListeners, onEdit, onDelete, onStatus, onEngage, onArchive }: CardContentProps) {
  const prioridade = PRIORIDADES.find(p => p.value === tarefa.prioridade);

  return (
    <div
      onClick={!overlay ? onEdit : undefined}
      className={cn(
        "bg-card border rounded-xl p-3 select-none group transition-all",
        overdue && !overlay
          ? "border-red-500/50 bg-red-500/5 hover:border-red-500/70"
          : "hover:border-[#C8DA2D]/60",
        overlay ? "shadow-2xl rotate-1 opacity-95 cursor-grabbing" : "cursor-pointer"
      )}
    >
      <div className="flex items-start gap-1.5">
        <div
          {...(!overlay ? dragListeners : {})}
          onClick={e => e.stopPropagation()}
          className={cn("mt-0.5 shrink-0 touch-none", !overlay && "cursor-grab active:cursor-grabbing")}
        >
          <GripVertical size={12} className="text-muted-foreground/40 group-hover:text-muted-foreground/60" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap gap-1 mb-1.5">
            {overdue && !overlay && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-red-500/15 text-red-400">
                ⚠️ Atrasada
              </span>
            )}
            {showCategoria && tarefa.categoria && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                {tarefa.categoria}
              </span>
            )}
            {prioridade && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                style={{ backgroundColor: prioridade.cor + "25", color: prioridade.cor }}>
                {prioridade.label}
              </span>
            )}
            {tarefa.frente_nome && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                style={{ backgroundColor: (tarefa.frente_cor ?? "#94a3b8") + "25", color: tarefa.frente_cor ?? "#94a3b8" }}>
                {tarefa.frente_nome}
              </span>
            )}
          </div>

          <p className="text-sm font-medium leading-snug">{tarefa.titulo}</p>

          {tarefa.data_limite && (
            <p className={cn("text-[10px] mt-1", overdue ? "text-red-400" : "text-muted-foreground")}>
              📅 {new Date(tarefa.data_limite + "T00:00:00").toLocaleDateString("pt-BR")}
            </p>
          )}

          {!overlay && (
            <div className="flex items-center justify-between mt-2" onClick={e => e.stopPropagation()}>
              <div className="flex gap-1 flex-wrap">
                {STATUS_ACTIONS[tarefa.status]?.map(({ label, next }) => (
                  <button key={next} onClick={() => onStatus?.(next)}
                    className="text-[10px] px-2 py-0.5 rounded-full border border-border hover:border-[#C8DA2D] hover:bg-[#C8DA2D]/10 transition-colors">
                    {label}
                  </button>
                ))}
              </div>
              <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={onEngage} title="Engavetar" className="p-1 rounded text-muted-foreground hover:text-amber-400 transition-colors"><Clock size={11} /></button>
                <button onClick={onArchive} title="Arquivar" className="p-1 rounded text-muted-foreground hover:text-blue-400 transition-colors"><Archive size={11} /></button>
                <button onClick={onDelete} title="Excluir" className="p-1 rounded text-muted-foreground hover:text-red-500 transition-colors"><Trash2 size={11} /></button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── SortableCard ───────────────────────────────────────────────────────────────

interface SortableCardProps extends Omit<CardContentProps, "overlay" | "dragListeners"> {
  isDragging: boolean;
}

function SortableCard({ tarefa, isDragging, ...rest }: SortableCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: tarefa.id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      className={cn(isDragging && "opacity-30")}
    >
      <CardContent tarefa={tarefa} dragListeners={listeners as Record<string, unknown>} {...rest} />
    </div>
  );
}

// ── RecorrenteCard ─────────────────────────────────────────────────────────────

function RecorrenteCard({ oc, showCategoria, onToggle }: {
  oc: TarefaRecorrenteOcorrencia;
  showCategoria?: boolean;
  onToggle: () => void;
}) {
  const prioridade = PRIORIDADES.find(p => p.value === oc.prioridade);
  return (
    <div className={cn(
      "bg-card border border-dashed rounded-xl p-3 transition-all",
      oc.concluida ? "border-border opacity-50" : "border-indigo-400/30 hover:border-indigo-400/50",
    )}>
      <div className="flex items-start gap-1.5">
        <div className="w-3 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap gap-1 mb-1.5">
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-indigo-400/10 text-indigo-400">🔁</span>
            {showCategoria && oc.categoria && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                {oc.categoria}
              </span>
            )}
            {prioridade && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                style={{ backgroundColor: prioridade.cor + "25", color: prioridade.cor }}>
                {prioridade.label}
              </span>
            )}
            {oc.frente_nome && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                style={{ backgroundColor: (oc.frente_cor ?? "#94a3b8") + "25", color: oc.frente_cor ?? "#94a3b8" }}>
                {oc.frente_nome}
              </span>
            )}
          </div>
          <p className={cn("text-sm font-medium leading-snug", oc.concluida && "line-through text-muted-foreground")}>
            {oc.titulo}
          </p>
          <p className="text-[10px] text-muted-foreground mt-1">
            📅 {new Date(oc.data_alvo + "T00:00:00").toLocaleDateString("pt-BR")}
          </p>
        </div>
        <button onClick={onToggle}
          className={cn("shrink-0 p-1 rounded transition-colors",
            oc.concluida ? "text-green-400 hover:text-muted-foreground" : "text-muted-foreground hover:text-green-400"
          )}>
          <Check size={13} />
        </button>
      </div>
    </div>
  );
}

// ── FilterPill ─────────────────────────────────────────────────────────────────

function FilterPill({ active, color, onClick, children }: {
  active: boolean; color?: string; onClick: () => void; children: React.ReactNode;
}) {
  const style = active && color ? { backgroundColor: color + "30", color, borderColor: color } : undefined;
  return (
    <button onClick={onClick} style={style}
      className={cn(
        "px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
        active && !color ? "bg-[#0C1923] text-white border-[#0C1923]" : "bg-background border-border hover:border-foreground/40"
      )}>
      {children}
    </button>
  );
}

// ── ArquivoView ────────────────────────────────────────────────────────────────

function ArquivoView({ arquivadas, categorias, onRestaurar, onDelete }: {
  arquivadas: Tarefa[];
  categorias: CategoriaItem[];
  onRestaurar: (t: Tarefa) => void;
  onDelete: (id: string) => void;
}) {
  const engavetadas = arquivadas.filter(t => t.tipo_arquivo === "engavetada");
  const arquivadass = arquivadas.filter(t => t.tipo_arquivo === "arquivo");
  return (
    <div className="space-y-8">
      <ArquivoSection title="🧊 Engavetadas" description="Pausadas para o futuro." tasks={engavetadas} categorias={categorias} onRestaurar={onRestaurar} onDelete={onDelete} />
      <ArquivoSection title="📁 Arquivadas" description="Concluídas e mantidas como referência histórica." tasks={arquivadass} categorias={categorias} onRestaurar={onRestaurar} onDelete={onDelete} />
    </div>
  );
}

function ArquivoSection({ title, description, tasks, categorias, onRestaurar, onDelete }: {
  title: string; description: string; tasks: Tarefa[];
  categorias: CategoriaItem[];
  onRestaurar: (t: Tarefa) => void; onDelete: (id: string) => void;
}) {
  return (
    <div>
      <div className="mb-3">
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
      {tasks.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-6 text-center text-sm text-muted-foreground">Nenhuma tarefa aqui.</div>
      ) : (
        <div className="space-y-1">
          {tasks.map(t => {
            const prioridade = PRIORIDADES.find(p => p.value === t.prioridade);
            const cat = categorias.find(c => c.nome === t.categoria);
            return (
              <div key={t.id} className="flex items-center gap-3 bg-card border border-border rounded-lg px-4 py-3 opacity-70 hover:opacity-100 transition-opacity">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                    {cat && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                        style={{ backgroundColor: cat.cor + "20", color: cat.cor }}>
                        {cat.emoji} {cat.nome}
                      </span>
                    )}
                    {prioridade && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                        style={{ backgroundColor: prioridade.cor + "25", color: prioridade.cor }}>
                        {prioridade.label}
                      </span>
                    )}
                  </div>
                  <p className="text-sm truncate">{t.titulo}</p>
                  {t.data_limite && <p className="text-[10px] text-muted-foreground mt-0.5">📅 {fmtDate(t.data_limite)}</p>}
                </div>
                <button onClick={() => onRestaurar(t)}
                  className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border border-border hover:border-[#C8DA2D] hover:bg-[#C8DA2D]/10 transition-colors shrink-0">
                  <RotateCcw size={11} /> Restaurar
                </button>
                <button onClick={() => onDelete(t.id)}
                  className="p-1.5 rounded text-muted-foreground hover:text-red-500 transition-colors shrink-0">
                  <Trash2 size={13} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
