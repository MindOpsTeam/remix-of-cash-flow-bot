# Revisão adversarial da solução fiscal — achados e correções (2026-08-12)

Dois revisores independentes (um técnico, um de negócio/fiscal) varreram a solução
(emissão NFS-e, trigger nota→recebível, conciliação, notas de entrada, ingestão manual).
Este doc lista o que foi encontrado, o que já foi corrigido e o que virou plano.

## Corrigido nesta rodada

| # | Achado | Correção | Onde |
|---|---|---|---|
| H7 | Perfil **viewer/demo** conseguia emitir NFS-e real no SEFIN | `nfse-proxy` barra papel viewer antes de emitir | `nfse-proxy/index.ts` |
| C1 | Nota **autorizada no SEFIN mas perdida** se o insert falhava (erro engolido) | captura o erro do insert e devolve os dados fiscais + alerta, nunca "sucesso" silencioso | `nfse-proxy/index.ts` |
| H1 | Chave de idempotência **bloqueava emissão avulsa legítima** (mesmo valor/competência) | só deduplica com `idempotencyKey` explícita ou `sales_order`; avulsa não dedup por valor | `nfse-proxy/index.ts` |
| H2 | Conciliação: **dupla-baixa** em corrida (read-then-write) → receita/despesa dobrada | `UPDATE ... WHERE transaction_id IS NULL` + checa linhas afetadas; trava reuso da transação | `reconcile-transactions/index.ts` |
| H3 | `settle` **não revalidava** valor/tipo no servidor (crédito de R$5 baixava título de R$10k) | revalida `type` (revenue/expense) e valor dentro da tolerância antes de liquidar | `reconcile-transactions/index.ts` |
| H5/C1 | Trigger criava **recebível fantasma** para NFC-e (venda à vista) e pedido já faturado | trigger ignora `nfce/cupom/sat` e pedidos que já têm recebível | migration `..._review_fixes_fiscal.sql` |
| H4/C2 | Importar XML de **nota de saída duplicava** (sem unicidade por chave) | índice único `invoices(company_id, chave_acesso)` + dedup no import | migration + `ImportarNotaXml.tsx` |
| M3 | CNPJ da empresa ausente classificava **nota própria como compra** | import bloqueia e avisa quando a direção é ambígua | `ImportarNotaXml.tsx` |
| M5 | Parse de valor **zerava** em `1.234,56` (milhar) | parser pt-BR correto | `inbound-documents/index.ts`, `ImportarNotaXml.tsx` |
| M1 | Transação **conciliada sumia da consolidação de grupo** (view filtrava só `confirmed`) | view passa a contar `confirmed` + `reconciled` | migration |

## Corrigido nesta rodada — modelagem (2026-08-12, commit `78794c3`)

| # | Achado | Correção | Onde |
|---|---|---|---|
| Estr-C1 | **Dupla contagem do OCR**: um scan criava `transactions` de receita/despesa **e** o título (`invoices`/`bills_payable`) → dinheiro contado 2×; `scanner`/`ocr` fora da dedup | scan gera **um** artefato: nota/boleto/guia = só título; comprovante/recibo respeitam o toggle `pending`(título) × `confirmed`(caixa); a `transactions` só nasce no caixa. `reconcile_pj`/`list_pending` passam a deduplicar `scanner`/`ocr` | `useDocumentScanner.ts`, `reconcile-transactions/index.ts` |
| Estr-C3 (parcial) | **Recebível nascia à vista** (`due_date = emissão`) → "vencido" no dia seguinte, e **sem conta contábil** | `due_date = emissão + prazo` (`nfse_config.prazo_recebimento_dias`, default 30); `account_id` = receita 3.1 (serviço) / 3.2 (produto) por empresa | migration `..._modelagem_recebivel_contabil.sql` |
| Estr-C4 | **Ciclo não fechava contábil**: `settle` não propagava `account_id` → receita/despesa caía em "Sem conta contábil" no DRE | `settle_receivable`/`settle_payable` herdam `account_id` do título para a transação conciliada; `bills_payable` ganhou `account_id` com default de despesa (4.1) via trigger central | migration + `reconcile-transactions/index.ts` |
| Estr-A1 (parcial) | **Cancelar a nota não estornava o recebível** | trigger em `invoices.status='cancelled'` cancela o recebível aberto (não baixado); recebível já recebido exige estorno manual (o dinheiro entrou) | migration |

