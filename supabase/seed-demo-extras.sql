-- Camada RICA do palco de demonstração (roda DEPOIS de seed-demo.sql).
--
-- O seed base cria o esqueleto: empresas, lançamentos, recebíveis, contratos.
-- Este arquivo enche o resto — sem ele a demo mostra tela vazia justamente
-- onde o cliente olha primeiro: caixa sem saldo, pedido sem itens, estoque
-- zerado, orçamento em branco, nenhum documento anexado.
--
-- Regra: demonstração fiel é demonstração CONFIGURADA. Empresa com cClassTrib
-- definida, mês fechado, competência preenchida e conta contábil CERTA para
-- cada despesa (aluguel em 5.4, folha em 5.2, insumo em 4.1) — coerente com a
-- doutrina que o próprio produto ensina em docs/CONTABILIDADE-BR.md.

-- ── 1. Saldo, depósito, vendedores, orçamento e fechamentos ────────────────
DO $$
DECLARE
  v_emp record; v_dono uuid; v_dep uuid; i integer; v_mes date;
  v_rec numeric; v_cus numeric; v_des numeric;
BEGIN
  SELECT id INTO v_dono FROM auth.users WHERE email = 'dono-demo@financeai.app';

  FOR v_emp IN
    SELECT c.id, c.org_id,
           CASE c.org_id WHEN 'DEMO-MATRIZ' THEN 180000 WHEN 'DEMO-DIGITAL' THEN 90000 ELSE 120000 END::numeric AS base
    FROM public.companies c WHERE c.org_id LIKE 'DEMO-%'
  LOOP
    -- Sem saldo, Caixa e Runway aparecem como "—" no cockpit.
    UPDATE public.bank_accounts
       SET balance = round(v_emp.base * 1.35), account_type = 'checking', last_synced_at = now() - interval '2 hours'
     WHERE company_id = v_emp.id;
    INSERT INTO public.bank_accounts (company_id, name, bank_name, account_type, balance, last_synced_at)
    VALUES (v_emp.id, 'Reserva • CDB liquidez diária', 'Banco Aurora S.A.', 'savings', round(v_emp.base * 0.9), now() - interval '2 hours');

    INSERT INTO public.warehouses (company_id, name, address, is_default, active)
    VALUES (v_emp.id, 'Depósito principal', 'Rua das Indústrias, 400', true, true)
    RETURNING id INTO v_dep;

    INSERT INTO public.salespeople (company_id, name, email, comissao_padrao, active)
    VALUES (v_emp.id, 'Marina Duarte', 'marina@aurora.example', 3.5, true),
           (v_emp.id, 'Rafael Nunes', 'rafael@aurora.example', 2.5, true);

    FOR i IN 0..11 LOOP
      v_mes := (date_trunc('year', current_date) + make_interval(months => i))::date;
      INSERT INTO public.budgets (company_id, month, receita, custos, despesas, notes)
      VALUES (v_emp.id, v_mes, round(v_emp.base * (0.95 + 0.02 * i)), round(v_emp.base * 0.40), round(v_emp.base * 0.33),
              CASE WHEN i = 0 THEN 'Orçamento aprovado na reunião de planejamento.' ELSE NULL END)
      ON CONFLICT (company_id, month) DO NOTHING;
    END LOOP;
  END LOOP;
END $$;

-- ── 2. Configuração fiscal e competência (antes de fechar mês!) ────────────
UPDATE public.companies SET cclasstrib_padrao = '000001', regime_apuracao = 'competencia'
WHERE org_id LIKE 'DEMO-%';

UPDATE public.products p
   SET cclasstrib = '000001', fiscal_origem = 'humano',
       fiscal_confirmado_em = now() - interval '20 days',
       fiscal_confirmado_por = (SELECT id FROM auth.users WHERE email = 'dono-demo@financeai.app')
FROM public.companies c WHERE c.id = p.company_id AND c.org_id LIKE 'DEMO-%';

UPDATE public.transactions t SET competencia_date = t.date
FROM public.companies c WHERE c.id = t.company_id AND c.org_id LIKE 'DEMO-%' AND t.competencia_date IS NULL;

