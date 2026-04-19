import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Check, Pencil, AlertTriangle, Clock, ArrowDownLeft } from "lucide-react";
import { apiFetch, fmtBRL } from "@/lib/api";
import type { Divida } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// ── Atrasados panel types ─────────────────────────────────────────────────────

interface AtrasadaItem {
  tipo: string;
  id: string;
  descricao: string;
  categoria: string;
  valor: number;
  mes: string;
  dia: number;
  receita?: boolean;
}

// ── Divida form ───────────────────────────────────────────────────────────────

interface Form { descricao: string; valor: string; mes: string; dia: string; }
const empty = (): Form => ({
  descricao: "", valor: "",
  mes: new Date().toISOString().slice(0, 7),
  dia: String(new Date().getDate()),
});

const TIPO_LABEL: Record<string, string> = {
  pontual: "Pontual", divida: "Dívida",
  terceiro: "A Receber", terceiro_pagar: "A Pagar (Terceiro)",
};

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function Pendencias() {
  const qc = useQueryClient();
  const [open, setOpen]       = useState(false);
  const [form, setForm]       = useState<Form>(empty());
  const [editing, setEditing] = useState<Divida | null>(null);

  const { data: rows = [], isLoading } = useQuery<Divida[]>({
    queryKey: ["dividas"],
    queryFn: () => apiFetch("/api/v1/dividas"),
  });

  const { data: atrasados = [], isLoading: lAtrasados } = useQuery<AtrasadaItem[]>({
    queryKey: ["despesas-atrasadas"],
    queryFn: () => apiFetch("/api/v1/despesas-atrasadas"),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["dividas"] });

  const create = useMutation({
    mutationFn: (d: object) => apiFetch("/api/v1/dividas", { method: "POST", body: JSON.stringify(d) }),
    onSuccess: () => { invalidate(); setOpen(false); },
  });

  const update = useMutation({
    mutationFn: ({ id, d }: { id: string; d: object }) =>
      apiFetch(`/api/v1/dividas/${id}`, { method: "PATCH", body: JSON.stringify(d) }),
    onSuccess: () => { invalidate(); setOpen(false); setEditing(null); },
  });

  const del = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/v1/dividas/${id}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });

  function openCreate() { setEditing(null); setForm(empty()); setOpen(true); }
  function openEdit(r: Divida) {
    setEditing(r);
    setForm({ descricao: r.descricao, valor: String(r.valor), mes: r.mes, dia: String(r.dia) });
    setOpen(true);
  }

  function handleSubmit() {
    const payload = { ...form, dia: parseInt(form.dia), valor: parseFloat(form.valor) };
    if (editing) update.mutate({ id: editing.id, d: payload });
    else create.mutate(payload);
  }

  const today    = new Date().toISOString().slice(0, 7);
  const vincendas = rows.filter((r) => !r.pago && r.mes >= today);
  const pagas     = rows.filter((r) => r.pago);

  // Separate atrasados: expenses vs receivables
  const atrasadosDespesas  = atrasados.filter((i) => !i.receita);
  const atrasadosReceitas  = atrasados.filter((i) => i.receita);
  const totalAtrasadoDespesa = atrasadosDespesas.reduce((s, i) => s + i.valor, 0);
  const totalAtrasadoReceita = atrasadosReceitas.reduce((s, i) => s + i.valor, 0);

  if (isLoading) return <Skeleton className="h-64 rounded-xl" />;

  return (
    <div className="space-y-6">

      {/* ── Painel de Atrasados ─────────────────────────────────────────── */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center gap-2">
          <AlertTriangle size={15} className="text-red-400 shrink-0" />
          <h2 className="text-sm font-semibold text-red-400 uppercase tracking-wider flex-1">
            Painel de Atrasados
          </h2>
          {atrasados.length > 0 && (
            <span className="text-xs text-muted-foreground">{atrasados.length} item{atrasados.length !== 1 ? "s" : ""}</span>
          )}
        </div>

        {lAtrasados ? (
          <div className="p-4 text-sm text-muted-foreground text-center">Carregando…</div>
        ) : atrasados.length === 0 ? (
          <div className="p-8 text-center">
            <Check size={28} className="text-green-400 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Nenhum item em atraso. Tudo em dia!</p>
          </div>
        ) : (
          <div className="p-4 space-y-4">

            {/* Despesas atrasadas */}
            {atrasadosDespesas.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-semibold text-red-400 uppercase tracking-wider">
                    A Pagar em Atraso
                  </h3>
                  <span className="text-xs font-semibold text-red-400">{fmtBRL(totalAtrasadoDespesa)}</span>
                </div>
                <div className="space-y-1.5">
                  {atrasadosDespesas.map((item) => (
                    <AtrasadaRow key={`${item.tipo}-${item.id}`} item={item} />
                  ))}
                </div>
              </div>
            )}

            {/* Receitas atrasadas */}
            {atrasadosReceitas.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-semibold text-amber-400 uppercase tracking-wider flex items-center gap-1">
                    <ArrowDownLeft size={11} /> A Receber em Atraso
                  </h3>
                  <span className="text-xs font-semibold text-amber-400">{fmtBRL(totalAtrasadoReceita)}</span>
                </div>
                <div className="space-y-1.5">
                  {atrasadosReceitas.map((item) => (
                    <AtrasadaRow key={`${item.tipo}-${item.id}`} item={item} receita />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Suas Dívidas — A Vencer ──────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Clock size={14} className="text-amber-400" />
            <h2 className="text-sm font-semibold uppercase tracking-wider">Suas Dívidas — A Vencer</h2>
          </div>
          <Button size="sm" onClick={openCreate} className="bg-[#C8DA2D] text-[#0C1923] hover:bg-[#d4e640]">
            <Plus size={14} className="mr-1" /> Nova Dívida
          </Button>
        </div>

        {vincendas.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-6 text-center text-sm text-muted-foreground">
            Nenhuma dívida futura cadastrada.
          </div>
        ) : (
          <div className="space-y-1">
            {vincendas.map((r) => (
              <DividaRow key={r.id} item={r}
                onMark={() => update.mutate({ id: r.id, d: { pago: true } })}
                onEdit={() => openEdit(r)}
                onDelete={() => del.mutate(r.id)} />
            ))}
          </div>
        )}
      </div>

      {/* ── Pagas / Resolvidas ────────────────────────────────────────────── */}
      {pagas.length > 0 && (
        <details className="text-xs">
          <summary className="cursor-pointer text-muted-foreground hover:text-foreground select-none">
            Pagas / Resolvidas ({pagas.length})
          </summary>
          <div className="mt-2 space-y-1">
            {pagas.map((r) => (
              <DividaRow key={r.id} item={r}
                onEdit={() => openEdit(r)}
                onDelete={() => del.mutate(r.id)} paid />
            ))}
          </div>
        </details>
      )}

      {/* Dialog */}
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing ? "Editar Dívida" : "Nova Dívida / Pendência"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Descrição</Label>
              <Input value={form.descricao} onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))} placeholder="Ex: Multa, Parcelamento..." className="mt-1" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Valor (R$)</Label>
                <Input type="number" step="0.01" value={form.valor} onChange={(e) => setForm((f) => ({ ...f, valor: e.target.value }))} placeholder="0,00" className="mt-1" />
              </div>
              <div>
                <Label>Mês (AAAA-MM)</Label>
                <Input value={form.mes} onChange={(e) => setForm((f) => ({ ...f, mes: e.target.value }))} placeholder="2024-01" className="mt-1" />
              </div>
              <div>
                <Label>Dia</Label>
                <Input type="number" min={1} max={31} value={form.dia} onChange={(e) => setForm((f) => ({ ...f, dia: e.target.value }))} className="mt-1" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setOpen(false); setEditing(null); }}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={!form.descricao || !form.valor || create.isPending || update.isPending} className="bg-[#C8DA2D] text-[#0C1923] hover:bg-[#d4e640]">
              {editing ? "Salvar" : "Registrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function AtrasadaRow({ item, receita }: { item: AtrasadaItem; receita?: boolean }) {
  return (
    <div className={cn(
      "flex items-center gap-3 rounded-lg px-3 py-2 border",
      receita ? "bg-amber-500/5 border-amber-500/20" : "bg-red-500/5 border-red-500/20"
    )}>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{item.descricao}</p>
        <p className="text-xs text-muted-foreground">{item.categoria} · {item.mes}/{String(item.dia).padStart(2, "0")}</p>
      </div>
      <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded shrink-0",
        receita ? "bg-amber-500/15 text-amber-400" : "bg-red-500/15 text-red-400")}>
        {receita ? "a receber" : (TIPO_LABEL[item.tipo] ?? item.tipo)}
      </span>
      <span className={cn("font-semibold tabular-nums text-sm shrink-0", receita ? "text-amber-400" : "text-red-400")}>
        {fmtBRL(item.valor)}
      </span>
    </div>
  );
}

function DividaRow({ item, onMark, onEdit, onDelete, paid }: {
  item: Divida; onMark?: () => void; onEdit: () => void; onDelete: () => void; paid?: boolean;
}) {
  return (
    <div className={cn("flex items-center gap-3 bg-card border rounded-lg px-4 py-3 border-border", paid && "opacity-50")}>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{item.descricao}</p>
        <p className="text-xs text-muted-foreground">{item.mes} · dia {item.dia}</p>
      </div>
      <span className={cn("font-semibold tabular-nums shrink-0 text-sm", paid ? "text-muted-foreground line-through" : "text-foreground")}>
        {fmtBRL(item.valor)}
      </span>
      {!paid && onMark && (
        <button onClick={onMark} title="Marcar como pago" className="text-muted-foreground hover:text-green-400 transition-colors">
          <Check size={15} />
        </button>
      )}
      <button onClick={onEdit} className="text-muted-foreground hover:text-blue-400 transition-colors"><Pencil size={13} /></button>
      <button onClick={onDelete} className="text-muted-foreground hover:text-red-500 transition-colors"><Trash2 size={13} /></button>
    </div>
  );
}
