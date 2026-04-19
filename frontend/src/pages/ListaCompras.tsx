import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ShoppingCart, Star, Plus, Trash2, Check, Pencil, FolderOpen } from "lucide-react";
import { apiFetch, fmtBRL } from "@/lib/api";
import { ListaComprasItem } from "@/types";
import { cn } from "@/lib/utils";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// ── Types ─────────────────────────────────────────────────────────────────────

type Tipo = "mercado" | "desejo";

interface ItemPayload {
  nome: string;
  quantidade: number;
  unidade: string;
  tipo: Tipo;
  valor_esperado?: number;
  categoria?: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const UNIDADES = ["un", "kg", "g", "L", "ml", "cx", "pc", "m", "par"];
const NO_CAT = "__sem_categoria__";

// ── Category hook ─────────────────────────────────────────────────────────────

function useCategorias(tipo: Tipo, items: ListaComprasItem[]) {
  const key = `lista_cats_${tipo}`;

  const [custom, setCustom] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(key) ?? "[]"); } catch { return []; }
  });

  useEffect(() => {
    try { setCustom(JSON.parse(localStorage.getItem(key) ?? "[]")); } catch { setCustom([]); }
  }, [key]);

  const fromItems = useMemo(
    () => [...new Set(items.filter((i) => (i.tipo ?? "mercado") === tipo && i.categoria).map((i) => i.categoria!))],
    [items, tipo]
  );

  const all = useMemo(
    () => [...new Set([...fromItems, ...custom])].sort((a, b) => a.localeCompare(b, "pt-BR")),
    [fromItems, custom]
  );

  function add(name: string) {
    const t = name.trim();
    if (!t || all.includes(t)) return;
    const next = [...custom, t];
    setCustom(next);
    localStorage.setItem(key, JSON.stringify(next));
  }

  function remove(name: string) {
    const next = custom.filter((c) => c !== name);
    setCustom(next);
    localStorage.setItem(key, JSON.stringify(next));
    return fromItems.includes(name); // returns true if it still exists via items
  }

  return { all, fromItems, add, remove };
}

// ── Item Dialog (create + edit) ───────────────────────────────────────────────

interface ItemDialogProps {
  open: boolean;
  defaultTipo: Tipo;
  editingItem?: ListaComprasItem | null;
  categorias: string[];
  onClose: () => void;
  onSave: (p: ItemPayload) => void;
  loading: boolean;
}

