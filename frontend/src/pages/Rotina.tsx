import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { addDays, addWeeks, subWeeks, startOfWeek, isSameDay, format } from "date-fns";
import { ChevronLeft, ChevronRight, Plus, Calendar, Clock, AlertCircle } from "lucide-react";
import { apiFetch } from "@/lib/api";
import type { EventoAgenda } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

// ── Constants ──────────────────────────────────────────────────────────────────

const HORA_INICIO = 6;
const HORA_FIM    = 23;
const CELL_H      = 56; // px por hora
const HORAS       = Array.from({ length: HORA_FIM - HORA_INICIO }, (_, i) => i + HORA_INICIO);
const DIAS_SEMANA = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const MESES       = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

function fmtMes(d: Date) { return MESES[d.getMonth()]; }

function fmtWeekLabel(start: Date) {
  const end = addDays(start, 6);
  const ini = `${start.getDate()} ${fmtMes(start)}`;
  const fim = `${end.getDate()} ${fmtMes(end)} ${end.getFullYear()}`;
  return `${ini} – ${fim}`;
}

function fmtHora(d: Date) {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// ── Main ───────────────────────────────────────────────────────────────────────

export default function Rotina() {
  const qc = useQueryClient();

  const [weekStart, setWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const [criarOpen, setCriarOpen] = useState(false);
  const [selected, setSelected]   = useState<EventoAgenda | null>(null);

  // Form state
  const [fTitulo, setFTitulo]   = useState("");
  const [fDataIni, setFDataIni] = useState(format(new Date(), "yyyy-MM-dd"));
  const [fHoraIni, setFHoraIni] = useState("09:00");
  const [fDataFim, setFDataFim] = useState(format(new Date(), "yyyy-MM-dd"));
  const [fHoraFim, setFHoraFim] = useState("10:00");
  const [fDesc, setFDesc]       = useState("");
  const [fGuests, setFGuests]   = useState("");

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const today = new Date();

  // ── Query ──────────────────────────────────────────────────────────────────
  const { data: eventos = [], isLoading, isError } = useQuery<EventoAgenda[]>({
    queryKey: ["agenda"],
    queryFn: () => apiFetch("/api/v1/agenda"),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  // ── Mutation ───────────────────────────────────────────────────────────────
  const createEvento = useMutation({
    mutationFn: (d: object) => apiFetch("/api/v1/agenda", { method: "POST", body: JSON.stringify(d) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agenda"] });
      setCriarOpen(false);
      setFTitulo(""); setFDesc(""); setFGuests("");
    },
  });

  function handleSave() {
    if (!fTitulo.trim()) return;
    createEvento.mutate({
      title: fTitulo,
      start: `${fDataIni}T${fHoraIni}:00`,
      end:   `${fDataFim}T${fHoraFim}:00`,
      description: fDesc || undefined,
      guests: fGuests || undefined,
    });
  }

  function eventosForDay(day: Date) {
    return eventos.filter(ev => {
      try { return isSameDay(new Date(ev.start), day); }
      catch { return false; }
    });
  }

  function openCreate(day?: Date) {
    const d = day ? format(day, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd");
    setFDataIni(d); setFDataFim(d); setFHoraIni("09:00"); setFHoraFim("10:00");
    setFTitulo(""); setFDesc(""); setFGuests("");
    setCriarOpen(true);
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Agenda</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Integração Google Calendar</p>
        </div>
        <Button onClick={() => openCreate()} className="bg-[#C8DA2D] text-[#0C1923] hover:bg-[#d4e640]">
          <Plus size={14} className="mr-1" /> Novo Compromisso
        </Button>
      </div>

      {/* Week navigation */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setWeekStart(w => subWeeks(w, 1))}
          className="p-1.5 rounded-lg border border-border hover:bg-muted transition-colors"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="text-sm font-medium min-w-[180px] text-center">
          {fmtWeekLabel(weekStart)}
        </span>
        <button
          onClick={() => setWeekStart(w => addWeeks(w, 1))}
          className="p-1.5 rounded-lg border border-border hover:bg-muted transition-colors"
        >
          <ChevronRight size={16} />
        </button>
        <button
          onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}
          className="ml-2 px-3 py-1.5 text-xs rounded-lg border border-border hover:bg-muted transition-colors"
        >
          Hoje
        </button>
      </div>

      {/* Error state */}
      {isError && (
        <div className="flex items-center gap-2 text-sm text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded-xl px-4 py-3">
          <AlertCircle size={15} />
          Não foi possível carregar a agenda. Verifique a integração com o Google Calendar.
        </div>
      )}

      {/* Calendar */}
      {isLoading ? (
        <CalendarSkeleton />
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {/* Day headers */}
          <div className="flex border-b border-border sticky top-0 bg-card z-10">
            <div className="w-14 shrink-0" />
            {days.map((day, i) => {
              const isToday = isSameDay(day, today);
              return (
                <button
                  key={i}
                  onClick={() => openCreate(day)}
                  className={cn(
                    "flex-1 text-center py-3 border-l border-border transition-colors hover:bg-muted/50",
                    isToday && "bg-[#C8DA2D]/8"
                  )}
                >
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{DIAS_SEMANA[i]}</p>
                  <p className={cn(
                    "text-lg font-semibold leading-tight",
                    isToday ? "text-[#C8DA2D]" : "text-foreground"
                  )}>
                    {day.getDate()}
                  </p>
                  <p className="text-[10px] text-muted-foreground">{fmtMes(day)}</p>
                </button>
              );
            })}
          </div>

          {/* Time grid */}
          <div className="flex overflow-y-auto" style={{ maxHeight: "calc(100vh - 320px)", minHeight: 400 }}>
            {/* Time labels */}
            <div className="w-14 shrink-0 border-r border-border">
              {HORAS.map(h => (
                <div key={h} style={{ height: CELL_H }} className="flex items-start justify-end pr-2 pt-1 border-b border-border/20">
                  <span className="text-[10px] text-muted-foreground">{h}:00</span>
                </div>
              ))}
            </div>

            {/* Day columns */}
            {days.map((day, i) => {
              const isToday = isSameDay(day, today);
              const dayEvs  = eventosForDay(day);
              const totalH  = CELL_H * HORAS.length;

              return (
                <div
                  key={i}
                  className={cn("flex-1 relative border-l border-border", isToday && "bg-[#C8DA2D]/5")}
                  style={{ height: totalH }}
                >
                  {/* Hour lines */}
                  {HORAS.map(h => (
                    <div key={h} style={{ height: CELL_H }} className="border-b border-border/20" />
                  ))}

                  {/* Current time indicator */}
                  {isToday && (() => {
                    const now = new Date();
                    const top = ((now.getHours() - HORA_INICIO) * 60 + now.getMinutes()) / 60 * CELL_H;
                    if (top < 0 || top > totalH) return null;
                    return (
                      <div
                        style={{ top, position: "absolute", left: 0, right: 0 }}
                        className="flex items-center z-20 pointer-events-none"
                      >
                        <div className="w-2 h-2 rounded-full bg-red-500 shrink-0 -ml-1" />
                        <div className="flex-1 h-px bg-red-500" />
                      </div>
                    );
                  })()}

                  {/* Events */}
                  {dayEvs.map(ev => (
                    <EventoCard
                      key={ev.id}
                      evento={ev}
                      onClick={() => setSelected(ev)}
                    />
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Event detail dialog */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar size={16} className="text-[#C8DA2D]" />
              {selected?.title}
            </DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-2 py-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock size={14} />
                <span>
                  {fmtHora(new Date(selected.start))} – {fmtHora(new Date(selected.end))}
                </span>
              </div>
              {selected.description && (
                <p className="text-sm text-muted-foreground">{selected.description}</p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelected(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create event dialog */}
      <Dialog open={criarOpen} onOpenChange={setCriarOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Novo Compromisso</DialogTitle></DialogHeader>
          <div className="space-y-4 py-1">
            <div>
              <Label>Título *</Label>
              <Input value={fTitulo} onChange={e => setFTitulo(e.target.value)}
                placeholder="Ex: Reunião com cliente" className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Data início</Label>
                <Input type="date" value={fDataIni} onChange={e => setFDataIni(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label>Hora início</Label>
                <Input type="time" value={fHoraIni} onChange={e => setFHoraIni(e.target.value)} className="mt-1" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Data fim</Label>
                <Input type="date" value={fDataFim} onChange={e => setFDataFim(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label>Hora fim</Label>
                <Input type="time" value={fHoraFim} onChange={e => setFHoraFim(e.target.value)} className="mt-1" />
              </div>
            </div>
            <div>
              <Label>Descrição / Link</Label>
              <Textarea value={fDesc} onChange={e => setFDesc(e.target.value)} rows={2} className="mt-1" />
            </div>
            <div>
              <Label>Convidados (e-mails separados por vírgula)</Label>
              <Input value={fGuests} onChange={e => setFGuests(e.target.value)}
                placeholder="email@exemplo.com, ..." className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCriarOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave}
              disabled={!fTitulo.trim() || createEvento.isPending}
              className="bg-[#C8DA2D] text-[#0C1923] hover:bg-[#d4e640]">
              {createEvento.isPending ? "Sincronizando..." : "Sincronizar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── EventoCard ─────────────────────────────────────────────────────────────────

function EventoCard({ evento, onClick }: { evento: EventoAgenda; onClick: () => void }) {
  try {
    const start = new Date(evento.start);
    const end   = new Date(evento.end);
    const startMin = (start.getHours() - HORA_INICIO) * 60 + start.getMinutes();
    const durMin   = (end.getTime() - start.getTime()) / 60000;
    const top    = (startMin / 60) * CELL_H;
    const height = Math.max((durMin / 60) * CELL_H, 22);

    if (top < 0 || top > CELL_H * HORAS.length) return null;

    return (
      <div
        onClick={onClick}
        style={{ top, height, position: "absolute", left: 2, right: 2 }}
        className="bg-blue-500/20 border border-blue-500/50 rounded px-1.5 py-1 overflow-hidden cursor-pointer hover:bg-blue-500/30 transition-colors z-10"
      >
        <p className="text-[11px] font-semibold text-blue-200 truncate leading-tight">{evento.title}</p>
        {height > 30 && (
          <p className="text-[10px] text-blue-300/70">{fmtHora(start)} – {fmtHora(end)}</p>
        )}
      </div>
    );
  } catch {
    return null;
  }
}

// ── Skeleton ───────────────────────────────────────────────────────────────────

function CalendarSkeleton() {
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="flex border-b border-border">
        <div className="w-14 shrink-0" />
        {[...Array(7)].map((_, i) => (
          <div key={i} className="flex-1 py-3 px-2 border-l border-border">
            <Skeleton className="h-3 w-8 mx-auto mb-1" />
            <Skeleton className="h-6 w-6 mx-auto" />
          </div>
        ))}
      </div>
      <div className="flex" style={{ height: 400 }}>
        <div className="w-14 shrink-0 border-r border-border space-y-0">
          {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-14 rounded-none" />)}
        </div>
        <div className="flex-1 p-4 space-y-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-10 rounded-lg" />)}
        </div>
      </div>
    </div>
  );
}
