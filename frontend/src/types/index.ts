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
  categoria: Categoria | null;
  criado_em: string;
}

export type Categoria = string;

export interface CategoriaItem {
  id: string;
  nome: string;
  emoji: string;
  cor: string;
  ordem: number;
  criado_em: string;
}

export interface EventoAgenda {
  id: string;
  title: string;
  start: string;
  end: string;
  description?: string;
}

export interface Tarefa {
  id: string;
  titulo: string;
  descricao: string | null;
  frente_id: string | null;
  frente_nome: string | null;
  frente_cor: string | null;
  categoria: Categoria;
  prioridade: Prioridade;
  status: TarefaStatus;
  ordem: number;
  data_limite: string | null;
  observacao: string | null;
  concluida: boolean;
  arquivado: boolean;
  tipo_arquivo: "engavetada" | "arquivo" | null;
  criado_em: string;
  atualizado_em: string;
}

export interface ListaComprasItem {
  id: string;
  nome: string;
  quantidade: number;
  unidade: string;
  valor_esperado: number | null;
  categoria: string | null;
  comprado: boolean;
  tipo: "mercado" | "desejo";
  criado_em: string;
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
  pago: boolean;
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
  via_cartao: boolean;
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
  pago: boolean;
  criado_em: string;
}

export interface RecorrentePagamento {
  id: string;
  recorrente_id: string;
  mes: string;
  pago: boolean;
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

// ── Tarefas Recorrentes ───────────────────────────────────────────────────────

export interface TarefaRecorrente {
  id: string;
  titulo: string;
  descricao: string | null;
  frente_id: string | null;
  frente_nome: string | null;
  frente_cor: string | null;
  categoria: string;
  prioridade: Prioridade;
  frequencia: "diaria" | "semanal" | "mensal" | "anual";
  dias_semana: number[] | null;
  dia_mes: number | null;
  mes: number | null;
  ativo: boolean;
  criado_em: string;
}

export interface TarefaRecorrenteOcorrencia {
  id: string;
  recorrente_id: string;
  data_alvo: string;
  concluida: boolean;
  titulo: string;
  descricao: string | null;
  categoria: string;
  prioridade: Prioridade;
  frente_nome: string | null;
  frente_cor: string | null;
  frequencia: string;
  criado_em: string;
}

// ── Saúde ─────────────────────────────────────────────────────────────────────

export interface SaudePerfil {
  id?: string;
  idade: number | null;
  altura: number | null;
  sexo: "M" | "F" | null;
  fator_idx: number;
  deficit_kcal: number | null;
  meta_proteina_g_kg: number | null;
  meta_peso: number | null;
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
