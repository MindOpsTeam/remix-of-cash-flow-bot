# Plano: Contratos + Contas a Receber recorrente (boleto automático)

**Origem:** diretriz do cliente Thiago Zanatta (Nina SDR Contabilidade, serviços recorrentes) —
"criar Contas a Receber" e "Contrato que todo mês gera automaticamente o Contas a Receber e o
boleto, enviando ao cliente (como no Conta Azul)". Mais: entender como o Open Finance se encaixa.
**Complexidade:** Large. **Restrição mestre:** fechar o loop AR→DRE respeitando os invariantes
(docs/REVISAO-PROFUNDA-2026-07.md) — cobrança recebida vira `transactions` type=revenue,
status=confirmed, classificada. Nada de dado que não reflita no DRE.

## Contexto: como o Open Finance se encaixa (resposta à 1ª pergunta do cliente)
São dois lados complementares do caixa:
- **Contratos/Contas a Receber = o que DEVE entrar.** Gera a cobrança/boleto e a expectativa de recebimento (via Asaas, que já integramos).
- **Open Finance = o que ENTROU de fato.** Conecta o banco e traz o extrato para conciliar (já construído — ver docs/OPEN-FINANCE-DECISAO.md).
- **Conciliação:** quando o boleto é pago, o Asaas confirma (webhook) e o Open Finance vê o crédito no extrato. Regra anti-duplicidade: um recebimento = **um** lançamento no ledger; a linha do extrato OF concilia com o receivable pago em vez de gerar outra receita.

## O que já temos (grounding — não reinventar)
- `company_asaas_config/payments/subscriptions` + edge `company-asaas-api` (hoje só **sincroniza/lê** do Asaas: sync-payments/subscriptions; **falta criar** cobrança/assinatura/cliente).
- `company-asaas-webhook` + `_shared/asaas-processor.ts` (trata PAYMENT_/SUBSCRIPTION_ → atualiza tabelas-espelho). **GAP CRÍTICO: NÃO cria `transactions`** — logo cobrança recebida hoje NÃO vira receita no DRE.
- `contacts` (clientes: document, email, whatsapp, default_payment_terms, credit_limit) — vira o "customer" do Asaas.
- `bills_payable` (Contas a Pagar) — **padrão de espelho** para o novo `receivables` (mesma estrutura de status/alçada/UI).
- `agent-collections` já lê `company_asaas_payments` → passará a cobrir as cobranças de contrato automaticamente.
- `GroupApArCard` já mostra "A receber" de `company_asaas_payments` → passará a refletir os contratos.

## Patterns to Mirror
| Categoria | Fonte | Padrão |
|---|---|---|
| Módulo AR espelho de AP | `src/hooks/useBillsPayable.ts`, `src/pages/fiscal/BillsPayable.tsx` | tabela própria + hook + página com status/aprovação |
| Ação Asaas | `supabase/functions/company-asaas-api/index.ts` (switch action) | novas actions `create-customer`, `create-subscription`, `create-payment` no mesmo switch |
| Webhook → domínio | `_shared/asaas-processor.ts` processEvent | estender p/ upsert em `receivables` + insert em `transactions` no PAYMENT_RECEIVED |
| RLS multi-tenant | migrations 20260709* | `is_company_member(company_id)` |
| Cron | `smart-alerts`, `agent-collections` | `X-Cron-Secret` + pg_cron |
| Loop→ledger (invariantes) | `TransactionForm` insert | type=revenue, status=confirmed, account_id+cost_center_id classificados, source novo |

## Arquitetura
1. **`contracts`** (nosso conceito de Contrato): company_id, contact_id, description, amount, cycle (MONTHLY…), billing_day, payment_method (BOLETO/PIX/CREDIT_CARD), start_date, end_date, status (active/paused/ended), **account_id + cost_center_id** (classificação contábil da receita — chave p/ o DRE), asaas_subscription_id, next_due_date.
2. **`receivables`** (Contas a Receber, first-class, espelho de bills_payable): company_id, contact_id, contract_id (nullable), description, amount, due_date, status (a_receber/recebido/vencido/cancelado), source (contrato/asaas/manual), asaas_payment_id, boleto_url, pix_url, payment_date, transaction_id (link p/ o lançamento gerado no recebimento).
3. **company-asaas-api**: novas actions `create-customer` (contato→cliente Asaas), `create-subscription` (contrato→assinatura recorrente; Asaas gera boleto mensal e **envia ao cliente** por e-mail/notificação nativa), `create-payment` (cobrança avulsa).
4. **asaas-processor / webhook — FECHA O LOOP:** PAYMENT_CREATED → upsert `receivables` (a_receber + boleto/pix URL); PAYMENT_RECEIVED/CONFIRMED → marca recebido + **INSERT `transactions`** (type=revenue, status=confirmed, source='receivable', account_id/cost_center_id herdados do contrato) e grava transaction_id no receivable. Idempotente por asaas_id.
5. **Cron `contracts-billing`** (rede de segurança): varre contratos ativos cujo billing_day chegou e que não têm assinatura Asaas (ou método manual) → gera receivable + cobrança. Para contratos com assinatura Asaas, a recorrência é do Asaas (não duplicar).
6. **UI**: página `/receivables` (Contas a Receber — lista, vencidos, filtros, baixa manual, link do boleto) + gestão de **Contratos** (CRUD, ver receivables gerados, pausar). Entram na navegação em **Operação** (Contas a Receber) e **Cadastros/Gestão** (Contratos). Reusa componentes de bills_payable.