Verificado por smoke test (nota autorizada → recebível com vencimento emissão+30 e conta 3.1 → cancelamento → recebível `cancelado`), com rollback dos dados de teste.

## Corrigido nesta rodada — resíduo (2026-08-12, commits `832fb3b`/`1b6e144` app, `ca3142a` worker)

Os oito itens do plano foram implementados, aplicados e (onde possível) testados:

| # | Achado | Correção | Onde |
|---|---|---|---|
| Estr-C3 (resíduo) | Recebível pelo **bruto** e em **parcela única** (ignora retenções e o parcelamento) | nota carrega `valor_liquido`/`valor_retencoes`/`duplicatas`; trigger gera N recebíveis (parcela i/n nas datas das `<dup>`) e usa o **líquido** de retenções; `ImportarNotaXml` parseia `<cobr><dup>` e retenções (ISS/IRRF/PIS/COFINS/CSLL/INSS) | migration `..._parcelas_retencoes_baixa_parcial.sql`, `ImportarNotaXml.tsx` |
| Estr-A4 | Nota de entrada vira **1 conta a pagar** em emissão+30 fixo | `to_bill` gera **N contas a pagar** nas datas reais das duplicatas | `inbound-documents/index.ts` |
| Estr-A2 | Baixa **tudo-ou-nada** (sem recebimento parcial) | RPC atômico `aplicar_baixa_titulo` (lock de linha + razão `title_payments`, `unique(tx)` anti-reuso); `settle_*` aceitam `amount` parcial; `suggest_*` casam contra o **saldo** | migration + `reconcile-transactions/index.ts` |
| Estr-A1 | **Cancelar a nota não tinha evento fiscal** (`/cancel` do worker era 501) | worker registra o evento **e101101** (Cancelamento) por mTLS no SEFIN (`POST /nfse/{chave}/eventos`); `nfse-proxy` passa o cert e marca a nota `cancelled` → dispara o estorno do recebível | `nfse-worker` `cancel.ts`/`dps-xml.ts`/`sefin-client.ts`, `nfse-proxy` |
| Estr-A3 | **MDe** (manifestação do destinatário) não automatizada | ação `manifestar` (Ciência da Operação e demais tipos) via Focus, com carimbo de prazo (`manifestacao_at`); preparada quando não há token | `inbound-documents/index.ts` |
| Tec-H6/P1 | Cert A1, senha e `worker_api_key` **legíveis por qualquer membro** (SELECT via RLS) | `REVOKE SELECT` das 3 colunas para anon/authenticated; edges leem por RPC `get_nfse_secrets` (service_role); front usa `cert_cnpj` como indicador e nunca reenvia segredo vazio | migration `..._nfse_segredos_service_role.sql`, `nfse-proxy`, `NfseIntegration`/`NfseSetupWizard`/`NfseEmit`/`useIntegrationsStatus`/`integracoes-io` |
| Tec-C2 | **Claim-first** ausente: retry/concorrência podiam transmitir a nota 2× ao SEFIN | `nfse-proxy` reserva a nota como rascunho ligado à `idempotency_key` (índice único) **antes** de transmitir; retry sem confirmação não retransmite; rejeição libera o rascunho | migration `..._emissao_claim_first_cancelamento.sql`, `nfse-proxy` |
| RTC | IBS/CBS no DPS | grupo RTC/IBS-CBS **opt-in** no DPS (só quando `EmitParams.rtc` vem preenchido); desligado por padrão para não quebrar homologação enquanto o leiaute é transitório | `nfse-worker` `dps-xml.ts`, `nfse-proxy` |

Verificações: smoke tests no banco (nota com 2 duplicatas → 2 parcelas nas datas/valores certos; baixa parcial 600+400 → quita, saldo 0; `get_nfse_secrets` devolve o cert server-side). Worker recompilado (`npx tsc`) e redeployado no Railway (v1.1.0, health OK).

### Resíduo remanescente (menor, sem bloquear o ciclo)

- **XML completo da entrada via ADN/MDe**: a `manifestar` dá Ciência; puxar o XML completo (itens) da NF-e destinada pela Focus para enriquecer automaticamente é o próximo passo (o import manual de XML já cobre duplicatas/itens).
- **Cancelamento e RTC em produção**: código pronto e no ar em homologação; a validação de leiaute do evento e do RTC em produção depende de rodada com o SEFIN/municipal.
