import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, useSortable, verticalListSortingStrategy, arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Plus, Trash2, GripVertical, Pencil, Check, BookOpen,
  ChevronDown, ChevronRight, ChevronLeft, BookMarked, ClipboardList, X,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import type { CatEstudo, FrenteEstudo, ItemEstudo } from "@/types";
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
import { EmojiPicker } from "@/components/ui/emoji-picker";

// ── Constants ──────────────────────────────────────────────────────────────────

const TIPOS = ["Livro", "Curso", "Vídeo", "Artigo", "Podcast", "Outro"];
const TIPO_ICON: Record<string, string> = {
  Livro: "📗", Curso: "🎓", Vídeo: "▶️", Artigo: "📄", Podcast: "🎙️", Outro: "📌",
};

// ── Types ──────────────────────────────────────────────────────────────────────

interface PlanoItem {
  id: string;
  item_id: string;
  titulo: string;
  tipo: string | null;
  frente_nome: string | null;
  cat_emoji: string | null;
  cat_nome: string | null;
  ordem: number;
}

interface CatForm { nome: string; emoji: string; }
interface FrenteForm { nome: string; categoria_id: string; }
interface ItemForm {
  titulo: string; tipo: string; obrigatorio: boolean;
  progresso: number; url: string; notas: string;
}

const emptyCatForm    = (): CatForm    => ({ nome: "", emoji: "📚" });
const emptyFrenteForm = (catId = ""): FrenteForm => ({ nome: "", categoria_id: catId });
const emptyItemForm   = (): ItemForm   => ({ titulo: "", tipo: "Livro", obrigatorio: true, progresso: 0, url: "", notas: "" });

// ── Component ──────────────────────────────────────────────────────────────────

