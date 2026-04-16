import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Check } from "lucide-react";
import { apiFetch, fmtBRL, fmtDate } from "@/lib/api";
import type { Terceiro } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface Form { pessoa: string; origem: "pix" | "cartao"; descricao: string; mes_alvo: string; dia: string; valor: string; }
const empty = (): Form => ({
  pessoa: "", origem: "pix", descricao: "",
  mes_alvo: new Date().toISOString().slice(0, 7),
  dia: String(new Date().getDate()), valor: "",
});

export default function Terceiros() {
  const qc = useQueryClient();
  const [open, setOpen]   = useState(false);
  const [form, setForm]   = useState<Form>(empty());

  const { data: rows = [], isLoading } = useQuery<Terceiro[]>({
    queryKey: ["terceiros"],
    queryFn: () => apiFetch("/api/v1/terceiros"),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["terceiros"] });

  const create = useMutation({
    mutationFn: (d: object) => apiFetch("/api/v1/terceiros", { method: "POST", body: JSON.stringify(d) }),
    onSuccess: () => { invalidate(); setOpen(false); },
  });

  const update = useMutation({
    mutationFn: ({ id, d }: { id: string; d: object }) =>
      apiFetch(`/api/v1/terceiros/${id}`, { method: "PATCH", body: JSON.stringify(d) }),
    onSuccess: invalidate,
  });

  const del = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/v1/terceiros/${id}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });

  const pendentes = rows.filter((r) => !r.recebido);
  const recebidos = rows.filter((r) => r.recebido);
  const totalPendente = pendentes.reduce((s, r) => s + r.valor, 0);

  if (isLoading) return <Skeleton className="h-64 rounded-xl" />;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            {pendentes.length} pendente{pendentes.length !== 1 ? "s" : ""} · total {fmtBRL(totalPendente)}
          </p>
        </div>
        <Button size="sm" onClick={() => { setForm(empty()); setOpen(true); }} className="bg-[#C8DA2D] text-[#0C1923] hover:bg-[#d4e640]">
          <Plus size={14} className="mr-1" /> Registrar
        </Button>
      </div>

      {/* Pending */}
      <div>
        <h3 className="text-sm font-semibold text-amber-400 mb-2">A Receber ({pendentes.length})</h3>
        {pendentes.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">Nenhum valor pendente.</p>
        ) : (
          <div className="space-y-1">
            {pendentes.map((r) => <TerceiroRow key={r.id} item={r} onMark={() => update.mutate({ id: r.id, d: { recebido: true } })} onDelete={() => del.mutate(r.id)} />)}
          </div>
        )}
      </div>

      {/* Received */}
      {recebidos.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-green-400 mb-2">Recebidos ({recebidos.length})</h3>
          <div className="space-y-1">
            {recebidos.map((r) => <TerceiroRow key={r.id} item={r} received onDelete={() => del.mutate(r.id)} />)}
          </div>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Registrar Terceiro</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Pessoa</Label>
                <Input value={form.pessoa} onChange={(e) => setForm((f) => ({ ...f, pessoa: e.target.value }))} placeholder="Nome" className="mt-1" />
              </div>
              <div>
                <Label>Origem</Label>
                <Select value={form.origem} onValueChange={(v) => setForm((f) => ({ ...f, origem: v as "pix" | "cartao" }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pix">PIX</SelectItem>
                    <SelectItem value="cartao">Cartão</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Descrição</Label>
              <Input value={form.descricao} onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))} placeholder="Do que se trata?" className="mt-1" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Valor (R$)</Label>
                <Input type="number" step="0.01" value={form.valor} onChange={(e) => setForm((f) => ({ ...f, valor: e.target.value }))} placeholder="0,00" className="mt-1" />
              </div>
              <div>
                <Label>Mês</Label>
                <Input value={form.mes_alvo} onChange={(e) => setForm((f) => ({ ...f, mes_alvo: e.target.value }))} placeholder="2024-01" className="mt-1" />
              </div>
              <div>
                <Label>Dia</Label>
                <Input type="number" min={1} max={31} value={form.dia} onChange={(e) => setForm((f) => ({ ...f, dia: e.target.value }))} className="mt-1" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => create.mutate({ ...form, dia: parseInt(form.dia), valor: parseFloat(form.valor) })} disabled={!form.pessoa || !form.valor || create.isPending} className="bg-[#C8DA2D] text-[#0C1923] hover:bg-[#d4e640]">
              Registrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TerceiroRow({ item, received, onMark, onDelete }: {
  item: Terceiro; received?: boolean; onMark?: () => void; onDelete: () => void;
}) {
  return (
    <div className={cn("flex items-center gap-3 bg-card border rounded-lg px-4 py-3", received ? "border-border opacity-60" : "border-border")}>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{item.descricao}</p>
        <p className="text-xs text-muted-foreground">
          {item.pessoa} · {item.origem === "pix" ? "PIX" : "Cartão"} · {item.mes_alvo}
        </p>
      </div>
      <span className="font-semibold text-[#C8DA2D] tabular-nums shrink-0 text-sm">{fmtBRL(item.valor)}</span>
      {!received && onMark && (
        <button onClick={onMark} title="Marcar como recebido" className="text-muted-foreground hover:text-green-400 transition-colors">
          <Check size={15} />
        </button>
      )}
      <button onClick={onDelete} className="text-muted-foreground hover:text-red-500 transition-colors"><Trash2 size={13} /></button>
    </div>
  );
}
