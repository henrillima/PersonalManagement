import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Check, Pencil } from "lucide-react";
import { apiFetch, fmtBRL } from "@/lib/api";
import type { Divida } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface Form { descricao: string; valor: string; mes: string; dia: string; }
const empty = (): Form => ({
  descricao: "", valor: "",
  mes: new Date().toISOString().slice(0, 7),
  dia: String(new Date().getDate()),
});

export default function Pendencias() {
  const qc = useQueryClient();
  const [open, setOpen]       = useState(false);
  const [form, setForm]       = useState<Form>(empty());
  const [editing, setEditing] = useState<Divida | null>(null);

  const { data: rows = [], isLoading } = useQuery<Divida[]>({
    queryKey: ["dividas"],
    queryFn: () => apiFetch("/api/v1/dividas"),
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

  const today = new Date().toISOString().slice(0, 7);
  const atrasadas = rows.filter((r) => !r.pago && r.mes < today);
  const vincendas = rows.filter((r) => !r.pago && r.mes >= today);
  const pagas     = rows.filter((r) => r.pago);
  const totalPendente = [...atrasadas, ...vincendas].reduce((s, r) => s + r.valor, 0);

  if (isLoading) return <Skeleton className="h-64 rounded-xl" />;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {atrasadas.length + vincendas.length} pendente{(atrasadas.length + vincendas.length) !== 1 ? "s" : ""} · {fmtBRL(totalPendente)}
        </p>
        <Button size="sm" onClick={openCreate} className="bg-[#C8DA2D] text-[#0C1923] hover:bg-[#d4e640]">
          <Plus size={14} className="mr-1" /> Nova Dívida
        </Button>
      </div>

      {atrasadas.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-red-400 mb-2">Atrasadas ({atrasadas.length})</h3>
          <div className="space-y-1">
            {atrasadas.map((r) => (
              <DividaRow key={r.id} item={r}
                onMark={() => update.mutate({ id: r.id, d: { pago: true } })}
                onEdit={() => openEdit(r)}
                onDelete={() => del.mutate(r.id)} atrasada />
            ))}
          </div>
        </div>
      )}

      <div>
        <h3 className="text-sm font-semibold text-amber-400 mb-2">A Vencer ({vincendas.length})</h3>
        {vincendas.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">Nenhuma pendência futura.</p>
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

function DividaRow({ item, onMark, onEdit, onDelete, atrasada, paid }: {
  item: Divida; onMark?: () => void; onEdit: () => void; onDelete: () => void; atrasada?: boolean; paid?: boolean;
}) {
  return (
    <div className={cn(
      "flex items-center gap-3 bg-card border rounded-lg px-4 py-3",
      atrasada ? "border-red-500/30" : "border-border",
      paid && "opacity-50"
    )}>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{item.descricao}</p>
        <p className="text-xs text-muted-foreground">{item.mes} · dia {item.dia}</p>
      </div>
      <span className={cn("font-semibold tabular-nums shrink-0 text-sm", atrasada ? "text-red-400" : paid ? "text-muted-foreground line-through" : "text-foreground")}>
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