-- ── 3. Conta contábil CERTA para cada despesa ──────────────────────────────
DO $$
DECLARE v_emp record; v_alvo record;
BEGIN
  FOR v_emp IN SELECT id FROM public.companies WHERE org_id LIKE 'DEMO-%' LOOP
    FOR v_alvo IN SELECT * FROM (VALUES
        ('Aluguel e utilidades%', '5.4'), ('Folha e pró-labore%', '5.2'), ('Compra de insumos%', '4.1')
      ) AS t(padrao, codigo)
    LOOP
      UPDATE public.transactions t
         SET account_id = (SELECT id FROM public.chart_of_accounts WHERE company_id = v_emp.id AND code = v_alvo.codigo LIMIT 1)
       WHERE t.company_id = v_emp.id AND t.description LIKE v_alvo.padrao;
    END LOOP;
  END LOOP;
END $$;

-- ── 4. Movimento do MÊS CORRENTE ───────────────────────────────────────────
-- O seed base só gera nos dias 6/12/18/24; rodando no dia 1 o mês nasce vazio
-- e o cockpit mostra receita zero. Aqui o mês corrente sempre tem movimento.
DO $$
DECLARE
  v_emp record; v_dono uuid; v_cr uuid; v_ccusto uuid; v_cdesp uuid; v_cc uuid; v_cli uuid;
  i integer; v_dias integer; v_data date;
BEGIN
  SELECT id INTO v_dono FROM auth.users WHERE email = 'dono-demo@financeai.app';
  v_dias := greatest(1, extract(day from current_date)::int);

  FOR v_emp IN
    SELECT id, org_id, CASE org_id WHEN 'DEMO-MATRIZ' THEN 180000 WHEN 'DEMO-DIGITAL' THEN 90000 ELSE 120000 END::numeric base
    FROM public.companies WHERE org_id LIKE 'DEMO-%'
  LOOP
    SELECT id INTO v_cr     FROM public.chart_of_accounts WHERE company_id=v_emp.id AND code='3.1' LIMIT 1;
    SELECT id INTO v_ccusto FROM public.chart_of_accounts WHERE company_id=v_emp.id AND code='4.1' LIMIT 1;
    SELECT id INTO v_cdesp  FROM public.chart_of_accounts WHERE company_id=v_emp.id AND code='5.4' LIMIT 1;
    SELECT id INTO v_cc     FROM public.cost_centers WHERE company_id=v_emp.id ORDER BY name LIMIT 1;
    SELECT id INTO v_cli    FROM public.contacts WHERE company_id=v_emp.id AND type='customer' ORDER BY name LIMIT 1;

    FOR i IN 1..4 LOOP
      v_data := date_trunc('month', current_date)::date + least(v_dias - 1, (i-1) * greatest(1, v_dias/4));
      INSERT INTO public.transactions (company_id,user_id,date,competencia_date,description,amount,type,status,source,account_id,cost_center_id,contact_id)
      VALUES (v_emp.id, v_dono, v_data, v_data, 'Faturamento de serviços · NF ' || (2000+i),
              round(v_emp.base * 0.22 * (0.9 + 0.2*random())), 'revenue','confirmed','manual', v_cr, v_cc, v_cli);
    END LOOP;
    FOR i IN 1..3 LOOP
      v_data := date_trunc('month', current_date)::date + least(v_dias - 1, (i-1) * greatest(1, v_dias/3));
      INSERT INTO public.transactions (company_id,user_id,date,competencia_date,description,amount,type,status,source,account_id,cost_center_id)
      VALUES (v_emp.id, v_dono, v_data, v_data,
              CASE i WHEN 1 THEN 'Compra de insumos · pedido 900' WHEN 2 THEN 'Folha e pró-labore' ELSE 'Aluguel e utilidades' END,
              round(v_emp.base * (CASE i WHEN 1 THEN 0.10 WHEN 2 THEN 0.20 ELSE 0.07 END)), 'expense','confirmed','manual',
              CASE i WHEN 1 THEN v_ccusto WHEN 2 THEN (SELECT id FROM public.chart_of_accounts WHERE company_id=v_emp.id AND code='5.2' LIMIT 1) ELSE v_cdesp END, v_cc);
    END LOOP;

    -- Inadimplência realista (~13%), não 33%.
    INSERT INTO public.receivables (company_id, description, amount, due_date, status, source, contact_id)
    SELECT v_emp.id, 'Fatura ' || g || ' · serviços do mês', round(v_emp.base*0.09), current_date + (g*7), 'a_receber','contrato', v_cli
    FROM generate_series(1,4) g;
  END LOOP;
