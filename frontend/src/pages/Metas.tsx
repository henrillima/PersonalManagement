import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Pencil, Trophy, Target, Settings2, Check, X } from "lucide-react";
import { apiFetch } from "@/lib/api";
import type { Meta } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmojiPicker } from "@/components/ui/emoji-picker";
import { cn } from "@/lib/utils";

// ── Area management (localStorage) ────────────────────────────────────────────

export interface AreaDef { value: string; label: string; emoji: string; cor: string; }

const DEFAULT_AREAS: AreaDef[] = [
  { value: "pessoal",         label: "Pessoal",         emoji: "🧑",  cor: "#8b5cf6" },
  { value: "financeiro",      label: "Financeiro",      emoji: "💰",  cor: "#22c55e" },
  { value: "carreira",        label: "Carreira",        emoji: "💼",  cor: "#3b82f6" },
  { value: "saude",           label: "Saúde",           emoji: "❤️",  cor: "#f43f5e" },
  { value: "educacao",        label: "Educação",        emoji: "📚",  cor: "#f59e0b" },
  { value: "relacionamentos", label: "Relacionamentos", emoji: "👥",  cor: "#ec4899" },
  { value: "viagens",         label: "Viagens",         emoji: "🌍",  cor: "#14b8a6" },
  { value: "lazer",           label: "Lazer",           emoji: "🎮",  cor: "#f97316" },
];

const AREAS_KEY = "metas_areas_v1";

function loadAreas(): AreaDef[] {
  try {
    const s = localStorage.getItem(AREAS_KEY);
    return s ? JSON.parse(s) : DEFAULT_AREAS;
  } catch { return DEFAULT_AREAS; }
}

function persistAreas(areas: AreaDef[]) {
  localStorage.setItem(AREAS_KEY, JSON.stringify(areas));
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function calcProgress(m: Meta): number {
  if (
    m.tipo === "numerica" &&
    m.valor_alvo != null && m.valor_inicial != null && m.valor_atual != null
  ) {
    const range = Math.abs(m.valor_alvo - m.valor_inicial);
    if (range === 0) return 100;
    const raw = m.direcao === "crescente"
      ? (m.valor_atual - m.valor_inicial) / range * 100
      : (m.valor_inicial - m.valor_atual) / range * 100;
    return Math.min(100, Math.max(0, raw));
  }
  return m.progresso;
}

function fmtNum(n: number, unidade?: string | null): string {
  const s = n % 1 === 0
    ? n.toLocaleString("pt-BR")
    : n.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 2 });
  return unidade ? `${s} ${unidade}` : s;
}

// ── Form types ─────────────────────────────────────────────────────────────────

interface MetaForm {
  titulo: string; descricao: string; area: string; prazo: string; emoji: string;
  progresso: number;
  tipo: "qualitativa" | "numerica";
  direcao: "crescente" | "decrescente";
  valor_inicial: string; valor_atual: string; valor_alvo: string; unidade: string;
}

const emptyForm = (): MetaForm => ({
  titulo: "", descricao: "", area: "pessoal", prazo: "", emoji: "🎯",
  progresso: 0, tipo: "qualitativa", direcao: "crescente",
  valor_inicial: "", valor_atual: "", valor_alvo: "", unidade: "",
});

function metaToForm(m: Meta): MetaForm {
  return {
    titulo: m.titulo, descricao: m.descricao ?? "", area: m.area,
    prazo: m.prazo ?? "", emoji: m.emoji, progresso: m.progresso,
    tipo: m.tipo, direcao: m.direcao,
    valor_inicial: m.valor_inicial != null ? String(m.valor_inicial) : "",
    valor_atual:   m.valor_atual   != null ? String(m.valor_atual)   : "",
    valor_alvo:    m.valor_alvo    != null ? String(m.valor_alvo)    : "",
    unidade: m.unidade ?? "",
  };
}

// ── Main ───────────────────────────────────────────────────────────────────────

