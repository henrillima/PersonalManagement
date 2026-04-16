import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import { apiFetch, fmtBRL, currentMes, mesLabel } from "@/lib/api";
import type { FaturaCartao, FaturasResponse } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";

function addMonths(mes: string, delta: number): string {
  const [y, m] = mes.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function Faturas() {
  const qc = useQueryClient();
  const [mes, setMes] = useState(currentMes());
  const [cartaoOpen, setCartaoOpen] = useState(false);
  const [novoCartao, setNovoCartao] = useState("");
  const [novoVenc, setNovoVenc]     = useState("");
  const [localEdits, setLocalEdits] = useState<Record<string, string>>({});

  const { data: cartoes = [], isLoading: lC } = useQuery<FaturaCartao[]>({
    queryKey: ["faturas-cartoes"],
    queryFn: () => apiFetch("/api/v1/faturas/cartoes"),
  });

  const { data: faturas, isLoading: lF } = useQuery<FaturasResponse>({
    queryKey: ["faturas", mes],
    queryFn: () => apiFetch(`/api/v1/faturas?mes=${mes}`),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["faturas", mes] });
    qc.invalidateQueries({ queryKey: ["home-resumo"] });
  };

  const createCartao = useMutation({
    mutationFn: (d: object) => apiFetch("/api/v1/faturas/cartoes", { method: "POST", body: JSON.stringify(d) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["faturas-cartoes"] }); setCartaoOpen(false); setNovoCartao(""); setNovoVenc(""); },
  });

  const deleteCartao = useMutation({
    mutationFn: (cartao: string) => apiFetch(`/api/v1/faturas/cartoes/${encodeURIComponent(cartao)}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["faturas-cartoes"] }),
  });

  const upsertFatura = useMutation({
    mutationFn: (d: object) => apiFetch("/api/v1/faturas", { method: "PUT", body: JSON.stringify(d) }),
    onSuccess: invalidate,
  });

  function handleBlur(cartao: string) {
    const key = cartao;
    if (localEdits[key] === undefined) return;
    const valor = parseFloat(localEdits[key] || "0");
    upsertFatura.mutate({ cartao, mes, valor });
    setLocalEdits((e) => { const n = { ...e }; delete n[key]; return n; });
  }

  if (lC || lF) return <Skeleton className="h-64 rounded-xl" />;

  return (
    <div className="space-y-5">
      {/* Month navigator */}
      <div className="flex items-center gap-3">
        <button onClick={() => setMes(addMonths(mes, -1))} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
          <ChevronLeft size={16} />
        </button>
        <span className="text-sm font-semibold w-20 text-center">{mesLabel(mes)}</span>
        <button onClick={() => setMes(addMonths(mes, 1))} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
          <ChevronRight size={16} />
        </button>
        <span className="text-sm text-muted-foreground ml-2">
          Total: <span className="font-semibold text-foreground">{fmtBRL(faturas?.total ?? 0)}</span>
        </span>
        <div className="flex-1" />
        <Button variant="outline" size="sm" onClick={() => setCartaoOpen(true)}>
          <Plus size={14} className="mr-1" /> Cartão
        </Button>
      </div>

      {/* Faturas matrix */}
      {cartoes.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground text-sm">
          Adicione seus cartões de crédito.
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Cartão</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">Vencimento</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Valor {mesLabel(mes)}</th>
                <th className="w-10 py-3" />
              </tr>
            </thead>
            <tbody>
              {faturas?.faturas.map((row) => {
                const editKey = row.cartao;
                const displayVal = localEdits[editKey] ?? String(row.valor === 0 ? "" : row.valor);
                return (
                  <tr key={row.cartao} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium">{row.cartao}</td>
                    <td className="px-4 py-3 text-center text-muted-foreground">dia {row.vencimento}</td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        step="0.01"
                        value={displayVal}
                        onChange={(e) => setLocalEdits((eds) => ({ ...eds, [editKey]: e.target.value }))}
                        onBlur={() => handleBlur(row.cartao)}
                        className="w-full text-right bg-transparent border-0 outline-none focus:ring-1 focus:ring-[#C8DA2D]/60 rounded px-1 font-medium tabular-nums"
                        placeholder="0,00"
                      />
                    </td>
                    <td className="px-2 py-3">
                      <button
                        onClick={() => deleteCartao.mutate(row.cartao)}
                        className="text-muted-foreground hover:text-red-500 transition-colors"
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-muted/50">
                <td colSpan={2} className="px-4 py-3 font-semibold">Total</td>
                <td className="px-4 py-3 text-right font-bold text-[#C8DA2D] tabular-nums">{fmtBRL(faturas?.total ?? 0)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <Dialog open={cartaoOpen} onOpenChange={setCartaoOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Novo Cartão</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Nome do cartão</Label>
              <Input value={novoCartao} onChange={(e) => setNovoCartao(e.target.value)} placeholder="Ex: Nubank, Itaú..." className="mt-1" />
            </div>
            <div>
              <Label>Dia de vencimento</Label>
              <Input type="number" min={1} max={31} value={novoVenc} onChange={(e) => setNovoVenc(e.target.value)} placeholder="15" className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCartaoOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => createCartao.mutate({ cartao: novoCartao, vencimento: parseInt(novoVenc) })}
              disabled={!novoCartao.trim() || !novoVenc || createCartao.isPending}
              className="bg-[#C8DA2D] text-[#0C1923] hover:bg-[#d4e640]"
            >
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
