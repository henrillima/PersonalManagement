# Life OS — Gestão Pessoal

Dashboard pessoal de gestão financeira, tarefas e saúde. Acesso autenticado, uso individual.

**Produção:** [personal-management-livid.vercel.app](https://personal-management-livid.vercel.app)

---

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Frontend | React 18 + TypeScript + Vite (SWC) + Tailwind + shadcn/ui |
| Backend | FastAPI (Python) + Uvicorn |
| Banco de dados | Supabase (PostgreSQL) |
| Auth | JWT (30 dias) + bcrypt |
| Deploy frontend | Vercel |
| Deploy backend | Render |

---

## Módulos

- **Home** — resumo do dia: saldo, tarefas da semana e próximas despesas
- **Tarefas** — matriz de execução com drag-and-drop vertical por categoria (Pessoal / Faculdade / Trabalho), status Kanban, engavetar e arquivar
- **Financeiro** — caixa por banco, faturas de cartão, fluxos recorrentes e pontuais, custo de vida, investimentos, terceiros e pendências
- **Saúde** — perfil, registro de peso, dieta com análise de macros via IA e treinos com estimativa de gasto calórico via IA
- **Lista de Compras** — itens com quantidade, unidade e valor esperado, agrupados por categoria

---

## Estrutura

```
├── backend/
│   ├── main.py
│   ├── auth.py
│   ├── database.py
│   ├── requirements.txt
│   ├── .env                  # não versionado
│   ├── .env.example
│   └── routers/
│       ├── auth_router.py
│       ├── home_router.py
│       ├── tarefas_router.py
│       ├── financeiro_router.py
│       ├── saude_router.py
│       └── lista_compras_router.py
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   ├── components/
│   │   ├── lib/
│   │   └── types/
│   ├── .env                  # não versionado
│   └── .env.example
└── supabase/
    └── schema.sql
```

---

## Rodar localmente

### Pré-requisitos

- Python 3.11+
- Node.js 18+
- Projeto no [Supabase](https://supabase.com) com `schema.sql` aplicado

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env            # preencher variáveis
python main.py
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env            # preencher VITE_API_BASE_URL
npm run dev
```

---

## Variáveis de ambiente

### `backend/.env`

```env
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_KEY=<service_role_key>
JWT_SECRET=<string_aleatoria_longa>
PASSWORD_HASH=<hash_bcrypt_da_senha>
ALLOWED_ORIGINS=http://localhost:5173
OPENAI_API_KEY=sk-...           # opcional — usado na página Saúde
```

### `frontend/.env`

```env
VITE_API_BASE_URL=http://localhost:8000
```

### Gerar o hash da senha

```bash
python -c "from passlib.context import CryptContext; print(CryptContext(schemes=['bcrypt']).hash('SUA_SENHA'))"
```

---

## Deploy

### Banco (Supabase)

Executar `supabase/schema.sql` no **SQL Editor** do projeto.

### Backend (Render)

1. Novo **Web Service** apontando para `/backend`
2. Build command: `pip install -r requirements.txt`
3. Start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
4. Adicionar todas as variáveis de `backend/.env` no painel **Environment**
5. `ALLOWED_ORIGINS` deve conter a URL do Vercel

### Frontend (Vercel)

1. Novo projeto apontando para `/frontend`
2. Em **Settings → Environment Variables** adicionar:
   - `VITE_API_BASE_URL` = URL do serviço no Render
3. Fazer redeploy após configurar a variável
