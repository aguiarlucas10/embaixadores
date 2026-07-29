-- 0012_check_comissao_max.sql
-- Blindagem: nenhuma ferramenta pode gravar comissao acima de ~10% do pedido.
-- (11% de teto para absorver arredondamento; a taxa real e 10%.)
-- Contexto: em jul/2026 um import com "% de comissao" digitado errado gravou
-- comissoes de 20%. Este CHECK faz o banco rejeitar na hora.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'comissoes_max_pct'
  ) THEN
    ALTER TABLE comissoes
      ADD CONSTRAINT comissoes_max_pct
      CHECK (valor_comissao <= round(valor_pedido * 0.11, 2));
  END IF;
END$$;
