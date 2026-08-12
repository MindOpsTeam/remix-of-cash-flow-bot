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

## Plano (resíduo — precisam de design de UI/fiscal, não bug-fix)

Priorizados; cada um muda regra de negócio e merece decisão + teste com dados reais:

1. **Retenções / ISS retido e parcelas do recebível (resíduo do Estr-C3)**: o recebível já nasce com
   prazo e conta, mas ainda é uma parcela única pelo **bruto**. Falta ler `<dup>`/retenções do XML
   (depósito líquido ≠ recebível bruto) e permitir N parcelas — exige UI de parcelamento.
2. **Cancelamento no ADN (resíduo do Estr-A1)**: o estorno do recebível já ocorre; falta o evento
   fiscal de cancelamento (`/cancel` do worker ainda é 501) no ADN.
3. **Baixa parcial / anti-reuso mais forte (Estr-A2)**: suportar recebimento parcial (saldo
   residual); a trava de reuso da transação já foi endurecida, mas falta a baixa parcial.
4. **Manifestação do destinatário / MDe (Estr-A3)**: automatizar ao menos a "Ciência da Operação"
   (baixa o XML completo, com duplicatas e itens) e rastrear o prazo legal.
5. **Duplicatas reais na entrada (Estr-A4)**: `to_bill` usa vencimento fixo emissão+30; ler
   `<dup>/<cobr>` do XML e gerar N contas a pagar nas datas reais.
6. **Certificado A1 + senha em texto claro (Tec-H6 / P1 da auditoria)**: mover cert/senha e
   `worker_api_key` para o Vault; hoje qualquer membro lê via RLS.
7. **Claim-first na emissão (Tec-C2)**: sob concorrência sem `idempotencyKey`, duas requisições ainda
   podem transmitir duas notas reais ao SEFIN. Fix definitivo: o front enviar `idempotencyKey` por
   tentativa + a edge inserir a invoice "pending" antes de emitir. (Mitigado: H1 já evita o bloqueio
   indevido; a proteção total precisa do front + teste com certificado.)
8. **RTC (IBS/CBS)** no DPS e validação de leiaute em homologação (já na auditoria original).
