# Plano: Copiloto da Reforma — inteligência de impacto sobre dado real (o que o mercado não tem barato)

**Origem:** pesquisa profunda (5 frentes: ERPs PME, motores enterprise, Receita/Serpro, SEFAZ/mecânica, espaço em branco comercial) + as notas `docs/INTEGRADOR-NACIONAL-ALIQUOTAS.md` e `docs/MIDDLEWARE-FISCAL-DECISAO.md`.
**Complexidade:** Large (fatiável). **Tese:** não competir no que virou commodity (auto-preencher NF + simulador grátis de estimativa), e sim ocupar a **interseção que ninguém entrega barato para PME**: impacto da Reforma **por cliente/produto, sobre o dado real que o ERP já tem, incluindo a cadeia de crédito B2B e o split payment no fluxo de caixa** — empacotado como **parecer white-label** que o contador entrega.

---

## 1. Síntese de mercado (o que a pesquisa fechou)

### Virou COMMODITY (não diferenciar aqui)
- **Auto-preenchimento de IBS/CBS na NF-e/NFC-e/NFS-e** (CST + cClassTrib, NT 2025.002): Conta Azul, Omie, Bling, Tiny/Olist, Domínio, TOTVS, Sage IOB. Gatilho: rejeição da NF sem os campos a partir de **03/08/2026** (regime regular).
- **Simulador/calculadora grátis de estimativa** como isca: Conta Azul, Omie, Contabilizei, Tiny, TOTVS (TIT no enterprise). A **Calculadora oficial CBS/IBS/IS da Receita** (beta desde 18/07/2025) commoditizou a matemática.
- **Hub de conteúdo + curso "descomplica"**: universal.

### LACUNAS recorrentes (o que ninguém entrega bem — nossa entrada)
1. **Cadeia de crédito não-cumulativo por cliente/fornecedor real (B2B):** todos simulam no nível da própria empresa ou por operação isolada. A dor **mais citada e menos quantificada** do mercado (Ottimizza, Migalhas, Fenacon: tudo conceitual). Ninguém mostra "quanto de crédito seu cliente PJ perde comprando de você".
2. **Simulação por cliente B2B de verdade** (não toggle grosso PF/PJ da Contabilizei).
3. **Puxar o dado real do ERP** para a simulação (a maioria é digitação manual; só Omie/TOTVS alegam dado real, e TOTVS é enterprise preso ao ERP).
4. **Split payment ligado ao fluxo de caixa** — órfão: TEF/PDV só posiciona, ERPs cuidam da emissão. Ninguém projeta o fim do "float tributário" sobre o caixa real.
5. **Reprecificação em massa (cálculo "por fora")** para manter margem — Conta Azul dá "preço do futuro" um item por vez.
6. **Decisão de regime do Simples (dentro×híbrido, prazo 1-30/09/2026)** com números por cliente.
7. **Alcance PME:** o robusto é enterprise (TIT preso ao ERP; ONESOURCE/Avalara/Systax sob consulta); o que a PME alcança é raso.

**Whitespace = interseção:** *alcançável por PME + por cliente B2B + cadeia de crédito não-cumulativo + sobre dado real do ERP + split payment no caixa.* Cada player entrega 1-2 vetores; ninguém entrega o conjunto **self-serve, barato, sobre o dado vivo do ERP**. **Esse conjunto é exatamente o que o FinanceAI pode montar** porque já tem NF (PlugNotas), DRE, contas a pagar/receber, contratos e Open Finance.

### Concorrentes mais próximos (honestidade competitiva — o conceito NÃO é inédito; a entrega barata sobre dado vivo é)
- **Roit** (roit.ai): o mais avançado. **Strategy** já faz impacto por item/fornecedor + cadeia **T1-T2-T3** + algoritmo **NET ZERO de reprecificação**; **RAI** faz split payment ("smart contract" que instrui o banco); **Discovery** recupera crédito via SPED+IA. MAS: núcleo enterprise/consultivo, base em **SPED histórico**, e o self-serve (**ROIT START R$499-1.897/mês**) é adequação/compliance, não impacto sobre o dado vivo do PME.
- **Sittax RT** (a referência do cliente): analisa **XML+PGDAS** e mostra o regime mais econômico (Simples/Híbrido/Normal) + corrige cClassTrib. MAS: **não emite**, é **sales-led** para contador, e roda sobre o que o contador importa, não sobre o ERP operacional do PME.
- **Taxcel** (Simulador da Reforma, **Hub Starter ~R$18.210/ano**) e **Sovos Taxrules** (simulador de cenários preço/NCM/margem/caixa): potentes, mas **SPED-based / enterprise**, mirando o time fiscal.
- **Qive (ex-Arquivei):** Portal de Fornecedores que **verifica se o fornecedor pagou IBS/CBS antes de liberar o crédito** — ataca o condicionamento do crédito ao split. Enterprise, sales-led.