export default function Estudos() {
  const qc = useQueryClient();

  // Navigation
  const [view, setView] = useState<"mapa" | "plano">("mapa");
  const [selectedCatId, setSelectedCatId] = useState<string | null>(null);
  const [selectedFrenteId, setSelectedFrenteId] = useState<string | null>(null);
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());

  // Optimistic ordering
  const [localItens, setLocalItens] = useState<ItemEstudo[]>([]);
  const [localPlano, setLocalPlano] = useState<PlanoItem[]>([]);

  // Dialog states
  const [catOpen, setCatOpen] = useState(false);
  const [catForm, setCatForm] = useState<CatForm>(emptyCatForm());
  const [editingCat, setEditingCat] = useState<CatEstudo | null>(null);

  const [frenteOpen, setFrenteOpen] = useState(false);
  const [frenteForm, setFrenteForm] = useState<FrenteForm>(emptyFrenteForm());
  const [editingFrente, setEditingFrente] = useState<FrenteEstudo | null>(null);

  const [itemOpen, setItemOpen] = useState(false);
  const [itemForm, setItemForm] = useState<ItemForm>(emptyItemForm());
  const [editingItem, setEditingItem] = useState<ItemEstudo | null>(null);

  const [planPickerOpen, setPlanPickerOpen] = useState(false);
  const [planSearch, setPlanSearch] = useState("");

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  // ── Queries ─────────────────────────────────────────────────────────────────

  const { data: categorias = [], isLoading: lCat } = useQuery<CatEstudo[]>({
    queryKey: ["estudos-cats"],
    queryFn: () => apiFetch("/api/v1/estudos/categorias"),
  });

  const { data: frentes = [], isLoading: lFr } = useQuery<FrenteEstudo[]>({
    queryKey: ["estudos-frentes"],
    queryFn: () => apiFetch("/api/v1/estudos/frentes"),
  });

  const { data: itens = [], isLoading: lIt } = useQuery<ItemEstudo[]>({
    queryKey: ["estudos-itens"],
    queryFn: () => apiFetch("/api/v1/estudos/itens"),
  });

  const { data: plano = [] } = useQuery<PlanoItem[]>({
    queryKey: ["estudos-plano"],
    queryFn: () => apiFetch("/api/v1/estudos/plano"),
    staleTime: 0,
  });

  useEffect(() => { setLocalItens(itens); }, [itens]);
  useEffect(() => { setLocalPlano(plano); }, [plano]);
  useEffect(() => {
    if (categorias.length > 0) setExpandedCats(new Set(categorias.map(c => c.id)));
  }, [categorias]);

  // ── Mutations ────────────────────────────────────────────────────────────────

  const invCats    = () => qc.invalidateQueries({ queryKey: ["estudos-cats"] });
  const invFrentes = () => qc.invalidateQueries({ queryKey: ["estudos-frentes"] });
  const invItens   = () => qc.invalidateQueries({ queryKey: ["estudos-itens"] });
  const invPlano   = () => qc.invalidateQueries({ queryKey: ["estudos-plano"] });
  const onErr = (e: Error) => alert(`Erro: ${e.message}`);

  const createCat = useMutation({
    mutationFn: (d: object) => apiFetch("/api/v1/estudos/categorias", { method: "POST", body: JSON.stringify(d) }),
    onSuccess: () => { invCats(); setCatOpen(false); }, onError: onErr,
  });
  const updateCat = useMutation({
    mutationFn: ({ id, d }: { id: string; d: object }) =>
      apiFetch(`/api/v1/estudos/categorias/${id}`, { method: "PATCH", body: JSON.stringify(d) }),
    onSuccess: () => { invCats(); setCatOpen(false); setEditingCat(null); }, onError: onErr,
  });
  const deleteCat = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/v1/estudos/categorias/${id}`, { method: "DELETE" }),
    onSuccess: invCats, onError: onErr,
  });

  const createFrente = useMutation({
    mutationFn: (d: object) => apiFetch("/api/v1/estudos/frentes", { method: "POST", body: JSON.stringify(d) }),
    onSuccess: () => { invFrentes(); setFrenteOpen(false); }, onError: onErr,
  });
  const updateFrente = useMutation({
    mutationFn: ({ id, d }: { id: string; d: object }) =>
      apiFetch(`/api/v1/estudos/frentes/${id}`, { method: "PATCH", body: JSON.stringify(d) }),
    onSuccess: () => { invFrentes(); setFrenteOpen(false); setEditingFrente(null); }, onError: onErr,
  });
  const deleteFrente = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/v1/estudos/frentes/${id}`, { method: "DELETE" }),
    onSuccess: invFrentes, onError: onErr,
  });

  const createItem = useMutation({
    mutationFn: (d: object) => apiFetch("/api/v1/estudos/itens", { method: "POST", body: JSON.stringify(d) }),
    onSuccess: () => { invItens(); setItemOpen(false); }, onError: onErr,
  });
  const updateItem = useMutation({
    mutationFn: ({ id, d }: { id: string; d: object }) =>
      apiFetch(`/api/v1/estudos/itens/${id}`, { method: "PATCH", body: JSON.stringify(d) }),
    onSuccess: () => { invItens(); setItemOpen(false); setEditingItem(null); }, onError: onErr,
  });
  const deleteItem = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/v1/estudos/itens/${id}`, { method: "DELETE" }),
    onSuccess: invItens, onError: onErr,
  });
  const reorderItems = useMutation({
    mutationFn: (ids: string[]) =>
      apiFetch("/api/v1/estudos/itens/reorder", { method: "POST", body: JSON.stringify({ ids }) }),
    onSuccess: invItens,
  });

  const addToPlano = useMutation({
    mutationFn: (d: object) => apiFetch("/api/v1/estudos/plano", { method: "POST", body: JSON.stringify(d) }),
    onSuccess: invPlano,
  });
  const removeFromPlano = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/v1/estudos/plano/${id}`, { method: "DELETE" }),
    onSuccess: invPlano,
  });
  const reorderPlano = useMutation({
    mutationFn: (ids: string[]) =>
      apiFetch("/api/v1/estudos/plano/reorder", { method: "POST", body: JSON.stringify({ ids }) }),
  });

  // ── Derived state ────────────────────────────────────────────────────────────

  const selectedFrente = frentes.find(f => f.id === selectedFrenteId);
  const selectedCat    = categorias.find(c => c.id === (selectedCatId ?? selectedFrente?.categoria_id));

  const frenteItens = useMemo(
    () => localItens.filter(i => i.frente_id === selectedFrenteId).sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0)),
    [localItens, selectedFrenteId]
  );

  const planItemIds = useMemo(() => new Set(localPlano.map(p => p.item_id)), [localPlano]);

  const planDisponiveis = useMemo(() => {
    const planIds = new Set(localPlano.map(p => p.item_id));
    return itens
      .filter(i => !i.concluido && !planIds.has(i.id) &&
        (!planSearch || i.titulo.toLowerCase().includes(planSearch.toLowerCase())))
      .map(i => {
        const fr  = frentes.find(f => f.id === i.frente_id);
        const cat = categorias.find(c => c.id === fr?.categoria_id);
        return { ...i, _frente_nome: fr?.nome ?? null, _cat_nome: cat?.nome ?? null, _cat_emoji: cat?.emoji ?? null };
      });
  }, [itens, localPlano, planSearch, frentes, categorias]);

  function getFrenteStats(frenteId: string) {
    const fi = localItens.filter(i => i.frente_id === frenteId);
    const total = fi.length;
    const concluidos = fi.filter(i => i.concluido).length;
    const required   = fi.filter(i => i.obrigatorio).length;
    const requiredDone = fi.filter(i => i.obrigatorio && i.concluido).length;
    return { total, concluidos, required, requiredDone };
  }

  // ── Handlers ─────────────────────────────────────────────────────────────────

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const oldIdx = frenteItens.findIndex(i => i.id === active.id);
    const newIdx = frenteItens.findIndex(i => i.id === over.id);
    if (oldIdx === -1 || newIdx === -1) return;
    const reordered = arrayMove(frenteItens, oldIdx, newIdx);
    setLocalItens(prev => [
      ...prev.filter(i => i.frente_id !== selectedFrenteId),
      ...reordered.map((item, idx) => ({ ...item, ordem: idx })),
    ]);
    reorderItems.mutate(reordered.map(i => i.id));
  }

  function handlePlanDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const oldIdx = localPlano.findIndex(i => i.id === active.id);
    const newIdx = localPlano.findIndex(i => i.id === over.id);
    if (oldIdx === -1 || newIdx === -1) return;
    const reordered = arrayMove(localPlano, oldIdx, newIdx);
    setLocalPlano(reordered);
    reorderPlano.mutate(reordered.map(i => i.id));
  }

  function handleAddItemToPlano(item: ItemEstudo) {
    if (planItemIds.has(item.id)) return;
    const fr  = frentes.find(f => f.id === item.frente_id);
    const cat = categorias.find(c => c.id === fr?.categoria_id);
    addToPlano.mutate({
      item_id: item.id, titulo: item.titulo, tipo: item.tipo,
      frente_nome: fr?.nome ?? null, cat_emoji: cat?.emoji ?? null, cat_nome: cat?.nome ?? null,
    });
  }

  // Dialog openers
  function openCreateCat() { setEditingCat(null); setCatForm(emptyCatForm()); setCatOpen(true); }
  function openEditCat(cat: CatEstudo) { setEditingCat(cat); setCatForm({ nome: cat.nome, emoji: cat.emoji }); setCatOpen(true); }

  function openCreateFrente(catId = "") { setEditingFrente(null); setFrenteForm(emptyFrenteForm(catId)); setFrenteOpen(true); }
  function openEditFrente(fr: FrenteEstudo) { setEditingFrente(fr); setFrenteForm({ nome: fr.nome, categoria_id: fr.categoria_id }); setFrenteOpen(true); }

  function openCreateItem() { setEditingItem(null); setItemForm(emptyItemForm()); setItemOpen(true); }
  function openEditItem(item: ItemEstudo) {
    setEditingItem(item);
    setItemForm({ titulo: item.titulo, tipo: item.tipo, obrigatorio: item.obrigatorio, progresso: item.progresso, url: item.url ?? "", notas: item.notas ?? "" });
    setItemOpen(true);
  }

  function handleCatSubmit() {
    if (editingCat) updateCat.mutate({ id: editingCat.id, d: catForm });
    else createCat.mutate(catForm);
  }

  function handleFrenteSubmit() {
    if (editingFrente) updateFrente.mutate({ id: editingFrente.id, d: frenteForm });
    else createFrente.mutate(frenteForm);
  }

  function handleItemSubmit() {
    const payload = { ...itemForm, url: itemForm.url || undefined, notas: itemForm.notas || undefined };
    if (editingItem) updateItem.mutate({ id: editingItem.id, d: payload });
    else createItem.mutate({ ...payload, frente_id: selectedFrenteId });
  }

  function toggleCat(id: string) {
    setExpandedCats(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  if (lCat || lFr) return <Skeleton className="h-64 rounded-xl" />;

  // Frente-detail stats
  const totalItems        = frenteItens.length;
  const concluidos        = frenteItens.filter(i => i.concluido).length;
  const required          = frenteItens.filter(i => i.obrigatorio).length;
  const requiredConcluidos = frenteItens.filter(i => i.obrigatorio && i.concluido).length;

  return (
    <div className="space-y-5">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Estudos</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Mapa de estudos, leituras e cursos</p>
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
          {/* Tab toggle */}
          <div className="flex border border-border rounded-lg overflow-hidden text-sm">
            <button
              onClick={() => setView("mapa")}
              className={cn("px-3 py-1.5 flex items-center gap-1.5 transition-colors font-medium",
                view === "mapa" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}
            >
              <BookMarked size={13} /> Mapa
            </button>
            <button
              onClick={() => setView("plano")}
              className={cn("px-3 py-1.5 flex items-center gap-1.5 transition-colors font-medium",
                view === "plano" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}
            >
              <ClipboardList size={13} /> Plano
            </button>
          </div>

          {view === "mapa" ? (
            <>
              <Button size="sm" variant="outline" onClick={() => openCreateFrente(selectedCatId ?? "")}>
                <Plus size={13} className="mr-1" /> Nova Frente
              </Button>
              <Button size="sm" onClick={openCreateCat} className="bg-[#C8DA2D] text-[#0C1923] hover:bg-[#d4e640]">
                <Plus size={13} className="mr-1" /> Nova Categoria
              </Button>
            </>
          ) : (
            <Button size="sm" onClick={() => { setPlanSearch(""); setPlanPickerOpen(true); }}
              className="bg-[#C8DA2D] text-[#0C1923] hover:bg-[#d4e640]">
              <Plus size={13} className="mr-1" /> Adicionar ao Plano
            </Button>
          )}
        </div>
      </div>

      {view === "mapa" ? (

        /* ── Mapa: two-panel layout ── */
        <div className="flex gap-0 border border-border rounded-xl overflow-hidden" style={{ minHeight: "calc(100vh - 13rem)" }}>

          {/* Left sidebar */}
          <div className="w-56 shrink-0 border-r border-border overflow-y-auto bg-card/40 py-3 px-2 space-y-0.5">
            {categorias.length === 0 && (
              <div className="px-2 py-8 text-center">
                <BookOpen size={28} className="text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">Crie uma categoria para começar.</p>
              </div>
            )}
            {categorias.map(cat => {
              const catFrentes  = frentes.filter(f => f.categoria_id === cat.id);
              const isExpanded  = expandedCats.has(cat.id);
              const isCatActive = selectedCatId === cat.id && !selectedFrenteId;
              return (
                <div key={cat.id}>
                  <div className={cn(
                    "flex items-center gap-1 group px-2 py-1.5 rounded-lg transition-colors",
                    isCatActive ? "bg-muted/60" : "hover:bg-muted/50"
                  )}>
                    <button onClick={() => toggleCat(cat.id)}
                      className="shrink-0 p-0.5 text-muted-foreground">
                      {isExpanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                    </button>
                    <button
                      onClick={() => { setSelectedCatId(cat.id); setSelectedFrenteId(null); }}
                      className="flex-1 text-left text-sm font-semibold truncate min-w-0"
                    >
                      {cat.emoji} {cat.nome}
                    </button>
                    <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <button onClick={() => openEditCat(cat)} title="Editar"
                        className="p-0.5 text-muted-foreground hover:text-foreground transition-colors">
                        <Pencil size={10} />
                      </button>
                      <button onClick={() => { deleteCat.mutate(cat.id); if (selectedCatId === cat.id) { setSelectedCatId(null); setSelectedFrenteId(null); } }} title="Excluir"
                        className="p-0.5 text-muted-foreground hover:text-red-500 transition-colors">
                        <Trash2 size={10} />
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <>
                      {catFrentes.map(fr => (
                        <div key={fr.id} className={cn(
                          "group flex items-center gap-1 pl-6 pr-2 py-1 rounded-lg transition-colors",
                          selectedFrenteId === fr.id ? "bg-muted/60" : "hover:bg-muted/30"
                        )}>
                          <button
                            onClick={() => { setSelectedFrenteId(fr.id); setSelectedCatId(cat.id); }}
                            className={cn(
                              "flex-1 text-left text-sm truncate min-w-0 transition-colors",
                              selectedFrenteId === fr.id ? "text-[#C8DA2D] font-medium" : "text-muted-foreground hover:text-foreground"
                            )}
                          >
                            {fr.nome}
                          </button>
                          <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                            <button onClick={() => openEditFrente(fr)}
                              className="p-0.5 text-muted-foreground hover:text-foreground transition-colors">
                              <Pencil size={9} />
                            </button>
                            <button onClick={() => { deleteFrente.mutate(fr.id); if (selectedFrenteId === fr.id) setSelectedFrenteId(null); }}
                              className="p-0.5 text-muted-foreground hover:text-red-500 transition-colors">
                              <Trash2 size={9} />
                            </button>
                          </div>
                        </div>
                      ))}
                      {catFrentes.length === 0 && (
                        <p className="pl-7 py-1 text-xs text-muted-foreground italic">Nenhuma frente</p>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>

          {/* Right panel */}
          <div className="flex-1 overflow-y-auto p-5">
            {!selectedCatId ? (

              /* Empty state */
              <div className="flex flex-col items-center justify-center h-full text-center py-20">
                <BookOpen size={40} className="text-muted-foreground/20 mb-3" />
                <p className="text-sm text-muted-foreground">Selecione uma categoria no painel esquerdo para ver as frentes de estudo.</p>
              </div>

            ) : !selectedFrenteId ? (

              /* Category overview */
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-semibold">{selectedCat?.emoji} {selectedCat?.nome}</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {frentes.filter(f => f.categoria_id === selectedCatId).length} frente(s) de estudo
                    </p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => openCreateFrente(selectedCatId)}>
                    <Plus size={13} className="mr-1" /> Nova Frente
                  </Button>
                </div>

                {frentes.filter(f => f.categoria_id === selectedCatId).length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 border border-dashed border-border rounded-xl text-center">
                    <BookOpen size={32} className="text-muted-foreground/20 mb-2" />
                    <p className="text-sm text-muted-foreground">Nenhuma frente ainda.</p>
                    <button onClick={() => openCreateFrente(selectedCatId)}
                      className="mt-2 text-sm text-[#C8DA2D] hover:underline">
                      Criar primeira frente
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {frentes.filter(f => f.categoria_id === selectedCatId).map(fr => {
                      const stats = getFrenteStats(fr.id);
                      const pct = stats.total > 0 ? Math.round((stats.concluidos / stats.total) * 100) : 0;
                      return (
                        <button key={fr.id}
                          onClick={() => setSelectedFrenteId(fr.id)}
                          className="text-left bg-card border border-border rounded-xl p-4 hover:border-[#C8DA2D]/50 hover:shadow-sm transition-all group">
                          <div className="flex items-start justify-between mb-3">
                            <h3 className="text-sm font-semibold group-hover:text-[#C8DA2D] transition-colors leading-snug pr-2">
                              {fr.nome}
                            </h3>
                            <span className="text-sm font-bold text-[#C8DA2D] shrink-0">{pct}%</span>
                          </div>
                          <div className="w-full bg-muted rounded-full h-1.5 mb-2.5">
                            <div className="bg-[#C8DA2D] h-1.5 rounded-full transition-all" style={{ width: `${pct}%` }} />
                          </div>
                          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                            <span>{stats.concluidos}/{stats.total} itens</span>
                            {stats.required > 0 && (
                              <span>🔴 {stats.requiredDone}/{stats.required} obrig.</span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

            ) : (

              /* Frente detail */
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <div>
                    <button
                      onClick={() => setSelectedFrenteId(null)}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-0.5 mb-1"
                    >
                      <ChevronLeft size={12} /> {selectedCat?.emoji} {selectedCat?.nome}
                    </button>
                    <h2 className="text-xl font-semibold">{selectedFrente?.nome}</h2>
                  </div>
                  <Button size="sm" onClick={openCreateItem} className="bg-[#C8DA2D] text-[#0C1923] hover:bg-[#d4e640]">
                    <Plus size={13} className="mr-1" /> Novo Item
                  </Button>
                </div>

                {/* Progress card */}
                {totalItems > 0 && (
                  <div className="bg-card border border-border rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-muted-foreground">Progresso geral</p>
                        <p className="text-sm font-semibold">{concluidos}/{totalItems} concluídos</p>
                      </div>
                      <span className="text-2xl font-bold text-[#C8DA2D]">
                        {Math.round((concluidos / totalItems) * 100)}%
                      </span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div className="bg-[#C8DA2D] h-2 rounded-full transition-all"
                        style={{ width: `${(concluidos / totalItems) * 100}%` }} />
                    </div>
                    {required > 0 && (
                      <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-border">
                        <span>🔴 Obrigatórios: {requiredConcluidos}/{required}</span>
                        <span>{Math.round((requiredConcluidos / required) * 100)}%</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Item list */}
                {lIt ? (
                  <div className="space-y-2">
                    {[0, 1, 2].map(i => <Skeleton key={i} className="h-14 rounded-xl" />)}
                  </div>
                ) : frenteItens.length === 0 ? (
                  <div className="bg-card border border-border rounded-xl p-8 text-center">
                    <p className="text-sm text-muted-foreground">Nenhum item ainda. Adicione livros, cursos, artigos…</p>
                  </div>
                ) : (
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext items={frenteItens.map(i => i.id)} strategy={verticalListSortingStrategy}>
                      <div className="space-y-2">
                        {frenteItens.map(item => (
                          <SortableItemCard
                            key={item.id}
                            item={item}
                            inPlano={planItemIds.has(item.id)}
                            onEdit={() => openEditItem(item)}
                            onDelete={() => deleteItem.mutate(item.id)}
                            onToggle={() => updateItem.mutate({ id: item.id, d: { concluido: !item.concluido } })}
                            onAddToPlano={() => handleAddItemToPlano(item)}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                )}
              </div>
            )}
          </div>
        </div>

      ) : (

        /* ── Plano de Estudos ── */
        <div className="space-y-4 max-w-2xl mx-auto">
          <p className="text-sm text-muted-foreground">
            {localPlano.length} item{localPlano.length !== 1 ? "ns" : ""} no plano · arraste para reordenar
          </p>

          {localPlano.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center border border-dashed border-border rounded-2xl">
              <ClipboardList size={40} className="text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">Plano vazio. Monte sua sequência de estudos.</p>
              <button onClick={() => { setPlanSearch(""); setPlanPickerOpen(true); }}
                className="mt-2 text-sm text-[#C8DA2D] hover:underline">
                Adicionar primeiro item
              </button>
            </div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handlePlanDragEnd}>
              <SortableContext items={localPlano.map(p => p.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {localPlano.map((item, index) => (
                    <SortablePlanItem
                      key={item.id}
                      item={item}
                      index={index}
                      onRemove={() => removeFromPlano.mutate(item.id)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}

          {/* Plan picker dialog */}
          <Dialog open={planPickerOpen} onOpenChange={v => { setPlanPickerOpen(v); if (!v) setPlanSearch(""); }}>
            <DialogContent className="max-w-lg flex flex-col" style={{ maxHeight: "80vh" }}>
              <DialogHeader>
                <DialogTitle>Adicionar ao Plano de Estudos</DialogTitle>
              </DialogHeader>
              <Input
                placeholder="Buscar item..."
                value={planSearch}
                onChange={e => setPlanSearch(e.target.value)}
                autoFocus
                className="mt-1"
              />
              <div className="flex-1 overflow-y-auto space-y-0.5 pr-1 mt-2">
                {planDisponiveis.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    {itens.length === 0 ? "Nenhum item cadastrado." : "Nenhum item disponível."}
                  </p>
                ) : (
                  planDisponiveis.map(item => (
                    <button key={item.id}
                      onClick={() => addToPlano.mutate({
                        item_id: item.id, titulo: item.titulo, tipo: item.tipo,
                        frente_nome: item._frente_nome, cat_emoji: item._cat_emoji, cat_nome: item._cat_nome,
                      })}
                      className="w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted/60 transition-colors group">
                      <span className="text-lg shrink-0">{TIPO_ICON[item.tipo] ?? "📌"}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.titulo}</p>
                        <p className="text-[10px] text-muted-foreground truncate">
                          {item._cat_emoji} {item._cat_nome}{item._frente_nome ? ` · ${item._frente_nome}` : ""}
                        </p>
                      </div>
                      <Plus size={14} className="text-muted-foreground group-hover:text-[#C8DA2D] transition-colors shrink-0" />
                    </button>
                  ))
                )}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      )}

      {/* ── Dialogs ── */}

      {/* Category dialog */}
      <Dialog open={catOpen} onOpenChange={v => { setCatOpen(v); if (!v) setEditingCat(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{editingCat ? "Editar Categoria" : "Nova Categoria"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex gap-3 items-end">
              <div>
                <Label>Emoji</Label>
                <div className="mt-1">
                  <EmojiPicker value={catForm.emoji} onChange={v => setCatForm(f => ({ ...f, emoji: v }))} />
                </div>
              </div>
              <div className="flex-1">
                <Label>Nome</Label>
                <Input value={catForm.nome} onChange={e => setCatForm(f => ({ ...f, nome: e.target.value }))}
                  placeholder="Ex: Programação, Negócios…" className="mt-1" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCatOpen(false)}>Cancelar</Button>
            <Button onClick={handleCatSubmit} disabled={!catForm.nome || createCat.isPending || updateCat.isPending}
              className="bg-[#C8DA2D] text-[#0C1923] hover:bg-[#d4e640]">
              {editingCat ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Frente dialog */}
      <Dialog open={frenteOpen} onOpenChange={v => { setFrenteOpen(v); if (!v) setEditingFrente(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{editingFrente ? "Editar Frente" : "Nova Frente de Estudo"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Categoria</Label>
              <Select value={frenteForm.categoria_id} onValueChange={v => setFrenteForm(f => ({ ...f, categoria_id: v }))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione…" /></SelectTrigger>
                <SelectContent>
                  {categorias.map(c => <SelectItem key={c.id} value={c.id}>{c.emoji} {c.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Nome</Label>
              <Input value={frenteForm.nome} onChange={e => setFrenteForm(f => ({ ...f, nome: e.target.value }))}
                placeholder="Ex: Livros, Cursos Online, Artigos…" className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFrenteOpen(false)}>Cancelar</Button>
            <Button onClick={handleFrenteSubmit} disabled={!frenteForm.nome || !frenteForm.categoria_id || createFrente.isPending || updateFrente.isPending}
              className="bg-[#C8DA2D] text-[#0C1923] hover:bg-[#d4e640]">
              {editingFrente ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Item dialog */}
      <Dialog open={itemOpen} onOpenChange={v => { setItemOpen(v); if (!v) setEditingItem(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editingItem ? "Editar Item" : "Novo Item de Estudo"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Título *</Label>
              <Input value={itemForm.titulo} onChange={e => setItemForm(f => ({ ...f, titulo: e.target.value }))}
                placeholder="Nome do livro, curso, artigo…" className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tipo</Label>
                <Select value={itemForm.tipo} onValueChange={v => setItemForm(f => ({ ...f, tipo: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIPOS.map(t => <SelectItem key={t} value={t}>{TIPO_ICON[t]} {t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Classificação</Label>
                <div className="flex gap-2 mt-1">
                  <button onClick={() => setItemForm(f => ({ ...f, obrigatorio: true }))}
                    className={cn("flex-1 py-2 text-xs rounded-md border transition-colors",
                      itemForm.obrigatorio ? "bg-red-500/15 border-red-500/50 text-red-400" : "border-border text-muted-foreground hover:border-foreground/40")}>
                    🔴 Obrig.
                  </button>
                  <button onClick={() => setItemForm(f => ({ ...f, obrigatorio: false }))}
                    className={cn("flex-1 py-2 text-xs rounded-md border transition-colors",
                      !itemForm.obrigatorio ? "bg-blue-500/15 border-blue-500/50 text-blue-400" : "border-border text-muted-foreground hover:border-foreground/40")}>
                    ⚪ Opc.
                  </button>
                </div>
              </div>
            </div>
            <div>
              <Label>Progresso: {itemForm.progresso}%</Label>
              <input type="range" min={0} max={100} step={5} value={itemForm.progresso}
                onChange={e => setItemForm(f => ({ ...f, progresso: parseInt(e.target.value) }))}
                className="w-full mt-2 accent-[#C8DA2D]" />
            </div>
            <div>
              <Label>URL (opcional)</Label>
              <Input value={itemForm.url} onChange={e => setItemForm(f => ({ ...f, url: e.target.value }))}
                placeholder="https://…" className="mt-1" />
            </div>
            <div>
              <Label>Notas</Label>
              <Textarea value={itemForm.notas} onChange={e => setItemForm(f => ({ ...f, notas: e.target.value }))}
                rows={2} placeholder="Observações, resumo…" className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setItemOpen(false)}>Cancelar</Button>
            <Button onClick={handleItemSubmit} disabled={!itemForm.titulo || createItem.isPending || updateItem.isPending}
              className="bg-[#C8DA2D] text-[#0C1923] hover:bg-[#d4e640]">
              {editingItem ? "Salvar" : "Adicionar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── SortableItemCard ────────────────────────────────────────────────────────────

function SortableItemCard({ item, inPlano, onEdit, onDelete, onToggle, onAddToPlano }: {
  item: ItemEstudo;
  inPlano: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
  onAddToPlano: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} {...attributes}
      className={cn(isDragging && "opacity-30")}>
      <div className={cn(
        "flex items-center gap-3 bg-card border rounded-xl px-3 py-3 group transition-all",
        item.concluido ? "opacity-60 border-border" : "hover:border-[#C8DA2D]/40",
      )}>
        <div {...listeners} className="cursor-grab active:cursor-grabbing touch-none text-muted-foreground/40 group-hover:text-muted-foreground/60 shrink-0">
          <GripVertical size={13} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1 flex-wrap">
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium">
              {TIPO_ICON[item.tipo] ?? "📌"} {item.tipo}
            </span>
            {item.obrigatorio ? (
              <span className="text-[10px] px-1 py-0.5 rounded bg-red-500/10 text-red-400">🔴 obrigatório</span>
            ) : (
              <span className="text-[10px] px-1 py-0.5 rounded bg-blue-500/10 text-blue-400">⚪ opcional</span>
            )}
          </div>
          <p className={cn("text-sm font-medium leading-snug", item.concluido && "line-through text-muted-foreground")}>
            {item.titulo}
          </p>
          {item.progresso > 0 && !item.concluido && (
            <div className="mt-1.5 flex items-center gap-2">
              <div className="flex-1 bg-muted rounded-full h-1.5">
                <div className="bg-[#C8DA2D] h-1.5 rounded-full" style={{ width: `${item.progresso}%` }} />
              </div>
              <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">{item.progresso}%</span>
            </div>
          )}
          {item.url && (
            <a href={item.url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
              className="text-[10px] text-blue-400 hover:underline mt-0.5 block truncate">
              🔗 {item.url}
            </a>
          )}
          {item.notas && (
            <p className="text-[10px] text-muted-foreground mt-0.5 truncate italic">{item.notas}</p>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {/* Add to plan */}
          <button onClick={onAddToPlano} title={inPlano ? "Já no plano" : "Adicionar ao plano"}
            className={cn("p-1.5 rounded-lg transition-colors",
              inPlano
                ? "text-[#C8DA2D] cursor-default"
                : "text-muted-foreground hover:text-[#C8DA2D] hover:bg-[#C8DA2D]/10 opacity-0 group-hover:opacity-100"
            )}>
            <ClipboardList size={12} />
          </button>

          {/* Complete */}
          <button onClick={onToggle} title={item.concluido ? "Marcar como pendente" : "Marcar como concluído"}
            className={cn("p-1.5 rounded-full border transition-all",
              item.concluido
                ? "bg-green-500/15 border-green-500/50 text-green-400"
                : "border-border text-muted-foreground hover:border-green-500/50 hover:text-green-400"
            )}>
            <Check size={12} />
          </button>
          <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={onEdit} className="p-1 text-muted-foreground hover:text-blue-400 transition-colors"><Pencil size={12} /></button>
            <button onClick={onDelete} className="p-1 text-muted-foreground hover:text-red-500 transition-colors"><Trash2 size={12} /></button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── SortablePlanItem ────────────────────────────────────────────────────────────

function SortablePlanItem({ item, index, onRemove }: {
  item: PlanoItem;
  index: number;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.45 : 1 };
  return (
    <div ref={setNodeRef} style={style}
      className={cn("flex items-center gap-3 bg-card border rounded-xl px-4 py-3 group transition-shadow",
        isDragging && "shadow-lg border-[#C8DA2D]/40")}>
      <span className="text-xs font-bold text-muted-foreground/40 w-5 text-center select-none shrink-0">
        {index + 1}
      </span>
      <button
        className="text-muted-foreground/30 hover:text-muted-foreground transition-colors cursor-grab active:cursor-grabbing shrink-0 touch-none"
        {...attributes} {...listeners}>
        <GripVertical size={16} />
      </button>
      <span className="text-xl shrink-0">{TIPO_ICON[item.tipo ?? ""] ?? "📌"}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{item.titulo}</p>
        <p className="text-[10px] text-muted-foreground truncate">
          {item.cat_emoji} {item.cat_nome}{item.frente_nome ? ` · ${item.frente_nome}` : ""}
        </p>
      </div>
      <button onClick={onRemove}
        className="p-1.5 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors shrink-0 opacity-0 group-hover:opacity-100">
        <X size={15} />
      </button>
    </div>
  );
}
