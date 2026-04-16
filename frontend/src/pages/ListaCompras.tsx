import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ShoppingBag, Plus, Trash2, Check } from "lucide-react";
import { apiFetch, fmtBRL } from "@/lib/api";
import { ListaComprasItem } from "@/types";
import { cn } from "@/lib/utils";

// ── API ───────────────────────────────────────────────────────────────────────

function fetchItems() {
  return apiFetch<ListaComprasItem[]>("/api/v1/lista-compras");
}

interface ItemPayload {
  nome: string;
  quantidade: number;
  unidade: string;
  valor_esperado?: number;
  categoria?: string;
}

// ── Add Dialog ────────────────────────────────────────────────────────────────

const UNIDADES = ["un", "kg", "g", "L", "ml", "cx", "pc", "m", "par"];

interface AddDialogProps {
  onClose: () => void;
  onAdd: (p: ItemPayload) => void;
  loading: boolean;
}

function AddDialog({ onClose, onAdd, loading }: AddDialogProps) {
  const [nome, setNome] = useState("");
  const [qtd, setQtd] = useState("1");
  const [unidade, setUnidade] = useState("un");
  const [valor, setValor] = useState("");
  const [cat, setCat] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim()) return;
    onAdd({
      nome: nome.trim(),
      quantidade: parseFloat(qtd) || 1,
      unidade,
      ...(valor ? { valor_esperado: parseFloat(valor) } : {}),
      ...(cat.trim() ? { categoria: cat.trim() } : {}),
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="bg-[#0F1E2A] border border-white/10 rounded-xl p-6 w-full max-w-sm shadow-2xl">
        <h2 className="text-white font-semibold text-base mb-4">Novo item</h2>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="text-white/50 text-xs block mb-1">Nome *</label>
            <input
              autoFocus
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-[#C8DA2D]/60 placeholder-white/20"
              placeholder="ex: Detergente, Camiseta…"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
            />
          </div>

          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-white/50 text-xs block mb-1">Quantidade</label>
              <input
                type="number"
                min="0"
                step="any"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-[#C8DA2D]/60"
                value={qtd}
                onChange={(e) => setQtd(e.target.value)}
              />
            </div>
            <div className="w-28">
              <label className="text-white/50 text-xs block mb-1">Unidade</label>
              <select
                className="w-full bg-[#0C1923] border border-white/10 rounded-lg px-2 py-2 text-white text-sm outline-none focus:border-[#C8DA2D]/60"
                value={unidade}
                onChange={(e) => setUnidade(e.target.value)}
              >
                {UNIDADES.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="text-white/50 text-xs block mb-1">Valor esperado (R$)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-[#C8DA2D]/60"
              placeholder="opcional"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
            />
          </div>

          <div>
            <label className="text-white/50 text-xs block mb-1">Categoria</label>
            <input
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-[#C8DA2D]/60 placeholder-white/20"
              placeholder="ex: Mercado, Vestuário…"
              value={cat}
              onChange={(e) => setCat(e.target.value)}
            />
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 rounded-lg border border-white/10 text-white/60 text-sm hover:bg-white/5 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!nome.trim() || loading}
              className="flex-1 py-2 rounded-lg bg-[#C8DA2D] text-[#0C1923] text-sm font-semibold disabled:opacity-40 hover:opacity-90 transition-opacity"
            >
              {loading ? "Salvando…" : "Adicionar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Item Row ──────────────────────────────────────────────────────────────────

interface ItemRowProps {
  item: ListaComprasItem;
  onToggle: () => void;
  onDelete: () => void;
}

function ItemRow({ item, onToggle, onDelete }: ItemRowProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 rounded-lg group transition-colors",
        item.comprado ? "opacity-50" : "hover:bg-white/4"
      )}
    >
      <button
        onClick={onToggle}
        className={cn(
          "flex-shrink-0 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors",
          item.comprado
            ? "bg-[#C8DA2D] border-[#C8DA2D]"
            : "border-white/25 hover:border-[#C8DA2D]/60"
        )}
      >
        {item.comprado && <Check size={11} className="text-[#0C1923]" strokeWidth={3} />}
      </button>

      <span
        className={cn(
          "flex-1 text-sm",
          item.comprado ? "line-through text-white/40" : "text-white"
        )}
      >
        {item.nome}
      </span>

      <span className="text-white/40 text-xs whitespace-nowrap">
        {item.quantidade !== 1 || item.unidade !== "un"
          ? `${item.quantidade} ${item.unidade}`
          : ""}
      </span>

      {item.valor_esperado != null && (
        <span className="text-[#C8DA2D]/80 text-xs font-medium whitespace-nowrap">
          {fmtBRL(item.valor_esperado)}
        </span>
      )}

      <button
        onClick={onDelete}
        className="opacity-0 group-hover:opacity-100 text-white/25 hover:text-red-400 transition-all ml-1"
      >
        <Trash2 size={13} />
      </button>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ListaCompras() {
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["lista-compras"],
    queryFn: fetchItems,
  });

  const createMutation = useMutation({
    mutationFn: (payload: ItemPayload) =>
      apiFetch<ListaComprasItem>("/api/v1/lista-compras", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lista-compras"] });
      setShowAdd(false);
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, comprado }: { id: string; comprado: boolean }) =>
      apiFetch<ListaComprasItem>(`/api/v1/lista-compras/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ comprado }),
      }),
    onMutate: async ({ id, comprado }) => {
      await qc.cancelQueries({ queryKey: ["lista-compras"] });
      const prev = qc.getQueryData<ListaComprasItem[]>(["lista-compras"]);
      qc.setQueryData<ListaComprasItem[]>(["lista-compras"], (old = []) =>
        old.map((i) => (i.id === id ? { ...i, comprado } : i))
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["lista-compras"], ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["lista-compras"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`/api/v1/lista-compras/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lista-compras"] }),
  });

  // Group by categoria
  const grouped = useMemo(() => {
    const map = new Map<string, ListaComprasItem[]>();
    for (const item of items) {
      const key = item.categoria ?? "Geral";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b, "pt-BR"));
  }, [items]);

  const totalPendente = useMemo(
    () =>
      items
        .filter((i) => !i.comprado && i.valor_esperado != null)
        .reduce((s, i) => s + (i.valor_esperado ?? 0), 0),
    [items]
  );

  const pendingCount = items.filter((i) => !i.comprado).length;

  return (
    <div className="min-h-screen bg-[#0C1923] p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <ShoppingBag size={20} className="text-[#C8DA2D]" />
          <div>
            <h1 className="text-white font-bold text-lg leading-none">Lista de Compras</h1>
            <p className="text-white/35 text-xs mt-0.5">
              {pendingCount} {pendingCount === 1 ? "item pendente" : "itens pendentes"}
              {totalPendente > 0 && ` · estimado ${fmtBRL(totalPendente)}`}
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 bg-[#C8DA2D] text-[#0C1923] px-3 py-2 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          <Plus size={15} />
          Adicionar
        </button>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="text-white/30 text-sm py-12 text-center">Carregando…</div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <ShoppingBag size={36} className="text-white/10" />
          <p className="text-white/30 text-sm">Nenhum item na lista ainda</p>
          <button
            onClick={() => setShowAdd(true)}
            className="mt-1 text-[#C8DA2D] text-sm hover:underline"
          >
            Adicionar primeiro item
          </button>
        </div>
      ) : (
        <div className="space-y-5">
          {grouped.map(([cat, catItems]) => {
            const pending = catItems.filter((i) => !i.comprado);
            const done = catItems.filter((i) => i.comprado);
            return (
              <div key={cat} className="bg-white/3 border border-white/6 rounded-xl overflow-hidden">
                {/* Category header */}
                <div className="px-4 py-2.5 border-b border-white/6 flex items-center justify-between">
                  <span className="text-white/60 text-xs font-semibold uppercase tracking-wider">
                    {cat}
                  </span>
                  <span className="text-white/25 text-xs">
                    {pending.length}/{catItems.length}
                  </span>
                </div>
                {/* Items */}
                <div className="p-2">
                  {pending.map((item) => (
                    <ItemRow
                      key={item.id}
                      item={item}
                      onToggle={() => toggleMutation.mutate({ id: item.id, comprado: true })}
                      onDelete={() => deleteMutation.mutate(item.id)}
                    />
                  ))}
                  {done.map((item) => (
                    <ItemRow
                      key={item.id}
                      item={item}
                      onToggle={() => toggleMutation.mutate({ id: item.id, comprado: false })}
                      onDelete={() => deleteMutation.mutate(item.id)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Dialog */}
      {showAdd && (
        <AddDialog
          onClose={() => setShowAdd(false)}
          onAdd={(p) => createMutation.mutate(p)}
          loading={createMutation.isPending}
        />
      )}
    </div>
  );
}
