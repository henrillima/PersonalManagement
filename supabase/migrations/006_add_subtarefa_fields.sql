-- Add descricao and observacao fields to subtarefas
ALTER TABLE subtarefas ADD COLUMN IF NOT EXISTS descricao TEXT;
ALTER TABLE subtarefas ADD COLUMN IF NOT EXISTS observacao TEXT;
