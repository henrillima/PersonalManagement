import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Pencil, ChevronLeft, ChevronRight, Check } from "lucide-react";
import { apiFetch, fmtBRL, currentMes, mesLabel } from "@/lib/api";
import type { FluxoPontual } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const CATEGORIAS = [
  "Moradia","Transporte","Alimentação","Lazer","Saúde","Educação",
  "Viagem","Família","Presente","Impostos","Outros",
];

function addMonths(mes: string, delta: number): string {
  const [y, m] = mes.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function isOverdue(r: FluxoPontual, mes: string): boolean {
  if (r.pago || r.tipo !== "Despesa") return false;
  const todayMes = currentMes();
  return mes === todayMes && r.dia < new Date().getDate();
}

interface Form {
  tipo: "Receita" | "Despesa";
  categoria: string;
  descricao: string;
  dia: string;
  valor: string;
  mes_alvo: string;
}

const empty = (mes: string): Form => ({
  tipo: "Despesa", categoria: "Outros", descricao: "",
  dia: "1", valor: "", mes_alvo: mes,
});

export default function Pontuais() {
  const qc = useQueryClient();
  const [mes, setMes] = useState(currentMes());
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<FluxoPontual | null>(null);
  const [form, setForm] = useState<Form>(empty(mes));

  const { data: rows = [], isLoading } = useQuery<FluxoPontual[]>({
    queryKey: ["pontuais", mes],
    queryFn: () => apiFetch(`/api/v1/pontuais?mes=${mes}`),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["pontuais", mes] });
    qc.invalidateQueries({ queryKey: ["financeiro-dashboard"] });
  };

  const create = useMutation({
    mutationFn: (d: object) => apiFetch("/api/v1/pontuais", { method: "POST", body: JSON.stringify(d) }),
    onSuccess: () => { invalidate(); setOpen(false); },
  });

  const update = useMutation({
    mutationFn: ({ id, d }: { id: string; d: object }) =>
      apiFetch(`/api/v1/pontuais/${id}`, { method: "PATCH", body: JSON.stringify(d) }),
    onSuccess: () => { invalidate(); setOpen(false); },
  });

  const del = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/v1/pontuais/${id}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });

  const togglePago = useMutation({
    mutationFn: ({ id, pago }: { id: string; pago: boolean }) =>
      apiFetch(`/api/v1/pontuais/${id}`, { method: "PATCH", body: JSON.stringify({ pago }) }),
    onMutate: async ({ id, pago }) => {
      await qc.cancelQueries({ queryKey: ["pontuais", mes] });
      const prev = qc.getQueryData<FluxoPontual[]>(["pontuais", mes]);
      qc.setQueryData<FluxoPontual[]>(["pontuais", mes], (old = []) =>
        old.map((r) => r.id === id ? { ...r, pago } : r)
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["pontuais", mes], ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["pontuais", mes] }),
  });

  function openCreate() { setEditing(null); setForm(empty(mes)); setOpen(true); }
  function openEdit(r: FluxoPontual) {
    setEditing(r);
    setForm({ tipo: r.tipo, categoria: r.categoria, descricao: r.descricao, dia: String(r.dia), valor: String(r.valor), mes_alvo: r.mes_alvo });
    setOpen(true);
  }

  function handleSave() {
    const payload = {
      tipo: form.tipo, categoria: form.categoria, descricao: form.descricao,
      dia: parseInt(form.dia), valor: parseFloat(form.valor), mes_alvo: form.mes_alvo,
    };
    if (editing) update.mutate({ id: editing.id, d: payload });
    else create.mutate(payload);
  }

  const receitas = rows.filter((r) => r.tipo === "Receita");
  const despesas = rows.filter((r) => r.tipo === "Despesa");
  const totalReceitas = receitas.reduce((s, r) => s + r.valor, 0);
  const totalDespesas = despesas.reduce((s, r) => s + r.valor, 0);
  const pagas = despesas.filter((r) => r.pago);
  const vencidas = despesas.filter((r) => isOverdue(r, mes));

  if (isLoading) return <Skeleton className="h-64 rounded-xl" />;

  const sorted = [...rows].sort((a, b) => a.dia - b.dia);

  return (
    <div className="space-y-5">
      {/* Month navigator */}
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={() => setMes(addMonths(mes, -1))} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
          <ChevronLeft size={16} />
        </button>
        <span className="text-sm font-semibold w-20 text-center">{mesLabel(mes)}</span>
        <button onClick={() => setMes(addMonths(mes, 1))} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
          <ChevronRight size={16} />
        </button>

        <div className="flex gap-4 text-sm ml-1">
          <span className="text-green-400 font-semibold">+{fmtBRL(totalReceitas)}</span>
          <span className="text-red-400 font-semibold">-{fmtBRL(totalDespesas)}</span>
        </div>

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
          <Plus size={14} className="mr-1" /> Novo
        </Button>
      </div>

      {rows.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground text-sm">
          Nenhum lançamento pontual em {mesLabel(mes)}.
        </div>
      ) : (
        <div className="space-y-1.5">
          {sorted.map((r) => {
            const overdue = isOverdue(r, mes);
            const color = r.tipo === "Receita" ? "text-green-400" : "text-red-400";
            return (
              <div
                key={r.id}
                className={cn(
                  "flex items-center gap-3 bg-card border rounded-lg px-4 py-3 transition-colors",
                  overdue ? "border-red-500/40 bg-red-500/5" : r.pago ? "border-green-500/20 bg-green-500/5" : "border-border"
                )}
              >
                {/* Pago toggle — only for despesas */}
                {r.tipo === "Despesa" ? (
                  <button
                    onClick={() => togglePago.mutate({ id: r.id, pago: !r.pago })}
                    className={cn(
                      "w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all",
                      r.pago
                        ? "bg-green-500 border-green-500"
                        : overdue
                          ? "border-red-400 hover:border-red-500"
                          : "border-muted-foreground/30 hover:border-green-500"
                    )}
                  >
                    {r.pago && <Check size={11} className="text-white" strokeWidth={3} />}
                  </button>
                ) : (
                  <div className="w-6 h-6 shrink-0" />
                )}

                <span className="text-xs text-muted-foreground w-8 shrink-0">dia {r.dia}</span>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {overdue && <span className="text-[10px] font-bold text-red-400">⚠</span>}
                    <p className={cn("text-sm font-medium truncate", r.pago && "line-through text-muted-foreground")}>
                      {r.descricao}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground">{r.categoria}</p>
                </div>

                <span className={cn("font-semibold tabular-nums shrink-0 text-sm", r.pago ? "text-muted-foreground" : color)}>
                  {r.tipo === "Receita" ? "+" : "-"}{fmtBRL(r.valor)}
                </span>
                <button onClick={() => openEdit(r)} className="text-muted-foreground hover:text-foreground transition-colors">
                  <Pencil size={14} />
                </button>
                <button onClick={() => del.mutate(r.id)} className="text-muted-foreground hover:text-red-500 transition-colors">
                  <Trash2 size={14} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing ? "Editar" : "Novo Fluxo Pontual"}</DialogTitle></DialogHeader>
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
              <Input value={form.descricao} onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))} placeholder="Ex: IPVA, Bônus, Viagem..." className="mt-1" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Valor (R$)</Label>
                <Input type="number" step="0.01" value={form.valor} onChange={(e) => setForm((f) => ({ ...f, valor: e.target.value }))} placeholder="0,00" className="mt-1" />
              </div>
              <div>
                <Label>Dia</Label>
                <Input type="number" min={1} max={31} value={form.dia} onChange={(e) => setForm((f) => ({ ...f, dia: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <Label>Mês alvo</Label>
                <Input value={form.mes_alvo} onChange={(e) => setForm((f) => ({ ...f, mes_alvo: e.target.value }))} placeholder="2024-01" className="mt-1" />
              </div>
            </div>
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
