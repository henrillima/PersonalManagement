import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Pencil } from "lucide-react";
import { apiFetch, fmtBRL } from "@/lib/api";
import type { FluxoRecorrente } from "@/types";
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

interface Form {
  tipo: "Receita" | "Despesa";
  categoria: string;
  descricao: string;
  dia: string;
  valor: string;
  inicio: string;
  fim: string;
}

const empty = (): Form => ({
  tipo: "Despesa", categoria: "Moradia", descricao: "",
  dia: "1", valor: "", inicio: new Date().toISOString().slice(0, 7), fim: "",
});

export default function Recorrentes() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<FluxoRecorrente | null>(null);
  const [form, setForm] = useState<Form>(empty());

  const { data: rows = [], isLoading } = useQuery<FluxoRecorrente[]>({
    queryKey: ["recorrentes"],
    queryFn: () => apiFetch("/api/v1/recorrentes"),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["recorrentes"] });

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

  function openCreate() { setEditing(null); setForm(empty()); setOpen(true); }
  function openEdit(r: FluxoRecorrente) {
    setEditing(r);
    setForm({
      tipo: r.tipo, categoria: r.categoria, descricao: r.descricao,
      dia: String(r.dia), valor: String(r.valor), inicio: r.inicio, fim: r.fim ?? "",
    });
    setOpen(true);
  }

  function handleSave() {
    const payload = {
      tipo: form.tipo, categoria: form.categoria, descricao: form.descricao,
      dia: parseInt(form.dia), valor: parseFloat(form.valor),
      inicio: form.inicio, fim: form.fim || undefined,
    };
    if (editing) update.mutate({ id: editing.id, d: payload });
    else create.mutate(payload);
  }

  const receitas = rows.filter((r) => r.tipo === "Receita");
  const despesas = rows.filter((r) => r.tipo === "Despesa");
  const totalReceitas = receitas.reduce((s, r) => s + r.valor, 0);
  const totalDespesas = despesas.reduce((s, r) => s + r.valor, 0);

  if (isLoading) return <Skeleton className="h-64 rounded-xl" />;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex gap-6">
          <div>
            <p className="text-xs text-muted-foreground">Receitas mensais</p>
            <p className="text-lg font-bold text-green-400">{fmtBRL(totalReceitas)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Despesas mensais</p>
            <p className="text-lg font-bold text-red-400">{fmtBRL(totalDespesas)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Saldo estrutural</p>
            <p className={cn("text-lg font-bold", totalReceitas - totalDespesas >= 0 ? "text-green-400" : "text-red-400")}>
              {fmtBRL(totalReceitas - totalDespesas)}
            </p>
          </div>
        </div>
        <Button size="sm" onClick={openCreate} className="bg-[#C8DA2D] text-[#0C1923] hover:bg-[#d4e640]">
          <Plus size={14} className="mr-1" /> Novo Fluxo
        </Button>
      </div>

      {[{ label: "Receitas", items: receitas, color: "text-green-400" }, { label: "Despesas", items: despesas, color: "text-red-400" }].map(({ label, items, color }) => (
        <div key={label}>
          <h3 className={cn("text-sm font-semibold mb-2", color)}>{label}</h3>
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground py-3">Nenhum lançamento.</p>
          ) : (
            <div className="space-y-1">
              {items.map((r) => (
                <div key={r.id} className="flex items-center gap-3 bg-card border border-border rounded-lg px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{r.descricao}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.categoria} · dia {r.dia} · {r.inicio}{r.fim ? ` até ${r.fim}` : " (ativo)"}
                    </p>
                  </div>
                  <span className={cn("font-semibold tabular-nums shrink-0", color)}>{fmtBRL(r.valor)}</span>
                  <button onClick={() => openEdit(r)} className="text-muted-foreground hover:text-foreground transition-colors">
                    <Pencil size={14} />
                  </button>
                  <button onClick={() => del.mutate(r.id)} className="text-muted-foreground hover:text-red-500 transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
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
