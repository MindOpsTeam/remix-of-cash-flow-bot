-- Nota cancelada nao pode cancelar titulo que JA RECEBEU dinheiro.
--
-- O DEFEITO
-- O filtro so olhava `transaction_id IS NULL`. Numa baixa PARCIAL, o
-- transaction_id continua nulo: `aplicar_baixa_titulo` escreve em
-- `title_payments` e em `valor_baixado`, e o titulo segue 'a_receber'. Entao
-- cancelar a nota zerava um titulo com dinheiro ja no caixa, sem estornar nada.
-- O valor recebido virava orfao e a conciliacao passava a nunca fechar.
CREATE OR REPLACE FUNCTION public.estornar_receivable_nota_cancelada()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status = 'cancelled' AND NEW.status IS DISTINCT FROM OLD.status THEN
    UPDATE receivables
       SET status = 'cancelado', updated_at = now()
     WHERE invoice_id = NEW.id
       AND status IN ('a_receber','vencido')
       AND transaction_id IS NULL
       AND coalesce(valor_baixado, 0) = 0;
  END IF;
  RETURN NEW;
END; $$;

REVOKE EXECUTE ON FUNCTION public.estornar_receivable_nota_cancelada() FROM PUBLIC, anon, authenticated;
