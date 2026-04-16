import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Settings } from "lucide-react";
import { apiFetch, fmtDate } from "@/lib/api";
import type { SaudePerfil, PesoEntry, DietaEntry, TreinoEntry } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

const REFEICOES = ["Café da manhã", "Lanche da manhã", "Almoço", "Lanche da tarde", "Jantar", "Ceia"];

export default function Saude() {
  const qc = useQueryClient();
  const [perfilOpen, setPerfilOpen] = useState(false);
  const [pesoOpen, setPesoOpen]     = useState(false);
  const [dietaOpen, setDietaOpen]   = useState(false);
  const [treinoOpen, setTreinoOpen] = useState(false);

  const [perfilForm, setPerfilForm] = useState({ idade: "", altura: "", sexo: "M", fator_idx: "3" });
  const [pesoForm, setPesoForm]     = useState({ data: new Date().toISOString().slice(0, 10), peso: "" });
  const [dietaForm, setDietaForm]   = useState({ data: new Date().toISOString().slice(0, 10), refeicao: "Almoço", descricao: "", calorias: "", proteina: "", carboidrato: "", gordura: "" });
  const [treinoForm, setTreinoForm] = useState({ data: new Date().toISOString().slice(0, 10), descricao: "", gasto_calorico: "" });

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

  const createDieta = useMutation({
    mutationFn: (d: object) => apiFetch("/api/v1/saude/dieta", { method: "POST", body: JSON.stringify(d) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["saude-dieta"] }); setDietaOpen(false); },
  });

  const deleteDieta = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/v1/saude/dieta/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["saude-dieta"] }),
  });

  const createTreino = useMutation({
    mutationFn: (d: object) => apiFetch("/api/v1/saude/treino", { method: "POST", body: JSON.stringify(d) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["saude-treino"] }); setTreinoOpen(false); },
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

  // Compute today's totals from dieta
  const today = new Date().toISOString().slice(0, 10);
  const dietaHoje = dieta.filter((d) => d.data === today);
  const calHoje   = dietaHoje.reduce((s, d) => s + (d.calorias ?? 0), 0);
  const protHoje  = dietaHoje.reduce((s, d) => s + (d.proteina ?? 0), 0);
  const carbHoje  = dietaHoje.reduce((s, d) => s + (d.carboidrato ?? 0), 0);
  const gordHoje  = dietaHoje.reduce((s, d) => s + (d.gordura ?? 0), 0);

  const ultimoPeso = pesos[0];

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
          <div className="flex gap-8 text-sm">
            {perfil.idade && <div><p className="text-muted-foreground text-xs">Idade</p><p className="font-medium">{perfil.idade} anos</p></div>}
            {perfil.altura && <div><p className="text-muted-foreground text-xs">Altura</p><p className="font-medium">{perfil.altura} cm</p></div>}
            {ultimoPeso && <div><p className="text-muted-foreground text-xs">Peso atual</p><p className="font-medium">{ultimoPeso.peso} kg</p></div>}
            {perfil.sexo && <div><p className="text-muted-foreground text-xs">Sexo</p><p className="font-medium">{perfil.sexo === "M" ? "Masculino" : "Feminino"}</p></div>}
            {perfil.fator_idx && <div><p className="text-muted-foreground text-xs">Nível de atividade</p><p className="font-medium">{FATOR_LABELS[perfil.fator_idx - 1]?.split(" - ")[1]}</p></div>}
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
            <div className="flex gap-4 text-sm">
              <span className="text-muted-foreground">Calorias: <strong className="text-foreground">{calHoje} kcal</strong></span>
              <span className="text-muted-foreground">Prot: <strong className="text-blue-400">{protHoje.toFixed(0)}g</strong></span>
              <span className="text-muted-foreground">Carb: <strong className="text-amber-400">{carbHoje.toFixed(0)}g</strong></span>
              <span className="text-muted-foreground">Gord: <strong className="text-red-400">{gordHoje.toFixed(0)}g</strong></span>
            </div>
            <Button size="sm" onClick={() => setDietaOpen(true)} className="bg-[#C8DA2D] text-[#0C1923] hover:bg-[#d4e640]">
              <Plus size={14} className="mr-1" /> Refeição
            </Button>
          </div>

          {lDieta ? <Skeleton className="h-32 rounded-xl" /> : dietaHoje.length === 0 ? (
            <div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground text-sm">
              Nenhuma refeição registrada hoje.
            </div>
          ) : (
            <div className="space-y-1">
              {dietaHoje.map((d) => (
                <div key={d.id} className="flex items-center gap-3 bg-card border border-border rounded-lg px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{d.refeicao}: {d.descricao}</p>
                    <p className="text-xs text-muted-foreground">
                      {d.calorias} kcal · {d.proteina}g prot · {d.carboidrato}g carb · {d.gordura}g gord
                    </p>
                  </div>
                  <button onClick={() => deleteDieta.mutate(d.id)} className="text-muted-foreground hover:text-red-500 transition-colors"><Trash2 size={13} /></button>
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
                  <p className="flex-1 text-sm font-medium truncate">{t.descricao}</p>
                  {t.gasto_calorico && <span className="text-sm text-amber-400 shrink-0">{t.gasto_calorico} kcal</span>}
                  <button onClick={() => deleteTreino.mutate(t.id)} className="text-muted-foreground hover:text-red-500 transition-colors"><Trash2 size={13} /></button>
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
                    <SelectItem key={i+1} value={String(i+1)}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPerfilOpen(false)}>Cancelar</Button>
            <Button onClick={() => upsertPerfil.mutate({ idade: parseInt(perfilForm.idade) || undefined, altura: parseFloat(perfilForm.altura) || undefined, sexo: perfilForm.sexo, fator_idx: parseInt(perfilForm.fator_idx) })} disabled={upsertPerfil.isPending} className="bg-[#C8DA2D] text-[#0C1923] hover:bg-[#d4e640]">
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
            <Button onClick={() => createPeso.mutate({ data: pesoForm.data, peso: parseFloat(pesoForm.peso) })} disabled={!pesoForm.peso || createPeso.isPending} className="bg-[#C8DA2D] text-[#0C1923] hover:bg-[#d4e640]">
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dieta Dialog */}
      <Dialog open={dietaOpen} onOpenChange={setDietaOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Registrar Refeição</DialogTitle></DialogHeader>
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
              <Label>Descrição</Label>
              <Input value={dietaForm.descricao} onChange={(e) => setDietaForm((f) => ({ ...f, descricao: e.target.value }))} placeholder="O que você comeu?" className="mt-1" />
            </div>
            <div className="grid grid-cols-4 gap-2">
              {[
                { key: "calorias", label: "kcal" },
                { key: "proteina", label: "Prot (g)" },
                { key: "carboidrato", label: "Carb (g)" },
                { key: "gordura", label: "Gord (g)" },
              ].map(({ key, label }) => (
                <div key={key}>
                  <Label className="text-xs">{label}</Label>
                  <Input
                    type="number" step="0.1"
                    value={dietaForm[key as keyof typeof dietaForm]}
                    onChange={(e) => setDietaForm((f) => ({ ...f, [key]: e.target.value }))}
                    className="mt-1 h-8 text-sm"
                  />
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDietaOpen(false)}>Cancelar</Button>
            <Button onClick={() => createDieta.mutate({
              data: dietaForm.data, refeicao: dietaForm.refeicao, descricao: dietaForm.descricao,
              calorias: parseInt(dietaForm.calorias) || undefined,
              proteina: parseFloat(dietaForm.proteina) || undefined,
              carboidrato: parseFloat(dietaForm.carboidrato) || undefined,
              gordura: parseFloat(dietaForm.gordura) || undefined,
            })} disabled={!dietaForm.descricao || createDieta.isPending} className="bg-[#C8DA2D] text-[#0C1923] hover:bg-[#d4e640]">
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Treino Dialog */}
      <Dialog open={treinoOpen} onOpenChange={setTreinoOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Registrar Treino</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Data</Label>
              <Input type="date" value={treinoForm.data} onChange={(e) => setTreinoForm((f) => ({ ...f, data: e.target.value }))} className="mt-1" />
            </div>
            <div>
              <Label>Descrição</Label>
              <Input value={treinoForm.descricao} onChange={(e) => setTreinoForm((f) => ({ ...f, descricao: e.target.value }))} placeholder="Ex: Musculação A, Corrida 5km..." className="mt-1" />
            </div>
            <div>
              <Label>Gasto calórico (kcal) — opcional</Label>
              <Input type="number" value={treinoForm.gasto_calorico} onChange={(e) => setTreinoForm((f) => ({ ...f, gasto_calorico: e.target.value }))} placeholder="350" className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTreinoOpen(false)}>Cancelar</Button>
            <Button onClick={() => createTreino.mutate({ data: treinoForm.data, descricao: treinoForm.descricao, gasto_calorico: parseInt(treinoForm.gasto_calorico) || undefined })} disabled={!treinoForm.descricao || createTreino.isPending} className="bg-[#C8DA2D] text-[#0C1923] hover:bg-[#d4e640]">
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
