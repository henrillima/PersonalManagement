import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, ChevronLeft, ChevronRight, Settings, Building2, Pencil } from "lucide-react";
import { apiFetch, fmtBRL, currentMes, mesLabel } from "@/lib/api";
import type { Aporte, PlanoInvestimentoResponse, Corretora } from "@/types";
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

const NO_CORRETORA = "__none__";

function addMonths(mes: string, delta: number): string {
  const [y, m] = mes.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// ── Manage Corretoras Dialog ──────────────────────────────────────────────────

function CorretorasDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [nome, setNome] = useState("");
  const [cor, setCor]   = useState("#94a3b8");
  const [editing, setEditing] = useState<Corretora | null>(null);

  const { data: corretoras = [] } = useQuery<Corretora[]>({
    queryKey: ["corretoras"],
    queryFn: () => apiFetch("/api/v1/corretoras"),
  });

  const create = useMutation({
    mutationFn: (d: object) => apiFetch("/api/v1/corretoras", { method: "POST", body: JSON.stringify(d) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["corretoras"] }); setNome(""); setCor("#94a3b8"); },
  });

  const update = useMutation({
    mutationFn: ({ id, d }: { id: string; d: object }) =>
      apiFetch(`/api/v1/corretoras/${id}`, { method: "PATCH", body: JSON.stringify(d) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["corretoras"] }); setEditing(null); },
  });

  const del = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/v1/corretoras/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["corretoras"] }),
  });

  function handleSave() {
    if (editing) update.mutate({ id: editing.id, d: { nome: nome.trim(), cor } });
    else create.mutate({ nome: nome.trim(), cor });
    setNome(""); setCor("#94a3b8");
  }

  function startEdit(c: Corretora) { setEditing(c); setNome(c.nome); setCor(c.cor); }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Gerenciar Corretoras</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="flex gap-2">
            <Input placeholder="Nome da corretora" value={nome} onChange={(e) => setNome(e.target.value)} className="flex-1" />
            <input type="color" value={cor} onChange={(e) => setCor(e.target.value)} className="w-9 h-9 rounded-md border border-input cursor-pointer p-0.5" title="Cor" />
            <Button size="sm" onClick={handleSave} disabled={!nome.trim()} className="bg-[#C8DA2D] text-[#0C1923] hover:bg-[#d4e640]">
              {editing ? <Pencil size={13} /> : <Plus size={13} />}
            </Button>
          </div>
          {editing && (
            <button onClick={() => { setEditing(null); setNome(""); setCor("#94a3b8"); }} className="text-xs text-muted-foreground hover:text-foreground">
              Cancelar edição
            </button>
          )}
          <div className="space-y-1 max-h-56 overflow-y-auto">
            {corretoras.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Nenhuma corretora cadastrada.</p>}
            {corretoras.map((c) => (
              <div key={c.id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/40">
                <div className="w-3 h-3 rounded-full shrink-0" style={{ background: c.cor }} />
                <span className="flex-1 text-sm">{c.nome}</span>
                <button onClick={() => startEdit(c)} className="text-muted-foreground hover:text-blue-400 transition-colors"><Pencil size={12} /></button>
                <button onClick={() => del.mutate(c.id)} className="text-muted-foreground hover:text-red-500 transition-colors"><Trash2 size={12} /></button>
              </div>
            ))}
          </div>
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Fechar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

interface AporteForm { dia: string; classe: string; ativo: string; valor: string; corretora_id: string; }
const emptyAporte = (): AporteForm => ({
  dia: String(new Date().getDate()), classe: "Renda Fixa Pós", ativo: "", valor: "", corretora_id: NO_CORRETORA,
});

export default function Investimentos() {
  const qc = useQueryClient();
  const [mes, setMes]           = useState(currentMes());
  const [aporteOpen, setAporteOpen] = useState(false);
  const [planoOpen, setPlanoOpen]   = useState(false);
  const [corretorasOpen, setCorretorasOpen] = useState(false);
  const [form, setForm]         = useState<AporteForm>(emptyAporte());
  const [planoEdits, setPlanoEdits] = useState<Record<string, string>>({});

  const { data: aportes = [], isLoading: lA } = useQuery<Aporte[]>({
    queryKey: ["aportes", mes],
    queryFn: () => apiFetch(`/api/v1/aportes?mes=${mes}`),
  });

  const { data: plano, isLoading: lP } = useQuery<PlanoInvestimentoResponse>({
    queryKey: ["plano-investimento"],
    queryFn: () => apiFetch("/api/v1/plano-investimento"),
  });

  const { data: corretoras = [] } = useQuery<Corretora[]>({
    queryKey: ["corretoras"],
    queryFn: () => apiFetch("/api/v1/corretoras"),
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

  function handleCreateAporte() {
    const payload: Record<string, unknown> = {
      mes, dia: parseInt(form.dia), classe: form.classe, ativo: form.ativo, valor: parseFloat(form.valor),
    };
    if (form.corretora_id !== NO_CORRETORA) payload.corretora_id = form.corretora_id;
    createAporte.mutate(payload);
  }

  const byClasse: Record<string, number> = {};
  aportes.forEach((a) => { byClasse[a.classe] = (byClasse[a.classe] ?? 0) + a.valor; });
  const totalMes   = aportes.reduce((s, a) => s + a.valor, 0);
  const totalPlano = CLASSES.reduce((s, c) => s + (plano?.estrutural[c] ?? 0), 0);

  if (lA || lP) return <Skeleton className="h-64 rounded-xl" />;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={() => setMes(addMonths(mes, -1))} className="p-1.5 rounded-lg hover:bg-muted transition-colors"><ChevronLeft size={16} /></button>
        <span className="text-sm font-semibold w-20 text-center">{mesLabel(mes)}</span>
        <button onClick={() => setMes(addMonths(mes, 1))} className="p-1.5 rounded-lg hover:bg-muted transition-colors"><ChevronRight size={16} /></button>
        <span className="text-sm text-muted-foreground ml-2">
          {fmtBRL(totalMes)} / {totalPlano > 0 ? fmtBRL(totalPlano) : "—"}
        </span>
        <div className="flex-1" />
        <Button variant="outline" size="sm" onClick={() => setCorretorasOpen(true)}>
          <Building2 size={14} className="mr-1" /> Corretoras
        </Button>
        <Button variant="outline" size="sm" onClick={openPlano}>
          <Settings size={14} className="mr-1" /> Plano
        </Button>
        <Button size="sm" onClick={() => { setForm(emptyAporte()); setAporteOpen(true); }} className="bg-[#C8DA2D] text-[#0C1923] hover:bg-[#d4e640]">
          <Plus size={14} className="mr-1" /> Aporte
        </Button>
      </div>

      {/* Progress bars */}
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
                <div className="flex items-center gap-2">
                  <p className="text-xs text-muted-foreground">{a.classe}</p>
                  {a.corretora_nome && (
                    <span
                      className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                      style={{ backgroundColor: (a.corretora_cor ?? "#94a3b8") + "25", color: a.corretora_cor ?? "#94a3b8" }}
                    >
                      {a.corretora_nome}
                    </span>
                  )}
                </div>
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
                  <SelectContent>{CLASSES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
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
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Valor (R$)</Label>
                <Input type="number" step="0.01" value={form.valor} onChange={(e) => setForm((f) => ({ ...f, valor: e.target.value }))} placeholder="0,00" className="mt-1" />
              </div>
              <div>
                <Label>Corretora</Label>
                <Select value={form.corretora_id} onValueChange={(v) => setForm((f) => ({ ...f, corretora_id: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Nenhuma" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_CORRETORA}>— Nenhuma</SelectItem>
                    {corretoras.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        <span className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full inline-block" style={{ background: c.cor }} />
                          {c.nome}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAporteOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreateAporte} disabled={!form.ativo || !form.valor || createAporte.isPending} className="bg-[#C8DA2D] text-[#0C1923] hover:bg-[#d4e640]">
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

      <CorretorasDialog open={corretorasOpen} onClose={() => setCorretorasOpen(false)} />
    </div>
  );
}
