import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, ChevronLeft, ChevronRight, Settings } from "lucide-react";
import { apiFetch, fmtBRL, currentMes, mesLabel } from "@/lib/api";
import type { Aporte, PlanoInvestimentoResponse } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

const CLASSES = [
  "Liquidez","Renda Fixa Pós","Renda Fixa Pré",
  "RV Brasil","RV Exterior","FIIs","Alternativos","Cripto",
];

function addMonths(mes: string, delta: number): string {
  const [y, m] = mes.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

interface AporteForm { dia: string; classe: string; ativo: string; valor: string; }
const emptyAporte = (): AporteForm => ({ dia: String(new Date().getDate()), classe: "Renda Fixa Pós", ativo: "", valor: "" });

export default function Investimentos() {
  const qc = useQueryClient();
  const [mes, setMes] = useState(currentMes());
  const [aporteOpen, setAporteOpen] = useState(false);
  const [planoOpen, setPlanoOpen]   = useState(false);
  const [form, setForm] = useState<AporteForm>(emptyAporte());
  const [planoEdits, setPlanoEdits] = useState<Record<string, string>>({});

  const { data: aportes = [], isLoading: lA } = useQuery<Aporte[]>({
    queryKey: ["aportes", mes],
    queryFn: () => apiFetch(`/api/v1/aportes?mes=${mes}`),
  });

  const { data: plano, isLoading: lP } = useQuery<PlanoInvestimentoResponse>({
    queryKey: ["plano-investimento"],
    queryFn: () => apiFetch("/api/v1/plano-investimento"),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["aportes", mes] });

  const createAporte = useMutation({
    mutationFn: (d: object) => apiFetch("/api/v1/aportes", { method: "POST", body: JSON.stringify(d) }),
    onSuccess: () => { invalidate(); setAporteOpen(false); },
  });

  const deleteAporte = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/v1/aportes/${id}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });

  const savePlano = useMutation({
    mutationFn: (body: object) => apiFetch("/api/v1/plano-investimento/estrutural", { method: "PUT", body: JSON.stringify(body) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["plano-investimento"] }); setPlanoOpen(false); },
  });

  function openPlano() {
    const edits: Record<string, string> = {};
    CLASSES.forEach((c) => { edits[c] = String(plano?.estrutural[c] ?? ""); });
    setPlanoEdits(edits);
    setPlanoOpen(true);
  }

  function handleSavePlano() {
    const body: Record<string, number> = {};
    CLASSES.forEach((c) => { const v = parseFloat(planoEdits[c] || "0"); if (v > 0) body[c] = v; });
    savePlano.mutate(body);
  }

  // Per-class totals this month
  const byClasse: Record<string, number> = {};
  aportes.forEach((a) => { byClasse[a.classe] = (byClasse[a.classe] ?? 0) + a.valor; });
  const totalMes = aportes.reduce((s, a) => s + a.valor, 0);
  const totalPlano = CLASSES.reduce((s, c) => s + (plano?.estrutural[c] ?? 0), 0);

  if (lA || lP) return <Skeleton className="h-64 rounded-xl" />;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => setMes(addMonths(mes, -1))} className="p-1.5 rounded-lg hover:bg-muted transition-colors"><ChevronLeft size={16} /></button>
        <span className="text-sm font-semibold w-20 text-center">{mesLabel(mes)}</span>
        <button onClick={() => setMes(addMonths(mes, 1))} className="p-1.5 rounded-lg hover:bg-muted transition-colors"><ChevronRight size={16} /></button>
        <span className="text-sm text-muted-foreground ml-2">
          {fmtBRL(totalMes)} / {totalPlano > 0 ? fmtBRL(totalPlano) : "—"}
        </span>
        <div className="flex-1" />
        <Button variant="outline" size="sm" onClick={openPlano}><Settings size={14} className="mr-1" />Plano</Button>
        <Button size="sm" onClick={() => { setForm(emptyAporte()); setAporteOpen(true); }} className="bg-[#C8DA2D] text-[#0C1923] hover:bg-[#d4e640]">
          <Plus size={14} className="mr-1" /> Aporte
        </Button>
      </div>

      {/* Progress bars by class */}
      {totalPlano > 0 && (
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold mb-4">Meta vs. Realizado</h3>
          <div className="space-y-3">
            {CLASSES.filter((c) => (plano?.estrutural[c] ?? 0) > 0 || (byClasse[c] ?? 0) > 0).map((classe) => {
              const realizado = byClasse[classe] ?? 0;
              const meta      = plano?.estrutural[classe] ?? 0;
              const pct       = meta > 0 ? Math.min((realizado / meta) * 100, 100) : 0;
              return (
                <div key={classe}>
                  <div className="flex justify-between text-xs mb-1">
                    <span>{classe}</span>
                    <span>{fmtBRL(realizado)}{meta > 0 && ` / ${fmtBRL(meta)}`}</span>
                  </div>
                  {meta > 0 && <Progress value={pct} className="h-1.5" />}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Aportes list */}
      {aportes.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground text-sm">
          Nenhum aporte registrado em {mesLabel(mes)}.
        </div>
      ) : (
        <div className="space-y-1">
          {aportes.map((a) => (
            <div key={a.id} className="flex items-center gap-3 bg-card border border-border rounded-lg px-4 py-3">
              <span className="text-xs text-muted-foreground w-10 shrink-0">dia {a.dia}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{a.ativo}</p>
                <p className="text-xs text-muted-foreground">{a.classe}</p>
              </div>
              <span className="font-semibold text-[#C8DA2D] tabular-nums shrink-0 text-sm">{fmtBRL(a.valor)}</span>
              <button onClick={() => deleteAporte.mutate(a.id)} className="text-muted-foreground hover:text-red-500 transition-colors"><Trash2 size={13} /></button>
            </div>
          ))}
        </div>
      )}

      {/* Aporte Dialog */}
      <Dialog open={aporteOpen} onOpenChange={setAporteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Registrar Aporte</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Classe</Label>
                <Select value={form.classe} onValueChange={(v) => setForm((f) => ({ ...f, classe: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CLASSES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Dia</Label>
                <Input type="number" min={1} max={31} value={form.dia} onChange={(e) => setForm((f) => ({ ...f, dia: e.target.value }))} className="mt-1" />
              </div>
            </div>
            <div>
              <Label>Ativo / Produto</Label>
              <Input value={form.ativo} onChange={(e) => setForm((f) => ({ ...f, ativo: e.target.value }))} placeholder="Ex: IPCA+, BOVA11, Tesouro..." className="mt-1" />
            </div>
            <div>
              <Label>Valor (R$)</Label>
              <Input type="number" step="0.01" value={form.valor} onChange={(e) => setForm((f) => ({ ...f, valor: e.target.value }))} placeholder="0,00" className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAporteOpen(false)}>Cancelar</Button>
            <Button onClick={() => createAporte.mutate({ mes, ...form, dia: parseInt(form.dia), valor: parseFloat(form.valor) })} disabled={!form.ativo || !form.valor || createAporte.isPending} className="bg-[#C8DA2D] text-[#0C1923] hover:bg-[#d4e640]">
              Registrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Plano Dialog */}
      <Dialog open={planoOpen} onOpenChange={setPlanoOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Plano de Aporte Mensal</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            {CLASSES.map((classe) => (
              <div key={classe} className="flex items-center gap-3">
                <Label className="w-40 shrink-0 text-xs">{classe}</Label>
                <Input type="number" step="0.01" value={planoEdits[classe] ?? ""} onChange={(e) => setPlanoEdits((p) => ({ ...p, [classe]: e.target.value }))} placeholder="0,00" className="h-8 text-sm" />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPlanoOpen(false)}>Cancelar</Button>
            <Button onClick={handleSavePlano} disabled={savePlano.isPending} className="bg-[#C8DA2D] text-[#0C1923] hover:bg-[#d4e640]">Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
