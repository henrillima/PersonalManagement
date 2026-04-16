-- Meta de peso corporal no perfil para exibir progresso percentual.
ALTER TABLE saude_perfil
  ADD COLUMN IF NOT EXISTS peso_meta NUMERIC(5,2);
