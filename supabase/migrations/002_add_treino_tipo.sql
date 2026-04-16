-- Categorização do tipo de treino (musculação, cardio, mobilidade, etc.)
-- Permite filtrar e agrupar por tipo no histórico de treinos.
ALTER TABLE saude_treino
  ADD COLUMN IF NOT EXISTS tipo TEXT;