END $$;

-- ── 5. Fechamento dos 3 meses anteriores (depois da competência) ───────────
DO $$
DECLARE v_emp record; v_dono uuid; i integer; v_mes date; v_rec numeric; v_cus numeric; v_des numeric;
BEGIN
  SELECT id INTO v_dono FROM auth.users WHERE email = 'dono-demo@financeai.app';
  FOR v_emp IN SELECT id FROM public.companies WHERE org_id LIKE 'DEMO-%' LOOP
    FOR i IN 1..3 LOOP
      v_mes := (date_trunc('month', current_date) - make_interval(months => i))::date;
      SELECT coalesce(sum(amount) FILTER (WHERE type='revenue'),0),
             coalesce(sum(amount) FILTER (WHERE type='expense' AND account_id IN (SELECT id FROM public.chart_of_accounts WHERE company_id=v_emp.id AND code LIKE '4%')),0),
             coalesce(sum(amount) FILTER (WHERE type='expense' AND account_id IN (SELECT id FROM public.chart_of_accounts WHERE company_id=v_emp.id AND code LIKE '5%')),0)
        INTO v_rec, v_cus, v_des
        FROM public.transactions
       WHERE company_id=v_emp.id AND status='confirmed' AND date_trunc('month', date)::date = v_mes;
      INSERT INTO public.monthly_close (company_id, month, status, snapshot, closed_at, closed_by)
      VALUES (v_emp.id, v_mes, 'closed',
        jsonb_build_object('receita',v_rec,'custos',v_cus,'despesas',v_des,'lucro_liquido',v_rec-v_cus-v_des,'regua','v_dre_linhas'),
        (v_mes + interval '1 month' + interval '5 days'), v_dono)
      ON CONFLICT (company_id, month) DO NOTHING;
    END LOOP;
  END LOOP;
END $$;

-- ── 6. Itens de pedido, compras, estoque e notas fiscais ───────────────────
DO $$
DECLARE
  v_emp record; v_dono uuid; v_dep uuid; v_forn uuid; v_ped record; v_prod record;
  v_ordem integer; v_po uuid; i integer; v_total numeric; v_qtd numeric; v_nf integer := 1000;