**Nosso ângulo defensável (não é "ter simulador"):** rodar tudo isso **sobre o dado que o ERP já tem** (NF via PlugNotas + DRE + contas + cash-flow + **Open Finance**), **sem upload de SPED, sem consultoria, self-serve, barato, white-label pro contador**. O split payment amarrado ao **extrato bancário real (Open Finance)** é algo que nem Roit/Qive fazem — eles instruem/verificam pagamento, não projetam o caixa do PME sobre o banco dele. É aí que somos únicos.

### Preço observado (benchmark, sem inventar)
- **Btax** (diagnóstico via escritório): **R$4.500 / R$7.500 / R$14.000 por cliente** (macro / por produto / planejamento); cobra por CNPJ/faturamento.
- Consultoria tributária avulsa: R$150-500/h; parecer R$500-3.000; acompanhamento R$1.500-10.000/mês.
- Honorário contábil recorrente 2026 (onde encaixar add-on): Simples R$400-1.500/mês; Presumido R$1.500-3.500.
- **Modelo que o nicho valida:** setup (diagnóstico) + recorrência **por CNPJ**, **plurianual** (janelas 2027/2029/2030/2031/2032/2033), **contador como comprador/revenda white-label**.

---

## 2. Trilhos OFICIAIS gratuitos (a arquitetura certa consome, não reimplementa)

| Artefato oficial | Onde | Grátis? | Integrável? | Uso no produto |
|---|---|---|---|---|
| **Calculadora CBS/IBS/IS — componente LOCAL/offline** | download; expõe API em `localhost:8080` (regime geral) / `8081` (split) | ✅ (local é grátis) | ✅ mesma API REST, sem internet | motor oficial de cálculo por item — self-hosted p/ **não pagar** a API hospedada |
| Calculadora — **API REST hospedada** | `piloto-cbs.tributos.gov.br/servico/calculadora-consumo/api` | ⚠️ **pode ser cobrada** (Integra Contador) | ✅ | fallback; preferir o local |
| **Dados Abertos** (CST, cClassTrib, NCM/NBS, alíquotas, reduções) | endpoints "Dados Abertos" da Calculadora | ✅ | ✅ | fonte da verdade das tabelas/reduções |
| **CST + cClassTrib + cCredPres** | SVRS Conformidade Fácil `cff.svrs.rs.gov.br/api/v1/consultas/classTrib` (JSON) | ✅ | ✅ **TLS mútuo, cert ICP-Brasil A1** | tabela versionada (reusar o A1 do `nfse-worker`) |
| **Validador RTC NF-e** | `dfe-portal.svrs.rs.gov.br/Cff/ValidadorRtcNfe` | ✅ | 🟡 web | validar contra o oficial em vez de reimplementar o motor |
| **API Apuração Assistida CBS** | `consumo.tributos.gov.br` (produção beta desde 12/01/2026) | ✅ (teste) | ✅ | futuro: crédito condicionado ao recolhimento |
| Split Payment — Manual + Swagger | Ato Conjunto RFB/CGIBS 2/2026; Decreto 12.955/2026 | ✅ | ✅ (p/ PSPs) | referência de mecânica p/ o simulador de caixa |

**Princípio (herdado da nota INTEGRADOR):** o ERP nunca chama a fonte na hora de calcular — lê do **rate store interno versionado por vigência**; adapters sincronizam. O **cálculo CBS/IBS por item é commodity** (motor oficial local) — o moat é o que fazemos **em cima do dado real**.

---

## 3. O que já temos (grounding — não reinventar)

