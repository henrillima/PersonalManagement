import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Pencil, Trophy, Target } from "lucide-react";
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

// ── Constants ──────────────────────────────────────────────────────────────────

const AREAS: { value: string; label: string; emoji: string; cor: string }[] = [
  { value: "pessoal",         label: "Pessoal",         emoji: "🧑",  cor: "#8b5cf6" },
  { value: "financeiro",      label: "Financeiro",      emoji: "💰",  cor: "#22c55e" },
  { value: "carreira",        label: "Carreira",        emoji: "💼",  cor: "#3b82f6" },
  { value: "saude",           label: "Saúde",           emoji: "❤️",  cor: "#f43f5e" },
  { value: "educacao",        label: "Educação",        emoji: "📚",  cor: "#f59e0b" },
  { value: "relacionamentos", label: "Relacionamentos", emoji: "👥",  cor: "#ec4899" },
  { value: "viagens",         label: "Viagens",         emoji: "🌍",  cor: "#14b8a6" },
  { value: "lazer",           label: "Lazer",           emoji: "🎮",  cor: "#f97316" },
];

interface MetaForm {
  titulo: string;
  descricao: string;
  area: string;
  prazo: string;
  emoji: string;
  progresso: number;
}

const emptyForm = (): MetaForm => ({
  titulo: "", descricao: "", area: "pessoal", prazo: "", emoji: "🎯", progresso: 0,
});

function metaToForm(m: Meta): MetaForm {
  return {
    titulo: m.titulo, descricao: m.descricao ?? "", area: m.area,
    prazo: m.prazo ?? "", emoji: m.emoji, progresso: m.progresso,
  };
}

// ── Main ───────────────────────────────────────────────────────────────────────

export default function Metas() {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen]   = useState(false);
  const [editing, setEditing]         = useState<Meta | null>(null);
  const [form, setForm]               = useState<MetaForm>(emptyForm());
  const [areaFilter, setAreaFilter]   = useState("all");
  const [statusFilter, setStatusFilter] = useState<"ativa" | "conquistada" | "all">("ativa");

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
    onSuccess: () => { invalidate(); setDialogOpen(false); },
    onError: onErr,
  });

  const deleteMeta = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/v1/metas/${id}`, { method: "DELETE" }),
    onSuccess: invalidate,
    onError: onErr,
  });

  const visible = useMemo(() => metas.filter(m => {
    if (areaFilter !== "all" && m.area !== areaFilter) return false;
    if (statusFilter !== "all" && m.status !== statusFilter) return false;
    return true;
  }), [metas, areaFilter, statusFilter]);

  const ativas      = metas.filter(m => m.status === "ativa").length;
  const conquistadas = metas.filter(m => m.status === "conquistada").length;

  function openCreate() { setEditing(null); setForm(emptyForm()); setDialogOpen(true); }
  function openEdit(m: Meta) { setEditing(m); setForm(metaToForm(m)); setDialogOpen(true); }

  function handleSave() {
    if (!form.titulo.trim()) return;
    const payload = {
      titulo: form.titulo,
      descricao: form.descricao || undefined,
      area: form.area,
      prazo: form.prazo || undefined,
      emoji: form.emoji,
      progresso: form.progresso,
    };
    if (editing) {
      updateMeta.mutate({ id: editing.id, d: payload });
    } else {
      createMeta.mutate(payload);
    }
  }

  function conquistar(m: Meta) {
    updateMeta.mutate({ id: m.id, d: { status: "conquistada", progresso: 100 } });
  }

  function reativar(m: Meta) {
    updateMeta.mutate({ id: m.id, d: { status: "ativa" } });
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
        <Button onClick={openCreate} className="bg-[#C8DA2D] text-[#0C1923] hover:bg-[#d4e640]">
          <Plus size={14} className="mr-1" /> Nova Meta
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex gap-1.5 flex-wrap">
          <AreaPill active={areaFilter === "all"} onClick={() => setAreaFilter("all")}>
            🎯 Todas as áreas
          </AreaPill>
          {AREAS.map(a => (
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
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-48 bg-muted rounded-2xl animate-pulse" />
          ))}
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
            <MetaCard key={m.id} meta={m}
              onEdit={() => openEdit(m)}
              onDelete={() => { if (confirm("Excluir esta meta?")) deleteMeta.mutate(m.id); }}
              onConquistar={() => conquistar(m)}
              onReativar={() => reativar(m)}
            />
          ))}
        </div>
      )}

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
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
                    {AREAS.map(a => <SelectItem key={a.value} value={a.value}>{a.emoji} {a.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Prazo (opcional)</Label>
                <Input type="date" value={form.prazo} onChange={e => setForm(f => ({ ...f, prazo: e.target.value }))} className="mt-1" />
              </div>
            </div>
            <div>
              <Label>Progresso atual: {form.progresso}%</Label>
              <input type="range" min={0} max={100} value={form.progresso}
                onChange={e => setForm(f => ({ ...f, progresso: +e.target.value }))}
                className="w-full mt-2 accent-[#C8DA2D]" />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea value={form.descricao}
                onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
                placeholder="Detalhes, contexto, motivação..." rows={3} className="mt-1" />
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
    </div>
  );
}

// ── MetaCard ───────────────────────────────────────────────────────────────────

function MetaCard({ meta, onEdit, onDelete, onConquistar, onReativar }: {
  meta: Meta;
  onEdit: () => void;
  onDelete: () => void;
  onConquistar: () => void;
  onReativar: () => void;
}) {
  const area = AREAS.find(a => a.value === meta.area);
  const cor  = area?.cor ?? "#94a3b8";
  const isConquistada = meta.status === "conquistada";

  return (
    <div className={cn(
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

      <div className="flex items-start gap-3">
        <span className="text-3xl leading-none shrink-0">{meta.emoji}</span>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm leading-snug">{meta.titulo}</p>
          {area && (
            <span className="inline-block mt-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
              style={{ backgroundColor: cor + "20", color: cor }}>
              {area.emoji} {area.label}
            </span>
          )}
        </div>
      </div>

      {meta.descricao && (
        <p className="text-xs text-muted-foreground line-clamp-2">{meta.descricao}</p>
      )}

      {/* Progress */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] text-muted-foreground font-medium">Progresso</span>
          <span className="text-[10px] font-bold" style={{ color: cor }}>{meta.progresso}%</span>
        </div>
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all" style={{ width: `${meta.progresso}%`, backgroundColor: cor }} />
        </div>
      </div>

      {meta.prazo && (
        <p className="text-[10px] text-muted-foreground">
          📅 {new Date(meta.prazo + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}
        </p>
      )}

      {/* Actions */}
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
