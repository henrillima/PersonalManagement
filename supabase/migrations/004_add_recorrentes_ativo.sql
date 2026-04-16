-- Flag para desativar um fluxo recorrente sem precisar deletar ou setar data de fim.
-- Mais intuitivo para pausar receitas/despesas temporariamente.
ALTER TABLE fluxos_recorrentes
  ADD COLUMN IF NOT EXISTS ativo BOOLEAN NOT NULL DEFAULT TRUE;
