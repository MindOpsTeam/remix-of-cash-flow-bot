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

## Plano (itens de modelagem fiscal/contábil — precisam de design, não bug-fix)

Priorizados; cada um muda regra de negócio e merece decisão + teste com dados reais:

1. **Contagem dupla no OCR (Estr-C1)**: o `DocumentScanner`/`useDocumentScanner` cria `transactions`
   de receita/despesa **e** `invoices`/`bills_payable` no mesmo scan → o dinheiro é contado 2x (e a
   `source='scanner'` não entra na dedup de `reconcile_pj`). Decidir: o scan gera **um** artefato de
   negócio; a `transactions` só nasce no caixa (conciliação). Incluir `scanner`/`ocr` na dedup.
2. **Recebível da nota sempre à vista e pelo bruto (Estr-C3)**: `gerar_receivable_da_nota` usa
   `due_date = emissão` e `amount = total`. Sem parcelas, sem prazo, sem líquido → nasce "vencido" no
   dia seguinte (infla vencido, consome limite de crédito), e a conciliação não casa quando há ISS
   retido/retenções (depósito líquido ≠ recebível bruto). Ler `<dup>` do XML ou pedir prazo/parcelas
   e modelar retenções.
3. **Ciclo não fecha contábil (Estr-C4)**: recebível/`settle` não propagam `account_id` nem
   `competencia_date` para a `transactions` → DRE joga a receita em `a_classificar` e o regime de
   competência não funciona. Propagar conta contábil (de `products.account_id`/classificação) e a
   competência na baixa.
4. **Cancelamento não estorna recebível (Estr-A1)** e `/cancel` do worker é 501. Trigger de
   `status='cancelled'` cancelando os recebíveis + implementar o evento de cancelamento no ADN.
5. **Baixa parcial / anti-reuso mais forte (Estr-A2)**: suportar recebimento parcial (saldo
   residual); a trava de reuso da transação já foi endurecida, mas falta a baixa parcial.
6. **Manifestação do destinatário / MDe (Estr-A3)**: automatizar ao menos a "Ciência da Operação"
   (baixa o XML completo, com duplicatas e itens) e rastrear o prazo legal.
7. **Duplicatas reais na entrada (Estr-A4)**: `to_bill` usa vencimento fixo emissão+30; ler
   `<dup>/<cobr>` do XML e gerar N contas a pagar nas datas reais.
8. **Certificado A1 + senha em texto claro (Tec-H6 / P1 da auditoria)**: mover cert/senha e
   `worker_api_key` para o Vault; hoje qualquer membro lê via RLS.
9. **Claim-first na emissão (Tec-C2)**: sob concorrência sem `idempotencyKey`, duas requisições ainda
   podem transmitir duas notas reais ao SEFIN. Fix definitivo: o front enviar `idempotencyKey` por
   tentativa + a edge inserir a invoice "pending" antes de emitir. (Mitigado: H1 já evita o bloqueio
   indevido; a proteção total precisa do front + teste com certificado.)
10. **RTC (IBS/CBS)** no DPS e validação de leiaute em homologação (já na auditoria original).