| Ativo | Arquivo/objeto | Papel no plano |
|---|---|---|
| Simulador de regime (Simples×Híbrido×Normal 2027-33) | `src/lib/reforma-simulator.ts` (+ 15 testes) | **base do compute**; `ibsFracao`/`IVA_REF` já batem com a lei — estender p/ reduções |
| Destaque CBS/IBS de emissão | `src/lib/reforma.ts` | cClassTrib/CST padrão já modelados |
| Rate store temporal | tabela `tax_rates` (tax, ente, item, rate, vigência, confidence) | onde entram reference-rate + reduções + frações de transição |
| Sync de alíquotas (cron) | edge `tax-rates-sync` | estender p/ semear reforma + versionar |
| ICMS interestadual/DIFAL | `src/lib/icms.ts` (+ testes) | camada hardcodável (transição ICMS→IBS) |
| Página do simulador + separador Contábil | `src/pages/ReformaSimulator.tsx`, `AppSidebar.tsx` (grupo `contabil`) | casa das novas telas |
| Dado real (o ativo único) | `transactions` (receita), `contacts` (person_type/document → B2B/B2C), `bills_payable`/despesas (insumos creditáveis), NFs via PlugNotas, Open Finance | **matéria-prima da simulação zero-digitação** |
| Multi-tenant por CNPJ | `companies`/`company_members`, `is_company_member` | cobrança por CNPJ + canal do contador |
| Notas de decisão | `docs/INTEGRADOR-NACIONAL-ALIQUOTAS.md`, `docs/MIDDLEWARE-FISCAL-DECISAO.md` | build-vs-buy já decidido (não montar ICMS-ST; consumir motor grátis) |

---

## 4. Arquitetura proposta (camadas)

**A. Conteúdo/regras (versionado por vigência)** — estende `tax_rates`:
- `reference` rates CBS/IBS por ano (frações de transição já em `reforma-simulator`; migrar p/ store);
- **reduções**: diferenciado 60% (paga 40% ≈ 10,6%), 30% (18 profissões ≈ 18,55%), alíquota zero; por `cClassTrib`/atividade;
- fonte da verdade = **Dados Abertos da Calculadora + SVRS** (adapter cert-gated); fallback = seed curado (`confidence=estimado/revisar`);
- **camada de versão** (`version`, `vigencia_inicio/fim`) porque é alvo móvel (LC 227/2026, NT v1.00→v1.50, minuta split).

**B. Compute (estimativa configurável + oficial opcional):**
- `lib/reforma-simulator.ts` estendido: regimes reduzidos + por item/cClassTrib;
- novo `lib/reforma-credito.ts` (puro): **cadeia de crédito B2B** — crédito que a empresa gera ao cliente (por fora) vs perde (Simples por dentro);
- novo `lib/reforma-caixa.ts` (puro): **split payment** — quanto do imposto sai do caixa no ato (fim do float), por mês, por mix de recebimento;
- novo `lib/reforma-preco.ts` (puro): **reprecificação por fora** para margem-alvo por janela;
- opcional (Fase 5): edge `reforma-calc` que embrulha o **componente LOCAL da Calculadora RFB** para número oficial por item.

**C. Agregação sobre dado real (o moat):**
- hook/edge que lê `transactions`/NFs → receita por **cliente** (contact) e por **produto**, classifica B2B/B2C por `person_type`/`document`, e `bills_payable`/despesas → base de crédito. **Zero digitação.**

**D. Superfícies (telas em `Contábil`):**
1. `/reforma` (existe) → **modo "carteira real"** (pré-preenche do dado agregado, não só manual);
2. **Impacto por cliente/produto** (top 20 + cadeia de crédito B2B) — a tela-assinatura;
3. **Reprecificação** (margem-alvo, por fora, por janela);
4. **Caixa & Split Payment** (projeção de capital de giro, plugado no cash-flow/Open Finance);
5. **Parecer da Reforma** (relatório/PDF **white-label por CNPJ** para o contador entregar + rascunho de aviso por cliente).

---

## 5. Build vs Buy (decisão)
- **BUILD (moat, sobre nosso dado):** agregação por cliente/produto; simulações de regime, cadeia de crédito, reprecificação e caixa/split (estimativa, alíquotas configuráveis); parecer white-label. Nada disso existe barato para PME.
- **CONSUMIR grátis:** motor CBS/IBS por item (**componente local** da Calculadora RFB); tabelas CST/cClassTrib/reduções (Dados Abertos + SVRS); ISS auto + emissão (PlugNotas, já pago).
- **NÃO construir:** base ICMS-ST/MVA, motor de validação cClassTrib completo, interpretação legal por item (consumir o oficial). ICMS/ISS são ativos depreciáveis (viram IBS até 2033).

