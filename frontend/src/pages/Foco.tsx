import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
import { GripVertical, Plus, X, Check, Clock, ListOrdered, Play } from "lucide-react";
import { apiFetch } from "@/lib/api";
import type { Tarefa } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

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
  const [fila, setFila] = useState<FilaItem[]>(loadFila);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState("");

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

  function removeFromFila(id: string) {
    updateFila(fila.filter(f => f.id !== id));
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

  const disponiveis = tarefas.filter(t =>
    !t.concluida && !t.arquivado &&
    !fila.some(f => f.tarefaId === t.id) &&
    (search === "" || t.titulo.toLowerCase().includes(search.toLowerCase()))
  );

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
                  onRemove={() => removeFromFila(item.id)}
                  onComplete={() => removeFromFila(item.id)}
                  onTempoChange={min => updateTempo(item.id, min)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Task picker dialog */}
      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="max-w-md flex flex-col" style={{ maxHeight: "80vh" }}>
          <DialogHeader>
            <DialogTitle>Adicionar à fila</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Buscar tarefa..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="mt-1"
            autoFocus
          />
          <div className="flex-1 overflow-y-auto space-y-0.5 mt-2 pr-1">
            {disponiveis.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                {tarefas.length === 0 ? "Nenhuma tarefa cadastrada." : "Nenhuma tarefa disponível."}
              </p>
            ) : (
              disponiveis.map(t => (
                <button
                  key={t.id}
                  onClick={() => addToFila(t)}
                  className="w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted/60 transition-colors group"
                >
                  {t.frente_cor ? (
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: t.frente_cor }} />
                  ) : (
                    <div className="w-2 h-2 rounded-full shrink-0 bg-border" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{t.titulo}</p>
                    {t.frente_nome && (
                      <p className="text-[10px] text-muted-foreground">{t.frente_nome}</p>
                    )}
                  </div>
                  <Plus
                    size={14}
                    className="text-muted-foreground group-hover:text-[#C8DA2D] transition-colors shrink-0"
                  />
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

function SortableFilaItem({ item, index, onRemove, onComplete, onTempoChange }: {
  item: FilaItem;
  index: number;
  onRemove: () => void;
  onComplete: () => void;
  onTempoChange: (min: number) => void;
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