function ItemDialog({ open, defaultTipo, editingItem, categorias, onClose, onSave, loading }: ItemDialogProps) {
  const isEdit = !!editingItem;

  const [nome, setNome] = useState("");
  const [qtd, setQtd] = useState("1");
  const [unidade, setUnidade] = useState("un");
  const [valor, setValor] = useState("");
  const [cat, setCat] = useState(NO_CAT);
  const [tipo, setTipo] = useState<Tipo>(defaultTipo);
  const [newCatInput, setNewCatInput] = useState("");
  const [showNewCat, setShowNewCat] = useState(false);

  useEffect(() => {
    if (open) {
      if (editingItem) {
        setNome(editingItem.nome);
        setQtd(String(editingItem.quantidade));
        setUnidade(editingItem.unidade);
        setValor(editingItem.valor_esperado != null ? String(editingItem.valor_esperado) : "");
        setCat(editingItem.categoria ?? NO_CAT);
        setTipo((editingItem.tipo ?? "mercado") as Tipo);
      } else {
        setNome(""); setQtd("1"); setUnidade("un"); setValor(""); setCat(NO_CAT); setTipo(defaultTipo);
      }
      setNewCatInput(""); setShowNewCat(false);
    }
  }, [open, editingItem, defaultTipo]);

  function handleClose() { onClose(); }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim()) return;
    const resolvedCat = showNewCat ? newCatInput.trim() : (cat === NO_CAT ? undefined : cat);
    onSave({
      nome: nome.trim(),
      quantidade: parseFloat(qtd) || 1,
      unidade,
      tipo,
      ...(valor ? { valor_esperado: parseFloat(valor) } : {}),
      ...(resolvedCat ? { categoria: resolvedCat } : {}),
    });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar item" : "Novo item"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4 mt-2">
          {/* Tipo toggle */}
          <div>
            <Label className="text-xs mb-2 block">Tipo</Label>
            <div className="flex gap-2">
              {(["mercado", "desejo"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTipo(t)}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border text-sm font-medium transition-colors",
                    tipo === t ? "bg-[#C8DA2D] border-[#C8DA2D] text-[#0C1923]" : "border-border text-muted-foreground hover:text-foreground"
                  )}
                >
                  {t === "mercado" ? <ShoppingCart size={14} /> : <Star size={14} />}
                  {t === "mercado" ? "Mercado" : "Desejo"}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label htmlFor="nome" className="text-xs mb-1.5 block">Nome *</Label>
            <Input
              id="nome"
              autoFocus
              placeholder={tipo === "mercado" ? "ex: Detergente, Arroz…" : "ex: Tênis Nike, Fone…"}
              value={nome}
              onChange={(e) => setNome(e.target.value)}
            />
          </div>

          <div className="flex gap-2">
            <div className="flex-1">
              <Label htmlFor="qtd" className="text-xs mb-1.5 block">Quantidade</Label>
              <Input id="qtd" type="number" min="0" step="any" value={qtd} onChange={(e) => setQtd(e.target.value)} />
            </div>
            <div className="w-28">
              <Label htmlFor="unidade" className="text-xs mb-1.5 block">Unidade</Label>
              <select
                id="unidade"
                className="w-full h-9 rounded-md border border-input bg-background px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                value={unidade}
                onChange={(e) => setUnidade(e.target.value)}
              >
                {UNIDADES.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>

          <div>
            <Label htmlFor="valor" className="text-xs mb-1.5 block">Valor esperado (R$)</Label>
            <Input id="valor" type="number" min="0" step="0.01" placeholder="opcional" value={valor} onChange={(e) => setValor(e.target.value)} />
          </div>

          <div>
            <Label className="text-xs mb-1.5 block">Categoria</Label>
            {showNewCat ? (
              <div className="flex gap-2">
                <Input
                  autoFocus
                  placeholder="Nome da nova categoria"
                  value={newCatInput}
                  onChange={(e) => setNewCatInput(e.target.value)}
                />
                <Button type="button" variant="outline" size="sm" onClick={() => setShowNewCat(false)}>
                  Voltar
                </Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Select value={cat} onValueChange={setCat}>
                  <SelectTrigger className="flex-1"><SelectValue placeholder="Sem categoria" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_CAT}>— Sem categoria</SelectItem>
                    {categorias.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button type="button" variant="outline" size="sm" onClick={() => setShowNewCat(true)} title="Nova categoria">
                  <Plus size={13} />
                </Button>
              </div>
            )}
          </div>

          <div className="flex gap-2 pt-1">
            <Button type="button" variant="outline" className="flex-1" onClick={handleClose}>Cancelar</Button>
            <Button type="submit" disabled={!nome.trim() || loading} className="flex-1">
              {loading ? "Salvando…" : isEdit ? "Salvar" : "Adicionar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Manage Categories Dialog ──────────────────────────────────────────────────

interface ManageCatProps {
  open: boolean;
  onClose: () => void;
  categorias: string[];
  fromItems: string[];
  onAdd: (name: string) => void;
  onRemove: (name: string) => void;
}

function ManageCatDialog({ open, onClose, categorias, fromItems, onAdd, onRemove }: ManageCatProps) {
  const [input, setInput] = useState("");

  function handleAdd() {
    if (input.trim()) { onAdd(input.trim()); setInput(""); }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-xs">
        <DialogHeader><DialogTitle>Gerenciar Categorias</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="flex gap-2">
            <Input
              placeholder="Nova categoria…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAdd())}
            />
            <Button type="button" onClick={handleAdd} disabled={!input.trim()} size="sm">
              <Plus size={13} />
            </Button>
          </div>
          <div className="space-y-1 max-h-60 overflow-y-auto">
            {categorias.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhuma categoria criada.</p>
            )}
            {categorias.map((c) => (
              <div key={c} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/40">
                <span className="flex-1 text-sm">{c}</span>
                {fromItems.includes(c) && (
                  <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">em uso</span>
                )}
                <button
                  onClick={() => onRemove(c)}
                  className="text-muted-foreground hover:text-red-500 transition-colors"
                  title={fromItems.includes(c) ? "Existe em itens, mas pode remover da lista" : "Remover"}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Item Row ──────────────────────────────────────────────────────────────────

interface ItemRowProps {
  item: ListaComprasItem;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function ItemRow({ item, onToggle, onEdit, onDelete }: ItemRowProps) {
  return (
    <div className={cn("flex items-center gap-3 px-3 py-2.5 rounded-lg group transition-colors", item.comprado ? "opacity-45" : "hover:bg-muted/40")}>
      <button
        onClick={onToggle}
        className={cn(
          "flex-shrink-0 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors",
          item.comprado ? "bg-[#C8DA2D] border-[#C8DA2D]" : "border-border hover:border-[#C8DA2D]/60"
        )}
      >
        {item.comprado && <Check size={11} className="text-[#0C1923]" strokeWidth={3} />}
      </button>

      <span className={cn("flex-1 text-sm", item.comprado ? "line-through text-muted-foreground" : "text-foreground")}>
        {item.nome}
      </span>

      {(item.quantidade !== 1 || item.unidade !== "un") && (
        <span className="text-muted-foreground text-xs whitespace-nowrap">{item.quantidade} {item.unidade}</span>
      )}

      {item.valor_esperado != null && (
        <span className="text-[#C8DA2D] text-xs font-medium whitespace-nowrap">{fmtBRL(item.valor_esperado)}</span>
      )}

      <button
        onClick={onEdit}
        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-blue-400 transition-all"
      >
        <Pencil size={12} />
      </button>
      <button
        onClick={onDelete}
        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"
      >
        <Trash2 size={13} />
      </button>
    </div>
  );
}

// ── Section ────────────────────────────────────────────────────────────────────

interface SectionProps {
  cat: string;
  items: ListaComprasItem[];
  onToggle: (id: string, comprado: boolean) => void;
  onEdit: (item: ListaComprasItem) => void;
  onDelete: (id: string) => void;
}

function Section({ cat, items, onToggle, onEdit, onDelete }: SectionProps) {
  const pending = items.filter((i) => !i.comprado);
  const done    = items.filter((i) => i.comprado);
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
        <span className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">{cat}</span>
        <span className="text-muted-foreground text-xs">{pending.length}/{items.length}</span>
      </div>
      <div className="p-2">
        {pending.map((item) => (
          <ItemRow key={item.id} item={item}
            onToggle={() => onToggle(item.id, true)}
            onEdit={() => onEdit(item)}
            onDelete={() => onDelete(item.id)} />
        ))}
        {done.map((item) => (
          <ItemRow key={item.id} item={item}
            onToggle={() => onToggle(item.id, false)}
            onEdit={() => onEdit(item)}
            onDelete={() => onDelete(item.id)} />
        ))}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

type Tab = "mercado" | "desejo";

export default function ListaCompras() {
  const qc = useQueryClient();
  const [tab, setTab]           = useState<Tab>("mercado");
  const [showAdd, setShowAdd]   = useState(false);
  const [editingItem, setEditingItem] = useState<ListaComprasItem | null>(null);
  const [manageCat, setManageCat] = useState(false);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["lista-compras"],
    queryFn: () => apiFetch<ListaComprasItem[]>("/api/v1/lista-compras"),
  });

  const { all: categorias, fromItems, add: addCat, remove: removeCat } = useCategorias(tab, items);

  const createMutation = useMutation({
    mutationFn: (payload: ItemPayload) =>
      apiFetch<ListaComprasItem>("/api/v1/lista-compras", { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["lista-compras"] }); setShowAdd(false); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: object }) =>
      apiFetch<ListaComprasItem>(`/api/v1/lista-compras/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["lista-compras"] }); setEditingItem(null); },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, comprado }: { id: string; comprado: boolean }) =>
      apiFetch<ListaComprasItem>(`/api/v1/lista-compras/${id}`, { method: "PATCH", body: JSON.stringify({ comprado }) }),
    onMutate: async ({ id, comprado }) => {
      await qc.cancelQueries({ queryKey: ["lista-compras"] });
      const prev = qc.getQueryData<ListaComprasItem[]>(["lista-compras"]);
      qc.setQueryData<ListaComprasItem[]>(["lista-compras"], (old = []) => old.map((i) => i.id === id ? { ...i, comprado } : i));
      return { prev };
    },
    onError: (_e, _v, ctx) => { if (ctx?.prev) qc.setQueryData(["lista-compras"], ctx.prev); },
    onSettled: () => qc.invalidateQueries({ queryKey: ["lista-compras"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/api/v1/lista-compras/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lista-compras"] }),
  });

  function handleSave(p: ItemPayload) {
    if (editingItem) {
      updateMutation.mutate({ id: editingItem.id, payload: p });
    } else {
      createMutation.mutate(p);
    }
  }

  function openEdit(item: ListaComprasItem) { setEditingItem(item); setShowAdd(true); }
  function closeDialog() { setShowAdd(false); setEditingItem(null); }

  const tabItems = useMemo(() => items.filter((i) => (i.tipo ?? "mercado") === tab), [items, tab]);

  const grouped = useMemo(() => {
    const map = new Map<string, ListaComprasItem[]>();
    for (const item of tabItems) {
      const key = item.categoria ?? "Geral";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b, "pt-BR"));
  }, [tabItems]);

  const pendingCount   = tabItems.filter((i) => !i.comprado).length;
  const totalPendente  = tabItems.filter((i) => !i.comprado && i.valor_esperado != null).reduce((s, i) => s + (i.valor_esperado ?? 0), 0);
  const mercadoCount   = items.filter((i) => (i.tipo ?? "mercado") === "mercado" && !i.comprado).length;
  const desejoCount    = items.filter((i) => i.tipo === "desejo" && !i.comprado).length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Lista de Compras</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {pendingCount} {pendingCount === 1 ? "item pendente" : "itens pendentes"}
            {totalPendente > 0 && ` · estimado ${fmtBRL(totalPendente)}`}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setManageCat(true)}>
            <FolderOpen size={14} className="mr-1" /> Categorias
          </Button>
          <Button onClick={() => { setEditingItem(null); setShowAdd(true); }} size="sm" className="gap-1.5">
            <Plus size={14} />
            Adicionar
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border pb-0">
        {([
          { key: "mercado" as Tab, label: "Mercado", icon: <ShoppingCart size={13} />, count: mercadoCount },
          { key: "desejo"  as Tab, label: "Desejos", icon: <Star size={13} />,          count: desejoCount  },
        ]).map(({ key, label, icon, count }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-t-md border-b-2 transition-colors -mb-px",
              tab === key ? "border-[#C8DA2D] text-[#C8DA2D]" : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {icon}
            {label}
            {count > 0 && (
              <span className="ml-1 text-xs bg-muted text-muted-foreground rounded-full px-1.5 py-0.5">{count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="text-muted-foreground text-sm py-12 text-center">Carregando…</div>
      ) : grouped.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          {tab === "mercado" ? <ShoppingCart size={36} className="text-muted-foreground/20" /> : <Star size={36} className="text-muted-foreground/20" />}
          <p className="text-muted-foreground text-sm">{tab === "mercado" ? "Nenhum item de mercado" : "Nenhum desejo adicionado"}</p>
          <button onClick={() => { setEditingItem(null); setShowAdd(true); }} className="text-[#C8DA2D] text-sm hover:underline">
            Adicionar primeiro item
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map(([cat, catItems]) => (
            <Section
              key={cat}
              cat={cat}
              items={catItems}
              onToggle={(id, comprado) => toggleMutation.mutate({ id, comprado })}
              onEdit={openEdit}
              onDelete={(id) => deleteMutation.mutate(id)}
            />
          ))}
        </div>
      )}

      <ItemDialog
        open={showAdd}
        defaultTipo={tab}
        editingItem={editingItem}
        categorias={categorias}
        onClose={closeDialog}
        onSave={handleSave}
        loading={createMutation.isPending || updateMutation.isPending}
      />

      <ManageCatDialog
        open={manageCat}
        onClose={() => setManageCat(false)}
        categorias={categorias}
        fromItems={fromItems}
        onAdd={addCat}
        onRemove={removeCat}
      />
    </div>
  );
}
