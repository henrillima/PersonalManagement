import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { apiFetch, fmtBRL, fmtDate } from "@/lib/api";
import type { Banco, CaixaResponse } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { cn } from "@/lib/utils";

export default function Caixa() {
  const qc = useQueryClient();

  const [addOpen, setAddOpen]     = useState(false);
  const [bancoOpen, setBancoOpen] = useState(false);
  const [bancoNome, setBancoNome] = useState("");
  const [snapshotDate, setSnapshotDate] = useState(new Date().toISOString().slice(0, 10));
  const [saldos, setSaldos] = useState<Record<string, string>>({});

  const { data: bancos = [], isLoading: lB } = useQuery<Banco[]>({
    queryKey: ["bancos"],
    queryFn: () => apiFetch("/api/v1/bancos"),
  });

  const { data: caixa, isLoading: lC } = useQuery<CaixaResponse>({
    queryKey: ["caixa"],
    queryFn: () => apiFetch("/api/v1/caixa"),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["caixa"] });
    qc.invalidateQueries({ queryKey: ["home-resumo"] });
  };

  const createBanco = useMutation({
    mutationFn: (d: object) => apiFetch("/api/v1/bancos", { method: "POST", body: JSON.stringify(d) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["bancos"] }); setBancoOpen(false); setBancoNome(""); },
  });

  const deleteBanco = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/v1/bancos/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bancos"] }),
  });

  const saveSnapshot = useMutation({
    mutationFn: (body: object) => apiFetch("/api/v1/caixa", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => { invalidate(); setAddOpen(false); setSaldos({}); },
  });

  function openAdd() {
    const initial: Record<string, string> = {};
    bancos.forEach((b) => { initial[b.id] = ""; });
    setSaldos(initial);
    setAddOpen(true);
  }

  function handleSave() {
    const rows = bancos.map((b) => ({
      banco_id: b.id,
      valor: parseFloat(saldos[b.id] || "0"),
    }));
    saveSnapshot.mutate({ data: snapshotDate, saldos: rows });
  }

  if (lB || lC) return (
    <div className="space-y-4">
      <Skeleton className="h-32 rounded-xl" />
      <Skeleton className="h-48 rounded-xl" />
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header actions */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            {caixa?.latest_date ? `Última atualização: ${fmtDate(caixa.latest_date)}` : "Nenhum registro ainda"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setBancoOpen(true)}>
            <Plus size={14} className="mr-1" /> Conta
          </Button>
          <Button
            size="sm"
            onClick={openAdd}
            disabled={bancos.length === 0}
            className="bg-[#C8DA2D] text-[#0C1923] hover:bg-[#d4e640]"
          >
            Registrar Saldos
          </Button>
        </div>
      </div>

      {/* Current balances */}
      {caixa && caixa.saldo_por_banco.length > 0 ? (
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="text-sm font-semibold mb-4">Saldo atual</h2>
          <div className="space-y-3">
            {caixa.saldo_por_banco.map((b) => (
              <div key={b.banco_id} className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{b.nome}</span>
                <span className="font-medium tabular-nums">{fmtBRL(b.valor)}</span>
              </div>
            ))}
            <div className="flex items-center justify-between pt-2 border-t border-border">
              <span className="font-semibold">Total</span>
              <span className="font-bold text-[#C8DA2D] tabular-nums text-lg">
                {fmtBRL(caixa.saldo_total)}
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground text-sm">
          Nenhum saldo registrado. Adicione suas contas e registre o primeiro snapshot.
        </div>
      )}

      {/* Historical chart */}
      {caixa && caixa.historico.length > 1 && (
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="text-sm font-semibold mb-4">Evolução do patrimônio</h2>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={caixa.historico}>
              <defs>
                <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#C8DA2D" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#C8DA2D" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="data" tick={{ fontSize: 11 }} tickLine={false} axisLine={false}
                tickFormatter={(v) => fmtDate(v)} />
              <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false}
                tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number) => [fmtBRL(v), "Patrimônio"]} labelFormatter={fmtDate} />
              <Area type="monotone" dataKey="total" stroke="#C8DA2D" fill="url(#grad)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Account list with delete */}
      {bancos.length > 0 && (
        <details className="text-xs">
          <summary className="cursor-pointer text-muted-foreground hover:text-foreground select-none">
            Gerenciar contas ({bancos.length})
          </summary>
          <div className="mt-2 flex flex-wrap gap-2">
            {bancos.map((b) => (
              <div key={b.id} className="flex items-center gap-2 border rounded-lg px-3 py-1.5 bg-card">
                <span className="font-medium">{b.nome}</span>
                <button
                  onClick={() => deleteBanco.mutate(b.id)}
                  className="text-muted-foreground hover:text-red-500 transition-colors"
                >
                  <Trash2 size={11} />
                </button>
              </div>
            ))}
          </div>
        </details>
      )}

      {/* Add banco dialog */}
      <Dialog open={bancoOpen} onOpenChange={setBancoOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Nova Conta</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>Nome da conta</Label>
              <Input
                value={bancoNome}
                onChange={(e) => setBancoNome(e.target.value)}
                placeholder="Ex: Nubank, XP, Bradesco..."
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBancoOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => createBanco.mutate({ nome: bancoNome })}
              disabled={!bancoNome.trim() || createBanco.isPending}
              className="bg-[#C8DA2D] text-[#0C1923] hover:bg-[#d4e640]"
            >
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Snapshot dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Registrar Saldos</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Data</Label>
              <Input
                type="date"
                value={snapshotDate}
                onChange={(e) => setSnapshotDate(e.target.value)}
                className="mt-1"
              />
            </div>
            {bancos.map((b) => (
              <div key={b.id}>
                <Label>{b.nome}</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={saldos[b.id] ?? ""}
                  onChange={(e) => setSaldos((s) => ({ ...s, [b.id]: e.target.value }))}
                  placeholder="0,00"
                  className="mt-1"
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancelar</Button>
            <Button
              onClick={handleSave}
              disabled={saveSnapshot.isPending}
              className="bg-[#C8DA2D] text-[#0C1923] hover:bg-[#d4e640]"
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
