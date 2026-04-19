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
  Plus, Trash2, GripVertical, Pencil, Check, BookOpen, ChevronDown, ChevronRight,
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

const TIPOS = ["Livro", "Curso", "Vídeo", "Artigo", "Podcast", "Outro"];
const TIPO_ICON: Record<string, string> = {
  Livro: "📗", Curso: "🎓", Vídeo: "▶️", Artigo: "📄", Podcast: "🎙️", Outro: "📌",
};

interface CatForm { nome: string; emoji: string; }
interface FrenteForm { nome: string; categoria_id: string; }
interface ItemForm {
  titulo: string; tipo: string; obrigatorio: boolean;
  progresso: number; url: string; notas: string;
}

const emptyCatForm = (): CatForm => ({ nome: "", emoji: "📚" });
const emptyFrenteForm = (catId = ""): FrenteForm => ({ nome: "", categoria_id: catId });
const emptyItemForm = (): ItemForm => ({
  titulo: "", tipo: "Livro", obrigatorio: true, progresso: 0, url: "", notas: "",
});

export default function Estudos() {
  const qc = useQueryClient();
  const [selectedFrenteId, setSelectedFrenteId] = useState<string | null>(null);
  const [localItens, setLocalItens] = useState<ItemEstudo[]>([]);
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());

  const [catOpen, setCatOpen] = useState(false);
  const [catForm, setCatForm] = useState<CatForm>(emptyCatForm());
  const [editingCat, setEditingCat] = useState<CatEstudo | null>(null);

  const [frenteOpen, setFrenteOpen] = useState(false);
  const [frenteForm, setFrenteForm] = useState<FrenteForm>(emptyFrenteForm());
  const [editingFrente, setEditingFrente] = useState<FrenteEstudo | null>(null);

  const [itemOpen, setItemOpen] = useState(false);
  const [itemForm, setItemForm] = useState<ItemForm>(emptyItemForm());
  const [editingItem, setEditingItem] = useState<ItemEstudo | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

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

  useEffect(() => { setLocalItens(itens); }, [itens]);

  useEffect(() => {
    if (categorias.length > 0)
      setExpandedCats(new Set(categorias.map(c => c.id)));
  }, [categorias]);

  const invCats   = () => qc.invalidateQueries({ queryKey: ["estudos-cats"] });
  const invFrentes = () => qc.invalidateQueries({ queryKey: ["estudos-frentes"] });
  const invItens  = () => qc.invalidateQueries({ queryKey: ["estudos-itens"] });

  const createCat = useMutation({
    mutationFn: (d: object) => apiFetch("/api/v1/estudos/categorias", { method: "POST", body: JSON.stringify(d) }),
    onSuccess: () => { invCats(); setCatOpen(false); },
  });
  const updateCat = useMutation({
    mutationFn: ({ id, d }: { id: string; d: object }) =>
      apiFetch(`/api/v1/estudos/categorias/${id}`, { method: "PATCH", body: JSON.stringify(d) }),
    onSuccess: () => { invCats(); setCatOpen(false); setEditingCat(null); },
  });
  const deleteCat = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/v1/estudos/categorias/${id}`, { method: "DELETE" }),
    onSuccess: invCats,
  });

  const createFrente = useMutation({
    mutationFn: (d: object) => apiFetch("/api/v1/estudos/frentes", { method: "POST", body: JSON.stringify(d) }),
    onSuccess: () => { invFrentes(); setFrenteOpen(false); },
  });
  const updateFrente = useMutation({
    mutationFn: ({ id, d }: { id: string; d: object }) =>
      apiFetch(`/api/v1/estudos/frentes/${id}`, { method: "PATCH", body: JSON.stringify(d) }),
    onSuccess: () => { invFrentes(); setFrenteOpen(false); setEditingFrente(null); },
  });
  const deleteFrente = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/v1/estudos/frentes/${id}`, { method: "DELETE" }),
    onSuccess: invFrentes,
  });

  const createItem = useMutation({
    mutationFn: (d: object) => apiFetch("/api/v1/estudos/itens", { method: "POST", body: JSON.stringify(d) }),
    onSuccess: () => { invItens(); setItemOpen(false); },
  });
  const updateItem = useMutation({
    mutationFn: ({ id, d }: { id: string; d: object }) =>
      apiFetch(`/api/v1/estudos/itens/${id}`, { method: "PATCH", body: JSON.stringify(d) }),
    onSuccess: () => { invItens(); setItemOpen(false); setEditingItem(null); },
  });
  const deleteItem = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/v1/estudos/itens/${id}`, { method: "DELETE" }),
    onSuccess: invItens,
  });
  const reorderItems = useMutation({
    mutationFn: (ids: string[]) =>
      apiFetch("/api/v1/estudos/itens/reorder", { method: "POST", body: JSON.stringify({ ids }) }),
    onSuccess: invItens,
  });

  const frenteItens = useMemo(
    () => localItens.filter(i => i.frente_id === selectedFrenteId).sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0)),
    [localItens, selectedFrenteId]
  );

  const selectedFrente = frentes.find(f => f.id === selectedFrenteId);
  const selectedCat = categorias.find(c => c.id === selectedFrente?.categoria_id);

  const totalItems = frenteItens.length;
  const concluidos = frenteItens.filter(i => i.concluido).length;
  const required = frenteItens.filter(i => i.obrigatorio).length;
  const requiredConcluidos = frenteItens.filter(i => i.obrigatorio && i.concluido).length;

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

  function openCreateCat() { setEditingCat(null); setCatForm(emptyCatForm()); setCatOpen(true); }
  function openEditCat(cat: CatEstudo) { setEditingCat(cat); setCatForm({ nome: cat.nome, emoji: cat.emoji }); setCatOpen(true); }

  function openCreateFrente(catId: string) { setEditingFrente(null); setFrenteForm(emptyFrenteForm(catId)); setFrenteOpen(true); }
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
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  if (lCat || lFr) return <Skeleton className="h-64 rounded-xl" />;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Estudos</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Mapa de estudos, leituras e cursos</p>
        </div>
        <Button size="sm" onClick={openCreateCat} className="bg-[#C8DA2D] text-[#0C1923] hover:bg-[#d4e640]">
          <Plus size={14} className="mr-1" /> Nova Categoria
        </Button>
      </div>

      {/* Two-panel layout */}
      <div className="flex gap-0 border border-border rounded-xl overflow-hidden" style={{ minHeight: "calc(100vh - 13rem)" }}>

        {/* Left panel */}
        <div className="w-56 shrink-0 border-r border-border overflow-y-auto bg-card/40 py-3 px-2 space-y-0.5">
          {categorias.length === 0 && (
            <div className="px-2 py-8 text-center">
              <BookOpen size={28} className="text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">Crie uma categoria para começar.</p>
            </div>
          )}
          {categorias.map(cat => {
            const catFrentes = frentes.filter(f => f.categoria_id === cat.id);
            const isExpanded = expandedCats.has(cat.id);
            return (
              <div key={cat.id}>
                <div className="flex items-center gap-1 group px-2 py-1.5 rounded-lg hover:bg-muted/50">
                  <button onClick={() => toggleCat(cat.id)} className="flex items-center gap-1.5 flex-1 text-left min-w-0">
                    {isExpanded
                      ? <ChevronDown size={11} className="shrink-0 text-muted-foreground" />
                      : <ChevronRight size={11} className="shrink-0 text-muted-foreground" />}
                    <span className="text-sm font-semibold truncate">{cat.emoji} {cat.nome}</span>
                  </button>
                  <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <button onClick={() => openEditCat(cat)} title="Editar" className="p-0.5 text-muted-foreground hover:text-foreground transition-colors">
                      <Pencil size={10} />
                    </button>
                    <button onClick={() => deleteCat.mutate(cat.id)} title="Excluir" className="p-0.5 text-muted-foreground hover:text-red-500 transition-colors">
                      <Trash2 size={10} />
                    </button>
                    <button onClick={() => openCreateFrente(cat.id)} title="Nova frente" className="p-0.5 text-muted-foreground hover:text-[#C8DA2D] transition-colors">
                      <Plus size={10} />
                    </button>
                  </div>
                </div>
                {isExpanded && (
                  <>
                    {catFrentes.map(fr => (
                      <div key={fr.id} className="group flex items-center gap-1 pl-6 pr-2 py-1 rounded-lg hover:bg-muted/30">
                        <button
                          onClick={() => setSelectedFrenteId(fr.id)}
                          className={cn(
                            "flex-1 text-left text-sm truncate min-w-0 transition-colors",
                            selectedFrenteId === fr.id
                              ? "text-[#C8DA2D] font-medium"
                              : "text-muted-foreground hover:text-foreground"
                          )}
                        >
                          {fr.nome}
                        </button>
                        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                          <button onClick={() => openEditFrente(fr)} className="p-0.5 text-muted-foreground hover:text-foreground transition-colors"><Pencil size={9} /></button>
                          <button onClick={() => {
                            deleteFrente.mutate(fr.id);
                            if (selectedFrenteId === fr.id) setSelectedFrenteId(null);
                          }} className="p-0.5 text-muted-foreground hover:text-red-500 transition-colors"><Trash2 size={9} /></button>
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
          {!selectedFrenteId ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-20">
              <BookOpen size={40} className="text-muted-foreground/20 mb-3" />
              <p className="text-sm text-muted-foreground">Selecione uma frente de estudo no painel esquerdo.</p>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Frente header */}
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">{selectedCat?.emoji} {selectedCat?.nome}</p>
                <h2 className="text-xl font-semibold">{selectedFrente?.nome}</h2>
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
                    <div
                      className="bg-[#C8DA2D] h-2 rounded-full transition-all"
                      style={{ width: `${(concluidos / totalItems) * 100}%` }}
                    />
                  </div>
                  {required > 0 && (
                    <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-border">
                      <span>🔴 Obrigatórios: {requiredConcluidos}/{required}</span>
                      <span>{required > 0 ? Math.round((requiredConcluidos / required) * 100) : 0}%</span>
                    </div>
                  )}
                </div>
              )}

              {/* Add item */}
              <div className="flex justify-end">
                <Button size="sm" onClick={openCreateItem} className="bg-[#C8DA2D] text-[#0C1923] hover:bg-[#d4e640]">
                  <Plus size={14} className="mr-1" /> Novo Item
                </Button>
              </div>

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
                          onEdit={() => openEditItem(item)}
                          onDelete={() => deleteItem.mutate(item.id)}
                          onToggle={() => updateItem.mutate({ id: item.id, d: { concluido: !item.concluido } })}
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

      {/* Category dialog */}
      <Dialog open={catOpen} onOpenChange={v => { setCatOpen(v); if (!v) setEditingCat(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{editingCat ? "Editar Categoria" : "Nova Categoria"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Emoji</Label>
                <Input value={catForm.emoji} onChange={e => setCatForm(f => ({ ...f, emoji: e.target.value }))}
                  maxLength={2} className="mt-1 text-center text-lg" />
              </div>
              <div className="col-span-2">
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
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
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
                  <button
                    onClick={() => setItemForm(f => ({ ...f, obrigatorio: true }))}
                    className={cn("flex-1 py-2 text-xs rounded-md border transition-colors",
                      itemForm.obrigatorio
                        ? "bg-red-500/15 border-red-500/50 text-red-400"
                        : "border-border text-muted-foreground hover:border-foreground/40"
                    )}>
                    🔴 Obrig.
                  </button>
                  <button
                    onClick={() => setItemForm(f => ({ ...f, obrigatorio: false }))}
                    className={cn("flex-1 py-2 text-xs rounded-md border transition-colors",
                      !itemForm.obrigatorio
                        ? "bg-blue-500/15 border-blue-500/50 text-blue-400"
                        : "border-border text-muted-foreground hover:border-foreground/40"
                    )}>
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

function SortableItemCard({ item, onEdit, onDelete, onToggle }: {
  item: ItemEstudo;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
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
            <a href={item.url} target="_blank" rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              className="text-[10px] text-blue-400 hover:underline mt-0.5 block truncate">
              🔗 {item.url}
            </a>
          )}
          {item.notas && (
            <p className="text-[10px] text-muted-foreground mt-0.5 truncate italic">{item.notas}</p>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button onClick={onToggle}
            title={item.concluido ? "Marcar como pendente" : "Marcar como concluído"}
            className={cn(
              "p-1.5 rounded-full border transition-all",
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
