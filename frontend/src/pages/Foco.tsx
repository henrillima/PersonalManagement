import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus, X, Check, Clock, ListOrdered, Play, Pause, RotateCcw, ArrowUpDown, CalendarClock } from "lucide-react";
import { apiFetch, fmtDate } from "@/lib/api";
import type { Tarefa } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type SortField = "titulo" | "categoria" | "data_limite" | "prioridade";
type SortDir = "asc" | "desc";

// ── Timer ──────────────────────────────────────────────────────────────────────

interface TimerState { elapsed: number; running: boolean; maxSec: number; }

function fmtTimer(elapsed: number, maxSec: number): string {
  const remaining = Math.max(0, maxSec - elapsed);
  const m = Math.floor(remaining / 60);
  const s = remaining % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// ── Types & localStorage ───────────────────────────────────────────────────────

interface FilaItem {
  id: string;
  tarefaId: string;
  titulo: string;
  frenteCor: string | null;
  frenteNome: string | null;
  tempoMin: number;
}

const FILA_KEY = "fila_execucao_v1";

function loadFila(): FilaItem[] {
  try {
    const s = localStorage.getItem(FILA_KEY);
    return s ? JSON.parse(s) : [];
  } catch { return []; }
}

function saveFila(items: FilaItem[]) {
  localStorage.setItem(FILA_KEY, JSON.stringify(items));
}

// ── Main ───────────────────────────────────────────────────────────────────────

export default function Foco() {
  const qc = useQueryClient();
  const [fila, setFila] = useState<FilaItem[]>(loadFila);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [timers, setTimers] = useState<Record<string, TimerState>>({});
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setTimers(prev => {
        if (!Object.values(prev).some(t => t.running)) return prev;
        const next = { ...prev };
        let changed = false;
        for (const id of Object.keys(next)) {
          const t = next[id];
          if (t.running) {
            const newElapsed = t.elapsed + 1;
            const done = newElapsed >= t.maxSec;
            next[id] = { ...t, elapsed: newElapsed, running: !done };
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  function toggleTimer(item: FilaItem) {
    const maxSec = item.tempoMin * 60;
    setTimers(prev => {
      const cur = prev[item.id];
      const isDone = cur && cur.elapsed >= cur.maxSec;
      if (isDone) {
        return { ...Object.fromEntries(Object.entries(prev).map(([k, v]) => [k, { ...v, running: false }])),
          [item.id]: { elapsed: 0, running: true, maxSec } };
      }
      if (!cur?.running) {
        const next: typeof prev = {};
        for (const [k, v] of Object.entries(prev)) next[k] = { ...v, running: false };
        next[item.id] = { elapsed: cur?.elapsed ?? 0, running: true, maxSec };
        return next;
      }
      return { ...prev, [item.id]: { ...cur, running: false } };
    });
  }

  function resetTimer(id: string) {
    setTimers(prev => ({ ...prev, [id]: { elapsed: 0, running: false, maxSec: prev[id]?.maxSec ?? 0 } }));
  }
  const [filterCat, setFilterCat] = useState("all");
  const [sortField, setSortField] = useState<SortField>("titulo");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const { data: tarefas = [] } = useQuery<Tarefa[]>({
    queryKey: ["tarefas-foco"],
    queryFn: () => apiFetch("/api/v1/tarefas"),
    staleTime: 60_000,
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  function updateFila(next: FilaItem[]) {
    setFila(next);
    saveFila(next);
  }

  function addToFila(t: Tarefa) {
    if (fila.some(f => f.tarefaId === t.id)) return;
    updateFila([...fila, {
      id: crypto.randomUUID(),
      tarefaId: t.id,
      titulo: t.titulo,
      frenteCor: t.frente_cor,
      frenteNome: t.frente_nome,
      tempoMin: 25,
    }]);
  }

  const completeTarefa = useMutation({
    mutationFn: (tarefaId: string) =>
      apiFetch(`/api/v1/tarefas/${tarefaId}`, { method: "PATCH", body: JSON.stringify({ status: "done", concluida: true }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tarefas"] });
      qc.invalidateQueries({ queryKey: ["tarefas-foco"] });
    },
  });

  function removeFromFila(id: string) {
    updateFila(fila.filter(f => f.id !== id));
    setTimers(prev => { const next = { ...prev }; delete next[id]; return next; });
  }

  function completeAndRemove(item: FilaItem) {
    removeFromFila(item.id);
    completeTarefa.mutate(item.tarefaId);
  }

  function updateTempo(id: string, min: number) {
    updateFila(fila.map(f => f.id === id ? { ...f, tempoMin: min } : f));
  }

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (over && active.id !== over.id) {
      const oldIdx = fila.findIndex(f => f.id === active.id);
      const newIdx = fila.findIndex(f => f.id === over.id);
      updateFila(arrayMove(fila, oldIdx, newIdx));
    }
  }

  const categorias = useMemo(() => {
    const set = new Set(tarefas.filter(t => !t.concluida && !t.arquivado).map(t => t.categoria).filter(Boolean));
    return Array.from(set).sort() as string[];
  }, [tarefas]);

  const PRIO_ORDER: Record<string, number> = { alta: 0, media: 1, baixa: 2 };

  const disponiveis = useMemo(() => {
    const base = tarefas.filter(t =>
      !t.concluida && !t.arquivado &&
      !fila.some(f => f.tarefaId === t.id) &&
      (search === "" || t.titulo.toLowerCase().includes(search.toLowerCase())) &&
      (filterCat === "all" || t.categoria === filterCat)
    );
    return [...base].sort((a, b) => {
      let cmp = 0;
      if (sortField === "titulo") {
        cmp = a.titulo.localeCompare(b.titulo, "pt-BR");
      } else if (sortField === "categoria") {
        cmp = (a.categoria ?? "").localeCompare(b.categoria ?? "", "pt-BR");
      } else if (sortField === "data_limite") {
        const da = a.data_limite ?? "9999";
        const db = b.data_limite ?? "9999";
        cmp = da < db ? -1 : da > db ? 1 : 0;
      } else if (sortField === "prioridade") {
        cmp = (PRIO_ORDER[a.prioridade] ?? 9) - (PRIO_ORDER[b.prioridade] ?? 9);
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [tarefas, fila, search, filterCat, sortField, sortDir]);

  function toggleSort(field: SortField) {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("asc"); }
  }

  const totalMin = fila.reduce((acc, f) => acc + (f.tempoMin || 0), 0);
  const horas = Math.floor(totalMin / 60);
  const minRest = totalMin % 60;
  const tempoLabel = totalMin === 0
    ? "sem estimativa"
    : horas > 0
      ? `${horas}h ${minRest > 0 ? `${minRest}min` : ""}`
      : `${minRest}min`;

  return (
    <div className="space-y-5 max-w-2xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Play size={20} className="text-[#C8DA2D]" />
            Fila de Execução
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {fila.length} tarefa{fila.length !== 1 ? "s" : ""} · {tempoLabel}
          </p>
        </div>
        <Button
          onClick={() => { setSearch(""); setPickerOpen(true); }}
          className="bg-[#C8DA2D] text-[#0C1923] hover:bg-[#d4e640]"
        >
          <Plus size={14} className="mr-1" /> Adicionar
        </Button>
      </div>

      {/* Queue */}
      {fila.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center border border-dashed border-border rounded-2xl">
          <ListOrdered size={40} className="text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">Fila vazia. Adicione tarefas para começar.</p>
          <button
            onClick={() => { setSearch(""); setPickerOpen(true); }}
            className="mt-2 text-sm text-[#C8DA2D] hover:underline"
          >
            Adicionar primeira tarefa
          </button>
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={fila.map(f => f.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {fila.map((item, index) => (
                <SortableFilaItem
                  key={item.id}
                  item={item}
                  index={index}
                  timer={timers[item.id]}
                  onRemove={() => removeFromFila(item.id)}
                  onComplete={() => completeAndRemove(item)}
                  onTempoChange={min => updateTempo(item.id, min)}
                  onTimerToggle={() => toggleTimer(item)}
                  onTimerReset={() => resetTimer(item.id)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Task picker dialog */}
      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="max-w-lg flex flex-col" style={{ maxHeight: "85vh" }}>
          <DialogHeader>
            <DialogTitle>Adicionar à fila</DialogTitle>
          </DialogHeader>

          {/* Search + category filter */}
          <div className="space-y-2 mt-1">
            <Input
              placeholder="Buscar tarefa..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              autoFocus
            />
            {categorias.length > 0 && (
              <div className="flex gap-1.5 flex-wrap">
                <button
                  onClick={() => setFilterCat("all")}
                  className={cn(
                    "px-2.5 py-1 rounded-full text-xs font-medium border transition-colors",
                    filterCat === "all"
                      ? "bg-foreground text-background border-foreground"
                      : "border-border text-muted-foreground hover:text-foreground"
                  )}
                >
                  Todas
                </button>
                {categorias.map(c => (
                  <button
                    key={c}
                    onClick={() => setFilterCat(filterCat === c ? "all" : c)}
                    className={cn(
                      "px-2.5 py-1 rounded-full text-xs font-medium border transition-colors",
                      filterCat === c
                        ? "bg-foreground text-background border-foreground"
                        : "border-border text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {c}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Sort header */}
          <div className="grid grid-cols-[1fr_auto_auto] gap-2 px-3 py-1.5 border-b border-border mt-1">
            <SortButton label="Tarefa / Projeto" field="titulo" active={sortField} dir={sortDir} onToggle={toggleSort} />
            <SortButton label="Categoria" field="categoria" active={sortField} dir={sortDir} onToggle={toggleSort} />
            <SortButton label="Prazo" field="data_limite" active={sortField} dir={sortDir} onToggle={toggleSort} />
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto space-y-0.5 pr-1">
            {disponiveis.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                {tarefas.length === 0 ? "Nenhuma tarefa cadastrada." : "Nenhuma tarefa disponível."}
              </p>
            ) : (
              disponiveis.map(t => (
                <button
                  key={t.id}
                  onClick={() => addToFila(t)}
                  className="w-full text-left grid grid-cols-[1fr_auto_auto_auto] items-center gap-2 px-3 py-2.5 rounded-lg hover:bg-muted/60 transition-colors group"
                >
                  {/* Title + project */}
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ backgroundColor: t.frente_cor ?? "#94a3b8" }}
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{t.titulo}</p>
                      {t.frente_nome && (
                        <p className="text-[10px] text-muted-foreground truncate">{t.frente_nome}</p>
                      )}
                    </div>
                  </div>

                  {/* Categoria */}
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground whitespace-nowrap">
                    {t.categoria ?? "—"}
                  </span>

                  {/* Prazo */}
                  <span className={cn(
                    "text-[10px] whitespace-nowrap flex items-center gap-0.5",
                    t.data_limite
                      ? new Date(t.data_limite) < new Date() ? "text-red-500" : "text-muted-foreground"
                      : "text-muted-foreground/40"
                  )}>
                    {t.data_limite ? (
                      <><CalendarClock size={10} />{fmtDate(t.data_limite)}</>
                    ) : "—"}
                  </span>

                  {/* Add icon */}
                  <Plus size={14} className="text-muted-foreground group-hover:text-[#C8DA2D] transition-colors shrink-0" />
                </button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Sortable item ──────────────────────────────────────────────────────────────

function SortableFilaItem({ item, index, timer, onRemove, onComplete, onTempoChange, onTimerToggle, onTimerReset }: {
  item: FilaItem;
  index: number;
  timer?: TimerState;
  onRemove: () => void;
  onComplete: () => void;
  onTempoChange: (min: number) => void;
  onTimerToggle: () => void;
  onTimerReset: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.45 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-3 bg-card border rounded-xl px-4 py-3 group transition-shadow",
        isDragging && "shadow-lg border-[#C8DA2D]/40"
      )}
    >
      {/* Position */}
      <span className="text-xs font-bold text-muted-foreground/40 w-4 text-center select-none shrink-0">
        {index + 1}
      </span>

      {/* Drag handle */}
      <button
        className="text-muted-foreground/30 hover:text-muted-foreground transition-colors cursor-grab active:cursor-grabbing shrink-0 touch-none"
        {...attributes}
        {...listeners}
      >
        <GripVertical size={16} />
      </button>

      {/* Color bar */}
      {item.frenteCor && (
        <div className="w-1 h-8 rounded-full shrink-0" style={{ backgroundColor: item.frenteCor }} />
      )}

      {/* Title */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{item.titulo}</p>
        {item.frenteNome && (
          <p className="text-[10px] text-muted-foreground">{item.frenteNome}</p>
        )}
      </div>

      {/* Time input */}
      <div className="flex items-center gap-1 shrink-0">
        <Clock size={12} className="text-muted-foreground" />
        <input
          type="number"
          min={1}
          max={480}
          value={item.tempoMin || ""}
          onChange={e => onTempoChange(Math.max(1, parseInt(e.target.value) || 1))}
          className="w-14 h-7 text-xs rounded-md border border-border bg-background px-1.5 text-center focus:outline-none focus:border-[#C8DA2D] transition-colors"
          title="Minutos estimados"
        />
        <span className="text-[10px] text-muted-foreground">min</span>
      </div>

      {/* Timer */}
      {(() => {
        const maxSec = item.tempoMin * 60;
        const elapsed = timer?.elapsed ?? 0;
        const running = timer?.running ?? false;
        const isDone  = elapsed > 0 && elapsed >= maxSec;
        return (
          <div className="flex items-center gap-0.5 shrink-0">
            <button onClick={onTimerToggle} title={running ? "Pausar" : "Iniciar timer"}
              className={cn("p-1.5 rounded-lg transition-colors",
                running ? "text-[#C8DA2D] hover:text-foreground" : "text-muted-foreground hover:text-[#C8DA2D]"
              )}>
              {running ? <Pause size={13} /> : <Play size={13} />}
            </button>
            <span className={cn("text-xs font-mono min-w-[38px] text-center tabular-nums",
              isDone ? "text-green-500 font-bold" : running ? "text-[#C8DA2D]" : "text-muted-foreground"
            )}>
              {isDone ? "00:00" : fmtTimer(elapsed, maxSec)}
            </span>
            {elapsed > 0 && (
              <button onClick={onTimerReset} title="Reiniciar"
                className="p-1 text-muted-foreground/50 hover:text-muted-foreground transition-colors">
                <RotateCcw size={10} />
              </button>
            )}
          </div>
        );
      })()}

      {/* Complete */}
      <button
        onClick={onComplete}
        title="Marcar como concluída"
        className="p-1.5 rounded-lg text-muted-foreground hover:text-green-500 hover:bg-green-500/10 transition-colors shrink-0"
      >
        <Check size={15} />
      </button>

      {/* Remove */}
      <button
        onClick={onRemove}
        title="Remover da fila"
        className="p-1.5 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors shrink-0"
      >
        <X size={15} />
      </button>
    </div>
  );
}

// ── SortButton ─────────────────────────────────────────────────────────────────

function SortButton({ label, field, active, dir, onToggle }: {
  label: string;
  field: SortField;
  active: SortField;
  dir: SortDir;
  onToggle: (f: SortField) => void;
}) {
  const isActive = active === field;
  return (
    <button
      onClick={() => onToggle(field)}
      className={cn(
        "flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide transition-colors",
        isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"
      )}
    >
      {label}
      <ArrowUpDown size={9} className={cn(isActive ? "opacity-100" : "opacity-40")} />
      {isActive && <span className="text-[8px]">{dir === "asc" ? "↑" : "↓"}</span>}
    </button>
  );
}
