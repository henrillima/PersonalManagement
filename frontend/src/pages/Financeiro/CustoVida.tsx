import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Pencil, ChevronLeft, ChevronRight, Settings } from "lucide-react";
import { apiFetch, fmtBRL, currentMes, mesLabel } from "@/lib/api";
import type { GastoVariavel, OrcamentoResponse } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";

const CATEGORIAS = [
  "Moradia","Transporte","Alimentação (mercado)","Alimentação (fora)","Lazer",
  "Saúde","Educação","Videogame","Compras","Família","Outros",
];

function addMonths(mes: string, delta: number): string {
  const [y, m] = mes.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

interface GastoForm { dia: string; categoria: string; descricao: string; valor: string; }
const emptyGasto = (): GastoForm => ({ dia: String(new Date().getDate()), categoria: "Alimentação (fora)", descricao: "", valor: "" });

export default function CustoVida() {
  const qc = useQueryClient();
  const [mes, setMes] = useState(currentMes());
  const [gastoOpen, setGastoOpen] = useState(false);
  const [orcOpen, setOrcOpen]     = useState(false);
  const [editing, setEditing]     = useState<GastoVariavel | null>(null);
  const [form, setForm]           = useState<GastoForm>(emptyGasto());
  // Orçamento edit
  const [orcEdits, setOrcEdits]   = useState<Record<string, string>>({});

  const { data: gastos = [], isLoading: lG } = useQuery<GastoVariavel[]>({
    queryKey: ["gastos", mes],
    queryFn: () => apiFetch(`/api/v1/gastos?mes=${mes}`),
  });

  const { data: orc, isLoading: lO } = useQuery<OrcamentoResponse>({
    queryKey: ["orcamento"],
    queryFn: () => apiFetch("/api/v1/orcamento"),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["gastos", mes] });

  const createGasto = useMutation({
    mutationFn: (d: object) => apiFetch("/api/v1/gastos", { method: "POST", body: JSON.stringify(d) }),
    onSuccess: () => { invalidate(); setGastoOpen(false); },
  });

  const updateGasto = useMutation({
    mutationFn: ({ id, d }: { id: string; d: object }) =>
      apiFetch(`/api/v1/gastos/${id}`, { method: "PATCH", body: JSON.stringify(d) }),
    onSuccess: () => { invalidate(); setGastoOpen(false); },
  });

  const deleteGasto = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/v1/gastos/${id}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });

  const upsertOrc = useMutation({
    mutationFn: (d: object) => apiFetch("/api/v1/orcamento", { method: "PUT", body: JSON.stringify(d) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["orcamento"] }),
  });

  function openCreate() { setEditing(null); setForm(emptyGasto()); setGastoOpen(true); }
  function openEdit(g: GastoVariavel) {
    setEditing(g);
    setForm({ dia: String(g.dia), categoria: g.categoria, descricao: g.descricao, valor: String(g.valor) });
    setGastoOpen(true);
  }

  function handleSave() {
    const payload = { mes, dia: parseInt(form.dia), categoria: form.categoria, descricao: form.descricao, valor: parseFloat(form.valor) };
    if (editing) updateGasto.mutate({ id: editing.id, d: payload });
    else createGasto.mutate(payload);
  }

  function openOrcamento() {
    const edits: Record<string, string> = {};
    CATEGORIAS.forEach((c) => { edits[c] = String(orc?.base[c] ?? ""); });
    setOrcEdits(edits);
    setOrcOpen(true);
  }

  function saveOrcamento() {
    CATEGORIAS.forEach((cat) => {
      const val = parseFloat(orcEdits[cat] || "0");
      if (val > 0) upsertOrc.mutate({ categoria: cat, teto: val, mes_excecao: null });
    });
    setOrcOpen(false);
  }

  // Compute totals per category
  const byCat = useMemo(() => {
    const map: Record<string, number> = {};
    gastos.forEach((g) => { map[g.categoria] = (map[g.categoria] ?? 0) + g.valor; });
    return map;
  }, [gastos]);

  const totalGasto = gastos.reduce((s, g) => s + g.valor, 0);
  const totalTeto  = CATEGORIAS.reduce((s, c) => s + (orc?.base[c] ?? 0), 0);

  if (lG || lO) return <Skeleton className="h-64 rounded-xl" />;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => setMes(addMonths(mes, -1))} className="p-1.5 rounded-lg hover:bg-muted transition-colors"><ChevronLeft size={16} /></button>
        <span className="text-sm font-semibold w-20 text-center">{mesLabel(mes)}</span>
        <button onClick={() => setMes(addMonths(mes, 1))} className="p-1.5 rounded-lg hover:bg-muted transition-colors"><ChevronRight size={16} /></button>
        <div className="flex-1" />
        <span className="text-sm text-muted-foreground">
          {fmtBRL(totalGasto)} / {totalTeto > 0 ? fmtBRL(totalTeto) : "—"}
        </span>
        <Button variant="outline" size="sm" onClick={openOrcamento}><Settings size={14} className="mr-1" />Orçamento</Button>
        <Button size="sm" onClick={openCreate} className="bg-[#C8DA2D] text-[#0C1923] hover:bg-[#d4e640]">
          <Plus size={14} className="mr-1" /> Gasto
        </Button>
      </div>

      {/* Budget bars per category */}
      {CATEGORIAS.filter((c) => (orc?.base[c] ?? 0) > 0 || (byCat[c] ?? 0) > 0).length > 0 && (
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold mb-4">Por categoria</h3>
          <div className="space-y-3">
            {CATEGORIAS.filter((c) => (orc?.base[c] ?? 0) > 0 || (byCat[c] ?? 0) > 0).map((cat) => {
              const gasto = byCat[cat] ?? 0;
              const teto  = orc?.base[cat] ?? 0;
              const pct   = teto > 0 ? Math.min((gasto / teto) * 100, 100) : 0;
              const over  = teto > 0 && gasto > teto;
              return (
                <div key={cat}>
                  <div className="flex justify-between text-xs mb-1">
                    <span>{cat}</span>
                    <span className={cn(over && "text-red-400")}>
                      {fmtBRL(gasto)}{teto > 0 && ` / ${fmtBRL(teto)}`}
                    </span>
                  </div>
                  {teto > 0 && (
                    <Progress value={pct} className={cn("h-1.5", over && "[&>div]:bg-red-400")} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Transactions list */}
      {gastos.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground text-sm">
          Nenhum gasto registrado em {mesLabel(mes)}.
        </div>
      ) : (
        <div className="space-y-1">
          {[...gastos].sort((a, b) => b.dia - a.dia).map((g) => (
            <div key={g.id} className="flex items-center gap-3 bg-card border border-border rounded-lg px-4 py-3">
              <span className="text-xs text-muted-foreground w-10 shrink-0">dia {g.dia}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{g.descricao}</p>
                <p className="text-xs text-muted-foreground">{g.categoria}</p>
              </div>
              <span className="font-semibold text-red-400 tabular-nums shrink-0 text-sm">-{fmtBRL(g.valor)}</span>
              <button onClick={() => openEdit(g)} className="text-muted-foreground hover:text-foreground transition-colors"><Pencil size={13} /></button>
              <button onClick={() => deleteGasto.mutate(g.id)} className="text-muted-foreground hover:text-red-500 transition-colors"><Trash2 size={13} /></button>
            </div>
          ))}
        </div>
      )}

      {/* Gasto Dialog */}
      <Dialog open={gastoOpen} onOpenChange={setGastoOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing ? "Editar Gasto" : "Registrar Gasto"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Categoria</Label>
                <Select value={form.categoria} onValueChange={(v) => setForm((f) => ({ ...f, categoria: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIAS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Dia</Label>
                <Input type="number" min={1} max={31} value={form.dia} onChange={(e) => setForm((f) => ({ ...f, dia: e.target.value }))} className="mt-1" />
              </div>
            </div>
            <div>
              <Label>Descrição</Label>
              <Input value={form.descricao} onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))} placeholder="O que foi?" className="mt-1" />
            </div>
            <div>
              <Label>Valor (R$)</Label>
              <Input type="number" step="0.01" value={form.valor} onChange={(e) => setForm((f) => ({ ...f, valor: e.target.value }))} placeholder="0,00" className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGastoOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!form.descricao || !form.valor || createGasto.isPending || updateGasto.isPending} className="bg-[#C8DA2D] text-[#0C1923] hover:bg-[#d4e640]">
              {editing ? "Salvar" : "Registrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Orçamento Dialog */}
      <Dialog open={orcOpen} onOpenChange={setOrcOpen}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Editar Orçamento Base</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            {CATEGORIAS.map((cat) => (
              <div key={cat} className="flex items-center gap-3">
                <Label className="w-48 shrink-0 text-xs">{cat}</Label>
                <Input
                  type="number" step="0.01"
                  value={orcEdits[cat] ?? ""}
                  onChange={(e) => setOrcEdits((o) => ({ ...o, [cat]: e.target.value }))}
                  placeholder="0,00"
                  className="h-8 text-sm"
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOrcOpen(false)}>Cancelar</Button>
            <Button onClick={saveOrcamento} className="bg-[#C8DA2D] text-[#0C1923] hover:bg-[#d4e640]">Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
