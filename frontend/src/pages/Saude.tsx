import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Settings, Sparkles, Save } from "lucide-react";
import { apiFetch, fmtDate } from "@/lib/api";
import type { SaudePerfil, PesoEntry, DietaEntry, TreinoEntry } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

const FATOR_LABELS = [
  "1 - Sedentário",
  "2 - Levemente ativo",
  "3 - Moderadamente ativo",
  "4 - Muito ativo",
  "5 - Extremamente ativo",
];

const REFEICOES = ["Café da manhã", "Lanche da manhã", "Almoço", "Lanche da tarde", "Jantar", "Ceia", "Pré-treino", "Pós-treino"];

const TODAY = new Date().toISOString().slice(0, 10);

export default function Saude() {
  const qc = useQueryClient();
  const [perfilOpen, setPerfilOpen] = useState(false);
  const [pesoOpen, setPesoOpen]     = useState(false);
  const [dietaOpen, setDietaOpen]   = useState(false);
  const [treinoOpen, setTreinoOpen] = useState(false);

  const [perfilForm, setPerfilForm] = useState({ idade: "", altura: "", sexo: "M", fator_idx: "3" });
  const [pesoForm, setPesoForm]     = useState({ data: TODAY, peso: "" });
  const [dietaForm, setDietaForm]   = useState({ data: TODAY, refeicao: "Almoço", descricao: "" });
  const [treinoForm, setTreinoForm] = useState({ data: TODAY, descricao: "" });

  const { data: perfil, isLoading: lPerfil } = useQuery<SaudePerfil>({
    queryKey: ["saude-perfil"],
    queryFn: () => apiFetch("/api/v1/saude/perfil"),
  });

  const { data: pesos = [], isLoading: lPesos } = useQuery<PesoEntry[]>({
    queryKey: ["saude-peso"],
    queryFn: () => apiFetch("/api/v1/saude/peso"),
  });

  const { data: dieta = [], isLoading: lDieta } = useQuery<DietaEntry[]>({
    queryKey: ["saude-dieta"],
    queryFn: () => apiFetch("/api/v1/saude/dieta"),
  });

  const { data: treinos = [], isLoading: lTreino } = useQuery<TreinoEntry[]>({
    queryKey: ["saude-treino"],
    queryFn: () => apiFetch("/api/v1/saude/treino"),
  });

  const upsertPerfil = useMutation({
    mutationFn: (d: object) => apiFetch("/api/v1/saude/perfil", { method: "PUT", body: JSON.stringify(d) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["saude-perfil"] }); setPerfilOpen(false); },
  });

  const createPeso = useMutation({
    mutationFn: (d: object) => apiFetch("/api/v1/saude/peso", { method: "POST", body: JSON.stringify(d) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["saude-peso"] }); setPesoOpen(false); },
  });

  const deletePeso = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/v1/saude/peso/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["saude-peso"] }),
  });

  // Registra refeição com análise de IA (endpoint /analisar)
  const analisarDieta = useMutation({
    mutationFn: (d: object) => apiFetch("/api/v1/saude/dieta/analisar", { method: "POST", body: JSON.stringify(d) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["saude-dieta"] });
      setDietaOpen(false);
      setDietaForm({ data: TODAY, refeicao: "Almoço", descricao: "" });
    },
  });

  const deleteDieta = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/v1/saude/dieta/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["saude-dieta"] }),
  });

  // Registra treino com estimativa de IA (endpoint /analisar)
  const analisarTreino = useMutation({
    mutationFn: (d: object) => apiFetch("/api/v1/saude/treino/analisar", { method: "POST", body: JSON.stringify(d) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["saude-treino"] });
      setTreinoOpen(false);
      setTreinoForm({ data: TODAY, descricao: "" });
    },
  });

  const deleteTreino = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/v1/saude/treino/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["saude-treino"] }),
  });

  function openPerfil() {
    setPerfilForm({
      idade: String(perfil?.idade ?? ""),
      altura: String(perfil?.altura ?? ""),
      sexo: perfil?.sexo ?? "M",
      fator_idx: String(perfil?.fator_idx ?? 3),
    });
    setPerfilOpen(true);
  }

  const dietaHoje = dieta.filter((d) => d.data === TODAY);
  const calHoje   = dietaHoje.reduce((s, d) => s + (d.calorias ?? 0), 0);
  const protHoje  = dietaHoje.reduce((s, d) => s + (d.proteina ?? 0), 0);
  const carbHoje  = dietaHoje.reduce((s, d) => s + (d.carboidrato ?? 0), 0);
  const gordHoje  = dietaHoje.reduce((s, d) => s + (d.gordura ?? 0), 0);

  const ultimoPeso = pesos[0];

  // Metas calóricas baseadas no perfil (Mifflin-St Jeor)
  const metaKcal = (() => {
    if (!perfil?.idade || !perfil?.altura || !ultimoPeso?.peso) return null;
    const peso = ultimoPeso.peso;
    const tmb = perfil.sexo === "F"
      ? 10 * peso + 6.25 * perfil.altura - 5 * perfil.idade - 161
      : 10 * peso + 6.25 * perfil.altura - 5 * perfil.idade + 5;
    const fatores = [1.2, 1.375, 1.55, 1.725, 1.9];
    const fator = fatores[(perfil.fator_idx ?? 3) - 1] ?? 1.55;
    return Math.round(tmb * fator - 300); // déficit leve
  })();

  if (lPerfil) return <Skeleton className="h-64 rounded-xl" />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Saúde & Corpo</h1>
          {ultimoPeso && (
            <p className="text-sm text-muted-foreground mt-0.5">
              Último peso: {ultimoPeso.peso} kg em {fmtDate(ultimoPeso.data)}
            </p>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={openPerfil}>
          <Settings size={14} className="mr-1" /> Perfil
        </Button>
      </div>

      {/* Perfil card */}
      {perfil && (perfil.idade || perfil.altura) ? (
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold mb-3">Perfil</h3>
          <div className="flex gap-8 text-sm flex-wrap">
            {perfil.idade && <div><p className="text-muted-foreground text-xs">Idade</p><p className="font-medium">{perfil.idade} anos</p></div>}
            {perfil.altura && <div><p className="text-muted-foreground text-xs">Altura</p><p className="font-medium">{perfil.altura} cm</p></div>}
            {ultimoPeso && <div><p className="text-muted-foreground text-xs">Peso atual</p><p className="font-medium">{ultimoPeso.peso} kg</p></div>}
            {perfil.sexo && <div><p className="text-muted-foreground text-xs">Sexo</p><p className="font-medium">{perfil.sexo === "M" ? "Masculino" : "Feminino"}</p></div>}
            {perfil.fator_idx && <div><p className="text-muted-foreground text-xs">Nível de atividade</p><p className="font-medium">{FATOR_LABELS[perfil.fator_idx - 1]?.split(" - ")[1]}</p></div>}
            {metaKcal && <div><p className="text-muted-foreground text-xs">Meta calórica</p><p className="font-medium text-[#C8DA2D]">~{metaKcal} kcal/dia</p></div>}
          </div>
        </div>
      ) : null}

      <Tabs defaultValue="peso">
        <TabsList className="mb-4">
          <TabsTrigger value="peso">Peso</TabsTrigger>
          <TabsTrigger value="dieta">Dieta de hoje</TabsTrigger>
          <TabsTrigger value="treino">Treinos</TabsTrigger>
        </TabsList>

        {/* Peso tab */}
        <TabsContent value="peso" className="space-y-4">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setPesoOpen(true)} className="bg-[#C8DA2D] text-[#0C1923] hover:bg-[#d4e640]">
              <Plus size={14} className="mr-1" /> Registrar Peso
            </Button>
          </div>

          {pesos.length > 1 && (
            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="text-sm font-semibold mb-4">Evolução do peso</h3>
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={[...pesos].reverse()}>
                  <defs>
                    <linearGradient id="pesoGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#C8DA2D" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#C8DA2D" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="data" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={fmtDate} />
                  <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} domain={["auto", "auto"]} unit=" kg" />
                  <Tooltip formatter={(v: number) => [`${v} kg`, "Peso"]} labelFormatter={fmtDate} />
                  <Area type="monotone" dataKey="peso" stroke="#C8DA2D" fill="url(#pesoGrad)" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {lPesos ? <Skeleton className="h-32 rounded-xl" /> : (
            <div className="space-y-1">
              {pesos.slice(0, 20).map((p) => (
                <div key={p.id} className="flex items-center gap-3 bg-card border border-border rounded-lg px-4 py-3">
                  <span className="text-sm text-muted-foreground">{fmtDate(p.data)}</span>
                  <span className="flex-1 text-sm font-medium">{p.peso} kg</span>
                  <button onClick={() => deletePeso.mutate(p.id)} className="text-muted-foreground hover:text-red-500 transition-colors"><Trash2 size={13} /></button>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Dieta tab */}
        <TabsContent value="dieta" className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex gap-4 text-sm flex-wrap">
              <span className="text-muted-foreground">
                Calorias: <strong className="text-foreground">{calHoje} kcal</strong>
                {metaKcal && <span className="text-muted-foreground"> / {metaKcal}</span>}
              </span>
              <span className="text-muted-foreground">Prot: <strong className="text-blue-400">{protHoje.toFixed(0)}g</strong></span>
              <span className="text-muted-foreground">Carb: <strong className="text-amber-400">{carbHoje.toFixed(0)}g</strong></span>
              <span className="text-muted-foreground">Gord: <strong className="text-red-400">{gordHoje.toFixed(0)}g</strong></span>
            </div>
            <Button size="sm" onClick={() => setDietaOpen(true)} className="bg-[#C8DA2D] text-[#0C1923] hover:bg-[#d4e640]">
              <Plus size={14} className="mr-1" /> Refeição
            </Button>
          </div>

          {/* Barra de progresso calórico */}
          {metaKcal && calHoje > 0 && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Progresso calórico</span>
                <span>{Math.round((calHoje / metaKcal) * 100)}%</span>
              </div>
              <div className="h-2 bg-border rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min((calHoje / metaKcal) * 100, 100)}%`,
                    backgroundColor: calHoje > metaKcal ? "#ef4444" : "#C8DA2D",
                  }}
                />
              </div>
            </div>
          )}

          {lDieta ? <Skeleton className="h-32 rounded-xl" /> : dietaHoje.length === 0 ? (
            <div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground text-sm">
              Nenhuma refeição registrada hoje.
            </div>
          ) : (
            <div className="space-y-1">
              {dietaHoje.map((d) => (
                <div key={d.id} className="flex items-center gap-3 bg-card border border-border rounded-lg px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{d.refeicao}: <span className="font-normal">{d.descricao}</span></p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      <span className="text-foreground font-medium">{d.calorias} kcal</span>
                      {" · "}
                      <span className="text-blue-400">{d.proteina}g prot</span>
                      {" · "}
                      <span className="text-amber-400">{d.carboidrato}g carb</span>
                      {" · "}
                      <span className="text-red-400">{d.gordura}g gord</span>
                    </p>
                  </div>
                  <button onClick={() => deleteDieta.mutate(d.id)} className="text-muted-foreground hover:text-red-500 transition-colors shrink-0"><Trash2 size={13} /></button>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Treino tab */}
        <TabsContent value="treino" className="space-y-4">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setTreinoOpen(true)} className="bg-[#C8DA2D] text-[#0C1923] hover:bg-[#d4e640]">
              <Plus size={14} className="mr-1" /> Registrar Treino
            </Button>
          </div>

          {lTreino ? <Skeleton className="h-32 rounded-xl" /> : treinos.length === 0 ? (
            <div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground text-sm">
              Nenhum treino registrado.
            </div>
          ) : (
            <div className="space-y-1">
              {treinos.slice(0, 20).map((t) => (
                <div key={t.id} className="flex items-center gap-3 bg-card border border-border rounded-lg px-4 py-3">
                  <span className="text-sm text-muted-foreground shrink-0">{fmtDate(t.data)}</span>
                  <p className="flex-1 text-sm">{t.descricao}</p>
                  {t.gasto_calorico != null && (
                    <span className="text-sm font-medium text-amber-400 shrink-0">−{t.gasto_calorico} kcal</span>
                  )}
                  <button onClick={() => deleteTreino.mutate(t.id)} className="text-muted-foreground hover:text-red-500 transition-colors shrink-0"><Trash2 size={13} /></button>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Perfil Dialog */}
      <Dialog open={perfilOpen} onOpenChange={setPerfilOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Perfil de Saúde</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Idade</Label>
                <Input type="number" value={perfilForm.idade} onChange={(e) => setPerfilForm((f) => ({ ...f, idade: e.target.value }))} placeholder="25" className="mt-1" />
              </div>
              <div>
                <Label>Altura (cm)</Label>
                <Input type="number" value={perfilForm.altura} onChange={(e) => setPerfilForm((f) => ({ ...f, altura: e.target.value }))} placeholder="175" className="mt-1" />
              </div>
            </div>
            <div>
              <Label>Sexo</Label>
              <Select value={perfilForm.sexo} onValueChange={(v) => setPerfilForm((f) => ({ ...f, sexo: v }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="M">Masculino</SelectItem>
                  <SelectItem value="F">Feminino</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Nível de atividade</Label>
              <Select value={perfilForm.fator_idx} onValueChange={(v) => setPerfilForm((f) => ({ ...f, fator_idx: v }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FATOR_LABELS.map((l, i) => (
                    <SelectItem key={i + 1} value={String(i + 1)}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPerfilOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => upsertPerfil.mutate({
                idade: parseInt(perfilForm.idade) || undefined,
                altura: parseFloat(perfilForm.altura) || undefined,
                sexo: perfilForm.sexo,
                fator_idx: parseInt(perfilForm.fator_idx),
              })}
              disabled={upsertPerfil.isPending}
              className="bg-[#C8DA2D] text-[#0C1923] hover:bg-[#d4e640]"
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Peso Dialog */}
      <Dialog open={pesoOpen} onOpenChange={setPesoOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Registrar Peso</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Data</Label>
              <Input type="date" value={pesoForm.data} onChange={(e) => setPesoForm((f) => ({ ...f, data: e.target.value }))} className="mt-1" />
            </div>
            <div>
              <Label>Peso (kg)</Label>
              <Input type="number" step="0.1" value={pesoForm.peso} onChange={(e) => setPesoForm((f) => ({ ...f, peso: e.target.value }))} placeholder="70.5" className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPesoOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => createPeso.mutate({ data: pesoForm.data, peso: parseFloat(pesoForm.peso) })}
              disabled={!pesoForm.peso || createPeso.isPending}
              className="bg-[#C8DA2D] text-[#0C1923] hover:bg-[#d4e640]"
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dieta Dialog — análise via IA */}
      <Dialog open={dietaOpen} onOpenChange={(o) => { setDietaOpen(o); if (!o) setDietaForm({ data: TODAY, refeicao: "Almoço", descricao: "" }); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles size={16} className="text-[#C8DA2D]" />
              Registrar Refeição com IA
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Data</Label>
                <Input type="date" value={dietaForm.data} onChange={(e) => setDietaForm((f) => ({ ...f, data: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <Label>Refeição</Label>
                <Select value={dietaForm.refeicao} onValueChange={(v) => setDietaForm((f) => ({ ...f, refeicao: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {REFEICOES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>O que você comeu?</Label>
              <Textarea
                value={dietaForm.descricao}
                onChange={(e) => setDietaForm((f) => ({ ...f, descricao: e.target.value }))}
                placeholder="Ex: 150g de frango grelhado, 100g de arroz branco, 1 concha de feijão e salada à vontade."
                className="mt-1 resize-none"
                rows={3}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              A IA (GPT-4o mini) vai estimar automaticamente calorias, proteínas, carboidratos e gorduras.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDietaOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => analisarDieta.mutate({ data: dietaForm.data, refeicao: dietaForm.refeicao, descricao: dietaForm.descricao })}
              disabled={!dietaForm.descricao.trim() || analisarDieta.isPending}
              className="bg-[#C8DA2D] text-[#0C1923] hover:bg-[#d4e640] gap-2"
            >
              {analisarDieta.isPending ? (
                <>
                  <span className="animate-spin inline-block w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full" />
                  Analisando...
                </>
              ) : (
                <>
                  <Sparkles size={14} />
                  Analisar e Salvar
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Treino Dialog — estimativa via IA */}
      <Dialog open={treinoOpen} onOpenChange={(o) => { setTreinoOpen(o); if (!o) setTreinoForm({ data: TODAY, descricao: "" }); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles size={16} className="text-[#C8DA2D]" />
              Registrar Treino com IA
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Data</Label>
              <Input type="date" value={treinoForm.data} onChange={(e) => setTreinoForm((f) => ({ ...f, data: e.target.value }))} className="mt-1" />
            </div>
            <div>
              <Label>O que você treinou?</Label>
              <Textarea
                value={treinoForm.descricao}
                onChange={(e) => setTreinoForm((f) => ({ ...f, descricao: e.target.value }))}
                placeholder="Ex: Musculação — costas e bíceps, 1h15. Exercícios: barra fixa 4x10, remada curvada 4x12, rosca direta 3x12."
                className="mt-1 resize-none"
                rows={3}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              A IA vai estimar o gasto calórico com base no seu peso atual ({ultimoPeso?.peso ?? 70} kg) e na descrição do treino.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTreinoOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => analisarTreino.mutate({ data: treinoForm.data, descricao: treinoForm.descricao, peso_atual: ultimoPeso?.peso })}
              disabled={!treinoForm.descricao.trim() || analisarTreino.isPending}
              className="bg-[#C8DA2D] text-[#0C1923] hover:bg-[#d4e640] gap-2"
            >
              {analisarTreino.isPending ? (
                <>
                  <span className="animate-spin inline-block w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full" />
                  Estimando...
                </>
              ) : (
                <>
                  <Sparkles size={14} />
                  Estimar e Salvar
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
