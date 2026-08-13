-- Palco da demonstração pública (NÃO é migration: roda sob demanda).
--
-- Cria o grupo Aurora (3 CNPJs com histórias diferentes) e o usuário
-- demo@financeai.app como VIEWER — o RBAC garante que visitante nenhum
-- escreve nada. Idempotente: apaga tudo com org DEMO-% e recria. Datas são
-- RELATIVAS a hoje, então os gráficos nunca envelhecem; re-rodar o script é
-- o "reset do palco".

DO $$
DECLARE
  v_demo uuid;
  v_dono uuid;
  v_emp record;
  v_company uuid;
  v_conta_receita uuid;
  v_conta_custo uuid;
  v_conta_despesa uuid;
  v_cc uuid;
  v_prod uuid;
  v_contato uuid;
  v_contato2 uuid;
  v_ordem integer;
  v_mes integer;
  v_dia integer;
  v_base numeric;
  v_fator numeric;
  v_data date;
  v_matriz uuid;
  v_conn uuid;
  v_inv uuid;
  v_inv_canc uuid;
  v_inbound uuid;
  v_rec_parcial uuid;
  v_tx_parcial uuid;
  i integer;
BEGIN
  -- Limpa palco anterior (cascade leva members, transactions, tudo).
  DELETE FROM public.companies WHERE org_id LIKE 'DEMO-%';
  DELETE FROM auth.users WHERE email IN ('demo@financeai.app', 'dono-demo@financeai.app');

  -- Usuários: demo (login público, viewer) e dono fantasma (autor dos dados).
  v_demo := gen_random_uuid();
  v_dono := gen_random_uuid();
  INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, aud, role, instance_id, raw_app_meta_data, raw_user_meta_data, confirmation_token, recovery_token, email_change, email_change_token_new, email_change_token_current, phone_change, phone_change_token, reauthentication_token)
  VALUES
    (v_demo, 'demo@financeai.app', extensions.crypt('demo-financeai-2026', extensions.gen_salt('bf')), now(), now(), now(), 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000', '{"provider":"email","providers":["email"]}', '{"full_name":"Visitante da Demonstração"}', '', '', '', '', '', '', '', ''),
    (v_dono, 'dono-demo@financeai.app', extensions.crypt(gen_random_uuid()::text, extensions.gen_salt('bf')), now(), now(), now(), 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000', '{"provider":"email","providers":["email"]}', '{"full_name":"Aurora Group"}', '', '', '', '', '', '', '', '');

  -- Identities (login por senha exige identity em versões recentes do GoTrue).
  INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  VALUES
    (gen_random_uuid(), v_demo, v_demo::text, jsonb_build_object('sub', v_demo::text, 'email', 'demo@financeai.app', 'email_verified', true), 'email', now(), now(), now()),
    (gen_random_uuid(), v_dono, v_dono::text, jsonb_build_object('sub', v_dono::text, 'email', 'dono-demo@financeai.app', 'email_verified', true), 'email', now(), now(), now());

  -- 3 CNPJs com curvas diferentes: matriz estável, digital crescendo,
  -- varejo apertado (margem negativa em alguns meses).
  FOR v_emp IN SELECT * FROM (VALUES
    ('Aurora Holding (Matriz)',  '11222333000181', 'DEMO-MATRIZ',  'regular', 180000::numeric, 1.00::numeric),
    ('Aurora Digital',           '11222333000262', 'DEMO-DIGITAL', 'regular', 90000::numeric,  1.06::numeric),
    ('Aurora Varejo',            '11222333000343', 'DEMO-VAREJO',  'simples', 120000::numeric, 0.99::numeric)
  ) AS t(nome, cnpj, org, regime, base, tendencia) LOOP

    INSERT INTO public.companies (name, cnpj, org_id, regime_tributario, plan_key)
    VALUES (v_emp.nome, v_emp.cnpj, v_emp.org, v_emp.regime, 'pro')
    RETURNING id INTO v_company;
    IF v_emp.org = 'DEMO-MATRIZ' THEN v_matriz := v_company; END IF;

    INSERT INTO public.company_members (company_id, user_id, role, onboarding_completed)
    VALUES (v_company, v_demo, 'viewer', true), (v_company, v_dono, 'admin', true);

    -- Consolidação perfeita: group_code = code (o seed de contas é idêntico).
    UPDATE public.chart_of_accounts SET group_code = code, group_name = name WHERE company_id = v_company;

    SELECT id INTO v_conta_receita FROM public.chart_of_accounts WHERE company_id = v_company AND type = 'revenue' ORDER BY code LIMIT 1;
    SELECT id INTO v_conta_custo   FROM public.chart_of_accounts WHERE company_id = v_company AND code LIKE '4%' ORDER BY code LIMIT 1;
    SELECT id INTO v_conta_despesa FROM public.chart_of_accounts WHERE company_id = v_company AND code LIKE '5%' ORDER BY code LIMIT 1;
    SELECT id INTO v_cc FROM public.cost_centers WHERE company_id = v_company ORDER BY name LIMIT 1;

    -- Cliente e fornecedor de palco.
    INSERT INTO public.contacts (company_id, name, type, person_type, document, email, active)
    VALUES (v_company, 'Comercial Horizonte Ltda', 'customer', 'pj', '99888777000166', 'financeiro@horizonte.example', true)
    RETURNING id INTO v_contato;
    INSERT INTO public.contacts (company_id, name, type, person_type, active)
    VALUES (v_company, 'Fornecedora Andina SA', 'supplier', 'pj', true);

    -- 12 meses de lançamentos confirmados e classificados.
    FOR v_mes IN 0..11 LOOP
      v_fator := power(v_emp.tendencia, 11 - v_mes) * (1 + 0.05 * sin(v_mes * 1.7));
      v_base := v_emp.base * v_fator;
      FOR v_dia IN 1..4 LOOP
        v_data := (date_trunc('month', current_date) - make_interval(months => 11 - v_mes) + make_interval(days => v_dia * 6))::date;
        EXIT WHEN v_data > current_date;
        INSERT INTO public.transactions (company_id, user_id, date, description, amount, type, status, source, account_id, cost_center_id, contact_id)
        VALUES
          (v_company, v_dono, v_data, 'Faturamento de serviços · NF ' || (1000 + v_mes * 10 + v_dia), round(v_base * 0.25 * (0.9 + 0.2 * random())), 'revenue', 'confirmed', 'manual', v_conta_receita, v_cc, v_contato),
          (v_company, v_dono, v_data, 'Compra de insumos · pedido ' || (500 + v_mes * 10 + v_dia), round(v_base * 0.11 * (0.9 + 0.2 * random())), 'expense', 'confirmed', 'manual', v_conta_custo, v_cc, NULL);
      END LOOP;
      v_data := (date_trunc('month', current_date) - make_interval(months => 11 - v_mes) + make_interval(days => 5))::date;
      IF v_data <= current_date THEN
        INSERT INTO public.transactions (company_id, user_id, date, description, amount, type, status, source, account_id, cost_center_id)
        VALUES
          (v_company, v_dono, v_data, 'Folha e pró-labore', round(v_base * 0.22), 'expense', 'confirmed', 'manual', v_conta_despesa, v_cc),
          (v_company, v_dono, v_data, 'Aluguel e utilidades', round(v_base * 0.08), 'expense', 'confirmed', 'manual', v_conta_despesa, v_cc);
      END IF;
    END LOOP;

    -- Recebíveis: um de cada status para acender aging e inadimplência com cor.
    -- due_date = current_date + (i*9 - 18): i=1 vencido, i=2 recebido, i=3/4 em aberto.
    FOR i IN 1..4 LOOP
      INSERT INTO public.receivables (company_id, description, amount, due_date, status, source, contact_id)
      VALUES (v_company, 'Fatura mensal ' || i || ' · Horizonte', round(v_emp.base * 0.08),
        current_date + (i * 9 - 18),
        CASE i WHEN 1 THEN 'vencido' WHEN 2 THEN 'recebido' ELSE 'a_receber' END,
        'manual', v_contato);
    END LOOP;

    -- Contas a pagar chegando (radar aceso).
    INSERT INTO public.bills_payable (company_id, fornecedor, descricao, valor, vencimento, status, source)
    VALUES
      (v_company, 'Fornecedora Andina SA', 'Duplicata de insumos', round(v_emp.base * 0.10), current_date + 4, 'pendente', 'manual'),
      (v_company, 'Imobiliária Central', 'Aluguel do mês', round(v_emp.base * 0.07), current_date + 9, 'pendente', 'manual'),
      (v_company, 'Energia Elétrica SA', 'Conta de energia', round(v_emp.base * 0.02), current_date - 3, 'pendente', 'manual');

    -- Contratos recorrentes (MRR no cockpit).
    INSERT INTO public.contracts (company_id, description, amount, cycle, status, billing_day, payment_method, start_date, contact_id, account_id)
    VALUES
      (v_company, 'Contrato de manutenção mensal', round(v_emp.base * 0.06), 'MONTHLY', 'active', 5, 'PIX', current_date - 200, v_contato, v_conta_receita),
      (v_company, 'Suporte premium', round(v_emp.base * 0.03), 'MONTHLY', 'active', 12, 'BOLETO', current_date - 90, v_contato, v_conta_receita);

    -- Impostos próximos.
    INSERT INTO public.tax_guides (company_id, tipo, competencia, valor, vencimento, status, source)
    VALUES (v_company, 'DAS', to_char(current_date - 28, 'YYYY-MM'), round(v_emp.base * 0.05), current_date + 12, 'pendente', 'manual');

    -- Produtos com estoque e NCM (PDV pronto).
    FOR i IN 1..4 LOOP
      INSERT INTO public.products (company_id, name, sku, barcode, sell_price, cost_price, track_stock, current_stock, min_stock, ncm, cfop, type, active, account_id)
      VALUES (v_company, 'Produto Aurora ' || chr(64 + i), 'AUR-' || i, '78910000000' || i, 40 + i * 15, 18 + i * 6, true, 8 + i * 7, 5, '85171231', '5102', 'product', true, v_conta_receita)
      RETURNING id INTO v_prod;
    END LOOP;

    -- Vendas avulsas repetidas → cadência de recompra (v_recompra_clientes).
    -- Horizonte compra a cada ~30 dias e está ATRASADO (última há 40 dias);
    -- Padaria Aurora está PREVISTO (última há 26 dias, mesmo ritmo).
    v_ordem := 0;
    INSERT INTO public.contacts (company_id, name, type, person_type, active)
    VALUES (v_company, 'Padaria Aurora', 'customer', 'pj', true)
    RETURNING id INTO v_contato2;

    FOR i IN 0..5 LOOP
      v_ordem := v_ordem + 1;
      INSERT INTO public.sales_orders (company_id, contact_id, user_id, order_number, status, issue_date, total)
      VALUES (v_company, v_contato, v_dono, v_ordem, 'invoiced',
        current_date - (40 + (5 - i) * 30), round(v_emp.base * 0.04 * (0.9 + 0.2 * random())));
    END LOOP;
    FOR i IN 0..4 LOOP
      v_ordem := v_ordem + 1;
      INSERT INTO public.sales_orders (company_id, contact_id, user_id, order_number, status, issue_date, total)
      VALUES (v_company, v_contato2, v_dono, v_ordem, 'invoiced',
        current_date - (26 + (4 - i) * 30), round(v_emp.base * 0.03 * (0.9 + 0.2 * random())));
    END LOOP;

    -- Metas: uma batida (receita), uma em risco (inadimplência).
    INSERT INTO public.kpi_metas (company_id, metric_key, alvo, direcao)
    VALUES (v_company, 'receita_mes', round(v_emp.base * 0.7), 'acima'),
           (v_company, 'inadimplencia', 5, 'abaixo');

    -- Agentes ativos + avisos no sino.
    INSERT INTO public.agent_instances (company_id, template_key, nome, ativo, config, canais, last_run_at, last_result)
    VALUES
      (v_company, 'caixa_baixo', 'Vigia de Caixa', true, '{"limite": 20000}', '{"inapp": true, "whatsapp": false}', now() - interval '3 hours', '{"avisos": 1, "enviados": 1}'),
      (v_company, 'contas_a_vencer', 'Sentinela de Contas', true, '{"dias": 3}', '{"inapp": true, "whatsapp": false}', now() - interval '3 hours', '{"avisos": 1, "enviados": 1}');
    INSERT INTO public.notifications (company_id, titulo, corpo, categoria, link, lida, dedupe_key)
    VALUES
      (v_company, 'Contas vencendo', '2 conta(s) somando R$ ' || round(v_emp.base * 0.17)::text || ' vencem em até 3 dia(s). Maior: Fornecedora Andina SA.', 'agente', '/fiscal/contas-a-pagar', false, 'demo:contas'),
      (v_company, 'Meta batida: Receita do mês', 'A receita já passou o alvo definido no cockpit.', 'agente', '/dashboard', false, 'demo:meta');

    -- Visões de BI prontas.
    INSERT INTO public.dashboard_widgets (company_id, user_id, titulo, config, posicao)
    VALUES
      (v_company, v_dono, 'Receita dos últimos 12 meses', '{"metrica": "receita", "dimensao": "tempo", "tipo": "area", "meses": 12}', 0),
      (v_company, v_dono, 'Contas a pagar por vencimento', '{"metrica": "pagar_vencimento", "dimensao": "tempo", "tipo": "bar", "meses": 12}', 1);

    -- ── Vitrine fiscal (alimenta o tour do demo com as melhorias reais) ───────
    -- 1) Venda com NF-e PARCELADA: nota autorizada com 2 duplicatas. O trigger
    --    gerar_receivable_da_nota abre 2 parcelas a receber, com vencimento,
    --    conta de receita e valor LÍQUIDO de retenções (não digitamos nada aqui).
    INSERT INTO public.invoices (company_id, contact_id, type, status, number, issue_date,
                                 total, valor_liquido, valor_retencoes, chave_acesso, duplicatas)
    VALUES (v_company, v_contato, 'nfse', 'authorized', '2001', current_date - 3,
            round(v_emp.base * 0.120), round(v_emp.base * 0.114), round(v_emp.base * 0.006),
            'DEMO-' || v_emp.org || '-VENDA-PARC',
            jsonb_build_array(
              jsonb_build_object('numero','1','vencimento', to_char(current_date + 12,'YYYY-MM-DD'), 'valor', round(v_emp.base * 0.057)),
              jsonb_build_object('numero','2','vencimento', to_char(current_date + 42,'YYYY-MM-DD'), 'valor', round(v_emp.base * 0.057))
            ))
    RETURNING id INTO v_inv;

    -- 2) Nota CANCELADA: autorizada e depois cancelada. O trigger
    --    estornar_receivable_nota_cancelada baixa o recebível em aberto para
    --    'cancelado' (não deixa número fantasma inflando o vencido).
    INSERT INTO public.invoices (company_id, contact_id, type, status, number, issue_date,
                                 total, chave_acesso)
    VALUES (v_company, v_contato, 'nfse', 'authorized', '2002', current_date - 6,
            round(v_emp.base * 0.05), 'DEMO-' || v_emp.org || '-CANCELADA')
    RETURNING id INTO v_inv_canc;
    UPDATE public.invoices
       SET status = 'cancelled',
           nfse_evento_xml = '<evento tipo="101101">Cancelamento demonstrativo</evento>'
     WHERE id = v_inv_canc;

    -- 3) Nota de ENTRADA (compra) com 2 duplicatas → 2 contas a pagar nas datas
    --    reais; Ciência da Operação (MDe) registrada com prazo.
    INSERT INTO public.inbound_documents (company_id, tipo, chave_acesso, numero, emitente_cnpj,
                                          emitente_nome, valor_total, data_emissao, status,
                                          duplicatas, valor_retencoes, manifestacao, manifestacao_at)
    VALUES (v_company, 'nfe', 'DEMO-' || v_emp.org || '-ENTRADA', '7050', '99888777000166',
            'Fornecedora Andina SA', round(v_emp.base * 0.09), current_date - 4, 'lancado',
            jsonb_build_array(
              jsonb_build_object('vencimento', to_char(current_date + 6,'YYYY-MM-DD'), 'valor', round(v_emp.base * 0.045)),
              jsonb_build_object('vencimento', to_char(current_date + 36,'YYYY-MM-DD'), 'valor', round(v_emp.base * 0.045))
            ), round(v_emp.base * 0.002), 'ciencia', now() - interval '1 day')
    RETURNING id INTO v_inbound;
    INSERT INTO public.bills_payable (company_id, contact_id, fornecedor, descricao, valor, vencimento, status, source, external_id)
    VALUES
      (v_company, NULL, 'Fornecedora Andina SA', 'NFE nº 7050 · parcela 1/2', round(v_emp.base * 0.045), current_date + 6, 'a_vencer', 'nota_fiscal', 'DEMO-' || v_emp.org || '-ENTRADA-p1'),
      (v_company, NULL, 'Fornecedora Andina SA', 'NFE nº 7050 · parcela 2/2', round(v_emp.base * 0.045), current_date + 36, 'a_vencer', 'nota_fiscal', 'DEMO-' || v_emp.org || '-ENTRADA-p2');
    UPDATE public.inbound_documents
       SET bill_id = (SELECT id FROM public.bills_payable WHERE company_id = v_company AND external_id = 'DEMO-' || v_emp.org || '-ENTRADA-p1' LIMIT 1)
     WHERE id = v_inbound;

    -- 4) Recebível com BAIXA PARCIAL: um crédito real do extrato abateu parte do
    --    título, deixando saldo, via o RPC atômico aplicar_baixa_titulo.
    INSERT INTO public.receivables (company_id, contact_id, description, amount, due_date, status, source, account_id)
    VALUES (v_company, v_contato, 'Fatura Horizonte (recebida em parte)', round(v_emp.base * 0.10), current_date + 7, 'a_receber', 'manual', v_conta_receita)
    RETURNING id INTO v_rec_parcial;
    INSERT INTO public.transactions (company_id, user_id, date, description, amount, type, status, source, contact_id)
    VALUES (v_company, v_dono, current_date - 1, 'PIX recebido Horizonte (parcial)', round(v_emp.base * 0.06), 'revenue', 'confirmed', 'openfinance', v_contato)
    RETURNING id INTO v_tx_parcial;
    PERFORM public.aplicar_baixa_titulo('receivable', v_rec_parcial, v_tx_parcial, round(v_emp.base * 0.06), current_date - 1);

    -- 5) NFS-e CONFIGURADA (o certificado fica no cofre; a tela mostra
    --    "configurado" via cert_cnpj, sem o segredo trafegar para o navegador).
    INSERT INTO public.nfse_config (company_id, active, ambiente, cert_cnpj, cert_razao_social,
                                    cert_expires_at, nfse_via, worker_url, serie_dps, proximo_numero_dps,
                                    codigo_municipio, optante_simples, prazo_recebimento_dias, setup_step)
    VALUES (v_company, true, 'homologacao', v_emp.cnpj, v_emp.nome,
            current_date + 300, 'worker_proprio', 'https://worker-demo.aurora.example', '1', 3,
            '4205407', (v_emp.regime = 'simples'), 30, 6);
  END LOOP;

  -- A Caixa de entrada bancária nasce viva na MATRIZ: conexão fictícia e
  -- staging esperando a revisão (a IA classifica ao abrir a tela).
  INSERT INTO public.bank_connections (company_id, provider, external_id, institution_name, status, last_synced_at)
  VALUES (v_matriz, 'pluggy', 'demo-item-aurora', 'Banco Aurora S.A.', 'updated', now() - interval '2 hours')
  RETURNING id INTO v_conn;
  FOR i IN 1..12 LOOP
    INSERT INTO public.bank_transactions_raw (company_id, connection_id, provider, external_id, account_external_id, date, description, amount, direction, status, raw)
    VALUES (
      v_matriz, v_conn, 'pluggy', 'demo-raw-' || i, 'demo-acc',
      current_date - (i % 6),
      (ARRAY['PIX RECEBIDO HORIZONTE LTDA', 'TED FORNECEDORA ANDINA', 'PAGAMENTO ENERGIA ELETRICA', 'PIX RECEBIDO CLIENTE BALCAO', 'TARIFA BANCARIA', 'RECEBIMENTO CARTAO LOTE'])[1 + (i % 6)],
      round((500 + i * 137.9)::numeric, 2),
      CASE WHEN i % 3 = 0 THEN 'expense' ELSE 'revenue' END,
      'new', '{}'
    );
  END LOOP;

  RAISE NOTICE 'Palco DEMO recriado: 3 CNPJs Aurora, demo@financeai.app viewer.';
END $$;

-- Reregistra a vitrine como pertencente a ESTE cluster. Sem isto, um seed novo
-- criaria empresas que a limpeza de remix não conhece — e elas viajariam para o
-- banco de quem remixar. Ver 20260801190000_demonstracao_so_no_original.sql.
SELECT public.registrar_demonstracao();