---

## 6. Files to Change (grounded)
| File | Ação | Porquê |
|---|---|---|
| `supabase/migrations/2026xxxx_reforma_rates.sql` | CREATE | reference-rate + reduções + frações no `tax_rates` (versionado) |
| `supabase/functions/tax-rates-sync/index.ts` | UPDATE | semear reforma (reduções/frações) + adapter Dados Abertos/SVRS |
| `src/lib/reforma-simulator.ts` | UPDATE | regimes reduzidos (60/30/zero) + por cClassTrib |
| `src/lib/reforma-credito.ts` + teste | CREATE | cadeia de crédito B2B (puro) |
| `src/lib/reforma-caixa.ts` + teste | CREATE | split payment no caixa (puro) |
| `src/lib/reforma-preco.ts` + teste | CREATE | reprecificação por fora (puro) |
| `src/hooks/useReformaCarteira.ts` | CREATE | agrega receita por cliente/produto + B2B/B2C do dado real |
| `src/pages/ReformaSimulator.tsx` | UPDATE | modo "carteira real" (prefill agregado) |
| `src/pages/ReformaImpactoClientes.tsx` | CREATE | impacto por cliente + cadeia de crédito (tela-assinatura) |
| `src/pages/ReformaCaixa.tsx` | CREATE | split payment × fluxo de caixa |
| `src/pages/ReformaParecer.tsx` | CREATE | parecer white-label por CNPJ + aviso por cliente |
| `src/components/AppSidebar.tsx` | UPDATE | itens novos no separador `contabil` |
| `src/App.tsx` | UPDATE | rotas novas |
| `supabase/functions/reforma-calc/index.ts` | CREATE (Fase 5) | wrapper do componente LOCAL da Calculadora RFB (número oficial por item) |

---

## 7. Fases

> **Status (17/07, commits 8953096+):** Fases 0-2 IMPLEMENTADAS e e2e-validadas (PDCA 5 ciclos). `reforma-rates` (reduções 60/30/zero) + `reducaoIva` no simulador; `useReformaCarteira` (zero-digitação sobre receivables+contracts, B2B/B2C via person_type); `/reforma` modo carteira; `lib/reforma-credito` + `/reforma/impacto` (cadeia de crédito B2B). 98 testes, agregação SQL bate com o lib, DRE intacto (read-only). **Falta:** Fase 3 (caixa/split payment no Open Finance + reprecificação), Fase 4 (parecer white-label), Fase 5 (motor local RFB + sync SVRS). Publish do frontend gated.
- **Fase 0 — Fundação de regras (versionada):** migration + `tax-rates-sync` semeando reduções/frações; seed curado (confidence=estimado); testes. *Sem risco ao DRE.*
- **Fase 1 — Zero-digitação:** `useReformaCarteira` (agrega dado real) + `/reforma` modo carteira. Já entrega o que Conta Azul não faz (dado real, sem digitar).
- **Fase 2 — Cadeia de crédito B2B (a tela-assinatura):** `lib/reforma-credito` + `/reforma/impacto`. O vetor mais citado e menos quantificado do mercado.
- **Fase 3 — Caixa & reprecificação:** `lib/reforma-caixa` (split) + `lib/reforma-preco` + telas; plugar no cash-flow/Open Finance.
- **Fase 4 — Parecer white-label + aviso ao cliente:** `/reforma/parecer` (PDF por CNPJ, marca do contador). Fecha o modelo de canal.
- **Fase 5 (à prova de futuro):** edge `reforma-calc` embrulhando o **componente local** da Calculadora RFB (número oficial por item) + sync SVRS de cClassTrib (cert A1 do `nfse-worker`).

---

## 8. Validation
```bash
npm run lint && npm test && npm run build
# e2e: carteira de teste (SQL) com NFs/receita por cliente B2B e B2C →
#   /reforma modo carteira prefilled → impacto por cliente → cadeia de crédito → caixa split;
#   conferir que nada altera a régua do DRE (feature isolada). Destruir tenant ao fim.
```