BEGIN
  SELECT id INTO v_dono FROM auth.users WHERE email='dono-demo@financeai.app';
  FOR v_emp IN SELECT id FROM public.companies WHERE org_id LIKE 'DEMO-%' LOOP
    SELECT id INTO v_dep  FROM public.warehouses WHERE company_id=v_emp.id LIMIT 1;
    SELECT id INTO v_forn FROM public.contacts WHERE company_id=v_emp.id AND type='supplier' LIMIT 1;

    FOR v_ped IN SELECT id FROM public.sales_orders WHERE company_id=v_emp.id LOOP
      v_ordem := 0;
      FOR v_prod IN SELECT id, name, sell_price FROM public.products WHERE company_id=v_emp.id ORDER BY sku LIMIT 3 LOOP
        v_ordem := v_ordem + 1; v_qtd := 1 + (v_ordem * 2);
        INSERT INTO public.sales_order_items (order_id, product_id, description, quantity, unit_price, discount_percent, total, sort_order)
        VALUES (v_ped.id, v_prod.id, v_prod.name, v_qtd, v_prod.sell_price, 0, round(v_qtd*v_prod.sell_price,2), v_ordem);
      END LOOP;
    END LOOP;

    FOR i IN 1..4 LOOP
      SELECT coalesce(max(order_number),0)+1 INTO v_ordem FROM public.purchase_orders WHERE company_id=v_emp.id;
      INSERT INTO public.purchase_orders (company_id, contact_id, user_id, order_number, status, issue_date, expected_date, subtotal, total, payment_terms, notes)
      VALUES (v_emp.id, v_forn, v_dono, v_ordem,
              CASE i WHEN 1 THEN 'received' WHEN 2 THEN 'received' WHEN 3 THEN 'confirmed' ELSE 'sent' END,
              current_date - (i*17), current_date - (i*17) + 10, 0, 0, 28, 'Reposição de insumos do mês')
      RETURNING id INTO v_po;
      v_total := 0; v_ordem := 0;
      FOR v_prod IN SELECT id, name, cost_price FROM public.products WHERE company_id=v_emp.id ORDER BY sku LIMIT 2 LOOP
        v_ordem := v_ordem + 1; v_qtd := 10 * v_ordem;
        INSERT INTO public.purchase_order_items (order_id, product_id, description, quantity, unit_price, total, sort_order)
        VALUES (v_po, v_prod.id, v_prod.name, v_qtd, v_prod.cost_price, round(v_qtd*v_prod.cost_price,2), v_ordem);
        v_total := v_total + round(v_qtd*v_prod.cost_price,2);
        IF i <= 2 THEN
          INSERT INTO public.stock_movements (company_id, product_id, warehouse_id, type, quantity, unit_cost, reference_type, reference_id, notes, user_id)
          VALUES (v_emp.id, v_prod.id, v_dep, 'in', v_qtd, v_prod.cost_price, 'purchase', v_po, 'Entrada por compra recebida', v_dono);
        END IF;
      END LOOP;
      UPDATE public.purchase_orders SET subtotal=v_total, total=v_total WHERE id=v_po;
    END LOOP;

    FOR v_prod IN SELECT id, cost_price FROM public.products WHERE company_id=v_emp.id ORDER BY sku LIMIT 3 LOOP
      INSERT INTO public.stock_movements (company_id, product_id, warehouse_id, type, quantity, unit_cost, reference_type, notes, user_id)
      VALUES (v_emp.id, v_prod.id, v_dep, 'out', -6, v_prod.cost_price, 'sale', 'Baixa por venda no balcão', v_dono);
    END LOOP;

    FOR v_ped IN SELECT id, contact_id, total, issue_date FROM public.sales_orders WHERE company_id=v_emp.id ORDER BY issue_date DESC LIMIT 5 LOOP
      v_nf := v_nf + 1;
      INSERT INTO public.invoices (company_id, contact_id, sales_order_id, type, status, number, series, access_key, issue_date, total, notes)
      VALUES (v_emp.id, v_ped.contact_id, v_ped.id, 'nfse', 'authorized', v_nf::text, '1',
              lpad((random()*10^10)::bigint::text, 44, '3'), v_ped.issue_date, v_ped.total, 'NFS-e autorizada pelo ambiente nacional');
    END LOOP;
  END LOOP;
END $$;

