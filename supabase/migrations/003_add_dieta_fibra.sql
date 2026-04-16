-- Adiciona fibra alimentar como quinto macronutriente rastreado.
-- O prompt da OpenAI precisará ser atualizado para retornar a chave "fibra".
ALTER TABLE saude_dieta
  ADD COLUMN IF NOT EXISTS fibra NUMERIC(7,2);