## 9. Risks
| Risco | Prob. | Mitigação |
|---|---|---|
| **Alvo móvel** (LC 227/2026, NT v1.50, minuta split) | Alta | store versionado por vigência + rótulo "estimativa" + cadência de atualização de conteúdo |
| API oficial hospedada **cobrada** (Integra Contador) | Média | usar **componente LOCAL** da Calculadora (grátis, offline) |
| **Cert ICP-Brasil A1** p/ SVRS/Calculadora | Certa | reusar o A1 do `nfse-worker`; degradar p/ seed curado se ausente |
| Crédito real depende do **recolhimento do fornecedor** (art. 47) — não temos esse dado | Alta | modelar por **destaque** (estimativa), rotular claro; conciliação via Apuração Assistida fica p/ futuro |
| **Regimes específicos** = mini-motores (combustível ad rem, financeiro, imóveis) | Média | MVP cobre Regime Geral + diferenciados (60/30/zero); específicos → "consulte o contador" |
| Constraint "as is, sem suporte" × conteúdo que muda | Média | telas self-serve + parecer gerado; atualização de conteúdo é custo de produto (aceito), não suporte 1:1 |
| Precisão vira promessa jurídica | Média | disclaimer forte (já no padrão do `/reforma`): apoio gerencial, decisão é empresa+contador |
| **Roit/Sittax/Taxcel descerem para PME** (conceito não é inédito) | Média | correr no ângulo que eles não têm: dado **vivo** do ERP (sem SPED/upload) + split no **Open Finance** + preço/white-label; velocidade de entrega (já temos o dado e o simulador) |
| Roit já tem NET ZERO/T1-T2-T3/RAI | — | não competir em profundidade enterprise; ganhar em alcance PME + integração nativa ao ERP operacional |

## 10. Modelo comercial (implicação, não código)
Setup (diagnóstico automático sobre o dado real) + **recorrência por CNPJ**; **white-label** para o contador entregar ao cliente dele; **plurianual** (a régua muda em 2027/2029-2033). Ancoragem: Btax cobra R$4.5k-14k/cliente via SPED e consultoria — nós entregamos **self-serve, sobre o dado que já está no ERP**, por uma fração. Casa com o multi-tenant por CNPJ e com a oportunidade Que Coffee/franquias (parecer por franqueado) e Caio/supermercado.

## 11. Acceptance
- [ ] Simula a Reforma **sobre o dado real** do tenant (zero digitação), por cliente e por produto.
- [ ] Quantifica a **cadeia de crédito B2B** (o que nenhum concorrente PME faz).
- [ ] Projeta o **split payment no caixa** (capital de giro), plugado ao cash-flow.
- [ ] Gera **parecer white-label por CNPJ** + rascunho de aviso ao cliente.
- [ ] Consome os **trilhos oficiais grátis** (motor local, tabelas SVRS/Dados Abertos); não reimplementa o motor nem monta ICMS-ST.
- [ ] Régua do DRE intacta; testes verdes; conteúdo versionado por vigência.

## 12. Fontes (primárias e datadas)
piloto-cbs.tributos.gov.br (Calculadora RFB/Serpro, API + componente local) · consumo.tributos.gov.br (Produção Beta CBS, Apuração Assistida) · cgibs.gov.br + servicos.cgibs.gov.br (Regulamento IBS 30/04/2026; split 03/08/2026) · dfe-portal.svrs.rs.gov.br + cff.svrs.rs.gov.br (Conformidade Fácil, CST/cClassTrib, API) · NT 2025.002 v1.00→v1.50 (NF-e/NFC-e IBS/CBS) · Decreto 12.955/2026 + Ato Conjunto RFB/CGIBS 2/2026 (Split Payment) · LC 214/2025 (alt. LC 227/2026) · Senado/TCU (alíquota de referência, teto 26,5%) · Resolução CGSN 186/2026 (opção Simples 1-30/09/2026) · mercado: Conta Azul, Omie, Bling, Tiny/Olist, TOTVS (TIT), Domínio/Thomson, Contabilizei, Sittax, Btax, Taxcel, e-Auditoria, Avalara, Systax, Sovos, Roit, nfe.io, WebmaniaBR, PlugNotas.
```