-- ── 7. Documento anexado, rateio, regras aprendidas e reajuste ─────────────
DO $$
DECLARE v_emp record; v_dono uuid; v_tx record; v_cc uuid; v_cc2 uuid; v_conta uuid; v_contrato record; v_svg text;
BEGIN
  SELECT id INTO v_dono FROM auth.users WHERE email='dono-demo@financeai.app';
  FOR v_emp IN SELECT id FROM public.companies WHERE org_id LIKE 'DEMO-%' LOOP
    SELECT id INTO v_cc  FROM public.cost_centers WHERE company_id=v_emp.id ORDER BY name LIMIT 1;
    SELECT id INTO v_cc2 FROM public.cost_centers WHERE company_id=v_emp.id ORDER BY name DESC LIMIT 1;

    -- Comprovante gerado como SVG embutido: aparece no modal sem depender de
    -- rede nem de storage.
    FOR v_tx IN SELECT id, description, amount, date FROM public.transactions
                WHERE company_id=v_emp.id AND status='confirmed' ORDER BY date DESC LIMIT 15 LOOP
      v_svg := '<svg xmlns="http://www.w3.org/2000/svg" width="420" height="260" viewBox="0 0 420 260">'
        || '<rect width="420" height="260" fill="#ffffff" stroke="#0A1F3B" stroke-width="2"/>'
        || '<rect x="0" y="0" width="420" height="44" fill="#0A1F3B"/>'
        || '<text x="16" y="28" font-family="Helvetica" font-size="15" fill="#ffffff">COMPROVANTE · Aurora</text>'
        || '<text x="16" y="78" font-family="Helvetica" font-size="12" fill="#5b6b7f">DESCRICAO</text>'
        || '<text x="16" y="98" font-family="Helvetica" font-size="14" fill="#0A1F3B">' || replace(replace(left(v_tx.description,38),'&','e'),'<','') || '</text>'
        || '<text x="16" y="136" font-family="Helvetica" font-size="12" fill="#5b6b7f">VALOR</text>'
        || '<text x="16" y="158" font-family="Helvetica" font-size="20" fill="#0A1F3B">R$ ' || to_char(v_tx.amount,'FM999G999G990D00') || '</text>'
        || '<text x="16" y="196" font-family="Helvetica" font-size="12" fill="#5b6b7f">DATA</text>'
        || '<text x="16" y="216" font-family="Helvetica" font-size="14" fill="#0A1F3B">' || to_char(v_tx.date,'DD/MM/YYYY') || '</text>'
        || '<text x="16" y="244" font-family="Helvetica" font-size="10" fill="#8b98a9">Documento de demonstracao</text></svg>';
      UPDATE public.transactions SET attachment_url = 'data:image/svg+xml;base64,' || encode(convert_to(v_svg,'UTF8'),'base64') WHERE id = v_tx.id;
    END LOOP;

    FOR v_tx IN SELECT id, amount FROM public.transactions
                WHERE company_id=v_emp.id AND type='expense' AND status='confirmed' ORDER BY date DESC LIMIT 4 LOOP
      INSERT INTO public.transaction_allocations (company_id, transaction_id, cost_center_id, percentual, valor)
      VALUES (v_emp.id, v_tx.id, v_cc, 60, round(v_tx.amount*0.6,2)),
             (v_emp.id, v_tx.id, v_cc2, 40, round(v_tx.amount - round(v_tx.amount*0.6,2),2));
    END LOOP;

    -- Regras aprendidas: mostram a IA ficando mais barata com o uso.
    SELECT id INTO v_conta FROM public.chart_of_accounts WHERE company_id=v_emp.id AND code='5.4' LIMIT 1;
    INSERT INTO public.classification_rules (company_id, padrao, account_id, cost_center_id, acertos, origem)
    VALUES (v_emp.id, 'ALUGUEL E UTILIDADES', v_conta, v_cc, 11, 'humano') ON CONFLICT DO NOTHING;
    SELECT id INTO v_conta FROM public.chart_of_accounts WHERE company_id=v_emp.id AND code='4.3' LIMIT 1;
    INSERT INTO public.classification_rules (company_id, padrao, account_id, cost_center_id, acertos, origem)
    VALUES (v_emp.id, 'RECEBIMENTO CARTAO LOTE', v_conta, v_cc2, 7, 'humano') ON CONFLICT DO NOTHING;
    SELECT id INTO v_conta FROM public.chart_of_accounts WHERE company_id=v_emp.id AND code='5.8' LIMIT 1;
    INSERT INTO public.classification_rules (company_id, padrao, account_id, cost_center_id, acertos, origem)
    VALUES (v_emp.id, 'TARIFA BANCARIA', v_conta, v_cc2, 9, 'semente') ON CONFLICT DO NOTHING;

    FOR v_contrato IN SELECT id, amount FROM public.contracts WHERE company_id=v_emp.id LOOP
      INSERT INTO public.contract_adjustments (company_id, contract_id, valor_anterior, valor_novo, percentual, indice, vigencia, aplicado_por)
      VALUES (v_emp.id, v_contrato.id, round(v_contrato.amount/1.045,2), v_contrato.amount, 4.5, 'ipca', current_date - 120, v_dono);
      UPDATE public.contracts SET ultimo_reajuste_em = current_date - 120, proximo_reajuste = current_date + 245,
             indice_reajuste = 'ipca', next_due_date = current_date + 12
       WHERE id = v_contrato.id;
    END LOOP;
  END LOOP;
