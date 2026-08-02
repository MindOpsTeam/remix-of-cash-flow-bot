-- Camada de demonstração do repasse de gateway.
--
-- Sem isso a tela de Repasses só sabe dizer "nada aqui", e o ponto mais difícil
-- do produto — a conciliação N:1 da maquininha — fica invisível na demo. Aqui o
-- lote existe de verdade: vendas no cartão, taxa de cada uma, e UM crédito no
-- extrato pelo líquido, esperando conciliação.
--
-- Os valores são os do Stripe Brasil (3,99% + R$ 0,39), então a conta que a tela
-- mostra é a conta que o cliente veria: R$ 1.847,00 de vendas viram R$ 1.771,74
-- creditados, e R$ 75,26 de taxa que precisam aparecer como despesa.
--
-- Três estados de propósito, porque a demo tem que mostrar o guarda-corpo e não
-- só o caminho feliz:
--   1. lote que fecha e tem crédito no extrato  → concilia de primeira;
--   2. lote que fecha e ainda não tem crédito   → "nenhum crédito no extrato";
--   3. lote que NÃO fecha (falta cobrança)      → conciliação bloqueada, com o
--      tamanho exato do buraco. É o caso que protege de dar baixa errada.
--
-- Data de hoje de propósito: lançar a taxa em mês fechado é barrado pelo gatilho
-- (proteção legítima), e a demo precisa poder ser conciliada.
--
-- Idempotente: rodar de novo não duplica nada.

DO $$
DECLARE
  e record;
  c record;
  v_chegada date := CURRENT_DATE;
  v_conta_taxa uuid; v_centro uuid; v_conn uuid; v_config uuid;
  v_bruto int; v_taxa int; v_liquido int; v_itens int; v_fee int;
BEGIN
  FOR e IN
    SELECT * FROM (VALUES
      -- empresa,                                    prefixo,   com_credito, fecha
      ('f07aa815-13e3-4374-b66b-71e0aad43415'::uuid, 'varejo',  true,  true),
      ('6e60116e-515f-4422-89cd-767151781a25'::uuid, 'digital', true,  true),
      ('6e60116e-515f-4422-89cd-767151781a25'::uuid, 'aberto',  false, false)
    ) AS t(empresa, prefixo, com_credito, fecha)
  LOOP
    SELECT id INTO v_conta_taxa FROM public.chart_of_accounts
     WHERE company_id = e.empresa AND code = '4.3' LIMIT 1;
    SELECT id INTO v_centro FROM public.cost_centers
     WHERE company_id = e.empresa ORDER BY name LIMIT 1;
    SELECT id INTO v_conn FROM public.bank_connections
     WHERE company_id = e.empresa LIMIT 1;

    -- Configuração sem segredo: a demo mostra o fluxo, não empresta credencial.
    -- Sincronizar continua exigindo chave de verdade.
    -- O conflito é por (empresa, apelido): a empresa pode ter N canais.
    INSERT INTO public.stripe_config (company_id, apelido, mode, secret_key_preview, publishable_key,
                                      webhook_configurado, conta_taxa_id, centro_custo_taxa_id)
    VALUES (e.empresa, 'Principal', 'test', '••••demo', 'pk_test_demonstracao', true, v_conta_taxa, v_centro)
    ON CONFLICT (company_id, apelido) DO UPDATE
      SET conta_taxa_id = EXCLUDED.conta_taxa_id,
          centro_custo_taxa_id = EXCLUDED.centro_custo_taxa_id
    RETURNING id INTO v_config;

    v_bruto := 0; v_taxa := 0; v_liquido := 0; v_itens := 0;

    FOR c IN
      SELECT * FROM (VALUES
        (1, 'Venda balcão — cartão de crédito',  'marcos.tavares@exemplo.com.br',  62900),
        (2, 'Venda balcão — cartão de débito',   'renata.lopes@exemplo.com.br',    31500),
        (3, 'Pedido online #1042 — crédito 2x',  'joao.ferreira@exemplo.com.br',   74800),
        (4, 'Venda balcão — cartão de crédito',  'claudia.nunes@exemplo.com.br',   15500)
      ) AS t(n, descricao, email, bruto)
    LOOP
      v_fee := round(c.bruto * 0.0399) + 39;

      INSERT INTO public.stripe_charges (
        company_id, config_id, stripe_id, balance_transaction_id, payout_id, status,
        amount_bruto, amount_taxa, amount_liquido, currency, description, customer_email, paid_at
      ) VALUES (
        e.empresa, v_config, format('ch_demo_%s_%s', e.prefixo, c.n), format('txn_demo_%s_%s', e.prefixo, c.n),
        format('po_demo_%s', e.prefixo), 'succeeded',
        c.bruto, v_fee, c.bruto - v_fee, 'brl', c.descricao, c.email,
        (v_chegada - INTERVAL '3 days')::timestamptz
      )
      ON CONFLICT (config_id, stripe_id) DO UPDATE
        SET payout_id = EXCLUDED.payout_id,
            amount_taxa = EXCLUDED.amount_taxa,
            amount_liquido = EXCLUDED.amount_liquido;

      v_bruto := v_bruto + c.bruto;
      v_taxa := v_taxa + v_fee;
      v_liquido := v_liquido + (c.bruto - v_fee);
      v_itens := v_itens + 1;
    END LOOP;

    -- No lote que não fecha, o repasse diz ter depositado MAIS do que a soma das
    -- cobranças conhecidas: falta uma. É o sintoma real de página não lida ou
    -- estorno posterior, e a conciliação tem que parar diante dele.
    INSERT INTO public.stripe_payouts (
      company_id, config_id, stripe_id, status, amount_liquido, amount_bruto, amount_taxa,
      itens, currency, arrival_date, composicao_fecha, diferenca
    ) VALUES (
      e.empresa, v_config, format('po_demo_%s', e.prefixo), 'paid',
      CASE WHEN e.fecha THEN v_liquido ELSE v_liquido + 48350 END,
      v_bruto, v_taxa, v_itens, 'brl', v_chegada,
      e.fecha, CASE WHEN e.fecha THEN 0 ELSE 48350 END
    )
    ON CONFLICT (config_id, stripe_id) DO UPDATE
      SET amount_liquido = EXCLUDED.amount_liquido,
          amount_bruto = EXCLUDED.amount_bruto,
          amount_taxa = EXCLUDED.amount_taxa,
          itens = EXCLUDED.itens,
          arrival_date = EXCLUDED.arrival_date,
          composicao_fecha = EXCLUDED.composicao_fecha,
          diferenca = EXCLUDED.diferenca;

    -- A linha do extrato: o depósito que a conciliação comum nunca casaria,
    -- porque o valor não corresponde a venda nenhuma — é a soma líquida de várias.
    IF e.com_credito THEN
      INSERT INTO public.bank_transactions_raw (
        company_id, connection_id, provider, external_id, date, description,
        amount, direction, payment_method, status
      ) VALUES (
        e.empresa, v_conn, 'pluggy', format('raw_demo_repasse_%s', e.prefixo), v_chegada,
        'STRIPE PAGAMENTOS - REPASSE', (v_liquido::numeric / 100), 'revenue', 'transfer', 'new'
      )
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;
END $$;

-- Reregistra a vitrine como pertencente a ESTE cluster. Sem isto, um seed novo
-- criaria empresas que a limpeza de remix não conhece — e elas viajariam para o
-- banco de quem remixar. Ver 20260801190000_demonstracao_so_no_original.sql.
SELECT public.registrar_demonstracao();