## Files to Change
| File | Ação | Porquê |
|---|---|---|
| `supabase/migrations/2026071x_contracts_receivables.sql` | CREATE | tabelas contracts + receivables + RLS + índices |
| `supabase/functions/company-asaas-api/index.ts` | UPDATE | actions create-customer/create-subscription/create-payment |
| `supabase/functions/_shared/asaas-processor.ts` | UPDATE | PAYMENT_* → receivables + transactions (fecha loop DRE) |
| `supabase/functions/contracts-billing/index.ts` | CREATE | cron de geração p/ contratos manuais/sem Asaas |
| `src/hooks/useReceivables.ts` | CREATE | espelho de useBillsPayable |
| `src/hooks/useContracts.ts` | CREATE | CRUD de contratos + criar assinatura |
| `src/pages/Receivables.tsx` | CREATE | Contas a Receber |
| `src/pages/Contracts.tsx` | CREATE | Contratos |
| `src/components/AppSidebar.tsx` | UPDATE | Contas a Receber (Operação) + Contratos (Gestão) |
| `src/App.tsx` | UPDATE | rotas /receivables, /contracts |
| `src/lib/receivables.ts` + `src/test/receivables.test.ts` | CREATE | status/vencimento puros + testes |

## Tasks (fases)
### Fase 1 — Domínio (migration + AR manual)
- Criar `contracts` + `receivables` (RLS is_company_member), aplicar via query_sql.
- `useReceivables` + página `/receivables` (baixa manual → cria transaction revenue classificada). **Já entrega "Contas a Receber" independente de Asaas.**
- **Validar:** criar receivable manual, dar baixa, ver a receita no DRE do mês.

### Fase 2 — Contratos + Asaas (recorrência + boleto automático)
- Actions create-customer/create-subscription na company-asaas-api.
- `useContracts` + página `/contracts`: criar contrato → cria cliente + assinatura Asaas → Asaas gera boleto mensal e envia ao cliente.
- **Validar (sandbox Asaas):** criar contrato → assinatura criada → cobrança gerada → boleto/pix URL no receivable.

### Fase 3 — Fecha o loop (webhook → DRE) + cobrança
- Estender asaas-processor: PAYMENT_CREATED→receivable; RECEIVED→recebido + transaction revenue (herda account_id do contrato) + anti-duplicidade com Open Finance.
- Ligar agente de cobrança aos receivables vencidos.
- **Validar:** simular PAYMENT_RECEIVED no sandbox → receivable recebido + 1 lançamento revenue no ledger + DRE atualizado; conferir que o extrato OF do mesmo crédito NÃO duplica.

## Validation
```bash
npm run lint && npm test && npm run build
# e2e: contrato → cobrança sandbox Asaas → webhook RECEIVED → receita no DRE (tenant de teste, destruir ao fim)
```

## Risks
| Risco | Prob. | Mitigação |
|---|---|---|
| **Duplicidade AR-pago × extrato Open Finance** | Alta | conciliar por valor+data/asaas_id; extrato OF concilia com receivable, não gera 2ª receita |
| Recebimento não classificado polui DRE | Média | contrato carrega account_id/cost_center_id obrigatórios → herdados no lançamento |
| Criar cobrança no Asaas exige customer válido (CPF/CNPJ do contato) | Média | validar document no contato antes; erro claro |
| Deploy de edge gated (MCP 403) | Certa | commit+push+send_prompt no Lovable (padrão do projeto) |
| Escopo: Conta Azul tem NF automática junto | Média | v1 = cobrança/boleto; emitir NFS-e no recebimento fica p/ fase 4 (já temos emissão) |

## Acceptance
- [ ] Contas a Receber funciona (manual + de contrato), com vencidos e baixa.
- [ ] Contrato gera boleto recorrente via Asaas e envia ao cliente.
- [ ] Recebimento vira **1** receita classificada no DRE (loop fechado, sem duplicar com Open Finance).
- [ ] Invariantes do DRE preservados; testes verdes; verificado em sandbox.

> Referência do cliente: **Sittax** (crawl em andamento) — folga fiscal/contábil; incorporar aprendizados na seção fiscal/estratégia após o crawl.