END $$;

-- ── 8. Extrato bancário nas TRÊS empresas, com descrições reais ────────────
-- As descrições exercitam a doutrina contábil (DAS→5.7, FGTS→5.2,
-- maquininha→4.3, tarifa→5.8) e as armadilhas (transferência entre contas).
DO $$
DECLARE
  v_emp record; v_conn uuid; i integer; v_saida boolean;
  v_desc text[] := ARRAY[
    'PIX RECEBIDO COMERCIAL HORIZONTE LTDA','RECEBIMENTO CARTAO LOTE STONE','TARIFA MANUTENCAO DE CONTA',
    'PAGAMENTO DAS SIMPLES NACIONAL','GRF FGTS COMPETENCIA','PIX RECEBIDO PADARIA AURORA',
    'TED FORNECEDORA ANDINA SA','PAGAMENTO ENERGIA ELETRICA ENEL','ASSINATURA GOOGLE WORKSPACE',
    'IOF SOBRE OPERACAO DE CREDITO','PIX RECEBIDO CLIENTE BALCAO','ALUGUEL IMOVEL COMERCIAL',
    'TAXA ANTECIPACAO DE RECEBIVEL','HONORARIOS CONTABEIS','TRANSFERENCIA ENTRE CONTAS PROPRIAS',
    'RENDIMENTO APLICACAO CDB','FOLHA DE PAGAMENTO','ANUNCIO META ADS',
    'FRETE TRANSPORTADORA','PIX RECEBIDO MENSALIDADE CONTRATO'];
BEGIN
  FOR v_emp IN
    SELECT id, org_id, CASE org_id WHEN 'DEMO-MATRIZ' THEN 180000 WHEN 'DEMO-DIGITAL' THEN 90000 ELSE 120000 END::numeric base
    FROM public.companies WHERE org_id LIKE 'DEMO-%'
  LOOP
    SELECT id INTO v_conn FROM public.bank_connections WHERE company_id=v_emp.id LIMIT 1;
    IF v_conn IS NULL THEN
      INSERT INTO public.bank_connections (company_id, provider, external_id, institution_name, status, last_synced_at)
      VALUES (v_emp.id, 'pluggy', 'demo-item-'||v_emp.org_id, 'Banco Aurora S.A.', 'updated', now() - interval '2 hours')
      RETURNING id INTO v_conn;
    END IF;
    DELETE FROM public.bank_transactions_raw WHERE company_id=v_emp.id;
    FOR i IN 1..array_length(v_desc,1) LOOP
      v_saida := v_desc[i] !~ 'RECEBIDO|RENDIMENTO';
      INSERT INTO public.bank_transactions_raw
        (company_id, connection_id, provider, external_id, account_external_id, date, description, amount, direction, status, raw)
      VALUES (v_emp.id, v_conn, 'pluggy', 'demo-raw-'||v_emp.org_id||'-'||i, 'demo-acc',
              current_date - ((i % 12)), v_desc[i],
              round((v_emp.base * (0.012 + (i % 7) * 0.006))::numeric, 2),
              CASE WHEN v_saida THEN 'expense' ELSE 'revenue' END,
              CASE WHEN i <= 14 THEN 'new' ELSE 'imported' END,
              jsonb_build_object('descricao_original', v_desc[i], 'banco', 'Banco Aurora S.A.'));
    END LOOP;
  END LOOP;
END $$;

-- Reregistra a vitrine como pertencente a ESTE cluster. Sem isto, um seed novo
-- criaria empresas que a limpeza de remix não conhece — e elas viajariam para o
-- banco de quem remixar. Ver 20260801190000_demonstracao_so_no_original.sql.
SELECT public.registrar_demonstracao();