export default function Metas() {
  const qc = useQueryClient();

  const [areas, setAreas]             = useState<AreaDef[]>(loadAreas);
  const [dialogOpen, setDialogOpen]   = useState(false);
  const [areasOpen, setAreasOpen]     = useState(false);
  const [editing, setEditing]         = useState<Meta | null>(null);
  const [form, setForm]               = useState<MetaForm>(emptyForm());
  const [areaFilter, setAreaFilter]   = useState("all");
  const [statusFilter, setStatusFilter] = useState<"ativa" | "conquistada" | "all">("ativa");

  const [newLabel, setNewLabel] = useState("");
  const [newEmoji, setNewEmoji] = useState("⭐");
  const [newCor, setNewCor]     = useState("#6366f1");

  const { data: metas = [], isLoading } = useQuery<Meta[]>({
    queryKey: ["metas"],
    queryFn: () => apiFetch("/api/v1/metas"),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["metas"] });
  const onErr = (e: Error) => alert(`Erro: ${e.message}`);

  const createMeta = useMutation({
    mutationFn: (d: object) => apiFetch("/api/v1/metas", { method: "POST", body: JSON.stringify(d) }),
    onSuccess: () => { invalidate(); setDialogOpen(false); },
    onError: onErr,
  });

  const updateMeta = useMutation({
    mutationFn: ({ id, d }: { id: string; d: object }) =>
      apiFetch(`/api/v1/metas/${id}`, { method: "PATCH", body: JSON.stringify(d) }),
    onError: onErr,
  });

  const deleteMeta = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/v1/metas/${id}`, { method: "DELETE" }),
    onSuccess: invalidate,
    onError: onErr,
  });

  function patchQuick(id: string, d: object) {
    updateMeta.mutate({ id, d }, { onSuccess: () => invalidate() });
  }

  const visible = useMemo(() => metas.filter(m => {
    if (areaFilter !== "all" && m.area !== areaFilter) return false;
    if (statusFilter !== "all" && m.status !== statusFilter) return false;
    return true;
  }), [metas, areaFilter, statusFilter]);

  const ativas       = metas.filter(m => m.status === "ativa").length;
  const conquistadas = metas.filter(m => m.status === "conquistada").length;

  function openCreate() { setEditing(null); setForm(emptyForm()); setDialogOpen(true); }
  function openEdit(m: Meta) { setEditing(m); setForm(metaToForm(m)); setDialogOpen(true); }

  function updateAreas(next: AreaDef[]) { setAreas(next); persistAreas(next); }

  function addArea() {
    if (!newLabel.trim()) return;
    const v = newLabel.trim().toLowerCase().replace(/\s+/g, "_") + "_" + Date.now();
    updateAreas([...areas, { value: v, label: newLabel.trim(), emoji: newEmoji, cor: newCor }]);
    setNewLabel(""); setNewEmoji("⭐"); setNewCor("#6366f1");
  }

  function buildPayload(f: MetaForm) {
    const base = {
      titulo: f.titulo, descricao: f.descricao || undefined,
      area: f.area, prazo: f.prazo || undefined, emoji: f.emoji, tipo: f.tipo,
    };
    if (f.tipo === "numerica") {
      const vi = parseFloat(f.valor_inicial);
      const va = parseFloat(f.valor_atual);
      const vt = parseFloat(f.valor_alvo);
      return {
        ...base, direcao: f.direcao, progresso: 0,
        valor_inicial: isNaN(vi) ? null : vi,
        valor_atual:   isNaN(va) ? null : va,
        valor_alvo:    isNaN(vt) ? null : vt,
        unidade: f.unidade || null,
      };
    }
    return { ...base, progresso: f.progresso };
  }

  function handleSave() {
    if (!form.titulo.trim()) return;
    const payload = buildPayload(form);
    if (editing) {
      updateMeta.mutate({ id: editing.id, d: payload }, {
        onSuccess: () => { invalidate(); setDialogOpen(false); },
      });
    } else {
      createMeta.mutate(payload);
    }
  }

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Metas de Vida</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {ativas} ativa{ativas !== 1 ? "s" : ""}
            {conquistadas > 0 && (
              <span className="text-[#C8DA2D] ml-1">· {conquistadas} conquistada{conquistadas !== 1 ? "s" : ""} 🏆</span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setAreasOpen(true)}>
            <Settings2 size={13} className="mr-1" /> Áreas
          </Button>
          <Button onClick={openCreate} className="bg-[#C8DA2D] text-[#0C1923] hover:bg-[#d4e640]">
            <Plus size={14} className="mr-1" /> Nova Meta
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1.5 flex-wrap">
          <AreaPill active={areaFilter === "all"} onClick={() => setAreaFilter("all")}>🎯 Todas</AreaPill>
          {areas.map(a => (
            <AreaPill key={a.value} active={areaFilter === a.value} cor={a.cor}
              onClick={() => setAreaFilter(areaFilter === a.value ? "all" : a.value)}>
              {a.emoji} {a.label}
            </AreaPill>
          ))}
        </div>
        <div className="flex gap-1 ml-auto border border-border rounded-lg p-0.5">
          {(["ativa", "conquistada", "all"] as const).map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={cn(
                "px-3 py-1 text-xs font-medium rounded-md transition-colors",
                statusFilter === s ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
              )}>
              {s === "ativa" ? "Ativas" : s === "conquistada" ? "🏆 Conquistadas" : "Todas"}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <div key={i} className="h-52 bg-muted rounded-2xl animate-pulse" />)}
        </div>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Target size={40} className="text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">Nenhuma meta aqui.</p>
          <button onClick={openCreate} className="mt-2 text-sm text-[#C8DA2D] hover:underline">
            Criar primeira meta
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {visible.map(m => (
            <MetaCard key={m.id} meta={m} areas={areas}
              onEdit={() => openEdit(m)}
              onDelete={() => { if (confirm("Excluir esta meta?")) deleteMeta.mutate(m.id); }}
              onConquistar={() => patchQuick(m.id, { status: "conquistada" })}
              onReativar={() => patchQuick(m.id, { status: "ativa" })}
              onUpdateValorAtual={v => patchQuick(m.id, { valor_atual: v })}
            />
          ))}
        </div>
      )}

      {/* Create / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Meta" : "Nova Meta de Vida"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">

            <div className="flex gap-3 items-end">
              <div>
                <Label>Ícone</Label>
                <div className="mt-1">
                  <EmojiPicker value={form.emoji} onChange={e => setForm(f => ({ ...f, emoji: e }))} />
                </div>
              </div>
              <div className="flex-1">
                <Label>Título *</Label>
                <Input value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))}
                  placeholder="Ex: Aprender japonês..." className="mt-1" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Área</Label>
                <Select value={form.area} onValueChange={v => setForm(f => ({ ...f, area: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {areas.map(a => <SelectItem key={a.value} value={a.value}>{a.emoji} {a.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Prazo (opcional)</Label>
                <Input type="date" value={form.prazo}
                  onChange={e => setForm(f => ({ ...f, prazo: e.target.value }))} className="mt-1" />
              </div>
            </div>

            {/* Tipo selector */}
            <div>
              <Label>Tipo de meta</Label>
              <div className="flex gap-2 mt-2">
                {(["qualitativa", "numerica"] as const).map(t => (
                  <button key={t} type="button" onClick={() => setForm(f => ({ ...f, tipo: t }))}
                    className={cn(
                      "flex-1 py-2 text-sm font-medium rounded-lg border transition-colors",
                      form.tipo === t
                        ? "bg-[#C8DA2D] text-[#0C1923] border-[#C8DA2D]"
                        : "border-border text-muted-foreground hover:text-foreground"
                    )}>
                    {t === "qualitativa" ? "✅ Qualitativa" : "📊 Numérica"}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1.5">
                {form.tipo === "qualitativa"
                  ? "Acompanhe manualmente com um percentual ou marque como conquistada."
                  : "Defina valores inicial, atual e alvo — o progresso é calculado automaticamente."}
              </p>
            </div>

            {form.tipo === "qualitativa" ? (
              <div>
                <Label>Progresso atual: {form.progresso}%</Label>
                <input type="range" min={0} max={100} value={form.progresso}
                  onChange={e => setForm(f => ({ ...f, progresso: +e.target.value }))}
                  className="w-full mt-2 accent-[#C8DA2D]" />
              </div>
            ) : (
              <div className="space-y-3 p-3 rounded-xl border border-border bg-muted/30">
                <div>
                  <Label className="text-xs text-muted-foreground">Direção</Label>
                  <div className="flex gap-2 mt-1.5">
                    {(["crescente", "decrescente"] as const).map(d => (
                      <button key={d} type="button" onClick={() => setForm(f => ({ ...f, direcao: d }))}
                        className={cn(
                          "flex-1 py-1.5 text-xs font-medium rounded-lg border transition-colors",
                          form.direcao === d
                            ? "bg-foreground text-background border-foreground"
                            : "border-border text-muted-foreground hover:text-foreground"
                        )}>
                        {d === "crescente" ? "↑ Crescente" : "↓ Decrescente"}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {form.direcao === "crescente"
                      ? "Quanto maior, melhor — ex: poupar dinheiro, ganhar massa, horas de treino"
                      : "Quanto menor, melhor — ex: perder peso, reduzir dívidas, tempo de tela"}
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Unidade</Label>
                  <Input value={form.unidade} onChange={e => setForm(f => ({ ...f, unidade: e.target.value }))}
                    placeholder="kg, R$, horas, km..." className="mt-1 h-8 text-sm" />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Valor inicial</Label>
                    <Input type="number" value={form.valor_inicial}
                      onChange={e => setForm(f => ({ ...f, valor_inicial: e.target.value }))}
                      placeholder="onde comecei" className="mt-1 h-8 text-sm" />
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Valor atual</Label>
                    <Input type="number" value={form.valor_atual}
                      onChange={e => setForm(f => ({ ...f, valor_atual: e.target.value }))}
                      placeholder="onde estou" className="mt-1 h-8 text-sm" />
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Valor alvo</Label>
                    <Input type="number" value={form.valor_alvo}
                      onChange={e => setForm(f => ({ ...f, valor_alvo: e.target.value }))}
                      placeholder="onde quero" className="mt-1 h-8 text-sm" />
                  </div>
                </div>
              </div>
            )}

            <div>
              <Label>Descrição</Label>
              <Textarea value={form.descricao}
                onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
                placeholder="Contexto, motivação, estratégia..." rows={2} className="mt-1" />
            </div>

            {editing && (
              <div className="pt-2 border-t flex justify-start">
                <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-600 hover:bg-red-50"
                  onClick={() => { if (confirm("Excluir meta?")) { deleteMeta.mutate(editing.id); setDialogOpen(false); } }}>
                  <Trash2 size={13} className="mr-1" /> Excluir
                </Button>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave}
              disabled={!form.titulo.trim() || createMeta.isPending || updateMeta.isPending}
              className="bg-[#C8DA2D] text-[#0C1923] hover:bg-[#d4e640]">
              {editing ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Areas management dialog */}
      <Dialog open={areasOpen} onOpenChange={setAreasOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Gerenciar Áreas</DialogTitle></DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-0.5 max-h-52 overflow-y-auto pr-1">
              {areas.map(a => (
                <div key={a.value} className="flex items-center gap-2 group px-1 py-1.5 rounded hover:bg-muted/50 transition-colors">
                  <span className="text-base leading-none">{a.emoji}</span>
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: a.cor }} />
                  <span className="text-sm flex-1">{a.label}</span>
                  <button onClick={() => updateAreas(areas.filter(x => x.value !== a.value))}
                    className="p-1 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-500 transition-all shrink-0">
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>

            <div className="border-t border-border pt-3 space-y-2">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Nova área</p>
              <div className="flex items-center gap-2">
                <EmojiPicker value={newEmoji} onChange={setNewEmoji} size="sm" />
                <Input value={newLabel} onChange={e => setNewLabel(e.target.value)}
                  placeholder="Nome da área..." className="h-8 text-sm flex-1"
                  onKeyDown={e => { if (e.key === "Enter") addArea(); }} />
                <input type="color" value={newCor} onChange={e => setNewCor(e.target.value)}
                  className="w-8 h-8 rounded cursor-pointer border shrink-0" />
                <Button size="sm" onClick={addArea} disabled={!newLabel.trim()}
                  className="h-8 px-2 bg-[#C8DA2D] text-[#0C1923] hover:bg-[#d4e640] shrink-0">
                  <Check size={13} />
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAreasOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── MetaCard ───────────────────────────────────────────────────────────────────

function MetaCard({ meta, areas, onEdit, onDelete, onConquistar, onReativar, onUpdateValorAtual }: {
  meta: Meta; areas: AreaDef[];
  onEdit: () => void; onDelete: () => void;
  onConquistar: () => void; onReativar: () => void;
  onUpdateValorAtual: (v: number) => void;
}) {
  const [editingValor, setEditingValor] = useState(false);
  const [inputValor, setInputValor]     = useState(String(meta.valor_atual ?? ""));

  const area   = areas.find(a => a.value === meta.area);
  const cor    = area?.cor ?? "#94a3b8";
  const pct    = Math.round(calcProgress(meta));
  const isConquistada = meta.status === "conquistada";

  function commitValor() {
    const n = parseFloat(inputValor.replace(",", "."));
    if (!isNaN(n)) onUpdateValorAtual(n);
    setEditingValor(false);
  }

  return (
    <div
      className={cn(
        "bg-card border rounded-2xl p-5 flex flex-col gap-3 relative group transition-all hover:shadow-md",
        isConquistada ? "opacity-75 border-[#C8DA2D]/30" : "hover:border-border/80"
      )}
      style={{ borderLeftWidth: 4, borderLeftColor: cor }}
    >
      {isConquistada && (
        <div className="absolute top-3 right-3">
          <Trophy size={16} className="text-[#C8DA2D]" />
        </div>
      )}

      {/* Title row */}
      <div className="flex items-start gap-3">
        <span className="text-3xl leading-none shrink-0">{meta.emoji}</span>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm leading-snug">{meta.titulo}</p>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            {area && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                style={{ backgroundColor: cor + "20", color: cor }}>
                {area.emoji} {area.label}
              </span>
            )}
            {meta.tipo === "numerica" && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                📊
              </span>
            )}
          </div>
        </div>
      </div>

      {meta.descricao && (
        <p className="text-xs text-muted-foreground line-clamp-2">{meta.descricao}</p>
      )}

      {/* Numeric tracker */}
      {meta.tipo === "numerica" && meta.valor_alvo != null && (
        <div className="flex items-center justify-between">
          <div className="text-xs text-muted-foreground leading-snug">
            <span className="font-semibold text-foreground text-sm">
              {fmtNum(meta.valor_atual ?? meta.valor_inicial ?? 0, meta.unidade)}
            </span>
            <span className="mx-1.5 opacity-40">→</span>
            <span>{fmtNum(meta.valor_alvo, meta.unidade)}</span>
          </div>
          {!isConquistada && (
            editingValor ? (
              <div className="flex items-center gap-1">
                <Input type="number" value={inputValor}
                  onChange={e => setInputValor(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") commitValor(); if (e.key === "Escape") setEditingValor(false); }}
                  className="h-6 w-20 text-xs px-1.5" autoFocus />
                <button onClick={commitValor} className="p-0.5 text-green-500 hover:text-green-600 transition-colors">
                  <Check size={11} />
                </button>
                <button onClick={() => setEditingValor(false)} className="p-0.5 text-muted-foreground hover:text-foreground transition-colors">
                  <X size={11} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => { setInputValor(String(meta.valor_atual ?? "")); setEditingValor(true); }}
                className="text-[10px] font-medium px-2 py-0.5 rounded border border-border hover:border-[#C8DA2D] hover:text-[#C8DA2D] transition-colors shrink-0">
                Atualizar
              </button>
            )
          )}
        </div>
      )}

      {/* Progress bar */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] text-muted-foreground font-medium">Progresso</span>
          <span className="text-[10px] font-bold" style={{ color: cor }}>{pct}%</span>
        </div>
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-500"
            style={{ width: `${pct}%`, backgroundColor: cor }} />
        </div>
      </div>

      {meta.prazo && (
        <p className="text-[10px] text-muted-foreground">
          📅 {new Date(meta.prazo + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}
        </p>
      )}

      {/* Card actions */}
      <div className="flex items-center justify-between pt-1 border-t border-border/50">
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={onEdit} className="p-1.5 rounded text-muted-foreground hover:text-foreground transition-colors">
            <Pencil size={12} />
          </button>
          <button onClick={onDelete} className="p-1.5 rounded text-muted-foreground hover:text-red-500 transition-colors">
            <Trash2 size={12} />
          </button>
        </div>
        {isConquistada ? (
          <button onClick={onReativar}
            className="text-[10px] font-medium px-2.5 py-1 rounded-full border border-border hover:border-[#C8DA2D] hover:bg-[#C8DA2D]/10 transition-colors text-muted-foreground">
            Reativar
          </button>
        ) : (
          <button onClick={onConquistar}
            className="text-[10px] font-semibold px-2.5 py-1 rounded-full transition-colors"
            style={{ backgroundColor: cor + "20", color: cor }}>
            🏆 Conquistar
          </button>
        )}
      </div>
    </div>
  );
}

// ── AreaPill ───────────────────────────────────────────────────────────────────

function AreaPill({ active, cor, onClick, children }: {
  active: boolean; cor?: string; onClick: () => void; children: React.ReactNode;
}) {
  const style = active && cor ? { backgroundColor: cor + "25", color: cor, borderColor: cor } : undefined;
  return (
    <button onClick={onClick} style={style}
      className={cn(
        "px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
        active && !cor ? "bg-[#0C1923] text-white border-[#0C1923]" : "bg-background border-border hover:border-foreground/40"
      )}>
      {children}
    </button>
  );
}
