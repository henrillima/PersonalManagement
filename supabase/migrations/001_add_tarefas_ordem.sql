-- Ordenação manual dos cards dentro de cada coluna do Kanban.
-- Rode quando quiser habilitar drag-and-drop com posição persistida.
ALTER TABLE tarefas
  ADD COLUMN IF NOT EXISTS ordem INT NOT NULL DEFAULT 0;
