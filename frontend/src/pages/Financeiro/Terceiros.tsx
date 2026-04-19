import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Check, Pencil, Users, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { apiFetch, fmtBRL } from "@/lib/api";
import type { Terceiro, Pessoa } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// ── Form ──────────────────────────────────────────────────────────────────────

interface Form {
  pessoa: string;
  direcao: "a_receber" | "a_pagar";
  origem: "pix" | "cartao";
  descricao: string;
  mes_alvo: string;
  dia: string;
  valor: string;
}

const empty = (): Form => ({
  pessoa: "", direcao: "a_receber", origem: "pix", descricao: "",
  mes_alvo: new Date().toISOString().slice(0, 7),
  dia: String(new Date().getDate()), valor: "",
});

// ── Manage Pessoas Dialog ─────────────────────────────────────────────────────

function PessoasDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");

  const { data: pessoas = [] } = useQuery<Pessoa[]>({
    queryKey: ["pessoas"],
    queryFn: () => apiFetch("/api/v1/pessoas"),
  });

  const create = useMutation({
    mutationFn: (d: object) => apiFetch("/api/v1/pessoas", { method: "POST", body: JSON.stringify(d) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["pessoas"] }); setNome(""); setTelefone(""); },
  });

  const del = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/v1/pessoas/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pessoas"] }),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Gerenciar Contatos</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Input placeholder="Nome *" value={nome} onChange={(e) => setNome(e.target.value)} />
            <Input placeholder="Telefone (opcional)" value={telefone} onChange={(e) => setTelefone(e.target.value)} />
            <Button
              size="sm" className="w-full bg-[#C8DA2D] text-[#0C1923] hover:bg-[#d4e640]"
              disabled={!nome.trim() || create.isPending}
              onClick={() => create.mutate({ nome: nome.trim(), telefone: telefone.trim() || undefined })}
            >
              <Plus size={13} className="mr-1" /> Adicionar Contato
            </Button>
          </div>
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {pessoas.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Nenhum contato cadastrado.</p>}
            {pessoas.map((p) => (
              <div key={p.id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/40">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{p.nome}</p>
                  {p.telefone && <p className="text-xs text-muted-foreground">{p.telefone}</p>}
                </div>
                <button onClick={() => del.mutate(p.id)} className="text-muted-foreground hover:text-red-500 transition-colors">
                  <Trash2 size={12} />
                </button>
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

export default function Terceiros() {
  const qc = useQueryClient();
  const [open, setOpen]         = useState(false);
  const [form, setForm]         = useState<Form>(empty());
  const [editing, setEditing]   = useState<Terceiro | null>(null);
  const [pessoasOpen, setPessoasOpen] = useState(false);
  const [tab, setTab]           = useState<"a_receber" | "a_pagar">("a_receber");

  const { data: rows = [], isLoading } = useQuery<Terceiro[]>({
    queryKey: ["terceiros"],
    queryFn: () => apiFetch("/api/v1/terceiros"),
  });

  const { data: pessoas = [] } = useQuery<Pessoa[]>({
    queryKey: ["pessoas"],
    queryFn: () => apiFetch("/api/v1/pessoas"),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["terceiros"] });

  const create = useMutation({
    mutationFn: (d: object) => apiFetch("/api/v1/terceiros", { method: "POST", body: JSON.stringify(d) }),
    onSuccess: () => { invalidate(); setOpen(false); },
  });

  const update = useMutation({
    mutationFn: ({ id, d }: { id: string; d: object }) =>
      apiFetch(`/api/v1/terceiros/${id}`, { method: "PATCH", body: JSON.stringify(d) }),
    onSuccess: () => { invalidate(); setOpen(false); setEditing(null); },
  });

  const del = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/v1/terceiros/${id}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });

  function openCreate() { setEditing(null); setForm({ ...empty(), direcao: tab }); setOpen(true); }
  function openEdit(r: Terceiro) {
    setEditing(r);
    setForm({
      pessoa: r.pessoa, direcao: r.direcao, origem: r.origem,
      descricao: r.descricao, mes_alvo: r.mes_alvo, dia: String(r.dia), valor: String(r.valor),
    });
    setOpen(true);
  }

  function handleSubmit() {
    const payload = { ...form, dia: parseInt(form.dia), valor: parseFloat(form.valor) };
    if (editing) update.mutate({ id: editing.id, d: payload });
    else create.mutate(payload);
  }

  function markLiquidado(r: Terceiro) {
    if (r.direcao === "a_receber") update.mutate({ id: r.id, d: { recebido: true } });
    else update.mutate({ id: r.id, d: { pago: true } });
  }

  // ── Derived state ──────────────────────────────────────────────────────────

  const aReceber = rows.filter((r) => r.direcao === "a_receber");
  const aPagar   = rows.filter((r) => r.direcao === "a_pagar");

  const totalReceber  = aReceber.filter((r) => !r.recebido).reduce((s, r) => s + r.valor, 0);
  const totalPagar    = aPagar.filter((r) => !r.pago).reduce((s, r) => s + r.valor, 0);
  const saldoLiquido  = totalReceber - totalPagar;

  // Saldo por pessoa (pending items only)
  const saldoPorPessoa = useMemo(() => {
    const map: Record<string, number> = {};
    for (const r of rows) {
      if ((r.direcao === "a_receber" && r.recebido) || (r.direcao === "a_pagar" && r.pago)) continue;
      const sign = r.direcao === "a_receber" ? 1 : -1;
      map[r.pessoa] = (map[r.pessoa] ?? 0) + sign * r.valor;
    }
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b, "pt-BR"));
  }, [rows]);

  const tabRows   = tab === "a_receber" ? aReceber : aPagar;
  const pending   = tabRows.filter((r) => tab === "a_receber" ? !r.recebido : !r.pago);
  const liquidados = tabRows.filter((r) => tab === "a_receber" ? r.recebido : r.pago);

  if (isLoading) return <Skeleton className="h-64 rounded-xl" />;

  return (
    <div className="space-y-5">

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-1.5 text-green-400 mb-1">
            <ArrowDownLeft size={13} />
            <span className="text-xs font-medium uppercase tracking-wider">A Receber</span>
          </div>
          <p className="text-lg font-bold text-green-400">{fmtBRL(totalReceber)}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-1.5 text-red-400 mb-1">
            <ArrowUpRight size={13} />
            <span className="text-xs font-medium uppercase tracking-wider">A Pagar</span>
          </div>
          <p className="text-lg font-bold text-red-400">{fmtBRL(totalPagar)}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">Saldo</p>
          <p className={cn("text-lg font-bold", saldoLiquido >= 0 ? "text-[#C8DA2D]" : "text-red-400")}>{fmtBRL(saldoLiquido)}</p>
        </div>
      </div>

      {/* Balance per person */}
      {saldoPorPessoa.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Saldo por Pessoa</p>
          <div className="space-y-2">
            {saldoPorPessoa.map(([nome, saldo]) => (
              <div key={nome} className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-bold shrink-0">
                  {nome[0]?.toUpperCase()}
                </div>
                <span className="flex-1 text-sm">{nome}</span>
                <span className={cn("text-sm font-semibold tabular-nums", saldo >= 0 ? "text-green-400" : "text-red-400")}>
                  {saldo >= 0 ? "+" : ""}{fmtBRL(saldo)}
                </span>
                <span className="text-[10px] text-muted-foreground">{saldo >= 0 ? "me deve" : "eu devo"}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Header actions */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-1 border-b border-border">
          <button
            onClick={() => setTab("a_receber")}
            className={cn("px-3 py-2 text-sm font-medium border-b-2 transition-colors -mb-px whitespace-nowrap",
              tab === "a_receber" ? "border-green-400 text-green-400" : "border-transparent text-muted-foreground hover:text-foreground")}
          >
            <ArrowDownLeft size={13} className="inline mr-1" />Eles me devem ({aReceber.filter(r => !r.recebido).length})
          </button>
          <button
            onClick={() => setTab("a_pagar")}
            className={cn("px-3 py-2 text-sm font-medium border-b-2 transition-colors -mb-px whitespace-nowrap",
              tab === "a_pagar" ? "border-red-400 text-red-400" : "border-transparent text-muted-foreground hover:text-foreground")}
          >
            <ArrowUpRight size={13} className="inline mr-1" />Eu devo ({aPagar.filter(r => !r.pago).length})
          </button>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setPessoasOpen(true)}>
            <Users size={13} className="mr-1" /> Contatos
          </Button>
          <Button size="sm" onClick={openCreate} className="bg-[#C8DA2D] text-[#0C1923] hover:bg-[#d4e640]">
            <Plus size={14} className="mr-1" /> Registrar
          </Button>
        </div>
      </div>

      {/* Pending */}
      {pending.length === 0 ? (
        <p className="text-sm text-muted-foreground py-2">
          {tab === "a_receber" ? "Nenhum valor a receber pendente." : "Nenhuma dívida com terceiros pendente."}
        </p>
      ) : (
        <div className="space-y-1">
          {pending.map((r) => (
            <TerceiroRow key={r.id} item={r}
              onMark={() => markLiquidado(r)}
              onEdit={() => openEdit(r)}
              onDelete={() => del.mutate(r.id)} />
          ))}
        </div>
      )}

      {/* Settled */}
      {liquidados.length > 0 && (
        <details className="text-xs">
          <summary className="cursor-pointer text-muted-foreground hover:text-foreground select-none">
            {tab === "a_receber" ? "Recebidos" : "Pagos"} ({liquidados.length})
          </summary>
          <div className="mt-2 space-y-1">
            {liquidados.map((r) => (
              <TerceiroRow key={r.id} item={r} settled
                onEdit={() => openEdit(r)}
                onDelete={() => del.mutate(r.id)} />
            ))}
          </div>
        </details>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing ? "Editar" : "Registrar"} Dívida com Terceiro</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">

            {/* Direção */}
            <div>
              <Label className="text-xs mb-2 block">Tipo</Label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, direcao: "a_receber" }))}
                  className={cn("flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border text-sm font-medium transition-colors",
                    form.direcao === "a_receber" ? "bg-green-500/20 border-green-500 text-green-400" : "border-border text-muted-foreground hover:text-foreground")}
                >
                  <ArrowDownLeft size={14} /> Eles me devem
                </button>
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, direcao: "a_pagar" }))}
                  className={cn("flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border text-sm font-medium transition-colors",
                    form.direcao === "a_pagar" ? "bg-red-500/20 border-red-500 text-red-400" : "border-border text-muted-foreground hover:text-foreground")}
                >
                  <ArrowUpRight size={14} /> Eu devo
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Pessoa</Label>
                {pessoas.length > 0 ? (
                  <>
                    <Select value={pessoas.some(p => p.nome === form.pessoa) ? form.pessoa : "__other__"}
                      onValueChange={(v) => setForm((f) => ({ ...f, pessoa: v === "__other__" ? "" : v }))}>
                      <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        {pessoas.map((p) => <SelectItem key={p.id} value={p.nome}>{p.nome}</SelectItem>)}
                        <SelectItem value="__other__">Outro (digitar)</SelectItem>
                      </SelectContent>
                    </Select>
                    {!pessoas.some(p => p.nome === form.pessoa) && (
                      <Input value={form.pessoa} onChange={(e) => setForm((f) => ({ ...f, pessoa: e.target.value }))} placeholder="Nome" className="mt-1" />
                    )}
                  </>
                ) : (
                  <Input value={form.pessoa} onChange={(e) => setForm((f) => ({ ...f, pessoa: e.target.value }))} placeholder="Nome" className="mt-1" />
                )}
              </div>
              <div>
                <Label>Via</Label>
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
            <Button variant="outline" onClick={() => { setOpen(false); setEditing(null); }}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={!form.pessoa || !form.valor || create.isPending || update.isPending} className="bg-[#C8DA2D] text-[#0C1923] hover:bg-[#d4e640]">
              {editing ? "Salvar" : "Registrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PessoasDialog open={pessoasOpen} onClose={() => setPessoasOpen(false)} />
    </div>
  );
}

