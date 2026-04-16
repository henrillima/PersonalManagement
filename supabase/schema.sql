-- ============================================================
-- Life OS — Supabase Schema
-- Execute this in: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- ── TAREFAS ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS frentes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome       TEXT NOT NULL,
  cor        TEXT NOT NULL DEFAULT '#94a3b8',
  criado_em  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tarefas (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo      TEXT NOT NULL,
  descricao   TEXT,
  frente_id   UUID REFERENCES frentes(id) ON DELETE SET NULL,
  prioridade  TEXT NOT NULL DEFAULT 'media', -- alta | media | baixa
  status      TEXT NOT NULL DEFAULT 'todo',  -- todo | in_progress | done | blocked
  data_limite DATE,
  observacao  TEXT,
  concluida   BOOLEAN NOT NULL DEFAULT FALSE,
  criado_em   TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

-- ── FINANCEIRO: CONTAS E CAIXA ────────────────────────────────

CREATE TABLE IF NOT EXISTS bancos (
  id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome   TEXT NOT NULL UNIQUE,
  ordem  INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS caixa_snapshots (
  id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data     DATE NOT NULL,
  banco_id UUID NOT NULL REFERENCES bancos(id) ON DELETE CASCADE,
  valor    NUMERIC(12,2) NOT NULL DEFAULT 0,
  UNIQUE(data, banco_id)
);

CREATE INDEX IF NOT EXISTS idx_caixa_data ON caixa_snapshots(data DESC);

-- ── FINANCEIRO: FATURAS ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS faturas_cartoes (
  cartao      TEXT PRIMARY KEY,
  vencimento  INTEGER NOT NULL -- dia do mês
);

CREATE TABLE IF NOT EXISTS faturas (
  id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cartao TEXT NOT NULL REFERENCES faturas_cartoes(cartao) ON DELETE CASCADE,
  mes    TEXT NOT NULL, -- YYYY-MM
  valor  NUMERIC(12,2) NOT NULL DEFAULT 0,
  UNIQUE(cartao, mes)
);

CREATE INDEX IF NOT EXISTS idx_faturas_mes ON faturas(mes);

-- ── FINANCEIRO: FLUXOS RECORRENTES ───────────────────────────

CREATE TABLE IF NOT EXISTS fluxos_recorrentes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo        TEXT NOT NULL, -- Receita | Despesa
  categoria   TEXT NOT NULL,
  descricao   TEXT NOT NULL,
  dia         INTEGER NOT NULL,
  valor       NUMERIC(12,2) NOT NULL,
  inicio      TEXT NOT NULL, -- YYYY-MM
  fim         TEXT,          -- YYYY-MM or NULL (ativo indefinidamente)
  criado_em   TIMESTAMPTZ DEFAULT NOW()
);

-- ── FINANCEIRO: FLUXOS PONTUAIS ──────────────────────────────

CREATE TABLE IF NOT EXISTS fluxos_pontuais (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo      TEXT NOT NULL, -- Receita | Despesa
  categoria TEXT NOT NULL,
  descricao TEXT NOT NULL,
  dia       INTEGER NOT NULL,
  valor     NUMERIC(12,2) NOT NULL,
  mes_alvo  TEXT NOT NULL, -- YYYY-MM
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pontuais_mes ON fluxos_pontuais(mes_alvo);

-- ── FINANCEIRO: GASTOS VARIÁVEIS ─────────────────────────────

CREATE TABLE IF NOT EXISTS gastos_variaveis (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mes       TEXT NOT NULL, -- YYYY-MM
  dia       INTEGER NOT NULL,
  categoria TEXT NOT NULL,
  descricao TEXT NOT NULL,
  valor     NUMERIC(12,2) NOT NULL,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gastos_mes ON gastos_variaveis(mes);

CREATE TABLE IF NOT EXISTS orcamento (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  categoria   TEXT NOT NULL,
  teto        NUMERIC(12,2) NOT NULL,
  mes_excecao TEXT, -- YYYY-MM se exceção; NULL se regra base
  UNIQUE(categoria, mes_excecao)
);

-- ── FINANCEIRO: INVESTIMENTOS ─────────────────────────────────

CREATE TABLE IF NOT EXISTS aportes (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mes       TEXT NOT NULL,   -- YYYY-MM
  dia       INTEGER NOT NULL,
  classe    TEXT NOT NULL,
  ativo     TEXT NOT NULL,
  valor     NUMERIC(12,2) NOT NULL,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_aportes_mes ON aportes(mes);

CREATE TABLE IF NOT EXISTS plano_investimento (
  id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo     TEXT NOT NULL,   -- estrutural | tatico
  classe   TEXT NOT NULL,
  valor    NUMERIC(12,2) NOT NULL,
  mes_alvo TEXT,            -- YYYY-MM (apenas para táticos)
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tipo, classe, mes_alvo) -- evita duplicatas estruturais
);

-- ── FINANCEIRO: TERCEIROS ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS terceiros (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pessoa    TEXT NOT NULL,
  origem    TEXT NOT NULL, -- pix | cartao
  descricao TEXT NOT NULL,
  mes_alvo  TEXT NOT NULL, -- YYYY-MM
  dia       INTEGER NOT NULL,
  valor     NUMERIC(12,2) NOT NULL,
  recebido  BOOLEAN NOT NULL DEFAULT FALSE,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- ── FINANCEIRO: DÍVIDAS / PENDÊNCIAS ─────────────────────────

CREATE TABLE IF NOT EXISTS dividas (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  descricao TEXT NOT NULL,
  valor     NUMERIC(12,2) NOT NULL,
  mes       TEXT NOT NULL, -- YYYY-MM
  dia       INTEGER NOT NULL,
  pago      BOOLEAN NOT NULL DEFAULT FALSE,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- ── SAÚDE ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS saude_perfil (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idade       INTEGER,
  altura      NUMERIC(5,2), -- cm
  sexo        TEXT,          -- M | F
  fator_idx   INTEGER DEFAULT 3, -- 1-5 (sedentário → muito ativo)
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

-- Garante somente 1 linha de perfil
CREATE UNIQUE INDEX IF NOT EXISTS idx_saude_perfil_single ON saude_perfil((TRUE));

CREATE TABLE IF NOT EXISTS saude_peso (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data      DATE NOT NULL,
  peso      NUMERIC(5,2) NOT NULL,
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(data)
);

CREATE TABLE IF NOT EXISTS saude_dieta (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data        DATE NOT NULL,
  refeicao    TEXT NOT NULL,
  descricao   TEXT NOT NULL,
  calorias    INTEGER,
  proteina    NUMERIC(7,2),
  carboidrato NUMERIC(7,2),
  gordura     NUMERIC(7,2),
  criado_em   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dieta_data ON saude_dieta(data DESC);

CREATE TABLE IF NOT EXISTS saude_treino (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data           DATE NOT NULL,
  descricao      TEXT NOT NULL,
  gasto_calorico INTEGER,
  criado_em      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_treino_data ON saude_treino(data DESC);
