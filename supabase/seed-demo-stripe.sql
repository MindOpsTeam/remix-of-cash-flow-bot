-- Camada de demonstração do repasse de gateway (Aurora Varejo).
--
-- Sem isso a tela de Repasses só sabe dizer "nada aqui", e o ponto mais difícil
-- do produto — a conciliação N:1 da maquininha — fica invisível na demo. Aqui o
-- lote existe de verdade: 4 vendas no cartão, taxa de cada uma, e UM crédito no
-- extrato pelo líquido, esperando conciliação.
--
-- Os valores são os do Stripe Brasil (3,99% + R$ 0,39), então a conta que a tela
-- mostra é a conta que o cliente veria: R$ 1.847,00 de vendas viram R$ 1.771,74
-- na conta, e R$ 75,26 de taxa que precisam aparecer como despesa.
--
-- Idempotente: rodar de novo não duplica nada.

DO $$
DECLARE
  v_empresa uuid := 'f07aa815-13e3-4374-b66b-71e0aad43415';   -- Aurora Varejo
  v_conta_taxa uuid;
  v_centro uuid;
  v_conn uuid;
  v_payout text := 'po_demo_aurora_varejo';
  -- Data de hoje de propósito: o lançamento da taxa é barrado em mês fechado
  -- (proteção legítima do sistema), e a demo precisa poder ser conciliada.
  v_chegada date := CURRENT_DATE;
  v_bruto int := 0;
  v_taxa int := 0;
  v_liquido int := 0;
  v_itens int := 0;
  c record;
BEGIN
  SELECT id INTO v_conta_taxa FROM public.chart_of_accounts
   WHERE company_id = v_empresa AND code = '4.3' LIMIT 1;
  SELECT id INTO v_centro FROM public.cost_centers
   WHERE company_id = v_empresa ORDER BY name LIMIT 1;
  SELECT id INTO v_conn FROM public.bank_connections
   WHERE company_id = v_empresa LIMIT 1;

  -- Configuração sem segredo: a demo mostra o fluxo, não empresta credencial.
  -- O preview é fictício de propósito; sincronizar exige chave de verdade.
  INSERT INTO public.stripe_config (company_id, mode, secret_key_preview, publishable_key,
                                    webhook_configurado, conta_taxa_id, centro_custo_taxa_id)
  VALUES (v_empresa, 'test', '••••demo', 'pk_test_demonstracao', true, v_conta_taxa, v_centro)
  ON CONFLICT (company_id) DO UPDATE
    SET conta_taxa_id = EXCLUDED.conta_taxa_id,
        centro_custo_taxa_id = EXCLUDED.centro_custo_taxa_id;

  -- As 4 vendas do lote. Taxa = 3,99% + R$ 0,39, arredondada ao centavo.
  FOR c IN
    SELECT * FROM (VALUES
      ('ch_demo_1', 'Venda balcão — cartão de crédito',  'marcos.tavares@exemplo.com.br',  62900),
      ('ch_demo_2', 'Venda balcão — cartão de débito',   'renata.lopes@exemplo.com.br',    31500),
      ('ch_demo_3', 'Pedido online #1042 — crédito 2x',  'joao.ferreira@exemplo.com.br',   74800),
      ('ch_demo_4', 'Venda balcão — cartão de crédito',  'claudia.nunes@exemplo.com.br',   15500)
    ) AS t(sid, descricao, email, bruto)
  LOOP
    DECLARE
      v_fee int := round(c.bruto * 0.0399) + 39;
    BEGIN
      INSERT INTO public.stripe_charges (
        company_id, stripe_id, balance_transaction_id, payout_id, status,
        amount_bruto, amount_taxa, amount_liquido, currency, description,
        customer_email, paid_at
      ) VALUES (
        v_empresa, c.sid, 'txn_' || c.sid, v_payout, 'succeeded',
        c.bruto, v_fee, c.bruto - v_fee, 'brl', c.descricao,
        c.email, (v_chegada - INTERVAL '3 days')::timestamptz
      )
      ON CONFLICT (company_id, stripe_id) DO UPDATE
        SET payout_id = EXCLUDED.payout_id,
            amount_taxa = EXCLUDED.amount_taxa,
            amount_liquido = EXCLUDED.amount_liquido;

      v_bruto := v_bruto + c.bruto;
      v_taxa := v_taxa + v_fee;
      v_liquido := v_liquido + (c.bruto - v_fee);
      v_itens := v_itens + 1;
    END;
  END LOOP;

  -- O repasse: um crédito só, pelo líquido, com a composição fechando exata.
  INSERT INTO public.stripe_payouts (
    company_id, stripe_id, status, amount_liquido, amount_bruto, amount_taxa,
    itens, currency, arrival_date, composicao_fecha, diferenca
  ) VALUES (
    v_empresa, v_payout, 'paid', v_liquido, v_bruto, v_taxa,
    v_itens, 'brl', v_chegada, true, 0
  )
  ON CONFLICT (company_id, stripe_id) DO UPDATE
    SET amount_liquido = EXCLUDED.amount_liquido,
        amount_bruto = EXCLUDED.amount_bruto,
        amount_taxa = EXCLUDED.amount_taxa,
        itens = EXCLUDED.itens,
        arrival_date = EXCLUDED.arrival_date,
        composicao_fecha = true,
        diferenca = 0;

  -- E a linha do extrato: o depósito que a conciliação comum nunca casaria,
  -- porque o valor não bate com venda nenhuma — é a soma líquida de quatro.
  INSERT INTO public.bank_transactions_raw (
    company_id, connection_id, provider, external_id, date, description,
    amount, direction, payment_method, status
  ) VALUES (
    v_empresa, v_conn, 'pluggy', 'raw_demo_repasse_stripe', v_chegada,
    'STRIPE PAGAMENTOS - REPASSE', (v_liquido::numeric / 100), 'revenue', 'transfer', 'new'
  )
  ON CONFLICT DO NOTHING;

  RAISE NOTICE 'Repasse demo: % itens, bruto %, taxa %, liquido %',
    v_itens, v_bruto::numeric/100, v_taxa::numeric/100, v_liquido::numeric/100;
END $$;
