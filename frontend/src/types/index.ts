// ── Auth ─────────────────────────────────────────────────────────────────────

export interface LoginRequest {
  email: string;
  password: string;
}

// ── Tarefas ───────────────────────────────────────────────────────────────────

export type Prioridade = "alta" | "media" | "baixa";
export type TarefaStatus = "todo" | "in_progress" | "done" | "blocked";

export interface Frente {
  id: string;
  nome: string;
  cor: string;
  criado_em: string;
}

export interface Tarefa {
  id: string;
  titulo: string;
  descricao: string | null;
  frente_id: string | null;
  frente_nome: string | null;
  frente_cor: string | null;
  prioridade: Prioridade;
  status: TarefaStatus;
  data_limite: string | null; // YYYY-MM-DD
  observacao: string | null;
  concluida: boolean;
  criado_em: string;
  atualizado_em: string;
}

// ── Financeiro: Caixa ────────────────────────────────────────────────────────

export interface Banco {
  id: string;
  nome: string;
  ordem: number;
}

export interface SaldoBanco {
  banco_id: string;
  nome: string;
  valor: number;
}

export interface HistoricoItem {
  data: string;
  total: number;
}

export interface CaixaResponse {
  latest_date: string | null;
  saldo_total: number;
  saldo_por_banco: SaldoBanco[];
  historico: HistoricoItem[];
}

// ── Financeiro: Faturas ──────────────────────────────────────────────────────

export interface FaturaCartao {
  cartao: string;
  vencimento: number;
}

export interface FaturaRow {
  cartao: string;
  vencimento: number;
  valor: number;
}

export interface FaturasResponse {
  mes: string;
  faturas: FaturaRow[];
  total: number;
}

// ── Financeiro: Fluxos ───────────────────────────────────────────────────────

export interface FluxoRecorrente {
  id: string;
  tipo: "Receita" | "Despesa";
  categoria: string;
  descricao: string;
  dia: number;
  valor: number;
  inicio: string;  // YYYY-MM
  fim: string | null;
  criado_em: string;
}

export interface FluxoPontual {
  id: string;
  tipo: "Receita" | "Despesa";
  categoria: string;
  descricao: string;
  dia: number;
  valor: number;
  mes_alvo: string; // YYYY-MM
  criado_em: string;
}

// ── Financeiro: Gastos Variáveis ──────────────────────────────────────────────

export interface GastoVariavel {
  id: string;
  mes: string;
  dia: number;
  categoria: string;
  descricao: string;
  valor: number;
  criado_em: string;
}

export interface OrcamentoBase {
  [categoria: string]: number;
}

export interface OrcamentoExcecao {
  id: string;
  categoria: string;
  teto: number;
  mes_excecao: string;
}

export interface OrcamentoResponse {
  base: OrcamentoBase;
  excecoes: OrcamentoExcecao[];
}

// ── Financeiro: Investimentos ─────────────────────────────────────────────────

export interface Aporte {
  id: string;
  mes: string;
  dia: number;
  classe: string;
  ativo: string;
  valor: number;
  criado_em: string;
}

export interface PlanoEstruturalItem {
  [classe: string]: number;
}

export interface PlanoTaticoItem {
  id: string;
  classe: string;
  valor: number;
  mes_alvo: string;
}

export interface PlanoInvestimentoResponse {
  estrutural: PlanoEstruturalItem;
  tatico: PlanoTaticoItem[];
}

// ── Financeiro: Terceiros ─────────────────────────────────────────────────────

export interface Terceiro {
  id: string;
  pessoa: string;
  origem: "pix" | "cartao";
  descricao: string;
  mes_alvo: string;
  dia: number;
  valor: number;
  recebido: boolean;
  criado_em: string;
}

// ── Financeiro: Dívidas ───────────────────────────────────────────────────────

export interface Divida {
  id: string;
  descricao: string;
  valor: number;
  mes: string;
  dia: number;
  pago: boolean;
  criado_em: string;
}

// ── Home Dashboard ────────────────────────────────────────────────────────────

export interface TarefaResumo {
  id: string;
  titulo: string;
  prioridade: Prioridade;
  status: TarefaStatus;
  data_limite: string | null;
  frente_nome: string | null;
  frente_cor: string | null;
}

export interface DespesaResumo {
  descricao: string;
  categoria: string;
  valor: number;
  data: string;
  tipo: "recorrente" | "pontual";
}

export interface HomeResumo {
  saldo_total: number;
  saldo_por_banco: { nome: string; valor: number }[];
  caixa_data: string | null;
  tarefas_semana: TarefaResumo[];
  tarefas_atrasadas: TarefaResumo[];
  proximas_despesas: DespesaResumo[];
}

// ── Saúde ─────────────────────────────────────────────────────────────────────

export interface SaudePerfil {
  id?: string;
  idade: number | null;
  altura: number | null;
  sexo: "M" | "F" | null;
  fator_idx: number;
  atualizado_em?: string;
}

export interface PesoEntry {
  id: string;
  data: string;
  peso: number;
  criado_em: string;
}

export interface DietaEntry {
  id: string;
  data: string;
  refeicao: string;
  descricao: string;
  calorias: number | null;
  proteina: number | null;
  carboidrato: number | null;
  gordura: number | null;
  criado_em: string;
}

export interface TreinoEntry {
  id: string;
  data: string;
  descricao: string;
  gasto_calorico: number | null;
  criado_em: string;
}
