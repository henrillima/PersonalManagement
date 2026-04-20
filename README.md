# Life OS — Sistema de Gestão Pessoal

Aplicação web full-stack para gestão pessoal completa: finanças, tarefas, estudos, saúde, agenda e listas. Desenvolvida como um "sistema operacional da vida pessoal" com foco em produtividade e controle financeiro.

**Produção:** [personal-management-livid.vercel.app](https://personal-management-livid.vercel.app)

---

## Stack Tecnológica

### Frontend
| Tecnologia | Versão | Uso |
|---|---|---|
| React | 18 | UI principal |
| TypeScript | 5.5 | Tipagem estática |
| Vite | 5.4 | Build e dev server |
| React Router | v6 | Roteamento SPA |
| TanStack React Query | v5 | Server state, cache, mutations |
| shadcn/ui + Radix UI | — | Componentes de UI acessíveis |
| Tailwind CSS | 3.4 | Estilização |
| Recharts | 2.12 | Gráficos financeiros |
| @dnd-kit | 6/10 | Drag-and-drop (Kanban, Estudos) |
| Lucide React | 0.46 | Ícones |

### Backend
| Tecnologia | Uso |
|---|---|
| Python 3.11+ | Linguagem |
| FastAPI | Framework REST API |
| Pydantic v2 | Validação de dados e serialização |
| Supabase Python SDK | Acesso ao banco de dados |
| python-jose | Validação JWT |
| OpenAI SDK | Análise nutricional com IA (Saúde) |

### Infraestrutura
| Tecnologia | Uso |
|---|---|
| Supabase | PostgreSQL (banco de dados) + Auth (JWT) |

---

## Estrutura do Projeto

```
/
├── backend/
│   ├── main.py                     # Entrada FastAPI, registro de routers
│   ├── auth.py                     # Middleware JWT (verify_token)
│   ├── database.py                 # Cliente Supabase
│   ├── requirements.txt
│   └── routers/
│       ├── auth_router.py          # Login / token
│       ├── home_router.py          # Dashboard resumido (GET /home/resumo)
│       ├── tarefas_router.py       # Tarefas, Frentes, Categorias, Recorrentes
│       ├── categorias_router.py    # CRUD de categorias de tarefas
│       ├── financeiro_router.py    # Todo o módulo financeiro
│       ├── saude_router.py         # Saúde (peso, dieta, treino, perfil)
│       ├── lista_compras_router.py # Lista de compras
│       ├── agenda_router.py        # Eventos de calendário
│       ├── pessoas_router.py       # Cadastro de contatos (Terceiros)
│       ├── corretoras_router.py    # Corretoras de investimento
│       └── estudos_router.py       # Categorias, frentes e itens de estudo
│
└── frontend/
    └── src/
        ├── App.tsx                 # Rotas React Router
        ├── types/index.ts          # Todos os tipos TypeScript
        ├── lib/
        │   ├── api.ts              # apiFetch, fmtBRL, fmtDate, currentMes
        │   └── utils.ts            # cn() (clsx + tailwind-merge)
        ├── components/
        │   ├── Layout/
        │   │   ├── AppLayout.tsx   # Shell principal (sidebar + outlet)
        │   │   └── Sidebar.tsx     # Navegação lateral
        │   └── ui/                 # Componentes shadcn/ui
        │       └── emoji-picker.tsx # Seletor de emoji customizado
        └── pages/
            ├── Home.tsx
            ├── Tarefas.tsx
            ├── TarefasRecorrentesView.tsx
            ├── Estudos.tsx
            ├── ListaCompras.tsx
            ├── Rotina.tsx
            ├── Saude.tsx
            └── Financeiro/
                ├── Layout.tsx
                ├── Dashboard.tsx
                ├── Caixa.tsx
                ├── Faturas.tsx
                ├── Recorrentes.tsx
                ├── Pontuais.tsx
                ├── CustoVida.tsx
                ├── Investimentos.tsx
                ├── Terceiros.tsx
                └── Pendencias.tsx
```

---

## Como Rodar Localmente

### Pré-requisitos
- Python 3.11+
- Node.js 18+
- Conta no [Supabase](https://supabase.com) com projeto configurado

### Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # Linux/Mac
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
# Acesse http://localhost:5173
```

---

## Variáveis de Ambiente

### Backend — `backend/.env`
```env
SUPABASE_URL=https://SEU_PROJETO.supabase.co
SUPABASE_KEY=sua_service_role_key
JWT_SECRET=seu_jwt_secret_do_supabase
ALLOWED_ORIGINS=http://localhost:5173
OPENAI_API_KEY=sk-...          # Opcional — usado na análise nutricional
```

### Frontend — `frontend/.env`
```env
VITE_API_BASE_URL=http://localhost:8000
```

> **Atenção:** `SUPABASE_KEY` deve ser a **service_role key** (acesso admin sem RLS), pois o backend gerencia toda a autorização via JWT próprio.

---

## Páginas e Rotas

| Rota | Página | Descrição |
|---|---|---|
| `/` | Home | Resumo semanal: tarefas, caixa, próximas despesas, agenda |
| `/tarefas` | Tarefas | Kanban com D&D, categorias, projetos, recorrentes |
| `/financeiro/dashboard` | Dashboard Financeiro | Visão consolidada + gráfico de distribuição |
| `/financeiro/caixa` | Caixa | Saldos por banco com histórico |
| `/financeiro/faturas` | Faturas | Faturas mensais por cartão |
| `/financeiro/recorrentes` | Recorrentes | Fluxos fixos mensais (receitas e despesas) |
| `/financeiro/pontuais` | Pontuais | Lançamentos únicos por mês |
| `/financeiro/custo-vida` | Custo de Vida | Gastos variáveis com orçamento por categoria |
| `/financeiro/investimentos` | Investimentos | Aportes, plano estrutural e tático, corretoras |
| `/financeiro/terceiros` | Terceiros | Empréstimos bilaterais entre pessoas |
| `/financeiro/pendencias` | Pendências | Dívidas pessoais + painel de atrasados |
| `/estudos` | Estudos | Mapa de estudos: categorias, frentes, itens com D&D |
| `/rotina` | Agenda | Calendário de eventos |
| `/lista-compras` | Lista de Compras | Mercado e lista de desejos por categoria |
| `/saude` | Saúde | Peso, dieta, treinos, perfil e metas |

---

## Arquitetura no Supabase

O Supabase é usado como **banco de dados PostgreSQL**. A autenticação é via **Supabase Auth** (email/password), que gera JWTs validados pelo backend Python em cada requisição.

### Fluxo de autenticação

```
Browser  →  POST /api/v1/auth/login
         →  Backend valida credenciais com Supabase Auth
         ←  Retorna JWT token

Browser  →  Qualquer endpoint com header: Authorization: Bearer <token>
         →  Backend verifica assinatura JWT via verify_token()
         →  Acessa o Supabase com service_role key
```

---

### Módulo: Tarefas

#### `categorias`
Categorias criadas pelo usuário para organizar tarefas (ex: Pessoal, Trabalho).

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | UUID PK | — |
| `nome` | TEXT | Nome da categoria |
| `emoji` | TEXT | Emoji identificador |
| `cor` | TEXT | Cor hex da aba |
| `ordem` | INTEGER | Ordem de exibição |
| `criado_em` | TIMESTAMPTZ | — |

#### `frentes`
Projetos dentro de uma categoria (ex: "Site X", "Estudo Cálculo").

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | UUID PK | — |
| `nome` | TEXT | — |
| `cor` | TEXT | Cor hex para badge |
| `categoria` | TEXT | Nome da categoria (referência textual) |
| `criado_em` | TIMESTAMPTZ | — |

#### `tarefas`
Tarefas individuais no kanban com drag-and-drop.

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | UUID PK | — |
| `titulo` | TEXT | — |
| `descricao` | TEXT | — |
| `frente_id` | UUID → frentes | Projeto ao qual pertence |
| `categoria` | TEXT | Categoria (denormalizado para filtro) |
| `prioridade` | TEXT | `alta` / `media` / `baixa` |
| `status` | TEXT | `todo` / `in_progress` / `done` / `blocked` |
| `ordem` | INTEGER | Posição no kanban |
| `data_limite` | DATE | Prazo |
| `observacao` | TEXT | Notas internas |
| `concluida` | BOOLEAN | — |
| `arquivado` | BOOLEAN | Se está no arquivo |
| `tipo_arquivo` | TEXT | `engavetada` / `arquivo` |
| `criado_em` | TIMESTAMPTZ | — |
| `atualizado_em` | TIMESTAMPTZ | — |

#### `tarefas_recorrentes`
Templates de tarefas que se repetem por frequência configurável.

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | UUID PK | — |
| `titulo` | TEXT | — |
| `descricao` | TEXT | — |
| `frente_id` | UUID → frentes | — |
| `categoria` | TEXT | — |
| `prioridade` | TEXT | — |
| `frequencia` | TEXT | `diaria` / `semanal` / `mensal` / `anual` |
| `dias_semana` | INTEGER[] | Ex: `[0,1,4]` = seg, ter, qui |
| `dia_mes` | INTEGER | Dia do mês (mensal/anual) |
| `mes` | INTEGER | Mês do ano (anual) |
| `ativo` | BOOLEAN | — |
| `criado_em` | TIMESTAMPTZ | — |

#### `tarefas_recorrentes_ocorrencias`
Instâncias geradas a partir dos templates. Geradas on-demand ao acessar o mês.

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | UUID PK | — |
| `recorrente_id` | UUID → tarefas_recorrentes | Template de origem |
| `data_alvo` | DATE | Data da ocorrência |
| `concluida` | BOOLEAN | — |
| `criado_em` | TIMESTAMPTZ | — |

> **Constraint única:** `(recorrente_id, data_alvo)` — geração é idempotente via upsert.

---

### Módulo: Financeiro

#### `bancos`
Contas bancárias do usuário.

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | UUID PK | — |
| `nome` | TEXT | — |
| `ordem` | INTEGER | Ordem de exibição |

#### `caixa_snapshots`
Histórico de saldos registrados por data e banco.

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | UUID PK | — |
| `data` | DATE | Data do registro |
| `banco_id` | UUID → bancos | — |
| `valor` | NUMERIC | Saldo naquele dia |

> **Constraint única:** `(data, banco_id)`

#### `faturas_cartoes`
Cartões de crédito cadastrados com dia de vencimento.

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | UUID PK | — |
| `cartao` | TEXT (único) | Nome do cartão |
| `vencimento` | INTEGER | Dia do mês |

#### `faturas`
Valor de cada fatura por cartão e mês.

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | UUID PK | — |
| `cartao` | TEXT → faturas_cartoes | — |
| `mes` | TEXT | `YYYY-MM` |
| `valor` | NUMERIC | — |
| `pago` | BOOLEAN | — |

> **Constraint única:** `(cartao, mes)`

#### `fluxos_recorrentes`
Receitas e despesas que se repetem todo mês (salário, aluguel, assinaturas).

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | UUID PK | — |
| `tipo` | TEXT | `Receita` / `Despesa` |
| `categoria` | TEXT | — |
| `descricao` | TEXT | — |
| `dia` | INTEGER | Dia de competência |
| `valor` | NUMERIC | — |
| `inicio` | TEXT | Mês de início `YYYY-MM` |
| `fim` | TEXT | Mês de término (NULL = sem prazo) |
| `via_cartao` | BOOLEAN | Se é debitado em cartão |
| `criado_em` | TIMESTAMPTZ | — |

#### `recorrentes_pagamentos`
Registro de quais recorrentes foram pagos em cada mês.

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | UUID PK | — |
| `recorrente_id` | UUID → fluxos_recorrentes | — |
| `mes` | TEXT | `YYYY-MM` |
| `pago` | BOOLEAN | — |
| `criado_em` | TIMESTAMPTZ | — |

> **Constraint única:** `(recorrente_id, mes)`

#### `fluxos_pontuais`
Lançamentos únicos não recorrentes em meses específicos.

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | UUID PK | — |
| `tipo` | TEXT | `Receita` / `Despesa` |
| `categoria` | TEXT | — |
| `descricao` | TEXT | — |
| `dia` | INTEGER | — |
| `valor` | NUMERIC | — |
| `mes_alvo` | TEXT | `YYYY-MM` |
| `pago` | BOOLEAN | — |
| `criado_em` | TIMESTAMPTZ | — |

#### `gastos_variaveis`
Gastos do dia a dia rastreados com orçamento por categoria.

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | UUID PK | — |
| `mes` | TEXT | `YYYY-MM` |
| `dia` | INTEGER | — |
| `categoria` | TEXT | — |
| `descricao` | TEXT | — |
| `valor` | NUMERIC | — |
| `criado_em` | TIMESTAMPTZ | — |

#### `orcamento`
Teto de gastos por categoria, com suporte a exceções mensais.

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | UUID PK | — |
| `categoria` | TEXT | — |
| `teto` | NUMERIC | Valor máximo orçado |
| `mes_excecao` | TEXT | NULL = regra base; `YYYY-MM` = exceção pontual |

> **Constraint única:** `(categoria, mes_excecao)`

#### `aportes`
Investimentos realizados (compra de ativos financeiros).

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | UUID PK | — |
| `mes` | TEXT | `YYYY-MM` |
| `dia` | INTEGER | — |
| `classe` | TEXT | Ex: Renda Fixa, FII, Ações |
| `ativo` | TEXT | Nome do ativo |
| `valor` | NUMERIC | — |
| `corretora_id` | UUID → corretoras | — |
| `criado_em` | TIMESTAMPTZ | — |

#### `plano_investimento`
Plano estrutural (% ideal por classe) e plano tático (metas mensais).

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | UUID PK | — |
| `tipo` | TEXT | `estrutural` / `tatico` |
| `classe` | TEXT | Classe de ativo |
| `valor` | NUMERIC | % (estrutural) ou R$ (tático) |
| `mes_alvo` | TEXT | Apenas para tático (`YYYY-MM`) |

#### `corretoras`
Corretoras de investimento cadastradas pelo usuário.

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | UUID PK | — |
| `nome` | TEXT | — |
| `cor` | TEXT | Cor hex para badge |
| `criado_em` | TIMESTAMPTZ | — |

#### `terceiros`
Controle bilateral de empréstimos e dívidas entre pessoas.

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | UUID PK | — |
| `pessoa` | TEXT | Nome do envolvido |
| `direcao` | TEXT | `a_receber` (me devem) / `a_pagar` (devo) |
| `origem` | TEXT | `pix` / `cartao` |
| `descricao` | TEXT | Motivo |
| `mes_alvo` | TEXT | `YYYY-MM` |
| `dia` | INTEGER | Dia de vencimento |
| `valor` | NUMERIC | — |
| `recebido` | BOOLEAN | Liquidado (para `a_receber`) |
| `pago` | BOOLEAN | Liquidado (para `a_pagar`) |
| `criado_em` | TIMESTAMPTZ | — |

#### `dividas`
Dívidas pessoais pontuais (multas, parcelamentos, pendências).

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | UUID PK | — |
| `descricao` | TEXT | — |
| `valor` | NUMERIC | — |
| `mes` | TEXT | `YYYY-MM` de vencimento |
| `dia` | INTEGER | — |
| `pago` | BOOLEAN | — |
| `criado_em` | TIMESTAMPTZ | — |

#### `pessoas`
Agenda de contatos utilizada pelo módulo Terceiros.

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | UUID PK | — |
| `nome` | TEXT | — |
| `telefone` | TEXT | Opcional |
| `criado_em` | TIMESTAMPTZ | — |

---

### Módulo: Estudos

#### `categorias_estudo`
Áreas de conhecimento criáveis (ex: Programação, Mercado Financeiro).

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | UUID PK | — |
| `nome` | TEXT | — |
| `emoji` | TEXT | — |
| `ordem` | INTEGER | Posição no painel |
| `criado_em` | TIMESTAMPTZ | — |

#### `frentes_estudo`
Frentes dentro de uma área (ex: Livros, Cursos Online, Artigos).

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | UUID PK | — |
| `categoria_id` | UUID → categorias_estudo | — |
| `nome` | TEXT | — |
| `ordem` | INTEGER | — |
| `criado_em` | TIMESTAMPTZ | — |

#### `itens_estudo`
Materiais individuais com progresso e ordenação por drag-and-drop.

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | UUID PK | — |
| `frente_id` | UUID → frentes_estudo | — |
| `titulo` | TEXT | Nome do livro, curso, artigo, etc. |
| `tipo` | TEXT | `Livro` / `Curso` / `Vídeo` / `Artigo` / `Podcast` / `Outro` |
| `obrigatorio` | BOOLEAN | Obrigatório ou opcional no plano |
| `progresso` | INTEGER | 0–100 (percentual concluído) |
| `concluido` | BOOLEAN | — |
| `url` | TEXT | Link opcional |
| `notas` | TEXT | Observações pessoais |
| `ordem` | INTEGER | Posição na lista (drag-and-drop) |
| `criado_em` | TIMESTAMPTZ | — |

---

### Módulo: Saúde

#### `saude_perfil`
Dados físicos do usuário para cálculo de TMB e TDEE.

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | UUID PK | — |
| `idade` | INTEGER | — |
| `altura` | NUMERIC | Em cm |
| `sexo` | TEXT | `M` / `F` |
| `fator_idx` | INTEGER | 1–5 (nível de atividade física) |
| `deficit_kcal` | INTEGER | Déficit calórico diário desejado |
| `meta_proteina_g_kg` | NUMERIC | Meta de proteína (g por kg corporal) |
| `meta_peso` | NUMERIC | Peso alvo em kg |
| `atualizado_em` | TIMESTAMPTZ | — |

#### `peso_entries`
Histórico de pesagens diárias.

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | UUID PK | — |
| `data` | DATE | — |
| `peso` | NUMERIC | Em kg |
| `criado_em` | TIMESTAMPTZ | — |

#### `dieta_entries`
Refeições registradas com macronutrientes.

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | UUID PK | — |
| `data` | DATE | — |
| `refeicao` | TEXT | Ex: Café da Manhã, Almoço |
| `descricao` | TEXT | Alimentos consumidos |
| `calorias` | NUMERIC | — |
| `proteina` | NUMERIC | Em gramas |
| `carboidrato` | NUMERIC | Em gramas |
| `gordura` | NUMERIC | Em gramas |
| `criado_em` | TIMESTAMPTZ | — |

#### `treino_entries`
Registros de treinos realizados.

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | UUID PK | — |
| `data` | DATE | — |
| `descricao` | TEXT | Descrição do treino |
| `gasto_calorico` | NUMERIC | Kcal gastas (estimado) |
| `criado_em` | TIMESTAMPTZ | — |

---

### Módulo: Lista de Compras

#### `lista_compras`
Itens de mercado e lista de desejos.

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | UUID PK | — |
| `nome` | TEXT | — |
| `quantidade` | NUMERIC | — |
| `unidade` | TEXT | Ex: kg, un, L |
| `valor_esperado` | NUMERIC | Preço estimado |
| `categoria` | TEXT | Categoria (gerenciada via localStorage no cliente) |
| `comprado` | BOOLEAN | — |
| `tipo` | TEXT | `mercado` / `desejo` |
| `criado_em` | TIMESTAMPTZ | — |

---

### Módulo: Agenda

#### `agenda_eventos`
Eventos do calendário pessoal.

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | UUID PK | — |
| `title` | TEXT | Título do evento |
| `start` | TIMESTAMPTZ | Início (ISO 8601) |
| `end` | TIMESTAMPTZ | Término (ISO 8601) |
| `description` | TEXT | Descrição opcional |
| `criado_em` | TIMESTAMPTZ | — |

---

## SQL de Migração Completo

Cole no **SQL Editor** do Supabase para criar todas as tabelas:

```sql
-- ── Tarefas ───────────────────────────────────────────────────────────────────

CREATE TABLE categorias (
  id        UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome      TEXT NOT NULL,
  emoji     TEXT DEFAULT '📁',
  cor       TEXT DEFAULT '#94a3b8',
  ordem     INTEGER DEFAULT 0,
  criado_em TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE frentes (
  id        UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome      TEXT NOT NULL,
  cor       TEXT DEFAULT '#94a3b8',
  categoria TEXT,
  criado_em TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE tarefas (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo        TEXT NOT NULL,
  descricao     TEXT,
  frente_id     UUID REFERENCES frentes(id) ON DELETE SET NULL,
  categoria     TEXT DEFAULT 'Pessoal',
  prioridade    TEXT DEFAULT 'media',
  status        TEXT DEFAULT 'todo',
  ordem         INTEGER DEFAULT 0,
  data_limite   DATE,
  observacao    TEXT,
  concluida     BOOLEAN DEFAULT false,
  arquivado     BOOLEAN DEFAULT false,
  tipo_arquivo  TEXT,
  criado_em     TIMESTAMPTZ DEFAULT now(),
  atualizado_em TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE tarefas_recorrentes (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo      TEXT NOT NULL,
  descricao   TEXT,
  frente_id   UUID REFERENCES frentes(id) ON DELETE SET NULL,
  categoria   TEXT DEFAULT 'Pessoal',
  prioridade  TEXT DEFAULT 'media',
  frequencia  TEXT NOT NULL,
  dias_semana INTEGER[],
  dia_mes     INTEGER,
  mes         INTEGER,
  ativo       BOOLEAN DEFAULT true,
  criado_em   TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE tarefas_recorrentes_ocorrencias (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  recorrente_id UUID REFERENCES tarefas_recorrentes(id) ON DELETE CASCADE,
  data_alvo     DATE NOT NULL,
  concluida     BOOLEAN DEFAULT false,
  criado_em     TIMESTAMPTZ DEFAULT now(),
  UNIQUE (recorrente_id, data_alvo)
);

-- ── Financeiro ────────────────────────────────────────────────────────────────

CREATE TABLE bancos (
  id    UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome  TEXT NOT NULL,
  ordem INTEGER DEFAULT 0
);

CREATE TABLE caixa_snapshots (
  id       UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  data     DATE NOT NULL,
  banco_id UUID REFERENCES bancos(id) ON DELETE CASCADE,
  valor    NUMERIC NOT NULL,
  UNIQUE (data, banco_id)
);

CREATE TABLE faturas_cartoes (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cartao     TEXT NOT NULL UNIQUE,
  vencimento INTEGER NOT NULL
);

CREATE TABLE faturas (
  id     UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cartao TEXT NOT NULL,
  mes    TEXT NOT NULL,
  valor  NUMERIC DEFAULT 0,
  pago   BOOLEAN DEFAULT false,
  UNIQUE (cartao, mes)
);

CREATE TABLE fluxos_recorrentes (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo       TEXT NOT NULL,
  categoria  TEXT NOT NULL,
  descricao  TEXT NOT NULL,
  dia        INTEGER NOT NULL,
  valor      NUMERIC NOT NULL,
  inicio     TEXT NOT NULL,
  fim        TEXT,
  via_cartao BOOLEAN DEFAULT false,
  criado_em  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE recorrentes_pagamentos (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  recorrente_id UUID REFERENCES fluxos_recorrentes(id) ON DELETE CASCADE,
  mes           TEXT NOT NULL,
  pago          BOOLEAN DEFAULT false,
  criado_em     TIMESTAMPTZ DEFAULT now(),
  UNIQUE (recorrente_id, mes)
);

CREATE TABLE fluxos_pontuais (
  id        UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo      TEXT NOT NULL,
  categoria TEXT NOT NULL,
  descricao TEXT NOT NULL,
  dia       INTEGER NOT NULL,
  valor     NUMERIC NOT NULL,
  mes_alvo  TEXT NOT NULL,
  pago      BOOLEAN DEFAULT false,
  criado_em TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE gastos_variaveis (
  id        UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  mes       TEXT NOT NULL,
  dia       INTEGER NOT NULL,
  categoria TEXT NOT NULL,
  descricao TEXT NOT NULL,
  valor     NUMERIC NOT NULL,
  criado_em TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE orcamento (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  categoria    TEXT NOT NULL,
  teto         NUMERIC NOT NULL,
  mes_excecao  TEXT,
  UNIQUE (categoria, mes_excecao)
);

CREATE TABLE corretoras (
  id        UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome      TEXT NOT NULL,
  cor       TEXT DEFAULT '#94a3b8',
  criado_em TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE aportes (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  mes          TEXT NOT NULL,
  dia          INTEGER NOT NULL,
  classe       TEXT NOT NULL,
  ativo        TEXT NOT NULL,
  valor        NUMERIC NOT NULL,
  corretora_id UUID REFERENCES corretoras(id) ON DELETE SET NULL,
  criado_em    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE plano_investimento (
  id        UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo      TEXT NOT NULL,
  classe    TEXT NOT NULL,
  valor     NUMERIC NOT NULL,
  mes_alvo  TEXT
);

CREATE TABLE pessoas (
  id        UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome      TEXT NOT NULL,
  telefone  TEXT,
  criado_em TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE terceiros (
  id        UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pessoa    TEXT NOT NULL,
  direcao   TEXT DEFAULT 'a_receber',
  origem    TEXT DEFAULT 'pix',
  descricao TEXT NOT NULL,
  mes_alvo  TEXT NOT NULL,
  dia       INTEGER NOT NULL,
  valor     NUMERIC NOT NULL,
  recebido  BOOLEAN DEFAULT false,
  pago      BOOLEAN DEFAULT false,
  criado_em TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE dividas (
  id        UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  descricao TEXT NOT NULL,
  valor     NUMERIC NOT NULL,
  mes       TEXT NOT NULL,
  dia       INTEGER NOT NULL,
  pago      BOOLEAN DEFAULT false,
  criado_em TIMESTAMPTZ DEFAULT now()
);

-- ── Estudos ───────────────────────────────────────────────────────────────────

CREATE TABLE categorias_estudo (
  id        UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome      TEXT NOT NULL,
  emoji     TEXT DEFAULT '📚',
  ordem     INTEGER DEFAULT 0,
  criado_em TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE frentes_estudo (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  categoria_id UUID REFERENCES categorias_estudo(id) ON DELETE CASCADE,
  nome         TEXT NOT NULL,
  ordem        INTEGER DEFAULT 0,
  criado_em    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE itens_estudo (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  frente_id   UUID REFERENCES frentes_estudo(id) ON DELETE CASCADE,
  titulo      TEXT NOT NULL,
  tipo        TEXT DEFAULT 'Livro',
  obrigatorio BOOLEAN DEFAULT true,
  progresso   INTEGER DEFAULT 0 CHECK (progresso >= 0 AND progresso <= 100),
  concluido   BOOLEAN DEFAULT false,
  url         TEXT,
  notas       TEXT,
  ordem       INTEGER DEFAULT 0,
  criado_em   TIMESTAMPTZ DEFAULT now()
);

-- ── Saúde ─────────────────────────────────────────────────────────────────────

CREATE TABLE saude_perfil (
  id                 UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  idade              INTEGER,
  altura             NUMERIC,
  sexo               TEXT,
  fator_idx          INTEGER DEFAULT 2,
  deficit_kcal       INTEGER DEFAULT 300,
  meta_proteina_g_kg NUMERIC DEFAULT 2.0,
  meta_peso          NUMERIC,
  atualizado_em      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE peso_entries (
  id        UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  data      DATE NOT NULL,
  peso      NUMERIC NOT NULL,
  criado_em TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE dieta_entries (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  data        DATE NOT NULL,
  refeicao    TEXT NOT NULL,
  descricao   TEXT NOT NULL,
  calorias    NUMERIC,
  proteina    NUMERIC,
  carboidrato NUMERIC,
  gordura     NUMERIC,
  criado_em   TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE treino_entries (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  data           DATE NOT NULL,
  descricao      TEXT NOT NULL,
  gasto_calorico NUMERIC,
  criado_em      TIMESTAMPTZ DEFAULT now()
);

-- ── Lista de Compras ──────────────────────────────────────────────────────────

CREATE TABLE lista_compras (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome           TEXT NOT NULL,
  quantidade     NUMERIC DEFAULT 1,
  unidade        TEXT DEFAULT 'un',
  valor_esperado NUMERIC,
  categoria      TEXT,
  comprado       BOOLEAN DEFAULT false,
  tipo           TEXT DEFAULT 'mercado',
  criado_em      TIMESTAMPTZ DEFAULT now()
);

-- ── Agenda ────────────────────────────────────────────────────────────────────

CREATE TABLE agenda_eventos (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title       TEXT NOT NULL,
  start       TIMESTAMPTZ NOT NULL,
  "end"       TIMESTAMPTZ NOT NULL,
  description TEXT,
  criado_em   TIMESTAMPTZ DEFAULT now()
);
```

---

## Decisões de Arquitetura Notáveis

- **Sem RLS no Supabase:** toda a autorização é feita no backend Python via `verify_token`. A `service_role key` no backend tem acesso total ao banco, sem depender de Row Level Security.
- **Categorias de lista de compras via localStorage:** as categorias de mercado/desejos são gerenciadas no cliente (sem tabela no banco) para simplicidade operacional.
- **Ocorrências de recorrentes geradas on-demand:** o endpoint `GET /tarefas-recorrentes/ocorrencias?mes=` gera as ocorrências do mês solicitado ao ser chamado, usando `upsert` com `ignore_duplicates=true` para idempotência — nunca cria duplicatas.
- **Home como agregador único:** `GET /home/resumo` é o único endpoint que faz múltiplas queries em paralelo (tarefas, caixa, fluxos, faturas, dívidas, terceiros) e consolida tudo em uma resposta, evitando múltiplas requisições sequenciais na tela inicial.
- **Referências textuais para categorias:** a tabela `tarefas` guarda `categoria` como TEXT (não FK para `categorias`), permitindo que tarefas existentes não quebrem ao renomear/deletar uma categoria.
