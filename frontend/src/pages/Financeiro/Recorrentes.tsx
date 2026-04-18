import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Pencil, ChevronLeft, ChevronRight, Check, CreditCard } from "lucide-react";
import { apiFetch, fmtBRL, currentMes, mesLabel } from "@/lib/api";
import type { FluxoRecorrente, RecorrentePagamento } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const CATEGORIAS = [
  "Moradia","Transporte","Alimentação","Lazer","Saúde","Educação",
  "Assinaturas","Família","Investimento","Salário","Outros",
];

function addMonths(mes: string, delta: number): string {
  const [y, m] = mes.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function isRecorrenteAtiva(r: FluxoRecorrente, mes: string): boolean {
  return r.inicio <= mes && (!r.fim || r.fim >= mes);
}

function isOverdue(r: FluxoRecorrente, mes: string, pago: boolean): boolean {
  if (pago || r.tipo !== "Despesa") return false;
  const today = new Date();
  const todayMes = currentMes();
  return mes === todayMes && r.dia < today.getDate();
}

interface Form {
  tipo: "Receita" | "Despesa";
  categoria: string;
  descricao: string;
  dia: string;
  valor: string;
  inicio: string;
  fim: string;
  via_cartao: boolean;
}

const empty = (): Form => ({
  tipo: "Despesa", categoria: "Moradia", descricao: "",
  dia: "1", valor: "", inicio: new Date().toISOString().slice(0, 7), fim: "", via_cartao: false,
});

export default function Recorrentes() {
  const qc = useQueryClient();
  const [mes, setMes] = useState(currentMes());
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<FluxoRecorrente | null>(null);
  const [form, setForm] = useState<Form>(empty());

  const { data: rows = [], isLoading } = useQuery<FluxoRecorrente[]>({
    queryKey: ["recorrentes"],
    queryFn: () => apiFetch("/api/v1/recorrentes"),
  });

  const { data: pagamentos = [] } = useQuery<RecorrentePagamento[]>({
    queryKey: ["recorrentes-pagamentos", mes],
    queryFn: () => apiFetch(`/api/v1/recorrentes-pagamentos?mes=${mes}`),
    staleTime: 2 * 60 * 1000,
  });

  const pagoMap = useMemo(() => {
    const m: Record<string, boolean> = {};
    for (const p of pagamentos) m[p.recorrente_id] = p.pago;
    return m;
  }, [pagamentos]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["recorrentes"] });
    qc.invalidateQueries({ queryKey: ["financeiro-dashboard"] });
  };

  const create = useMutation({
    mutationFn: (d: object) => apiFetch("/api/v1/recorrentes", { method: "POST", body: JSON.stringify(d) }),
    onSuccess: () => { invalidate(); setOpen(false); },
  });

  const update = useMutation({
    mutationFn: ({ id, d }: { id: string; d: object }) =>
      apiFetch(`/api/v1/recorrentes/${id}`, { method: "PATCH", body: JSON.stringify(d) }),
    onSuccess: () => { invalidate(); setOpen(false); },
  });

  const del = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/v1/recorrentes/${id}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });

  const togglePago = useMutation({
    mutationFn: ({ id, pago }: { id: string; pago: boolean }) =>
      apiFetch(`/api/v1/recorrentes/${id}/pagamentos/${mes}`, {
        method: "POST",
        body: JSON.stringify({ pago }),
      }),
    onMutate: async ({ id, pago }) => {
      await qc.cancelQueries({ queryKey: ["recorrentes-pagamentos", mes] });
      const prev = qc.getQueryData<RecorrentePagamento[]>(["recorrentes-pagamentos", mes]);
      qc.setQueryData<RecorrentePagamento[]>(["recorrentes-pagamentos", mes], (old = []) => {
        const existing = old.find((p) => p.recorrente_id === id);
        if (existing) return old.map((p) => p.recorrente_id === id ? { ...p, pago } : p);
        return [...old, { id: "", recorrente_id: id, mes, pago, criado_em: "" }];
      });
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["recorrentes-pagamentos", mes], ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["recorrentes-pagamentos", mes] }),
  });

  function openCreate() { setEditing(null); setForm(empty()); setOpen(true); }
  function openEdit(r: FluxoRecorrente) {
    setEditing(r);
    setForm({
      tipo: r.tipo, categoria: r.categoria, descricao: r.descricao,
      dia: String(r.dia), valor: String(r.valor), inicio: r.inicio, fim: r.fim ?? "",
      via_cartao: r.via_cartao ?? false,
    });
    setOpen(true);
  }

  function handleSave() {
    const payload = {
      tipo: form.tipo, categoria: form.categoria, descricao: form.descricao,
      dia: parseInt(form.dia), valor: parseFloat(form.valor),
      inicio: form.inicio, fim: form.fim || undefined,
      via_cartao: form.via_cartao || undefined,
    };
    if (editing) update.mutate({ id: editing.id, d: payload });
    else create.mutate(payload);
  }

  // Only show recorrentes active in the selected month
  const ativas = rows.filter((r) => isRecorrenteAtiva(r, mes));
  const receitas = ativas.filter((r) => r.tipo === "Receita");
  const despesas = ativas.filter((r) => r.tipo === "Despesa");

  const totalReceitas = receitas.reduce((s, r) => s + r.valor, 0);
  const totalDespesas = despesas.reduce((s, r) => s + r.valor, 0);
  const pagas   = despesas.filter((r) => pagoMap[r.id]);
  const vencidas = despesas.filter((r) => isOverdue(r, mes, pagoMap[r.id] ?? false));

  if (isLoading) return <Skeleton className="h-64 rounded-xl" />;

  const Row = ({ r, color }: { r: FluxoRecorrente; color: string }) => {
    const isPago = pagoMap[r.id] ?? false;
    const overdue = isOverdue(r, mes, isPago);
    return (
      <div
        key={r.id}
        className={cn(
          "flex items-center gap-3 bg-card border rounded-lg px-4 py-3 transition-colors",
          overdue ? "border-red-500/40 bg-red-500/5" : isPago ? "border-green-500/20 bg-green-500/5" : "border-border"
        )}
      >
        {/* Pago toggle */}
        <button
          onClick={() => togglePago.mutate({ id: r.id, pago: !isPago })}
          className={cn(
            "w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all",
            isPago
              ? "bg-green-500 border-green-500"
              : overdue
                ? "border-red-400 hover:border-red-500"
                : "border-muted-foreground/30 hover:border-green-500"
          )}
        >
          {isPago && <Check size={11} className="text-white" strokeWidth={3} />}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {overdue && <span className="text-[10px] font-bold text-red-400">⚠</span>}
            <p className={cn("text-sm font-medium truncate", isPago && "line-through text-muted-foreground")}>
              {r.descricao}
            </p>
          </div>
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            {r.categoria} · dia {r.dia} · {r.inicio}{r.fim ? ` até ${r.fim}` : " (ativo)"}
            {r.via_cartao && <span className="inline-flex items-center gap-0.5 text-purple-400 ml-1"><CreditCard size={10} /> cartão</span>}
          </p>
        </div>

        <span className={cn("font-semibold tabular-nums shrink-0", isPago ? "text-muted-foreground" : color)}>
          {fmtBRL(r.valor)}
        </span>
        <button onClick={() => openEdit(r)} className="text-muted-foreground hover:text-foreground transition-colors">
          <Pencil size={14} />
        </button>
        <button onClick={() => del.mutate(r.id)} className="text-muted-foreground hover:text-red-500 transition-colors">
          <Trash2 size={14} />
        </button>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center flex-wrap gap-3">
        {/* Month selector */}
        <div className="flex items-center gap-1">
          <button onClick={() => setMes(addMonths(mes, -1))} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm font-semibold w-20 text-center">{mesLabel(mes)}</span>
          <button onClick={() => setMes(addMonths(mes, 1))} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
            <ChevronRight size={16} />
          </button>
        </div>

        {/* KPIs */}
        <div className="flex gap-5 text-sm ml-1">
          <div>
            <p className="text-xs text-muted-foreground">Receitas</p>
            <p className="font-bold text-green-400">{fmtBRL(totalReceitas)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Despesas</p>
            <p className="font-bold text-red-400">{fmtBRL(totalDespesas)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Saldo estrutural</p>
            <p className={cn("font-bold", totalReceitas - totalDespesas >= 0 ? "text-green-400" : "text-red-400")}>
              {fmtBRL(totalReceitas - totalDespesas)}
            </p>
          </div>
        </div>

        {/* Status badges */}
        <div className="flex gap-2 text-xs ml-1">
          {pagas.length > 0 && (
            <span className="text-green-400">{pagas.length} paga{pagas.length > 1 ? "s" : ""}</span>
          )}
          {vencidas.length > 0 && (
            <span className="text-red-400 font-semibold">⚠ {vencidas.length} vencida{vencidas.length > 1 ? "s" : ""}</span>
          )}
        </div>

        <div className="flex-1" />
        <Button size="sm" onClick={openCreate} className="bg-[#C8DA2D] text-[#0C1923] hover:bg-[#d4e640]">
          <Plus size={14} className="mr-1" /> Novo Fluxo
        </Button>
      </div>

      {/* Receitas */}
      {[{ label: "Receitas", items: receitas, color: "text-green-400" }, { label: "Despesas", items: despesas, color: "text-red-400" }].map(({ label, items, color }) => (
        <div key={label}>
          <h3 className={cn("text-sm font-semibold mb-2", color)}>{label}</h3>
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">Nenhum lançamento ativo em {mesLabel(mes)}.</p>
          ) : (
            <div className="space-y-1.5">
              {items.map((r) => <Row key={r.id} r={r} color={color} />)}
            </div>
          )}
        </div>
      ))}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing ? "Editar Fluxo" : "Novo Fluxo Recorrente"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tipo</Label>
                <Select value={form.tipo} onValueChange={(v) => setForm((f) => ({ ...f, tipo: v as "Receita" | "Despesa" }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Receita">Receita</SelectItem>
                    <SelectItem value="Despesa">Despesa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Categoria</Label>
                <Select value={form.categoria} onValueChange={(v) => setForm((f) => ({ ...f, categoria: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIAS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Descrição</Label>
              <Input value={form.descricao} onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))} placeholder="Ex: Aluguel, Salário..." className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Valor (R$)</Label>
                <Input type="number" step="0.01" value={form.valor} onChange={(e) => setForm((f) => ({ ...f, valor: e.target.value }))} placeholder="0,00" className="mt-1" />
              </div>
              <div>
                <Label>Dia do mês</Label>
                <Input type="number" min={1} max={31} value={form.dia} onChange={(e) => setForm((f) => ({ ...f, dia: e.target.value }))} className="mt-1" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Início (AAAA-MM)</Label>
                <Input value={form.inicio} onChange={(e) => setForm((f) => ({ ...f, inicio: e.target.value }))} placeholder="2024-01" className="mt-1" />
              </div>
              <div>
                <Label>Fim (opcional)</Label>
                <Input value={form.fim} onChange={(e) => setForm((f) => ({ ...f, fim: e.target.value }))} placeholder="2025-12" className="mt-1" />
              </div>
            </div>
            {form.tipo === "Despesa" && (
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={form.via_cartao}
                  onChange={(e) => setForm((f) => ({ ...f, via_cartao: e.target.checked }))}
                  className="w-4 h-4 accent-purple-500"
                />
                <span className="text-sm flex items-center gap-1.5">
                  <CreditCard size={13} className="text-purple-400" />
                  Vai para fatura do cartão
                  <span className="text-xs text-muted-foreground">(exclui da projeção direta)</span>
                </span>
              </label>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!form.descricao || !form.valor || create.isPending || update.isPending} className="bg-[#C8DA2D] text-[#0C1923] hover:bg-[#d4e640]">
              {editing ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