function TerceiroRow({ item, settled, onMark, onEdit, onDelete }: {
  item: Terceiro; settled?: boolean; onMark?: () => void; onEdit: () => void; onDelete: () => void;
}) {
  const isReceber = item.direcao === "a_receber";
  return (
    <div className={cn("flex items-center gap-3 bg-card border rounded-lg px-4 py-3", settled && "opacity-60")}>
      <div className={cn("w-1 self-stretch rounded-full shrink-0", isReceber ? "bg-green-500/40" : "bg-red-500/40")} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{item.descricao}</p>
        <p className="text-xs text-muted-foreground">
          {item.pessoa} · {item.origem === "pix" ? "PIX" : "Cartão"} · {item.mes_alvo}
        </p>
      </div>
      <span className={cn("font-semibold tabular-nums shrink-0 text-sm", isReceber ? "text-green-400" : "text-red-400")}>
        {isReceber ? "+" : "-"}{fmtBRL(item.valor)}
      </span>
      {!settled && onMark && (
        <button onClick={onMark} title={isReceber ? "Marcar como recebido" : "Marcar como pago"} className="text-muted-foreground hover:text-green-400 transition-colors">
          <Check size={15} />
        </button>
      )}
      <button onClick={onEdit} className="text-muted-foreground hover:text-blue-400 transition-colors"><Pencil size={13} /></button>
      <button onClick={onDelete} className="text-muted-foreground hover:text-red-500 transition-colors"><Trash2 size={13} /></button>
    </div>
  );
}
